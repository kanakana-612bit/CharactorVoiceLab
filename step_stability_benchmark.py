#!/usr/bin/env python3
"""Measure when acoustic identity proxies settle across TTS inference steps."""

from __future__ import annotations

import argparse
import json
import math
import statistics
import sys
import time
import zipfile
from datetime import datetime
from pathlib import Path
from typing import Any, Mapping

from seed_f0_benchmark import (
    DEFAULT_CAPTION,
    DEFAULT_TEXT,
    discover_bridge_url,
    generate_wav,
    normalize_bridge_url,
    profile_defaults,
    read_profile,
)
from voice_evaluator import analyze_wav_bytes, feature_vector, strip_private_values


PROJECT_ROOT = Path(__file__).resolve().parent
STEPS = (4, 8, 12, 16, 20)
FEATURE_GROUPS = (
    "source_and_prosody",
    "acoustic_timbre_proxy",
    "delivery_style",
)
PROVISIONAL_STABILITY_THRESHOLD = 2.5


def _finite(value: Any) -> float | None:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if math.isfinite(number) else None


def semitone_delta(left_hz: Any, right_hz: Any) -> float | None:
    left = _finite(left_hz)
    right = _finite(right_hz)
    if left is None or right is None or left <= 0 or right <= 0:
        return None
    return round(abs(12.0 * math.log2(left / right)), 6)


def proxy_distance(
    candidate: Mapping[str, Any],
    reference: Mapping[str, Any],
) -> dict[str, Any]:
    """A transparent relative feature distance for within-seed comparisons."""
    group_distances: dict[str, float | None] = {}
    all_squared: list[float] = []
    for group in FEATURE_GROUPS:
        left = feature_vector(candidate, group)
        right = feature_vector(reference, group)
        squared = []
        for key in sorted(set(left) & set(right)):
            scale = max(abs(float(left[key])) * 0.15, abs(float(right[key])) * 0.15, 0.05)
            squared.append(((float(left[key]) - float(right[key])) / scale) ** 2)
        distance = math.sqrt(statistics.fmean(squared)) if squared else None
        group_distances[group] = round(distance, 6) if distance is not None else None
        all_squared.extend(squared)
    combined = math.sqrt(statistics.fmean(all_squared)) if all_squared else None
    return {
        "combined_proxy_distance": round(combined, 6) if combined is not None else None,
        "group_proxy_distances": group_distances,
        "scale_definition": "max(abs(candidate)*0.15, abs(step20)*0.15, 0.05)",
        "speaker_identity_claim": False,
    }


def earliest_stable_step(
    measurements: list[Mapping[str, Any]],
    threshold: float = PROVISIONAL_STABILITY_THRESHOLD,
) -> int | None:
    ordered = sorted(measurements, key=lambda item: int(item["steps"]))
    for index, item in enumerate(ordered):
        later = ordered[index:]
        distances = [
            _finite(value.get("distance_to_step20", {}).get("combined_proxy_distance"))
            for value in later
        ]
        if distances and all(value is not None and value <= threshold for value in distances):
            return int(item["steps"])
    return None


def summarize_trials(trials: list[Mapping[str, Any]]) -> dict[str, Any]:
    complete = [
        trial
        for trial in trials
        if len(trial.get("measurements", [])) == len(STEPS)
    ]
    if not complete:
        raise ValueError("No complete 4/8/12/16/20 Step trials were produced.")
    stable_steps = [
        step
        for step in (earliest_stable_step(trial["measurements"]) for trial in complete)
        if step is not None
    ]
    timings: dict[str, float] = {}
    for step in STEPS:
        values = [
            float(next(item for item in trial["measurements"] if item["steps"] == step)["generation_seconds"])
            for trial in complete
        ]
        timings[str(step)] = round(statistics.fmean(values), 6)
    independent_ladder = sum(timings.values())
    single_20 = timings["20"]
    retry_budget = single_20 * 2
    early_consistent = len(stable_steps) == len(complete) and max(stable_steps) <= 12
    return {
        "schema_version": "cvd_step_stability_summary_0.1",
        "complete_trials": len(complete),
        "step_schedule": list(STEPS),
        "provisional_stability_threshold": PROVISIONAL_STABILITY_THRESHOLD,
        "earliest_stable_steps": stable_steps,
        "median_earliest_stable_step": (
            statistics.median(stable_steps) if stable_steps else None
        ),
        "mean_generation_seconds_by_step": timings,
        "mean_independent_ladder_seconds": round(independent_ladder, 6),
        "mean_standard_single_20step_seconds": round(single_20, 6),
        "mean_single_plus_one_retry_budget_seconds": round(retry_budget, 6),
        "early_identity_proxy_consistent_by_12_steps": early_consistent,
        "native_shared_prefix_snapshot_available": False,
        "common_prefix_two_branch_adoption": "not_yet_justified",
        "adoption_gate": {
            "identity_proxy_must_settle_by_step": 12,
            "all_trials_must_pass": True,
            "measured_branch_runtime_must_be_below_single_plus_one_retry": True,
            "current_result": (
                "blocked_by_missing_native_shared_prefix_measurement"
                if early_consistent
                else "rejected_by_early_stability_result"
            ),
        },
        "interpretation": {
            "measurement_kind": "independent_same_seed_predicted_audio",
            "latent_snapshot_claim": False,
            "speaker_identity_claim": False,
            "note": (
                "These runs do not reuse a diffusion prefix. They only test whether "
                "lightweight acoustic proxies stabilize early enough to justify a later "
                "native shared-prefix implementation."
            ),
        },
    }


def request_payload(config: Mapping[str, Any], seed: int, steps: int) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "model": config["model"],
        "input": config["text"],
        "language": "ja",
        "seed": seed,
        "num_inference_steps": steps,
        "options": {
            "no_ref": True,
            "caption": config["caption"],
            "duration_scale": config["duration_scale"],
            "caption_guidance_scale": config["caption_guidance_scale"],
            "trim_tail": True,
        },
        "postprocess": {"f0": {"enabled": False}},
    }
    if config.get("speaker_condition"):
        payload["speaker_condition"] = {"file": config["speaker_condition"]}
    return payload


def run_benchmark(
    config: dict[str, Any],
    output_dir: Path,
    timeout_seconds: float,
) -> dict[str, Any]:
    output_dir.mkdir(parents=True, exist_ok=False)
    audio_dir = output_dir / "audio"
    audio_dir.mkdir()
    trials: list[dict[str, Any]] = []
    total = config["sample_count"] * len(STEPS)
    current = 0
    started = time.perf_counter()
    for sample_index in range(config["sample_count"]):
        seed = config["seed_start"] + sample_index
        trial: dict[str, Any] = {"seed": seed, "measurements": []}
        analyses: dict[int, dict[str, Any]] = {}
        for steps in STEPS:
            current += 1
            print(
                f"[progress {current}/{total}] seed={seed}, steps={steps}",
                flush=True,
            )
            phase_started = time.perf_counter()
            wav_bytes = generate_wav(
                config["bridge_url"],
                request_payload(config, seed, steps),
                timeout_seconds,
            )
            wav_path = audio_dir / f"seed-{seed}-{steps}steps.wav"
            wav_path.write_bytes(wav_bytes)
            analysis = analyze_wav_bytes(
                wav_bytes,
                text=config["text"],
                target_f0_hz=config["target_f0_hz"],
            )
            analyses[steps] = analysis
            trial["measurements"].append(
                {
                    "steps": steps,
                    "generation_seconds": round(time.perf_counter() - phase_started, 6),
                    "wav_path": wav_path.relative_to(output_dir).as_posix(),
                    "analysis": strip_private_values(analysis),
                }
            )
        reference = analyses[20]
        reference_f0 = reference.get("source_and_prosody", {}).get("median_hz")
        for measurement in trial["measurements"]:
            analysis = analyses[int(measurement["steps"])]
            measurement["distance_to_step20"] = proxy_distance(analysis, reference)
            measurement["f0_delta_to_step20_semitones"] = semitone_delta(
                analysis.get("source_and_prosody", {}).get("median_hz"),
                reference_f0,
            )
        trial["earliest_stable_step"] = earliest_stable_step(trial["measurements"])
        trials.append(trial)
        _write_json(output_dir / "trials.partial.json", trials)
    summary = summarize_trials(trials)
    summary["total_elapsed_seconds"] = round(time.perf_counter() - started, 6)
    _write_json(output_dir / "experiment.json", config)
    _write_json(output_dir / "trials.json", trials)
    _write_json(output_dir / "summary.json", summary)
    (output_dir / "STEP_STABILITY_REPORT.md").write_text(
        render_report(config, summary, trials),
        encoding="utf-8",
    )
    (output_dir / "trials.partial.json").unlink(missing_ok=True)
    return summary


def render_report(
    config: Mapping[str, Any],
    summary: Mapping[str, Any],
    trials: list[Mapping[str, Any]],
) -> str:
    rows = [
        "| Seed | Earliest stable Step | 4→20 distance | 8→20 | 12→20 | 16→20 |",
        "|---:|---:|---:|---:|---:|---:|",
    ]
    for trial in trials:
        distances = {
            item["steps"]: item["distance_to_step20"]["combined_proxy_distance"]
            for item in trial["measurements"]
        }
        rows.append(
            f"| {trial['seed']} | {trial['earliest_stable_step'] or '-'} | "
            f"{distances[4]} | {distances[8]} | {distances[12]} | {distances[16]} |"
        )
    return "\n".join(
        [
            "# Step Stability Report",
            "",
            "## Scope",
            "",
            "- Same-seed audio was independently generated at 4, 8, 12, 16, and 20 Steps.",
            "- No diffusion prefix or latent state was reused.",
            "- Distances are lightweight engineering proxies, not speaker-identification scores.",
            "",
            "## Timing",
            "",
            f"- Standard 20 Step mean: {summary['mean_standard_single_20step_seconds']:.3f} s",
            f"- Single + one retry budget: {summary['mean_single_plus_one_retry_budget_seconds']:.3f} s",
            f"- Independent five-point ladder: {summary['mean_independent_ladder_seconds']:.3f} s",
            "",
            "## Adoption Decision",
            "",
            f"- Early proxy stable by 12 Steps in all trials: {summary['early_identity_proxy_consistent_by_12_steps']}",
            f"- Common-prefix two-branch adoption: `{summary['common_prefix_two_branch_adoption']}`",
            f"- Gate result: `{summary['adoption_gate']['current_result']}`",
            "",
            "A native shared-prefix implementation must be timed before adoption. It is accepted only "
            "when its measured runtime is below the 20 Step single-generation plus one-retry budget.",
            "",
            "## Trials",
            "",
            *rows,
            "",
            "## Configuration",
            "",
            f"- Model: `{config['model']}`",
            f"- Samples: {config['sample_count']}",
            f"- Speaker condition: `{config.get('speaker_condition') or 'none'}`",
        ]
    ) + "\n"


def _write_json(path: Path, value: Any) -> None:
    path.write_text(
        json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False) + "\n",
        encoding="utf-8",
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Compare same-seed predicted audio at 4/8/12/16/20 inference Steps."
    )
    parser.add_argument("--profile", type=Path)
    parser.add_argument("--samples", type=int, default=3)
    parser.add_argument("--seed-start", type=int)
    parser.add_argument("--target-f0", type=float)
    parser.add_argument("--text", default=DEFAULT_TEXT)
    parser.add_argument("--caption")
    parser.add_argument("--model")
    parser.add_argument("--caption-guidance", type=float)
    parser.add_argument("--duration-scale", type=float)
    parser.add_argument("--speaker-condition")
    parser.add_argument("--bridge-url")
    parser.add_argument("--timeout", type=float, default=900.0)
    parser.add_argument("--output", type=Path)
    return parser.parse_args()


def build_config(args: argparse.Namespace) -> dict[str, Any]:
    defaults = profile_defaults({})
    profile_sha256 = None
    profile_name = None
    if args.profile:
        profile, profile_sha256 = read_profile(args.profile)
        defaults.update(profile_defaults(profile))
        profile_name = args.profile.name
    if not 1 <= args.samples <= 10:
        raise ValueError("--samples must be between 1 and 10.")
    seed_start = args.seed_start if args.seed_start is not None else defaults["seed_start"]
    if not 0 <= seed_start <= 2147483647 - args.samples:
        raise ValueError("Seed range exceeds audio.cpp's supported integer range.")
    target_f0 = args.target_f0 if args.target_f0 is not None else defaults["target_f0_hz"]
    if not 60 <= target_f0 <= 500:
        raise ValueError("Target F0 must be between 60 and 500 Hz.")
    caption_guidance = (
        args.caption_guidance
        if args.caption_guidance is not None
        else defaults["caption_guidance_scale"]
    )
    duration_scale = (
        args.duration_scale if args.duration_scale is not None else defaults["duration_scale"]
    )
    if not 0.5 <= caption_guidance <= 10 or not 0.5 <= duration_scale <= 2:
        raise ValueError("Caption guidance or duration scale is outside the bridge limits.")
    return {
        "schema_version": "cvd_step_stability_experiment_0.1",
        "created_at": datetime.now().astimezone().isoformat(),
        "purpose": "locate early acoustic-proxy stabilization before considering shared-prefix branching",
        "measurement_kind": "independent_same_seed_predicted_audio",
        "step_schedule": list(STEPS),
        "sample_count": args.samples,
        "seed_start": seed_start,
        "target_f0_hz": target_f0,
        "text": args.text,
        "caption": args.caption if args.caption is not None else defaults.get("caption", DEFAULT_CAPTION),
        "model": args.model if args.model is not None else defaults["model"],
        "caption_guidance_scale": caption_guidance,
        "duration_scale": duration_scale,
        "speaker_condition": args.speaker_condition or None,
        "bridge_url": normalize_bridge_url(args.bridge_url or discover_bridge_url()),
        "postprocess_enabled": False,
        "profile_source_name": profile_name,
        "profile_source_sha256": profile_sha256,
    }


def main() -> int:
    args = parse_args()
    try:
        config = build_config(args)
        timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        output_dir = (
            args.output
            or PROJECT_ROOT / "benchmark_results" / f"{timestamp}-step-stability"
        )
        summary = run_benchmark(config, output_dir, max(1.0, args.timeout))
    except (OSError, RuntimeError, ValueError, zipfile.BadZipFile, json.JSONDecodeError) as error:
        print(f"Step stability benchmark failed: {error}", file=sys.stderr)
        return 1
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    print(f"Results: {output_dir.resolve()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

#!/usr/bin/env python3
"""Two-stage seed/F0 benchmark for the local CharacterVoiceDesigner TTS bridge."""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import math
import statistics
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import zipfile
from datetime import datetime
from pathlib import Path
from typing import Any

from audio_postprocess import AudioPostprocessError, analyze_wav_f0, world_available


PROJECT_ROOT = Path(__file__).resolve().parent
DEFAULT_TEXT = "これは音声設計の評価用サンプルです。"
DEFAULT_CAPTION = "自然で明瞭な日本語音声。"


def finite(value: Any, fallback: float) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return fallback
    return number if math.isfinite(number) else fallback


def semitone_error(measured_hz: float, target_hz: float) -> float:
    if measured_hz <= 0 or target_hz <= 0:
        return math.inf
    return abs(12.0 * math.log2(measured_hz / target_hz))


def pearson_correlation(left: list[float], right: list[float]) -> float | None:
    if len(left) != len(right) or len(left) < 2:
        return None
    left_mean = statistics.fmean(left)
    right_mean = statistics.fmean(right)
    numerator = sum((x - left_mean) * (y - right_mean) for x, y in zip(left, right))
    left_scale = math.sqrt(sum((x - left_mean) ** 2 for x in left))
    right_scale = math.sqrt(sum((y - right_mean) ** 2 for y in right))
    denominator = left_scale * right_scale
    return numerator / denominator if denominator > 0 else None


def average_ranks(values: list[float]) -> list[float]:
    indexed = sorted(enumerate(values), key=lambda item: item[1])
    ranks = [0.0] * len(values)
    cursor = 0
    while cursor < len(indexed):
        end = cursor + 1
        while end < len(indexed) and indexed[end][1] == indexed[cursor][1]:
            end += 1
        average_rank = ((cursor + 1) + end) / 2.0
        for position in range(cursor, end):
            ranks[indexed[position][0]] = average_rank
        cursor = end
    return ranks


def summarize_trials(trials: list[dict[str, Any]], target_f0_hz: float) -> dict[str, Any]:
    complete = [row for row in trials if row.get("low") and row.get("final")]
    if not complete:
        raise ValueError("No complete low/final trial pairs were produced.")
    low_f0 = [float(row["low"]["median_f0_hz"]) for row in complete]
    final_f0 = [float(row["final"]["median_f0_hz"]) for row in complete]
    low_selected = min(complete, key=lambda row: semitone_error(row["low"]["median_f0_hz"], target_f0_hz))
    oracle_selected = min(complete, key=lambda row: semitone_error(row["final"]["median_f0_hz"], target_f0_hz))
    low_selected_final_error = semitone_error(low_selected["final"]["median_f0_hz"], target_f0_hz)
    oracle_final_error = semitone_error(oracle_selected["final"]["median_f0_hz"], target_f0_hz)
    return {
        "schema_version": "seed_f0_benchmark_summary_0.1",
        "complete_pairs": len(complete),
        "pearson_low_to_final_f0": rounded_or_none(pearson_correlation(low_f0, final_f0)),
        "spearman_low_to_final_f0": rounded_or_none(
            pearson_correlation(average_ranks(low_f0), average_ranks(final_f0))
        ),
        "mean_absolute_low_to_final_semitones": round(
            statistics.fmean(semitone_error(low, final) for low, final in zip(low_f0, final_f0)), 6
        ),
        "selected_by_low_steps": selection_record(low_selected, target_f0_hz),
        "oracle_selected_by_final_steps": selection_record(oracle_selected, target_f0_hz),
        "selection_regret_semitones": round(max(0.0, low_selected_final_error - oracle_final_error), 6),
    }


def rounded_or_none(value: float | None) -> float | None:
    return None if value is None else round(value, 6)


def selection_record(row: dict[str, Any], target_f0_hz: float) -> dict[str, Any]:
    return {
        "seed": row["seed"],
        "low_f0_hz": row["low"]["median_f0_hz"],
        "final_f0_hz": row["final"]["median_f0_hz"],
        "low_target_error_semitones": round(
            semitone_error(row["low"]["median_f0_hz"], target_f0_hz), 6
        ),
        "final_target_error_semitones": round(
            semitone_error(row["final"]["median_f0_hz"], target_f0_hz), 6
        ),
    }


def read_profile(path: Path) -> tuple[dict[str, Any], str]:
    raw = path.read_bytes()
    digest = hashlib.sha256(raw).hexdigest()
    if path.suffix.lower() == ".zip":
        with zipfile.ZipFile(path) as archive:
            try:
                profile_bytes = archive.read("profile.json")
            except KeyError as error:
                raise ValueError("Project ZIP does not contain profile.json.") from error
        return json.loads(profile_bytes.decode("utf-8")), digest
    return json.loads(raw.decode("utf-8")), digest


def profile_defaults(profile: dict[str, Any]) -> dict[str, Any]:
    voice_profile = profile.get("voice_control_profile", profile)
    anchor = voice_profile.get("identity_anchor", {})
    adapter = voice_profile.get("tts_adapters", {}).get("audio_cpp", {})
    tts = profile.get("tts_configuration", {})
    caption = tts.get("caption_override") or adapter.get("caption_ja") or DEFAULT_CAPTION
    speaking_rate = min(1.4, max(0.6, finite(anchor.get("speaking_rate"), 1.0)))
    return {
        "target_f0_hz": finite(anchor.get("f0_mean_hz"), 180.0),
        "caption": str(caption),
        "model": str(tts.get("selected_model") or "irodori-vdes"),
        "seed_start": int(finite(tts.get("seed"), 20260719)),
        "caption_guidance_scale": finite(tts.get("caption_guidance_scale"), 2.0),
        "duration_scale": round(1.0 / speaking_rate, 4),
    }


def discover_bridge_url() -> str:
    state_path = PROJECT_ROOT / "runtime" / "webui.state.json"
    try:
        state = json.loads(state_path.read_text(encoding="utf-8-sig"))
        port = int(state["designer_port"])
        if 1 <= port <= 65535:
            return f"http://127.0.0.1:{port}"
    except (OSError, ValueError, KeyError, json.JSONDecodeError):
        pass
    return "http://127.0.0.1:8765"


def normalize_bridge_url(value: str) -> str:
    parsed = urllib.parse.urlsplit(value)
    if parsed.scheme != "http" or parsed.hostname not in {"127.0.0.1", "localhost", "::1"}:
        raise ValueError("Bridge URL must be an explicit loopback HTTP origin.")
    if parsed.path not in ("", "/") or parsed.query or parsed.fragment or parsed.username or parsed.password:
        raise ValueError("Bridge URL must not contain a path, credentials, query, or fragment.")
    return value.rstrip("/")


def generate_wav(bridge_url: str, request_payload: dict[str, Any], timeout_seconds: float) -> bytes:
    body = json.dumps(request_payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    request = urllib.request.Request(
        bridge_url + "/api/audio-cpp/speech",
        data=body,
        headers={"Content-Type": "application/json", "Accept": "audio/wav"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout_seconds) as response:
            wav_bytes = response.read()
            if response.headers.get_content_type() != "audio/wav" or not wav_bytes.startswith(b"RIFF"):
                raise RuntimeError("The local bridge returned a non-WAV response.")
            return wav_bytes
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", "replace")
        raise RuntimeError(f"TTS request failed with HTTP {error.code}: {detail}") from error
    except urllib.error.URLError as error:
        raise RuntimeError(f"The local TTS bridge is unavailable at {bridge_url}: {error.reason}") from error


def request_payload(config: dict[str, Any], seed: int, steps: int) -> dict[str, Any]:
    return {
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


def run_benchmark(config: dict[str, Any], output_dir: Path, timeout_seconds: float) -> dict[str, Any]:
    output_dir.mkdir(parents=True, exist_ok=False)
    audio_dir = output_dir / "audio"
    audio_dir.mkdir()
    trials = [{"seed": config["seed_start"] + index} for index in range(config["sample_count"])]
    started = time.perf_counter()
    for phase, steps in (("low", config["low_steps"]), ("final", config["final_steps"])):
        for index, row in enumerate(trials, start=1):
            seed = row["seed"]
            print(f"[{phase} {index}/{len(trials)}] seed={seed}, steps={steps}", flush=True)
            phase_started = time.perf_counter()
            wav_bytes = generate_wav(
                config["bridge_url"], request_payload(config, seed, steps), timeout_seconds
            )
            wav_path = audio_dir / f"seed-{seed}-{phase}-{steps}steps.wav"
            wav_path.write_bytes(wav_bytes)
            metrics = analyze_wav_f0(wav_bytes, maximum_seconds=config["analysis_seconds"])
            metrics["generation_seconds"] = round(time.perf_counter() - phase_started, 6)
            metrics["target_error_semitones"] = round(
                semitone_error(metrics["median_f0_hz"], config["target_f0_hz"]), 6
            )
            metrics["wav_path"] = wav_path.relative_to(output_dir).as_posix()
            row[phase] = metrics
            write_json(output_dir / "trials.partial.json", trials)
    summary = summarize_trials(trials, config["target_f0_hz"])
    summary["total_elapsed_seconds"] = round(time.perf_counter() - started, 6)
    write_json(output_dir / "experiment.json", config)
    write_json(output_dir / "trials.json", trials)
    write_json(output_dir / "summary.json", summary)
    write_csv(output_dir / "trials.csv", trials)
    (output_dir / "trials.partial.json").unlink(missing_ok=True)
    return summary


def write_json(path: Path, value: Any) -> None:
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def write_csv(path: Path, trials: list[dict[str, Any]]) -> None:
    fields = [
        "seed",
        "low_median_f0_hz",
        "final_median_f0_hz",
        "low_target_error_semitones",
        "final_target_error_semitones",
        "low_voiced_frame_ratio",
        "final_voiced_frame_ratio",
        "low_source_duration_seconds",
        "final_source_duration_seconds",
        "low_generation_seconds",
        "final_generation_seconds",
        "low_wav_path",
        "final_wav_path",
    ]
    with path.open("w", encoding="utf-8-sig", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=fields)
        writer.writeheader()
        for row in trials:
            writer.writerow(
                {
                    "seed": row["seed"],
                    **{
                        f"{phase}_{field}": row[phase][field]
                        for phase in ("low", "final")
                        for field in (
                            "median_f0_hz",
                            "target_error_semitones",
                            "voiced_frame_ratio",
                            "source_duration_seconds",
                            "generation_seconds",
                            "wav_path",
                        )
                    },
                }
            )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Compare low-step and final-step F0 across deterministic TTS seeds."
    )
    parser.add_argument("--profile", type=Path, help="Exported profile JSON, voice-control JSON, or project ZIP.")
    parser.add_argument("--samples", type=int, default=10)
    parser.add_argument("--seed-start", type=int)
    parser.add_argument("--low-steps", type=int, default=4)
    parser.add_argument("--final-steps", type=int, default=40)
    parser.add_argument("--analysis-seconds", type=float, default=3.0)
    parser.add_argument("--target-f0", type=float)
    parser.add_argument("--text", default=DEFAULT_TEXT)
    parser.add_argument("--caption")
    parser.add_argument("--model")
    parser.add_argument("--caption-guidance", type=float)
    parser.add_argument("--duration-scale", type=float)
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
    sample_count = args.samples
    low_steps = args.low_steps
    final_steps = args.final_steps
    if not 2 <= sample_count <= 100:
        raise ValueError("--samples must be between 2 and 100.")
    if not 4 <= low_steps <= 100 or not 4 <= final_steps <= 100 or low_steps >= final_steps:
        raise ValueError("Step counts must satisfy 4 <= low-steps < final-steps <= 100.")
    target_f0_hz = args.target_f0 if args.target_f0 is not None else defaults["target_f0_hz"]
    if not 60 <= target_f0_hz <= 500:
        raise ValueError("Target F0 must be between 60 and 500 Hz.")
    seed_start = args.seed_start if args.seed_start is not None else defaults["seed_start"]
    if not 0 <= seed_start <= 2147483647 - sample_count:
        raise ValueError("Seed range exceeds audio.cpp's supported integer range.")
    caption_guidance = args.caption_guidance if args.caption_guidance is not None else defaults["caption_guidance_scale"]
    duration_scale = args.duration_scale if args.duration_scale is not None else defaults["duration_scale"]
    if not 0.5 <= caption_guidance <= 10 or not 0.5 <= duration_scale <= 2:
        raise ValueError("Caption guidance or duration scale is outside the bridge limits.")
    if not 0.2 <= args.analysis_seconds <= 60:
        raise ValueError("--analysis-seconds must be between 0.2 and 60.")
    return {
        "schema_version": "seed_f0_benchmark_experiment_0.1",
        "created_at": datetime.now().astimezone().isoformat(),
        "purpose": "test whether low-step seed F0 predicts final-step seed F0 without waveform correction",
        "sample_count": sample_count,
        "seed_start": seed_start,
        "low_steps": low_steps,
        "final_steps": final_steps,
        "analysis_seconds": args.analysis_seconds,
        "target_f0_hz": target_f0_hz,
        "text": args.text,
        "caption": args.caption if args.caption is not None else defaults["caption"],
        "model": args.model if args.model is not None else defaults["model"],
        "caption_guidance_scale": caption_guidance,
        "duration_scale": duration_scale,
        "bridge_url": normalize_bridge_url(args.bridge_url or discover_bridge_url()),
        "postprocess_enabled": False,
        "profile_source_name": profile_name,
        "profile_source_sha256": profile_sha256,
    }


def main() -> int:
    args = parse_args()
    try:
        if not world_available():
            raise RuntimeError("WORLD analysis is unavailable. Start or repair the WebUI runtime first.")
        config = build_config(args)
        timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        output_dir = args.output or PROJECT_ROOT / "benchmark_results" / f"{timestamp}-seed-f0"
        summary = run_benchmark(config, output_dir, max(1.0, args.timeout))
    except (AudioPostprocessError, OSError, RuntimeError, ValueError, zipfile.BadZipFile, json.JSONDecodeError) as error:
        print(f"Benchmark failed: {error}", file=sys.stderr)
        return 1
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    print(f"Results: {output_dir.resolve()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

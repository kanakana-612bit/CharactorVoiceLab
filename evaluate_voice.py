#!/usr/bin/env python3
"""Evaluate CharacterVoiceDesigner WAV outputs and write reproducible reports."""

from __future__ import annotations

import argparse
import json
import re
import statistics
from datetime import datetime
from pathlib import Path
from typing import Any, Iterable, Mapping

from voice_evaluator import (
    EVALUATION_SCHEMA_VERSION,
    EvaluationError,
    SpeechBrainEcapaBackend,
    analyze_wav_path,
    cosine_similarity,
    robust_proxy_distances,
    strip_private_values,
    write_feature_csv,
    write_json,
)


PROJECT_ROOT = Path(__file__).resolve().parent
DEFAULT_OUTPUT_ROOT = PROJECT_ROOT / "evaluation_results"
OBSERVATION_ROOT = PROJECT_ROOT / "runtime" / "observations"
OBSERVATION_ID_PATTERN = re.compile(r"^[0-9]{8}T[0-9]{6}\.[0-9]{6}Z-[a-f0-9]{12}$")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Evaluate local generated WAV files. Built-in acoustic metrics are "
            "comparison proxies, not speaker-identification or clinical measurements."
        )
    )
    parser.add_argument(
        "--input",
        action="append",
        required=True,
        help="WAV file or directory. May be repeated.",
    )
    parser.add_argument(
        "--reference",
        action="append",
        default=[],
        help="Optional reference WAV file or directory. May be repeated.",
    )
    parser.add_argument("--manifest", help="Optional JSON manifest with text and observation IDs.")
    parser.add_argument("--target-f0", type=float, help="Optional design target F0 in Hz.")
    parser.add_argument("--output", help="Output directory.")
    parser.add_argument(
        "--speaker-backend",
        choices=("none", "speechbrain-ecapa"),
        default="none",
        help="Independent speaker embedding backend. Default: none.",
    )
    parser.add_argument(
        "--speaker-model",
        help="Local SpeechBrain ECAPA model directory, or remote ID with explicit download approval.",
    )
    parser.add_argument(
        "--allow-model-download",
        action="store_true",
        help="Explicitly permit the optional backend to download its model.",
    )
    return parser.parse_args()


def collect_wavs(values: Iterable[str]) -> list[Path]:
    result: list[Path] = []
    for value in values:
        path = Path(value).expanduser().resolve()
        if path.is_file() and path.suffix.lower() == ".wav":
            result.append(path)
        elif path.is_dir():
            result.extend(sorted(path.rglob("*.wav")))
        else:
            raise EvaluationError(f"Input is not a WAV file or directory: {path}")
    unique: list[Path] = []
    seen: set[Path] = set()
    for path in result:
        if path not in seen:
            unique.append(path)
            seen.add(path)
    if not unique:
        raise EvaluationError("No WAV files were found.")
    return unique


def load_manifest(path: str | None) -> dict[str, Mapping[str, Any]]:
    if path is None:
        return {}
    manifest_path = Path(path).expanduser().resolve()
    raw = json.loads(manifest_path.read_text(encoding="utf-8-sig"))
    items = raw.get("items", raw) if isinstance(raw, dict) else raw
    if not isinstance(items, list):
        raise EvaluationError("Manifest must be a list or contain an items list.")
    result: dict[str, Mapping[str, Any]] = {}
    for item in items:
        if not isinstance(item, dict):
            continue
        file_name = item.get("file") or item.get("filename")
        if isinstance(file_name, str):
            result[Path(file_name).name] = item
    return result


def load_observation(observation_id: Any) -> dict[str, Any] | None:
    if not isinstance(observation_id, str) or not OBSERVATION_ID_PATTERN.fullmatch(observation_id):
        return None
    path = OBSERVATION_ROOT / f"{observation_id}.json"
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    if not isinstance(value, dict):
        return None
    return {
        "observation_id": observation_id,
        "status": value.get("status"),
        "created_at": value.get("created_at"),
        "request": value.get("request"),
        "model": value.get("model"),
        "timing": value.get("timing"),
        "response_audio_sha256": value.get("response", {}).get("audio", {}).get("sha256"),
    }


def build_backend(args: argparse.Namespace) -> Any:
    if args.speaker_backend == "none":
        return None
    if not args.speaker_model:
        raise EvaluationError("--speaker-model is required for speechbrain-ecapa.")
    return SpeechBrainEcapaBackend(
        args.speaker_model,
        allow_download=args.allow_model_download,
    )


def evaluate_paths(
    paths: list[Path],
    manifest: Mapping[str, Mapping[str, Any]],
    *,
    target_f0: float | None,
    backend: Any,
) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    for path in paths:
        item = manifest.get(path.name, {})
        text = item.get("text") if isinstance(item.get("text"), str) else None
        item_target = item.get("target_f0_hz", target_f0)
        if not isinstance(item_target, (int, float)):
            item_target = target_f0
        record = analyze_wav_path(
            path,
            text=text,
            target_f0_hz=float(item_target) if item_target is not None else None,
            speaker_backend=backend,
        )
        record["file"]["path"] = str(path)
        if item:
            record["manifest"] = {
                key: value
                for key, value in item.items()
                if key not in {"text"} and not str(key).startswith("_")
            }
            observation = load_observation(item.get("observation_id"))
            if observation is not None:
                record["generation_observation"] = observation
        records.append(record)
    return records


def attach_reference_comparisons(
    candidates: list[dict[str, Any]],
    references: list[dict[str, Any]],
) -> None:
    if not references:
        return
    all_records = candidates + references
    proxy_matrices = {
        "combined": robust_proxy_distances(all_records),
        "source_and_prosody": robust_proxy_distances(all_records, ("source_and_prosody",)),
        "acoustic_timbre_proxy": robust_proxy_distances(
            all_records, ("acoustic_timbre_proxy",)
        ),
        "delivery_style": robust_proxy_distances(all_records, ("delivery_style",)),
    }
    candidate_count = len(candidates)
    for index, record in enumerate(candidates):
        distance_groups = {
            name: matrix[index][candidate_count:]
            for name, matrix in proxy_matrices.items()
        }
        distances = distance_groups["combined"]
        finite = [value for value in distances if value is not None]
        comparison: dict[str, Any] = {
            "distance_context_samples": len(all_records),
            "distance_available": bool(finite),
            "distance_unavailable_reason": (
                None
                if finite
                else "At least three candidate/reference records are required for robust standardization."
            ),
            "combined_proxy_distance_to_each_reference": distances,
            "source_and_prosody_distance_to_each_reference": distance_groups[
                "source_and_prosody"
            ],
            "acoustic_timbre_proxy_distance_to_each_reference": distance_groups[
                "acoustic_timbre_proxy"
            ],
            "delivery_style_distance_to_each_reference": distance_groups["delivery_style"],
            "minimum_combined_proxy_distance": min(finite) if finite else None,
            "median_combined_proxy_distance": statistics.median(finite) if finite else None,
            "speaker_embedding_cosine_to_each_reference": None,
        }
        candidate_embedding = record.get("independent_speaker_embedding", {}).get("_embedding")
        reference_embeddings = [
            item.get("independent_speaker_embedding", {}).get("_embedding")
            for item in references
        ]
        if candidate_embedding is not None and all(value is not None for value in reference_embeddings):
            comparison["speaker_embedding_cosine_to_each_reference"] = [
                cosine_similarity(candidate_embedding, value) for value in reference_embeddings
            ]
        record["reference_comparison"] = comparison


def report_markdown(result: Mapping[str, Any]) -> str:
    candidates = result["candidates"]
    references = result["references"]
    lines = [
        "# CharacterVoiceDesigner Evaluation Report",
        "",
        f"- Schema: `{result['schema_version']}`",
        f"- Generated: `{result['generated_at']}`",
        f"- Candidate files: {len(candidates)}",
        f"- Reference files: {len(references)}",
        f"- Independent speaker backend: `{result['configuration']['speaker_backend']}`",
        "",
        "Built-in distances describe acoustic and delivery proxies within this evaluation set. "
        "They are not proof of speaker identity and are not clinical measurements.",
        "",
        "## Candidate Summary",
        "",
        "| File | Duration (s) | F0 median (Hz) | Target error (st) | RMS | Clip ratio | Proxy distance | Warnings |",
        "| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |",
    ]
    for record in candidates:
        quality = record.get("waveform_quality", {})
        f0 = record.get("source_and_prosody", {})
        comparison = record.get("reference_comparison", {})
        warnings = ", ".join(quality.get("warnings", [])) or "-"
        values = (
            record.get("file", {}).get("name", ""),
            quality.get("duration_seconds"),
            f0.get("median_hz"),
            f0.get("target_error_semitones"),
            quality.get("rms"),
            quality.get("clipping_ratio"),
            comparison.get("minimum_combined_proxy_distance"),
            warnings,
        )
        lines.append("| " + " | ".join("-" if value is None else str(value) for value in values) + " |")
    lines.extend(
        [
            "",
            "## Interpretation Limits",
            "",
            "- Acoustic proxy distance is standardized against this run and is not comparable across unrelated reports.",
            "- MFCC-like values are compact spectral descriptors; they are not a trained speaker representation.",
            "- Breathiness, health, age, or disease must not be inferred from these engineering metrics.",
            "- External speaker embeddings are reported separately and remain model- and corpus-dependent.",
            "",
        ]
    )
    return "\n".join(lines)


def main() -> int:
    args = parse_args()
    try:
        candidates = collect_wavs(args.input)
        references = collect_wavs(args.reference) if args.reference else []
        manifest = load_manifest(args.manifest)
        backend = build_backend(args)
        candidate_records = evaluate_paths(
            candidates,
            manifest,
            target_f0=args.target_f0,
            backend=backend,
        )
        reference_records = evaluate_paths(
            references,
            manifest,
            target_f0=args.target_f0,
            backend=backend,
        )
        attach_reference_comparisons(candidate_records, reference_records)
        output = (
            Path(args.output).expanduser().resolve()
            if args.output
            else DEFAULT_OUTPUT_ROOT / datetime.now().strftime("%Y%m%d-%H%M%S")
        )
        output.mkdir(parents=True, exist_ok=False)
        result = {
            "schema_version": EVALUATION_SCHEMA_VERSION,
            "generated_at": datetime.now().astimezone().isoformat(),
            "configuration": {
                "analysis_local_only": True,
                "target_f0_hz": args.target_f0,
                "speaker_backend": args.speaker_backend,
                "speaker_model": args.speaker_model,
                "model_download_explicitly_allowed": args.allow_model_download,
            },
            "candidates": candidate_records,
            "references": reference_records,
        }
        write_json(result, output / "evaluation.json")
        write_feature_csv(candidate_records, output / "features.csv")
        (output / "EVALUATION_REPORT.md").write_text(
            report_markdown(strip_private_values(result)),
            encoding="utf-8",
        )
        print(f"Evaluation complete: {output}")
        return 0
    except (EvaluationError, OSError, ValueError, json.JSONDecodeError) as error:
        print(f"Evaluation failed: {error}")
        return 2


if __name__ == "__main__":
    raise SystemExit(main())

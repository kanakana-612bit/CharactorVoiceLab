#!/usr/bin/env python3
"""Generate a local Speaker Inversion compatibility report."""

from __future__ import annotations

import argparse
import json
from datetime import datetime
from pathlib import Path
from typing import Any

from speaker_condition_reference import (
    DEFAULT_INIT_STD,
    DEFAULT_TOKENS,
    SPEAKER_INVERSION_SUFFIX,
    SpeakerConditionError,
    build_compatibility_report,
    create_format_fixture,
    inspect_audio_cpp,
    inspect_embedding,
    inspect_model,
    reference_training_config,
)


PROJECT_ROOT = Path(__file__).resolve().parent
DEFAULT_MODEL_ROOT = (
    PROJECT_ROOT
    / "runtime"
    / "audio.cpp"
    / "models"
    / "Irodori-TTS-600M-v3-VoiceDesign"
)


def _default_output() -> Path:
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    return PROJECT_ROOT / "speaker_condition_results" / stamp


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=(
            "Validate Irodori Speaker Inversion artifacts without exposing raw "
            "speaker tensors or claiming semantic voice compatibility."
        )
    )
    parser.add_argument("--model-root", type=Path, default=DEFAULT_MODEL_ROOT)
    parser.add_argument("--embedding", type=Path, action="append", default=[])
    parser.add_argument("--output", type=Path, default=None)
    parser.add_argument("--hash-model", action="store_true")
    parser.add_argument("--create-format-fixture", action="store_true")
    parser.add_argument("--tokens", type=int, default=DEFAULT_TOKENS)
    parser.add_argument("--seed", type=int, default=0)
    parser.add_argument("--init-std", type=float, default=DEFAULT_INIT_STD)
    return parser


def _yaml_write(path: Path, value: dict[str, Any]) -> None:
    try:
        import yaml
    except ImportError as error:
        raise SpeakerConditionError("PyYAML is required to write the reference config.") from error
    path.write_text(
        yaml.safe_dump(value, allow_unicode=True, sort_keys=False),
        encoding="utf-8",
    )


def _markdown(report: dict[str, Any]) -> str:
    compatibility = report["compatibility"]
    model = report["model"]
    runtime = report["audio_cpp"]
    lines = [
        "# Speaker Inversion Compatibility Report",
        "",
        "This report separates storage-format compatibility from executable and semantic compatibility.",
        "",
        "## Verdict",
        "",
        f"- End-to-end status: `{compatibility['end_to_end_status']}`",
        f"- Model speaker branch: `{compatibility['model_speaker_branch']}`",
        f"- Speaker dimension: `{compatibility['speaker_dimension']}`",
        f"- Upstream file contract: `{compatibility['upstream_file_contract']}`",
        f"- Target model/artifact contract: `{compatibility['target_model_artifact_contract']}`",
        f"- Upstream Python direct-state path: `{compatibility['upstream_python_direct_state_path']}`",
        f"- audio.cpp direct-state path: `{compatibility['audio_cpp_direct_state_path']}`",
        f"- Semantic compatibility proven: `{compatibility['semantic_compatibility_proven']}`",
        "",
        "A valid tensor shape is not evidence that the artifact represents the intended voice. "
        "Semantic compatibility requires optimization against the exact target checkpoint and "
        "evaluation on held-out text.",
        "",
        "## Model",
        "",
        f"- Name: `{model.get('name')}`",
        f"- Config SHA-256: `{model.get('config_sha256')}`",
        f"- Checkpoint bytes: `{model.get('checkpoint', {}).get('bytes')}`",
        f"- Checkpoint SHA-256 computed: `{model.get('checkpoint', {}).get('sha256_computed')}`",
        "",
        "## audio.cpp",
        "",
        f"- Source available: `{runtime.get('source_available')}`",
        f"- Source commit: `{runtime.get('source_git_commit')}`",
        f"- Reference-audio input: `{runtime.get('reference_audio_input')}`",
        f"- Direct embedding input: `{runtime.get('direct_embedding_input')}`",
        f"- Speaker-state hash observation: `{runtime.get('speaker_state_observation')}`",
        "",
        "## Embeddings",
        "",
    ]
    embeddings = report.get("embeddings", [])
    if not embeddings:
        lines.append("- No embedding artifact was supplied.")
    for item in embeddings:
        lines.extend(
            [
                f"### `{item.get('name')}`",
                "",
                f"- Shape: `{item.get('shape')}`",
                f"- Dtype: `{item.get('dtype')}`",
                f"- File contract compatible: `{item.get('upstream_file_contract_compatible')}`",
                f"- Target model compatible: `{item.get('target_model_contract_compatible')}`",
                f"- Provenance compatible: `{item.get('provenance_contract_compatible')}`",
                f"- Model binding: `{item.get('model_binding_status')}`",
                f"- Errors: `{item.get('errors')}`",
                f"- Warnings: `{item.get('warnings')}`",
                "",
            ]
        )
    lines.extend(
        [
            "## Scope",
            "",
            "- No appearance-to-embedding mapping is implemented.",
            "- The format fixture contains no audio, text, personal identifier, or learned voice.",
            "- Raw embedding values are not included in this report.",
            "- Current audio.cpp integration remains disabled until a direct speaker-state input is implemented and tested.",
            "",
        ]
    )
    return "\n".join(lines)


def run(args: argparse.Namespace) -> Path:
    output = (args.output or _default_output()).expanduser().resolve()
    if output.exists():
        raise SpeakerConditionError(f"Output directory already exists: {output}")
    output.mkdir(parents=True)

    model = inspect_model(args.model_root, hash_weights=args.hash_model)
    embedding_paths = [path.expanduser().resolve() for path in args.embedding]
    if args.create_format_fixture:
        fixture_path = output / f"format-fixture{SPEAKER_INVERSION_SUFFIX}"
        create_format_fixture(
            fixture_path,
            model=model,
            tokens=args.tokens,
            seed=args.seed,
            init_std=args.init_std,
        )
        embedding_paths.append(fixture_path)
    embeddings = [inspect_embedding(path, model=model) for path in embedding_paths]
    runtime = inspect_audio_cpp(PROJECT_ROOT)
    report = build_compatibility_report(
        model=model,
        runtime=runtime,
        embeddings=embeddings,
    )

    (output / "compatibility.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2, allow_nan=False) + "\n",
        encoding="utf-8",
    )
    (output / "SPEAKER_INVERSION_COMPATIBILITY_REPORT.md").write_text(
        _markdown(report),
        encoding="utf-8",
    )
    model_config = json.loads(
        (args.model_root.expanduser().resolve() / "model_config.json").read_text(
            encoding="utf-8-sig"
        )
    )
    _yaml_write(
        output / "speaker_inversion_voice_design.reference.yaml",
        reference_training_config(model_config, tokens=args.tokens),
    )
    return output


def main() -> int:
    args = _parser().parse_args()
    try:
        output = run(args)
    except SpeakerConditionError as error:
        print(f"Speaker Inversion verification failed: {error}")
        return 2
    report = json.loads((output / "compatibility.json").read_text(encoding="utf-8"))
    print(f"Report: {output}")
    print(f"Status: {report['compatibility']['end_to_end_status']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

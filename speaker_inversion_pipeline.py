#!/usr/bin/env python3
"""Run the pinned upstream Irodori-TTS Speaker Inversion workflow."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


UPSTREAM_REPOSITORY = "https://github.com/Aratako/Irodori-TTS.git"
UPSTREAM_COMMIT = "d48dd92b943fa5dbcb88150eb974c25d8709df9b"
MODEL_REPOSITORY = "Aratako/Irodori-TTS-v4-Small"
MODEL_FILENAME = "model.safetensors"
CONFIG_NAME = "train_v4_small_speaker_inversion.yaml"
SAFE_NAME_PATTERN = re.compile(r"[^A-Za-z0-9_.-]+")


class PipelineError(RuntimeError):
    """Raised when the managed upstream workflow is incomplete or fails."""


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _safe_name(value: str, fallback: str = "speaker") -> str:
    cleaned = SAFE_NAME_PATTERN.sub("-", str(value).strip()).strip(".-")
    return (cleaned or fallback)[:64]


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(8 * 1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _runtime_paths(project_root: Path) -> dict[str, Path]:
    root = project_root / "runtime" / "speaker_inversion"
    return {
        "root": root,
        "source": root / "Irodori-TTS",
        "model": root / "models" / "Irodori-TTS-v4-Small" / MODEL_FILENAME,
        "environment": root / "environment.json",
        "uv": project_root / "runtime" / "bootstrap" / "uv" / "uv",
        "embeddings": root / "embeddings",
        "cuda_probe": project_root / "speaker_inversion_cuda_probe.py",
    }


def _probe_cuda_runtime(paths: dict[str, Path]) -> dict[str, Any]:
    try:
        result = subprocess.run(
            [
                str(paths["uv"]),
                "run",
                "--no-sync",
                "python",
                str(paths["cuda_probe"]),
            ],
            cwd=str(paths["source"]),
            env={**os.environ, "PYTHONUNBUFFERED": "1"},
            check=False,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=30,
        )
    except (OSError, subprocess.SubprocessError) as error:
        raise PipelineError(f"CUDA runtime diagnostics could not run: {error}") from error
    try:
        diagnostics = json.loads(result.stdout)
    except json.JSONDecodeError as error:
        detail = (result.stderr or result.stdout).strip()
        raise PipelineError(f"CUDA runtime diagnostics returned invalid output: {detail}") from error
    if not isinstance(diagnostics, dict):
        raise PipelineError("CUDA runtime diagnostics returned an invalid result.")
    return diagnostics


def _cuda_failure_message(diagnostics: dict[str, Any]) -> str:
    kind = diagnostics.get("failure_kind")
    detail = str(diagnostics.get("message") or "CUDA runtime is not ready.")
    if kind == "cpu_torch":
        action = "Run 'Prepare/repair training environment' to reinstall the cu128 PyTorch wheel."
    elif kind == "gpu_unavailable":
        action = (
            "Confirm that nvidia-smi works for the WebUI user, CUDA_VISIBLE_DEVICES does not hide "
            "the GPU, then restart the WebUI and repair the training environment."
        )
    elif kind == "cuda_allocation":
        action = "Stop other GPU workloads if needed, restart the WebUI, and repair the environment."
    else:
        action = "Run 'Prepare/repair training environment' and review its CUDA diagnostics."
    return f"{detail} {action}"


def _load_environment(project_root: Path) -> tuple[dict[str, Path], dict[str, Any]]:
    paths = _runtime_paths(project_root)
    try:
        status = json.loads(paths["environment"].read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise PipelineError(
            "Speaker Inversion environment is not ready. Run environment setup first."
        ) from error
    required = (
        paths["uv"],
        paths["source"] / "train.py",
        paths["source"] / "prepare_manifest.py",
        paths["source"] / "infer.py",
        paths["source"] / "configs" / CONFIG_NAME,
        paths["model"],
        paths["cuda_probe"],
    )
    missing = [str(path) for path in required if not path.is_file()]
    if missing:
        raise PipelineError("Speaker Inversion environment is incomplete: " + ", ".join(missing))
    if status.get("upstream_commit") != UPSTREAM_COMMIT:
        raise PipelineError("Speaker Inversion upstream commit does not match this application build.")
    diagnostics = _probe_cuda_runtime(paths)
    if not diagnostics.get("ready"):
        raise PipelineError(_cuda_failure_message(diagnostics))
    status["cuda"] = diagnostics
    return paths, status


def _run(command: list[str], *, cwd: Path) -> None:
    print("[command] " + " ".join(command), flush=True)
    process = subprocess.Popen(
        command,
        cwd=str(cwd),
        env={**os.environ, "PYTHONUNBUFFERED": "1"},
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        encoding="utf-8",
        errors="replace",
        bufsize=1,
    )
    assert process.stdout is not None
    for line in process.stdout:
        print(line.rstrip(), flush=True)
    returncode = process.wait()
    if returncode:
        raise PipelineError(f"Upstream command exited with status {returncode}.")


def _load_samples(path: Path, project_root: Path) -> list[dict[str, str]]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise PipelineError("Training sample selection is invalid.") from error
    if not isinstance(value, list) or not value:
        raise PipelineError("At least one training sample is required.")
    dataset_root = (project_root / "runtime" / "speaker_inversion" / "dataset" / "audio").resolve()
    samples: list[dict[str, str]] = []
    for item in value:
        if not isinstance(item, dict):
            raise PipelineError("Training sample selection contains an invalid row.")
        audio = Path(str(item.get("audio", ""))).resolve()
        text = str(item.get("text", "")).strip()
        try:
            audio.relative_to(dataset_root)
        except ValueError as error:
            raise PipelineError("Training audio must be inside the managed local dataset.") from error
        if not audio.is_file() or audio.suffix.lower() != ".wav":
            raise PipelineError(f"Training WAV was not found: {audio.name}")
        if not text:
            raise PipelineError(f"A transcript is required for {audio.name}.")
        samples.append({"audio": str(audio), "text": text})
    return samples


def _write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(
        json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False) + "\n",
        encoding="utf-8",
    )
    temporary.replace(path)


def train(args: argparse.Namespace) -> None:
    project_root = args.project_root.resolve()
    paths, environment = _load_environment(project_root)
    output = args.output.resolve()
    output.mkdir(parents=True, exist_ok=True)
    samples = _load_samples(args.samples, project_root)
    source_jsonl = output / "source_dataset.jsonl"
    source_jsonl.write_text(
        "".join(json.dumps(item, ensure_ascii=False) + "\n" for item in samples),
        encoding="utf-8",
    )
    manifest = output / "train_manifest.jsonl"
    latents = output / "latents"
    upstream = paths["source"]
    uv = str(paths["uv"])

    print(f"[progress 0/3] Preparing {len(samples)} local training samples", flush=True)
    _run(
        [
            uv,
            "run",
            "--no-sync",
            "python",
            "prepare_manifest.py",
            "--dataset",
            "json",
            "--data-files",
            f"train={source_jsonl}",
            "--split",
            "train",
            "--audio-column",
            "audio",
            "--text-column",
            "text",
            "--output-manifest",
            str(manifest),
            "--latent-dir",
            str(latents),
            "--device",
            "cuda",
            "--log-every",
            "1",
        ],
        cwd=upstream,
    )

    training_output = output / "upstream_training"
    save_every = max(1, min(args.max_steps, args.save_every))
    print(f"[progress 1/3] Training {args.tokens} Speaker Inversion tokens", flush=True)
    _run(
        [
            uv,
            "run",
            "--no-sync",
            "python",
            "train.py",
            "--config",
            str(upstream / "configs" / CONFIG_NAME),
            "--manifest",
            str(manifest),
            "--init-checkpoint",
            str(paths["model"]),
            "--output-dir",
            str(training_output),
            "--device",
            "cuda",
            "--max-steps",
            str(args.max_steps),
            "--batch-size",
            str(args.batch_size),
            "--gradient-accumulation-steps",
            str(args.gradient_accumulation_steps),
            "--num-workers",
            str(args.num_workers),
            "--lr",
            str(args.learning_rate),
            "--speaker-inversion-tokens",
            str(args.tokens),
            "--save-every",
            str(save_every),
            "--log-every",
            str(max(1, min(20, args.max_steps))),
            "--seed",
            str(args.seed),
        ],
        cwd=upstream,
    )

    source_embedding = training_output / "checkpoint_final.speaker.safetensors"
    if not source_embedding.is_file():
        raise PipelineError("Upstream training did not produce checkpoint_final.speaker.safetensors.")
    voice_name = _safe_name(args.voice_name)
    managed_name = f"{voice_name}.speaker.safetensors"
    paths["embeddings"].mkdir(parents=True, exist_ok=True)
    managed_embedding = paths["embeddings"] / managed_name
    artifact_embedding = output / managed_name
    shutil.copy2(source_embedding, managed_embedding)
    shutil.copy2(source_embedding, artifact_embedding)
    model_sha = _sha256(paths["model"])
    embedding_sha = _sha256(managed_embedding)
    sidecar = {
        "schema_version": "cvd_official_speaker_inversion_0.1",
        "created_at": _now(),
        "embedding": {
            "file": managed_name,
            "sha256": embedding_sha,
            "tokens": args.tokens,
        },
        "model": {
            "repository": MODEL_REPOSITORY,
            "checkpoint_file": MODEL_FILENAME,
            "checkpoint_sha256": model_sha,
            "compatibility": "same_checkpoint_required",
        },
        "upstream": {
            "repository": UPSTREAM_REPOSITORY,
            "commit": UPSTREAM_COMMIT,
            "config": CONFIG_NAME,
        },
        "training": {
            "sample_count": len(samples),
            "max_steps": args.max_steps,
            "batch_size": args.batch_size,
            "gradient_accumulation_steps": args.gradient_accumulation_steps,
            "learning_rate": args.learning_rate,
            "seed": args.seed,
        },
        "privacy": {
            "local_processing_only": True,
            "embedding_contains_biometric_voice_representation": True,
            "sidecar_contains_audio": False,
            "sidecar_contains_transcript": False,
            "managed_training_audio_retained_locally": True,
        },
        "environment": environment,
    }
    managed_sidecar = managed_embedding.with_suffix(".json")
    artifact_sidecar = artifact_embedding.with_suffix(".json")
    _write_json(managed_sidecar, sidecar)
    _write_json(artifact_sidecar, sidecar)
    summary = {
        "schema_version": "cvd_speaker_inversion_training_result_0.1",
        "voice_name": voice_name,
        "embedding_id": managed_name,
        "embedding_sha256": embedding_sha,
        "sample_count": len(samples),
        "model_repository": MODEL_REPOSITORY,
        "upstream_commit": UPSTREAM_COMMIT,
    }
    _write_json(output / "summary.json", summary)
    print(f"[progress 3/3] Registered {managed_name}", flush=True)


def generate(args: argparse.Namespace) -> None:
    project_root = args.project_root.resolve()
    paths, _ = _load_environment(project_root)
    embedding_root = paths["embeddings"].resolve()
    embedding = (embedding_root / args.embedding).resolve()
    try:
        embedding.relative_to(embedding_root)
    except ValueError as error:
        raise PipelineError("Speaker Inversion embedding path is invalid.") from error
    if not embedding.is_file() or not embedding.name.endswith(".speaker.safetensors"):
        raise PipelineError("Managed Speaker Inversion embedding was not found.")
    output = args.output.resolve()
    output.mkdir(parents=True, exist_ok=True)
    wav = output / f"{_safe_name(embedding.name.removesuffix('.speaker.safetensors'))}-test.wav"
    command = [
        str(paths["uv"]),
        "run",
        "--no-sync",
        "python",
        "infer.py",
        "--checkpoint",
        str(paths["model"]),
        "--ref-embed",
        str(embedding),
        "--text",
        args.text,
        "--output-wav",
        str(wav),
        "--model-device",
        "cuda",
        "--codec-device",
        "cuda",
        "--model-precision",
        "bf16",
        "--codec-precision",
        "fp32",
        "--num-steps",
        str(args.steps),
        "--num-candidates",
        "1",
        "--seed",
        str(args.seed),
        "--cfg-scale-caption",
        str(args.caption_guidance),
        "--cfg-scale-speaker",
        str(args.speaker_guidance),
        "--duration-scale",
        str(args.duration_scale),
    ]
    if args.caption:
        command.extend(["--caption", args.caption])
    print("[progress 0/1] Generating with the learned speaker embedding", flush=True)
    _run(command, cwd=paths["source"])
    if not wav.is_file():
        raise PipelineError("Upstream inference did not produce a WAV file.")
    _write_json(
        output / "summary.json",
        {
            "schema_version": "cvd_speaker_inversion_generation_result_0.1",
            "embedding_id": embedding.name,
            "model_repository": MODEL_REPOSITORY,
            "steps": args.steps,
            "seed": args.seed,
            "output_wav": wav.name,
        },
    )
    print("[progress 1/1] Generation complete", flush=True)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="command", required=True)
    train_parser = subparsers.add_parser("train")
    train_parser.add_argument("--project-root", type=Path, required=True)
    train_parser.add_argument("--samples", type=Path, required=True)
    train_parser.add_argument("--output", type=Path, required=True)
    train_parser.add_argument("--voice-name", required=True)
    train_parser.add_argument("--tokens", type=int, default=16)
    train_parser.add_argument("--max-steps", type=int, default=3000)
    train_parser.add_argument("--batch-size", type=int, default=1)
    train_parser.add_argument("--gradient-accumulation-steps", type=int, default=1)
    train_parser.add_argument("--num-workers", type=int, default=2)
    train_parser.add_argument("--learning-rate", type=float, default=0.01)
    train_parser.add_argument("--save-every", type=int, default=250)
    train_parser.add_argument("--seed", type=int, default=0)
    train_parser.set_defaults(handler=train)
    generate_parser = subparsers.add_parser("generate")
    generate_parser.add_argument("--project-root", type=Path, required=True)
    generate_parser.add_argument("--output", type=Path, required=True)
    generate_parser.add_argument("--embedding", required=True)
    generate_parser.add_argument("--text", required=True)
    generate_parser.add_argument("--caption", default="")
    generate_parser.add_argument("--steps", type=int, default=20)
    generate_parser.add_argument("--seed", type=int, default=20260719)
    generate_parser.add_argument("--caption-guidance", type=float, default=2.0)
    generate_parser.add_argument("--speaker-guidance", type=float, default=5.0)
    generate_parser.add_argument("--duration-scale", type=float, default=1.0)
    generate_parser.set_defaults(handler=generate)
    return parser


def main() -> int:
    args = build_parser().parse_args()
    try:
        args.handler(args)
    except PipelineError as error:
        print(f"Speaker Inversion failed: {error}", file=sys.stderr, flush=True)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

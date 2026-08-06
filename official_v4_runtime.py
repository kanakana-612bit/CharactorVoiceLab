#!/usr/bin/env python3
"""Synchronous bridge from the WebUI request contract to official Irodori v4."""

from __future__ import annotations

import json
import shutil
import subprocess
import sys
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Any


class OfficialV4RuntimeError(RuntimeError):
    """Raised when the isolated official runtime cannot render a request."""


@dataclass(frozen=True)
class OfficialV4Result:
    wav_bytes: bytes
    headers: dict[str, str]
    log: str


def _gpu_index(device_id: str | None) -> int:
    value = str(device_id or "")
    if not value.startswith("cuda:"):
        raise OfficialV4RuntimeError(
            "Irodori v4-Small currently requires an NVIDIA GPU in this application."
        )
    try:
        return int(value.split(":", 1)[1])
    except ValueError as error:
        raise OfficialV4RuntimeError("The selected CUDA device is invalid.") from error


def render_official_v4(
    project_root: Path,
    request: dict[str, Any],
    runtime: dict[str, Any] | None,
    *,
    timeout_seconds: float,
    embedding: str | None = None,
) -> OfficialV4Result:
    project_root = Path(project_root).resolve()
    settings = runtime or {}
    gpu_index = _gpu_index(settings.get("device_id"))
    vram_limit_mib = int(settings.get("vram_limit_mib") or 0)
    options = request.get("options", {})
    runtime_root = project_root / "runtime" / "official_v4_requests"
    runtime_root.mkdir(parents=True, exist_ok=True)
    output = runtime_root / f"request-{uuid.uuid4().hex}"
    output.mkdir(parents=False, exist_ok=False)
    try:
        command = [
            sys.executable,
            str(project_root / "speaker_inversion_pipeline.py"),
            "render",
            "--project-root",
            str(project_root),
            "--output",
            str(output),
            "--text",
            str(request["input"]),
            "--caption",
            str(options.get("caption") or ""),
            "--steps",
            str(request["num_inference_steps"]),
            "--seed",
            str(request["seed"]),
            "--caption-guidance",
            str(options.get("caption_guidance_scale", 2)),
            "--speaker-guidance",
            str(options.get("speaker_guidance_scale", 5)),
            "--duration-scale",
            str(options.get("duration_scale", 1)),
            "--gpu-index",
            str(gpu_index),
            "--vram-limit-mib",
            str(vram_limit_mib),
        ]
        if embedding:
            command.extend(["--embedding", str(embedding)])
        try:
            completed = subprocess.run(
                command,
                cwd=str(project_root),
                check=False,
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                timeout=max(1.0, timeout_seconds),
            )
        except subprocess.TimeoutExpired as error:
            raise OfficialV4RuntimeError(
                f"Official v4 generation exceeded {timeout_seconds:g} seconds."
            ) from error
        except OSError as error:
            raise OfficialV4RuntimeError(f"Official v4 runtime could not start: {error}") from error
        log = "\n".join(part for part in (completed.stdout, completed.stderr) if part).strip()
        if completed.returncode:
            detail = log.splitlines()[-1] if log else f"exit status {completed.returncode}"
            raise OfficialV4RuntimeError(f"Official v4 generation failed: {detail}")
        summary_path = output / "summary.json"
        try:
            summary = json.loads(summary_path.read_text(encoding="utf-8"))
            wav_path = output / str(summary["output_wav"])
            wav_bytes = wav_path.read_bytes()
        except (OSError, KeyError, json.JSONDecodeError) as error:
            raise OfficialV4RuntimeError(
                "Official v4 generation completed without a valid WAV summary."
            ) from error
        if not wav_bytes.startswith(b"RIFF"):
            raise OfficialV4RuntimeError("Official v4 returned an invalid WAV file.")
        return OfficialV4Result(
            wav_bytes=wav_bytes,
            headers={
                "Content-Type": "audio/wav",
                "X-CVD-Backend-ID": "irodori-v4-small",
                "X-CVD-Backend-Runtime": "official_python",
                "X-CVD-Speaker-Condition-Mode": summary.get(
                    "speaker_condition_mode", "none"
                ),
                "X-CVD-Watermark-State": "not_declared_by_pinned_inference_cli",
            },
            log=log,
        )
    finally:
        shutil.rmtree(output, ignore_errors=True)

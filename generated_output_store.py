#!/usr/bin/env python3
"""Local WAV and reproducibility metadata archive for output-demo generations."""

from __future__ import annotations

import hashlib
import json
import re
import threading
import wave
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Mapping

from generation_observation import inspect_pcm_wav, load_model_metadata


OUTPUT_SCHEMA = "cvd_generated_output_0.1"
SEQUENCE_PATTERN = re.compile(r"^(?P<sequence>[0-9]+)-")
WINDOWS_RESERVED_NAMES = {
    "CON",
    "PRN",
    "AUX",
    "NUL",
    *(f"COM{index}" for index in range(1, 10)),
    *(f"LPT{index}" for index in range(1, 10)),
}


class GeneratedOutputError(RuntimeError):
    """Raised when a generated output cannot be archived or read."""


def _safe_segment(value: Any, fallback: str) -> str:
    text = "".join(
        "-" if character in '<>:"/\\|?*' or ord(character) < 32 else character
        for character in str(value or "").strip()
    )
    text = re.sub(r"\s+", "-", text)
    text = re.sub(r"-+", "-", text).strip(" .-")
    text = (text or fallback)[:64].rstrip(" .-")
    if text.upper() in WINDOWS_RESERVED_NAMES:
        text = f"voice-{text}"
    return text


def _header_value(headers: Mapping[str, str], name: str) -> str | None:
    value = headers.get(name)
    return str(value)[:256] if value is not None else None


class GeneratedOutputStore:
    def __init__(self, project_root: Path) -> None:
        self.project_root = Path(project_root).resolve()
        self.root = self.project_root / "Outputs"
        self.root.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()

    def archive(
        self,
        *,
        wav_bytes: bytes,
        request: Mapping[str, Any],
        capture: Mapping[str, Any],
        postprocess: Mapping[str, Any] | None,
        correction_metadata: Mapping[str, Any] | None,
        identity: Mapping[str, Any] | None,
        evaluation: Mapping[str, Any],
        speaker_condition: Mapping[str, Any] | None,
        observation_id: str | None,
        upstream_seconds: float,
        postprocess_seconds: float,
        upstream_headers: Mapping[str, str],
    ) -> dict[str, Any]:
        now_local = datetime.now().astimezone()
        date_name = now_local.strftime("%Y%m%d")
        identity_name = _safe_segment(
            identity.get("name") if identity else None,
            "uncompiled",
        )
        seed = int(request["seed"])

        with self._lock:
            date_root = self.root / date_name
            date_root.mkdir(parents=True, exist_ok=True)
            sequence = self._next_sequence(date_root)
            stem = f"{sequence:03d}-{identity_name}-{seed}"
            wav_path = date_root / f"{stem}.wav"
            metadata_path = date_root / f"{stem}.json"

            audio = {
                "file": wav_path.name,
                "bytes": len(wav_bytes),
                "sha256": hashlib.sha256(wav_bytes).hexdigest(),
            }
            try:
                audio.update(inspect_pcm_wav(wav_bytes))
            except (OSError, ValueError, EOFError, wave.Error) as error:
                audio["format_inspection_error"] = type(error).__name__

            options = request.get("options", {})
            identity_record = {
                "id": identity.get("id") if identity else None,
                "name": identity.get("name") if identity else None,
                "compiled": identity is not None,
                "manifest_sha256": (
                    hashlib.sha256(
                        json.dumps(
                            identity,
                            ensure_ascii=False,
                            sort_keys=True,
                            separators=(",", ":"),
                            allow_nan=False,
                        ).encode("utf-8")
                    ).hexdigest()
                    if identity
                    else None
                ),
                "speaker_condition": dict(speaker_condition) if speaker_condition else None,
            }
            metadata = {
                "schema_version": OUTPUT_SCHEMA,
                "output_id": f"{date_name}/{stem}",
                "created_at": datetime.now(timezone.utc).isoformat(),
                "created_at_local": now_local.isoformat(),
                "application": {
                    "name": "CharacterVoiceDesigner",
                    "version": capture.get("app_version"),
                },
                "profile": {
                    "name": capture.get("profile_name"),
                    "speaking_rate": capture.get("speaking_rate"),
                    "f0_target_hz": capture.get("f0_target_hz"),
                },
                "model": load_model_metadata(self.project_root, str(request["model"])),
                "generation": {
                    "model": request["model"],
                    "language": request["language"],
                    "seed": seed,
                    "num_inference_steps": request["num_inference_steps"],
                    "candidate_count": 1,
                    "generation_mode": capture.get("generation_mode", "standard_single"),
                    "cfg_scales": {
                        "caption": options.get("caption_guidance_scale"),
                    },
                    "voice_quality_text": options.get("caption", ""),
                    "spoken_text": request["input"],
                    "duration_scale": options.get("duration_scale"),
                    "trim_tail": options.get("trim_tail"),
                },
                "identity": identity_record,
                "postprocess": {
                    "enabled": bool(postprocess),
                    "f0": {
                        "requested": dict(postprocess) if postprocess else None,
                        "result": dict(correction_metadata) if correction_metadata else None,
                    },
                },
                "audio": audio,
                "lightweight_evaluation": dict(evaluation),
                "performance": {
                    "upstream_seconds": round(upstream_seconds, 6),
                    "postprocess_seconds": round(postprocess_seconds, 6),
                    "total_seconds": round(upstream_seconds + postprocess_seconds, 6),
                },
                "runtime_observation_id": observation_id,
                "upstream_observation": {
                    "predicted_duration_seconds": _header_value(
                        upstream_headers, "X-AudioCpp-Predicted-Duration-Seconds"
                    ),
                    "caption_condition_sha256": _header_value(
                        upstream_headers, "X-AudioCpp-Caption-Condition-SHA256"
                    ),
                    "initial_latent_sha256": _header_value(
                        upstream_headers, "X-AudioCpp-Initial-Latent-SHA256"
                    ),
                    "speaker_condition_mode": _header_value(
                        upstream_headers, "X-AudioCpp-Speaker-Condition-Mode"
                    ),
                },
                "privacy": {
                    "stored_on_user_pc_only": True,
                    "contains_full_spoken_text": True,
                    "contains_voice_quality_text": True,
                    "contains_biometric_voice_representation_reference": bool(speaker_condition),
                },
            }

            wav_temporary = wav_path.with_suffix(".wav.tmp")
            metadata_temporary = metadata_path.with_suffix(".json.tmp")
            try:
                wav_temporary.write_bytes(wav_bytes)
                metadata_temporary.write_text(
                    json.dumps(metadata, ensure_ascii=False, indent=2, allow_nan=False) + "\n",
                    encoding="utf-8",
                )
                wav_temporary.replace(wav_path)
                metadata_temporary.replace(metadata_path)
            finally:
                wav_temporary.unlink(missing_ok=True)
                metadata_temporary.unlink(missing_ok=True)

        return {
            "id": metadata["output_id"],
            "wav": wav_path,
            "metadata": metadata_path,
            "relative_wav": wav_path.relative_to(self.project_root).as_posix(),
            "relative_metadata": metadata_path.relative_to(self.project_root).as_posix(),
        }

    def read_metadata(self, date_name: str, stem: str) -> dict[str, Any]:
        if not re.fullmatch(r"[0-9]{8}", date_name):
            raise GeneratedOutputError("Generated output date is invalid.")
        if not stem or len(stem) > 200 or any(character in stem for character in "/\\"):
            raise GeneratedOutputError("Generated output id is invalid.")
        date_root = (self.root / date_name).resolve()
        path = (date_root / f"{stem}.json").resolve()
        if path.parent != date_root or not path.is_file():
            raise GeneratedOutputError("Generated output metadata was not found.")
        try:
            value = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as error:
            raise GeneratedOutputError("Generated output metadata could not be read.") from error
        if not isinstance(value, dict) or value.get("schema_version") != OUTPUT_SCHEMA:
            raise GeneratedOutputError("Generated output metadata is invalid.")
        return value

    @staticmethod
    def _next_sequence(date_root: Path) -> int:
        maximum = 0
        for path in date_root.glob("*.json"):
            match = SEQUENCE_PATTERN.match(path.stem)
            if match:
                maximum = max(maximum, int(match.group("sequence")))
        return maximum + 1

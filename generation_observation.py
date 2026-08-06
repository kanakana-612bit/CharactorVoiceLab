#!/usr/bin/env python3
"""Local-only, opt-in observation records for CharacterVoiceDesigner TTS."""

from __future__ import annotations

import hashlib
import io
import json
import math
import os
import re
import time
import uuid
import wave
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Mapping


OBSERVATION_SCHEMA_VERSION = "cvd_tts_observation_0.2"
OBSERVATION_ID_PATTERN = re.compile(r"^[0-9]{8}T[0-9]{6}\.[0-9]{6}Z-[a-f0-9]{12}$")
LABEL_PATTERN = re.compile(r"^[A-Za-z0-9_.:-]{0,64}$")
MAX_OBSERVATION_BYTES = 2 * 1024 * 1024
MODEL_ARCHITECTURE_FIELDS = (
    "latent_dim",
    "text_dim",
    "speaker_dim",
    "caption_dim",
    "use_caption_condition",
    "use_speaker_condition",
    "use_duration_predictor",
    "duration_architecture",
    "duration_speaker_fusion",
    "duration_caption_fusion",
    "duration_caption_pooling",
    "max_text_len",
    "max_caption_len",
)


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def validate_observation_options(value: Any) -> dict[str, Any] | None:
    if value is None:
        return None
    if not isinstance(value, dict):
        raise ValueError("observation must be an object.")
    enabled = value.get("enabled", False)
    include_text = value.get("include_text", False)
    analyze_f0 = value.get("analyze_f0", True)
    capture_internal = value.get("capture_internal_conditions", False)
    for field, item in (
        ("observation.enabled", enabled),
        ("observation.include_text", include_text),
        ("observation.analyze_f0", analyze_f0),
        ("observation.capture_internal_conditions", capture_internal),
    ):
        if not isinstance(item, bool):
            raise ValueError(f"{field} must be boolean.")
    if not enabled:
        return None

    label = value.get("label", "")
    if not isinstance(label, str) or not LABEL_PATTERN.fullmatch(label):
        raise ValueError(
            "observation.label must use at most 64 ASCII letters, digits, dots, colons, underscores, or hyphens."
        )
    raw_steps = value.get("latent_snapshot_steps", [])
    if not isinstance(raw_steps, list) or len(raw_steps) > 16:
        raise ValueError("observation.latent_snapshot_steps must be a list of at most 16 integers.")
    steps: list[int] = []
    for item in raw_steps:
        if isinstance(item, bool) or not isinstance(item, int) or not 1 <= item <= 100:
            raise ValueError("observation.latent_snapshot_steps entries must be integers from 1 to 100.")
        steps.append(item)
    return {
        "include_text": include_text,
        "analyze_f0": analyze_f0,
        "capture_internal_conditions": capture_internal,
        "latent_snapshot_steps": sorted(set(steps)),
        "label": label,
    }


def text_record(value: str, include_text: bool) -> dict[str, Any]:
    encoded = value.encode("utf-8")
    result: dict[str, Any] = {
        "sha256": sha256_bytes(encoded),
        "characters": len(value),
        "utf8_bytes": len(encoded),
    }
    if include_text:
        result["value"] = value
    return result


def inspect_pcm_wav(wav_bytes: bytes) -> dict[str, Any]:
    with wave.open(io.BytesIO(wav_bytes), "rb") as source:
        channels = source.getnchannels()
        sample_width = source.getsampwidth()
        sample_rate = source.getframerate()
        frames = source.getnframes()
        compression = source.getcomptype()
    return {
        "channels": channels,
        "sample_width_bytes": sample_width,
        "sample_rate_hz": sample_rate,
        "frame_count": frames,
        "duration_seconds": round(frames / sample_rate, 6) if sample_rate else None,
        "compression": compression,
    }


def _inside(path: Path, parent: Path) -> bool:
    try:
        path.relative_to(parent)
    except ValueError:
        return False
    return True


def load_model_metadata(project_root: Path, model_id: str) -> dict[str, Any]:
    audio_root = (project_root / "runtime" / "audio.cpp").resolve()
    server_config_path = audio_root / "server.character_voice_designer.json"
    result: dict[str, Any] = {
        "id": model_id,
        "metadata_available": False,
        "architecture": {},
    }
    try:
        server_config = json.loads(server_config_path.read_text(encoding="utf-8-sig"))
        model_entry = next(
            item
            for item in server_config.get("models", [])
            if isinstance(item, dict) and item.get("id") == model_id
        )
        raw_model_path = model_entry["path"]
        if not isinstance(raw_model_path, str):
            raise ValueError("model path is not text")
        model_root = (audio_root / raw_model_path).resolve()
        if not _inside(model_root, audio_root):
            raise ValueError("model path escapes the local audio.cpp runtime")
        config_path = model_root / "model_config.json"
        config_bytes = config_path.read_bytes()
        config = json.loads(config_bytes.decode("utf-8"))
        if not isinstance(config, dict):
            raise ValueError("model config root is not an object")
        architecture = {
            field: config[field]
            for field in MODEL_ARCHITECTURE_FIELDS
            if field in config
        }
        weights_path = model_root / "model.safetensors"
        result.update(
            {
                "metadata_available": True,
                "family": model_entry.get("family"),
                "task": model_entry.get("task"),
                "variant": model_root.name,
                "model_config_sha256": sha256_bytes(config_bytes),
                "weights_size_bytes": weights_path.stat().st_size if weights_path.is_file() else None,
                "architecture": architecture,
            }
        )
    except (OSError, ValueError, KeyError, StopIteration, json.JSONDecodeError) as error:
        result["metadata_error"] = type(error).__name__
    return result


def request_record(
    request: Mapping[str, Any],
    postprocess: Mapping[str, Any] | None,
    options: Mapping[str, Any],
) -> dict[str, Any]:
    request_options = request.get("options", {})
    include_text = bool(options["include_text"])
    result: dict[str, Any] = {
        "model": request["model"],
        "language": request["language"],
        "seed": request["seed"],
        "num_inference_steps": request["num_inference_steps"],
        "input": text_record(str(request["input"]), include_text),
        "options": {
            "no_ref": request_options.get("no_ref"),
            "caption": text_record(str(request_options.get("caption", "")), include_text),
            "duration_scale": request_options.get("duration_scale"),
            "caption_guidance_scale": request_options.get("caption_guidance_scale"),
            "trim_tail": request_options.get("trim_tail"),
        },
        "postprocess": {
            "f0": {
                "enabled": bool(postprocess),
                "target_hz": postprocess.get("target_hz") if postprocess else None,
                "strength": postprocess.get("strength") if postprocess else None,
            }
        },
    }
    return result


def internal_condition_record(
    model_metadata: Mapping[str, Any],
    options: Mapping[str, Any],
) -> dict[str, Any]:
    architecture = model_metadata.get("architecture", {})
    capture_requested = bool(options["capture_internal_conditions"])
    unavailable = "The pinned audio.cpp runtime does not expose this internal value."
    return {
        "capture_requested": capture_requested,
        "speaker_condition": {
            "expected_dimension": architecture.get("speaker_dim"),
            "observed": False,
            "reason": unavailable,
        },
        "caption_condition": {
            "expected_dimension": architecture.get("caption_dim"),
            "observed": False,
            "reason": unavailable,
        },
        "initial_audio_latent": {
            "expected_dimension": architecture.get("latent_dim"),
            "observed": False,
            "reason": unavailable,
        },
        "latent_snapshots": {
            "requested_steps": list(options["latent_snapshot_steps"]),
            "observed_steps": [],
            "reason": unavailable,
        },
        "duration_prediction": {
            "enabled_in_model": architecture.get("use_duration_predictor"),
            "observed": False,
            "reason": unavailable,
        },
    }


def _finite_header(headers: Mapping[str, str], name: str) -> float | None:
    value = headers.get(name)
    if value is None:
        return None
    try:
        parsed = float(value)
    except ValueError:
        return None
    return parsed if math.isfinite(parsed) else None


def merge_upstream_observation_headers(
    internal: dict[str, Any],
    headers: Mapping[str, str],
) -> None:
    predicted_seconds = _finite_header(headers, "X-AudioCpp-Predicted-Duration-Seconds")
    predicted_frames = _finite_header(headers, "X-AudioCpp-Predicted-Duration-Frames")
    if predicted_seconds is not None or predicted_frames is not None:
        internal["duration_prediction"].update(
            {
                "observed": True,
                "seconds": predicted_seconds,
                "frames": int(predicted_frames) if predicted_frames is not None else None,
                "reason": None,
            }
        )
    hash_headers = (
        ("speaker_condition", "X-AudioCpp-Speaker-Condition-SHA256"),
        ("caption_condition", "X-AudioCpp-Caption-Condition-SHA256"),
        ("initial_audio_latent", "X-AudioCpp-Initial-Latent-SHA256"),
    )
    for field, header in hash_headers:
        digest = headers.get(header)
        if isinstance(digest, str) and re.fullmatch(r"[a-fA-F0-9]{64}", digest):
            internal[field].update({"observed": True, "sha256": digest.lower(), "reason": None})
    speaker = internal["speaker_condition"]
    artifact_digest = headers.get("X-CVD-Speaker-Artifact-SHA256")
    if isinstance(artifact_digest, str) and re.fullmatch(r"[a-fA-F0-9]{64}", artifact_digest):
        speaker.update(
            {
                "observed": True,
                "artifact_sha256": artifact_digest.lower(),
                "reason": None,
            }
        )
        expected_artifact_sha = speaker.get("input_artifact_sha256")
        speaker["matches_input_artifact"] = (
            artifact_digest.lower() == expected_artifact_sha
            if isinstance(expected_artifact_sha, str)
            else None
        )
    speaker_shape = headers.get("X-AudioCpp-Speaker-Condition-Shape") or headers.get(
        "X-CVD-Speaker-Condition-Shape"
    )
    if isinstance(speaker_shape, str) and re.fullmatch(
        r"[1-9][0-9]*x[1-9][0-9]*", speaker_shape
    ):
        speaker["shape"] = [int(value) for value in speaker_shape.split("x")]
    speaker_mode = headers.get("X-AudioCpp-Speaker-Condition-Mode") or headers.get(
        "X-CVD-Speaker-Condition-Mode"
    )
    if speaker_mode in {"none", "reference_audio", "speaker_inversion"}:
        speaker["mode"] = speaker_mode
    expected_state_sha = speaker.get("input_state_f32le_sha256")
    if isinstance(expected_state_sha, str):
        observed_state_sha = speaker.get("sha256")
        speaker["matches_input_state"] = (
            observed_state_sha == expected_state_sha
            if isinstance(observed_state_sha, str)
            else None
        )


class ObservationCapture:
    def __init__(
        self,
        store: "ObservationStore",
        request: Mapping[str, Any],
        postprocess: Mapping[str, Any] | None,
        options: Mapping[str, Any],
    ) -> None:
        now = datetime.now(timezone.utc)
        self.id = now.strftime("%Y%m%dT%H%M%S.%fZ") + "-" + uuid.uuid4().hex[:12]
        self.store = store
        self.options = dict(options)
        self.started = time.perf_counter()
        model_metadata = load_model_metadata(store.project_root, str(request["model"]))
        self.record: dict[str, Any] = {
            "schema_version": OBSERVATION_SCHEMA_VERSION,
            "observation_id": self.id,
            "created_at": now.isoformat(),
            "label": options["label"] or None,
            "privacy": {
                "local_only": True,
                "input_text_stored": bool(options["include_text"]),
                "caption_text_stored": bool(options["include_text"]),
                "audio_stored": False,
            },
            "request": request_record(request, postprocess, options),
            "model": model_metadata,
            "internal_conditions": internal_condition_record(model_metadata, options),
        }

    def finalize_success(
        self,
        *,
        upstream_body: bytes,
        body: bytes,
        status: int,
        content_type: str,
        upstream_seconds: float,
        postprocess_seconds: float,
        correction_metadata: Mapping[str, Any] | None,
        upstream_headers: Mapping[str, str],
        f0_analyzer: Callable[..., dict[str, Any]] | None,
    ) -> bool:
        merge_upstream_observation_headers(self.record["internal_conditions"], upstream_headers)
        audio: dict[str, Any] = {
            "sha256": sha256_bytes(body),
            "bytes": len(body),
            "stored": False,
        }
        if content_type == "audio/wav":
            try:
                audio.update(inspect_pcm_wav(body))
            except (EOFError, wave.Error) as error:
                audio["wav_metadata_error"] = f"{type(error).__name__}: {error}"
            if self.options["analyze_f0"] and f0_analyzer is not None:
                try:
                    audio["f0"] = f0_analyzer(body)
                except Exception as error:  # Observation must never break synthesis.
                    audio["f0_error"] = f"{type(error).__name__}: {error}"
        upstream_audio: dict[str, Any] = {
            "sha256": sha256_bytes(upstream_body),
            "bytes": len(upstream_body),
            "same_as_returned": upstream_body == body,
        }
        if upstream_body != body and content_type == "audio/wav":
            try:
                upstream_audio.update(inspect_pcm_wav(upstream_body))
            except (EOFError, wave.Error) as error:
                upstream_audio["wav_metadata_error"] = f"{type(error).__name__}: {error}"
            if self.options["analyze_f0"] and f0_analyzer is not None:
                try:
                    upstream_audio["f0"] = f0_analyzer(upstream_body)
                except Exception as error:
                    upstream_audio["f0_error"] = f"{type(error).__name__}: {error}"
        self.record.update(
            {
                "status": "complete",
                "response": {
                    "status": status,
                    "content_type": content_type,
                    "upstream_audio": upstream_audio,
                    "audio": audio,
                    "postprocess_f0": dict(correction_metadata) if correction_metadata else None,
                },
                "timing": {
                    "upstream_seconds": round(upstream_seconds, 6),
                    "postprocess_seconds": round(postprocess_seconds, 6),
                    "total_seconds": round(time.perf_counter() - self.started, 6),
                },
            }
        )
        return self.store.write(self.id, self.record)

    def finalize_error(self, category: str, message: str, upstream_seconds: float) -> bool:
        self.record.update(
            {
                "status": "error",
                "error": {"category": category, "message": message},
                "timing": {
                    "upstream_seconds": round(upstream_seconds, 6),
                    "total_seconds": round(time.perf_counter() - self.started, 6),
                },
            }
        )
        return self.store.write(self.id, self.record)


class ObservationStore:
    def __init__(self, root: Path, project_root: Path) -> None:
        self.root = root.resolve()
        self.project_root = project_root.resolve()

    def begin(
        self,
        request: Mapping[str, Any],
        postprocess: Mapping[str, Any] | None,
        options: Mapping[str, Any],
    ) -> ObservationCapture:
        return ObservationCapture(self, request, postprocess, options)

    def write(self, observation_id: str, record: Mapping[str, Any]) -> bool:
        if not OBSERVATION_ID_PATTERN.fullmatch(observation_id):
            return False
        try:
            self.root.mkdir(parents=True, exist_ok=True)
            destination = self.root / f"{observation_id}.json"
            temporary = self.root / f".{observation_id}.{os.getpid()}.tmp"
            body = json.dumps(record, ensure_ascii=False, indent=2).encode("utf-8")
            if len(body) > MAX_OBSERVATION_BYTES:
                return False
            temporary.write_bytes(body)
            os.replace(temporary, destination)
            return True
        except OSError:
            return False

    def read(self, observation_id: str) -> dict[str, Any] | None:
        if not OBSERVATION_ID_PATTERN.fullmatch(observation_id):
            return None
        path = self.root / f"{observation_id}.json"
        try:
            body = path.read_bytes()
            if len(body) > MAX_OBSERVATION_BYTES:
                return None
            result = json.loads(body.decode("utf-8"))
        except (OSError, UnicodeDecodeError, json.JSONDecodeError):
            return None
        return result if isinstance(result, dict) else None

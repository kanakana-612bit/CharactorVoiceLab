#!/usr/bin/env python3
"""Versioned TTS backend capabilities and reproducibility metadata."""

from __future__ import annotations

import copy
import hashlib
from pathlib import Path
from typing import Any


OFFICIAL_V4_MODEL_ID = "irodori-v4-small"
OFFICIAL_V4_SOURCE_COMMIT = "d48dd92b943fa5dbcb88150eb974c25d8709df9b"


_BACKENDS: tuple[dict[str, Any], ...] = (
    {
        "id": "irodori-vdes",
        "label": "Irodori v3 VoiceDesign / audio.cpp",
        "runtime_kind": "audio_cpp",
        "family": "irodori_tts",
        "task": "voice_design",
        "model": {
            "repository": "Aratako/Irodori-TTS-600M-v3-VoiceDesign",
            "revision": "local_audio_cpp_install",
        },
        "runtime": {
            "implementation": "0xShug0/audio.cpp",
            "release": "release-0.3-qwen3-tts",
        },
        "capabilities": {
            "text": True,
            "caption": True,
            "emoji_in_text": False,
            "reference_audio": True,
            "multiple_reference_audio": False,
            "speaker_inversion": "patched_compatibility_path",
            "duration_prediction": True,
            "reference_duration_limit_seconds": 30,
            "watermarking": "not_exposed_by_adapter",
            "observable_tensors": [],
        },
        "compute": {"cpu": True, "cuda": True},
    },
    {
        "id": OFFICIAL_V4_MODEL_ID,
        "label": "Irodori v4-Small / official runtime",
        "runtime_kind": "official_python",
        "family": "irodori_tts",
        "task": "text_caption_speaker",
        "model": {
            "repository": "Aratako/Irodori-TTS-v4-Small",
            "checkpoint_file": "model.safetensors",
            "revision": "model_repository_snapshot_resolved_at_setup",
        },
        "runtime": {
            "implementation": "Aratako/Irodori-TTS",
            "repository": "https://github.com/Aratako/Irodori-TTS.git",
            "source_commit": OFFICIAL_V4_SOURCE_COMMIT,
            "config": "train_v4_small_speaker_inversion.yaml",
            "tokenizer": "sbintuitions/modernbert-ja-310m",
            "codec": "Aratako/Semantic-DACVAE-Japanese-32dim",
        },
        "capabilities": {
            "text": True,
            "caption": True,
            "emoji_in_text": True,
            "reference_audio": True,
            "multiple_reference_audio": True,
            "speaker_inversion": "official_same_checkpoint",
            "duration_prediction": True,
            "reference_duration_limit_seconds": 120,
            "watermarking": "not_declared_by_pinned_inference_cli",
            "observable_tensors": [],
        },
        "compute": {"cpu": False, "cuda": True},
        "limitations": [
            "Caption, reference, and emoji conditions may conflict.",
            "Condition effects are learned and are not direct physical controls.",
            "The current application adapter exposes no internal tensors.",
        ],
    },
)

_FILE_HASH_CACHE: dict[tuple[str, int, int], str] = {}


def _cached_sha256(path: Path) -> str:
    stat = path.stat()
    key = (str(path.resolve()), stat.st_size, stat.st_mtime_ns)
    cached = _FILE_HASH_CACHE.get(key)
    if cached:
        return cached
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(8 * 1024 * 1024), b""):
            digest.update(chunk)
    value = digest.hexdigest()
    _FILE_HASH_CACHE.clear()
    _FILE_HASH_CACHE[key] = value
    return value


def backend_manifest(model_id: str) -> dict[str, Any]:
    for backend in _BACKENDS:
        if backend["id"] == model_id:
            return copy.deepcopy(backend)
    raise KeyError(model_id)


def backend_catalog(native_catalog: dict[str, Any] | None = None) -> dict[str, Any]:
    native = copy.deepcopy(native_catalog or {})
    native_models = {
        item.get("id"): item
        for item in native.get("models", [])
        if isinstance(item, dict) and isinstance(item.get("id"), str)
    }
    models = []
    for template in _BACKENDS:
        item = copy.deepcopy(template)
        item.update(
            {
                key: value
                for key, value in native_models.get(item["id"], {}).items()
                if key not in {"capabilities", "runtime", "compute"}
            }
        )
        models.append(item)
    return {
        "schema_version": "cvd_tts_backend_catalog_0.1",
        "models": models,
        "devices": native.get("devices", []),
        "default_device": native.get("default_device", "cpu"),
        "vram_limit_policy": native.get("vram_limit_policy", {}),
        "status": native.get("status", {"managed": False, "running": False}),
        "condition_contract": {
            "identity": ["reference_audio", "speaker_inversion"],
            "performance": ["caption", "emoji_in_text"],
            "physical_scalar_control": False,
        },
    }


def backend_output_metadata(project_root: Path, model_id: str) -> dict[str, Any]:
    metadata = backend_manifest(model_id)
    if model_id == "irodori-vdes":
        checkpoint = (
            Path(project_root)
            / "runtime"
            / "audio.cpp"
            / "models"
            / "Irodori-TTS-600M-v3-VoiceDesign"
            / "model.safetensors"
        )
        if checkpoint.is_file():
            metadata["model"]["checkpoint_sha256"] = _cached_sha256(checkpoint)
            metadata["model"]["checkpoint_size_bytes"] = checkpoint.stat().st_size
    if model_id == OFFICIAL_V4_MODEL_ID:
        try:
            from speaker_inversion_pipeline import _runtime_paths

            paths = _runtime_paths(Path(project_root).resolve())
            if paths["model"].is_file():
                metadata["model"]["checkpoint_sha256"] = _cached_sha256(paths["model"])
                metadata["model"]["checkpoint_size_bytes"] = paths["model"].stat().st_size
            environment = paths["environment"]
            if environment.is_file():
                import json

                status = json.loads(environment.read_text(encoding="utf-8"))
                metadata["resolved_environment"] = {
                    key: status.get(key)
                    for key in (
                        "upstream_commit",
                        "model_repository",
                        "model_sha256",
                        "python_version",
                        "torch_version",
                    )
                    if status.get(key) is not None
                }
        except (ImportError, OSError, ValueError):
            metadata["resolved_environment"] = {"available": False}
    return metadata


def is_official_v4(model_id: str) -> bool:
    return model_id == OFFICIAL_V4_MODEL_ID

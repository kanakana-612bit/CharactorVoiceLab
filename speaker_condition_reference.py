#!/usr/bin/env python3
"""Reference contract and compatibility checks for Irodori speaker conditions.

This module does not infer a speaker embedding from appearance. It validates and
transports embeddings produced by an explicit optimization process.
"""

from __future__ import annotations

import hashlib
import json
import math
import re
import struct
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Mapping


SPEAKER_CONDITION_SCHEMA_VERSION = "cvd_speaker_condition_reference_0.1"
SPEAKER_INVERSION_SUFFIX = ".speaker.safetensors"
SPEAKER_INVERSION_KEY = "speaker_embedding"
DEFAULT_TOKENS = 16
DEFAULT_INIT_STD = 0.02
UPSTREAM_SOURCE = "https://github.com/Aratako/Irodori-TTS"
UPSTREAM_SPEAKER_INVERSION_SOURCE = (
    "https://github.com/Aratako/Irodori-TTS/blob/main/irodori_tts/speaker_inversion.py"
)
UPSTREAM_INFERENCE_SOURCE = (
    "https://github.com/Aratako/Irodori-TTS/blob/main/irodori_tts/inference_runtime.py"
)
PINNED_AUDIO_CPP_REF = "release-0.3-qwen3-tts"
MODEL_CONFIG_FIELDS = (
    "latent_dim",
    "latent_patch_size",
    "model_dim",
    "num_layers",
    "num_heads",
    "text_dim",
    "use_caption_condition",
    "use_speaker_condition",
    "caption_dim",
    "speaker_dim",
    "speaker_layers",
    "speaker_heads",
    "speaker_patch_size",
    "use_duration_predictor",
    "duration_architecture",
    "duration_speaker_fusion",
    "duration_caption_fusion",
)


class SpeakerConditionError(RuntimeError):
    """Raised when a speaker-condition artifact cannot be validated."""


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(8 * 1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def file_contains(path: Path, marker: bytes) -> bool:
    overlap = max(0, len(marker) - 1)
    previous = b""
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            block = previous + chunk
            if marker in block:
                return True
            previous = block[-overlap:] if overlap else b""
    return False


def sha256_json(value: Mapping[str, Any]) -> str:
    body = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(body.encode("utf-8")).hexdigest()


def _safe_git_value(root: Path, *args: str) -> str | None:
    if not (root / ".git").exists():
        return None
    try:
        result = subprocess.run(
            ["git", "-C", str(root), *args],
            check=True,
            capture_output=True,
            text=True,
            timeout=5,
        )
    except (OSError, subprocess.SubprocessError):
        return None
    value = result.stdout.strip()
    return value or None


def _model_config_from_checkpoint(path: Path) -> dict[str, Any] | None:
    try:
        from safetensors import safe_open
    except ImportError as error:
        raise SpeakerConditionError("safetensors is required for model inspection.") from error
    try:
        with safe_open(str(path), framework="pt", device="cpu") as source:
            metadata = source.metadata() or {}
    except Exception as error:
        raise SpeakerConditionError(f"Could not read model checkpoint metadata: {error}") from error
    raw = metadata.get("config_json")
    if not isinstance(raw, str):
        return None
    try:
        value = json.loads(raw)
    except json.JSONDecodeError as error:
        raise SpeakerConditionError("Model checkpoint config_json is invalid.") from error
    return value if isinstance(value, dict) else None


def inspect_model(
    model_root: Path,
    *,
    hash_weights: bool = False,
) -> dict[str, Any]:
    model_root = model_root.expanduser().resolve()
    config_path = model_root / "model_config.json"
    checkpoint_path = model_root / "model.safetensors"
    if not config_path.is_file() or not checkpoint_path.is_file():
        raise SpeakerConditionError(
            f"Expected model_config.json and model.safetensors under {model_root}."
        )
    try:
        config = json.loads(config_path.read_text(encoding="utf-8-sig"))
    except (OSError, json.JSONDecodeError) as error:
        raise SpeakerConditionError(f"Could not parse {config_path}: {error}") from error
    if not isinstance(config, dict):
        raise SpeakerConditionError("Model configuration root must be an object.")
    checkpoint_config = _model_config_from_checkpoint(checkpoint_path)
    config_matches_checkpoint = checkpoint_config == config if checkpoint_config else None

    try:
        from safetensors import safe_open
    except ImportError as error:
        raise SpeakerConditionError("safetensors is required for model inspection.") from error
    speaker_keys: list[str] = []
    speaker_projection_shapes: list[list[int]] = []
    with safe_open(str(checkpoint_path), framework="pt", device="cpu") as source:
        for key in source.keys():
            if (
                key.startswith("speaker_encoder.")
                or key.startswith("speaker_norm.")
                or ".wk_speaker." in key
                or ".wv_speaker." in key
            ):
                speaker_keys.append(key)
                if ".wk_speaker." in key or ".wv_speaker." in key:
                    speaker_projection_shapes.append(
                        [int(value) for value in source.get_slice(key).get_shape()]
                    )

    result: dict[str, Any] = {
        "root": str(model_root),
        "name": model_root.name,
        "config_sha256": sha256_json(config),
        "config_matches_checkpoint_metadata": config_matches_checkpoint,
        "checkpoint": {
            "name": checkpoint_path.name,
            "bytes": checkpoint_path.stat().st_size,
            "sha256": sha256_file(checkpoint_path) if hash_weights else None,
            "sha256_computed": hash_weights,
        },
        "architecture": {
            field: config.get(field)
            for field in MODEL_CONFIG_FIELDS
            if field in config
        },
        "speaker_condition": {
            "enabled": bool(config.get("use_speaker_condition", False)),
            "dimension": config.get("speaker_dim"),
            "encoder_weight_keys": len(speaker_keys),
            "projection_shapes": sorted(
                {tuple(shape) for shape in speaker_projection_shapes}
            ),
            "direct_state_shape": ["tokens", config.get("speaker_dim")],
        },
    }
    result["speaker_condition"]["projection_shapes"] = [
        list(shape) for shape in result["speaker_condition"]["projection_shapes"]
    ]
    return result


def sidecar_path(embedding_path: Path) -> Path:
    name = embedding_path.name
    if name.endswith(".safetensors"):
        name = name[: -len(".safetensors")] + ".json"
    else:
        name += ".json"
    return embedding_path.with_name(name)


def _load_sidecar(embedding_path: Path) -> dict[str, Any] | None:
    path = sidecar_path(embedding_path)
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    return value if isinstance(value, dict) else None


def _tensor_statistics(tensor: Any) -> dict[str, Any]:
    import torch

    values = tensor.detach().float().cpu()
    finite = torch.isfinite(values)
    if not bool(finite.all().item()):
        return {
            "finite": False,
            "minimum": None,
            "maximum": None,
            "mean": None,
            "std": None,
            "rms": None,
            "token_norm_min": None,
            "token_norm_median": None,
            "token_norm_max": None,
            "off_diagonal_cosine_mean": None,
            "off_diagonal_cosine_max": None,
        }
    token_norms = torch.linalg.vector_norm(values, dim=1)
    normalized = values / token_norms.clamp_min(1e-12)[:, None]
    cosine = normalized @ normalized.transpose(0, 1)
    if values.shape[0] > 1:
        selector = ~torch.eye(values.shape[0], dtype=torch.bool)
        off_diagonal = cosine[selector]
    else:
        off_diagonal = torch.zeros(0)
    return {
        "finite": True,
        "minimum": float(values.min().item()),
        "maximum": float(values.max().item()),
        "mean": float(values.mean().item()),
        "std": float(values.std(unbiased=False).item()),
        "rms": float(torch.sqrt(torch.mean(values**2)).item()),
        "token_norm_min": float(token_norms.min().item()),
        "token_norm_median": float(token_norms.median().item()),
        "token_norm_max": float(token_norms.max().item()),
        "off_diagonal_cosine_mean": (
            float(off_diagonal.mean().item()) if off_diagonal.numel() else None
        ),
        "off_diagonal_cosine_max": (
            float(off_diagonal.max().item()) if off_diagonal.numel() else None
        ),
    }


def speaker_state_f32le_sha256(tensor: Any) -> str:
    """Hash the exact float32 state representation consumed by audio.cpp."""
    import torch

    values = tensor.detach().to(dtype=torch.float32, device="cpu").contiguous().view(-1)
    if not bool(torch.isfinite(values).all().item()):
        raise SpeakerConditionError(
            "Cannot hash a speaker state containing non-finite values."
        )
    digest = hashlib.sha256()
    raw_values = values.tolist()
    for offset in range(0, len(raw_values), 4096):
        chunk = raw_values[offset : offset + 4096]
        digest.update(struct.pack(f"<{len(chunk)}f", *chunk))
    return digest.hexdigest()


def inspect_embedding(
    path: Path,
    *,
    model: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    path = path.expanduser().resolve()
    file_errors: list[str] = []
    model_errors: list[str] = []
    provenance_errors: list[str] = []
    warnings: list[str] = []
    if not path.is_file():
        raise SpeakerConditionError(f"Speaker embedding was not found: {path}")
    if not path.name.endswith(SPEAKER_INVERSION_SUFFIX):
        file_errors.append(f"filename_must_end_with_{SPEAKER_INVERSION_SUFFIX}")
    try:
        from safetensors import safe_open
    except ImportError as error:
        raise SpeakerConditionError("safetensors is required for embedding inspection.") from error
    try:
        with safe_open(str(path), framework="pt", device="cpu") as source:
            keys = list(source.keys())
            metadata = source.metadata() or {}
            tensor = source.get_tensor(SPEAKER_INVERSION_KEY) if SPEAKER_INVERSION_KEY in keys else None
    except Exception as error:
        raise SpeakerConditionError(f"Could not read speaker embedding: {error}") from error
    if tensor is None:
        file_errors.append(f"missing_tensor_key:{SPEAKER_INVERSION_KEY}")
        shape: list[int] = []
        dtype = None
        statistics = None
        state_f32le_sha256 = None
    else:
        shape = [int(value) for value in tensor.shape]
        dtype = str(tensor.dtype).replace("torch.", "")
        statistics = _tensor_statistics(tensor) if tensor.ndim == 2 and tensor.numel() else None
        state_f32le_sha256 = (
            speaker_state_f32le_sha256(tensor)
            if statistics and statistics["finite"] and tensor.is_floating_point()
            else None
        )
        if tensor.ndim != 2:
            file_errors.append("speaker_embedding_must_have_rank_2")
        elif shape[0] <= 0:
            file_errors.append("speaker_embedding_must_have_at_least_one_token")
        if not tensor.is_floating_point():
            file_errors.append("speaker_embedding_must_be_floating_point")
        if statistics and not statistics["finite"]:
            file_errors.append("speaker_embedding_contains_non_finite_values")
    expected_dim = None
    if model is not None:
        expected_dim = model.get("speaker_condition", {}).get("dimension")
        if not model.get("speaker_condition", {}).get("enabled", False):
            model_errors.append("target_model_has_no_speaker_condition")
        if (
            expected_dim is not None
            and len(shape) == 2
            and shape[1] != int(expected_dim)
        ):
            model_errors.append(
                f"speaker_dimension_mismatch:expected_{int(expected_dim)}_got_{shape[1]}"
            )
    if len(shape) == 2 and shape[0] != DEFAULT_TOKENS:
        warnings.append(
            f"token_count_{shape[0]}_is_valid_but_differs_from_reference_{DEFAULT_TOKENS}"
        )
    if set(keys) - {SPEAKER_INVERSION_KEY}:
        warnings.append("extra_tensor_keys_are_ignored_by_upstream_loader")

    file_sha = sha256_file(path)
    sidecar = _load_sidecar(path)
    binding_status = "unbound"
    if sidecar is not None:
        sidecar_file_sha = sidecar.get("embedding", {}).get("sha256")
        if sidecar_file_sha != file_sha:
            provenance_errors.append("sidecar_embedding_sha256_mismatch")
            binding_status = "invalid"
        else:
            expected_config = (
                model.get("config_sha256") if isinstance(model, Mapping) else None
            )
            sidecar_config = sidecar.get("model", {}).get("config_sha256")
            expected_weights = (
                model.get("checkpoint", {}).get("sha256")
                if isinstance(model, Mapping)
                else None
            )
            sidecar_weights = sidecar.get("model", {}).get("checkpoint_sha256")
            if expected_config and sidecar_config != expected_config:
                provenance_errors.append("sidecar_model_config_sha256_mismatch")
                binding_status = "incompatible"
            elif expected_weights and sidecar_weights != expected_weights:
                provenance_errors.append("sidecar_model_checkpoint_sha256_mismatch")
                binding_status = "incompatible"
            elif sidecar.get("provenance", {}).get("semantic_voice") is False:
                binding_status = "format_fixture_only"
            else:
                binding_status = "bound"

    return {
        "path": str(path),
        "name": path.name,
        "bytes": path.stat().st_size,
        "sha256": file_sha,
        "state_f32le_sha256": state_f32le_sha256,
        "suffix_compatible": path.name.endswith(SPEAKER_INVERSION_SUFFIX),
        "tensor_key": SPEAKER_INVERSION_KEY,
        "keys": keys,
        "metadata": metadata,
        "shape": shape,
        "tokens": shape[0] if len(shape) == 2 else None,
        "dimension": shape[1] if len(shape) == 2 else None,
        "dtype": dtype,
        "statistics": statistics,
        "expected_model_dimension": expected_dim,
        "upstream_file_contract_compatible": not file_errors,
        "target_model_contract_compatible": (
            not model_errors if model is not None else None
        ),
        "provenance_contract_compatible": (
            not provenance_errors if sidecar is not None else None
        ),
        "model_binding_status": binding_status,
        "sidecar": sidecar,
        "file_errors": file_errors,
        "model_errors": model_errors,
        "provenance_errors": provenance_errors,
        "errors": file_errors + model_errors + provenance_errors,
        "warnings": warnings,
    }


def write_sidecar(
    embedding_path: Path,
    *,
    model: Mapping[str, Any],
    provenance_kind: str,
    semantic_voice: bool,
    training_data: bool,
) -> Path:
    path = sidecar_path(embedding_path)
    body = {
        "schema_version": SPEAKER_CONDITION_SCHEMA_VERSION,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "embedding": {
            "file": embedding_path.name,
            "sha256": sha256_file(embedding_path),
        },
        "model": {
            "name": model.get("name"),
            "config_sha256": model.get("config_sha256"),
            "checkpoint_sha256": model.get("checkpoint", {}).get("sha256"),
            "checkpoint_bytes": model.get("checkpoint", {}).get("bytes"),
        },
        "provenance": {
            "kind": provenance_kind,
            "semantic_voice": bool(semantic_voice),
            "training_data_used": bool(training_data),
        },
        "privacy": {
            "contains_audio": False,
            "contains_text": False,
            "contains_person_identifier": False,
        },
    }
    path.write_text(json.dumps(body, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return path


def create_format_fixture(
    path: Path,
    *,
    model: Mapping[str, Any],
    tokens: int = DEFAULT_TOKENS,
    seed: int = 0,
    init_std: float = DEFAULT_INIT_STD,
) -> dict[str, Any]:
    if tokens <= 0:
        raise SpeakerConditionError("Fixture token count must be positive.")
    if init_std < 0 or not math.isfinite(init_std):
        raise SpeakerConditionError("Fixture init_std must be finite and non-negative.")
    speaker_dim = model.get("speaker_condition", {}).get("dimension")
    if not isinstance(speaker_dim, int) or speaker_dim <= 0:
        raise SpeakerConditionError("Target model does not declare a valid speaker dimension.")
    import torch
    from safetensors.torch import save_file

    generator = torch.Generator(device="cpu")
    generator.manual_seed(int(seed))
    embedding = (
        torch.randn((tokens, speaker_dim), generator=generator, dtype=torch.float32)
        * float(init_std)
    )
    path = path.expanduser().resolve()
    if not path.name.endswith(SPEAKER_INVERSION_SUFFIX):
        raise SpeakerConditionError(
            f"Fixture filename must end with {SPEAKER_INVERSION_SUFFIX}."
        )
    path.parent.mkdir(parents=True, exist_ok=True)
    save_file({SPEAKER_INVERSION_KEY: embedding.contiguous()}, str(path), metadata={})
    sidecar = write_sidecar(
        path,
        model=model,
        provenance_kind="deterministic_format_fixture",
        semantic_voice=False,
        training_data=False,
    )
    return {
        "embedding": str(path),
        "sidecar": str(sidecar),
        "seed": int(seed),
        "init_std": float(init_std),
        "semantic_voice": False,
    }


def classify_audio_cpp_source(source: str) -> dict[str, Any]:
    direct_patterns = (
        r"\bref_embed\b",
        r"\bspeaker_embedding_path\b",
        r"\bspeaker_state_override\b",
        r"\bload_speaker_inversion\b",
    )
    direct_matches = [
        pattern for pattern in direct_patterns if re.search(pattern, source)
    ]
    reference_audio = (
        "reference mode requires reference audio" in source
        or "encode_speaker_reference" in source
    )
    return {
        "reference_audio_input": reference_audio,
        "direct_embedding_input": bool(direct_matches),
        "direct_embedding_markers": direct_matches,
    }


def inspect_audio_cpp(project_root: Path) -> dict[str, Any]:
    runtime_root = project_root.resolve() / "runtime"
    source_candidates = (
        runtime_root / "audio.cpp-source",
        runtime_root / "audio.cpp-model-manager",
    )
    source_root = next(
        (
            path
            for path in source_candidates
            if (path / "src" / "models" / "irodori_tts" / "session.cpp").is_file()
        ),
        None,
    )
    binary_candidates = [
        runtime_root / "audio.cpp" / "audiocpp_server.exe",
        runtime_root / "audio.cpp-build" / "bin" / "audiocpp_server",
    ]
    build_root = runtime_root / "audio.cpp-build"
    if build_root.is_dir():
        binary_candidates.extend(build_root.glob("**/bin/audiocpp_server"))
        binary_candidates.extend(build_root.glob("**/bin/audiocpp_server.exe"))
    binary = next((path for path in binary_candidates if path.is_file()), None)
    result: dict[str, Any] = {
        "expected_reference": PINNED_AUDIO_CPP_REF,
        "source_available": source_root is not None,
        "binary_available": binary is not None,
        "direct_embedding_input": False,
        "speaker_state_observation": False,
        "reference_audio_input": None,
    }
    if source_root is not None:
        source_path = source_root / "src" / "models" / "irodori_tts" / "session.cpp"
        source = source_path.read_text(encoding="utf-8")
        source_features = classify_audio_cpp_source(source)
        result["reference_audio_input"] = source_features["reference_audio_input"]
        result["source_direct_embedding_input"] = source_features[
            "direct_embedding_input"
        ]
        result["direct_embedding_markers"] = source_features[
            "direct_embedding_markers"
        ]
        result.update(
            {
                "source_root": str(source_root),
                "source_session_sha256": hashlib.sha256(source.encode("utf-8")).hexdigest(),
                "source_git_commit": _safe_git_value(source_root, "rev-parse", "HEAD"),
                "source_git_date": _safe_git_value(
                    source_root, "show", "-s", "--format=%cs", "HEAD"
                ),
            }
        )
        server_runtime_path = source_root / "app" / "server" / "runtime.cpp"
        if server_runtime_path.is_file():
            server_runtime = server_runtime_path.read_text(encoding="utf-8")
            result["source_speaker_state_observation"] = (
                "X-AudioCpp-Speaker-Condition-SHA256" in server_runtime
            )
    if binary is not None:
        binary_direct = file_contains(binary, b"speaker_embedding_path")
        binary_observation = file_contains(
            binary, b"X-AudioCpp-Speaker-Condition-SHA256"
        )
        result["binary"] = {
            "path": str(binary),
            "bytes": binary.stat().st_size,
            "sha256": sha256_file(binary),
            "direct_embedding_input": binary_direct,
            "speaker_state_observation": binary_observation,
        }
        result["direct_embedding_input"] = binary_direct
        result["speaker_state_observation"] = binary_observation
    return result


def speaker_condition_capabilities(
    project_root: Path,
    model_metadata: Mapping[str, Any],
) -> dict[str, Any]:
    architecture = model_metadata.get("architecture", {})
    runtime = inspect_audio_cpp(project_root)
    enabled = bool(architecture.get("use_speaker_condition", False))
    direct_inference = bool(enabled and runtime.get("direct_embedding_input"))
    return {
        "schema_version": "cvd_speaker_condition_capabilities_0.2",
        "model": {
            "id": model_metadata.get("id"),
            "metadata_available": model_metadata.get("metadata_available"),
            "config_sha256": model_metadata.get("model_config_sha256"),
            "speaker_condition_enabled": enabled,
            "speaker_dimension": architecture.get("speaker_dim"),
        },
        "speaker_inversion_contract": {
            "upstream": UPSTREAM_SOURCE,
            "suffix": SPEAKER_INVERSION_SUFFIX,
            "tensor_key": SPEAKER_INVERSION_KEY,
            "shape": ["tokens", architecture.get("speaker_dim")],
            "reference_tokens": DEFAULT_TOKENS,
            "token_count_is_variable": True,
            "raw_embedding_not_exposed_by_default": True,
        },
        "runtime": runtime,
        "available": {
            "model_speaker_branch": enabled,
            "reference_audio_conditioning": runtime.get("reference_audio_input"),
            "speaker_inversion_file_validation": True,
            "speaker_inversion_direct_inference": direct_inference,
            "speaker_state_observation": bool(
                direct_inference and runtime.get("speaker_state_observation")
            ),
        },
        "note": (
            "The inspected audio.cpp binary exposes the direct Speaker Inversion input path."
            if direct_inference
            else (
                "The model speaker branch and the Speaker Inversion tensor dimension are "
                "structurally compatible. Direct end-to-end use additionally requires a "
                "patched audio.cpp binary; the inspected binary does not expose that path."
            )
        ),
    }


def build_compatibility_report(
    *,
    model: Mapping[str, Any],
    runtime: Mapping[str, Any],
    embeddings: list[Mapping[str, Any]],
) -> dict[str, Any]:
    model_branch = bool(model.get("speaker_condition", {}).get("enabled", False))
    file_contract = (
        all(item.get("upstream_file_contract_compatible", False) for item in embeddings)
        if embeddings
        else None
    )
    model_artifact_contract = (
        all(item.get("target_model_contract_compatible", False) for item in embeddings)
        if embeddings
        else None
    )
    runtime_direct = bool(runtime.get("direct_embedding_input", False))
    if not model_branch:
        end_to_end = "incompatible_model_has_no_speaker_branch"
    elif embeddings and not file_contract:
        end_to_end = "incompatible_embedding_contract"
    elif embeddings and not model_artifact_contract:
        end_to_end = "incompatible_embedding_model_dimension"
    elif not runtime_direct:
        end_to_end = "blocked_native_runtime_has_no_embedding_input"
    elif not embeddings:
        end_to_end = "runtime_ready_embedding_not_supplied"
    else:
        end_to_end = "structurally_compatible_requires_semantic_checkpoint_binding"
    return {
        "schema_version": "cvd_speaker_inversion_compatibility_0.1",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "model": dict(model),
        "audio_cpp": dict(runtime),
        "embeddings": [dict(item) for item in embeddings],
        "compatibility": {
            "model_speaker_branch": model_branch,
            "speaker_dimension": model.get("speaker_condition", {}).get("dimension"),
            "upstream_file_contract": file_contract,
            "target_model_artifact_contract": model_artifact_contract,
            "upstream_python_direct_state_path": True,
            "audio_cpp_direct_state_path": runtime_direct,
            "end_to_end_status": end_to_end,
            "semantic_compatibility_proven": False,
        },
        "interpretation": {
            "appearance_to_embedding_mapping_implemented": False,
            "speaker_identity_claim": False,
            "format_fixture_is_a_voice": False,
            "note": (
                "Shape compatibility does not establish semantic compatibility. "
                "A meaningful embedding must be optimized against the exact target checkpoint "
                "and evaluated separately across held-out text."
            ),
        },
        "upstream_contract": {
            "speaker_inversion_source": UPSTREAM_SPEAKER_INVERSION_SOURCE,
            "inference_source": UPSTREAM_INFERENCE_SOURCE,
            "tensor_key": SPEAKER_INVERSION_KEY,
            "suffix": SPEAKER_INVERSION_SUFFIX,
            "reference_tokens": DEFAULT_TOKENS,
            "reference_init_std": DEFAULT_INIT_STD,
        },
    }


def reference_training_config(
    model_config: Mapping[str, Any],
    *,
    tokens: int = DEFAULT_TOKENS,
) -> dict[str, Any]:
    """Build a minimal upstream-compatible VoiceDesign inversion config."""
    return {
        "model": dict(model_config),
        "train": {
            "train_mode": "rf",
            "speaker_inversion_enabled": True,
            "speaker_inversion_tokens": int(tokens),
            "speaker_inversion_init_std": DEFAULT_INIT_STD,
            "speaker_inversion_init_embedding": None,
            "speaker_condition_dropout": 0.0,
            "caption_condition_dropout": 0.0,
            "text_condition_dropout": 0.0,
            "duration_speaker_dropout": 0.0,
            "batch_size": 16,
            "gradient_accumulation_steps": 1,
            "gradient_checkpointing": True,
            "precision": "bf16",
            "optimizer": "adamw",
            "learning_rate": 0.01,
            "weight_decay": 0.0,
            "max_steps": 3000,
            "max_text_len": int(model_config.get("max_text_len", 256)),
            "max_caption_len": int(model_config.get("max_caption_len", 512)),
            "max_latent_steps": 750,
            "rf_loss_mode": "utterance_mean",
            "duration_loss_weight": 0.1,
            "valid_ratio": 0.0,
            "valid_every": 0,
            "wandb_enabled": False,
            "seed": 0,
        },
    }

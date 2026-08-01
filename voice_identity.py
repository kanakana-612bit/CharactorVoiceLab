#!/usr/bin/env python3
"""Compiled local voice identity artifacts and lightweight warning evaluation."""

from __future__ import annotations

import hashlib
import json
import math
import re
import statistics
from datetime import datetime
from pathlib import Path
from typing import Any, Mapping, Sequence

from generation_observation import load_model_metadata
from speaker_condition_reference import (
    SpeakerConditionError,
    inspect_embedding,
)
from voice_evaluator import (
    EvaluationError,
    analyze_wav_bytes,
    feature_vector,
    strip_private_values,
)


IDENTITY_ID_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$")
SPEAKER_NAME_PATTERN = re.compile(
    r"^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}\.speaker\.safetensors$"
)
MODEL_ID_PATTERN = re.compile(r"^[A-Za-z0-9_.:-]{1,128}$")
SAFE_NAME_PATTERN = re.compile(r"[^A-Za-z0-9_.-]+")
COMPILED_IDENTITY_SCHEMA = "cvd_compiled_voice_identity_0.1"
STYLE_SCHEMA = "cvd_compiled_voice_style_0.1"
CALIBRATION_SCHEMA = "cvd_voice_calibration_0.1"
EVALUATION_SCHEMA = "cvd_identity_warning_evaluation_0.1"
PROVISIONAL_DISTANCE_THRESHOLD = 2.5
MAX_CALIBRATIONS = 16
FEATURE_GROUPS = (
    "source_and_prosody",
    "acoustic_timbre_proxy",
    "delivery_style",
)


class VoiceIdentityError(ValueError):
    """Invalid compiled voice identity request."""


def _now() -> str:
    return datetime.now().astimezone().isoformat()


def _sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def _canonical_json(value: Any) -> bytes:
    return json.dumps(
        value,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
        allow_nan=False,
    ).encode("utf-8")


def _safe_name(value: Any, fallback: str) -> str:
    if not isinstance(value, str):
        value = ""
    cleaned = SAFE_NAME_PATTERN.sub("-", value.strip()).strip(".-")
    return (cleaned or fallback)[:64]


def _display_name(value: Any, fallback: str) -> str:
    if not isinstance(value, str):
        return fallback
    cleaned = " ".join(value.strip().split())
    return (cleaned or fallback)[:128]


def _finite(value: Any) -> float | None:
    if isinstance(value, bool):
        return None
    try:
        result = float(value)
    except (TypeError, ValueError):
        return None
    return result if math.isfinite(result) else None


def _model_contract(project_root: Path, model_id: str) -> tuple[dict[str, Any], dict[str, Any]]:
    metadata = load_model_metadata(project_root, model_id)
    architecture = metadata.get("architecture", {})
    contract = {
        "config_sha256": metadata.get("model_config_sha256"),
        "checkpoint": {"sha256": None},
        "speaker_condition": {
            "enabled": bool(architecture.get("use_speaker_condition", False)),
            "dimension": architecture.get("speaker_dim"),
        },
    }
    return metadata, contract


def _compact_acoustic_values(record: Mapping[str, Any]) -> dict[str, Any]:
    source = record.get("source_and_prosody", {})
    timbre = record.get("acoustic_timbre_proxy", {})
    delivery = record.get("delivery_style", {})
    quality = record.get("waveform_quality", {})
    return {
        "f0_median_hz": source.get("median_hz"),
        "f0_std_hz": source.get("std_hz"),
        "voiced_frame_ratio": source.get("voiced_frame_ratio"),
        "target_error_semitones": source.get("target_error_semitones"),
        "spectral_centroid_hz": timbre.get("spectral_centroid_hz"),
        "spectral_rolloff_85_hz": timbre.get("spectral_rolloff_85_hz"),
        "spectral_flatness": timbre.get("spectral_flatness"),
        "spectral_tilt_db_per_octave": timbre.get("spectral_tilt_db_per_octave"),
        "active_speech_ratio": delivery.get("active_speech_ratio"),
        "duration_seconds": quality.get("duration_seconds"),
        "rms": quality.get("rms"),
        "peak_absolute": quality.get("peak_absolute"),
        "clipping_ratio": quality.get("clipping_ratio"),
    }


def _feature_maps(record: Mapping[str, Any]) -> dict[str, dict[str, float]]:
    return {group: feature_vector(record, group) for group in FEATURE_GROUPS}


def _fallback_scale(center: float) -> float:
    return max(abs(center) * 0.15, 0.05)


def build_calibration_baseline(records: Sequence[Mapping[str, Any]]) -> dict[str, Any] | None:
    if not records:
        return None
    maps = [_feature_maps(record) for record in records]
    groups: dict[str, Any] = {}
    for group in FEATURE_GROUPS:
        common = sorted(
            set.intersection(*(set(item[group]) for item in maps))
        ) if maps else []
        features = {}
        for key in common:
            values = [float(item[group][key]) for item in maps]
            center = statistics.median(values)
            if len(values) >= 3:
                mad = statistics.median(abs(value - center) for value in values) * 1.4826
            else:
                mad = 0.0
            standard = statistics.pstdev(values) if len(values) >= 2 else 0.0
            scale = mad if mad > 1e-9 else standard if standard > 1e-9 else _fallback_scale(center)
            features[key] = {
                "center": round(center, 10),
                "scale": round(scale, 10),
                "scale_basis": (
                    "calibration_mad"
                    if mad > 1e-9
                    else "calibration_std"
                    if standard > 1e-9
                    else "provisional_relative_fallback"
                ),
            }
        groups[group] = {"features": features, "feature_count": len(features)}
    return {
        "sample_count": len(records),
        "threshold_status": (
            "provisional_calibration_distribution"
            if len(records) >= 3
            else "provisional_insufficient_calibration_samples"
        ),
        "groups": groups,
    }


def evaluate_against_baseline(
    record: Mapping[str, Any],
    baseline: Mapping[str, Any] | None,
    *,
    threshold: float = PROVISIONAL_DISTANCE_THRESHOLD,
) -> dict[str, Any]:
    maps = _feature_maps(record)
    group_distances: dict[str, float | None] = {}
    all_squared: list[float] = []
    if baseline:
        for group in FEATURE_GROUPS:
            squared = []
            features = baseline.get("groups", {}).get(group, {}).get("features", {})
            for key, reference in features.items():
                value = maps[group].get(key)
                center = _finite(reference.get("center"))
                scale = _finite(reference.get("scale"))
                if value is None or center is None or scale is None or scale <= 0:
                    continue
                squared.append(((float(value) - center) / scale) ** 2)
            distance = math.sqrt(statistics.fmean(squared)) if squared else None
            group_distances[group] = round(distance, 6) if distance is not None else None
            all_squared.extend(squared)
    else:
        group_distances = {group: None for group in FEATURE_GROUPS}
    combined = math.sqrt(statistics.fmean(all_squared)) if all_squared else None
    return {
        "combined_proxy_distance": round(combined, 6) if combined is not None else None,
        "group_proxy_distances": group_distances,
        "provisional_threshold": threshold,
        "threshold_exceeded": combined is not None and combined > threshold,
        "distance_available": combined is not None,
        "distance_unavailable_reason": (
            None if combined is not None else "No compiled calibration baseline is available."
        ),
    }


class VoiceIdentityStore:
    """Store Speaker, Style, calibration, and compiled identity links separately."""

    def __init__(self, project_root: Path) -> None:
        self.project_root = project_root.resolve()
        self.root = self.project_root / "runtime" / "voice_identities"
        self.style_root = self.root / "styles"
        self.identity_root = self.root / "compiled"
        self.calibration_root = self.project_root / "runtime" / "voice_calibrations"
        self.speaker_root = self.project_root / "runtime" / "speaker_conditions"
        for root in (
            self.style_root,
            self.identity_root,
            self.calibration_root,
            self.speaker_root,
        ):
            root.mkdir(parents=True, exist_ok=True)

    def resources(self) -> dict[str, Any]:
        identities = []
        for path in sorted(self.identity_root.glob("*.json"), reverse=True):
            value = self._read_json(path)
            if not value:
                continue
            identities.append(self._identity_summary(value))
        calibrations = []
        for path in sorted(self.calibration_root.glob("*.json"), reverse=True):
            value = self._read_json(path)
            if not value or value.get("schema_version") != CALIBRATION_SCHEMA:
                continue
            calibrations.append(
                {
                    "id": value["id"],
                    "label": value["name"],
                    "wav_sha256": value["wav_sha256"],
                    "duration_seconds": value.get("acoustic_values", {}).get("duration_seconds"),
                    "f0_median_hz": value.get("acoustic_values", {}).get("f0_median_hz"),
                }
            )
        styles = []
        for path in sorted(self.style_root.glob("*.json"), reverse=True):
            value = self._read_json(path)
            if not value or value.get("schema_version") != STYLE_SCHEMA:
                continue
            anchor = value.get("voice_control_profile", {}).get("identity_anchor", {})
            styles.append(
                {
                    "id": value["id"],
                    "label": value.get("name") or value["id"],
                    "created_at": value.get("created_at"),
                    "f0_mean_hz": anchor.get("f0_mean_hz"),
                    "vocal_tract_length_scale": anchor.get("vocal_tract_length_scale"),
                    "caption_guidance_scale": value.get("caption_guidance_scale"),
                }
            )
        return {
            "schema_version": "cvd_voice_identity_resources_0.1",
            "standard_generation": {
                "num_inference_steps": 20,
                "candidate_count": 1,
                "automatic_retry": False,
                "evaluation_mode": "warning_only",
            },
            "identities": identities,
            "styles": styles,
            "calibrations": calibrations,
        }

    def store_calibration(self, filename: str, wav_bytes: bytes) -> dict[str, Any]:
        try:
            analysis = analyze_wav_bytes(wav_bytes)
        except (EvaluationError, ValueError, OSError) as error:
            raise VoiceIdentityError(f"Calibration WAV is invalid: {error}") from error
        digest = _sha256_bytes(wav_bytes)
        name = Path(filename).name or "calibration.wav"
        stem = _safe_name(Path(name).stem, "calibration")
        calibration_id = f"{digest[:12]}-{stem}"
        wav_path = self.calibration_root / f"{calibration_id}.wav"
        json_path = self.calibration_root / f"{calibration_id}.json"
        if not wav_path.exists():
            wav_path.write_bytes(wav_bytes)
        body = {
            "schema_version": CALIBRATION_SCHEMA,
            "id": calibration_id,
            "name": name,
            "created_at": _now(),
            "wav_file": wav_path.name,
            "wav_sha256": digest,
            "wav_bytes": len(wav_bytes),
            "analysis": strip_private_values(analysis),
            "acoustic_values": _compact_acoustic_values(analysis),
            "privacy": {
                "local_only": True,
                "external_transmission": False,
                "contains_audio": True,
            },
        }
        self._write_json(json_path, body)
        return {
            "id": calibration_id,
            "label": name,
            "wav_sha256": digest,
            "duration_seconds": body["acoustic_values"]["duration_seconds"],
            "f0_median_hz": body["acoustic_values"]["f0_median_hz"],
        }

    def calibration_audio_path(self, calibration_id: Any) -> Path:
        record = self._read_calibration(calibration_id)
        return (self.calibration_root / record["wav_file"]).resolve()

    def compile(self, payload: Mapping[str, Any]) -> dict[str, Any]:
        if not isinstance(payload, Mapping):
            raise VoiceIdentityError("Compile request must be an object.")
        name = _display_name(payload.get("name"), "voice_profile")
        name_slug = _safe_name(name, "voice-identity")
        model_id = str(payload.get("model") or "irodori-vdes")
        if not MODEL_ID_PATTERN.fullmatch(model_id):
            raise VoiceIdentityError("Model id is invalid.")
        requested_style_id = payload.get("style_id") or None
        if requested_style_id is not None:
            style_body = self._read_style(requested_style_id)
            profile = style_body["voice_control_profile"]
            caption = style_body["caption"]
            caption_guidance = style_body["caption_guidance_scale"]
            style_sha = style_body["sha256"]
            style_id = style_body["id"]
        else:
            profile = payload.get("style_profile")
            if not isinstance(profile, Mapping):
                raise VoiceIdentityError("style_profile is required.")
            caption = payload.get("caption")
            if not isinstance(caption, str) or len(caption) > 2000:
                raise VoiceIdentityError("caption must be text up to 2000 characters.")
            caption_guidance = _finite(payload.get("caption_guidance_scale", 2))
            if caption_guidance is None or not 0.5 <= caption_guidance <= 10:
                raise VoiceIdentityError("caption_guidance_scale must be between 0.5 and 10.")
            style_body = {
                "schema_version": STYLE_SCHEMA,
                "name": f"{name} Style",
                "created_at": _now(),
                "voice_control_profile": profile,
                "caption": caption.strip(),
                "caption_guidance_scale": caption_guidance,
            }
            style_sha = _sha256_bytes(_canonical_json(style_body))
            style_id = f"style-{style_sha[:16]}"
            self._write_json(
                self.style_root / f"{style_id}.json",
                {**style_body, "id": style_id, "sha256": style_sha},
            )

        model_metadata, model_contract = _model_contract(self.project_root, model_id)
        speaker_name = payload.get("speaker_condition") or None
        speaker = None
        if speaker_name is not None:
            if not isinstance(speaker_name, str) or not SPEAKER_NAME_PATTERN.fullmatch(speaker_name):
                raise VoiceIdentityError("Speaker condition filename is invalid.")
            speaker_path = (self.speaker_root / speaker_name).resolve()
            if speaker_path.parent != self.speaker_root.resolve() or not speaker_path.is_file():
                raise VoiceIdentityError("Managed speaker condition was not found.")
            try:
                artifact = inspect_embedding(speaker_path, model=model_contract)
            except SpeakerConditionError as error:
                raise VoiceIdentityError(f"Speaker condition could not be read: {error}") from error
            if not artifact["upstream_file_contract_compatible"]:
                raise VoiceIdentityError("Speaker condition file contract is incompatible.")
            if not artifact["target_model_contract_compatible"]:
                raise VoiceIdentityError("Speaker condition is incompatible with the model.")
            if artifact.get("sidecar", {}).get("provenance", {}).get("semantic_voice") is False:
                raise VoiceIdentityError("A non-semantic format fixture cannot be compiled for speech.")
            if artifact["model_binding_status"] in {"invalid", "incompatible"}:
                raise VoiceIdentityError("Speaker condition provenance is incompatible.")
            speaker = {
                "file": speaker_name,
                "sha256": artifact["sha256"],
                "state_f32le_sha256": artifact["state_f32le_sha256"],
                "shape": artifact["shape"],
                "model_binding_status": artifact["model_binding_status"],
                "file_contract_compatible": artifact["upstream_file_contract_compatible"],
                "model_contract_compatible": artifact["target_model_contract_compatible"],
            }

        calibration_ids = payload.get("calibration_ids", [])
        if not isinstance(calibration_ids, list) or len(calibration_ids) > MAX_CALIBRATIONS:
            raise VoiceIdentityError("calibration_ids must contain up to 16 entries.")
        calibration_records = [self._read_calibration(value) for value in calibration_ids]
        analyses = [record["analysis"] for record in calibration_records]
        baseline = build_calibration_baseline(analyses)

        created_at = _now()
        identity_id = (
            datetime.now().strftime("%Y%m%dT%H%M%S%f")
            + "-"
            + name_slug[:40]
            + "-"
            + style_sha[:8]
        )
        body = {
            "schema_version": COMPILED_IDENTITY_SCHEMA,
            "id": identity_id,
            "name": name,
            "created_at": created_at,
            "model": {
                "id": model_id,
                "metadata_available": model_metadata.get("metadata_available"),
                "config_sha256": model_metadata.get("model_config_sha256"),
                "speaker_dimension": model_metadata.get("architecture", {}).get("speaker_dim"),
            },
            "speaker": speaker,
            "style": {
                "id": style_id,
                "sha256": style_sha,
                "caption": style_body["caption"],
                "caption_guidance_scale": caption_guidance,
                "identity_anchor": profile.get("identity_anchor", {}),
            },
            "calibration": {
                "ids": [record["id"] for record in calibration_records],
                "sample_count": len(calibration_records),
                "baseline": baseline,
            },
            "standard_generation": {
                "num_inference_steps": 20,
                "candidate_count": 1,
                "automatic_retry": False,
                "max_retries": 0,
            },
            "evaluation_policy": {
                "mode": "warning_only",
                "automatic_retry": False,
                "provisional_distance_threshold": PROVISIONAL_DISTANCE_THRESHOLD,
                "threshold_reliability": (
                    baseline.get("threshold_status") if baseline else "unavailable_no_calibration"
                ),
            },
            "privacy": {
                "local_only": True,
                "external_transmission": False,
                "raw_speaker_tensor_exposed": False,
            },
        }
        self._write_json(self.identity_root / f"{identity_id}.json", body)
        return body

    def read(self, identity_id: str) -> dict[str, Any]:
        if not IDENTITY_ID_PATTERN.fullmatch(identity_id):
            raise VoiceIdentityError("Compiled identity id is invalid.")
        path = self.identity_root / f"{identity_id}.json"
        value = self._read_json(path)
        if not value or value.get("schema_version") != COMPILED_IDENTITY_SCHEMA:
            raise VoiceIdentityError("Compiled identity was not found.")
        return value

    def evaluate(self, wav_bytes: bytes, identity_id: str | None = None) -> dict[str, Any]:
        identity = self.read(identity_id) if identity_id else None
        target_f0 = (
            _finite(identity.get("style", {}).get("identity_anchor", {}).get("f0_mean_hz"))
            if identity
            else None
        )
        try:
            analysis = analyze_wav_bytes(wav_bytes, target_f0_hz=target_f0)
        except (EvaluationError, ValueError, OSError) as error:
            raise VoiceIdentityError(f"Generated WAV evaluation failed: {error}") from error
        baseline = identity.get("calibration", {}).get("baseline") if identity else None
        distance = evaluate_against_baseline(analysis, baseline)
        values = _compact_acoustic_values(analysis)
        warnings = list(analysis.get("waveform_quality", {}).get("warnings", []))
        if distance["threshold_exceeded"]:
            warnings.append("compiled_identity_proxy_distance_exceeds_provisional_threshold")
        target_error = _finite(values.get("target_error_semitones"))
        if target_error is not None and abs(target_error) > 1.5:
            warnings.append("f0_target_error_exceeds_1_5_semitones")
        result = {
            "schema_version": EVALUATION_SCHEMA,
            "evaluated_at": _now(),
            "identity_id": identity_id,
            "identity_name": identity.get("name") if identity else None,
            "mode": "warning_only",
            "automatic_retry_performed": False,
            "automatic_retry_enabled": False,
            "distance": distance,
            "acoustic_values": values,
            "warnings": sorted(set(warnings)),
            "status": "warning" if warnings else "within_provisional_range",
            "interpretation": {
                "speaker_identity_claim": False,
                "threshold_validated": False,
                "note": (
                    "Distances are lightweight within-character engineering proxies. "
                    "They are warning signals, not proof of speaker identity."
                ),
            },
        }
        return result

    def _read_calibration(self, calibration_id: Any) -> dict[str, Any]:
        if not isinstance(calibration_id, str) or not IDENTITY_ID_PATTERN.fullmatch(calibration_id):
            raise VoiceIdentityError("Calibration id is invalid.")
        value = self._read_json(self.calibration_root / f"{calibration_id}.json")
        if not value or value.get("schema_version") != CALIBRATION_SCHEMA:
            raise VoiceIdentityError(f"Calibration was not found: {calibration_id}")
        wav_file = value.get("wav_file")
        if not isinstance(wav_file, str) or Path(wav_file).name != wav_file:
            raise VoiceIdentityError(f"Calibration WAV path is invalid: {calibration_id}")
        wav_path = (self.calibration_root / wav_file).resolve()
        if wav_path.parent != self.calibration_root.resolve():
            raise VoiceIdentityError(f"Calibration WAV path is invalid: {calibration_id}")
        if not wav_path.is_file() or _sha256_bytes(wav_path.read_bytes()) != value.get("wav_sha256"):
            raise VoiceIdentityError(f"Calibration WAV integrity check failed: {calibration_id}")
        return value

    def _read_style(self, style_id: Any) -> dict[str, Any]:
        if not isinstance(style_id, str) or not IDENTITY_ID_PATTERN.fullmatch(style_id):
            raise VoiceIdentityError("Style id is invalid.")
        value = self._read_json(self.style_root / f"{style_id}.json")
        if not value or value.get("schema_version") != STYLE_SCHEMA:
            raise VoiceIdentityError(f"Style was not found: {style_id}")
        if (
            not isinstance(value.get("voice_control_profile"), Mapping)
            or not isinstance(value.get("caption"), str)
            or _finite(value.get("caption_guidance_scale")) is None
        ):
            raise VoiceIdentityError(f"Style is incomplete: {style_id}")
        if not isinstance(value.get("sha256"), str):
            legacy_body = {
                key: value[key]
                for key in (
                    "schema_version",
                    "created_at",
                    "voice_control_profile",
                    "caption",
                    "caption_guidance_scale",
                )
            }
            value["sha256"] = _sha256_bytes(_canonical_json(legacy_body))
        return value

    @staticmethod
    def _identity_summary(value: Mapping[str, Any]) -> dict[str, Any]:
        return {
            "id": value.get("id"),
            "label": value.get("name"),
            "created_at": value.get("created_at"),
            "model": value.get("model"),
            "speaker": value.get("speaker"),
            "style": value.get("style"),
            "calibration_sample_count": value.get("calibration", {}).get("sample_count", 0),
            "evaluation_policy": value.get("evaluation_policy"),
            "standard_generation": value.get("standard_generation"),
        }

    @staticmethod
    def _read_json(path: Path) -> dict[str, Any] | None:
        try:
            value = json.loads(path.read_text(encoding="utf-8-sig"))
        except (OSError, json.JSONDecodeError):
            return None
        return value if isinstance(value, dict) else None

    @staticmethod
    def _write_json(path: Path, value: Mapping[str, Any]) -> None:
        temporary = path.with_suffix(".tmp")
        temporary.write_text(
            json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False) + "\n",
            encoding="utf-8",
        )
        temporary.replace(path)

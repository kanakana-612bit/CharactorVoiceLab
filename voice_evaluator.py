#!/usr/bin/env python3
"""Local acoustic evaluator for CharacterVoiceDesigner generated speech.

The built-in metrics are engineering proxies. They do not identify a person and
must not be interpreted as clinical measurements or formal speaker embeddings.
"""

from __future__ import annotations

import csv
import hashlib
import io
import json
import math
import wave
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Mapping, Protocol, Sequence

import numpy as np


EVALUATION_SCHEMA_VERSION = "cvd_voice_evaluation_0.1"
ANALYSIS_SAMPLE_RATE = 16000
EPSILON = 1e-12


class EvaluationError(RuntimeError):
    """Raised when an input cannot be evaluated safely."""


@dataclass(frozen=True)
class AudioSignal:
    samples: np.ndarray
    sample_rate: int
    source_sample_rate: int
    channels: int
    sample_width_bytes: int


class SpeakerEmbeddingBackend(Protocol):
    """Optional independent speaker-embedding backend."""

    def metadata(self) -> Mapping[str, Any]:
        ...

    def embed(self, samples: np.ndarray, sample_rate: int) -> np.ndarray:
        ...


def _finite(value: float | int | np.number | None, digits: int = 8) -> float | None:
    if value is None:
        return None
    parsed = float(value)
    if not math.isfinite(parsed):
        return None
    return round(parsed, digits)


def _pcm_to_float(raw: bytes, sample_width: int) -> np.ndarray:
    if sample_width == 1:
        return (np.frombuffer(raw, dtype=np.uint8).astype(np.float64) - 128.0) / 128.0
    if sample_width == 2:
        return np.frombuffer(raw, dtype="<i2").astype(np.float64) / 32768.0
    if sample_width == 3:
        packed = np.frombuffer(raw, dtype=np.uint8)
        if packed.size % 3:
            raise EvaluationError("24-bit PCM payload has an invalid byte count.")
        triples = packed.reshape(-1, 3).astype(np.int32)
        values = triples[:, 0] | (triples[:, 1] << 8) | (triples[:, 2] << 16)
        values = np.where(values & 0x800000, values - 0x1000000, values)
        return values.astype(np.float64) / 8388608.0
    if sample_width == 4:
        return np.frombuffer(raw, dtype="<i4").astype(np.float64) / 2147483648.0
    raise EvaluationError(f"Unsupported PCM sample width: {sample_width} bytes.")


def _resample_linear(samples: np.ndarray, source_rate: int, target_rate: int) -> np.ndarray:
    if source_rate == target_rate or samples.size == 0:
        return samples.astype(np.float64, copy=True)
    target_size = max(1, int(round(samples.size * target_rate / source_rate)))
    source_axis = np.arange(samples.size, dtype=np.float64) / source_rate
    target_axis = np.arange(target_size, dtype=np.float64) / target_rate
    return np.interp(target_axis, source_axis, samples).astype(np.float64)


def load_wav_bytes(wav_bytes: bytes, analysis_rate: int = ANALYSIS_SAMPLE_RATE) -> AudioSignal:
    try:
        with wave.open(io.BytesIO(wav_bytes), "rb") as source:
            if source.getcomptype() != "NONE":
                raise EvaluationError("Only uncompressed PCM WAV files are supported.")
            channels = source.getnchannels()
            sample_width = source.getsampwidth()
            sample_rate = source.getframerate()
            frames = source.getnframes()
            raw = source.readframes(frames)
    except (EOFError, wave.Error) as error:
        raise EvaluationError(f"Invalid WAV input: {error}") from error
    if channels < 1 or sample_rate < 1000:
        raise EvaluationError("WAV channel count or sample rate is invalid.")
    decoded = _pcm_to_float(raw, sample_width)
    if decoded.size % channels:
        raise EvaluationError("PCM sample count is not divisible by channel count.")
    mono = decoded.reshape(-1, channels).mean(axis=1)
    return AudioSignal(
        samples=_resample_linear(mono, sample_rate, analysis_rate),
        sample_rate=analysis_rate,
        source_sample_rate=sample_rate,
        channels=channels,
        sample_width_bytes=sample_width,
    )


def load_wav(path: Path, analysis_rate: int = ANALYSIS_SAMPLE_RATE) -> AudioSignal:
    return load_wav_bytes(path.read_bytes(), analysis_rate)


def _frame_signal(samples: np.ndarray, frame_size: int, hop_size: int) -> np.ndarray:
    if samples.size == 0:
        return np.zeros((0, frame_size), dtype=np.float64)
    if samples.size < frame_size:
        samples = np.pad(samples, (0, frame_size - samples.size))
    frame_count = 1 + int(math.ceil((samples.size - frame_size) / hop_size))
    required = (frame_count - 1) * hop_size + frame_size
    if samples.size < required:
        samples = np.pad(samples, (0, required - samples.size))
    shape = (frame_count, frame_size)
    strides = (samples.strides[0] * hop_size, samples.strides[0])
    return np.lib.stride_tricks.as_strided(samples, shape=shape, strides=strides).copy()


def _f0_features(samples: np.ndarray, sample_rate: int) -> tuple[dict[str, Any], np.ndarray]:
    try:
        import pyworld
    except ImportError:
        return {
            "available": False,
            "method": "WORLD DIO + StoneMask",
            "reason": "pyworld is not installed",
        }, np.zeros(0, dtype=np.float64)
    if samples.size < int(sample_rate * 0.08):
        return {
            "available": False,
            "method": "WORLD DIO + StoneMask",
            "reason": "audio is too short",
        }, np.zeros(0, dtype=np.float64)
    signal = np.ascontiguousarray(samples, dtype=np.float64)
    f0, time_axis = pyworld.dio(
        signal,
        sample_rate,
        f0_floor=45.0,
        f0_ceil=700.0,
        frame_period=10.0,
    )
    refined = pyworld.stonemask(signal, f0, time_axis, sample_rate)
    voiced = refined[refined > 0]
    if voiced.size == 0:
        return {
            "available": True,
            "method": "WORLD DIO + StoneMask",
            "voiced_ratio": 0.0,
            "voiced_frames": 0,
        }, voiced
    x = np.arange(voiced.size, dtype=np.float64)
    slope = np.polyfit(x, voiced, 1)[0] if voiced.size > 2 else 0.0
    head = voiced[: max(1, voiced.size // 5)]
    tail = voiced[-max(1, voiced.size // 5) :]
    return {
        "available": True,
        "method": "WORLD DIO + StoneMask",
        "voiced_frames": int(voiced.size),
        "voiced_ratio": _finite(voiced.size / max(refined.size, 1)),
        "median_hz": _finite(np.median(voiced)),
        "mean_hz": _finite(np.mean(voiced)),
        "p10_hz": _finite(np.percentile(voiced, 10)),
        "p90_hz": _finite(np.percentile(voiced, 90)),
        "iqr_hz": _finite(np.percentile(voiced, 75) - np.percentile(voiced, 25)),
        "range_10_90_hz": _finite(np.percentile(voiced, 90) - np.percentile(voiced, 10)),
        "slope_hz_per_voiced_frame": _finite(slope),
        "final_delta_hz": _finite(np.median(tail) - np.median(head)),
    }, voiced


def _mel_filterbank(sample_rate: int, fft_size: int, filters: int = 26) -> np.ndarray:
    def hz_to_mel(value: np.ndarray | float) -> np.ndarray:
        return 2595.0 * np.log10(1.0 + np.asarray(value) / 700.0)

    def mel_to_hz(value: np.ndarray | float) -> np.ndarray:
        return 700.0 * (10.0 ** (np.asarray(value) / 2595.0) - 1.0)

    mel_points = np.linspace(hz_to_mel(40.0), hz_to_mel(sample_rate / 2), filters + 2)
    bins = np.floor((fft_size + 1) * mel_to_hz(mel_points) / sample_rate).astype(int)
    bins = np.clip(bins, 0, fft_size // 2)
    bank = np.zeros((filters, fft_size // 2 + 1), dtype=np.float64)
    for index in range(filters):
        left, center, right = bins[index : index + 3]
        if center <= left:
            center = min(left + 1, bank.shape[1] - 1)
        if right <= center:
            right = min(center + 1, bank.shape[1])
        if center > left:
            bank[index, left:center] = np.arange(center - left) / (center - left)
        if right > center:
            bank[index, center:right] = np.arange(right - center, 0, -1) / (right - center)
    return bank


def _spectral_features(frames: np.ndarray, sample_rate: int) -> dict[str, Any]:
    if frames.size == 0:
        return {}
    fft_size = frames.shape[1]
    spectrum = np.abs(np.fft.rfft(frames * np.hanning(fft_size), axis=1))
    power = spectrum**2 + EPSILON
    frequencies = np.fft.rfftfreq(fft_size, 1.0 / sample_rate)
    power_sum = power.sum(axis=1)
    centroid = (power * frequencies).sum(axis=1) / power_sum
    cumulative = np.cumsum(power, axis=1)
    rolloff_indices = np.argmax(cumulative >= 0.85 * cumulative[:, -1:], axis=1)
    rolloff = frequencies[rolloff_indices]
    flatness = np.exp(np.mean(np.log(power), axis=1)) / np.mean(power, axis=1)

    mean_power = power.mean(axis=0)
    positive = frequencies >= 80
    x = np.log2(np.maximum(frequencies[positive], 80.0) / 80.0)
    y = 10.0 * np.log10(mean_power[positive])
    tilt = np.polyfit(x, y, 1)[0] if x.size > 2 else 0.0

    total = float(mean_power.sum())
    bands: dict[str, float | None] = {}
    for name, low, high in (
        ("below_500_hz", 0, 500),
        ("500_2000_hz", 500, 2000),
        ("2000_4000_hz", 2000, 4000),
        ("above_4000_hz", 4000, sample_rate / 2 + 1),
    ):
        mask = (frequencies >= low) & (frequencies < high)
        bands[name] = _finite(mean_power[mask].sum() / max(total, EPSILON))

    bank = _mel_filterbank(sample_rate, fft_size)
    log_mel = np.log(np.maximum(power @ bank.T, EPSILON))
    indices = np.arange(bank.shape[0], dtype=np.float64)
    coefficients = np.arange(13, dtype=np.float64)[:, None]
    dct = np.cos(math.pi / bank.shape[0] * (indices + 0.5) * coefficients)
    cepstra = log_mel @ dct.T
    mfcc_mean = [_finite(value) for value in np.mean(cepstra, axis=0)]
    mfcc_std = [_finite(value) for value in np.std(cepstra, axis=0)]

    return {
        "centroid_median_hz": _finite(np.median(centroid)),
        "rolloff85_median_hz": _finite(np.median(rolloff)),
        "flatness_median": _finite(np.median(flatness)),
        "spectral_tilt_db_per_octave": _finite(tilt),
        "band_energy_ratios": bands,
        "mfcc_proxy_mean": mfcc_mean,
        "mfcc_proxy_std": mfcc_std,
    }


def _delivery_features(
    frames: np.ndarray,
    sample_rate: int,
    hop_size: int,
    duration: float,
    text: str | None,
) -> tuple[dict[str, Any], np.ndarray]:
    if frames.size == 0:
        return {}, np.zeros(0, dtype=np.float64)
    rms = np.sqrt(np.mean(frames**2, axis=1) + EPSILON)
    low_level = float(np.percentile(rms, 10))
    speech_level = float(np.percentile(rms, 90))
    threshold = max(0.002, min(speech_level * 0.35, low_level * 2.5))
    active = rms >= threshold
    active_indices = np.flatnonzero(active)
    utterance_mask = np.zeros_like(active)
    if active_indices.size:
        utterance_mask[active_indices[0] : active_indices[-1] + 1] = True
    pause = utterance_mask & ~active
    runs: list[int] = []
    current = 0
    for value in pause:
        if value:
            current += 1
        elif current:
            runs.append(current)
            current = 0
    if current:
        runs.append(current)
    pause_seconds = np.asarray(runs, dtype=np.float64) * hop_size / sample_rate
    active_rms = rms[active]
    if active_rms.size:
        x = np.arange(active_rms.size, dtype=np.float64)
        slope = np.polyfit(x, active_rms, 1)[0] if active_rms.size > 2 else 0.0
        chunk = max(1, active_rms.size // 5)
        final_delta = np.median(active_rms[-chunk:]) - np.median(active_rms[:chunk])
    else:
        slope = 0.0
        final_delta = 0.0
    result: dict[str, Any] = {
        "active_frame_ratio": _finite(active.mean()),
        "pause_ratio_inside_utterance": _finite(pause.sum() / max(utterance_mask.sum(), 1)),
        "pause_count": len(runs),
        "pause_mean_seconds": _finite(pause_seconds.mean()) if pause_seconds.size else 0.0,
        "pause_max_seconds": _finite(pause_seconds.max()) if pause_seconds.size else 0.0,
        "rms_median": _finite(np.median(active_rms)) if active_rms.size else 0.0,
        "rms_cv": _finite(np.std(active_rms) / max(np.mean(active_rms), EPSILON))
        if active_rms.size
        else 0.0,
        "rms_p10_p90_range": _finite(np.percentile(active_rms, 90) - np.percentile(active_rms, 10))
        if active_rms.size
        else 0.0,
        "rms_slope_per_active_frame": _finite(slope),
        "rms_final_delta": _finite(final_delta),
    }
    if text is not None and duration > 0:
        result["text_characters"] = len(text)
        result["characters_per_second"] = _finite(len(text) / duration)
    return result, rms


def _quality_features(samples: np.ndarray, sample_rate: int, frames: np.ndarray) -> dict[str, Any]:
    duration = samples.size / sample_rate
    peak = float(np.max(np.abs(samples))) if samples.size else 0.0
    rms = float(np.sqrt(np.mean(samples**2))) if samples.size else 0.0
    clipping = float(np.mean(np.abs(samples) >= 0.999)) if samples.size else 0.0
    dc_offset = float(np.mean(samples)) if samples.size else 0.0
    zcr = (
        float(np.mean(np.signbit(frames[:, 1:]) != np.signbit(frames[:, :-1])))
        if frames.shape[1] > 1
        else 0.0
    )
    differences = np.abs(np.diff(samples)) if samples.size > 1 else np.zeros(0)
    discontinuity = float(np.percentile(differences, 99.99)) if differences.size else 0.0
    warnings: list[str] = []
    if duration < 0.25:
        warnings.append("audio_too_short")
    if peak < 0.01:
        warnings.append("very_low_level")
    if clipping > 0.0001:
        warnings.append("possible_clipping")
    if abs(dc_offset) > 0.01:
        warnings.append("dc_offset")
    if discontinuity > 0.7:
        warnings.append("possible_discontinuity")
    return {
        "duration_seconds": _finite(duration),
        "peak_absolute": _finite(peak),
        "rms": _finite(rms),
        "clipping_ratio": _finite(clipping),
        "dc_offset": _finite(dc_offset),
        "zero_crossing_rate": _finite(zcr),
        "p9999_sample_delta": _finite(discontinuity),
        "warnings": warnings,
    }


def _embedding_digest(embedding: np.ndarray) -> str:
    normalized = np.asarray(embedding, dtype="<f4").reshape(-1)
    return hashlib.sha256(normalized.tobytes()).hexdigest()


def analyze_signal(
    signal: AudioSignal,
    *,
    text: str | None = None,
    target_f0_hz: float | None = None,
    speaker_backend: SpeakerEmbeddingBackend | None = None,
) -> dict[str, Any]:
    samples = np.nan_to_num(signal.samples.astype(np.float64), nan=0.0, posinf=1.0, neginf=-1.0)
    frame_size = int(round(signal.sample_rate * 0.04))
    hop_size = int(round(signal.sample_rate * 0.01))
    frames = _frame_signal(samples, frame_size, hop_size)
    f0, _ = _f0_features(samples, signal.sample_rate)
    delivery, _ = _delivery_features(
        frames, signal.sample_rate, hop_size, samples.size / signal.sample_rate, text
    )
    spectral = _spectral_features(frames, signal.sample_rate)
    quality = _quality_features(samples, signal.sample_rate, frames)
    if target_f0_hz is not None and f0.get("median_hz"):
        f0["target_hz"] = _finite(target_f0_hz)
        f0["target_error_hz"] = _finite(float(f0["median_hz"]) - target_f0_hz)
        f0["target_error_semitones"] = _finite(12.0 * math.log2(float(f0["median_hz"]) / target_f0_hz))
    result: dict[str, Any] = {
        "schema_version": EVALUATION_SCHEMA_VERSION,
        "analysis": {
            "sample_rate_hz": signal.sample_rate,
            "source_sample_rate_hz": signal.source_sample_rate,
            "source_channels": signal.channels,
            "source_sample_width_bytes": signal.sample_width_bytes,
        },
        "source_and_prosody": f0,
        "acoustic_timbre_proxy": spectral,
        "delivery_style": delivery,
        "waveform_quality": quality,
        "interpretation": {
            "speaker_identity_claim": False,
            "clinical_measurement_claim": False,
            "note": (
                "Built-in spectral and delivery metrics are engineering proxies for "
                "within-project comparison, not identity or clinical measurements."
            ),
        },
    }
    if speaker_backend is not None:
        embedding = np.asarray(
            speaker_backend.embed(samples.astype(np.float32), signal.sample_rate),
            dtype=np.float32,
        ).reshape(-1)
        if embedding.size == 0 or not np.all(np.isfinite(embedding)):
            raise EvaluationError("Speaker embedding backend returned an invalid vector.")
        result["independent_speaker_embedding"] = {
            "available": True,
            "dimension": int(embedding.size),
            "sha256": _embedding_digest(embedding),
            "backend": dict(speaker_backend.metadata()),
            "_embedding": embedding,
        }
    return result


def analyze_wav_bytes(
    wav_bytes: bytes,
    *,
    text: str | None = None,
    target_f0_hz: float | None = None,
    speaker_backend: SpeakerEmbeddingBackend | None = None,
) -> dict[str, Any]:
    return analyze_signal(
        load_wav_bytes(wav_bytes),
        text=text,
        target_f0_hz=target_f0_hz,
        speaker_backend=speaker_backend,
    )


def analyze_wav_path(
    path: Path,
    *,
    text: str | None = None,
    target_f0_hz: float | None = None,
    speaker_backend: SpeakerEmbeddingBackend | None = None,
) -> dict[str, Any]:
    result = analyze_signal(
        load_wav(path),
        text=text,
        target_f0_hz=target_f0_hz,
        speaker_backend=speaker_backend,
    )
    result["file"] = {
        "name": path.name,
        "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
        "bytes": path.stat().st_size,
    }
    return result


def _flatten_numeric(value: Any, prefix: str = "") -> dict[str, float]:
    result: dict[str, float] = {}
    if isinstance(value, Mapping):
        for key, item in value.items():
            if key.startswith("_"):
                continue
            child = f"{prefix}.{key}" if prefix else str(key)
            result.update(_flatten_numeric(item, child))
    elif isinstance(value, list):
        for index, item in enumerate(value):
            child = f"{prefix}.{index}" if prefix else str(index)
            result.update(_flatten_numeric(item, child))
    elif isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(float(value)):
        result[prefix] = float(value)
    return result


def feature_vector(record: Mapping[str, Any], group: str) -> dict[str, float]:
    allowed = {
        "source_and_prosody",
        "acoustic_timbre_proxy",
        "delivery_style",
        "waveform_quality",
    }
    if group not in allowed:
        raise ValueError(f"Unsupported feature group: {group}")
    values = _flatten_numeric(record.get(group, {}))
    excluded_suffixes = (
        "available",
        "voiced_frames",
        "text_characters",
        "pause_count",
        "duration_seconds",
        "target_hz",
        "target_error_hz",
        "target_error_semitones",
    )
    return {
        key: value
        for key, value in values.items()
        if not any(key.endswith(suffix) for suffix in excluded_suffixes)
    }


def robust_proxy_distances(
    records: Sequence[Mapping[str, Any]],
    groups: Sequence[str] = (
        "source_and_prosody",
        "acoustic_timbre_proxy",
        "delivery_style",
    ),
) -> list[list[float | None]]:
    if len(records) < 3:
        return [
            [0.0 if row == column else None for column in range(len(records))]
            for row in range(len(records))
        ]
    flattened = []
    for record in records:
        merged: dict[str, float] = {}
        for group in groups:
            for key, value in feature_vector(record, group).items():
                merged[f"{group}.{key}"] = value
        flattened.append(merged)
    keys = sorted(set.intersection(*(set(item) for item in flattened))) if flattened else []
    if not keys:
        return [[0.0 if row == column else None for column in range(len(records))] for row in range(len(records))]
    matrix = np.asarray([[item[key] for key in keys] for item in flattened], dtype=np.float64)
    center = np.median(matrix, axis=0)
    mad = np.median(np.abs(matrix - center), axis=0) * 1.4826
    standard = np.std(matrix, axis=0)
    scale = np.where(mad > 1e-9, mad, np.where(standard > 1e-9, standard, 1.0))
    standardized = (matrix - center) / scale
    distances = np.sqrt(
        np.mean((standardized[:, None, :] - standardized[None, :, :]) ** 2, axis=2)
    )
    return [[_finite(value) for value in row] for row in distances]


def cosine_similarity(left: np.ndarray, right: np.ndarray) -> float | None:
    left = np.asarray(left, dtype=np.float64).reshape(-1)
    right = np.asarray(right, dtype=np.float64).reshape(-1)
    if left.size != right.size or left.size == 0:
        return None
    denominator = float(np.linalg.norm(left) * np.linalg.norm(right))
    return _finite(float(np.dot(left, right)) / denominator) if denominator > EPSILON else None


def strip_private_values(value: Any) -> Any:
    if isinstance(value, Mapping):
        return {
            key: strip_private_values(item)
            for key, item in value.items()
            if not str(key).startswith("_")
        }
    if isinstance(value, list):
        return [strip_private_values(item) for item in value]
    if isinstance(value, np.generic):
        return value.item()
    return value


class SpeechBrainEcapaBackend:
    """Explicit opt-in ECAPA adapter. No package or model is downloaded automatically."""

    def __init__(self, model_source: str, *, allow_download: bool = False) -> None:
        source_path = Path(model_source).expanduser()
        if not allow_download and not source_path.is_dir():
            raise EvaluationError(
                "SpeechBrain ECAPA requires a local model directory unless "
                "--allow-model-download is explicitly supplied."
            )
        try:
            import torch
            from speechbrain.inference.speaker import EncoderClassifier
        except ImportError as error:
            raise EvaluationError(
                "Optional SpeechBrain ECAPA dependencies are not installed. "
                "The evaluator will not install them automatically."
            ) from error
        self._torch = torch
        self._model_source = str(source_path.resolve()) if source_path.is_dir() else model_source
        self._classifier = EncoderClassifier.from_hparams(
            source=self._model_source,
            run_opts={"device": "cpu"},
        )

    def metadata(self) -> Mapping[str, Any]:
        return {
            "id": "speechbrain-ecapa-voxceleb",
            "source": self._model_source,
            "license": "Apache-2.0",
            "training_corpus": "VoxCeleb",
            "real_person_training_data": True,
            "ethics_review_required": True,
            "bundled": False,
            "automatic_download": False,
        }

    def embed(self, samples: np.ndarray, sample_rate: int) -> np.ndarray:
        if sample_rate != ANALYSIS_SAMPLE_RATE:
            samples = _resample_linear(samples, sample_rate, ANALYSIS_SAMPLE_RATE)
        waveform = self._torch.tensor(samples, dtype=self._torch.float32).unsqueeze(0)
        with self._torch.no_grad():
            encoded = self._classifier.encode_batch(waveform)
        return encoded.detach().cpu().numpy().reshape(-1)


def write_feature_csv(records: Sequence[Mapping[str, Any]], path: Path) -> None:
    rows: list[dict[str, Any]] = []
    for index, record in enumerate(records):
        row: dict[str, Any] = {"index": index, "file": record.get("file", {}).get("name", "")}
        for group in (
            "source_and_prosody",
            "acoustic_timbre_proxy",
            "delivery_style",
            "waveform_quality",
        ):
            row.update({f"{group}.{key}": value for key, value in _flatten_numeric(record.get(group, {})).items()})
        rows.append(row)
    fields = sorted(set().union(*(row.keys() for row in rows))) if rows else ["index", "file"]
    with path.open("w", encoding="utf-8-sig", newline="") as destination:
        writer = csv.DictWriter(destination, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)


def write_json(value: Mapping[str, Any], path: Path) -> None:
    path.write_text(
        json.dumps(strip_private_values(value), ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

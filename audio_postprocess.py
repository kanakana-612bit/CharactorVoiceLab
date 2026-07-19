"""Local, optional post-processing for CharacterVoiceDesigner TTS output."""

from __future__ import annotations

import importlib
import io
import json
import math
import platform
import sys
import wave
from collections.abc import Callable
from typing import Any

np: Any = None
parselmouth: Any = None
pyworld: Any = None
praat_call: Any = None
_DEPENDENCY_ERRORS: dict[str, str] = {}


class AudioPostprocessError(ValueError):
    """Raised when a requested audio correction cannot be completed."""


def _load_dependency(name: str, loader: Callable[[], Any]) -> Any:
    try:
        dependency = loader()
    except Exception as error:  # Binary wheels can fail with ImportError or OSError.
        detail = str(error).strip() or "no diagnostic was provided"
        _DEPENDENCY_ERRORS[name] = f"{type(error).__name__}: {detail}"
        return None
    _DEPENDENCY_ERRORS.pop(name, None)
    return dependency


def _load_optional_dependencies() -> None:
    """Retry optional imports so a running WebUI sees dependencies installed later."""

    global np, parselmouth, pyworld, praat_call
    if np is None:
        np = _load_dependency("numpy", lambda: importlib.import_module("numpy"))
    if pyworld is None:
        pyworld = _load_dependency("pyworld", lambda: importlib.import_module("pyworld"))
    if parselmouth is None:
        parselmouth = _load_dependency(
            "praat-parselmouth",
            lambda: importlib.import_module("parselmouth"),
        )
    if parselmouth is not None and praat_call is None:
        praat_call = _load_dependency(
            "praat-parselmouth.praat",
            lambda: getattr(importlib.import_module("parselmouth.praat"), "call"),
        )


def postprocess_dependency_status() -> dict[str, dict[str, bool | str | None]]:
    _load_optional_dependencies()
    dependencies = {
        "numpy": np,
        "pyworld": pyworld,
        "praat-parselmouth": parselmouth,
        "praat-parselmouth.praat": praat_call,
    }
    return {
        name: {
            "available": dependency is not None,
            "error": _DEPENDENCY_ERRORS.get(name),
        }
        for name, dependency in dependencies.items()
    }


def world_available() -> bool:
    _load_optional_dependencies()
    return np is not None and pyworld is not None


def psola_available() -> bool:
    _load_optional_dependencies()
    return np is not None and pyworld is not None and parselmouth is not None and praat_call is not None


def psola_unavailable_message() -> str:
    status = postprocess_dependency_status()
    failures = []
    for name, dependency in status.items():
        if not dependency["available"]:
            detail = dependency["error"] or "not installed"
            failures.append(f"{name}: {detail}")
    command = ".\\webui.bat" if platform.system() == "Windows" else "./webui.sh"
    diagnostic = "; ".join(failures) or "dependency state is inconsistent"
    return (
        f"PSOLA F0 correction is unavailable ({diagnostic}). "
        f"Stop the local services, then re-run {command} to repair and restart them."
    )


def _decode_pcm16_mono(wav_bytes: bytes) -> tuple[Any, int]:
    try:
        with wave.open(io.BytesIO(wav_bytes), "rb") as source:
            if source.getcomptype() != "NONE" or source.getsampwidth() != 2:
                raise AudioPostprocessError("F0 correction requires uncompressed PCM16 WAV output.")
            channels = source.getnchannels()
            sample_rate = source.getframerate()
            frames = source.readframes(source.getnframes())
    except (wave.Error, EOFError) as error:
        raise AudioPostprocessError("audio.cpp returned an invalid WAV file.") from error

    if channels < 1 or sample_rate < 8000:
        raise AudioPostprocessError("F0 correction received unsupported WAV metadata.")
    samples = np.frombuffer(frames, dtype="<i2").astype(np.float64) / 32768.0
    if channels > 1:
        samples = samples.reshape(-1, channels).mean(axis=1)
    if samples.size < sample_rate // 5:
        raise AudioPostprocessError("F0 correction requires at least 200 ms of audio.")
    return samples, sample_rate


def _analyze_f0(samples: Any, sample_rate: int) -> tuple[Any, Any, float]:
    f0, time_axis = pyworld.dio(
        samples,
        sample_rate,
        f0_floor=60.0,
        f0_ceil=700.0,
        frame_period=5.0,
    )
    f0 = pyworld.stonemask(samples, f0, time_axis, sample_rate)
    voiced = f0[f0 > 0.0]
    if voiced.size < 12:
        raise AudioPostprocessError("A stable voiced interval was not found for F0 correction.")
    return f0, time_axis, float(np.median(voiced))


def _encode_pcm16_mono(samples: Any, sample_rate: int) -> bytes:
    peak = float(np.max(np.abs(samples))) if samples.size else 0.0
    if peak > 0.98:
        samples = samples * (0.98 / peak)
    pcm = np.round(np.clip(samples, -1.0, 1.0) * 32767.0).astype("<i2")
    output = io.BytesIO()
    with wave.open(output, "wb") as target:
        target.setnchannels(1)
        target.setsampwidth(2)
        target.setframerate(sample_rate)
        target.writeframes(pcm.tobytes())
    return output.getvalue()


def correct_wav_f0(
    wav_bytes: bytes,
    target_hz: float,
    strength: float = 1.0,
) -> tuple[bytes, dict[str, float | str]]:
    """Move median voiced F0 to target_hz while retaining its relative contour."""

    if not psola_available():
        raise AudioPostprocessError(psola_unavailable_message())
    if not 60.0 <= target_hz <= 500.0:
        raise AudioPostprocessError("F0 target must be between 60 and 500 Hz.")
    if not 0.0 <= strength <= 1.0:
        raise AudioPostprocessError("F0 correction strength must be between 0 and 1.")

    samples, sample_rate = _decode_pcm16_mono(wav_bytes)
    f0, time_axis, measured_hz = _analyze_f0(samples, sample_rate)
    requested_semitones = 12.0 * math.log2(target_hz / measured_hz)
    applied_semitones = max(-12.0, min(12.0, requested_semitones * strength))
    ratio = 2.0 ** (applied_semitones / 12.0)
    sound = parselmouth.Sound(samples, sampling_frequency=sample_rate)
    manipulation = praat_call(sound, "To Manipulation", 0.01, 60.0, 700.0)
    pitch_tier = praat_call(manipulation, "Extract pitch tier")
    praat_call(pitch_tier, "Multiply frequencies", sound.xmin, sound.xmax, ratio)
    praat_call([pitch_tier, manipulation], "Replace pitch tier")
    resynthesis = praat_call(manipulation, "Get resynthesis (overlap-add)")
    corrected = np.asarray(resynthesis.values[0], dtype=np.float64)
    if corrected.size < samples.size:
        corrected = np.pad(corrected, (0, samples.size - corrected.size))
    corrected = corrected[: samples.size]

    original_rms = float(np.sqrt(np.mean(samples * samples)))
    corrected_rms = float(np.sqrt(np.mean(corrected * corrected)))
    if original_rms > 1e-8 and corrected_rms > 1e-8:
        corrected *= min(2.0, original_rms / corrected_rms)

    output_bytes = _encode_pcm16_mono(corrected, sample_rate)
    output_samples, _ = _decode_pcm16_mono(output_bytes)
    _, _, output_hz = _analyze_f0(output_samples, sample_rate)
    metadata: dict[str, float | str] = {
        "schema_version": "praat_psola_f0_correction_0.1",
        "method": "praat_psola_with_world_f0_measurement",
        "measured_hz": round(measured_hz, 3),
        "target_hz": round(target_hz, 3),
        "output_hz": round(output_hz, 3),
        "strength": round(strength, 4),
        "applied_semitones": round(applied_semitones, 4),
    }
    return output_bytes, metadata


def _dependency_check() -> int:
    status = postprocess_dependency_status()
    print(json.dumps(status, ensure_ascii=False, indent=2))
    if not psola_available():
        print(psola_unavailable_message(), file=sys.stderr)
        return 1
    print("PSOLA F0 correction dependencies are available.")
    return 0


if __name__ == "__main__":
    if sys.argv[1:] != ["--check"]:
        print("Usage: python audio_postprocess.py --check", file=sys.stderr)
        raise SystemExit(2)
    raise SystemExit(_dependency_check())

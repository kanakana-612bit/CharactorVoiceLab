import io
import json
import math
import sys
import unittest
import wave
from pathlib import Path

import numpy as np


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from voice_evaluator import (  # noqa: E402
    EvaluationError,
    SpeechBrainEcapaBackend,
    analyze_wav_bytes,
    robust_proxy_distances,
    strip_private_values,
)


def harmonic_wav(
    f0_hz: float,
    *,
    duration: float = 0.8,
    sample_rate: int = 44100,
    amplitude: float = 0.35,
    clipped: bool = False,
) -> bytes:
    time = np.arange(int(duration * sample_rate), dtype=np.float64) / sample_rate
    signal = np.zeros_like(time)
    for harmonic in range(1, 8):
        signal += (1.0 / harmonic) * np.sin(2.0 * math.pi * f0_hz * harmonic * time)
    signal *= amplitude / max(np.max(np.abs(signal)), 1e-9)
    fade = min(int(0.02 * sample_rate), signal.size // 4)
    if fade:
        envelope = np.ones_like(signal)
        envelope[:fade] = np.linspace(0.0, 1.0, fade)
        envelope[-fade:] = np.linspace(1.0, 0.0, fade)
        signal *= envelope
    if clipped:
        signal = np.clip(signal * 5.0, -1.0, 1.0)
    pcm = np.clip(np.round(signal * 32767.0), -32768, 32767).astype("<i2")
    output = io.BytesIO()
    with wave.open(output, "wb") as destination:
        destination.setnchannels(1)
        destination.setsampwidth(2)
        destination.setframerate(sample_rate)
        destination.writeframes(pcm.tobytes())
    return output.getvalue()


def two_phrase_wav(sample_rate: int = 44100) -> bytes:
    phrase_time = np.arange(int(0.3 * sample_rate), dtype=np.float64) / sample_rate
    phrase = 0.25 * np.sin(2.0 * math.pi * 220.0 * phrase_time)
    silence = np.zeros(int(0.2 * sample_rate), dtype=np.float64)
    signal = np.concatenate((phrase, silence, phrase))
    pcm = np.round(signal * 32767.0).astype("<i2")
    output = io.BytesIO()
    with wave.open(output, "wb") as destination:
        destination.setnchannels(1)
        destination.setsampwidth(2)
        destination.setframerate(sample_rate)
        destination.writeframes(pcm.tobytes())
    return output.getvalue()


def assert_finite_json(test: unittest.TestCase, value: object) -> None:
    encoded = json.dumps(strip_private_values(value), allow_nan=False)
    test.assertNotIn("NaN", encoded)
    test.assertNotIn("Infinity", encoded)


class VoiceEvaluatorTest(unittest.TestCase):
    def test_world_f0_separates_two_harmonic_sources(self) -> None:
        low = analyze_wav_bytes(harmonic_wav(220.0), target_f0_hz=220.0)
        high = analyze_wav_bytes(harmonic_wav(330.0), target_f0_hz=330.0)
        if not low["source_and_prosody"]["available"]:
            self.skipTest("pyworld is unavailable in this environment")
        self.assertAlmostEqual(low["source_and_prosody"]["median_hz"], 220.0, delta=5.0)
        self.assertAlmostEqual(high["source_and_prosody"]["median_hz"], 330.0, delta=5.0)
        self.assertGreater(
            high["source_and_prosody"]["median_hz"],
            low["source_and_prosody"]["median_hz"] + 90.0,
        )
        assert_finite_json(self, low)
        assert_finite_json(self, high)

    def test_quality_flags_clipped_audio(self) -> None:
        record = analyze_wav_bytes(harmonic_wav(220.0, clipped=True))
        self.assertGreater(record["waveform_quality"]["clipping_ratio"], 0.01)
        self.assertIn("possible_clipping", record["waveform_quality"]["warnings"])

    def test_delivery_detects_internal_pause(self) -> None:
        record = analyze_wav_bytes(two_phrase_wav())
        delivery = record["delivery_style"]
        self.assertGreaterEqual(delivery["pause_count"], 1)
        self.assertGreater(delivery["pause_ratio_inside_utterance"], 0.1)
        self.assertGreater(delivery["pause_max_seconds"], 0.1)

    def test_proxy_distance_is_zero_for_identity_and_positive_for_change(self) -> None:
        first = analyze_wav_bytes(harmonic_wav(180.0))
        same = analyze_wav_bytes(harmonic_wav(180.0))
        changed = analyze_wav_bytes(harmonic_wav(360.0))
        distances = robust_proxy_distances([first, same, changed])
        self.assertEqual(distances[0][0], 0.0)
        self.assertEqual(distances[0][1], 0.0)
        self.assertGreater(distances[0][2], 0.0)

    def test_proxy_distance_requires_three_records_for_scale_context(self) -> None:
        first = analyze_wav_bytes(harmonic_wav(180.0))
        changed = analyze_wav_bytes(harmonic_wav(360.0))
        distances = robust_proxy_distances([first, changed])
        self.assertIsNone(distances[0][1])

    def test_result_keeps_identity_and_clinical_claims_disabled(self) -> None:
        record = analyze_wav_bytes(harmonic_wav(240.0), text="短い評価文です。")
        self.assertFalse(record["interpretation"]["speaker_identity_claim"])
        self.assertFalse(record["interpretation"]["clinical_measurement_claim"])
        self.assertEqual(record["delivery_style"]["text_characters"], 8)

    def test_optional_speaker_backend_does_not_download_by_default(self) -> None:
        with self.assertRaises(EvaluationError):
            SpeechBrainEcapaBackend("speechbrain/spkrec-ecapa-voxceleb")


if __name__ == "__main__":
    unittest.main()

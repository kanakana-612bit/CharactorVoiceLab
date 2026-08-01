import io
import math
import shutil
import struct
import unittest
import uuid
import wave
from pathlib import Path

from voice_identity import VoiceIdentityStore


ROOT = Path(__file__).resolve().parents[1]


def sine_wav(frequency=180.0, seconds=0.6, sample_rate=16000):
    samples = int(seconds * sample_rate)
    stream = io.BytesIO()
    with wave.open(stream, "wb") as target:
        target.setnchannels(1)
        target.setsampwidth(2)
        target.setframerate(sample_rate)
        target.writeframes(
            b"".join(
                struct.pack(
                    "<h",
                    int(10000 * math.sin(2 * math.pi * frequency * index / sample_rate)),
                )
                for index in range(samples)
            )
        )
    return stream.getvalue()


class VoiceIdentityStoreTest(unittest.TestCase):
    def setUp(self):
        self.root = ROOT / "tests" / f"_voice_identity_project_{uuid.uuid4().hex}"
        self.root.mkdir(parents=True)
        self.store = VoiceIdentityStore(self.root)

    def tearDown(self):
        shutil.rmtree(self.root, ignore_errors=True)

    def test_components_are_separate_and_generation_policy_is_warning_only(self):
        calibration_ids = [
            self.store.store_calibration(f"calibration-{index}.wav", sine_wav(180 + index))["id"]
            for index in range(3)
        ]
        identity = self.store.compile(
            {
                "name": "character-a",
                "model": "irodori-vdes",
                "style_profile": {
                    "identity_anchor": {"f0_mean_hz": 181},
                },
                "caption": "natural Japanese voice",
                "caption_guidance_scale": 2,
                "calibration_ids": calibration_ids,
            }
        )
        self.assertIsNone(identity["speaker"])
        self.assertEqual(identity["calibration"]["sample_count"], 3)
        self.assertFalse(identity["standard_generation"]["automatic_retry"])
        self.assertTrue(
            (self.store.style_root / f"{identity['style']['id']}.json").is_file()
        )
        self.assertTrue(
            (self.store.identity_root / f"{identity['id']}.json").is_file()
        )
        reused = self.store.compile(
            {
                "name": "キャラクターA",
                "model": "irodori-vdes",
                "style_id": identity["style"]["id"],
                "style_profile": {"identity_anchor": {"f0_mean_hz": 999}},
                "caption": "ignored when an existing style is selected",
                "caption_guidance_scale": 9,
                "calibration_ids": calibration_ids,
            }
        )
        self.assertEqual(reused["name"], "キャラクターA")
        self.assertEqual(reused["style"]["id"], identity["style"]["id"])
        self.assertEqual(reused["style"]["identity_anchor"]["f0_mean_hz"], 181)

        evaluation = self.store.evaluate(sine_wav(182), identity["id"])
        self.assertEqual(evaluation["mode"], "warning_only")
        self.assertFalse(evaluation["automatic_retry_performed"])
        self.assertTrue(evaluation["distance"]["distance_available"])
        self.assertFalse(evaluation["interpretation"]["speaker_identity_claim"])

    def test_resources_publish_fixed_standard_generation(self):
        policy = self.store.resources()["standard_generation"]
        self.assertEqual(policy["num_inference_steps"], 20)
        self.assertEqual(policy["candidate_count"], 1)
        self.assertFalse(policy["automatic_retry"])

    def test_calibration_audio_can_be_resolved_for_local_preview(self):
        calibration = self.store.store_calibration("preview.wav", sine_wav())
        path = self.store.calibration_audio_path(calibration["id"])
        self.assertTrue(path.is_file())
        self.assertEqual(path.read_bytes(), sine_wav())


if __name__ == "__main__":
    unittest.main()

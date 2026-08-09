import io
import json
import pathlib
import shutil
import struct
import unittest
import uuid
import wave

from generated_output_store import GeneratedOutputStore


ROOT = pathlib.Path(__file__).resolve().parents[1]


def sine_wav() -> bytes:
    stream = io.BytesIO()
    sample_rate = 16000
    with wave.open(stream, "wb") as target:
        target.setnchannels(1)
        target.setsampwidth(2)
        target.setframerate(sample_rate)
        target.writeframes(b"".join(struct.pack("<h", 1000) for _ in range(sample_rate // 5)))
    return stream.getvalue()


class GeneratedOutputStoreTest(unittest.TestCase):
    def setUp(self):
        self.root = ROOT / "tests" / f"_generated_outputs_{uuid.uuid4().hex}"
        self.store = GeneratedOutputStore(self.root)

    def tearDown(self):
        shutil.rmtree(self.root, ignore_errors=True)

    def test_archives_sequential_wav_and_json_pairs_by_local_date(self):
        request = {
            "model": "irodori-vdes",
            "input": "読み上げ文",
            "language": "ja",
            "seed": 123,
            "num_inference_steps": 20,
            "options": {
                "caption": "落ち着いた声",
                "caption_guidance_scale": 2,
                "duration_scale": 1.1,
                "trim_tail": True,
            },
        }
        common = {
            "wav_bytes": sine_wav(),
            "request": request,
            "capture": {
                "app_version": "0.2",
                "profile_name": "voice_profile",
                "speaking_rate": 0.9,
                "f0_target_hz": 180,
                "output_sample_rate_hz": 44100,
                "generation_mode": "standard_single",
                "runtime": {"device_id": "cuda:1", "vram_limit_mib": 14336},
            },
            "postprocess": {"target_hz": 180, "strength": 1, "output_sample_rate_hz": 44100},
            "correction_metadata": {"output_hz": 180},
            "identity": {"id": "sample-id", "name": "試験話者"},
            "evaluation": {"status": "within_provisional_range", "warnings": []},
            "speaker_condition": None,
            "observation_id": "observation-1",
            "upstream_seconds": 1.25,
            "postprocess_seconds": 0.05,
            "upstream_headers": {},
        }
        first = self.store.archive(**common)
        second = self.store.archive(**common)
        self.assertRegex(first["wav"].name, r"^001-試験話者-123\.wav$")
        self.assertRegex(second["wav"].name, r"^002-試験話者-123\.wav$")
        self.assertTrue(first["metadata"].is_file())
        metadata = json.loads(first["metadata"].read_text(encoding="utf-8"))
        self.assertEqual(metadata["audio"]["duration_seconds"], 0.2)
        self.assertEqual(metadata["generation"]["spoken_text"], "読み上げ文")
        self.assertEqual(metadata["identity"]["name"], "試験話者")
        self.assertEqual(metadata["compute_runtime"]["device_id"], "cuda:1")
        self.assertEqual(metadata["model"]["runtime_kind"], "audio_cpp")
        self.assertEqual(
            metadata["model"]["runtime"]["release"],
            "release-0.3-qwen3-tts",
        )
        self.assertRegex(
            metadata["backend_control_plan"]["matched_condition_sha256"],
            r"^[a-f0-9]{64}$",
        )
        self.assertEqual(metadata["compute_runtime"]["vram_limit_mib"], 14336)
        self.assertEqual(metadata["profile"]["output_sample_rate_hz"], 44100)
        self.assertEqual(metadata["postprocess"]["sample_rate"]["requested_hz"], 44100)
        self.assertTrue(metadata["privacy"]["stored_on_user_pc_only"])


if __name__ == "__main__":
    unittest.main()

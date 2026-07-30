import json
import pathlib
import unittest
import uuid


ROOT = pathlib.Path(__file__).resolve().parents[1]

import sys

sys.path.insert(0, str(ROOT))

from experiment_jobs import ExperimentError, ExperimentJobManager


class ExperimentJobManagerTest(unittest.TestCase):
    def setUp(self):
        self.root = ROOT / "tests" / f"_experiment_project_{uuid.uuid4().hex}"
        self.root.mkdir(parents=True)
        self.manager = ExperimentJobManager(
            self.root,
            bridge_base_url="http://127.0.0.1:8766",
            audio_cpp_base_url="http://127.0.0.1:8080",
            python_executable="python-test",
        )

    def tearDown(self):
        self.manager.shutdown()
        import shutil

        shutil.rmtree(self.root, ignore_errors=True)

    def test_catalog_is_local_and_allowlisted(self):
        catalog = self.manager.catalog()
        self.assertTrue(catalog["local_only"])
        self.assertEqual(catalog["max_parallel_jobs"], 1)
        self.assertEqual(
            {tool["id"] for tool in catalog["tools"]},
            {
                "runtime_observation",
                "speaker_compatibility",
                "seed_f0",
                "voice_evaluation",
                "runtime_diagnostics",
            },
        )

    def test_upload_validation_and_resource_resolution(self):
        wav = b"RIFF" + (4).to_bytes(4, "little") + b"WAVE"
        resource = self.manager.store_upload("wav", "../voice.wav", wav)
        self.assertTrue(resource["id"].startswith("upload-wav:wav/"))
        resources = self.manager.resources()
        self.assertIn(resource["id"], {item["id"] for item in resources["voice_inputs"]})

        with self.assertRaises(ExperimentError):
            self.manager.store_upload("wav", "not-wav.wav", b"not audio")
        with self.assertRaises(ExperimentError):
            self.manager.store_upload("profile", "profile.json", b"{broken")

    def test_voice_evaluation_accepts_only_managed_resources(self):
        wav = b"RIFF" + (4).to_bytes(4, "little") + b"WAVE"
        resource = self.manager.store_upload("wav", "candidate.wav", wav)
        command, output, safe = self.manager._build_command(
            "20260730T120000-1234abcd",
            "voice_evaluation",
            {"inputs": [resource["id"]], "references": [], "target_f0": 180},
        )
        self.assertIn(str((self.root / "evaluate_voice.py").resolve()), command)
        self.assertIn("--speaker-backend", command)
        self.assertIn("none", command)
        self.assertEqual(safe["target_f0"], 180)
        self.assertTrue(str(output).startswith(str(self.root)))

        with self.assertRaises(ExperimentError):
            self.manager._build_command(
                "20260730T120000-1234abcd",
                "voice_evaluation",
                {"inputs": ["upload-wav:../../private.wav"]},
            )

    def test_current_profile_json_can_be_registered_for_benchmark(self):
        profile = self.manager.store_upload(
            "profile",
            "voice_profile.json",
            json.dumps({"schema_version": "character_voice_identity_function_0.1"}).encode(),
        )
        command, _, safe = self.manager._build_command(
            "20260730T120000-1234abcd",
            "seed_f0",
            {
                "profile_id": profile["id"],
                "samples": 2,
                "seed_start": 1,
                "low_steps": 4,
                "final_steps": 5,
                "analysis_seconds": 3,
                "target_f0": 180,
                "text": "test",
                "caption": "voice",
                "model": "irodori-vdes",
                "caption_guidance": 2,
                "duration_scale": 1,
            },
        )
        self.assertIn("--profile", command)
        self.assertEqual(safe["profile_id"], profile["id"])


if __name__ == "__main__":
    unittest.main()

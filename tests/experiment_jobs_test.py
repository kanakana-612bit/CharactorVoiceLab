import json
import pathlib
import unittest
import uuid
from unittest import mock

import torch
from safetensors.torch import save_file


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
                "step_stability",
                "voice_evaluation",
                "runtime_diagnostics",
                "speaker_inversion_setup",
                "speaker_inversion_train",
                "speaker_inversion_generate",
            },
        )

    def test_upload_validation_and_resource_resolution(self):
        wav = b"RIFF" + (4).to_bytes(4, "little") + b"WAVE"
        resource = self.manager.store_upload("wav", "../voice.wav", wav)
        self.assertTrue(resource["id"].startswith("upload-wav:wav/"))
        path = self.manager._resolve_voice_resource(resource["id"])
        resources = self.manager.resources()
        self.assertIn(resource["id"], {item["id"] for item in resources["voice_inputs"]})
        self.assertEqual(self.manager.voice_preview_path(resource["id"]), path)

        with self.assertRaises(ExperimentError):
            self.manager.store_upload("wav", "not-wav.wav", b"not audio")
        with self.assertRaises(ExperimentError):
            self.manager.store_upload("profile", "profile.json", b"{broken")

    def test_voice_input_can_be_hidden_without_deleting_source(self):
        wav = b"RIFF" + (4).to_bytes(4, "little") + b"WAVE"
        resource = self.manager.store_upload("wav", "candidate.wav", wav)
        path = self.manager._resolve_voice_resource(resource["id"])
        self.manager.exclude_voice_input(resource["id"])
        resources = self.manager.resources()
        self.assertNotIn(resource["id"], {item["id"] for item in resources["voice_inputs"]})
        self.assertEqual(resources["excluded_voice_input_count"], 1)
        self.assertTrue(path.is_file())

        restored = self.manager.restore_voice_inputs()
        self.assertEqual(restored["restored"], 1)
        resources = self.manager.resources()
        self.assertIn(resource["id"], {item["id"] for item in resources["voice_inputs"]})

    def test_reference_upload_is_ephemeral_and_not_listed_as_candidate(self):
        wav = b"RIFF" + (4).to_bytes(4, "little") + b"WAVE"
        resource = self.manager.store_upload("reference-wav", "reference.wav", wav)
        self.assertTrue(resource["id"].startswith("upload-reference-wav:"))
        self.assertNotIn(
            resource["id"],
            {item["id"] for item in self.manager.resources()["voice_inputs"]},
        )
        command, _, safe = self.manager._build_command(
            "20260801T120000-1234abcd",
            "voice_evaluation",
            {
                "inputs": [self.manager.store_upload("wav", "candidate.wav", wav)["id"]],
                "references": [resource["id"]],
            },
        )
        self.assertIn("--reference", command)
        self.assertEqual(safe["references"], [resource["id"]])
        self.manager.discard_reference_upload(resource["id"])
        with self.assertRaises(ExperimentError):
            self.manager._resolve_voice_resource(resource["id"])

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

    def test_step_stability_uses_fixed_schedule_and_bounded_samples(self):
        command, output, safe = self.manager._build_command(
            "20260730T120000-1234abcd",
            "step_stability",
            {
                "samples": 3,
                "seed_start": 5,
                "target_f0": 180,
                "text": "test",
                "caption": "voice",
                "model": "irodori-vdes",
                "caption_guidance": 2,
                "duration_scale": 1,
            },
        )
        self.assertIn(str((self.root / "step_stability_benchmark.py").resolve()), command)
        self.assertEqual(safe["step_schedule"], [4, 8, 12, 16, 20])
        self.assertEqual(safe["samples"], 3)
        self.assertTrue(str(output).startswith(str(self.root)))

    def test_speaker_condition_registration_and_fixture_filtering(self):
        source = self.root / "character-a.speaker.safetensors"
        save_file({"speaker_embedding": torch.zeros((16, 768))}, str(source))
        registered = self.manager.store_upload(
            "speaker",
            source.name,
            source.read_bytes(),
        )
        resources = self.manager.resources()
        self.assertIn(
            registered["id"],
            {item["id"] for item in resources["speech_speaker_conditions"]},
        )

        sidecar = {
            "schema_version": "speaker_condition_artifact_0.1",
            "embedding": {
                "file": registered["id"],
                "sha256": registered["sha256"],
            },
            "model": {},
            "provenance": {
                "kind": "deterministic_format_fixture",
                "semantic_voice": False,
                "training_data_used": False,
            },
            "privacy": {
                "contains_audio": False,
                "contains_text": False,
                "contains_person_identifier": False,
            },
        }
        self.manager.store_upload(
            "speaker-sidecar",
            "character-a.speaker.json",
            json.dumps(sidecar).encode(),
            target=registered["id"],
        )
        resources = self.manager.resources()
        self.assertIn(
            registered["id"],
            {item["id"] for item in resources["speaker_conditions"]},
        )
        self.assertNotIn(
            registered["id"],
            {item["id"] for item in resources["speech_speaker_conditions"]},
        )

        with self.assertRaises(ExperimentError):
            self.manager.store_upload(
                "speaker",
                "broken.speaker.safetensors",
                b"not safetensors",
            )

    def test_speaker_inversion_samples_are_managed_with_transcripts(self):
        wav = b"RIFF" + (4).to_bytes(4, "little") + b"WAVE"
        sample = self.manager.store_speaker_inversion_sample("../training.wav", wav)
        self.assertEqual(sample["transcript"], "")
        updated = self.manager.update_speaker_inversion_sample(
            {"id": sample["id"], "transcript": "テスト音声です。", "selected": True}
        )
        self.assertEqual(updated["transcript"], "テスト音声です。")
        self.assertTrue(self.manager.speaker_inversion_sample_path(sample["id"]).is_file())
        workspace = self.manager.speaker_inversion_workspace()
        self.assertEqual(workspace["selected_sample_count"], 1)
        self.assertTrue(workspace["local_only"])
        self.manager.discard_speaker_inversion_sample(sample["id"])
        with self.assertRaises(ExperimentError):
            self.manager.speaker_inversion_sample_path(sample["id"])

    def test_speaker_inversion_train_and_generate_commands_are_allowlisted(self):
        wav = b"RIFF" + (4).to_bytes(4, "little") + b"WAVE"
        sample = self.manager.store_speaker_inversion_sample("training.wav", wav)
        self.manager.update_speaker_inversion_sample(
            {"id": sample["id"], "transcript": "テスト音声です。", "selected": True}
        )
        job_id = "20260801T120000-1234abcd"
        with mock.patch("experiment_jobs.sys.platform", "linux"):
            command, output, safe = self.manager._build_command(
                job_id,
                "speaker_inversion_train",
                {
                    "voice_name": "character-a",
                    "sample_ids": [sample["id"]],
                    "max_steps": 10,
                    "tokens": 16,
                    "batch_size": 1,
                    "gradient_accumulation_steps": 1,
                    "learning_rate": 0.01,
                    "seed": 4,
                },
            )
        self.assertIn("speaker_inversion_pipeline.py", " ".join(command))
        self.assertIn("train", command)
        self.assertEqual(safe["sample_count"], 1)
        self.assertTrue(output.is_dir())
        selection = self.manager.job_root / f"{job_id}.speaker-inversion-samples.json"
        self.assertTrue(selection.is_file())
        self.assertNotEqual(selection.parent, output)

        embedding = self.manager.speaker_inversion_embedding_root / "character-a.speaker.safetensors"
        embedding.write_bytes(b"test")
        with mock.patch("experiment_jobs.sys.platform", "linux"):
            generation_command, _, generation_safe = self.manager._build_command(
                "20260801T120001-1234abcd",
                "speaker_inversion_generate",
                {
                    "embedding": embedding.name,
                    "text": "生成確認です。",
                    "caption": "落ち着いた声",
                    "steps": 20,
                    "seed": 1,
                },
            )
        self.assertIn("generate", generation_command)
        self.assertEqual(generation_safe["embedding"], embedding.name)


if __name__ == "__main__":
    unittest.main()

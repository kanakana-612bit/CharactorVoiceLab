import json
import hashlib
import shutil
import struct
import sys
import unittest
import uuid
from pathlib import Path

import torch
from safetensors.torch import save_file


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from speaker_condition_reference import (  # noqa: E402
    SPEAKER_INVERSION_KEY,
    build_compatibility_report,
    classify_audio_cpp_source,
    create_format_fixture,
    file_contains,
    inspect_embedding,
    inspect_model,
    speaker_state_f32le_sha256,
)


def make_model(root: Path, speaker_dim: int = 8) -> Path:
    model_root = root / "model"
    model_root.mkdir()
    config = {
        "latent_dim": 4,
        "model_dim": 16,
        "num_layers": 1,
        "num_heads": 2,
        "use_speaker_condition": True,
        "speaker_dim": speaker_dim,
        "speaker_layers": 1,
        "speaker_heads": 1,
        "speaker_patch_size": 1,
    }
    (model_root / "model_config.json").write_text(
        json.dumps(config), encoding="utf-8"
    )
    save_file(
        {
            "speaker_encoder.in_proj.weight": torch.zeros((speaker_dim, speaker_dim)),
            "speaker_norm.weight": torch.ones(speaker_dim),
            "blocks.0.attention.wk_speaker.weight": torch.zeros((16, speaker_dim)),
            "blocks.0.attention.wv_speaker.weight": torch.zeros((16, speaker_dim)),
        },
        str(model_root / "model.safetensors"),
        metadata={"config_json": json.dumps(config, separators=(",", ":"))},
    )
    return model_root


class SpeakerConditionReferenceTest(unittest.TestCase):
    def setUp(self):
        self.scratch = ROOT / "tests" / f"_speaker_condition_{uuid.uuid4().hex}"
        self.scratch.mkdir()

    def tearDown(self):
        shutil.rmtree(self.scratch, ignore_errors=True)

    def test_model_and_fixture_match_upstream_file_contract(self):
        model = inspect_model(make_model(self.scratch), hash_weights=True)
        self.assertTrue(model["speaker_condition"]["enabled"])
        self.assertEqual(model["speaker_condition"]["dimension"], 8)
        self.assertTrue(model["config_matches_checkpoint_metadata"])

        fixture = self.scratch / "test.speaker.safetensors"
        create_format_fixture(fixture, model=model, tokens=16, seed=3)
        artifact = inspect_embedding(fixture, model=model)

        self.assertTrue(artifact["upstream_file_contract_compatible"])
        self.assertEqual(artifact["shape"], [16, 8])
        self.assertEqual(artifact["dtype"], "float32")
        self.assertRegex(artifact["state_f32le_sha256"], r"^[a-f0-9]{64}$")
        self.assertEqual(artifact["model_binding_status"], "format_fixture_only")
        self.assertNotIn("value", artifact)
        json.dumps(artifact, allow_nan=False)

    def test_state_hash_is_canonical_float32_little_endian(self):
        values = torch.tensor([[0.0, 0.5], [-0.25, 1.0]], dtype=torch.float32)
        expected = hashlib.sha256(
            struct.pack("<4f", 0.0, 0.5, -0.25, 1.0)
        ).hexdigest()
        self.assertEqual(speaker_state_f32le_sha256(values), expected)
        self.assertEqual(
            speaker_state_f32le_sha256(values.to(dtype=torch.float16)),
            expected,
        )

    def test_wrong_dimension_is_rejected(self):
        model = inspect_model(make_model(self.scratch))
        artifact_path = self.scratch / "wrong.speaker.safetensors"
        save_file(
            {SPEAKER_INVERSION_KEY: torch.zeros((16, 7))},
            str(artifact_path),
        )
        artifact = inspect_embedding(artifact_path, model=model)
        self.assertTrue(artifact["upstream_file_contract_compatible"])
        self.assertFalse(artifact["target_model_contract_compatible"])
        self.assertIn(
            "speaker_dimension_mismatch:expected_8_got_7",
            artifact["errors"],
        )

    def test_runtime_direct_input_is_not_inferred_from_reference_audio(self):
        legacy = classify_audio_cpp_source(
            "reference mode requires reference audio; encode_speaker_reference();"
        )
        direct = classify_audio_cpp_source(
            "reference mode requires reference audio; load_speaker_inversion(path);"
        )
        self.assertTrue(legacy["reference_audio_input"])
        self.assertFalse(legacy["direct_embedding_input"])
        self.assertTrue(direct["direct_embedding_input"])

    def test_binary_feature_marker_is_detected_across_read_boundaries(self):
        binary = self.scratch / "audiocpp_server"
        binary.write_bytes(
            b"x" * (1024 * 1024 - 5) + b"speaker_embedding_path" + b"y"
        )
        self.assertTrue(file_contains(binary, b"speaker_embedding_path"))
        self.assertFalse(file_contains(binary, b"unrelated_feature"))

    def test_report_blocks_end_to_end_when_native_path_is_absent(self):
        model = {
            "speaker_condition": {"enabled": True, "dimension": 768},
        }
        runtime = {"direct_embedding_input": False}
        embedding = {
            "upstream_file_contract_compatible": True,
            "target_model_contract_compatible": True,
        }
        report = build_compatibility_report(
            model=model,
            runtime=runtime,
            embeddings=[embedding],
        )
        self.assertEqual(
            report["compatibility"]["end_to_end_status"],
            "blocked_native_runtime_has_no_embedding_input",
        )
        self.assertFalse(report["compatibility"]["semantic_compatibility_proven"])

    def test_tracked_native_patches_cover_input_and_safe_observation(self):
        patch_root = ROOT / "patches" / "audio_cpp"
        full_patch = (
            patch_root / "irodori_speaker_inversion.patch"
        ).read_text(encoding="utf-8")
        upgrade_patch = (
            patch_root / "irodori_speaker_observation.patch"
        ).read_text(encoding="utf-8")
        for marker in (
            "speaker_embedding_path",
            "X-AudioCpp-Speaker-Condition-SHA256",
            "include/engine/framework/runtime/session.h",
            "app/server/runtime.cpp",
        ):
            self.assertIn(marker, full_patch)
        self.assertIn("X-AudioCpp-Speaker-Condition-SHA256", upgrade_patch)
        self.assertNotIn("+  const auto speaker_embedding_path", upgrade_patch)


if __name__ == "__main__":
    unittest.main()

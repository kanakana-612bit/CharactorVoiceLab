import pathlib
import unittest

from tts_backend_registry import (
    OFFICIAL_V4_MODEL_ID,
    backend_catalog,
    backend_manifest,
)


ROOT = pathlib.Path(__file__).resolve().parents[1]


class TtsBackendRegistryTest(unittest.TestCase):
    def test_catalog_keeps_native_model_and_adds_versioned_official_v4(self):
        catalog = backend_catalog(
            {
                "models": [{"id": "irodori-vdes", "path": "managed/model"}],
                "devices": [{"id": "cuda:0", "backend": "cuda"}],
                "default_device": "cuda:0",
                "status": {"managed": True, "running": False},
            }
        )
        models = {item["id"]: item for item in catalog["models"]}
        self.assertEqual(set(models), {"irodori-vdes", OFFICIAL_V4_MODEL_ID})
        self.assertEqual(models["irodori-vdes"]["path"], "managed/model")
        self.assertEqual(models[OFFICIAL_V4_MODEL_ID]["runtime_kind"], "official_python")
        self.assertEqual(
            models[OFFICIAL_V4_MODEL_ID]["capabilities"]["reference_duration_limit_seconds"],
            120,
        )
        self.assertFalse(catalog["condition_contract"]["physical_scalar_control"])

    def test_v4_manifest_pins_source_tokenizer_codec_and_watermark_state(self):
        manifest = backend_manifest(OFFICIAL_V4_MODEL_ID)
        self.assertEqual(
            manifest["runtime"]["source_commit"],
            "d48dd92b943fa5dbcb88150eb974c25d8709df9b",
        )
        self.assertEqual(manifest["runtime"]["tokenizer"], "sbintuitions/modernbert-ja-310m")
        self.assertIn("Semantic-DACVAE", manifest["runtime"]["codec"])
        self.assertIn("watermarking", manifest["capabilities"])


if __name__ == "__main__":
    unittest.main()

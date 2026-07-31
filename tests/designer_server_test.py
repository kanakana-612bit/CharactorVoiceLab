import importlib.util
import hashlib
import json
import pathlib
import shutil
import threading
import unittest
import urllib.request
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from unittest import mock

import torch
from safetensors.torch import save_file


ROOT = pathlib.Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("designer_server", ROOT / "designer_server.py")
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(MODULE)


def make_speaker_condition_project() -> tuple[pathlib.Path, pathlib.Path]:
    root = ROOT / "tests" / f"_speaker_project_{uuid.uuid4().hex}"
    audio_root = root / "runtime" / "audio.cpp"
    model_root = audio_root / "models" / "irodori"
    condition_root = root / "runtime" / "speaker_conditions"
    model_root.mkdir(parents=True)
    condition_root.mkdir(parents=True)
    config = {
        "use_speaker_condition": True,
        "speaker_dim": 768,
        "caption_dim": 512,
        "latent_dim": 32,
    }
    (model_root / "model_config.json").write_text(
        json.dumps(config), encoding="utf-8"
    )
    (audio_root / "server.character_voice_designer.json").write_text(
        json.dumps(
            {
                "models": [
                    {
                        "id": "irodori-vdes",
                        "path": "models/irodori",
                        "family": "irodori_tts",
                        "task": "voice_design",
                    }
                ]
            }
        ),
        encoding="utf-8",
    )
    condition = condition_root / "test.speaker.safetensors"
    save_file(
        {"speaker_embedding": torch.zeros((16, 768), dtype=torch.float32)},
        str(condition),
    )
    return root, condition


class SpeechRequestValidationTest(unittest.TestCase):
    def test_valid_irodori_request_is_narrowed(self):
        request = MODULE.validate_speech_request(
            {
                "model": "irodori-vdes",
                "input": "こんにちは。",
                "language": "ja",
                "seed": 42,
                "num_inference_steps": 40,
                "ignored": "not forwarded",
                "options": {
                    "no_ref": True,
                    "caption": "明るく聞き取りやすい声。",
                    "duration_scale": 0.9,
                    "caption_guidance_scale": 3,
                    "trim_tail": True,
                    "unknown": "not forwarded",
                },
                "postprocess": {
                    "f0": {"enabled": True, "target_hz": 225, "strength": 0.75},
                    "unknown": "not forwarded",
                },
            }
        )
        self.assertEqual(request["model"], "irodori-vdes")
        self.assertNotIn("ignored", request)
        self.assertNotIn("unknown", request["options"])
        self.assertEqual(request["options"]["duration_scale"], 0.9)
        self.assertEqual(request["_cvd_postprocess"]["target_hz"], 225)
        self.assertEqual(request["_cvd_postprocess"]["strength"], 0.75)

    def test_observation_options_are_validated_and_not_forwarded(self):
        request = MODULE.validate_speech_request(
            {
                "model": "irodori-vdes",
                "input": "test",
                "observation": {
                    "enabled": True,
                    "label": "parity-01",
                    "analyze_f0": False,
                    "capture_internal_conditions": True,
                    "latent_snapshot_steps": [20, 4, 20],
                },
            }
        )
        observation = request.pop("_cvd_observation")
        self.assertEqual(observation["label"], "parity-01")
        self.assertEqual(observation["latent_snapshot_steps"], [4, 20])
        self.assertNotIn("observation", request)

    def test_standard_single_mode_forces_twenty_steps(self):
        request = MODULE.validate_speech_request(
            {
                "model": "irodori-vdes",
                "input": "test",
                "generation_mode": "standard_single",
                "num_inference_steps": 80,
            }
        )
        self.assertEqual(request["num_inference_steps"], 20)
        self.assertNotIn("generation_mode", request)

    def test_invalid_observation_snapshot_step_is_rejected(self):
        with self.assertRaises(ValueError):
            MODULE.validate_speech_request(
                {
                    "model": "irodori-vdes",
                    "input": "test",
                    "observation": {
                        "enabled": True,
                        "latent_snapshot_steps": [0],
                    },
                }
            )

    def test_remote_upstream_is_rejected(self):
        with self.assertRaises(ValueError):
            MODULE.normalize_upstream_url("https://example.com")

    def test_non_loopback_bind_is_rejected(self):
        with self.assertRaises(ValueError):
            MODULE.normalize_bind_host("0.0.0.0")

    def test_invalid_model_id_is_rejected(self):
        with self.assertRaises(ValueError):
            MODULE.validate_speech_request({"model": "../../model", "input": "test"})

    def test_managed_speaker_condition_is_validated_and_forwarded(self):
        project, condition = make_speaker_condition_project()
        self.addCleanup(shutil.rmtree, project, True)
        with mock.patch.object(MODULE, "PROJECT_ROOT", project):
            request = MODULE.validate_speech_request(
                {
                    "model": "irodori-vdes",
                    "input": "test",
                    "speaker_condition": {"file": condition.name},
                }
            )
        self.assertFalse(request["options"]["no_ref"])
        self.assertEqual(
            request["options"]["speaker_embedding_path"],
            str(condition.resolve()),
        )
        self.assertEqual(
            request["_cvd_speaker_condition"]["shape"],
            [16, 768],
        )
        self.assertRegex(
            request["_cvd_speaker_condition"]["state_f32le_sha256"],
            r"^[a-f0-9]{64}$",
        )

    def test_non_semantic_fixture_is_rejected(self):
        project, condition = make_speaker_condition_project()
        self.addCleanup(shutil.rmtree, project, True)
        digest = hashlib.sha256(condition.read_bytes()).hexdigest()
        condition.with_name("test.speaker.json").write_text(
            json.dumps(
                {
                    "embedding": {"sha256": digest},
                    "model": {},
                    "provenance": {"semantic_voice": False},
                }
            ),
            encoding="utf-8",
        )
        with mock.patch.object(MODULE, "PROJECT_ROOT", project):
            with self.assertRaisesRegex(ValueError, "format fixture"):
                MODULE.validate_speech_request(
                    {
                        "model": "irodori-vdes",
                        "input": "test",
                        "speaker_condition": {"file": condition.name},
                    }
                )

    def test_speaker_condition_dimension_mismatch_is_rejected(self):
        project, condition = make_speaker_condition_project()
        self.addCleanup(shutil.rmtree, project, True)
        save_file(
            {"speaker_embedding": torch.zeros((16, 767), dtype=torch.float32)},
            str(condition),
        )
        with mock.patch.object(MODULE, "PROJECT_ROOT", project):
            with self.assertRaisesRegex(ValueError, "incompatible"):
                MODULE.validate_speech_request(
                    {
                        "model": "irodori-vdes",
                        "input": "test",
                        "speaker_condition": {"file": condition.name},
                    }
                )

    def test_speaker_condition_nested_path_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "managed"):
            MODULE.validate_speech_request(
                {
                    "model": "irodori-vdes",
                    "input": "test",
                    "speaker_condition": {
                        "file": "../test.speaker.safetensors",
                    },
                }
            )


class StubAudioCppHandler(BaseHTTPRequestHandler):
    last_payload = None

    def do_GET(self):  # noqa: N802
        body = json.dumps({"data": [{"id": "irodori-vdes"}]}).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):  # noqa: N802
        length = int(self.headers.get("Content-Length", "0"))
        payload = json.loads(self.rfile.read(length))
        type(self).last_payload = payload
        assert payload["model"] == "irodori-vdes"
        assert payload["options"]["caption"] == "明るい声。"
        assert "observation" not in payload
        body = b"RIFF\x04\x00\x00\x00WAVE"
        self.send_response(200)
        self.send_header("Content-Type", "audio/wav")
        self.send_header("Content-Length", str(len(body)))
        if "speaker_embedding_path" in payload["options"]:
            self.send_header(
                "X-AudioCpp-Speaker-Condition-SHA256",
                "b" * 64,
            )
            self.send_header("X-AudioCpp-Speaker-Condition-Shape", "16x768")
            self.send_header(
                "X-AudioCpp-Speaker-Condition-Mode",
                "speaker_inversion",
            )
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, _format, *args):
        pass


class MemoryObservationStore(MODULE.ObservationStore):
    def __init__(self):
        super().__init__(ROOT / "tmp" / "unused-observation-store", ROOT)
        self.records = {}

    def write(self, observation_id, record):
        self.records[observation_id] = dict(record)
        return True

    def read(self, observation_id):
        return self.records.get(observation_id)


class ObservationRecordTest(unittest.TestCase):
    def test_upstream_and_returned_audio_and_native_headers_remain_distinct(self):
        request = MODULE.validate_speech_request(
            {
                "model": "irodori-vdes",
                "input": "test",
                "observation": {
                    "enabled": True,
                    "analyze_f0": False,
                    "capture_internal_conditions": True,
                },
            }
        )
        observation_options = request.pop("_cvd_observation")
        store = MemoryObservationStore()
        capture = store.begin(request, None, observation_options)
        capture.record["internal_conditions"]["speaker_condition"].update(
            {
                "requested": True,
                "input_state_f32le_sha256": "a" * 64,
            }
        )
        self.assertTrue(
            capture.finalize_success(
                upstream_body=b"upstream",
                body=b"returned",
                status=200,
                content_type="application/octet-stream",
                upstream_seconds=1.25,
                postprocess_seconds=0.1,
                correction_metadata=None,
                upstream_headers={
                    "X-AudioCpp-Predicted-Duration-Seconds": "2.5",
                    "X-AudioCpp-Speaker-Condition-SHA256": "a" * 64,
                    "X-AudioCpp-Speaker-Condition-Shape": "16x768",
                    "X-AudioCpp-Speaker-Condition-Mode": "speaker_inversion",
                },
                f0_analyzer=None,
            )
        )
        record = store.read(capture.id)
        self.assertFalse(record["response"]["upstream_audio"]["same_as_returned"])
        self.assertNotEqual(
            record["response"]["upstream_audio"]["sha256"],
            record["response"]["audio"]["sha256"],
        )
        self.assertTrue(record["internal_conditions"]["duration_prediction"]["observed"])
        self.assertEqual(record["internal_conditions"]["duration_prediction"]["seconds"], 2.5)
        self.assertTrue(record["internal_conditions"]["speaker_condition"]["observed"])
        self.assertEqual(
            record["internal_conditions"]["speaker_condition"]["shape"],
            [16, 768],
        )
        self.assertEqual(
            record["internal_conditions"]["speaker_condition"]["mode"],
            "speaker_inversion",
        )
        self.assertTrue(
            record["internal_conditions"]["speaker_condition"]["matches_input_state"]
        )


class LocalProxyIntegrationTest(unittest.TestCase):
    def setUp(self):
        self.stub = ThreadingHTTPServer(("127.0.0.1", 0), StubAudioCppHandler)
        self.stub_thread = threading.Thread(target=self.stub.serve_forever, daemon=True)
        self.stub_thread.start()
        self.designer = MODULE.DesignerServer(("127.0.0.1", 0), MODULE.DesignerHandler)
        self.designer.audio_cpp_base_url = f"http://127.0.0.1:{self.stub.server_port}"
        self.designer.upstream_timeout_seconds = 3
        self.designer.observation_store = MemoryObservationStore()
        self.experiment_root = ROOT / "tests" / f"_experiment_project_{uuid.uuid4().hex}"
        self.experiment_root.mkdir(parents=True)
        self.designer.experiment_manager = MODULE.ExperimentJobManager(
            self.experiment_root,
            bridge_base_url=f"http://127.0.0.1:{self.designer.server_port}",
            audio_cpp_base_url=self.designer.audio_cpp_base_url,
        )
        self.designer.voice_identity_store = MODULE.VoiceIdentityStore(self.experiment_root)
        self.designer_thread = threading.Thread(target=self.designer.serve_forever, daemon=True)
        self.designer_thread.start()
        self.base_url = f"http://127.0.0.1:{self.designer.server_port}"

    def tearDown(self):
        self.designer.experiment_manager.shutdown()
        self.designer.shutdown()
        self.designer.server_close()
        self.stub.shutdown()
        self.stub.server_close()
        shutil.rmtree(self.experiment_root, ignore_errors=True)

    def test_runtime_health_reports_f0_dependencies(self):
        with urllib.request.urlopen(self.base_url + "/api/runtime/health") as response:
            health = json.load(response)
            content_security_policy = response.headers.get("Content-Security-Policy", "")
        self.assertEqual(health["app"], "CharacterVoiceDesigner")
        self.assertIsInstance(health["psola_available"], bool)
        self.assertIn("pyworld", health["postprocess_dependencies"])
        self.assertIn("connect-src 'self'", content_security_policy)

    def test_experiment_catalog_and_local_upload_are_available(self):
        with urllib.request.urlopen(self.base_url + "/api/experiments/catalog") as response:
            catalog = json.load(response)
        self.assertTrue(catalog["local_only"])
        self.assertEqual(catalog["max_parallel_jobs"], 1)
        self.assertIn("seed_f0", {tool["id"] for tool in catalog["tools"]})
        self.assertIn("step_stability", {tool["id"] for tool in catalog["tools"]})

        wav = b"RIFF" + (4).to_bytes(4, "little") + b"WAVE"
        request = urllib.request.Request(
            self.base_url + "/api/experiments/uploads?kind=wav&name=test.wav",
            data=wav,
            headers={"Content-Type": "audio/wav"},
            method="POST",
        )
        with urllib.request.urlopen(request) as response:
            uploaded = json.load(response)
        self.assertTrue(uploaded["id"].startswith("upload-wav:"))

        with urllib.request.urlopen(self.base_url + "/api/experiments/resources") as response:
            resources = json.load(response)
        self.assertIn(uploaded["id"], {item["id"] for item in resources["voice_inputs"]})

    def test_voice_identity_resources_expose_standard_single_policy(self):
        with urllib.request.urlopen(self.base_url + "/api/voice-identities/resources") as response:
            resources = json.load(response)
        self.assertEqual(resources["standard_generation"]["num_inference_steps"], 20)
        self.assertEqual(resources["standard_generation"]["candidate_count"], 1)
        self.assertFalse(resources["standard_generation"]["automatic_retry"])

    def test_models_and_wav_are_proxied(self):
        with urllib.request.urlopen(self.base_url + "/api/audio-cpp/models") as response:
            models = json.load(response)
        self.assertEqual(models["data"][0]["id"], "irodori-vdes")

        request = urllib.request.Request(
            self.base_url + "/api/audio-cpp/speech",
            data=json.dumps(
                {
                    "model": "irodori-vdes",
                    "input": "テストです。",
                    "options": {"caption": "明るい声。"},
                },
                ensure_ascii=False,
            ).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(request) as response:
            audio = response.read()
            content_type = response.headers.get_content_type()
        self.assertEqual(content_type, "audio/wav")
        self.assertTrue(audio.startswith(b"RIFF"))

    def test_observation_is_local_opt_in_and_does_not_change_audio(self):
        payload = {
            "model": "irodori-vdes",
            "input": "observation test",
            "options": {"caption": "明るい声。"},
        }
        plain_request = urllib.request.Request(
            self.base_url + "/api/audio-cpp/speech",
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(plain_request) as response:
            plain_audio = response.read()
            self.assertIsNone(response.headers.get("X-CVD-Observation-ID"))

        payload["observation"] = {
            "enabled": True,
            "label": "parity",
            "analyze_f0": False,
            "capture_internal_conditions": True,
            "latent_snapshot_steps": [4, 20],
        }
        observed_request = urllib.request.Request(
            self.base_url + "/api/audio-cpp/speech",
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(observed_request) as response:
            observed_audio = response.read()
            observation_id = response.headers.get("X-CVD-Observation-ID")

        self.assertEqual(observed_audio, plain_audio)
        self.assertIsNotNone(observation_id)
        with urllib.request.urlopen(
            self.base_url + f"/api/runtime/observations/{observation_id}"
        ) as response:
            record = json.load(response)
        self.assertEqual(record["status"], "complete")
        self.assertEqual(record["label"], "parity")
        self.assertFalse(record["privacy"]["input_text_stored"])
        self.assertNotIn("value", record["request"]["input"])
        self.assertEqual(
            record["response"]["audio"]["sha256"],
            hashlib.sha256(observed_audio).hexdigest(),
        )
        self.assertTrue(record["response"]["upstream_audio"]["same_as_returned"])
        self.assertTrue(record["internal_conditions"]["capture_requested"])
        self.assertEqual(
            record["internal_conditions"]["latent_snapshots"]["requested_steps"],
            [4, 20],
        )
        self.assertFalse(record["internal_conditions"]["speaker_condition"]["observed"])

    def test_managed_speaker_state_headers_and_mismatch_are_observed(self):
        project, condition = make_speaker_condition_project()
        self.addCleanup(shutil.rmtree, project, True)
        payload = {
            "model": "irodori-vdes",
            "input": "speaker state test",
            "options": {"caption": "明るい声。"},
            "speaker_condition": {"file": condition.name},
            "observation": {
                "enabled": True,
                "analyze_f0": False,
                "capture_internal_conditions": True,
            },
        }
        request = urllib.request.Request(
            self.base_url + "/api/audio-cpp/speech",
            data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with mock.patch.object(MODULE, "PROJECT_ROOT", project):
            with urllib.request.urlopen(request) as response:
                response.read()
                observation_id = response.headers["X-CVD-Observation-ID"]
                self.assertEqual(
                    response.headers["X-CVD-Speaker-State-SHA256"],
                    "b" * 64,
                )
                self.assertEqual(
                    response.headers["X-CVD-Speaker-State-Shape"],
                    "16x768",
                )
                self.assertEqual(
                    response.headers["X-CVD-Speaker-Condition-Mode"],
                    "speaker_inversion",
                )
        record = self.designer.observation_store.read(observation_id)
        speaker = record["internal_conditions"]["speaker_condition"]
        self.assertTrue(speaker["observed"])
        self.assertFalse(speaker["matches_input_state"])

    def test_observation_capabilities_are_reported(self):
        with urllib.request.urlopen(
            self.base_url + "/api/runtime/observation-capabilities?model=irodori-vdes"
        ) as response:
            capabilities = json.load(response)
        self.assertTrue(capabilities["available"]["request_conditions"])
        self.assertFalse(capabilities["available"]["speaker_condition"])
        self.assertFalse(capabilities["storage"]["stores_audio"])

    def test_speaker_condition_capabilities_do_not_claim_direct_inference(self):
        with urllib.request.urlopen(
            self.base_url
            + "/api/runtime/speaker-condition-capabilities?model=irodori-vdes"
        ) as response:
            capabilities = json.load(response)
        self.assertTrue(
            capabilities["available"]["speaker_inversion_file_validation"]
        )
        self.assertFalse(
            capabilities["available"]["speaker_inversion_direct_inference"]
        )
        self.assertFalse(capabilities["available"]["speaker_state_observation"])
        self.assertTrue(
            capabilities["speaker_inversion_contract"]["raw_embedding_not_exposed_by_default"]
        )


if __name__ == "__main__":
    unittest.main()

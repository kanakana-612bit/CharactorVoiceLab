import importlib.util
import json
import pathlib
import threading
import unittest
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer


ROOT = pathlib.Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("designer_server", ROOT / "designer_server.py")
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(MODULE)


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

    def test_remote_upstream_is_rejected(self):
        with self.assertRaises(ValueError):
            MODULE.normalize_upstream_url("https://example.com")

    def test_invalid_model_id_is_rejected(self):
        with self.assertRaises(ValueError):
            MODULE.validate_speech_request({"model": "../../model", "input": "test"})


class StubAudioCppHandler(BaseHTTPRequestHandler):
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
        assert payload["model"] == "irodori-vdes"
        assert payload["options"]["caption"] == "明るい声。"
        body = b"RIFF\x04\x00\x00\x00WAVE"
        self.send_response(200)
        self.send_header("Content-Type", "audio/wav")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, _format, *args):
        pass


class LocalProxyIntegrationTest(unittest.TestCase):
    def setUp(self):
        self.stub = ThreadingHTTPServer(("127.0.0.1", 0), StubAudioCppHandler)
        self.stub_thread = threading.Thread(target=self.stub.serve_forever, daemon=True)
        self.stub_thread.start()
        self.designer = MODULE.DesignerServer(("127.0.0.1", 0), MODULE.DesignerHandler)
        self.designer.audio_cpp_base_url = f"http://127.0.0.1:{self.stub.server_port}"
        self.designer.upstream_timeout_seconds = 3
        self.designer_thread = threading.Thread(target=self.designer.serve_forever, daemon=True)
        self.designer_thread.start()
        self.base_url = f"http://127.0.0.1:{self.designer.server_port}"

    def tearDown(self):
        self.designer.shutdown()
        self.designer.server_close()
        self.stub.shutdown()
        self.stub.server_close()

    def test_runtime_health_reports_f0_dependencies(self):
        with urllib.request.urlopen(self.base_url + "/api/runtime/health") as response:
            health = json.load(response)
        self.assertEqual(health["app"], "CharacterVoiceDesigner")
        self.assertIsInstance(health["psola_available"], bool)
        self.assertIn("pyworld", health["postprocess_dependencies"])

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


if __name__ == "__main__":
    unittest.main()

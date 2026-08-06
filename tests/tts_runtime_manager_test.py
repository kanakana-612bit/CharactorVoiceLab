from pathlib import Path
import unittest

from official_v4_runtime import OfficialV4Result
from tts_runtime_manager import TtsRuntimeManager


class FakeAudioRuntime:
    def __init__(self, events):
        self.events = events
        self.running = False

    def catalog(self):
        return {
            "models": [{"id": "irodori-vdes"}],
            "devices": [
                {"id": "cpu", "label": "CPU", "backend": "cpu", "memory_mib": 0},
                {
                    "id": "cuda:1",
                    "label": "GPU 1",
                    "backend": "cuda",
                    "physical_index": 1,
                    "memory_mib": 16384,
                },
            ],
            "default_device": "cuda:1",
            "status": self.status(),
        }

    def status(self):
        return {
            "managed": True,
            "running": self.running,
            "model": "irodori-vdes" if self.running else None,
            "device_id": "cuda:1" if self.running else None,
            "vram_limit_mib": 0,
        }

    def activate(self, model, device, limit):
        self.events.append(("audio.activate", model, device, limit))
        self.running = True
        return self.status()

    def stop(self, *, reason=""):
        self.events.append(("audio.stop", reason))
        self.running = False

    def request_url(self, path):
        return "http://127.0.0.1:8080" + path

    def vram_guard(self):
        return None


class FakeOfficialRuntime:
    def __init__(self, events):
        self.events = events
        self.running = False

    def status(self):
        return {
            "managed": True,
            "running": self.running,
            "model": "irodori-v4-small" if self.running else None,
            "runtime_kind": "official_python_resident" if self.running else None,
            "device_id": "cuda:1" if self.running else None,
            "vram_limit_mib": 12000 if self.running else 0,
        }

    def activate(self, device, limit):
        self.events.append(("official.activate", device["id"], limit))
        self.running = True
        return self.status()

    def render(self, request, embedding, *, timeout_seconds):
        self.events.append(("official.render", embedding, timeout_seconds))
        return OfficialV4Result(b"RIFFfixture", {}, "test")

    def stop(self, *, reason=""):
        self.events.append(("official.stop", reason))
        self.running = False


class TtsRuntimeManagerTest(unittest.TestCase):
    def setUp(self):
        self.events = []
        self.audio = FakeAudioRuntime(self.events)
        self.official = FakeOfficialRuntime(self.events)
        self.manager = TtsRuntimeManager(
            Path.cwd(),
            Path("unused.json"),
            audio_runtime=self.audio,
            official_runtime=self.official,
        )

    def test_switch_to_official_stops_audio_before_start(self):
        self.audio.running = True
        status = self.manager.activate("irodori-v4-small", "cuda:1", 12000)
        self.assertEqual(status["runtime_kind"], "official_python_resident")
        self.assertEqual(
            self.events[:2],
            [("audio.stop", "runtime selection changed"), ("official.activate", "cuda:1", 12000)],
        )

    def test_switch_to_audio_stops_official_before_start(self):
        self.official.running = True
        status = self.manager.activate("irodori-vdes", "cuda:1", 0)
        self.assertEqual(status["runtime_kind"], "audio_cpp")
        self.assertEqual(
            self.events[:2],
            [
                ("official.stop", "runtime selection changed"),
                ("audio.activate", "irodori-vdes", "cuda:1", 0),
            ],
        )

    def test_official_render_reuses_selected_runtime(self):
        result = self.manager.render_official_v4(
            {"input": "test"},
            {"device_id": "cuda:1", "vram_limit_mib": 12000},
            "voice.speaker.safetensors",
            timeout_seconds=30,
        )
        self.assertTrue(result.wav_bytes.startswith(b"RIFF"))
        self.assertEqual(self.events[-1], ("official.render", "voice.speaker.safetensors", 30))


if __name__ == "__main__":
    unittest.main()

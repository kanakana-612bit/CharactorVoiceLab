from __future__ import annotations

import json
from pathlib import Path
import shutil
import unittest
import uuid

from audio_cpp_runtime import AudioCppRuntimeError, AudioCppRuntimeManager


ROOT = Path(__file__).resolve().parents[1]


class AudioCppRuntimeManagerTest(unittest.TestCase):
    def setUp(self) -> None:
        self.root = ROOT / "tests" / f"_audio_runtime_{uuid.uuid4().hex}"
        runtime = self.root / "runtime"
        audio = runtime / "audio.cpp"
        audio.mkdir(parents=True)
        executable = audio / "audiocpp_server"
        executable.write_bytes(b"fixture")
        manifest = {
            "executable": str(executable),
            "working_directory": str(audio),
            "log_root": str(runtime / "logs"),
            "threads": 10,
            "default_device": "cuda:1",
            "devices": [
                {"id": "cpu", "label": "CPU only", "backend": "cpu", "memory_mib": 0},
                {
                    "id": "cuda:1",
                    "label": "GPU 1 / RTX 5060 Ti",
                    "backend": "cuda",
                    "physical_index": 1,
                    "memory_mib": 16384,
                },
            ],
            "models": [
                {
                    "id": "irodori-vdes",
                    "label": "Irodori VoiceDesign",
                    "family": "irodori_tts",
                    "path": str(audio / "models" / "irodori"),
                    "task": "vdes",
                    "mode": "offline",
                }
            ],
        }
        self.manifest = runtime / "audio_cpp.runtime.json"
        self.manifest.write_text(json.dumps(manifest), encoding="utf-8")
        self.manager = AudioCppRuntimeManager(self.root, self.manifest)

    def tearDown(self) -> None:
        self.manager.shutdown()
        shutil.rmtree(self.root, ignore_errors=True)

    def test_catalog_exposes_cpu_and_each_physical_gpu(self) -> None:
        catalog = self.manager.catalog()
        self.assertEqual(catalog["default_device"], "cuda:1")
        self.assertEqual([item["id"] for item in catalog["devices"]], ["cpu", "cuda:1"])
        self.assertEqual(
            catalog["vram_limit_policy"]["generation"],
            "process_monitor_stop_on_exceed",
        )

    def test_limit_above_selected_gpu_capacity_is_rejected_before_start(self) -> None:
        with self.assertRaises(AudioCppRuntimeError):
            self.manager.activate("irodori-vdes", "cuda:1", 20000)

    def test_unknown_device_is_rejected(self) -> None:
        with self.assertRaises(AudioCppRuntimeError):
            self.manager.activate("irodori-vdes", "cuda:9", 0)


if __name__ == "__main__":
    unittest.main()

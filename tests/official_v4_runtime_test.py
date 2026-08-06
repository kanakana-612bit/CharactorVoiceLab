import json
import pathlib
import subprocess
import unittest
from unittest import mock

from official_v4_runtime import OfficialV4RuntimeError, render_official_v4


ROOT = pathlib.Path(__file__).resolve().parents[1]


class OfficialV4RuntimeTest(unittest.TestCase):
    def test_cpu_is_rejected_before_starting_upstream(self):
        with self.assertRaises(OfficialV4RuntimeError):
            render_official_v4(
                ROOT,
                {"input": "test", "seed": 1, "num_inference_steps": 20, "options": {}},
                {"device_id": "cpu", "vram_limit_mib": 0},
                timeout_seconds=1,
            )

    def test_request_is_narrowed_to_render_subcommand(self):
        captured = {}

        def fake_run(command, **kwargs):
            captured["command"] = command
            output = pathlib.Path(command[command.index("--output") + 1])
            (output / "official-v4-render.wav").write_bytes(b"RIFF-test")
            (output / "summary.json").write_text(
                json.dumps(
                    {
                        "output_wav": "official-v4-render.wav",
                        "speaker_condition_mode": "speaker_inversion",
                    }
                ),
                encoding="utf-8",
            )
            return subprocess.CompletedProcess(command, 0, "ok", "")

        with mock.patch("official_v4_runtime.subprocess.run", side_effect=fake_run):
            result = render_official_v4(
                ROOT,
                {
                    "input": "test",
                    "seed": 42,
                    "num_inference_steps": 20,
                    "options": {
                        "caption": "neutral",
                        "caption_guidance_scale": 2,
                        "speaker_guidance_scale": 5,
                        "duration_scale": 1,
                    },
                },
                {"device_id": "cuda:1", "vram_limit_mib": 12000},
                timeout_seconds=3,
                embedding="sample.speaker.safetensors",
            )
        command = captured["command"]
        self.assertIn("render", command)
        self.assertEqual(command[command.index("--gpu-index") + 1], "1")
        self.assertEqual(command[command.index("--vram-limit-mib") + 1], "12000")
        self.assertEqual(
            command[command.index("--embedding") + 1],
            "sample.speaker.safetensors",
        )
        self.assertEqual(result.headers["X-CVD-Backend-Runtime"], "official_python")


if __name__ == "__main__":
    unittest.main()

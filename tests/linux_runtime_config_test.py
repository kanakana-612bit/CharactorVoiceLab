from __future__ import annotations

import importlib.util
from pathlib import Path
import sys
import unittest


MODULE_PATH = Path(__file__).parents[1] / "scripts" / "linux_runtime_config.py"
SPEC = importlib.util.spec_from_file_location("linux_runtime_config", MODULE_PATH)
assert SPEC and SPEC.loader
runtime = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = runtime
SPEC.loader.exec_module(runtime)


class LinuxRuntimeConfigTest(unittest.TestCase):
    def setUp(self) -> None:
        self.rtx3060 = runtime.GpuInfo(0, "NVIDIA GeForce RTX 3060", "580.159.03", "8.6", 12288, 3727)

    def test_auto_selects_cuda_13_for_compatible_rtx3060(self) -> None:
        config = runtime.select_runtime("auto", "x86_64", [self.rtx3060], 10)
        self.assertEqual(config.backend, "cuda")
        self.assertEqual(config.cuda_architectures, "86")
        self.assertEqual(config.device, 0)
        self.assertEqual(config.threads, 10)
        self.assertIn("free at least", config.selection_reason)

    def test_nvidia_smi_query_output_is_parsed(self) -> None:
        gpus = runtime.parse_nvidia_smi_output(
            "0, NVIDIA GeForce RTX 3060, 580.159.03, 8.6, 12288, 3727\n"
        )
        self.assertEqual(gpus, [self.rtx3060])

    def test_cuda_architecture_can_be_overridden(self) -> None:
        config = runtime.select_runtime("cuda", "x86_64", [self.rtx3060], 8, "86;89")
        self.assertEqual(config.cuda_architectures, "86;89")

    def test_auto_falls_back_to_cpu_for_old_driver(self) -> None:
        old = runtime.GpuInfo(0, "NVIDIA GPU", "570.200", "8.6", 8192, 8192)
        config = runtime.select_runtime("auto", "x86_64", [old], 6)
        self.assertEqual(config.backend, "cpu")
        self.assertIn("below", config.selection_reason)

    def test_explicit_cuda_rejects_old_driver(self) -> None:
        old = runtime.GpuInfo(0, "NVIDIA GPU", "570.200", "8.6", 8192, 8192)
        with self.assertRaises(runtime.RuntimeConfigError):
            runtime.select_runtime("cuda", "x86_64", [old], 6)

    def test_thread_default_is_capped_at_ten(self) -> None:
        self.assertEqual(runtime.recommended_threads("", detected_cores=16), 10)
        self.assertEqual(runtime.recommended_threads("", detected_cores=6), 6)
        self.assertEqual(runtime.recommended_threads("12", detected_cores=6), 12)


if __name__ == "__main__":
    unittest.main()

import pathlib
import sys
import types
import unittest
from unittest import mock


ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import speaker_inversion_cuda_probe as probe


class _FakeProperties:
    name = "NVIDIA GeForce RTX 3060"
    total_memory = 12 * 1024**3


class _FakeTensor:
    def __add__(self, value):
        return self

    def item(self):
        return 2.0


class SpeakerInversionCudaProbeTest(unittest.TestCase):
    def test_cpu_wheel_is_reported_for_repair(self):
        torch = types.SimpleNamespace(
            __version__="2.10.0",
            version=types.SimpleNamespace(cuda=None),
            cuda=types.SimpleNamespace(is_available=lambda: False),
        )
        with (
            mock.patch.dict(sys.modules, {"torch": torch}),
            mock.patch.object(probe.shutil, "which", return_value=None),
        ):
            diagnostics = probe.collect_diagnostics()
        self.assertFalse(diagnostics["ready"])
        self.assertEqual(diagnostics["failure_kind"], "cpu_torch")

    def test_cuda_allocation_marks_runtime_ready(self):
        cuda = types.SimpleNamespace(
            is_available=lambda: True,
            device_count=lambda: 1,
            current_device=lambda: 0,
            get_device_properties=lambda device: _FakeProperties(),
            get_device_capability=lambda device: (8, 6),
            synchronize=lambda device: None,
        )
        torch = types.SimpleNamespace(
            __version__="2.10.0+cu128",
            version=types.SimpleNamespace(cuda="12.8"),
            cuda=cuda,
            ones=lambda *args, **kwargs: _FakeTensor(),
        )
        with (
            mock.patch.dict(sys.modules, {"torch": torch}),
            mock.patch.object(probe.shutil, "which", return_value=None),
        ):
            diagnostics = probe.collect_diagnostics()
        self.assertTrue(diagnostics["ready"])
        self.assertEqual(diagnostics["torch"]["device_name"], "NVIDIA GeForce RTX 3060")
        self.assertTrue(diagnostics["allocation_test"]["passed"])


if __name__ == "__main__":
    unittest.main()

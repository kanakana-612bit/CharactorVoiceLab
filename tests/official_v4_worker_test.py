import importlib
import shutil
import sys
import unittest
import uuid
from pathlib import Path

from official_v4_worker import ResidentRuntime


ROOT = Path(__file__).resolve().parents[1]


class OfficialV4WorkerTest(unittest.TestCase):
    def setUp(self):
        self.root = ROOT / "tests" / f"_official_worker_{uuid.uuid4().hex}"
        self.source = self.root / "Irodori-TTS"
        package = self.source / "irodori_tts"
        package.mkdir(parents=True)
        (package / "__init__.py").write_text("", encoding="utf-8")
        (package / "inference_runtime.py").write_text(
            """
from types import SimpleNamespace

LOAD_COUNT = 0

class RuntimeKey:
    def __init__(self, **kwargs):
        self.kwargs = kwargs

class SamplingRequest:
    def __init__(self, **kwargs):
        self.kwargs = kwargs

class InferenceRuntime:
    @classmethod
    def from_key(cls, key):
        global LOAD_COUNT
        LOAD_COUNT += 1
        return cls()

    def synthesize(self, request, log_fn=None):
        return SimpleNamespace(audio=b'audio', sample_rate=48000, used_seed=request.kwargs['seed'])

    def unload(self):
        pass

def resolve_cfg_scales(**kwargs):
    return kwargs['cfg_scale_text'], kwargs['cfg_scale_caption'], kwargs['cfg_scale_speaker'], []

def save_wav(path, audio, sample_rate):
    path.write_bytes(b'RIFF' + audio)
    return path
""".lstrip(),
            encoding="utf-8",
        )
        self.checkpoint = self.root / "model.safetensors"
        self.checkpoint.write_bytes(b"fixture")

    def tearDown(self):
        for name in list(sys.modules):
            if name == "irodori_tts" or name.startswith("irodori_tts."):
                sys.modules.pop(name, None)
        while str(self.source.resolve()) in sys.path:
            sys.path.remove(str(self.source.resolve()))
        shutil.rmtree(self.root, ignore_errors=True)

    def test_model_is_loaded_once_and_reused_for_multiple_requests(self):
        runtime = ResidentRuntime(
            self.source,
            self.checkpoint,
            self.root / "embeddings",
            self.root / "work",
        )
        first, _ = runtime.synthesize({"text": "first", "seed": 1})
        second, _ = runtime.synthesize({"text": "second", "seed": 2})
        module = importlib.import_module("irodori_tts.inference_runtime")
        self.assertEqual(module.LOAD_COUNT, 1)
        self.assertTrue(first.startswith(b"RIFF"))
        self.assertTrue(second.startswith(b"RIFF"))
        runtime.unload()


if __name__ == "__main__":
    unittest.main()

import argparse
import json
import pathlib
import shutil
import sys
import unittest
import uuid
from unittest import mock


ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import speaker_inversion_pipeline as pipeline


class SpeakerInversionPipelineTest(unittest.TestCase):
    def setUp(self):
        self.root = ROOT / "tests" / f"_speaker_inversion_{uuid.uuid4().hex}"
        paths = pipeline._runtime_paths(self.root)
        for path in (
            paths["source"] / "configs",
            paths["model"].parent,
            paths["uv"].parent,
            self.root / "runtime" / "speaker_inversion" / "dataset" / "audio",
        ):
            path.mkdir(parents=True, exist_ok=True)
        for path in (
            paths["source"] / "train.py",
            paths["source"] / "prepare_manifest.py",
            paths["source"] / "infer.py",
            paths["source"] / "configs" / pipeline.CONFIG_NAME,
            paths["model"],
            paths["uv"],
        ):
            path.write_bytes(b"fixture")
        paths["environment"].write_text(
            json.dumps({"upstream_commit": pipeline.UPSTREAM_COMMIT}),
            encoding="utf-8",
        )
        self.paths = paths

    def tearDown(self):
        shutil.rmtree(self.root, ignore_errors=True)

    def test_train_registers_embedding_without_exposing_transcript_in_summary(self):
        wav = self.root / "runtime" / "speaker_inversion" / "dataset" / "audio" / "a.wav"
        wav.write_bytes(b"RIFF\x04\x00\x00\x00WAVE")
        samples = self.root / "samples.json"
        samples.write_text(
            json.dumps([{"audio": str(wav), "text": "これは学習文です。"}], ensure_ascii=False),
            encoding="utf-8",
        )
        output = self.root / "output"
        calls = []

        def fake_run(command, *, cwd):
            calls.append((command, cwd))
            if "train.py" in command:
                checkpoint = output / "upstream_training" / "checkpoint_final.speaker.safetensors"
                checkpoint.parent.mkdir(parents=True, exist_ok=True)
                checkpoint.write_bytes(b"learned-embedding")

        args = argparse.Namespace(
            project_root=self.root,
            samples=samples,
            output=output,
            voice_name="character-a",
            tokens=16,
            max_steps=10,
            batch_size=1,
            gradient_accumulation_steps=1,
            num_workers=0,
            learning_rate=0.01,
            save_every=10,
            seed=0,
        )
        with mock.patch.object(pipeline, "_run", side_effect=fake_run):
            pipeline.train(args)
        managed = self.paths["embeddings"] / "character-a.speaker.safetensors"
        self.assertEqual(managed.read_bytes(), b"learned-embedding")
        summary = json.loads((output / "summary.json").read_text(encoding="utf-8"))
        self.assertNotIn("text", json.dumps(summary, ensure_ascii=False))
        self.assertEqual(summary["sample_count"], 1)
        self.assertEqual(len(calls), 2)
        self.assertIn("prepare_manifest.py", calls[0][0])
        self.assertIn("train.py", calls[1][0])

    def test_generate_uses_same_checkpoint_and_managed_embedding(self):
        self.paths["embeddings"].mkdir(parents=True, exist_ok=True)
        embedding = self.paths["embeddings"] / "character-a.speaker.safetensors"
        embedding.write_bytes(b"learned-embedding")
        output = self.root / "generation"
        captured = []

        def fake_run(command, *, cwd):
            captured.append(command)
            wav_path = pathlib.Path(command[command.index("--output-wav") + 1])
            wav_path.parent.mkdir(parents=True, exist_ok=True)
            wav_path.write_bytes(b"RIFF\x04\x00\x00\x00WAVE")

        args = argparse.Namespace(
            project_root=self.root,
            output=output,
            embedding=embedding.name,
            text="生成確認です。",
            caption="落ち着いた声",
            steps=20,
            seed=1,
            caption_guidance=2.0,
            speaker_guidance=5.0,
            duration_scale=1.0,
        )
        with mock.patch.object(pipeline, "_run", side_effect=fake_run):
            pipeline.generate(args)
        command = captured[0]
        self.assertEqual(command[command.index("--checkpoint") + 1], str(self.paths["model"]))
        self.assertEqual(command[command.index("--ref-embed") + 1], str(embedding))
        self.assertTrue(any(path.suffix == ".wav" for path in output.iterdir()))


if __name__ == "__main__":
    unittest.main()

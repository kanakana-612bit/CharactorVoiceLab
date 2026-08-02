import json
import pathlib
import shutil
import sys
import unittest
import uuid


ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import speaker_inversion_prepare_local as prepare_local


class SpeakerInversionPrepareLocalTest(unittest.TestCase):
    def setUp(self):
        self.root = ROOT / "tests" / f"_local_manifest_{uuid.uuid4().hex}"
        self.root.mkdir(parents=True)

    def tearDown(self):
        shutil.rmtree(self.root, ignore_errors=True)

    def test_source_rows_preserve_local_path_and_transcript(self):
        source = self.root / "source.jsonl"
        source.write_text(
            json.dumps({"audio": "/tmp/voice.wav", "text": "テストです。"}, ensure_ascii=False)
            + "\n",
            encoding="utf-8",
        )
        self.assertEqual(
            prepare_local._load_source_rows(source),
            [{"audio": "/tmp/voice.wav", "text": "テストです。"}],
        )

    def test_empty_source_is_rejected(self):
        source = self.root / "source.jsonl"
        source.write_text("", encoding="utf-8")
        with self.assertRaisesRegex(prepare_local.LocalManifestError, "At least one"):
            prepare_local._load_source_rows(source)

    def test_incomplete_source_row_is_rejected_without_echoing_transcript(self):
        source = self.root / "source.jsonl"
        source.write_text(json.dumps({"audio": "voice.wav"}) + "\n", encoding="utf-8")
        with self.assertRaisesRegex(prepare_local.LocalManifestError, "requires audio and text"):
            prepare_local._load_source_rows(source)

    def test_upstream_source_is_added_to_import_path(self):
        upstream = self.root / "Irodori-TTS"
        (upstream / "irodori_tts").mkdir(parents=True)
        source_text = str(upstream.resolve())
        try:
            resolved = prepare_local._add_upstream_import_path(upstream)
            self.assertEqual(resolved, upstream.resolve())
            self.assertEqual(sys.path[0], source_text)
        finally:
            if source_text in sys.path:
                sys.path.remove(source_text)

    def test_missing_upstream_source_is_rejected(self):
        with self.assertRaisesRegex(prepare_local.LocalManifestError, "source was not found"):
            prepare_local._add_upstream_import_path(self.root / "missing")


if __name__ == "__main__":
    unittest.main()

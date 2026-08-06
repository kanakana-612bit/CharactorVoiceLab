import sys
import unittest
from pathlib import Path

from speaker_inversion_compute_launcher import forwarded_arguments, prepare_target_import_path


class SpeakerInversionComputeLauncherTest(unittest.TestCase):
    def test_end_of_options_marker_is_removed_before_target_dispatch(self):
        self.assertEqual(
            forwarded_arguments(["--", "--checkpoint", "model.safetensors"]),
            ["--checkpoint", "model.safetensors"],
        )

    def test_plain_positional_arguments_are_preserved(self):
        self.assertEqual(forwarded_arguments(["input.json"]), ["input.json"])

    def test_target_parent_is_first_import_path(self):
        target = Path(__file__).resolve()
        original = list(sys.path)
        try:
            source = prepare_target_import_path(target)
            self.assertEqual(source, target.parent)
            self.assertEqual(sys.path[0], str(target.parent))
        finally:
            sys.path[:] = original


if __name__ == "__main__":
    unittest.main()

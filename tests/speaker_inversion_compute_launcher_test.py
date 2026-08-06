import unittest

from speaker_inversion_compute_launcher import forwarded_arguments


class SpeakerInversionComputeLauncherTest(unittest.TestCase):
    def test_end_of_options_marker_is_removed_before_target_dispatch(self):
        self.assertEqual(
            forwarded_arguments(["--", "--checkpoint", "model.safetensors"]),
            ["--checkpoint", "model.safetensors"],
        )

    def test_plain_positional_arguments_are_preserved(self):
        self.assertEqual(forwarded_arguments(["input.json"]), ["input.json"])


if __name__ == "__main__":
    unittest.main()

import pathlib
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[1]


class LinuxLauncherStaticTest(unittest.TestCase):
    def test_patch_application_does_not_silently_fail_on_post_apply_grep(self):
        setup = (ROOT / "scripts" / "setup_audio_cpp.sh").read_text(encoding="utf-8")
        function = setup.split("apply_speaker_inversion_patch() {", 1)[1].split(
            "\n}\n\nfind_cuda_nvcc()", 1
        )[0]
        self.assertIn("git -C \"$SOURCE_ROOT\" apply \"$SPEAKER_INVERSION_PATCH\"", function)
        self.assertIn('source_patch_is_applied "$SPEAKER_INVERSION_PATCH"', function)
        self.assertIn("return 0", function)
        self.assertNotIn(
            'grep -Fq -- "$SPEAKER_INVERSION_MARKER" "$target" &&',
            function,
        )

    def test_parent_launcher_reports_audio_setup_failure(self):
        launcher = (ROOT / "scripts" / "bootstrap_webui.sh").read_text(encoding="utf-8")
        self.assertIn('if ! bash "$SCRIPT_DIR/setup_audio_cpp.sh" "${SETUP_ARGS[@]}"; then', launcher)
        self.assertIn("audio.cpp setup failed", launcher)


if __name__ == "__main__":
    unittest.main()

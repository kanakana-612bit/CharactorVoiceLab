import pathlib
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[1]


class LinuxLauncherStaticTest(unittest.TestCase):
    def test_patch_application_is_isolated_and_validates_source_markers(self):
        setup = (ROOT / "scripts" / "setup_audio_cpp.sh").read_text(encoding="utf-8")
        function = setup.split("apply_speaker_inversion_patch() {", 1)[1].split(
            "\n}\n\nfind_cuda_nvcc()", 1
        )[0]
        helper = setup.split("source_patch_is_applied() {", 1)[1].split(
            "\n}\n\napply_speaker_inversion_patch()", 1
        )[0]
        self.assertIn('git -C "$PROJECT_ROOT" apply', helper)
        self.assertIn('--reverse --check --directory="$SOURCE_ROOT_RELATIVE"', helper)
        self.assertIn('--check --directory="$SOURCE_ROOT_RELATIVE"', helper)
        self.assertNotIn('git -C "$SOURCE_ROOT" apply', helper)
        self.assertIn('source_patch_is_applied "$SPEAKER_INVERSION_PATCH"', function)
        self.assertIn('apply_source_patch "$SPEAKER_INVERSION_PATCH"', function)
        self.assertIn("source marker is missing after patch application", function)
        self.assertIn("return 0", function)

    def test_audio_source_patch_directory_is_anchored_to_project_root(self):
        setup = (ROOT / "scripts" / "setup_audio_cpp.sh").read_text(encoding="utf-8")
        self.assertIn('SOURCE_ROOT_RELATIVE="${SOURCE_ROOT#"$PROJECT_ROOT/"}"', setup)
        self.assertIn(
            '[[ "$SOURCE_ROOT" != "$PROJECT_ROOT/"* ]]',
            setup,
        )

    def test_parent_launcher_reports_audio_setup_failure(self):
        launcher = (ROOT / "scripts" / "bootstrap_webui.sh").read_text(encoding="utf-8")
        self.assertIn('if ! bash "$SCRIPT_DIR/setup_audio_cpp.sh" "${SETUP_ARGS[@]}"; then', launcher)
        self.assertIn("audio.cpp setup failed", launcher)

    def test_feature_rebuild_cleans_stale_cmake_artifacts(self):
        setup = (ROOT / "scripts" / "setup_audio_cpp.sh").read_text(encoding="utf-8")
        self.assertIn('[[ -f "$BUILD_ROOT/CMakeCache.txt" ]]', setup)
        self.assertIn(
            '"$VENV_BIN/cmake" --build "$BUILD_ROOT" --target clean --parallel "$JOBS"',
            setup,
        )
        self.assertLess(
            setup.index('"$VENV_BIN/cmake" --build "$BUILD_ROOT" --target clean'),
            setup.index("bash ./scripts/build_linux.sh"),
        )

    def test_feature_rebuild_checks_disk_space_after_cleaning(self):
        setup = (ROOT / "scripts" / "setup_audio_cpp.sh").read_text(encoding="utf-8")
        self.assertIn('MIN_BUILD_FREE_DISK_GIB="${CVD_MIN_BUILD_FREE_DISK_GIB:-8}"', setup)
        self.assertIn('require_build_disk_space "$RUNTIME_ROOT"', setup)
        self.assertIn("Insufficient disk space for the audio.cpp build.", setup)
        self.assertLess(
            setup.index('"$VENV_BIN/cmake" --build "$BUILD_ROOT" --target clean'),
            setup.index('require_build_disk_space "$RUNTIME_ROOT"'),
        )
        self.assertLess(
            setup.index('require_build_disk_space "$RUNTIME_ROOT"'),
            setup.index("bash ./scripts/build_linux.sh"),
        )


if __name__ == "__main__":
    unittest.main()

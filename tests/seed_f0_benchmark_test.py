import shutil
import unittest
import uuid
from unittest import mock

import seed_f0_benchmark as benchmark


class SeedF0BenchmarkMathTest(unittest.TestCase):
    def test_semitone_error_is_log_frequency_distance(self):
        self.assertAlmostEqual(benchmark.semitone_error(220, 220), 0)
        self.assertAlmostEqual(benchmark.semitone_error(440, 220), 12)
        self.assertAlmostEqual(benchmark.semitone_error(110, 220), 12)

    def test_correlations_capture_seed_order(self):
        self.assertAlmostEqual(benchmark.pearson_correlation([1, 2, 3], [2, 4, 6]), 1)
        ranked = benchmark.pearson_correlation(
            benchmark.average_ranks([100, 300, 200]),
            benchmark.average_ranks([10, 30, 20]),
        )
        self.assertAlmostEqual(ranked, 1)

    def test_summary_reports_screening_regret(self):
        trials = [
            {"seed": 10, "low": {"median_f0_hz": 199}, "final": {"median_f0_hz": 230}},
            {"seed": 11, "low": {"median_f0_hz": 190}, "final": {"median_f0_hz": 201}},
            {"seed": 12, "low": {"median_f0_hz": 220}, "final": {"median_f0_hz": 220}},
        ]
        summary = benchmark.summarize_trials(trials, 200)
        self.assertEqual(summary["selected_by_low_steps"]["seed"], 10)
        self.assertEqual(summary["oracle_selected_by_final_steps"]["seed"], 11)
        self.assertGreater(summary["selection_regret_semitones"], 0)


class SeedF0BenchmarkConfigTest(unittest.TestCase):
    def test_profile_defaults_use_identity_and_adapter(self):
        defaults = benchmark.profile_defaults(
            {
                "voice_control_profile": {
                    "identity_anchor": {"f0_mean_hz": 225, "speaking_rate": 1.25},
                    "tts_adapters": {"audio_cpp": {"caption_ja": "test caption"}},
                },
                "tts_configuration": {
                    "selected_model": "irodori-vdes",
                    "seed": 42,
                    "caption_guidance_scale": 2.5,
                },
            }
        )
        self.assertEqual(defaults["target_f0_hz"], 225)
        self.assertEqual(defaults["caption"], "test caption")
        self.assertEqual(defaults["seed_start"], 42)
        self.assertAlmostEqual(defaults["duration_scale"], 0.8)

    def test_request_explicitly_disables_postprocess(self):
        config = {
            "model": "irodori-vdes",
            "text": "test",
            "caption": "caption",
            "duration_scale": 1,
            "caption_guidance_scale": 2,
        }
        request = benchmark.request_payload(config, seed=42, steps=4)
        self.assertEqual(request["seed"], 42)
        self.assertEqual(request["num_inference_steps"], 4)
        self.assertFalse(request["postprocess"]["f0"]["enabled"])

    def test_remote_bridge_is_rejected(self):
        with self.assertRaises(ValueError):
            benchmark.normalize_bridge_url("https://example.com")

    def test_run_writes_paired_reproducibility_artifacts(self):
        config = {
            "sample_count": 2,
            "seed_start": 10,
            "low_steps": 4,
            "final_steps": 40,
            "analysis_seconds": 3,
            "target_f0_hz": 200,
            "bridge_url": "http://127.0.0.1:8765",
            "model": "irodori-vdes",
            "text": "test",
            "caption": "caption",
            "duration_scale": 1,
            "caption_guidance_scale": 2,
        }
        measurements = iter([190.0, 210.0, 198.0, 205.0])

        def fake_measurement(_wav, maximum_seconds):
            self.assertEqual(maximum_seconds, 3)
            return {
                "median_f0_hz": next(measurements),
                "voiced_frame_ratio": 0.9,
                "source_duration_seconds": 3.0,
            }

        output = benchmark.PROJECT_ROOT / "tmp" / f"seed-f0-test-{uuid.uuid4().hex}"
        try:
            with (
                mock.patch.object(benchmark, "generate_wav", return_value=b"RIFF-test"),
                mock.patch.object(benchmark, "analyze_wav_f0", side_effect=fake_measurement),
            ):
                summary = benchmark.run_benchmark(config, output, 10)
            self.assertEqual(summary["complete_pairs"], 2)
            self.assertTrue((output / "experiment.json").is_file())
            self.assertTrue((output / "trials.csv").is_file())
            self.assertTrue((output / "summary.json").is_file())
            self.assertEqual(len(list((output / "audio").glob("*.wav"))), 4)
        finally:
            shutil.rmtree(output, ignore_errors=True)


if __name__ == "__main__":
    unittest.main()

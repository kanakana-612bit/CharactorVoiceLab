import unittest

import step_stability_benchmark as benchmark


def record(value):
    return {
        "source_and_prosody": {"median_hz": value, "std_hz": value / 10},
        "acoustic_timbre_proxy": {
            "spectral_centroid_hz": value * 10,
            "spectral_flatness": 0.1,
        },
        "delivery_style": {"active_speech_ratio": 0.8},
        "waveform_quality": {"duration_seconds": 3},
    }


class StepStabilityBenchmarkTest(unittest.TestCase):
    def test_distance_is_zero_for_same_record(self):
        distance = benchmark.proxy_distance(record(200), record(200))
        self.assertEqual(distance["combined_proxy_distance"], 0)
        self.assertFalse(distance["speaker_identity_claim"])

    def test_earliest_stable_requires_current_and_all_later_steps(self):
        measurements = [
            {
                "steps": step,
                "distance_to_step20": {"combined_proxy_distance": distance},
            }
            for step, distance in [(4, 3.0), (8, 2.4), (12, 2.6), (16, 0.5), (20, 0)]
        ]
        self.assertEqual(benchmark.earliest_stable_step(measurements), 16)

    def test_summary_keeps_common_prefix_disabled_without_native_timing(self):
        trials = []
        for seed in (1, 2):
            measurements = [
                {
                    "steps": step,
                    "generation_seconds": step / 10,
                    "distance_to_step20": {
                        "combined_proxy_distance": 3.0 if step == 4 else 0.5
                    },
                }
                for step in benchmark.STEPS
            ]
            trials.append({"seed": seed, "measurements": measurements})
        summary = benchmark.summarize_trials(trials)
        self.assertTrue(summary["early_identity_proxy_consistent_by_12_steps"])
        self.assertFalse(summary["native_shared_prefix_snapshot_available"])
        self.assertEqual(
            summary["common_prefix_two_branch_adoption"],
            "not_yet_justified",
        )
        self.assertEqual(
            summary["adoption_gate"]["current_result"],
            "blocked_by_missing_native_shared_prefix_measurement",
        )


if __name__ == "__main__":
    unittest.main()

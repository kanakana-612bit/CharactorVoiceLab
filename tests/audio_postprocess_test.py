import io
import math
import unittest
import wave

from audio_postprocess import correct_wav_f0, psola_available


@unittest.skipUnless(psola_available(), "pyworld and praat-parselmouth are not installed")
class PsolaF0CorrectionTest(unittest.TestCase):
    def test_median_f0_moves_to_target_without_duration_change(self):
        import numpy as np

        sample_rate = 48000
        duration_seconds = 1.2
        source_hz = 300.0
        time = np.arange(round(sample_rate * duration_seconds), dtype=np.float64) / sample_rate
        samples = sum(np.sin(2 * math.pi * source_hz * harmonic * time) / harmonic for harmonic in range(1, 9))
        samples *= 0.18 / np.max(np.abs(samples))
        fade = min(round(sample_rate * 0.03), samples.size // 2)
        samples[:fade] *= np.linspace(0, 1, fade)
        samples[-fade:] *= np.linspace(1, 0, fade)

        source = io.BytesIO()
        with wave.open(source, "wb") as target:
            target.setnchannels(1)
            target.setsampwidth(2)
            target.setframerate(sample_rate)
            target.writeframes(np.round(samples * 32767).astype("<i2").tobytes())

        corrected, metadata = correct_wav_f0(source.getvalue(), target_hz=210.0, strength=1.0)
        with wave.open(io.BytesIO(corrected), "rb") as result:
            self.assertEqual(result.getframerate(), sample_rate)
            self.assertEqual(result.getnframes(), samples.size)
        self.assertAlmostEqual(metadata["target_hz"], 210.0, delta=0.01)
        self.assertAlmostEqual(metadata["output_hz"], 210.0, delta=3.0)
        self.assertLess(metadata["applied_semitones"], -5.0)


if __name__ == "__main__":
    unittest.main()

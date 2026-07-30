# Voice Evaluation Protocol

## Scope

`evaluate_voice.py` evaluates WAV outputs locally and writes:

- `evaluation.json`: complete machine-readable measurements and provenance;
- `features.csv`: flattened numeric features for statistical analysis;
- `EVALUATION_REPORT.md`: a compact human-readable summary.

The built-in evaluator does not identify a person. It separates four measurement groups:

1. **Source and prosody**: WORLD F0 distribution, contour tendency, and target error.
2. **Acoustic timbre proxy**: spectral centroid, roll-off, flatness, tilt, band ratios, and MFCC-like descriptors.
3. **Delivery style**: activity, pauses, level dynamics, and optional characters per second.
4. **Waveform quality**: peak, RMS, clipping, DC offset, zero crossing, and discontinuity warnings.

These are engineering comparison proxies. They are not clinical measurements, and no
metric should be interpreted as a diagnosis, age estimate, disease estimate, or proof
of speaker identity.

## Basic Use

```bash
./evaluate_voice.sh \
  --input output_wavs \
  --reference reference_wavs \
  --manifest evaluation_manifest.json \
  --target-f0 220
```

Windows:

```powershell
.\evaluate_voice.bat --input output_wavs --reference reference_wavs --target-f0 220
```

The input and reference options accept either WAV files or directories and may be
repeated. The default output is an ignored timestamped directory under
`evaluation_results/`.

## Manifest and Observation Link

An optional manifest associates generated files with evaluation text and the opt-in
generation observation record:

```json
{
  "items": [
    {
      "file": "candidate-01.wav",
      "text_id": "N1",
      "text": "今日は静かな部屋で、短い文章を読みます。",
      "target_f0_hz": 220,
      "observation_id": "20260730T120000.000000Z-0123456789ab"
    }
  ]
}
```

When the observation record exists under `runtime/observations/`, the evaluator copies
only its generation provenance, hashes, and timing into the evaluation record. It does
not copy or store WAV data.

## Comparison Design

Use the supplied `evaluation_texts.ja.json` as a minimum regression set. It contains
project-authored neutral sentences and the public-domain K2-K7 passages that exposed
text-dependent voice drift in the existing experiments.

For a controlled run:

1. Fix model, caption, seed, inference steps, and post-processing.
2. Generate every text in the same evaluation set.
3. Repeat with one control variable changed.
4. Report each metric group separately.
5. Preserve per-file records; do not report only a single aggregate score.

Source/prosody, spectral-timbre, delivery-style, and combined proxy distances are
reported separately. Robust distances require at least three candidate/reference
records and are standardized within each evaluation run. Their absolute values are
therefore not comparable across reports with different samples.

## Optional Independent Speaker Embedding

`speechbrain-ecapa` is available only as an explicit adapter. It is disabled by
default, is not installed automatically, and does not download a model unless
`--allow-model-download` is supplied.

```bash
./evaluate_voice.sh \
  --input output_wavs \
  --reference reference_wavs \
  --speaker-backend speechbrain-ecapa \
  --speaker-model /local/path/to/spkrec-ecapa-voxceleb
```

The adapter stores only embedding dimensions, hashes, and pairwise cosine similarity
in reports. Raw embeddings are not serialized.

The reference SpeechBrain ECAPA model was trained on VoxCeleb, which is derived from
recordings of real people. Under this project's ethics policy, installing or using it
requires a separate, explicit review of the intended evaluation and redistribution
conditions. It must not be enabled merely because it is technically convenient.

Speaker-embedding similarity is model- and corpus-dependent. It is not a universal
identity threshold and must remain separate from the built-in acoustic proxy distance.

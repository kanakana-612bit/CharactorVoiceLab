# Seed F0 Screening Benchmark

## Question

This benchmark tests whether the median F0 of a low-step Irodori VoiceDesign generation predicts the median F0 produced by a final-step generation using the same seed and conditioning. It does not apply PSOLA or any other waveform pitch conversion.

The initial experiment uses:

- 10 consecutive deterministic seeds
- one fixed Japanese phrase of approximately three seconds
- 4 inference steps for screening
- 40 inference steps for final generation
- identical text, caption, CaptionCFG, duration scale, model, and seed across each low/final pair
- WORLD DIO + StoneMask over at most the first three seconds

The sample count is intentionally a pilot-scale engineering test, not evidence of general model behavior.

## Run

Start the normal WebUI and audio.cpp services first. Export either the voice-control profile JSON, the full profile JSON, or the project ZIP from CharacterVoiceDesigner.

Windows:

```powershell
.\benchmark_f0.bat --profile "path\to\profile.json"
```

Linux:

```bash
bash ./benchmark_f0.sh --profile "/path/to/project.zip"
```

The benchmark automatically reads the active local bridge port from `runtime/webui.state.json`. Explicit overrides remain available:

```bash
bash ./benchmark_f0.sh \
  --profile profile.json \
  --samples 10 \
  --seed-start 20260719 \
  --low-steps 4 \
  --final-steps 40 \
  --analysis-seconds 3 \
  --target-f0 220
```

## Outputs

Results are written under `benchmark_results/YYYYMMDD-HHMMSS-seed-f0/`:

- `experiment.json`: complete generation and analysis conditions, profile filename, and profile SHA-256
- `audio/*.wav`: unmodified low-step and final-step audio for every seed
- `trials.csv`: one row per paired seed for analysis in spreadsheet/statistics software
- `trials.json`: full WORLD and timing metrics
- `summary.json`: Pearson correlation, Spearman rank correlation, low-to-final F0 error, selected seed, final-step oracle seed, and selection regret

`trials.partial.json` is updated after every successful generation so an interrupted experiment retains completed measurements.

## Primary Interpretation

The central result is `spearman_low_to_final_f0`. A strong positive rank correlation means low-step generations can rank seeds for later full-quality synthesis. Pearson correlation additionally tests approximately linear prediction of the final F0.

`selection_regret_semitones` compares the final target error of the seed selected from low-step audio with the best seed that could have been selected after generating all final-step samples. Zero is ideal.

No universal pass threshold is asserted by the implementation. A later paper should pre-register a threshold after pilot data, repeat the experiment across multiple texts and target profiles, and report confidence intervals with a larger sample.

## Published Pilot

The repository archives a provenance-checked four-interval pilot under
`benchmark_results/published/20260721-step-comparison/`. The same ten seeds,
text, caption, target F0, and 40-step comparison condition were used with
screening generations at 4, 10, 20, and 35 steps.

| Screening steps | Pearson r | Spearman rho | Mean absolute difference (semitones) | Selection regret (semitones) |
| ---: | ---: | ---: | ---: | ---: |
| 4 | 0.543666 | 0.357576 | 1.159469 | 0.000000 |
| 10 | 0.559388 | 0.369697 | 1.015292 | 0.947855 |
| 20 | 0.616062 | 0.357576 | 1.024410 | 1.366500 |
| 35 | 0.858573 | 0.624242 | 0.400001 | 0.000000 |

This pilot shows moderate overall association, but the ten- and twenty-step
screening choices did not select the final-step oracle seed. The stronger
35-step result leaves too little computation to save relative to a direct
40-step generation. These results therefore do not support multi-candidate
low-step F0 screening as the default runtime path. They motivate fixed
speaker/style conditioning and single-pass generation, with candidate
selection retained as an offline experiment.

## Limitations

- Re-running a seed at 40 steps is not continuation from a saved 4-step latent state. audio.cpp currently recomputes the generation from the same seed.
- A seed may jointly affect pitch, timbre, prosody, intelligibility, and noise. F0-only selection is not yet a complete quality score.
- WORLD measurement can fail on severely degraded or mostly unvoiced low-step output. Such failures must be reported, not silently replaced.
- A result from one phrase may not transfer to arbitrary text. Cross-text validation is required before this becomes the default generation strategy.
- Ten paired seeds are too few for a general claim or a stable confidence interval.
- The four interval runs reused the same final-step conditions. They test convergence interval, not text transfer, speaker identity, or perceptual quality.
- Generated audio and profiles remain local and are excluded from version control by default. Only explicitly curated pilot evidence is tracked under `benchmark_results/published/`.

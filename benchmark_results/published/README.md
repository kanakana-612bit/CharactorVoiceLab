# Published Benchmark Evidence

This directory contains selected benchmark artifacts retained for reproducible
analysis. Routine local runs remain ignored by Git.

## 20260721 Step Comparison

`20260721-step-comparison/` contains four pilot runs comparing low-step
screening at 4, 10, 20, and 35 steps against generation at 40 steps. Each run
contains:

- the complete text, caption, model settings, and source-profile SHA-256;
- paired unmodified WAV files for ten deterministic seeds;
- per-trial WORLD F0 and timing measurements in CSV and JSON;
- aggregate correlation, error, seed-selection, and regret metrics.

The source voice profile and all audio were synthetically generated. No
participant recording or patient-level data is included. The stored
`bridge_url` is the loopback address used by the local test bench and does not
identify an external service.

The pilot is evidence for this exact profile, phrase, seed set, and runtime
configuration only. See `BENCHMARK_PROTOCOL.md` at the repository root for the
summary and interpretation.

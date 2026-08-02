# CharacterVoiceDesigner Release Notes

## Ver 0.2 - 2026-08-02

Ver 0.2 turns the initial local voice-design prototype into a reproducible TTS
experiment workspace. It keeps the physical Character Voice Lab preview layer while
adding managed speaker conditioning, evaluation, official Speaker Inversion
experiments, and automatic generation archives.

### Added

- Compiled voice identities with separately managed Speaker, Style, and calibration
  components.
- Standard single-generation policy: 20 inference steps, one candidate, warning-only
  lightweight evaluation, and no automatic retry.
- Local experiment GUI for seed/F0, step stability, generated-voice evaluation,
  runtime observation, and Speaker Inversion compatibility.
- Pinned official Irodori-TTS v4-Small Speaker Inversion training and same-checkpoint
  generation workflow for Linux/CUDA environments.
- GUI-managed Speaker Inversion WAV selection, exact transcripts, training settings,
  progress, cancellation, learned embeddings, and generation checks.
- Automatic output-demo archives under `Outputs/YYYYMMDD/`. Each generation stores a
  paired `NNN-Identity-seed.wav` and `.json` reproducibility record.
- Output metadata for model/config identity, seed, CFG, steps, voice-quality caption,
  spoken text, postprocessing, F0 target/result, rate, duration, compiled identity,
  Speaker hashes, lightweight evaluation, WAV properties/hash, timing, and observation
  provenance.

### Changed

- Fixed Speaker Embedding selection and compiled-identity propagation through the
  managed audio.cpp path.
- Reused the server-side archived evaluation in the output UI instead of evaluating
  the same generated WAV twice.
- Isolated official v4-Small Speaker Inversion artifacts from the legacy v3/audio.cpp
  managed-speaker path. Equal tensor dimensions are not treated as model compatibility.
- Added process-group cancellation so stopping long Linux experiments also stops their
  child training or inference process.

### Privacy And Reproducibility

- Image analysis, profiles, training data, generation, postprocessing, evaluation, and
  output archives remain on the user's PC.
- `runtime/` and `Outputs/` are excluded from version control. Output JSON files contain
  full scripts and may reference biometric voice representations; review them before
  sharing.
- Initial setup and optional training-environment preparation contact upstream software
  and model distribution services. Project inputs are not included in those requests.

### Experimental Boundaries

- Official Speaker Inversion setup, training, and same-model tests require a compatible
  Linux/CUDA environment. GPU execution is not validated by the Windows test suite.
- Lightweight speaker distances and thresholds are engineering warnings, not speaker
  identification claims or validated biometric decisions.
- The official v4-Small Python generation path and legacy v3 audio.cpp VoiceDesign path
  remain separate runtimes.
- The frozen browser physical synthesizer remains a design/audition model and is not a
  complete validated articulatory speech synthesizer.

## Ver 0.1 - 2026-07-19

- Initial CharacterVoiceDesigner branch derived from Character Voice Lab.
- Appearance/profile input, voice-control anchors, local audio.cpp VoiceDesign TTS,
  direct F0 postprocessing, and one-click Windows/Linux launchers.

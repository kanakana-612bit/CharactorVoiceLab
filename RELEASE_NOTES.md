# CharacterVoiceDesigner Release Notes

## Ver 0.2 Physical Model Update - 2026-08-09

- Added a documented smooth inverse-design seed and a character-specific,
  regularized phonetic-target area controller for Japanese `/a/`.
- Restored four detectable `/a/` resonances and added target-versus-measured
  F1-F4 lines and percentage errors to the physical transfer view.
- Gated paranasal-sinus coloring through the velopharyngeal path and changed the
  oral-vowel default toward a closed velum instead of inferring leakage from sinus size.
- Strengthened `/n/` place identity at the continuous voiced release by adapting
  the character-derived coronal A(x) toward a tract-length-scaled historical
  alveolar F2 locus. The target and before/after resonances are exported for
  inspection; `/m/`, the nasal hold, and the glottal source remain unchanged.
- Moved the untouched `/n/` default contact from x/L 0.88 to 0.86, retained more
  tongue-blade shaping for central/back-vowel releases, and bounded inverse A(x)
  gains to prevent `/na/` and `/nu/` from reaching the target through excessive
  whole-tract deformation. Manually tuned legacy contacts remain unchanged.
- Added a Birkholz/VocalTractLab methodology citation without importing VTL code,
  speaker geometries, area functions, recordings, or fitted coefficients.
- Documented the remaining integer tube-count quantization and the current
  non-equivalence to a full VocalTractLab articulatory/acoustic model.

## Ver 0.2 Runtime Update - 2026-08-05

- Added a synchronized 44.1/48 kHz project output setting for physical previews,
  syllable exports, TTS playback/download, and locally archived output WAVs.
- `audio.cpp` no longer starts during WebUI bootstrap. The TTS Model screen starts it
  after model and compute-device selection, and replaces it when those conditions change.
- Added synchronized CPU/GPU selection to the TTS Model and Output Demo screens.
- Added explicit physical-GPU selection to Speaker Inversion training and test generation.
- Added a PyTorch allocator VRAM ceiling for Speaker Inversion and a monitored,
  stop-on-exceed VRAM safety limit for native `audio.cpp` generation.
- Generated-output metadata now records the selected compute device and VRAM policy.
- Updated the isolated Linux toolkit to CUDA 12.8 and compile all compatible detected
  architectures, including mixed `sm_86` RTX 3060 and `sm_120` RTX 5060 Ti systems.

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
- Speaker Inversion setup and job preflight now verify the locked CUDA PyTorch wheel,
  GPU visibility, and an actual CUDA tensor allocation; the GUI exposes repair diagnostics.
- Managed Speaker Inversion WAV preparation now uses direct SoundFile decoding before
  the official DACVAE codec and stops before training when any selected sample is invalid.
- Fresh Linux audio.cpp builds no longer abort silently after a successful source patch;
  the launcher now also reports child setup failures explicitly.
- A required audio.cpp feature rebuild now cleans stale CMake/Ninja artifacts first,
  preventing an old server binary from surviving with `ninja: no work to do`.
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

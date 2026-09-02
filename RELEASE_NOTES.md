# CharacterVoiceDesigner Release Notes

## Ver 0.2 Physical Model Update - 2026-08-09

- Reduced the common buzzer/woodwind bias without changing vowel or consonant
  geometry: the shared LF-like source now includes deterministic cycle jitter and
  shimmer, open-phase aspiration, and a blended two-pole spectral tilt. Distributed
  wall memory now responds to broadening/high-frequency damping, and softened
  lip/nostril radiation avoids excessive harmonic differentiation. The selected
  source, loss, and terminal-radiation models are exported as engineering metadata.
- Replaced the nearly zero-slope glottal closing flank with finite-slope closure,
  restoring upper-harmonic excitation while preserving F0 and tract geometry. Added
  bounded return-pressure modulation at the glottal boundary, reduced duplicated
  post-waveguide damping, and exposed audition-only stage bypasses for source shaping,
  source-tract coupling, distributed loss, output conditioning, side branches, and
  body resonance. The physical screen now reports rendered H1-H2, harmonic slope,
  and F1 bandwidth after each preview.
- Added a documented smooth inverse-design seed and a character-specific,
  regularized phonetic-target area controller for Japanese `/a/`.
- Restored four detectable `/a/` resonances and added target-versus-measured
  F1-F4 lines and percentage errors to the physical transfer view.
- Gated paranasal-sinus coloring through the velopharyngeal path and changed the
  oral-vowel default toward a closed velum instead of inferring leakage from sinus size.
- Strengthened `/n/` place identity at the continuous voiced release by adapting
  the character-derived coronal A(x) toward a vowel-conditioned alveolar F2
  transition target. The target and before/after resonances are exported for
  inspection; `/m/`, the nasal hold, and the glottal source remain unchanged.
- Moved the untouched `/n/` default contact from x/L 0.88 to 0.86 and bounded inverse A(x)
  gains to prevent `/na/` and `/nu/` from reaching the target through excessive
  whole-tract deformation. Manually tuned legacy contacts remain unchanged.
- Replaced the fixed alveolar F2 target with a tract-length-scaled,
  vowel-conditioned locus equation and lengthened only the untouched `/n/`
  release transition from 20 to 36 ms. This preserves the already stable `/ni/`
  and `/ne/` path while reducing excessive `/nu/` and `/no/` deformation.
- Raised the physical solver to two-times internal temporal and spatial
  resolution, followed by a Blackman-windowed sinc decimator to the selected
  44.1/48 kHz output rate. Articulatory geometry is updated at approximately
  11.025 kHz while pressure propagation retains the full internal rate. The
  internal status is visible in the physical-model UI.
- Connected each 2.5D section's width and height to section-local hydraulic
  wall-loss scaling. Nasal metadata now exports the explicit closed oral branch,
  branch volume, hydraulic diameter, and release cross-section loss provenance.
- Replaced the `/n/` oral path with a pressure-coupled graph containing separate
  midline, left-lateral, and right-lateral states between an oral split and merge.
  All three paths share a finite alveolar contact band and reconnect before lip
  radiation; `/m/` retains its bilabial single-oral-path topology.
- Preserved finite contact cells during spatial oversampling so a closed design
  cannot be reopened by interpolation between the contact and adjacent sections.
- Localized the three-channel coronal graph to the finite tongue-contact
  neighborhood. Low/back-vowel releases now lower the tongue blade before the
  tongue body reaches its vowel target, and velopharyngeal closure follows with
  a short lag, reducing persistent lateral/tap-like intervals without injecting
  a synthetic release burst.
- Retained the tract-scaled classic 1.8 kHz synthetic alveolar F2 locus as a
  lower design bound when the pooled vowel-conditioned locus equation falls
  into the weak low/back-vowel transition region. The bound is labeled as a
  synthetic-speech engineering prior rather than a biological norm.
- Added a Birkholz/VocalTractLab methodology citation without importing VTL code,
  speaker geometries, area functions, recordings, or fitted coefficients.
- Documented the reduced but remaining integer tube-count quantization and the current
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

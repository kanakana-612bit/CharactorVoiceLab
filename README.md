# CharacterVoiceDesigner

Current branch version: Ver 0.2

See [RELEASE_NOTES.md](RELEASE_NOTES.md) for the Ver 0.2 implementation scope and
known experimental boundaries. Product versions are independent from serialized
schema identifiers; existing `*_0.1` schemas remain unchanged for compatibility.

CharacterVoiceDesigner converts appearance-derived and manually designed voice features into backend-neutral identity anchors and serializable control functions. The frozen Character Voice Lab physical synthesizer remains available as the profile-audition and calibration layer.

This repository is a concept-implementation prototype of the design framework
proposed in [「身体構造推定に基づくキャラクター指向音声合成の設計枠組み」](https://doi.org/10.51094/jxiv.4033).

The **Physical Vocal-Tract Model** tab presents the frozen physical synthesizer as
one traceable pipeline: manually placed appearance landmarks, derived morphological
articulatory space, vowel-conditioned 2.5D equivalent-tube geometry, editable
`A(x)`/coronal-width functions, the lossy-tube transfer response, and the LF-style
glottal source. Its controls share the same vowel-tuning state used by the profile
and audition screens. Internal tongue, sinus, and cross-sectional contours remain
synthetic design guides; the UI does not claim that they were observed in the
reference image.

## One-click Windows setup

On 64-bit Windows 10 or 11, clone or extract the repository and run:

```bat
webui.bat
```

The first launch prepares everything under the ignored `runtime/` directory:

- project-local Python 3.12
- the tested official Windows x64 CPU `audio.cpp` balance runtime (`release-0.3-qwen3-tts`)
- the Japanese VoiceDesign inference model, tokenizer, and codec
- WORLD analysis and Praat PSOLA dependencies for direct F0 correction

No Visual Studio, CMake, CUDA Toolkit, system Python, or pre-existing `audio.cpp` checkout is required. An internet connection is required on the first run. It downloads several gigabytes and should be started with at least 10 GB of free disk space. Later launches validate and reuse the local environment without downloading it again.

The launcher starts the loopback-only WebUI and opens it. `audio.cpp` is started only after a model and compute device are selected in the TTS Model tab; changing those conditions replaces the previous server process. Run `stop_webui.bat` to stop only the processes owned by the launcher. Logs are stored in `runtime/logs/`.

Analysis, profile handling, speech generation, and F0 correction run only on loopback-bound services on the user's PC. A browser Content Security Policy restricts API connections to the same local origin, and the bridge rejects non-loopback bind and upstream addresses. Reference images, profile values, input text, and generated audio are not uploaded. First setup and updates do contact upstream distribution services to download software and model files; project data is not included in those requests.

## One-click Linux setup

The target baseline is Ubuntu 22.04/24.04 x86_64. Current glibc-based x86_64 and ARM64 distributions are supported on a best-effort basis.

```bash
chmod +x webui.sh stop_webui.sh
./webui.sh
```

The pinned audio.cpp release does not publish a Linux prebuilt package. On the first launch, the script therefore:

- prepares project-local Python 3.12, CMake, Ninja, and the audio post-processing dependencies
- detects a compatible NVIDIA GPU and otherwise selects the optimized CPU backend
- downloads the pinned audio.cpp source and builds with native CPU kernels and llamafile SGEMM
- installs a pinned micromamba executable and a conda-forge GCC/G++ 13 toolchain with a glibc 2.28 compatibility sysroot under `runtime/toolchains/` when no compatible compiler is present; an older project-local 2.17 sysroot is repaired automatically because CUDA 12.8 libraries require newer GLIBC symbols at link time
- for NVIDIA inference, installs the tested CUDA Toolkit 12.8 dependency set under `runtime/toolchains/cuda128/` and builds for every compatible detected compute capability
- installs the same VoiceDesign model set used by the Windows launcher

The CUDA path is supported on Linux x86_64 with compute capability 7.5 or newer. Driver 580.173.02 is the current project baseline, paired with the pinned project-local CUDA Toolkit 12.8. The `CUDA Version: 13.0` value reported by `nvidia-smi` describes driver capability rather than the toolkit used to compile this application. CUDA 12.8 is required because it adds native `sm_120` compiler support for Blackwell GPUs; see NVIDIA's [CUDA 12.8 release notes](https://docs.nvidia.com/cuda/archive/12.8.0/cuda-toolkit-release-notes/index.html) and [GPU compute-capability table](https://developer.nvidia.com/cuda/gpus). The launcher follows NVIDIA's [isolated Conda environment guidance](https://docs.nvidia.com/cuda/cuda-installation-guide-linux/#conda-installation) and never installs or replaces the NVIDIA driver or system CUDA. A detected RTX 3060/RTX 5060 Ti pair is compiled for `sm_86;sm_120`, and either physical GPU can be selected independently in the WebUI. Keep at least 6 GiB of GPU memory free before inference; the launcher warns when less is available.

The Linux launcher does not replace the system compiler and does not require `sudo` for its compiler or CUDA toolchains. Allow additional time for the initial native build and use at least 20 GB of free disk space for a CUDA setup. Later launches reuse the toolchains, build, models, runtime manifest, and validated WebUI process records. Run `./stop_webui.sh` to stop only launcher-owned processes. Use `./webui.sh --no-browser` on a headless machine; the local URL is printed to the terminal.

Backend and performance overrides are environment variables:

```bash
CVD_BACKEND=cuda ./webui.sh       # require CUDA; fail instead of falling back
CVD_BACKEND=cpu ./webui.sh        # force the optimized CPU build
CVD_INFERENCE_THREADS=10 ./webui.sh
CVD_CUDA_ARCHITECTURES=86 ./webui.sh
```

Without an override, `CVD_BACKEND=auto` selects CUDA when the driver and GPU pass validation, then falls back to CPU when they do not. The default thread count is the smaller of 10 and the detected physical core count.

Every launch verifies that `pyworld` and `praat-parselmouth` can actually be loaded, not merely that their packages are installed. The local environment pins `pyworld` and retains the compatible `setuptools` provider required by Linux source builds. If F0 correction fails after an update, run `./stop_webui.sh` followed by `./webui.sh`; the launcher repairs the local packages and reloads the WebUI bridge. The exact native-import diagnostics can be checked with `runtime/mm/bin/python audio_postprocess.py --check`.

Model weights and executable packages are downloaded from their upstream projects and are not redistributed in this repository. License, attribution, redistribution, and model-use conditions are listed in [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md). A populated `runtime/` directory must not be redistributed without preserving all upstream licenses and reviewing its complete transitive dependency inventory.

## Synthetic sample

The [`samples/`](samples/) directory contains a loadable profile package and a
corresponding synthesized WAV for a wholly synthetic character. The reference
images were generated with Stable Diffusion; their embedded generation prompt,
model identifiers, hashes, and seeds are retained as provenance. No real-person
image, voice recording, medical record, or participant-level dataset is used in
the sample.

## Manual and advanced startup

The TTS adapter exposes two separately versioned local backends. The established `irodori-vdes` path uses the managed `audio.cpp` server and Irodori v3 VoiceDesign. The experimental `irodori-v4-small` path uses a resident worker built on the pinned official Irodori-TTS Python runtime prepared by the Speaker Inversion environment. Selecting a backend stops the other managed runtime before loading the selected model; repeated v4 generation reuses the already loaded model. The browser does not load native inference code or model weights. `designer_server.py` validates both request forms and keeps them on the local machine.

The model selector shows each backend's capability contract. v4-Small supports text, caption, documented emoji tokens, no-reference generation, and same-checkpoint Speaker Inversion embeddings. The first normal-output integration does not yet expose multi-WAV reference conditioning, although the pinned upstream CLI supports a combined reference duration of up to 120 seconds. Caption and emoji effects are learned conditions, not direct physical controls.

Normal v3 generation can use CPU only or one explicitly selected physical NVIDIA GPU. The generation VRAM value is a monitored safety ceiling: `audio.cpp` is stopped if observed process VRAM exceeds it. It is not a CUDA allocator reservation and can briefly cross the threshold before the monitor reacts. Official v4 generation and Speaker Inversion training currently require CUDA and use PyTorch's per-process allocator fraction, so their selected VRAM ceiling is applied before model or optimizer allocation.

Every archived output records the backend implementation, source/model identifiers, resolved checkpoint hash when locally available, tokenizer, codec, condition modes, CFG values, watermark declaration state, and a backend-neutral matched-condition hash. The hash allows v3/v4 A/B outputs to be grouped without treating the models as physically equivalent.

Normal TTS generation is deliberately fixed to **20 inference Steps and one
candidate**. The returned WAV is analyzed locally for F0, waveform quality, and
lightweight within-character acoustic distance. The current policy only displays
warnings: it does not discard the result or retry automatically. A maximum of one
retry remains disabled until calibration data demonstrate that the warning threshold
is reliable.

The **Compile Voice Identity** operation stores and links three distinct local
components:

- a managed Speaker condition, when the selected model supports it;
- a Style snapshot derived from the current VoiceControlProfile;
- user-selected calibration WAV analyses.

The compiled manifest records model compatibility and the fixed generation policy.
Speaker tensors, Style JSON, calibration WAVs, and compiled manifests remain separate
under ignored `runtime/` directories. Compiled proxy distances are engineering
warnings, not speaker-identification claims.

### Official Speaker Inversion training

The **TTS Model** tab also provides an isolated, Linux/CUDA Speaker Inversion workflow.
It accepts multiple local WAV files with an exact transcript for each file, prepares
the official latent manifest, trains only the speaker tokens, and tests the resulting
`.speaker.safetensors` with the same `Aratako/Irodori-TTS-v4-Small` checkpoint.

The first **Prepare training environment** operation clones the official
`Aratako/Irodori-TTS` repository at commit
`d48dd92b943fa5dbcb88150eb974c25d8709df9b`, installs its locked `cu128` environment,
and downloads v4-Small under ignored `runtime/speaker_inversion/`. It does not alter
the system CUDA installation or NVIDIA driver. The TTS Model tab selects the physical
training GPU and applies an optional PyTorch VRAM ceiling before any upstream model
allocation. Training defaults to the official
16-token, `0.01` learning-rate recipe with 3000 steps, while using batch size 1 as a
conservative RTX 3060 baseline.

Managed local training WAVs are decoded with the locked SoundFile dependency and
passed directly to the official DACVAE codec. This deliberately avoids the generic
Hugging Face Datasets/TorchCodec audio iterator for this local-only workflow, while
retaining the official text normalization, latent manifest format, codec, checkpoint,
and training implementation. Any WAV decode or codec failure names the affected file,
and training cannot begin unless every selected sample produced a valid latent.

Setup is considered complete only after the isolated PyTorch reports a CUDA build,
sees an NVIDIA device, and completes a small CUDA tensor allocation. If an older CPU
PyTorch wheel remains in the environment, the same GUI setup operation reinstalls the
locked `cu128` torch packages. The TTS Model tab reports the detected GPU, PyTorch
version, and a repair reason when this preflight fails. The same check runs against the
selected physical GPU immediately before official training and generation, so a stale
environment or hidden device cannot start a long job.

Training audio and transcripts remain under the ignored local runtime and are never
sent through the CharacterVoiceDesigner API to an external service. The upstream
setup necessarily contacts GitHub, PyPI/package indexes, and Hugging Face to install
code, dependencies, and model files. A learned embedding is a compact biometric voice
representation: use only recordings for which the speaker has explicitly permitted
this purpose, and protect or delete the resulting local artifacts accordingly.

Speaker Inversion artifacts from this workflow are kept separate from the legacy
v3/audio.cpp managed-speaker directory. The application will not silently use a
v4-Small embedding with the v3 VoiceDesign model merely because both expose a
768-dimensional speaker state.

To start only the WebUI bridge:

```powershell
.\scripts\start_designer.ps1
```

Then open `http://127.0.0.1:8765/`. The image, landmark, physical-profile, and export features remain usable while audio.cpp is offline.

To prepare and start audio.cpp manually:

```powershell
.\scripts\setup_audio_cpp.ps1 -Backend cpu -InstallModel
.\scripts\start_audio_cpp.ps1
```

The setup also installs `pyworld` and `praat-parselmouth` in the local runtime
for optional direct F0 normalization. WORLD measures the voiced contour and
Praat PSOLA moves its median to the VoiceControlProfile target without
vocoder-resynthesizing the complete waveform.

The setup keeps only the inference model, tokenizer, and codec. Model-card
demonstration audio downloaded by the upstream model manager is removed and is
not used by CharacterVoiceDesigner.

Use `-Backend cuda` when a supported NVIDIA GPU and current driver are available. Model weights and the audio.cpp runtime are stored under ignored `runtime/` paths and are never included in project packages.

The default Windows setup path downloads the official `balance` prebuilt package, so Visual Studio, CMake, and Ninja are not required. `-BuildFromSource` is available when a custom build is needed. CUDA prebuilts require a compatible NVIDIA GPU/driver but not the CUDA Toolkit. The Windows launcher retains its CPU baseline; the Linux launcher selects its isolated CUDA 12.8 build automatically when compatible hardware is available.

The implementation roadmap is tracked in `IMPLEMENTATION_PLAN.md`.
Literature and dataset gaps are tracked in `EVIDENCE_GAPS.md`.
Source permissions and allowed evidence roles are tracked in `SOURCE_ETHICS_AUDIT.md`.

## Local generation observation

The TTS bridge provides an opt-in, local-only observation record for controlled
experiments. It records request hashes and settings, model architecture
metadata, generation timing, returned-WAV hashes and PCM metadata, and optional
WORLD F0 statistics. It does not copy the generated audio and does not retain
text or caption values by default.

The patched audio.cpp runtime exposes only a SHA-256 digest, shape, and input
mode for the speaker state actually consumed by inference. It does not expose
raw Speaker/Caption condition tokens, intermediate latents, or Duration
Predictor output. Observation records compare a managed Speaker Inversion
artifact's canonical float32 state hash with that native digest. Other
unavailable fields remain explicitly marked unavailable instead of being
presented as inferred internal state. The API, privacy behavior, native hook
boundary, and parity smoke test are documented in
[`OBSERVATION_PROTOCOL.md`](OBSERVATION_PROTOCOL.md).

## Speaker condition reference

`speaker_condition_reference.py` and `verify_speaker_inversion.py` implement a
local, read-only compatibility boundary for Irodori Speaker Inversion files.
They verify the installed model architecture, `.speaker.safetensors` contract,
artifact provenance, and the inspected audio.cpp input path as separate layers.

The installed VoiceDesign model is structurally compatible with a
`speaker_embedding` tensor of shape `(tokens, 768)`. The current audio.cpp
release binary does not accept that tensor directly. CharacterVoiceDesigner
therefore carries a pinned source patch that adds the official direct-state
contract. Linux setup automatically rebuilds when the installed binary lacks
the direct-input or safe-observation feature marker, including upgrading an
earlier direct-input-only source tree; Windows applies the same upgrade when
`setup_audio_cpp.ps1 -BuildFromSource` is used. Unpatched release binaries
continue to work for caption-only generation and report direct inference as
unavailable.

Optimized embeddings may be placed under `runtime/speaker_conditions/` and
selected through the local speech API. The bridge accepts only a direct
filename, validates it against the selected model, and never exposes the raw
tensor. A generated format fixture is random, non-semantic test data and is
rejected for speech generation. Patched native responses expose only the
consumed state hash, shape, and input mode, allowing exact transport
verification without serializing the embedding.

The **Experiment** tab can register a `.speaker.safetensors` file without
manually locating that runtime directory. Select its matching `.speaker.json`
sidecar in the same file picker when provenance metadata is available. Every
embedding is inspected before registration. Non-semantic format fixtures remain
available to the compatibility checker but are excluded from the speech-parity
selector.

Run `verify_speaker_inversion.bat --create-format-fixture` on Windows or
`./verify_speaker_inversion.sh --create-format-fixture` on Linux. Results are
written under the ignored `speaker_condition_results/` directory. The exact
contract, current result, and native acceptance criteria are documented in
[`SPEAKER_CONDITION_COMPATIBILITY.md`](SPEAKER_CONDITION_COMPATIBILITY.md).

Terminology:

- `center`: character-specific baseline value.
- `resting_anatomical_state`: resting/no-phonation baseline state for a parameter.
- `morphological_plausibility_range`: image/statistical range that can plausibly describe the character's morphology.
- `performance_control_range`: dynamic relaxed-to-strained or low-to-high range available to acting/prosody control.
- `constraint_range`: backward-compatible alias of `performance_control_range`.
- `edit_range`: WebUI-only range for editing the baseline value.
- `statistics`: reference center and SD metadata for plausibility display.

`ConstraintRangeK` is retired in Ver 0.3. Statistical edit ranges and dynamic performance ranges are adjusted per physical parameter; a single multiplier no longer changes both concepts at once.

The legacy `tension_response_curve` preview control is also retired. It conflated local phonatory tension scaling with the separately planned neurological/autonomic response profile, which remains unimplemented.

The former `glottal_closure` and `side_branch_loss_coupling` master controls are also retired from the live model. They remain named only in one-way development migration code so older projects can be converted to explicit glottal-source and branch-local controls.

Implemented on this branch:

- workflow tabs for image/landmark input, vocal-tract profile audition, phoneme calibration, TTS model selection, and output demo
- automatic local output-demo archiving under `Outputs/YYYYMMDD/`, with paired WAV and JSON metadata named `NNN-Identity-seed`
- `character_voice_identity_function_0.1`, which keeps appearance estimates, explicit design overrides, effective anchors, confidence, and source keys separate
- serializable pitch, breathiness, energy, speaking-rate, articulation, and breath-phrase control functions
- deterministic mapping of the intermediate profile to an Irodori VoiceDesign caption, fixed seed, inference steps, caption guidance, and duration scale
- local audio.cpp model discovery and WAV generation through a validated same-origin HTTP bridge
- opt-in local generation observations with request/model provenance, timing, WAV hashes, acoustic analysis, and explicit internal-tensor availability
- backward-compatible loading of Character Voice Lab Ver 1.1 physical profiles

Each output-demo JSON records the model and model-config hash, seed, Caption CFG,
step count, voice-quality caption, full spoken text, compiled identity and Speaker
condition hashes, design F0 target, speaking rate, duration scale, F0 postprocessing
request/result, selected 44.1/48 kHz output sample rate, lightweight warning evaluation, output WAV properties and SHA-256,
generation timing, application version, and observation id. `Outputs/` is local-only
and ignored by Git because these records can contain full scripts and biometric voice
references.

- publication-oriented physical-profile workflow: basic information, detailed settings, vowel calibration, consonant calibration, and references/publication policy
- header-level profile load, `voice_profile` naming, and reproducible package save
- detailed-setting classification by design role and anatomical domain: baseline vocal tract, glottal physiology, trunk/respiration, PerformanceControlRange, execution control, and advanced acoustic preview
- per-parameter `PerformanceControlRange` editors with independently stored minimum, baseline, and maximum values
- vowel-tab-only floating phoneme selector and sample playback action
- numbered inline source citations with hover/focus scope notes and DOI links in the reference table
- full-body, face-front, and head-neck profile image loading
- manual body/face/profile landmark placement on uploaded images or built-in schematic defaults
- direct landmark dragging with a precision crosshair and hover/drag definition panel
- per-preview layer toggles for body landmarks, body schematic model, face landmarks, profile base landmarks, profile articulation-space landmarks, and 2.5D vocal-tract overlay
- AIST-based anatomical landmark terminology with front/profile cross-references
- stature-first image calibration: body height sets the full-body scale, then body-image total head height calibrates both head-front and head-profile images
- basic measurements converted to cm from height or interpupillary prior
- source-tagged cohort priors, z-scores, image/statistical fusion
- explicit basic `解析` and detail `再計算` actions; detail image-weight edits remain pending until recalculation, manual center-slider overrides return to the new estimates on either explicit action, and the last applied weight is saved in the profile
- a deformable synthetic 2.5D vocal-tract design template over the profile preview
- landmark-calibrated midsagittal height, coronal width, elliptical section shape, and latent lateral-channel capacity per tract section
- pharyngeal-length scaling connected to the 2.5D longitudinal area-function allocation rather than only to schematic drawing
- selectable 44.1/48 kHz 2.5D-derived acoustic-tube vowel preview that projects the designed cross sections to total `A(x)`, using one-sample-section Kelly-Lochbaum discretization, separate jaw-opening/oral-volume/lip-rounding vowel targets, an LF-style volume-velocity glottal input, tract-length-normalized distributed losses, velopharyngeally gated nasal/sinus coupling, simple piriform side-branch loss, and restrained soft-wall compliance
- a regularized phonetic-target area controller for Japanese `/a/`: the character-derived geometry remains the initial state, a finite-difference inverse calculation moves the physical `A(x)` toward the selected aggregate F1-F4 target, and user A(x)/W(x) edits remain a final explicit override
- vowel-specific direct editing of total area `A(x)` and coronal width `W(x)`; width edits preserve sagittal height and recompute the projected tube area
- auditory calibration workflow with untuned/tuned A/B playback, phoneme-clarity and target-match ratings, notes, and profile-persisted evaluation history
- dedicated nasal calibration for `/m/`, `/n/`, and moraic `/N/`, including oral-closure position/area/width, velopharyngeal opening, nasal-radiation contribution/path damping, hold/transition timing, direct closure-graph editing, A/B playback, and profile-persisted evaluation history
- engine-independent vowel/CV dataset export; nasal tokens use the dedicated oral/nasal path model, while non-nasal consonant onsets remain explicitly experimental placeholders
- read-only F0 derived from the reference center, vocal-fold spring constant, and baseline muscle tension
- respiratory source drive using VC/FVC, FEV1/PEF, maximum ventilation, maximum respiratory pressure, and speech-time support utilization; thoracic and abdominal volumes constrain maximum ventilation upstream
- body resonance implemented as an independent parallel branch whose thoracic-volume-derived frequency, peak gain, and wet/dry coupling are stored separately
- articulatory-control modifiers that separate phoneme gesture execution from tongue-dorsum, lip/cheek transverse, and tongue-groove PerformanceControlRange availability; availability limits a current gesture without redefining the neutral 2.5D anatomy, alongside motor precision, coarticulation strength, motor maturity, and phonological contrast maturity
- Honda-style profile anchors for ANS, PNS, Menton, posterior pharyngeal wall, soft-palate hinge, and velum tip
- morphological articulation-space guides exporting OCL, LFH, soft-palate length, velopharyngeal gap, and schematic paranasal sinus side branches
- external neck-root breadth tracking, kept independent from the tracheal internal-diameter design parameter
- no lifestyle-history, disease-history, inflammation, airway-narrowing, or pediatric intubation-depth inputs or mappings in the public implementation
- low-poly inferred body model
- baseline voice-parameter, UI edit-range, per-parameter performance-range override export, and reload
- reproducible project ZIP packages containing `manifest.json`, `profile.json`, and the selected reference images
- separate primary-language, phonetic-target-profile, and morphology-reference-population metadata; a phonetic profile is a language/variety target and is never an ancestry or ethnicity selector
- jaw-conditioned relaxed mouth-width inference that treats a stylized commissure distance as a pursed/lower-bound proxy, then supplies vowel-specific `/i/ > /e/ > /o/ > /u/` transverse targets within a PerformanceControlRange
- reference-image style selection (`illustration` by default, or `photo_realistic`) so stylized images use broader latent anatomy/articulation inference while realistic images retain more direct measurement weight
- `/a i u e o/` previews using only the selectable 44.1/48 kHz 2.5D-derived acoustic-tube model; the selected phonetic target supplies Japanese aggregate F1/F2 evaluation targets, higher-resonance engineering references, and vowel-specific articulation cues
- WAV export
- local PDF-derived growth and pediatric airway prior scaffold
- BMI calculation with age-band reference display, Japanese public aggregate body-composition guidance, formula fallback, and conservative regional skinfold-response metadata
- local anatomical landmark definition hints shown while hovering or dragging points
- simultaneous full-body front, body-composition guide, head-front, and head-profile preview layout
- reference and publication-policy tab listing source use, release status, and aggregate-only constraints

Manual landmark assumptions:

- The initial body/front/profile points are schematic defaults. They are starting handles, not inferred observations.
- Uploaded reference images are not automatically analyzed in the UI. The user places or drags every landmark manually.
- Hyoid and larynx points remain internal design proxies; they should be treated as manually controlled model anchors rather than visible external anatomy.
- ANS, PNS, posterior pharyngeal wall, soft-palate hinge, velum tip, and paranasal sinus guides are internal/profile design anchors, not directly observed anatomy from character art.
- The 2.5D tract cavity is a deformable design template, not a segmentation of internal anatomy. Frontal widths between visible anchors are linearly interpolated; palatal vault, lip-aperture aspect, and lateral-channel capacity remain explicit latent design fields.
- Heights are measured as vertical projected pixel distances and breadths as horizontal projected pixel distances. Euclidean distance is reserved for free-path geometry.
- `head_top`, `chin`, and similar internal keys remain only for backward compatibility; exported `landmark_schema` maps them to `vertex`, `gnathion`, and other canonical terms.
- `General` means that no region-specific correction is asserted. When only a regional aggregate is available, its neutral center may be retained as a widened, explicitly labeled design fallback rather than being presented as a worldwide population statistic.
- The manual placement layer is intentionally replaceable by future SMPL-X, MediaPipe Face Mesh, or custom anime landmark models, but those adapters are not active in this prototype.

Not implemented in this MVP:

- SMPL-X, MediaPipe Face Mesh, DensePose, or robust background removal
- VocalTractLab adapter
- fractional-delay or fixed-spatial-grid tube propagation; the current one-sample-section solver still quantizes tract length by integer tube count, while the `/a/` target controller mitigates the resulting category error without claiming VTL-equivalent precision
- direct low-level control of learned TTS latent variables beyond the current caption/duration adapter; exact median F0 is available only as an explicit WORLD-measured, Praat-PSOLA waveform postprocess
- direct use of newly trained v4-Small Speaker Inversion embeddings by the legacy v3/audio.cpp path; training and same-model v4-Small generation are implemented in an isolated official runtime
- validated anthropometric database
- validated mapping from external neck breadth to internal airway dimensions; the prototype deliberately does not make that inference
- participant-level linkage across external data sources
- automatic landmark extraction in the public UI

Reference status:

- VTL, F0 and formant priors are extracted from Pisanski et al. 2016 Table 1.
- The default Japanese phonetic target uses Kagomiya 2015's published adult sex-stratified aggregate F1/F2 table for neutral Japanese vowels. No source audio, token rows, speaker identifiers, or corpus records are embedded.
- Hirahara and Akahane-Yamada 2004 is retained as a public aggregate Japanese-vowel scope and acoustic-measurement reference. Mokhtari and Tanaka 2000 is methodology-only; its speaker/frame/token measurements are not runtime targets.
- Japanese F3/F4 values are currently a clearly labeled engineering extension: public Pisanski 2016 sex-class F3/F4 baselines plus vowel-shape factors. They are not presented as Japanese F3/F4 measurements.
- Adult height and weight references are extracted from Pisanski et al. 2014.
- Dediu et al. 2022, Honda 2001, and the source-map notes are used to shape the variable split and uncertainty handling.
- AIST/HQL 2003 public aggregate neck-root breadth statistics provide the current external-neck reference.
- The AIST 1991-92 anthropometry manual supplies the canonical Japanese landmark names and definitions.
- Baer et al. 1991 supports the area-function modeling concept only; subject-specific coefficients are not imported.
- Birkholz 2013 is used only to compare articulatory-synthesizer layers and motivate the separation of geometry, movement control, glottal source, and acoustic propagation. VocalTractLab code, speaker geometries, area functions, recordings, and fitted coefficients are not imported.
- Honda 2001 is used for conceptual/schema support around facial shape, oral cavity length, lower facial height, nasal/paranasal side branches, and formant-space interpretation. It is not used as a validated subject-specific predictor.
- The Japanese UHRCT tracheal study is an adult plausibility check only. It is not used to infer tracheal diameter from a character image.
- The single-individual reconstruction paper is absent from runtime references and dependencies; the exclusion decision is retained only in the source ethics audit.
- Head/face/body dimensional priors are still marked as placeholders where the bundle references a dataset, such as AIST Japanese Head Dimensions Database 2001, but does not include the numeric table.
- Local PDF-derived priors are loaded from `local_pdf_growth_priors.js`; currently encoded values cover school-age head growth endpoints, pediatric airway-length equations, tube-depth uncertainty, qualitative pediatric sinus development, and young Japanese respiratory-function equations for ages 10-20.
- Body-composition guidance currently uses a Japanese young-women aggregate body-fat-distribution paper for ages around 18, Komiya 1997 Japanese age/sex aggregate body-composition means as public engineering centers, a General adult BMI percentile fallback, and a BMI/age/sex body-fat formula fallback. The formula fallback is not a measured distribution.
- Regional skinfold response currently uses a 1996 aggregate skinfold-thickness paper only as a relative site-response guide. Its sample is not Japanese, so it must not be treated as a Japanese population center.
- Glottal-source shape, volume-velocity source-input controls, side-branch loss controls, and vocal-tract loss controls are engineering preview parameters. They use conservative human-general defaults until aggregate acoustic/biomechanical calibration sources are selected.
- Soft-wall compliance and resonance broadening are lightweight approximations used to reduce narrow, instrument-like tube peaks. They are not a substitute for a calibrated vocal-tract wall model.
- The side-branch loss model is a light output-coloring layer for paranasal sinus, velopharyngeal/nasal, and piriform-fossa antiresonance cues. It is not a measured internal anatomy solver.
- `/m/` and `/n/` now use one pressure-coupled pharyngeal/oral/nasal waveguide. A lossy three-port junction propagates one glottal source through the continuously changing oral area function and velopharyngeal-port area. `/m/` keeps a neutral tongue posture behind a bilabial end closure; `/n/` derives a tongue-blade dome and a short residual alveolar constriction from the selected contact position. Its voiced release keyframe is then regularized toward a tract-length-scaled historical 1.8 kHz alveolar F2 locus while preserving the anchored contact area and the other resonances, so the place cue persists into the vowel transition without a separate source or injected burst. The locus is an engineering prior rather than a Japanese population or individual norm. Oral and nasal terminal volume velocities are radiated and summed once, with no independent path normalization or explicit post-hoc nasal pole/zero filter. Velopharyngeal opening controls branch admittance, while the separate nasal-radiation control changes nostril radiation efficiency monotonically without resizing the branch. Playback reports hold/vowel balance, short-time F0-period continuity, low/high-energy balance, and manner-drift warnings so calibration does not depend on auditory adaptation alone. Moraic `/N/` retains its terminal hold model. All nasal and coronal geometry is synthetic character-design geometry rather than participant-derived internal anatomy.
- The 2.5D layer separates midsagittal height, coronal width, section aspect, and a latent tongue-groove/lateral-channel capacity before deriving `A(x)`. The current acoustic solver still receives only total area, so multi-channel propagation and full 3D acoustics remain future work.

Do not treat placeholder head/face/body priors as validated research data. Replace them with the selected source table before publication-grade analysis.

The initial-analysis UI no longer embeds external AIST definition figures. Landmark definitions are displayed from the local schema and should be replaced or refined with project-owned schema diagrams and book-checked wording before redistribution-focused releases.

Public release evidence policy:

- Use broadly accepted reference values, public aggregate statistics, and formula-level mappings.
- Use medical or anatomical papers only as aggregate references, generalized equations, parameter-schema support, or validity checks for computed values.
- Do not use case reports, individual patient rows, subject IDs, imaging files, row-level clinical data, or cross-table participant linkage.
- Present all embedded values as non-medical engineering priors for character voice design, not as diagnosis, treatment support, or individual biological identification.
- Treatment-oriented clinical papers may be cited only for plausibility checks. Clinical treatment values such as pediatric intubation depth are not encoded or calculated.
- Real-person images require explicit consent or another lawful basis. Do not enter medical history or other sensitive personal information.
- Analysis and synthesis stay on loopback-bound services on the user's PC; setup downloads contain no project data.

External cohort acquisition policy:

- External cohort data is not collected by this prototype.
- A new source may be added only after it is reviewed against the project ethics policy.
- Approved sources must be aggregate-only and must not include participant IDs, sample IDs, row-level records, clinical images, or cross-source linkage keys.

Regression tests:

```powershell
node tests/landmark_schema.test.js
node tests/voice_control_profile.test.js
node tests/tube_synthesis_smoke.test.js
runtime/mm/Scripts/python.exe -m unittest tests/designer_server_test.py tests/audio_postprocess_test.py
runtime/mm/Scripts/python.exe -m unittest tests/experiment_jobs_test.py
runtime/mm/Scripts/python.exe -m unittest tests/seed_f0_benchmark_test.py
runtime/mm/Scripts/python.exe -m unittest tests/step_stability_benchmark_test.py
runtime/mm/Scripts/python.exe -m unittest tests/voice_evaluator_test.py
runtime/mm/Scripts/python.exe -m unittest tests/voice_identity_test.py
```

## Experiment workspace

The **Experiment** tab beside **TTS Model** is the primary interface for local
research utilities. It runs generation-observation parity checks, Speaker
Inversion compatibility checks, Seed/F0 benchmarks, 4/8/12/16/20 Step stability
experiments, generated-voice evaluation, and dependency diagnostics without
requiring users to type filesystem paths.
Long jobs run asynchronously one at a time, with progress, logs, reports, WAV
playback, and artifact downloads available in the same tab.

Generated-voice evaluation uses a wide checklist for candidate WAV resources.
Candidates can be hidden from that list without deleting their source files and
restored later. Reference WAV files are uploaded only for the current evaluation
job and their managed temporary copies are removed when that job finishes.

WAV, profile, and manifest uploads are copied only into the ignored local
`runtime/experiment_inputs/` directory. Job records are stored under the ignored
`runtime/experiment_jobs/` directory. The server accepts only allowlisted tools
and managed resources; it does not expose a shell or arbitrary-path execution.
The command-line wrappers remain available for scripted and publication-grade
reproduction.

## Seed/F0 screening benchmark

`seed_f0_benchmark.py` runs a local two-stage pilot experiment without waveform pitch correction. By default it pairs 10 deterministic seeds at 4 and 40 inference steps, measures up to three seconds with WORLD, and writes the original WAV files plus CSV/JSON correlation results under the ignored portion of `benchmark_results/`.

Start the WebUI services, export a profile or project package, then run:

```powershell
.\benchmark_f0.bat --profile "path\to\profile.json"
```

```bash
bash ./benchmark_f0.sh --profile "/path/to/project.zip"
```

The exact protocol, metrics, interpretation, limitations, and the curated
4/10/20/35-to-40-step pilot are documented in
[`BENCHMARK_PROTOCOL.md`](BENCHMARK_PROTOCOL.md). Provenance-checked pilot
artifacts, including the generated WAV files, are archived under
[`benchmark_results/published/`](benchmark_results/published/).

## Step stability benchmark

`step_stability_benchmark.py` independently generates the same seed at 4, 8,
12, 16, and 20 Steps. It compares each predicted WAV with its 20 Step result
using local source/prosody, spectral, and delivery proxies, then reports the
earliest provisional stabilization point and measured timing.

This is an adoption test, not a shared-prefix implementation. The current
audio.cpp observation contract does not expose reusable intermediate latents.
Common-prefix two-branch generation remains disabled unless all tested voices
stabilize sufficiently early and a future native implementation is measured to
be faster than one 20 Step generation plus one retry. The tool is available
from the **Experiment** tab and stores its JSON, report, and WAV artifacts under
the ignored `benchmark_results/` directory.

## Local Voice Evaluation

`evaluate_voice.py` measures generated WAV files without uploading audio. It keeps
source/prosody, spectral-timbre proxies, delivery style, and waveform quality as
separate groups and can join results to opt-in generation observation records.

```powershell
.\evaluate_voice.bat --input "output_wavs" --reference "reference_wavs" --target-f0 220
```

```bash
./evaluate_voice.sh --input "output_wavs" --reference "reference_wavs" --target-f0 220
```

The built-in measurements are engineering comparison proxies, not speaker identity
or clinical measurements. The optional SpeechBrain ECAPA adapter is disabled by
default, is not installed or downloaded automatically, and requires a separate ethics
review because its reference model was trained on the real-person VoxCeleb corpus.
See [`EVALUATION_PROTOCOL.md`](EVALUATION_PROTOCOL.md) for the test set, manifest,
interpretation limits, and output schema.

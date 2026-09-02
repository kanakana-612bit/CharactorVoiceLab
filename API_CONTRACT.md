# CharacterVoiceDesigner API Boundary

The WebUI is intentionally independent from Open WebUI and from the native TTS runtime. The browser produces a backend-neutral `voice_control_profile`; model-specific adapters translate it at the local service boundary.
It owns only:

- image and manual landmark input
- canonical anatomical landmark definitions and cross-view image calibration
- anthropometric feature fusion
- baseline voice-parameter editing
- performance constraint-range export
- experiment profile import/export
- 2.5D vocal-tract geometry and source-assumption export
- vowel A(x)/W(x), nasal-articulation, and auditory-evaluation calibration export
- reproducible project-package import/export
- appearance-estimate and design-override separation
- serializable voice-identity control functions

## Local audio.cpp Bridge

`designer_server.py` serves the WebUI and proxies only these fixed local routes:

- `GET /api/audio-cpp/health` -> `GET http://127.0.0.1:8080/health`
- `GET /api/audio-cpp/models` -> `GET http://127.0.0.1:8080/v1/models`
- `POST /api/audio-cpp/speech` -> `POST http://127.0.0.1:8080/v1/audio/speech`
- `GET /api/runtime/observation-capabilities?model={id}` -> local observation support and expected model dimensions
- `GET /api/runtime/speaker-condition-capabilities?model={id}` -> model, file-contract, and native direct-input capability
- `GET /api/runtime/observations/{id}` -> one opt-in local generation record

The bridge accepts a configured model id, up to 5000 text characters, language, seed, inference-step count, and a small allowlist of VoiceDesign options. The upstream origin must be loopback HTTP; arbitrary URLs and unrecognized request fields are not forwarded.

An optional `observation` object is consumed entirely by the bridge and is
never forwarded to audio.cpp. Successful persistence adds an
`X-CVD-Observation-ID` response header while leaving the returned WAV bytes
unchanged. Records are local-only, do not copy the generated WAV, and hash
input text and captions unless `include_text` is explicitly enabled. The
schema and current native-runtime boundary are defined in
[`OBSERVATION_PROTOCOL.md`](OBSERVATION_PROTOCOL.md).

The speaker-condition capability route is read-only. It does not accept,
serialize, or forward raw embeddings. `speaker_inversion_direct_inference` is
reported from the inspected native binary rather than from an available source
tree. File-format validation and model dimensional compatibility must not be
presented as executable or semantic compatibility. See
[`SPEAKER_CONDITION_COMPATIBILITY.md`](SPEAKER_CONDITION_COMPATIBILITY.md).

An optional managed speaker condition may be selected for speech generation:

```json
{
  "model": "irodori-vdes",
  "input": "こんにちは。",
  "speaker_condition": {
    "file": "character-a.speaker.safetensors"
  },
  "options": {
    "caption": "落ち着いた自然な発話"
  }
}
```

The file must exist directly under `runtime/speaker_conditions/`. Nested paths,
absolute paths, malformed tensors, model-dimension mismatches, incompatible
provenance sidecars, and non-semantic format fixtures are rejected by the
Designer bridge. The bridge sets `no_ref: false` and forwards only the resolved
managed path to the loopback audio.cpp process. A patched native binary then
loads the `speaker_embedding` tensor directly and bypasses the reference-audio
encoder. The response identifies the accepted artifact with
`X-CVD-Speaker-Condition-SHA256` (legacy artifact-file hash),
`X-CVD-Speaker-Artifact-SHA256`, and
`X-CVD-Speaker-Condition-Shape`. A patched native runtime also returns:

- `X-AudioCpp-Speaker-Condition-SHA256`: SHA-256 of the exact contiguous
  float32 little-endian speaker-state bytes consumed by inference;
- `X-AudioCpp-Speaker-Condition-Shape`: the consumed `tokens x dimension`;
- `X-AudioCpp-Speaker-Condition-Mode`: `none`, `reference_audio`, or
  `speaker_inversion`.

The bridge forwards those values as `X-CVD-Speaker-State-SHA256`,
`X-CVD-Speaker-State-Shape`, and `X-CVD-Speaker-Condition-Mode`. Observation
records compare the native state hash with the canonical state hash computed
while validating the managed artifact and report `matches_input_state` as
`true`, `false`, or `null` when the native value was unavailable. Neither
headers nor observation records contain raw embedding values.

## VoiceControlProfile

`character_voice_identity_function_0.1` contains:

- `identity_anchor`: effective F0, F0 range, breathiness, spectral tilt, vocal-tract-length scale, brightness, energy, speaking rate, articulation clarity, and breath-phrase scale
- `evidence[*].appearance_estimate`: the current physical/image/statistical proxy
- `evidence[*].design_override`: an explicit user choice, or `null`
- `evidence[*].effective_value`: the value consumed by downstream adapters
- `control_functions`: backend-neutral, serializable response functions over normalized performance input
- `tts_adapters.audio_cpp`: the deterministic Irodori VoiceDesign caption and its mapping limitation

Irodori caption conditioning is an approximate interface to a learned latent space. It must not be described as direct enforcement of the exported physical parameters.

## Terminology

This project follows the paper's layer split:

- `center` is the character-specific baseline value in the baseline configuration layer.
- `resting_anatomical_state` is the character's resting/no-phonation baseline state for the parameter.
- `morphological_plausibility_range` is the range that can plausibly describe the character's morphology given image/statistical evidence. It is not a speech-movement range.
- `performance_control_range` is the dynamic range available to the dynamic state layer, acting control, or prosody control.
- `constraint_range` is retained as a backward-compatible alias of `performance_control_range`.
- `edit_range` is a WebUI-only range for adjusting the baseline value during detailed analysis.
- `statistics` stores reference-center, SD, z-score support, and plausibility-display metadata. It is not a performance range.

There is no global `ConstraintRangeK` in schema 0.3. Each dynamic range is stored and edited independently. `tension_response_curve` is retired because it conflated a local preview multiplier with the separately planned neurological/autonomic response profile. `glottal_closure` is not part of the live schema: pre-0.3 values are read only by one-way migration code and converted to explicit open quotient, speed quotient, return phase, spectral tilt, breathiness, flow smoothing, and flow inertance.

In other words, `constraint_range` is not the slider's UI range. For a muscle-tension parameter, `performance_control_range` represents the relaxed-to-strained range that the character can dynamically express around the baseline.

Articulatory-control modifiers include:

- `articulatory_range_utilization`: phoneme-gesture execution, or how much of the available PerformanceControlRange is used for the current speech target.
- `tongue_dorsum_range_utilization` and `labial_transverse_range_utilization`: available tongue and labial PerformanceControlRange. Values below neutral limit a gesture; values above neutral expand future availability but do not amplify a fixed vowel target.
- `tongue_groove_capacity`: available tongue-groove and lateral-channel PerformanceControlRange for the 2.5D design layer. It limits lateral-channel activation for the current gesture and does not change the neutral geometry.
- `motor_control_precision`: deterministic precision of the current preview target; it smooths or sharpens the realized tract without creating temporal errors.
- `coarticulation_strength`: how strongly adjacent sounds pull the current target.
- `motor_control_maturity`: age/maturity proxy for trial-to-trial target-arrival accuracy. A future TTS motion layer should use it for unstable articulation associated with infancy, fatigue, or intoxication; the isolated-vowel preview does not yet synthesize stochastic target errors.
- `phonological_contrast_maturity`: maturity of phonological target separation. It remains available for future TTS sequencing as well as the current target-separation preview.
- `mouth_width_relaxed_cm`: jaw-conditioned relaxed commissure-width estimate. Its `performance_control_range` spans a depicted/stylized pursed proxy to an engineering estimate of maximal lip spreading; `/i/`, `/e/`, `/o/`, and `/u/` select different positions within that range.

`inputs.reference_image_style` is either `illustration` (default) or `photo_realistic`. Illustration mode treats small depicted soft-tissue features as potentially stylized lower-bound signals and permits a wider latent articulatory range; photo/realistic mode gives the observed dimensions more weight.

`inputs.image_analysis_weight` stores the image/statistical fusion weight that was last applied by analysis. Moving the detail-tab slider changes only the pending UI value; the integrated features, constraints, and vocal-tract geometry are regenerated only by the explicit `再計算` action. The basic-information `解析` action performs the same complete analytical regeneration from the current inputs and manual landmarks. Both explicit actions clear user-edited constraint-center slider overrides so the controls return to the new analytical centers; separately edited `performance_range_overrides` remain intact.

Preview source/acoustic-loss controls include:

- `f0_mean_hz`: read-only output derived from `f0_reference_hz`, vocal-fold spring constant, and baseline muscle tension. It is not an independent design slider.
- `glottal_open_quotient`, `glottal_speed_quotient`, `glottal_return_phase`, `glottal_spectral_tilt_db`, and `glottal_breathiness`: explicit LF-style glottal-source approximation controls initialized from baseline tension and engineering defaults.
- `glottal_volume_velocity_drive`, `glottal_flow_smoothing`, and `glottal_flow_inertance`: preview controls that blend the tube excitation toward a smoothed glottal volume-velocity input.
- `vocal_tract_wall_loss`, `vocal_tract_viscothermal_loss`, `vocal_tract_high_frequency_damping`, `vocal_tract_wall_compliance`, `vocal_tract_resonance_broadening`, and `lip_radiation_smoothing`: generalized human-default loss/compliance controls for the physical acoustic-tube model.
- `sinus_coupling`, `velopharyngeal_loss_coupling`, `piriform_fossa_loss_coupling`, `piriform_fossa_frequency_hz`, and `nasal_branch_damping`: independent side-branch controls for paranasal sinus, velopharyngeal/nasal, and piriform-fossa coloring. The former global `side_branch_loss_coupling` master is migration-only.
- `body_resonance_frequency_hz`, `body_resonance_gain_db`, and `body_resonance_coupling`: respectively the stored branch frequency, branch peak gain, and parallel wet/dry coupling. Frequency is initially derived from thoracic volume but becomes an explicit persisted override when edited.

`inflammation_index`, `airway_lumen_narrowing`, lifestyle/disease-history fields, and pediatric intubation-depth fields are retired import keys. They are discarded when old profiles are loaded and have no effect on analysis, synthesis, or export. These topics may be discussed as future research but are excluded from the public implementation.

Respiratory flow is ordered as follows: thoracic and abdominal volumes limit the initial maximum-ventilation estimate; VC/FVC, FEV1/PEF, maximum ventilation, and maximum respiratory pressure define available source capacity; `respiratory_support` specifies how much of that capacity is used during the current speech performance. Structural volumes are therefore not reapplied directly to `respiratory_support`.

These controls are preview metadata, not validated clinical estimates. A downstream physical core may replace their implementation while preserving the exported baseline values and source labels.

## Preview Synthesis

`POST /api/synthesis/preview`

Request:

```json
{
  "vowel": "a",
  "voice_constraints": {
    "baseline_muscle_tension": {
      "center": 1.02,
      "unit": "ratio",
      "edit_range": {
        "min": 0.42,
        "max": 1.62,
        "basis": "reference_center ± 3SD; UI design-value editing range"
      },
      "constraint_range": {
        "min": 0.714,
        "max": 1.377,
        "basis": "maximally relaxed-to-strained muscle-tension performance range"
      },
      "performance_control_range": {
        "min": 0.714,
        "max": 1.377,
        "basis": "maximally relaxed-to-strained muscle-tension performance range"
      },
      "statistics": {
        "reference_center": 1.02,
        "sd": 0.2
      }
    }
  },
  "render_options": {
    "duration_s": 1.35,
    "sample_rate": 44100,
    "backend": "tube"
  }
}
```

Response:

- `200 audio/wav`
- or `200 application/json` when returning metadata plus a URL:

```json
{
  "audio_url": "/api/synthesis/artifacts/preview_a.wav",
  "backend": "vtl",
  "warnings": []
}
```

## Profile Export

`POST /api/profiles`

The request body should be the same JSON emitted by `character_voice_profile.json`.
The server may persist it, validate it, or pass it to a training/material-generation pipeline.

The profile includes three intentionally separate metadata fields:

- `primary_language`: linguistic/phoneme-planning context only
- `phonetic_target_profile`: aggregate language/variety target for vowel formants and provisional articulation cues; it is not an ancestry, ethnicity, or anatomical-prior selector
- `morphology_reference_population`: selection of an approved aggregate anthropometric prior; `General` is the default
- `constraint_overrides`: user-edited baseline constraint centers re-applied during profile loading and automatic regeneration; explicit user-triggered `解析` / `再計算` intentionally clears them
- `performance_range_overrides`: user-edited per-parameter dynamic minima and maxima that should be re-applied after analytical regeneration
- `vowel_area_tuning`: vowel-specific total-area gains along normalized tract position
- `vowel_width_tuning`: vowel-specific coronal-width gains; sagittal height is held fixed and total area is recomputed before 1D projection
- `auditory_evaluation_log`: local design evaluations containing vowel, clarity/target-match ratings, notes, and the A(x)/W(x) settings present when the evaluation was recorded
- `nasal_articulation_tuning` (`nasal_articulation_tuning_0.6`): `/m/`, `/n/`, and moraic `/N/` engineering controls for oral closure, velopharyngeal opening, nasal-radiation/path damping, and consonant-to-vowel timing. Version 0.4 began storing `/n/` closure residual area directly in cm2. Version 0.5 moved only the untouched 0.4 `/n/` default contact from x/L 0.88 to 0.86. Version 0.6 lengthens only an untouched 0.4/0.5 `/n/` transition from 20 to 36 ms; manually altered profiles retain their saved contact and timing.
- `nasal_auditory_evaluation_log`: local nasal-token evaluations containing nasal clarity, transition quality, notes, and the tuning snapshot present when recorded

`range_semantics` documents the distinction among baseline, morphological plausibility, WebUI edit range, and dynamic performance range. A downstream service must not use `constraint_range` as a UI slider range; it is only a deprecated alias of `performance_control_range`.

Changing `primary_language` or `phonetic_target_profile` must never silently change anatomical priors. Legacy profiles without `phonetic_target_profile` select a compatible default from `primary_language` during load.

`phonetic_target_profile` may contain published aggregate F1/F2 targets and source-labeled engineering fallbacks for higher formants. The exported `phonetic_target` summary and preview-output `formant_reference` preserve the active profile ID, target values, VTL normalization, and source roles so a future TTS core can replace the preview implementation without losing provenance.

The browser preview separates phoneme gesture execution from `tongue_dorsum_range_utilization`, `labial_transverse_range_utilization`, and `tongue_groove_capacity`. The latter values describe available PerformanceControlRange around a character's neutral design state, not anthropometric measurements or direct vowel-amplitude multipliers. Vowels and non-coronal consonants use total area as one pressure-path admittance with 2.5D width/height hydraulic loss. Coronal `/n/` additionally propagates the exported midline and paired lateral areas as separate paths; a downstream full 3D solver may preserve still richer tongue/lip geometry.

## Landmark And Image Calibration

The profile exports:

- `landmark_schema`: canonical anatomical concepts, definitions, legacy UI keys, and front/profile correspondences
- `landmarks`: pixel coordinates retained under backward-compatible internal keys
- `image_calibration`: scale provenance and reconciliation results

The current WebUI treats landmarks as manual user input. Built-in schematic coordinates may be used as initial handles, but a downstream service must not interpret them as automatic observations from the image.

The profile also exports `body_composition_summary`, including calculated BMI, reference BMI metadata, optional body-fat percentage input, the active body-fat value used by the model, body-fat setting-guide match, Japanese aggregate body-composition reference metadata when selected, formula-estimated body-fat percentage when no direct age-band distribution is available, and regional skinfold-response estimates. These fields are design metadata for character modeling, not medical assessment.

When present, `body_composition_summary.regional_skinfold_estimate` is a relative site-response estimate, not a Japanese population center. Downstream services may use it as a low-confidence soft-tissue/resonance modifier, but must preserve the source label and population warning.

The scale hierarchy is fixed:

1. Convert the full-body image with the vertical pixel distance from `vertex` to the floor plane and the entered stature.
2. Convert the full-body `vertex`-to-`gnathion` height into the shared total head height.
3. Scale the head-front and head-profile images independently so each `vertex`-to-`gnathion` pixel height reconstructs that same shared value.
4. Use the front interpupillary prior only as a labeled fallback when the full-body head anchor is unavailable.

Breadths use horizontal projected distance and heights use vertical projected distance. A downstream service must preserve `scale_source`, warnings, and cross-view consistency metadata.

## Project Package

The standalone WebUI saves an uncompressed ZIP package named `YYYYMMDD-title.zip` containing:

- `manifest.json`: package schema, project title, creation time, and entry names
- `profile.json`: the same reproducible experiment profile used by the API boundary
- `images/*`: the selected full-body, face-front, and profile reference images

The built-in loader accepts packages generated by this application and legacy JSON profiles. It is not a general-purpose ZIP importer.

## Vocal-Tract Geometry

`profile.json` may contain `vocal_tract_geometry` with:

- `centerline_controls` and sampled `sections`
- sagittal height, coronal width, elliptical shape factor, section aspect ratio, latent lateral-channel capacity, cross-sectional area, and tract-region label per section
- `cross_section_model`: the synthetic 2.5D design controls and its explicit projection rule for the current 1D solver
- width anchors and their source roles
- `honda_articulatory_space`: ANS/PNS/Menton-based oral cavity length, lower facial height, articulatory-space area proxy, soft-palate length, and velopharyngeal gap
- `side_branch_guides`: schematic paranasal sinus guide ellipses and a velopharyngeal-port gap/coupling hint
- assumptions, evidence identifiers, and confidence

The current `vocal_tract_geometry_0.2` schema is a synthetic 2.5D design geometry. A downstream physical core must preserve its assumptions and confidence metadata and must not relabel it as image-observed anatomy. Older `vocal_tract_geometry_0.1` profiles are rebuilt from their landmarks and constraints on load.
Honda-style landmarks and sinus guides are manually controlled model anchors. They may guide later physical synthesis, but they must not be treated as measured internal anatomy from an uploaded character image.

The browser preview outputs at the project-selected 44.1 or 48 kHz rate and derives a temporary `area_function_tube_0.2` object. The physical core runs at twice that temporal rate and twice the section count, preserving tract length and wave speed, then applies a Blackman-windowed sinc decimator. Articulatory geometry and hydraulic coefficients update at approximately 11.025 kHz while pressure-wave propagation remains at the full internal rate. The same output selection controls physical preview WAVs, syllable-set exports, and final TTS output normalization before local evaluation and archival. A native-rate TTS WAV is passed through without re-encoding when it already matches the selected rate. The area function retains `cross_sections_2_5d` with sagittal height, coronal width, aspect ratio, tongue-groove depth, and lateral-channel activation. Total area sets the single pressure-path admittance; ellipse perimeter and hydraulic diameter scale section-local wall-memory loss. Its `articulation_target` keeps jaw, oral volume, lip, tongue, and cross-section targets separate. `naturalized_glottal_source_0.3` records the LF-like volume-velocity source, finite-slope closure, a restrained blended spectral-tilt cascade, deterministic cycle jitter/shimmer, and open-phase-synchronized aspiration. `glottal_tract_interaction_0.1` applies bounded return-pressure modulation to the outgoing source flow; it is a stable engineering feedback approximation rather than a vocal-fold tissue solver. `tube_distributed_loss_0.2` converts generalized wall, viscothermal, broadening, and high-frequency damping controls into a tract-length-normalized per-section gain and restrained wall-memory term. `tube_terminal_radiation_0.2` records the lip or nostril volume-velocity differentiator. `rendered_voice_spectrum_0.1` reports H1-H2, H2-H4, harmonic spectral slope, and relative band levels from a steady preview window. Physical-tab stage bypasses are audition-only and are not persisted as character design parameters. These are engineering naturalization and observation stages, not calibrated individual physiology. Published formant targets remain evaluation/provenance metadata for the tube geometry; they are not a separate formant synthesizer. This browser model is not claimed to be bit-identical to VocalTractLab or a full 3D solver.

Nasal CV syllables export `nasal_consonant_model_1.5` metadata at the shared two-times internal resolution. `/m/` uses `branched_nasal_oral_waveguide_0.3`, with one pressure-wave state running from the glottis through a lossy three-port velar junction into bilabially closed oral and synthetic nasal branches. `/n/` uses the specialized multi-channel topology described below and derives a tongue-blade dome and residual alveolar release constriction from the same editable contact position and width. The untouched default contact is x/L 0.86 and the untouched transition lasts 36 ms. The tongue-blade release leads the low/back-vowel tongue-body target, while a short velopharyngeal closure lag preserves nasal coupling through the coronal release. `coronal_nasal_release_target_0.3` regularizes release A(x) toward `F2_onset = 0.535 * F2_vowel + scaled_intercept`, using the pooled alveolar form from Iskarous et al. 2010 with its 848.21 Hz dimensional intercept scaled by designed tract length. If the regression target is lower, the tract-scaled classic 1.8 kHz synthetic alveolar locus is used as a design floor. Both are engineering priors rather than Japanese population norms or individual measurements. The anchored contact and other resonances are retained and cumulative area gains remain bounded to 0.62-1.65. `multi_stage_area_trajectory_0.1` changes oral area and hydraulic-loss scale through nasal onset, coarticulation, oral release, the `/n/`-only locus keyframe, and the following-vowel target. `nasal_release_trajectory_0.9` records the separate coronal-release and velopharyngeal-lag samples. `closed_oral_side_branch_0.2` records the branch from the velopharyngeal junction to the place closure, including volume and minimum hydraulic diameter. `hydraulic_cross_section_loss_0.1` records how 2.5D ellipse perimeter affects section-local wall loss. `velopharyngeal_port_area_trajectory_0.1` changes branch admittance over the same interval. Mouth and nostril volume velocities are radiated and summed once; no explicit post-hoc nasal pole/zero filter or independent nasal-path normalization is applied. `nasal_path_gain` controls nostril-radiation efficiency and `branch_damping` controls nasal-wall loss. The release contains no stochastic burst. Engineering diagnostics remain non-perceptual and non-clinical thresholds.

Moraic `/N/` temporarily retains `nasal_consonant_model_0.7` as a terminal nasal hold without following-vowel anchors or CV level matching. `attack_fade_ms` applies a half-cosine onset fade in all three profiles. All defaults and nasal-path geometries are synthetic engineering design values, not measurements of an individual or population.

Coronal `/n/` further specializes the topology as `coronal_multichannel_nasal_waveguide_0.2`. Within the finite tongue-contact neighborhood, `midline_area_cm2`, `left_lateral_area_cm2`, and `right_lateral_area_cm2` are independent delay paths connected by admittance-weighted multiport pressure junctions. `oral_three_channel_area_0.2` derives the split and merge from the finite contact band plus one-and-a-half source sections on each side instead of extending three parallel ducts through most of the anterior tract. `finite_coronal_contact_band_0.1` seals all three paths over a nonzero longitudinal interval during the nasal hold. Spatial oversampling preserves each contact cell instead of averaging its minimum area with neighboring open sections. The left and right paths currently use a symmetric synthetic allocation unless explicit asymmetric section areas are supplied. This is a 2.5D multi-channel graph, not a transverse-mode or full 3D solver.

## TTS Adapter Boundary

Native TTS engines are not coupled directly to browser code. The current local service converts `voice_control_profile` into an audio.cpp request; future adapters may also consume:

- `voice_constraints[*].center` as the character's neutral/baseline design value
- `voice_constraints[*].constraint_range` as the dynamic performance range available to acting or prosody control
- `voice_constraints[*].edit_range` only for WebUI editing and validation
- curated WAV/material paths for cloning or fine-tuning
- a saved `character_voice_profile.json` as the reproducible experiment record

The current Irodori adapter consumes non-pitch identity anchors through caption descriptors and maps speaking rate to `duration_scale`. Pitch wording is intentionally excluded from the caption. When enabled, the local bridge measures the generated voiced contour with WORLD, then uses Praat PSOLA overlap-add to shift its median to `voice_control_profile.identity_anchor.f0_mean_hz` while retaining the relative intonation, original waveform texture, and duration. Response headers report measured, target, and output F0. This is an explicit waveform postprocess, not native control of Irodori's learned latent space. Breathiness, spectral tilt, and articulation trajectories remain approximate caption mappings.

The optional `seed_f0_benchmark.py` test bench evaluates an alternative pre-generation selection strategy. It sends paired low-step and final-step requests with identical seeds and conditioning, explicitly disables F0 post-processing, measures the returned unmodified WAV files with WORLD, and records whether low-step F0 predicts final-step F0. Benchmark artifacts are not part of the TTS API. Local runs are excluded from version control by default; selected, provenance-checked pilot evidence may be archived under `benchmark_results/published/`.

The local `evaluate_voice.py` evaluator emits `cvd_voice_evaluation_0.1` JSON,
flattened CSV, and Markdown reports. These are analysis artifacts rather than TTS API
responses. A manifest may join a WAV filename to text metadata and an opt-in
observation ID. Built-in source/prosody, spectral-timbre, delivery, and waveform
quality fields are engineering comparison proxies; downstream consumers must not
relabel them as speaker identity or clinical measurements. Independent
speaker-embedding output, when explicitly enabled, remains a separate model-dependent
field and raw embeddings are not serialized.

The WebUI should remain useful even when no external synthesis backend is available. In that mode it exports constraints, vowel-specific area/width tuning, nasal-articulation tuning, local auditory-evaluation records, and synthetic phoneme/syllable datasets using the browser 2.5D-derived tube preview. Nasal `/m/`, `/n/`, and moraic `/N/` use a dedicated initial model; other CV onset generation remains experimental scaffolding rather than a validated consonant model. Tokens are evaluated individually before a set is accepted. Profiles saved by older versions may still contain `formant` or `hybrid` preview selections and hybrid-only controls; version 1.1 ignores those retired fields and exports `preview_synthesis_backend: "tube"`.

## Aggregate Reference Data Policy

External cohort references are not collected by this prototype. If a future source is explicitly approved under the project ethics policy, it must enter the system only as aggregate records:

```json
{
  "domain": "respiratory_function",
  "item_code": "string",
  "item_name": "string",
  "sex": "female",
  "age_band": "20-29",
  "unit": "L",
  "n_measurements": 1234,
  "mean": 3.1,
  "sd": 0.42,
  "source_url": "https://example.org/approved-aggregate-source",
  "retrieved_at": "2026-07-13T00:00:00.000Z"
}
```

Do not send participant IDs, sample IDs, row-level records, clinical images, or cross-table linkage keys to the WebUI or TTS core. If controlled-access data is ever considered, it must be reviewed separately and only non-identifying aggregate summaries may be imported.

Published phonetic corpora follow the same rule: import only explicitly published aggregate values needed by an approved target profile. Do not acquire, cache, export, or derive runtime targets from source recordings, speaker rows, token/frame measurements, or speaker identifiers.

## Public Prototype Evidence Scope

For public releases, embedded evidence should be limited to:

- broadly used reference values
- public aggregate statistics
- formula-level or parameterized mappings already generalized by the source
- medical/anatomical references used only to check the plausibility of computed values
- treatment-oriented clinical values, including pediatric intubation depth, are not encoded or calculated
- real-person images require explicit consent or another lawful basis; medical history must not be entered
- analysis and synthesis use loopback-bound local services and do not upload project data

Do not include case reports, individual patient values, clinical images, row-level records, ID-like values, or any data that requires participant-level linkage. The TTS core API should accept only source-labeled aggregate priors, user-edited design parameters, and generated constraints.

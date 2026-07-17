# Character Voice Lab API Boundary

The WebUI is intentionally independent from Open WebUI and from the eventual TTS runtime.
It owns only:

- image and manual landmark input
- canonical anatomical landmark definitions and cross-view image calibration
- anthropometric feature fusion
- baseline voice-parameter editing
- performance constraint-range export
- experiment profile import/export
- 2.5D vocal-tract geometry and source-assumption export
- reproducible project-package import/export

The TTS core should be connected later through a small HTTP API or local adapter.

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

- `f0_mean_hz`: read-only output derived from `f0_reference_hz`, vocal-fold spring constant, baseline muscle tension, and the provisional inflammation mapping. It is not an independent design slider.
- `glottal_open_quotient`, `glottal_speed_quotient`, `glottal_return_phase`, `glottal_spectral_tilt_db`, and `glottal_breathiness`: explicit LF-style glottal-source approximation controls initialized from tension and provisional inflammation/lumen mappings.
- `glottal_volume_velocity_drive`, `glottal_flow_smoothing`, and `glottal_flow_inertance`: preview controls that blend the tube excitation toward a smoothed glottal volume-velocity input.
- `vocal_tract_wall_loss`, `vocal_tract_viscothermal_loss`, `vocal_tract_high_frequency_damping`, `vocal_tract_wall_compliance`, `vocal_tract_resonance_broadening`, and `lip_radiation_smoothing`: generalized human-default loss/compliance controls for the lightweight 1D tube preview.
- `sinus_coupling`, `velopharyngeal_loss_coupling`, `piriform_fossa_loss_coupling`, `piriform_fossa_frequency_hz`, and `nasal_branch_damping`: independent side-branch controls for paranasal sinus, velopharyngeal/nasal, and piriform-fossa coloring. The former global `side_branch_loss_coupling` master is migration-only.
- `body_resonance_frequency_hz`, `body_resonance_gain_db`, and `body_resonance_coupling`: respectively the stored branch frequency, branch peak gain, and parallel wet/dry coupling. Frequency is initially derived from thoracic volume but becomes an explicit persisted override when edited.

`inflammation_index` and `airway_lumen_narrowing` are not exposed as editable controls in the 1.1 UI. Their provisional internal mappings remain under review and must not be interpreted as validated medical quantities.

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

`range_semantics` documents the distinction among baseline, morphological plausibility, WebUI edit range, and dynamic performance range. A downstream service must not use `constraint_range` as a UI slider range; it is only a deprecated alias of `performance_control_range`.

Changing `primary_language` or `phonetic_target_profile` must never silently change anatomical priors. Legacy profiles without `phonetic_target_profile` select a compatible default from `primary_language` during load.

`phonetic_target_profile` may contain published aggregate F1/F2 targets and source-labeled engineering fallbacks for higher formants. The exported `phonetic_target` summary and preview-output `formant_reference` preserve the active profile ID, target values, VTL normalization, and source roles so a future TTS core can replace the preview implementation without losing provenance.

The browser preview separates phoneme gesture execution from `tongue_dorsum_range_utilization`, `labial_transverse_range_utilization`, and `tongue_groove_capacity`. The latter values describe available PerformanceControlRange around a character's neutral design state, not anthropometric measurements or direct vowel-amplitude multipliers. The current 1D acoustic solver still consumes a reduced area function, so a downstream 2.5D/3D solver may use the exported target metadata while preserving a richer tongue/lip geometry.

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

The browser preview runs at 44.1 kHz and derives a temporary `area_function_tube_0.2` object. It retains `cross_sections_2_5d` with sagittal height, coronal width, aspect ratio, tongue-groove depth, and lateral-channel activation, then projects each section's total area to the current single-channel tube solver. Its `articulation_target` keeps jaw, oral volume, lip, tongue, and cross-section targets separate; for example, `/o/` expands the middle/front oral cavity and oral aperture while retaining a short terminal lip constriction, rather than reusing the `/u/` mandibular posture. The sole browser backend is a lightweight Kelly-Lochbaum style tube preview. Its tube count follows `round(vocal_tract_length_cm * sample_rate / sound_speed)`, and `tube_distributed_loss_0.1` converts generalized wall, viscothermal, and broadening controls into a tract-length-normalized per-section gain. It also retains provisional vowel-specific area warps, LF-style volume-velocity input, restrained soft-wall compliance, simple side-branch antiresonance coloring, and smoothed lip radiation. Published formant targets remain evaluation/provenance metadata for the tube geometry; they are not a separate formant synthesizer. This browser model is intended for fast design feedback, not as a bit-identical VocalTractLab implementation.

## External TTS Integration Target

External TTS engines should not be coupled to the WebUI directly.
Use a separate core service that accepts either:

- `voice_constraints[*].center` as the character's neutral/baseline design value
- `voice_constraints[*].constraint_range` as the dynamic performance range available to acting or prosody control
- `voice_constraints[*].edit_range` only for WebUI editing and validation
- curated WAV/material paths for cloning or fine-tuning
- a saved `character_voice_profile.json` as the reproducible experiment record

The WebUI should remain useful even when no external synthesis backend is available. In that mode it exports constraints, vowel-specific area/width tuning, local auditory-evaluation records, and synthetic phoneme/syllable datasets using the browser 2.5D-derived tube preview. CV onset generation is experimental scaffolding rather than a validated consonant model; tokens are evaluated individually before a set is accepted. Profiles saved by older versions may still contain `formant` or `hybrid` preview selections and hybrid-only controls; version 1.1 ignores those retired fields and exports `preview_synthesis_backend: "tube"`.

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

Do not include case reports, individual patient values, clinical images, row-level records, ID-like values, or any data that requires participant-level linkage. The TTS core API should accept only source-labeled aggregate priors, user-edited design parameters, and generated constraints.

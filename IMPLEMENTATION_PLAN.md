# CharacterVoiceDesigner Implementation Plan

This plan turns the current research ideas into implementable stages. The main rule is that population data enters the app as aggregate priors, while character-specific values remain user-controlled design parameters.

## 2026-07-19 ML-TTS Control Designer Branch

Current implementation order:

1. preserve the physical Character Voice Lab prototype as the audition and evidence layer
2. separate appearance estimates from explicit voice-design overrides
3. generate backend-neutral identity anchors and performance control functions
4. map those anchors through an adapter rather than coupling the UI to one learned TTS latent space
5. use audio.cpp as the persistent local inference runtime
6. begin with Japanese Irodori-TTS VoiceDesign and retain the adapter boundary for future local models

The first adapter uses deterministic Japanese caption generation, fixed-seed reproducibility, duration scaling, and explicit disclosure that caption conditioning is approximate. Direct F0, breathiness, and spectral controls may be added only when a selected TTS backend exposes stable inference-time controls for them.

## 2026-08-06 Integrated Performance-Control Roadmap

This roadmap separates character identity, reachable performance, time-varying state,
and backend-specific conditioning. A learned TTS backend is the final renderer, not a
causal simulator of anatomy or physiology.

### Terminology And Modeling Boundaries

- `MorphologicalPlausibilityRange` describes the range of anatomical baseline values
  compatible with the visible character design. It does not describe motion during
  speech. If `ConstraintRanges` remains in the paper, it should be treated as an umbrella
  concept rather than restoring the deprecated runtime `constraint_range` alias.
- `PerformanceControlRange` describes the dynamic interval reachable from the selected
  baseline during performance.
- `GestureExecution` describes how much of the available performance range is used for
  the current utterance.
- `MotorControlMaturity` describes target-arrival precision and temporal stability.
- `PhonologicalContrastMaturity` describes how distinctly language-specific phonological
  targets are maintained.
- Primary language may select phonological targets, coarticulation, timing, and habitual
  motor strategies. It must not select anatomical or population priors.
- Psychological and involuntary-response controls are synthetic performance-design
  variables. They are not diagnostic models and must not be presented as predicting a
  real person's medical or psychological response.
- The training method is `Speaker Inversion`. `Speaker Intervention` is treated as a
  drafting typo; `intervention` is reserved for inference-time control injection.

### Irodori-TTS v4-Small Capability Review

The pinned official v4-Small release materially improves the available adapter surface:

- text, reference speech, descriptive caption, and emoji-conditioned expression are
  supported in one model;
- speaker and caption conditions are enabled together, so identity and performance style
  no longer require separate model families;
- text and caption share a pretrained Japanese ModernBERT encoder but use separate learned
  projectors;
- reference conditioning accepts one or more clips with up to 120 seconds combined;
- the official Speaker Inversion configuration keeps speaker and caption conditioning
  enabled and learns 16 speaker tokens against the exact v4-Small checkpoint;
- the published emoji vocabulary includes breath, sigh, gasp, pause, cough, sniff,
  swallow, throat clearing, effort, muffling, and several emotional delivery cues.

The 120-second value is a combined reference-conditioning limit, not a claim that every
Speaker Inversion dataset should contain exactly 120 seconds. The official benchmark
reports most long-reference similarity improvement by approximately 30 seconds, while
60- and 120-second conditions provide smaller additional gains. The first application
benchmark should therefore compare 30, 60, and 120 seconds rather than defaulting to the
largest input.

The release does not expose interpretable scalar controls for breathiness, nasality,
effort, emotion, or articulator position. Emoji are text tokens and captions are learned
conditions; neither is evidence that a physical evaluator or a disentangled internal
variable exists. The official model card also reports condition conflicts, variable
emoji effects, prompt-adherence limits, and lower short-reference similarity than v3.
CharacterVoiceDesigner must measure these behaviors instead of assuming a direct physical
mapping.

Primary upstream references:

- <https://huggingface.co/Aratako/Irodori-TTS-v4-Small>
- <https://huggingface.co/Aratako/Irodori-TTS-v4-Small/blob/main/EMOJI_ANNOTATIONS.md>
- <https://github.com/Aratako/Irodori-TTS/commit/d48dd92b943fa5dbcb88150eb974c25d8709df9b>

### Backend-Neutral Runtime Contract

The implementation should compile all user-facing controls into five separate records:

1. `IdentityBaseline`: static morphology-derived estimates and explicit design overrides.
2. `PerformanceEnvelope`: per-parameter `PerformanceControlRange`, rate limits, and
   coupling constraints.
3. `PerformanceTimeline`: intentional targets over time, including articulation,
   respiration, prosody, and facial-expression load.
4. `AutonomicAndEventTimeline`: lagged psychological response plus discrete breath,
   interruption, swallow, cough, or other non-verbal events.
5. `BackendControlPlan`: model/version-specific reference speech, Speaker Inversion,
   caption, emoji, segmentation, and postprocessing instructions.

Only item 5 is allowed to contain Irodori-specific tokens. This preserves the ability to
test another TTS backend without changing the physical and performance model.

### Work Package 0: v4 Adapter And Capability Baseline

1. Add v4-Small as a separately versioned inference backend while retaining the current
   native audio.cpp backend until parity is demonstrated.
2. Add a capability manifest for speaker reference, Speaker Inversion, caption, emoji,
   duration prediction, reference-duration limit, watermarking, and observable tensors.
3. Record exact model, tokenizer, codec, source commit, inference options, and watermark
   state in every output metadata file.
4. Run matched v3/current-native versus official-v4 tests across fixed text, seed,
   reference, and caption conditions.
5. Add a conflict matrix: identity caption versus reference identity, neutral versus
   expressive caption, emoji on/off, and short versus long reference.

Acceptance gate: v4 can generate from the GUI, every active condition is visible in the
request summary and metadata, and changing one condition produces an attributable A/B
record without silently changing the others.

### Work Package 1: Acoustic Observation Expansion

Extend the current evaluator before adding automatic selection or physiological claims:

- pitch: voiced F0 median, 5th/95th percentiles, range, slope, and frame-to-frame change;
- delivery: syllable or mora rate, pause positions, pause duration, energy envelope, and
  phrase-final lengthening;
- breathiness/source: CPP, HNR, spectral tilt, H1-H2/H1-A3 where measurement quality is
  sufficient, and unvoiced-to-voiced energy ratio;
- effort/pressed-quality proxies: CPP, spectral slope, alpha ratio, F0/energy covariance,
  and onset/offset sharpness;
- nasality proxies: low-frequency nasal-formant energy, candidate anti-formant regions,
  and spectral-distance measures, explicitly labeled as mono-audio engineering proxies;
- non-verbal events: onset, duration, peak level, voiced ratio, and event-to-speech
  boundary continuity.

Nasalance cannot be recovered reliably from a normal mono WAV without separated oral and
nasal measurements. Abdominal pressure, laryngeal tension, and tissue vibration likewise
must remain input-side design variables rather than quantities claimed to be measured
directly from output audio.

Acceptance gate: repeated same-condition generations establish within-condition variance,
metric extraction failures are explicit, and no provisional threshold is promoted to an
automatic pass/fail rule.

### Work Package 2: Speaker Inversion Material Compiler

Build a local-only guided workflow for synthetic speaker-reference construction:

1. Generate physical-preview anchors for vowels, source quality, breath noise, and
   resonance. These anchors describe the target but are not assumed to be natural TTS
   training samples by themselves.
2. Generate many approximately three-second v4 candidates across seeds using a fixed,
   phonetically balanced neutral text set.
3. Benchmark low-cost screening modes against final-quality output. The previous
   early-Step experiment showed late changes, so no low-Step shortlist is adopted unless
   v4-Small demonstrates reliable ranking correlation and real elapsed-time savings.
4. Reject only objective technical failures, then rank the remaining candidates with a
   multi-objective distance to the physical target: F0, spectral/source proxies,
   articulation, timing, noise, and clipping. F0 alone is insufficient.
5. Present a diverse top-K set for listening selection instead of automatically choosing
   one numerically nearest sample.
6. Generate held-out sentences from each selected candidate condition and require the
   user to confirm identity stability across text.
7. Assemble multiple short clean clips and compare 30-, 60-, and 120-second reference
   sets before training Speaker Inversion.
8. Store the generation provenance, selected/rejected reasons, transcripts, hashes, and
   consent/synthetic-origin declaration with the training manifest.

Acceptance gate: a compiled synthetic dataset is reproducible from its manifest, no real
person recording is required, and held-out text evaluation is completed before the
resulting Speaker Inversion artifact is marked usable.

### Work Package 3: Static Range And Language-Motor Model

1. Add explicit `MorphologicalPlausibilityRange` values around the static anatomical
   baseline without changing the existing statistical edit range or
   `PerformanceControlRange` semantics.
2. Derive visible-motion limits for jaw opening, lip spreading/rounding, facial tension,
   and neck/torso excursion. Illustration sources may use a separate exaggeration factor,
   but it must remain an explicit design override.
3. Map primary language to phoneme targets, coarticulation rules, rhythm, and habitual
   gesture timing only.
4. Add language-neutral respiratory and laryngeal capacity limits, then apply
   language-specific motor targets inside those limits.
5. Keep image-derived, population-prior, language-derived, and user-authored contributions
   separately inspectable in exported evidence records.

Acceptance gate: changing language changes target trajectories but never silently changes
anatomical dimensions, age, sex reference class, or morphology population.

### Work Package 4: Time-Varying Performance And Psychology

Implement a small deterministic state solver rather than direct prompt generation:

- `MotorTarget(t)`: intended articulatory, prosodic, and respiratory target;
- `MotorState(t)`: rate-limited and range-limited realized movement;
- `RespiratoryState(t)`: estimated lung-volume fraction, airflow demand, pressure demand,
  breath availability, and recovery;
- `AutonomicState(t)`: user-authored arousal, valence, startle/load, and recovery with
  attack/release time constants;
- `ExternalLoad(t)`: torso restriction/support, facial restriction, and other explicit
  performance constraints;
- `EventState(t)`: discrete or sustained involuntary-performance events.

Psychological inputs may modulate target range, execution noise, F0 range, respiratory
rate/depth, onset timing, and effort. They must not deterministically map a named emotion
or stimulus to a universal biological response. Proposed rules such as “nasopharyngeal
tension causes voicing” or “interruption normally becomes a moraic nasal ending” remain
testable hypotheses, not defaults.

Acceptance gate: the same initial state and event track produce the same control timeline;
all saturation, lag, recovery, and conflict-resolution decisions are exported.

### Work Package 5: Parallel Timeline UI

Add a timeline editor parallel to the reading-text axis with these lanes:

- phrase and breath points;
- respiratory effort/available breath;
- pitch range and energy intent;
- articulation execution and target precision;
- autonomic arousal/load;
- facial/oral restriction;
- non-verbal event markers;
- backend caption/emoji preview generated from the neutral control plan.

The primary UI edits physical/performance values, not raw prompt strings. An advanced
view may show and override the compiled caption and emoji tokens. Segment boundaries must
snap to text spans, mora/phoneme timing when available, or explicit absolute time.

Acceptance gate: a user can place a breath point and a time-varying factor without editing
the spoken text, preview the compiled backend plan, and save/reload it without loss.

### Work Package 6: v4 Intervention Adapter

1. Build a deterministic lexicon from backend-neutral states to conservative caption
   fragments and documented emoji controls.
2. Keep identity descriptors out of performance captions when reference audio or Speaker
   Inversion already fixes identity, reducing official condition-conflict risk.
3. Use segment-level captions/emojis only where the runtime supports them. Otherwise split
   at safe linguistic boundaries and record cross-segment continuity risk.
4. Instrument the official Python runtime to observe available text/caption embedding
   shapes, masks, norms, hashes, duration output, and selected denoising snapshots.
5. Use controlled ablation and sensitivity tests to determine whether a requested physical
   direction is monotonic, context dependent, ineffective, or contradictory.

Observation does not imply interpretability. Raw hidden states should remain local and
optional; normal inference must be byte-identical when observation is disabled.

Acceptance gate: every generated caption/emoji can be traced to a source control and each
mapping has an empirical effect report rather than an assumed physiological meaning.

### Work Package 7: Non-Verbal And Involuntary Event Layer

Evaluate three rendering paths per event:

1. native v4 emoji/text intervention for events represented in the official vocabulary;
2. procedural physical audio for controllable inhalation, airflow, interruption, or
   closure transitions;
3. separately generated event audio with boundary-aware alignment and conservative
   postprocessing when the first two paths are inadequate.

Initial event set: inhale/gasp, sigh, cough/throat clear, swallow, sniff, voiced or unvoiced
interruption, effort onset, muffled articulation, and facial-tension articulation shift.
Each event needs onset, duration, intensity, recovery, overlap policy, and fallback path.

Acceptance gate: event timing does not require modifying the spoken transcript, boundaries
do not create clipping or unintended silence, and unsupported events fail visibly instead
of being replaced with an unrelated emoji.

### Work Package 8: Integrated Speech-Motor Validation

1. Compile text into phonological targets and tentative timing.
2. Solve intentional motion, respiratory support, psychological response, external load,
   and events on one timeline.
3. Compile the result through each backend adapter.
4. Generate, observe, and compare output against the requested timeline.
5. Report controllability separately from naturalness, speaker identity, intelligibility,
   and physical plausibility.

The first validation corpus should contain neutral, expressive, breath-constrained,
interrupted, and non-verbal-event cases across short and paragraph-length Japanese text.
Automatic correction or regeneration remains disabled until repeated held-out experiments
show that a metric predicts the requested perceptual direction.

### Learned-TTS Output Limitations

- speaker identity, style, linguistic context, prosody, and recording characteristics are
  entangled in learned conditioning spaces;
- identical physical controls cannot be assumed to produce identical acoustic effects
  across text, seed, model version, or reference material;
- global caption/reference controls do not guarantee local timing or monotonic response;
- model-generated non-verbal events are probabilistic and may alter adjacent words;
- reference audio may carry unwanted prosody, noise, room response, or lexical leakage;
- postprocessing can correct selected observables such as median F0 but can degrade
  breath noise, transients, phase continuity, and speaker cues;
- backend upgrades can invalidate embeddings and calibrated mappings;
- a natural output is not evidence that the inferred anatomy or physiology is correct.

These limits require versioned adapters, local provenance, held-out-text evaluation, and
clear separation between physical-design intent and measured acoustic outcome.

## 2026-07-30 Conditioning Observation Milestone

Implemented:

1. opt-in local generation records with hashed text/caption provenance
2. seed, inference-step, CFG, duration, model-config, and postprocess capture
3. separate hashes for upstream audio.cpp WAV and returned postprocessed WAV
4. PCM duration and optional WORLD F0 analysis
5. explicit expected dimensions for Speaker condition (768), Caption condition
   (512), and audio latent (32)
6. requested-versus-observed state for internal conditions and latent snapshots
7. unit parity and real audio.cpp parity tests proving observation does not
   alter returned WAV bytes

The pinned audio.cpp binary does not expose the internal tensors or Duration
Predictor result. The next native milestone is an instrumented source build
that reports condition/initial-latent hashes and predicted duration first,
then writes explicitly requested raw tensor snapshots to a local sidecar
format. Normal inference must remain byte-identical when observation is off.

## 2026-07-30 Evaluation Milestone

The first evaluation layer is implemented as a separate local CLI. It produces
machine-readable JSON, flattened CSV, and Markdown reports while keeping these
measurement groups separate:

- source F0 and prosody;
- spectral-timbre engineering proxies;
- delivery timing and level dynamics;
- waveform quality diagnostics;
- optional observation-record provenance.

The default evaluator uses only generated WAV data. Independent speaker embedding is
an explicit, disabled-by-default adapter because the reference ECAPA model uses
real-person VoxCeleb training data. Raw embeddings are not serialized.

Next evaluation work:

1. extend the implemented native speaker-state hash pattern to caption
   condition, predicted duration, initial latent, and selected denoising steps;
2. add batched evaluation-set generation using `evaluation_texts.ja.json`;
3. compare embedding and acoustic drift across text while holding seed and controls;
4. derive selection rules only after repeated trials establish stable
   within-condition variance.

## 2026-07-31 Standard Generation And Identity Compilation

Implemented:

1. normal TTS generation is fixed at 20 Steps and one candidate in both the
   normal UI and the server-side `standard_single` request mode;
2. every normal result receives local F0, waveform-quality, spectral, delivery,
   and optional compiled-calibration distance evaluation;
3. thresholds remain provisional, warnings do not discard audio, and automatic
   retry is disabled;
4. Speaker state, Style snapshot, and calibration WAV analyses are stored
   separately and linked through a compiled voice-identity manifest;
5. the TTS screen displays fixed-state, model-compatibility, calibration, and
   evaluation status without exposing candidate-count or variable-Step controls;
6. the Experiment screen independently generates 4/8/12/16/20 Step predicted
   audio for each seed and reports the earliest acoustic-proxy stabilization
   point and timing budget.

Adoption gates:

1. enable at most one automatic retry only after held-out trials validate the
   warning threshold;
2. do not call the current five-point experiment latent selection: it performs
   independent same-seed generations because reusable intermediate states are
   not available;
3. implement common-prefix two-branch inference only when identity proxies
   settle by 12 Steps across the test set and measured native branch runtime is
   lower than one 20 Step generation plus one retry.

## 2026-07-30 Speaker Condition Reference Milestone

Implemented:

1. exact inspection of the installed VoiceDesign model configuration and
   speaker-branch weight structure;
2. validation of the upstream `.speaker.safetensors` suffix,
   `speaker_embedding` key, rank, dtype, finite values, token count, and model
   dimension;
3. hash-bound provenance sidecars that distinguish non-semantic format fixtures
   from trained artifacts;
4. deterministic `(16, 768)` format-fixture generation without audio, text,
   personal identifiers, or a learned voice;
5. source inspection of the local audio.cpp runtime;
6. a read-only capability API and JSON/Markdown/YAML compatibility report;
7. tests proving that storage compatibility is not promoted to end-to-end or
   semantic compatibility.

Verified status:

- the installed model has a 768-dimensional speaker branch;
- the upstream Speaker Inversion file contract is structurally compatible;
- the original audio.cpp request path had reference-audio conditioning but no
  direct speaker-state input;
- the patched Ubuntu source build and real-audio generation path were confirmed
  on 2026-07-30.

Native implementation added after the initial inspection:

1. a pinned audio.cpp patch loads the official `speaker_embedding` tensor as a
   direct variable-length speaker state with an all-valid mask;
2. reference audio, `no_ref`, and direct embedding modes are mutually
   exclusive;
3. native suffix, file-size, rank, token-count, model-dimension, dtype, tensor
   length, and finite-value checks run before inference;
4. the Designer bridge exposes only files under
   `runtime/speaker_conditions/`, rejects non-semantic fixtures, and records
   only hashes and shapes;
5. Linux setup rebuilds an unpatched binary automatically, while Windows
   source builds apply the same tracked patch;
6. native responses expose only the consumed speaker-state SHA-256, shape, and
   input mode;
7. Designer observations compare that digest with the canonical float32
   little-endian digest computed from the validated input artifact.

Next native work:

1. run the new state-hash observation once on the Ubuntu GPU build and require
   `matches_input_state: true`;
2. compare the official upstream Python inference output with the patched
   native path after the official environment is constructed;
3. perform held-out-text semantic evaluation using an embedding optimized
   against the exact local checkpoint.

## 2026-07-14 Workflow And Geometry Plan

The working order is:

1. reference-image selection and project naming
2. age, sex reference class, primary language, and morphology-reference-population input
3. body/front/profile manual landmark placement
4. detailed design settings
5. initial analysis and statistical comparison
6. baseline-value adjustment
7. phoneme preview and export

Implemented in the current prototype:

- the workflow-oriented tab structure and project-name header control
- ZIP project save/load using `date-title.zip`
- ZIP contents: `manifest.json`, `profile.json`, and selected body/front/profile images
- separate primary-language metadata and morphology-reference-population selection, with `General` as the default
- manual landmark placement on the built-in schematic defaults or uploaded reference images
- a 44-section side-view 2D vocal-tract design template warped by profile landmarks
- a canonical anatomical landmark schema based on the AIST measurement manual, including front/profile concept cross-references
- stature-first cross-view calibration using shared `vertex`-to-`gnathion` total head height
- frontal width anchors derived from independent tracheal design width, neck-root breadth, jaw breadth, and mouth breadth
- linear interpolation where frontal width observations are unavailable
- an elliptical section approximation, `A(x) = pi * sagittal_diameter * frontal_width / 4`
- region summaries for laryngeal, pharyngeal, oral, and labial sections

Evidence and interpretation limits:

- profile landmarks determine the tract path and external scaling, but the internal sagittal cavity contour remains a design template rather than observed anatomy
- schematic default points and visible-contour placements are design handles; bony landmarks require an explicit manual placement protocol when the image does not identify the anatomical point
- external neck-root breadth uses public aggregate anthropometry; it does not determine tracheal internal diameter
- the tracheal internal diameter is an independent design parameter; clinical aggregate CT data is used only as a plausibility check
- primary language is linguistic metadata and must not select anatomical priors
- morphology-reference-population options may be added only when an ethically approved public aggregate source is embedded
- `General` does not claim a worldwide cohort; unmatched regional priors fall back to a neutral center with widened uncertainty and an explicit warning

Next geometry stages:

1. calibrate sagittal template anchors against reusable aggregate or generalized area-function references
2. add landmark confidence and manual-confirmation state to each width anchor
3. replace single-value interpolation with vowel/state-specific `A(x)` templates
4. add binary-mask and voxel-derived geometry as optional higher-confidence layers
5. connect the exported geometry to a physical waveguide or VocalTractLab adapter

## Source Strategy

External dataset acquisition is paused. The current implementation work uses only owner-supplied PDFs and already reviewed public aggregate references; new external caches require a separate ethics and provenance review before retrieval.

### Government health and nutrition statistics

Use the National Health and Nutrition Survey as the primary age-band source for lifestyle and body-composition priors.

Planned inputs:

- sex and age-band means for height, weight, BMI, waist circumference, and body-composition-adjacent fields where available
- lifestyle and disease associations are discussion-only future research topics; no collection, inference, or character-level mapping is implemented
- source-year and survey-year metadata, because recent surveys are not all continuous

Important limitation:

- This survey is suitable for lifestyle and body-composition priors. It should not be treated as a direct respiratory-function dataset unless an official table actually includes spirometry or a compatible respiratory measurement.

Target file:

- `data/japan_health_nutrition_priors.json`

### AIST Japanese body dimensions

Use AIST Human Body Dimensions Database 1991-92 as the adult anthropometric reference and confidence calibration source.

High-priority AIST dimensions:

- head and face: `A1` head length, `A2` head breadth, `A7` bizygomatic breadth, `A8` bigonial breadth, `A9` interpupillary breadth, `A13` mouth breadth, `A15` morphologic face height, `A17` subnasale to gnathion
- standing body landmarks: `B1` height, `B5` fossa jugularis height, `B8` cervicale height, `B19` acromiale height
- breadths/depths: `D1` neck-root breadth, `D2` shoulder breadth, `D7` biacromial breadth, `E2` chest depth, `E4` abdominal depth
- circumferences: `F1` neck circumference, `F5/F5-2` chest circumference, `F6/F6-2` inspiration chest circumference, `F9` abdominal circumference, `F10` waist circumference
- neck/trunk shape: `G6` anterior neck length

Use in app:

- replace temporary adult head/face/body priors
- calibrate image-derived measurement confidence
- provide adult baseline ranges for sliders

Target file:

- `data/aist_body_dimension_priors.json`

### Attached PDF-derived tables

Use the attached PDFs as local evidence tables. Each extracted value must include source file, page/table note, age range, sex, and confidence.

Planned mappings:

- `学童の頭部成長の縦断的観察.pdf`
  - ages 6-11 head circumference, head length, head breadth, cephalic index trends
  - use for child head-size correction and head-shape confidence before adult AIST values become appropriate
- `日本人の若年者（10歳から20歳）の呼吸機能検査の基準値.pdf`
  - ages 10-20 respiratory function reference equations
  - implemented for VC, FVC, FEV1, FEV1%, PEF, V50, V25 preview constraints using height-and-age regression equations from Table 4
- `小児における理想的な気管チューブ挿入長についての声帯から気管分岐部までの距離を指標とした検討.pdf`
  - use height-linked vocal-cord-to-carina/tracheal-length proxy, including the reported practical rule around 6 percent of height
  - map only to airway-length and safety-range proxies, not to final voice prediction by itself
- `小児気管チューブ挿入長決定法の比較.pdf`
  - use as uncertainty evidence: age/height/weight formulas alone are noisy for pediatric airway length
  - widen ranges for pediatric airway estimates
- `画像診断における成育の診方.pdf`
  - use qualitative age-development notes for pediatric nasal cavity, paranasal sinus, and head-neck anatomy
  - map to low-confidence sinus/nasal development modifiers
- `日本人の人体寸法の変化量推定.pdf`
  - use as longitudinal/secular correction evidence when comparing old AIST adult data with newer population statistics

Target file:

- `data/local_pdf_growth_priors.json`

## Aggregate Prior Schema

All prior files should normalize into this shape:

```json
{
  "schema_version": "population_prior_table_0.1",
  "source": {
    "label": "string",
    "url_or_file": "string",
    "retrieved_or_extracted_at": "ISO-8601 string",
    "access": "public|local_pdf|manual_extract",
    "privacy": "aggregate_only"
  },
  "records": [
    {
      "domain": "anthropometry|respiratory|lifestyle|growth|airway",
      "variable": "string",
      "sex": "male|female|neutral|all",
      "age_band": "string",
      "age_min": 10,
      "age_max": 20,
      "unit": "string",
      "mean": null,
      "sd": null,
      "prevalence": null,
      "equation": null,
      "n": null,
      "confidence": 0.0,
      "source_note": "string"
    }
  ]
}
```

No participant IDs, sample IDs, or row-level records should be stored in these files.

## Estimation Layers

### 1. Age-band prior resolver

Create a resolver that accepts:

- age
- sex reference class
- reference population
- enabled source set

It returns:

- best matching aggregate records
- interpolated values when adjacent age bands are available
- evidence strength and warnings when extrapolating

Implementation target:

- `src/prior_resolver.js` or `priors.js`

### 2. Measurement fusion

Current fusion should be upgraded from fixed temporary priors to:

```text
integrated = image_value * image_weight + age_sex_prior * prior_weight
```

Where:

- `image_weight` depends on landmark confidence and source quality
- `prior_weight` depends on source confidence and age-band match
- sliders default to the integrated value
- statistical center is the population median when available, with a labeled mean fallback
- normal statistical bands remain centered on the reference statistic
- editable range is roughly `integrated value ± 3SD`, so the character baseline starts at the visual center; optional design override remains allowed

Warnings:

- `abs(z) > 2`: show warning icon
- `abs(z) > 3`: show strong warning but allow the value
- no SD available: show low-confidence badge rather than blocking edits

### 3. Respiratory and lifestyle module

Inputs:

- lifestyle and disease-history effects are future research topics only and are excluded from the public implementation
- age/sex/height/weight/body composition

Outputs:

- `maximum_ventilation_l_min`, structurally capped by thoracic and abdominal volume estimates
- `respiratory_support`, defined only as speech-time utilization of available capacity
- preview `respiratory_drive` combining VC/FVC, FEV1/PEF, maximum ventilation, respiratory pressure, and utilization once
- `breath_stability`
- `subglottal_pressure_capacity`
- `airway_resistance_modifier`
- pediatric/adolescent respiratory variables where supported: VC, FVC, FEV1, FEV1%, PEF

Rules:

- ages 10-20: prefer the young Japanese respiratory-function PDF tables/equations
- adults: use official aggregate lifestyle/body-composition sources plus a conservative respiratory model until a better Japanese adult spirometry table is added
- any future lifestyle or disease model requires a separate ethics review, public aggregate evidence, and an explicit non-diagnostic design
- thoracic and abdominal volumes act upstream through the maximum-ventilation ceiling and must not be added again inside `respiratory_support`

### 4. Detailed vocal-fold parameter panel

Add a panel for:

- vocal-fold mass proxy
- spring constant
- damping
- baseline muscle tension
- read-only F0 derived from the physical source quantities
- mucosal inflammation/edema (future research only; not implemented)
- airway lumen narrowing (future research only; not implemented)

Neurological/autonomic response curves remain a separate future profile and must not be represented by a local vocal-fold multiplier in this panel.
The retired `glottal_closure` master exists only in one-way pre-0.3 migration code; current projects store explicit LF-style source quantities.

Preview mapping:

- spring constant and tension: F0 response and vibrato/stability
- damping: spectral tilt and attack dullness
- disease-related acoustic mappings are intentionally unspecified until an ethically and scientifically approved study is designed

This should remain a preview model until a real physical core is connected.

### 5. Face, dentition, and vocal-tract-shape mapping

Represent face/dentition as editable parameters:

- dental arch width
- overjet/overbite class
- palate height proxy
- oral cavity length scale
- oral cavity area scale
- tongue-palate constriction proxy
- lip aperture and lip protrusion
- nasal/oral coupling

Map to synthesis controls:

- oral cavity scale: formant spacing and vowel-specific F1/F2 shifts
- dental/palatal constriction: notch/boost filters and consonant-planning metadata
- lip aperture/protrusion: mouth radiation and lower formant shifts
- nasal coupling: nasal antiresonance and sinus side-branch filters

### 6. 2D binary and future voxel volume layer

Add a geometry tab section for:

- binary mask upload
- browser drawing over the source image
- `1px = X mm` calibration
- polygon/mask area estimate
- simple solid-of-revolution volume estimate
- future voxel stack import

Outputs:

- cavity cross-section function
- rough cavity volume
- confidence and source mask metadata

## Unified Articulation Model Roadmap

All manners of articulation must reuse one glottal source, one time-varying vocal-tract state, and one articulatory coordinate space. A consonant is therefore not an independently rendered clip prepended to a vowel. Each token is a set of continuous control functions over the same physical state:

- `A_oral(x,t)`: oral/pharyngeal cross-sectional area
- `A_vp(t)`: velopharyngeal-port area
- `A_nasal(x,t)`: synthetic nasal-path area
- `g(t)`: glottal source and voicing state
- `p_oral(t)` / `p_nasal(t)`: pressure/volume-velocity state propagated by the connected waveguide
- `c(t)`: constriction position, minimum area, width, and contact state
- `q_turbulence(x,t)`: localized aerodynamic noise source, used only when the constriction supports turbulence

Implementation order by manner:

1. **Alveolar nasal `/n/`**: three-port pharyngeal/oral/nasal pressure junction, closed oral side branch, open nasal radiation, then continuous oral release and VP closure into the following vowel. This is the first pressure-coupled reference implementation.
2. **Bilabial nasal `/m/`**: migrated to the same branched core. Place now differs by the oral closure trajectory, not by a separate nasal sound generator. Moraic `/N/` remains a terminal-hold migration target.
3. **Approximants and glides**: open tract with smooth target trajectories and no independent turbulence source. `/j/` and `/w/` are rapid vowel-like trajectories; liquids add tongue-tip or lateral constraints.
4. **Fricatives**: constriction-dependent pressure drop plus a localized turbulent source, injected at the constriction and propagated through the same downstream tract. Voiced fricatives retain the common glottal source.
5. **Stops**: complete closure, supraglottal pressure accumulation, release-area opening, burst source, and continuous voice-onset-time control on the same tract state.
6. **Affricates**: stop closure/release followed by a fricative constriction trajectory; no clip boundary between the burst and turbulent interval.
7. **Tap/trill/lateral classes**: short ballistic contact or repeated flow-coupled contact and, where applicable, parallel lateral channels in the 2.5D layer.

The current `/n/` solver uses a lossy three-port scattering junction. Oral and nasal terminal volume velocities are derived from their pressure waves and terminal areas, then radiated and summed once. The oral-side antiresonance is generated by the closed branch itself; the old explicit nasal pole/zero coloring is disabled for `/n/`. A derived coronal gesture now compresses the tongue-blade/body region and retains a moderate alveolar constriction at an intermediate release keyframe, strengthening the place transition without adding another source or UI dimension. Velopharyngeal opening controls branch admittance independently from the nostril-radiation scale, preventing the radiation control from overloading the junction. Nasal wall/viscothermal loss is frequency dependent, and no stochastic release burst is injected. The tongue and nasal geometries are synthetic and aggregate-scale, not copied from a participant.

## UI Refactor Plan

### Header

The header becomes the integration control area:

- data-source selection
- sample voice playback
- save profile
- load profile

### Tab 1: Data Initial Analysis

Sections:

- full-body front preview
- full-body side preview
- body measurements vs population statistics
- head-neck front preview
- head-neck side preview
- head-neck measurements vs population statistics

The head-neck profile preview and 2D tract overlay are implemented. A separate full-body side image and landmark set remain a future addition.

### Tab 2: Detailed Analysis And Settings

Sections:

- lifestyle and history parameters
- anthropometric sliders
- respiratory sliders
- vocal-fold detail sliders
- resonance and vocal-tract-shape sliders

Slider behavior:

- default thumb: integrated estimate
- statistical marker: population median when available, otherwise a labeled mean fallback
- range: approximately `integrated value ± 3SD`
- color bar: red at extreme ends, green near population center
- warning icon: shown when current value exceeds `2SD`

### Current Calibration Tabs

The current standalone UI separates phoneme calibration from baseline design:

- `母音調整`: vowel execution controls, direct `A(x)`/`W(x)` editing, A/B playback, and auditory evaluation
- `子音調整`: target-arrival/coarticulation controls and consonant-class calibration; `/m/` and `/n/` share the pressure-coupled branched waveguide and differ by contact location/trajectory, while moraic `/N/` retains a dedicated terminal nasal path
- `TTS設定`: engine-independent phoneme/syllable dataset preview and export

Non-nasal consonant generators remain placeholders and should be replaced incrementally by consonant-class models.

## Physical Synthesis Freeze (2026-07-19)

The fully physical browser-synthesis path is frozen at this checkpoint as a separate research result. It preserves the 44.1 kHz 2.5D-derived vowel tube, direct `A(x)`/`W(x)` editing, the common pressure-coupled `/m/` and `/n/` waveguide, engineering diagnostics, and reproducible profile/material export. Vowels and the default `/m/` are useful calibration outputs; `/n/` remains insufficiently distinct from `/m/` in listening evaluation despite place-derived coronal geometry. Non-nasal consonants remain experimental placeholders.

The freeze is methodological rather than technical. A stylized exterior image underdetermines tongue posture, internal cavity topology, tissue mechanics, and time-varying articulation. Continuing to add statistical corrections and auditory trial-and-error terms would weaken the explanatory link between visible morphology and generated sound. The frozen implementation therefore remains available for physical-model research, but it is no longer the primary product-development path.

The successor branch treats observable morphology and explicit character design choices as interpretable controls for a machine-learning TTS backend. It will export baseline voice descriptors and inference-time controls such as F0 range, spectral tilt/breathiness, vocal-tract-length or timbre embeddings, respiratory phrasing, and articulation style without claiming that an exterior image uniquely reconstructs the internal vocal tract.

### Tab 3: Phoneme Output And Export

Sections:

- vowel preview
- phoneme/material list
- WAV export
- JSON profile export
- future external TTS/core API export

## Implementation Order

1. Add this plan and data schemas.
2. Refactor UI into header plus three tabs without changing existing behavior.
3. Add prior resolver and connect existing temporary priors through it.
4. Extract and encode the attached PDF values into `local_pdf_growth_priors.js`. Initial manual-extract scaffold implemented for school-age head growth, pediatric airway length, tube-depth uncertainty, and sinus development.
5. Add AIST item importer or manual cache for the high-priority dimensions.
6. Add National Health and Nutrition Survey importer/cache for age-band lifestyle/body-composition priors.
7. Replace current hard-coded feature priors with resolved age/sex priors.
8. Implement SD-aware sliders, gradient bars, and warning icons.
9. Add detailed vocal-fold parameter panel and preview mappings.
10. Add face/dentition/vocal-tract-shape parameter mapping.
11. Add binary-mask drawing/upload and calibration tools.
12. Extend export/API contract to include all selected sources, warnings, masks, and phoneme output settings.

## Acceptance Criteria

- The app can be opened as a standalone WebUI.
- Existing image landmark workflow still works.
- Age and sex change the statistical priors visibly.
- Sliders show population center, integrated default, and SD warnings.
- Exported JSON contains source provenance and warning state.
- No row-level or ID-like external data is stored.
- Preview synthesis reacts audibly to respiratory, vocal-fold, nasal/sinus, and body-resonance parameters.

## Open Questions

- Which survey year should be the default for National Health and Nutrition Survey priors?
- Should character age be treated as biological age, apparent age, or a separate design parameter?
- For non-human or stylized characters, should priors remain visible but fully optional?
- Which adult spirometry source should become the default for ages over 20?

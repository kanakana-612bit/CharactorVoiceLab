# Character Voice Lab

Current release version: Ver 1.1

This is a dependency-free MVP for the character-oriented voice design experiment.

Open `index.html` in a browser. It is intentionally independent from the Open WebUI runtime so the experimental data model can evolve without coupling to the main app. Future TTS integration should happen through the API boundary described in `API_CONTRACT.md`, not by embedding a specific TTS engine or VocalTractLab directly in this UI.

The implementation roadmap is tracked in `IMPLEMENTATION_PLAN.md`.
Literature and dataset gaps are tracked in `EVIDENCE_GAPS.md`.
Source permissions and allowed evidence roles are tracked in `SOURCE_ETHICS_AUDIT.md`.

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

Implemented:

- publication-oriented four-tab workflow: basic information, detailed settings, reserved speech-output settings, and references/publication policy
- header-level profile load, `voice_profile` naming, and reproducible package save
- detailed-setting classification by design role and anatomical domain: baseline vocal tract, glottal physiology, trunk/respiration, PerformanceControlRange, execution control, and advanced acoustic preview
- per-parameter `PerformanceControlRange` editors with independently stored minimum, baseline, and maximum values
- detail-tab-only floating phoneme selector and sample playback action
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
- 44.1 kHz 2.5D-derived acoustic-tube vowel preview that projects the designed cross sections to total `A(x)`, using length-correct Kelly-Lochbaum discretization, separate jaw-opening/oral-volume/lip-rounding vowel targets, an LF-style volume-velocity glottal input, tract-length-normalized distributed losses, simple nasal/sinus/piriform side-branch losses, and restrained soft-wall compliance
- vowel-specific direct editing of total area `A(x)` and coronal width `W(x)`; width edits preserve sagittal height and recompute the projected tube area
- auditory calibration workflow with untuned/tuned A/B playback, phoneme-clarity and target-match ratings, notes, and profile-persisted evaluation history
- engine-independent vowel/CV dataset export; CV onsets remain explicitly experimental and can be selected and evaluated one token at a time
- read-only F0 derived from the reference center, vocal-fold spring constant, baseline muscle tension, and the currently provisional inflammation mapping
- respiratory source drive using VC/FVC, FEV1/PEF, maximum ventilation, maximum respiratory pressure, and speech-time support utilization; thoracic and abdominal volumes constrain maximum ventilation upstream
- body resonance implemented as an independent parallel branch whose thoracic-volume-derived frequency, peak gain, and wet/dry coupling are stored separately
- articulatory-control modifiers that separate phoneme gesture execution from tongue-dorsum, lip/cheek transverse, and tongue-groove PerformanceControlRange availability; availability limits a current gesture without redefining the neutral 2.5D anatomy, alongside motor precision, coarticulation strength, motor maturity, and phonological contrast maturity
- Honda-style profile anchors for ANS, PNS, Menton, posterior pharyngeal wall, soft-palate hinge, and velum tip
- morphological articulation-space guides exporting OCL, LFH, soft-palate length, velopharyngeal gap, and schematic paranasal sinus side branches
- external neck-root breadth tracking, kept independent from the tracheal internal-diameter design parameter
- optional smoking, exercise, diet, and respiratory-history inputs as conservative respiratory modifiers
- low-poly inferred body model
- baseline voice-parameter, UI edit-range, per-parameter performance-range override export, and reload
- reproducible project ZIP packages containing `manifest.json`, `profile.json`, and the selected reference images
- separate primary-language, phonetic-target-profile, and morphology-reference-population metadata; a phonetic profile is a language/variety target and is never an ancestry or ethnicity selector
- jaw-conditioned relaxed mouth-width inference that treats a stylized commissure distance as a pursed/lower-bound proxy, then supplies vowel-specific `/i/ > /e/ > /o/ > /u/` transverse targets within a PerformanceControlRange
- reference-image style selection (`illustration` by default, or `photo_realistic`) so stylized images use broader latent anatomy/articulation inference while realistic images retain more direct measurement weight
- `/a i u e o/` previews using only the 44.1 kHz 2.5D-derived acoustic-tube model; the selected phonetic target supplies Japanese aggregate F1/F2 evaluation targets, higher-resonance engineering references, and vowel-specific articulation cues
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
- final external TTS engine integration
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
- The 2.5D layer separates midsagittal height, coronal width, section aspect, and a latent tongue-groove/lateral-channel capacity before deriving `A(x)`. The current acoustic solver still receives only total area, so multi-channel propagation and full 3D acoustics remain future work.

Do not treat placeholder head/face/body priors as validated research data. Replace them with the selected source table before publication-grade analysis.

The initial-analysis UI no longer embeds external AIST definition figures. Landmark definitions are displayed from the local schema and should be replaced or refined with project-owned schema diagrams and book-checked wording before redistribution-focused releases.

Public release evidence policy:

- Use broadly accepted reference values, public aggregate statistics, and formula-level mappings.
- Use medical or anatomical papers only as aggregate references, generalized equations, parameter-schema support, or validity checks for computed values.
- Do not use case reports, individual patient rows, subject IDs, imaging files, row-level clinical data, or cross-table participant linkage.
- Present all embedded values as non-medical engineering priors for character voice design, not as diagnosis, treatment support, or individual biological identification.

External cohort acquisition policy:

- External cohort data is not collected by this prototype.
- A new source may be added only after it is reviewed against the project ethics policy.
- Approved sources must be aggregate-only and must not include participant IDs, sample IDs, row-level records, clinical images, or cross-source linkage keys.

Calibration regression test:

```powershell
node tests/landmark_schema.test.js
```

# Character Voice Lab Implementation Plan

This plan turns the current research ideas into implementable stages. The main rule is that population data enters the app as aggregate priors, while character-specific values remain user-controlled design parameters.

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
- age-band prevalence for smoking, drinking, exercise habit, and diet categories
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

- smoking history
- exercise habit
- diet habit
- respiratory history
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
- smoking and respiratory history should affect damping, noise, and pressure stability more than formant placement
- thoracic and abdominal volumes act upstream through the maximum-ventilation ceiling and must not be added again inside `respiratory_support`

### 4. Detailed vocal-fold parameter panel

Add a panel for:

- vocal-fold mass proxy
- spring constant
- damping
- baseline muscle tension
- read-only F0 derived from the physical source quantities
- mucosal inflammation/edema
- airway lumen narrowing

Neurological/autonomic response curves remain a separate future profile and must not be represented by a local vocal-fold multiplier in this panel.
The retired `glottal_closure` master exists only in one-way pre-0.3 migration code; current projects store explicit LF-style source quantities.

Preview mapping:

- spring constant and tension: F0 response and vibrato/stability
- damping: spectral tilt and attack dullness
- inflammation/edema: lower effective F0, higher noise, wider bandwidth, reduced closure efficiency
- lumen narrowing: increased turbulent noise and high-frequency damping

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

### Tab 3: Phoneme Output And Export

Sections:

- vowel preview
- phoneme/material list
- WAV export
- JSON profile export
- future Irodori-TTS/core API export

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

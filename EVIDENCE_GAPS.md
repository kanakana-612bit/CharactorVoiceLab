# Evidence Gaps

This list tracks parameters that are currently implemented as placeholders, weak proxies, or preview controls. It is meant to guide literature and dataset supplementation.

## Anthropometry And Image Priors

| Parameter | Current state | Needed evidence |
| --- | --- | --- |
| `shoulder_width_cm` | Temporary design prior | Japanese age/sex/body-size table; AIST shoulder breadth and biacromial breadth should replace this. |
| `torso_length_cm` | Temporary design prior | Sitting height, cervicale/suprasternale/acromiale landmark references, or trunk-length table by age/sex. |
| `pelvis_width_cm` | Low-confidence body-scale proxy | Japanese pelvic/hip breadth table by sex and age. |
| `lower_face_height_cm` | Temporary head/face prior | AIST facial height items or equivalent Japanese craniofacial table. |
| `mouth_width_cm` | Temporary head/face prior | AIST mouth breadth or face/dentition table. |
| `mouth_width_inference_0.1` | Engineering correction using depicted commissure width plus the bundled mouth-to-jaw center ratio | Aggregate relaxed, rounded, and maximally spread commissure-width distributions by jaw breadth; current endpoints must remain low-confidence design priors. |
| `inputs.reference_image_style` | Engineering observation-model switch: illustration mode treats a depicted mouth as a compressed lower-bound signal; photo/realistic mode gives it more direct weight | Validation against paired stylized and photographic depictions, with aggregate facial-motion and anthropometric data. It must remain a design-mode choice rather than a biological estimate. |
| `interpupillary_width_cm` | Temporary face scale anchor | Japanese interpupillary distance table by age/sex. |
| `jaw_width_cm` | Schema-supported placeholder | Bigonial breadth / mandibular angle breadth table by age/sex. |
| `neck_root_width_cm` | AIST/HQL 2003 public aggregate values for young adults; image-derived front width is fused with this prior | Additional age bands and a clearer mapping between the database measurement posture and stylized character images. Do not use this value to infer tracheal internal diameter. |
| `head_units` | Character design proxy | Should remain design-only; do not treat as population anatomy. |

## Vocal Tract And Resonance

| Parameter | Current state | Needed evidence |
| --- | --- | --- |
| `inputs.phonetic_target_profile` | Separate language/variety selector; default `ja_JP_standard_neutral_aggregate_0_1` is not linked to morphology or ancestry | Additional public aggregate targets for explicitly named languages/varieties and speech styles. Each profile must retain source scope and must not import speaker-level corpus data. |
| Japanese `/a i u e o/` F1/F2 targets | Kagomiya 2015 published adult sex-stratified aggregate values; VTL normalization is an engineering mapping | Public aggregate targets by age, speech style, region/variety, and carefully documented vowel context. Do not use audio, token, frame, or speaker records. |
| Japanese F3/F4 targets | Pisanski 2016 public general sex-class F3/F4 baselines with provisional vowel-shape factors | A suitable public Japanese aggregate F3/F4/B1-B4 table with compatible scope. Current values are not Japanese measurements. |
| `area_function_tube_0.2.articulation_target` Japanese `/u/` lip compression / reduced rounding | Public phonetic description plus an engineering 2.5D-to-1D projection; improves /u/-/o/ separation but is not motion capture | Public aggregate articulography, ultrasound, MRI, or generalized Japanese area-function data that can be used without individual-subject coefficients. |
| `pharyngeal_length_scale` | Morphology proxy | MRI/CT vocal tract length and pharyngeal subdivision data by age/sex/body size. |
| `pharyngeal_area_scale` | Jaw/shoulder/pelvis proxy | Imaging-derived pharyngeal cross-section or acoustic tube area-function references. |
| `larynx_height_offset_mm` | Age/sex heuristic | Japanese or pediatric/adult larynx height / hyoid / vocal-fold position references. |
| `nasal_cavity_volume_cm3` | Head/lower-face/jaw proxy | Nasal cavity volume by age/sex, preferably CT/MRI-based. |
| `paranasal_sinus_volume_cm3` | Qualitative age modifier plus morphology proxy | Maxillary/frontal/ethmoid/sphenoid sinus volume tables by age/sex. |
| `sinus_neck_area_cm2` | Helmholtz side-branch proxy | Anatomical ostium/neck area and effective acoustic neck-length references. |
| `sinus_neck_length_cm` | Helmholtz side-branch proxy | Same as above; current value is only a synthesis control. |
| `sinus_coupling` | Nasal/sinus proxy plus manual slider | Acoustic coupling estimates between nasal cavity, sinuses, and vocal tract. |
| `sinus_damping` | Preview control | Acoustic damping/Q factor data or perceptual calibration. |
| `side_branch_loss_coupling` | Global preview control for side-branch coloring | Lightweight side-branch model calibration across nasal, sinus, and piriform-fossa losses. |
| `velopharyngeal_loss_coupling` | Manual/design proxy guided by velopharyngeal gap handles | Aggregate velopharyngeal coupling or nasal-leak acoustic references that do not rely on identifiable clinical cases. |
| `piriform_fossa_loss_coupling` | Preview antiresonance control | Generalized piriform-fossa side-branch acoustic models and perceptual calibration. |
| `piriform_fossa_frequency_hz` | Vocal-tract-length-scaled preview frequency | Aggregate or model-derived piriform-fossa antiresonance frequency ranges. |
| `nasal_branch_damping` | Preview damping control | Nasal side-branch damping/Q references suitable for lightweight synthesis. |
| `mouth_radiation_scale` | Mouth-width proxy | Lip aperture/protrusion and mouth radiation model references. |
| `vocal_tract_wall_loss` | Human-general preview default | Literature-calibrated wall-loss values for the selected 1D tube model. |
| `vocal_tract_viscothermal_loss` | Human-general preview default | Viscothermal loss references or a physically derived implementation for tube sections. |
| `vocal_tract_high_frequency_damping` | Human-general preview default | Perceptual/acoustic calibration for high-frequency damping in the browser preview. |
| `vocal_tract_wall_compliance` | Soft-wall preview approximation | Wall compliance / yielding-wall acoustic models suitable for a lightweight 1D tube. |
| `vocal_tract_resonance_broadening` | Frequency-dependent preview broadening | Calibration for how much narrow tube resonances should be broadened before the sound becomes voice-like. |
| `lip_radiation_smoothing` | Human-general preview default | Lip-radiation model calibration by aperture, protrusion, and tract termination. |
| `hybrid_side_branch_strength` | Engineering preview bridge | Perceptual calibration for how much side-branch coloring can be applied before the hybrid preview becomes instrument-like. |
| `hybrid_formant_anchor` | Engineering preview bridge | Perceptual calibration for how strongly formant-envelope anchoring should dominate raw tube resonances. |
| `hybrid_tube_texture_mix` | Engineering preview bridge | Perceptual calibration for raw tube texture audibility before it becomes oboe-like. |
| `hybrid_source_noise_routing_0.1` | Engineering source-routing rule: reduced aspiration noise is owned by the formant layer; the tube texture receives none | Perceptual calibration of breathiness and HNR across formant/tube mix ratios. The rule prevents duplicated noise but is not a physical source-filter coupling model. |
| `vocal_tract_geometry_0.2.sections[*].sagittal_diameter_cm` | Synthetic vowel-neutral midsagittal template scaled by profile landmarks and a manual palatal-vault design control | Reusable generalized or aggregate midsagittal/area-function templates, preferably vowel- and age-conditioned. Single-subject coefficients are not acceptable for the public prototype. |
| `vocal_tract_geometry_0.2.sections[*].frontal_width_cm` | Independent tracheal design anchor plus neck/jaw/mouth proxies with linear interpolation | Direct reusable width or area-function evidence and uncertainty by tract region. External neck width must remain separate from internal tracheal size. |
| `vocal_tract_geometry_0.2.sections[*].cross_section` | Synthetic 2.5D section with sagittal height, coronal width, ellipse factor, aspect ratio, and latent lateral-channel capacity | Public aggregate or generalized cross-sectional shape statistics. Do not use participant MRI/CT meshes, speaker coefficients, or raw image volumes. |
| `palatal_vault_scale`, `lip_aperture_aspect_scale` | Explicit latent design controls rather than image-estimated internal anatomy | Public aggregate anatomical ranges or reusable generalized parametric templates; retain a clear design-control label even if such references are added. |
| `tongue_groove_capacity` | Available PerformanceControlRange for lateral tongue/groove behavior in the 2.5D design layer | Aggregate articulography, ultrasound, MRI, or generalized parametric data describing tongue-groove and lateral-channel behavior without individual-subject coefficients. |
| `vocal_tract_geometry_0.2.sections[*].area_cm2` | Elliptical total-area projection from the 2.5D section | Validation against generalized area functions and sensitivity testing; the ellipse is currently a design approximation. |
| `area_function_tube_0.2.articulation_target` | Engineering vowel targets with jaw opening, oral expansion/aperture, tongue-dorsum constriction, lip/cheek transverse spread, and 2.5D cross-section targets represented separately before reducing to A(x) | Aggregate dynamic articulography or reusable generalized vowel-area functions for calibrating each target without relying on individual-subject records. |
| `tongue_dorsum_range_utilization` | Available PerformanceControlRange for internal tongue-dorsum constriction; it only limits a gesture when below neutral and does not amplify a fixed target above neutral | Public aggregate articulography, ultrasound, or generalized MRI data describing vowel-specific tongue-dorsum excursion ranges. |
| `labial_transverse_range_utilization` | Available PerformanceControlRange for lip and cheek transverse spreading; it only limits a gesture when below neutral and does not amplify a fixed target above neutral | Aggregate facial-motion or articulography data for vowel-specific lip-corner and cheek transverse movement. |
| 2.5D-to-1D projection | The browser retains richer section metadata but the acoustic solver still receives one longitudinal total-area sequence | Multi-channel acoustic propagation or 3D solver validation for lateral tongue channels, grooves, radiation, and shape differences with the same A(x). |
| Profile hyoid/larynx landmarks | Manual internal design proxies | A manual confirmation workflow or non-identifying aggregate anatomical position model. |
| Shoulder/acromion and trochanter landmarks | Manual schematic handles mapped to canonical anatomical names | A standardized manual placement protocol; visible contour extrema are not necessarily the underlying bony landmarks. |
| Cross-view total-head-height calibration | Deterministic reconciliation using body-image stature and vertex-to-gnathion height | Evaluation on matched front/profile images, especially stylized characters with inconsistent projections or cropped hair/head boundaries. |

## Respiratory And Body Resonance

| Parameter | Current state | Needed evidence |
| --- | --- | --- |
| `maximum_ventilation_l_min` | Height/weight/torso proxy; young respiratory equations now partly inform ages 10-20 | Adult Japanese MVV or ventilation table by age/sex/height; child table outside 10-20. |
| `thoracic_volume_l` | Torso/shoulder/height/weight proxy with a very small body-composition soft-tissue modifier | Chest cavity / thoracic volume or chest circumference/depth table by age/sex. Current Komiya/body-fat values do not directly measure thoracic cavity volume. |
| `abdominal_volume_l` | Torso/pelvis/weight proxy with conservative body-fat and abdominal-skinfold modifier | Abdominal cavity volume or waist/abdominal depth/circumference references. Regional skinfold response is only a surface soft-tissue guide. |
| `respiratory_support` | Composite preview control | Validation against spirometry, pressure, phonation duration, or singing/speech breath-support data. |
| `body_resonance_frequency_hz` | Thoracic-volume-derived preview control | Body/chest wall resonance acoustic references. |
| `body_resonance_gain_db` | Preview gain control | Perceptual/acoustic calibration for body-resonance audibility. |
| `body_resonance_coupling` | Thoracic volume, closure, and conservative body-composition proxy | Coupling data between source, airway, body composition, and body/chest resonance. Current skinfold data only supports directionality. |
| `maximum_respiratory_pressure_pa` | Manual setting | Maximal inspiratory/expiratory pressure or subglottal pressure references by age/sex. |

## Vocal Fold And Pathophysiology

| Parameter | Current state | Needed evidence |
| --- | --- | --- |
| `vocal_fold_spring_constant` | Age/lifestyle/inflammation preview proxy | Vocal-fold biomechanical stiffness data by age/sex/pathology. |
| `baseline_muscle_tension` | Preview proxy | Laryngeal muscle tension / phonation threshold pressure references. |
| `tension_response_curve` | Preview control | Data linking cricothyroid/thyroarytenoid tension changes to F0 and stability. |
| `inflammation_index` | Smoking/respiratory-history proxy | Edema/inflammation effects on vocal-fold mass, damping, closure, and acoustic noise. |
| `airway_lumen_narrowing` | Inflammation/history proxy | Airway narrowing effects on turbulence, resistance, and phonation stability. |
| `glottal_closure` | Manual slider | Needs mapping to measured open quotient / closed quotient if used physically. |
| `glottal_open_quotient` | LF-style preview control derived from closure/inflammation | Aggregate acoustic or laryngographic open-quotient ranges by phonation mode, age, and sex. |
| `glottal_speed_quotient` | LF-style preview control derived from closure/tension | Source-model references linking speed quotient to perceived pressed/breathy quality. |
| `glottal_return_phase` | LF-style preview control derived from closure/inflammation | Return-phase calibration for the simplified LF-style source. |
| `glottal_spectral_tilt_db` | Preview spectral-tilt control | Voice-source spectral tilt references by phonation type and speaker class. |
| `glottal_breathiness` | Aspiration-noise preview control | Breathiness/noise calibration against HNR or perceptual ratings. |
| `glottal_volume_velocity_drive` | Preview source-input blend | Source-filter references for volume-velocity injection into a lightweight 1D tube model. |
| `glottal_flow_smoothing` | Preview source smoothing | Calibration for how much LF-style flow smoothing is perceptually plausible by phonation mode. |
| `glottal_flow_inertance` | Preview inertive source component | Acoustic/biomechanical references for inertive vocal-tract loading and source interaction. |

## Lifestyle And Disease

| Parameter | Current state | Needed evidence |
| --- | --- | --- |
| BMI reference display | Young Japanese female grouped proxy, Komiya 1997 Japanese age/sex mean proxy, and General adult fallback percentiles | Japanese public age-band BMI medians by sex, preferably official aggregate tables. Komiya values are means/model centers, not medians. |
| Body-fat percentage guide | Young Japanese female BIA group summaries, Komiya 1997 Japanese age/sex aggregate means, plus Deurenberg BMI/age/sex formula fallback | Japanese age-band and sex-specific measured body-fat percentage distributions with method-specific separation. |
| Regional fat distribution | Young Japanese female BIA trunk/leg/arm percentage summaries plus a non-Japanese regional skinfold response guide | Male, middle-aged, older-adult, and post-menopausal distribution data from Japanese aggregate public sources. The current skinfold response guide is not a Japanese population center. |
| Smoking modifiers | Conservative manual categories | Age/sex smoking prevalence and spirometry/vocal effects; public aggregate source preferred. |
| Exercise modifiers | Conservative manual categories | Exercise habit vs pulmonary function/breath support references. |
| Diet modifiers | Very weak condition modifier | Evidence is indirect; may remain UI metadata rather than acoustic parameter. |
| Respiratory history modifiers | Conservative preview penalties | Disease-specific spirometry and voice-quality effects, ideally aggregate and non-identifying. |

## Already Partially Supported

| Parameter | Current support | Remaining gap |
| --- | --- | --- |
| `predicted_vc_l`, `predicted_fvc_l`, `predicted_fev1_l`, `predicted_pef_l_s`, `predicted_v50_l_s`, `predicted_v25_l_s` | Local PDF Table 4 equations for Japanese ages 10-20 | Adult and under-10 references; direct mapping to phonation capacity still needs validation. |
| `pediatric_vocal_cord_to_carina_cm` | Local pediatric airway PDF height equation | Voice relevance is indirect; use only as airway-length/safety proxy. |
| school-age head growth | Local PDF endpoints for ages 6 and 11 | Need full table/SDs and connection to face/mandible dimensions. |

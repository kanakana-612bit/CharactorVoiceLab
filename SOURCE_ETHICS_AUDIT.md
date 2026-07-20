# Source Ethics Audit

This audit applies the project's public-release evidence policy to sources relevant to the 2026-07-14 geometry work.

## Allowed For Embedded Numeric Priors

| Source | Allowed role | Conditions |
| --- | --- | --- |
| AIST/HQL 2003 public aggregate anthropometry | External neck-root breadth and other published aggregate body-dimension priors | Store only published aggregate statistics and citation metadata. Do not obtain or import individual data. |
| AIST 1991-92 anthropometry manual | Canonical landmark terminology, definitions, and measurement directions | Use the definition manual only; no participant-level records are required. |
| Japanese body-dimension aggregate papers (2014-2016) | Age/sex aggregate plausibility and later cohort calibration | Extract only table-level statistics. Confirm measurement definitions before merging with AIST items. |
| Generalized equations in the attached young-respiratory PDF | Age/height-conditioned engineering priors | Preserve population, age range, equation source, and uncertainty. Do not extrapolate silently. |
| Japanese young-women body-fat distribution paper | Body-fat percentage and regional fat-distribution setting guide | Use only published group summaries. Keep the scope as young female BIA data; do not generalize to all ages or males. |
| Komiya 1997 Japanese body-composition review/table | Japanese age/sex body-composition mean proxy for BMI, body-fat percentage, fat mass, lean mass, and selected skinfold values | Use only published aggregate/review table values. Label as means or model centers, not medians or clinical standards. |
| 1996 regional skinfold-thickness aggregate paper | Relative site-response guide for how skinfold thickness changes with body-fat percentage | Use only published means and regression slopes. The sample is not Japanese, so do not use it as a Japanese population center. |
| Public adult BMI percentile tables | BMI reference display | Use published aggregate percentiles only. Mark non-Japanese fallback references clearly. |
| BMI-age-sex body-fat formula papers | Formula-level body-fat guide | Label as formula estimate, not measured distribution or medical judgment. |

## Method Or Schema Support Only

| Source | Allowed role | Prohibited use |
| --- | --- | --- |
| Dediu et al. 2022 MRI vocal-tract study | Landmark schema, anatomical variable separation, uncertainty design | No participant rows, IDs, images, or subject-specific geometry. |
| Baer et al. 1991 MRI vowel study | Midsagittal-to-area-function modeling concept | No subject-specific coefficients as character priors. |
| Internal cross-domain and parameter reports | Architecture and naming support | Do not cite them as independent empirical validation. |

## Plausibility Check Only

| Source | Allowed role | Prohibited use |
| --- | --- | --- |
| Japanese ultra-high-resolution CT tracheal-dimension study | Check whether an independently selected adult tracheal design value is grossly implausible | Do not infer internal airway size from external neck width. Do not import images or row-level clinical data. |
| Pediatric intubation/anatomy studies | Qualitative plausibility context only | Do not encode or calculate intubation depth, safe insertion depth, participant measurements, or treatment-oriented values. Do not use them as direct voice predictions. |
| Review of age-related lung changes | Qualitative respiratory-aging plausibility and terminology | Do not derive character-level disease, smoking, or acoustic parameters without a separate aggregate quantitative source. |

## Excluded

| Source or data class | Reason |
| --- | --- |
| Baudouin et al. 2026 historical-individual vocal-tract reconstruction | Single-individual reconstruction conflicts with the project's no-individual-case public evidence scope. It is not used for numeric priors, architecture, or validation. |
| Case reports and individual clinical reports | Consent and reuse scope may not cover character-voice engineering; high re-identification and overfitting risk. |
| Participant IDs, ID-like values, row-level records, clinical images, or cross-table linkage keys | Outside the approved aggregate-only workflow. |
| dbTMM and all Tohoku Medical Megabank-derived information | Explicitly banned from this research, for both public and private implementations. |
| Mouse tracheal measurements as human numeric priors | Species mismatch. They may inform general experimental vocabulary only and are not imported into the model. |
| Lifestyle history, disease history, inflammation, or airway-narrowing mappings | No validated and ethically scoped mapping has been approved. These remain discussion-only future research topics and are excluded from the public implementation. |

## Local Processing And User-Supplied Images

- The public server and its audio.cpp upstream must bind to explicit loopback addresses.
- Browser API connections are restricted to the same local origin. Project images, profile values, text, and generated audio are not uploaded.
- Setup and update scripts may download dependencies and model files from their official distribution sources, but they do not transmit project data.
- Real-person images require explicit consent or another lawful basis. Users must not enter medical history or other sensitive personal information.
- Saved project packages contain the selected reference images and design variables and must be handled accordingly.

## Review Rule

Before adding a new source, record:

1. source population and data-collection context
2. whether the proposed use matches the stated consent/publication scope
3. whether only public aggregate or generalized values are required
4. whether a less sensitive anatomical, engineering, or aggregate source can serve the same purpose
5. the exact allowed role: numeric prior, generalized formula, schema support, or plausibility check

If a source might violate these rules, stop before retrieval or implementation and warn the project owner.

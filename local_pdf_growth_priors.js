window.CVL_LOCAL_PDF_PRIORS = {
  schema_version: "local_pdf_growth_priors_0.1",
  extracted_at: "2026-07-13",
  privacy: "aggregate_only",
  notes: [
    "This file contains only manually extracted aggregate values and equations from the locally supplied PDFs.",
    "No participant-level records or identifiers are represented.",
    "Respiratory-function equations for ages 10-20 are reserved but not numerically encoded until the relevant table/equation is extracted cleanly."
  ],
  sources: {
    headGrowthSchoolchildren: {
      file_label: "学童の頭部成長の縦断的観察.pdf",
      use: "Ages 6-11 head girth, head length, head breadth, and cephalic-index reference trends.",
      evidence_level: "manual_extract_from_text"
    },
    youngJapaneseRespiratory1020: {
      file_label: "日本人の若年者（10歳から20歳）の呼吸機能検査の基準値.pdf",
      use: "Planned reference for VC, FVC, FEV1, FEV1%, PEF, V50, and V25 for ages 10-20.",
      evidence_level: "manual_extract_table_4_equations"
    },
    pediatricVocalCordToCarina: {
      file_label: "小児における理想的な気管チューブ挿入長についての声帯から気管分岐部までの距離を指標とした検討.pdf",
      use: "Height-linked pediatric vocal-cord-to-carina / airway length proxy.",
      evidence_level: "manual_extract_from_text"
    },
    pediatricTubeDepthMethods: {
      file_label: "小児気管チューブ挿入長決定法の比較.pdf",
      use: "Uncertainty evidence for pediatric airway-length formulas.",
      evidence_level: "manual_extract_from_table"
    },
    pediatricHeadNeckImaging: {
      file_label: "画像診断における成育の診方.pdf",
      use: "Qualitative pediatric nasal/paranasal sinus development modifier.",
      evidence_level: "qualitative_extract"
    },
    bodyDimensionSecularChange: {
      file_label: "日本人の人体寸法の変化量推定.pdf",
      use: "Planned secular-change correction between old anthropometric tables and newer population statistics.",
      evidence_level: "structure_identified_table_pending"
    }
  },
  head_growth_schoolchildren: {
    age_min: 6,
    age_max: 11,
    unit: "cm",
    variables: {
      head_girth_cm: {
        male: { age6: 50.7, age11: 53.3 },
        female: { age6: 50.4, age11: 53.2 },
        source: "headGrowthSchoolchildren",
        note: "Text extract: age 6 and age 11 means; interpolation is linear for UI preview."
      },
      head_length_cm: {
        male: { age6: 17.0, age11: 17.5 },
        female: { age6: 16.7, age11: 17.4 },
        source: "headGrowthSchoolchildren",
        note: "Text extract: age 6 and age 11 means; interpolation is linear for UI preview."
      },
      head_breadth_cm: {
        male: { age6: 14.9, age11: 15.5 },
        female: { age6: 14.5, age11: 15.1 },
        source: "headGrowthSchoolchildren",
        note: "Text extract: age 6 and age 11 means; interpolation is linear for UI preview."
      },
      cephalic_index: {
        male: { age6: 88.1, age11: 88.7 },
        female: { age6: 86.8, age11: 86.7 },
        unit: "index",
        source: "headGrowthSchoolchildren",
        note: "Text extract: age 6 and age 11 means; interpolation is linear for UI preview."
      }
    }
  },
  pediatric_airway: {
    height_range_cm: [43, 181],
    equation_vocal_cord_to_carina_cm: {
      form: "0.0699 * height_cm + 0.8507",
      slope: 0.0699,
      intercept: 0.8507,
      source: "pediatricVocalCordToCarina",
      note: "Extracted from scatter plot description; simplified clinical candidate around height * 0.06 was also reported."
    },
    simplified_safe_insertion_from_vocal_cord_cm: {
      form: "0.06 * height_cm",
      slope: 0.06,
      intercept: 0,
      source: "pediatricVocalCordToCarina",
      note: "Use as a conservative airway safety proxy, not as a direct voice predictor."
    },
    uncertainty_multiplier: 1.45,
    uncertainty_source: "pediatricTubeDepthMethods"
  },
  pediatric_tube_depth_method_table: {
    n: 50,
    source: "pediatricTubeDepthMethods",
    methods: {
      height_based: { appropriate_percent: 56.0, shallow_percent: 30.0, deep_percent: 4.0, unavailable_percent: 10.0 },
      age_based: { appropriate_percent: 60.0, shallow_percent: 26.0, deep_percent: 14.0, unavailable_percent: 0.0 },
      pals_guideline: { appropriate_percent: 56.0, shallow_percent: 42.0, deep_percent: 2.0, unavailable_percent: 0.0 },
      tube_size_based: { appropriate_percent: 64.0, shallow_percent: 36.0, deep_percent: 0.0, unavailable_percent: 0.0 },
      weight_based: { appropriate_percent: 56.0, shallow_percent: 30.0, deep_percent: 14.0, unavailable_percent: 0.0 }
    }
  },
  pediatric_sinus_development: {
    source: "pediatricHeadNeckImaging",
    note: "Qualitative modifier from pediatric head/neck imaging development notes; values are conservative UI controls, not measured sinus volumes.",
    age_modifiers: [
      { age_max: 1, sinus_volume_scale: 0.16, confidence: 0.12 },
      { age_max: 4, sinus_volume_scale: 0.36, confidence: 0.16 },
      { age_max: 8, sinus_volume_scale: 0.62, confidence: 0.18 },
      { age_max: 10, sinus_volume_scale: 0.78, confidence: 0.2 },
      { age_max: 14, sinus_volume_scale: 0.9, confidence: 0.18 },
      { age_max: 120, sinus_volume_scale: 1.0, confidence: 0.16 }
    ]
  },
  young_respiratory_function_10_20: {
    source: "youngJapaneseRespiratory1020",
    age_range: [10, 20],
    n_analyzed: { male: 363, female: 273, total: 636 },
    subject_note: "Non-smokers without suspected rhinitis/asthma were analyzed for prediction equations.",
    formula: "predicted = constant + height_coefficient * height_cm + age_coefficient * age_years",
    variables: ["VC", "FVC", "FEV1", "FEV1_percent_Gaensler", "FEV1_percent_Tiffeneau", "PEF", "V50", "V25"],
    encoded_status: "implemented_from_table_4",
    note: "Prediction relations from multiple linear regression analysis using height and age. Residual values are used as approximate prediction-width proxies in the UI.",
    equations: {
      male: {
        VC: { unit: "L", residual: 0.516792, multiple_r: 0.83295978, contribution: 0.693822, constant: -5.10237, height_coefficient: 0.04468, age_coefficient: 0.11034 },
        FVC: { unit: "L", residual: 0.500749, multiple_r: 0.84686776, contribution: 0.717185, constant: -5.57743, height_coefficient: 0.04889, age_coefficient: 0.09966 },
        FEV1: { unit: "L", residual: 0.416382, multiple_r: 0.87112226, contribution: 0.758854, constant: -5.2164, height_coefficient: 0.04436, age_coefficient: 0.09638 },
        FEV1_percent_Gaensler: { unit: "%", residual: 5.716818, multiple_r: 0.16168797, contribution: 0.026143, constant: 80.32533, height_coefficient: 0.0341, age_coefficient: 0.21219 },
        FEV1_percent_Tiffeneau: { unit: "%", residual: 7.758495, multiple_r: 0.20652119, contribution: 0.042651, constant: 65.67656, height_coefficient: 0.16372, age_coefficient: -0.12044 },
        PEF: { unit: "L/s", residual: 1.321976, multiple_r: 0.78592621, contribution: 0.61768, constant: -7.98558, height_coefficient: 0.0552, age_coefficient: 0.40297 },
        V50: { unit: "L/s", residual: 1.036124, multiple_r: 0.67316566, contribution: 0.453152, constant: -6.38024, height_coefficient: 0.056, age_coefficient: 0.12587 },
        V25: { unit: "L/s", residual: 0.749043, multiple_r: 0.59909432, contribution: 0.358914, constant: -4.88436, height_coefficient: 0.04073, age_coefficient: 0.04084 }
      },
      female: {
        VC: { unit: "L", residual: 0.368236, multiple_r: 0.70125388, contribution: 0.491757, constant: -3.414, height_coefficient: 0.03652, age_coefficient: 0.04414 },
        FVC: { unit: "L", residual: 0.363168, multiple_r: 0.73570103, contribution: 0.541256, constant: -4.11753, height_coefficient: 0.04182, age_coefficient: 0.04173 },
        FEV1: { unit: "L", residual: 0.342224, multiple_r: 0.73539309, contribution: 0.540803, constant: -3.68536, height_coefficient: 0.03662, age_coefficient: 0.0477 },
        FEV1_percent_Gaensler: { unit: "%", residual: 5.912733, multiple_r: 0.15137371, contribution: 0.022914, constant: 90.83385, height_coefficient: -0.03351, age_coefficient: 0.32768 },
        FEV1_percent_Tiffeneau: { unit: "%", residual: 8.137632, multiple_r: 0.15428221, contribution: 0.023803, constant: 71.30491, height_coefficient: 0.12774, age_coefficient: 0.15595 },
        PEF: { unit: "L/s", residual: 1.012227, multiple_r: 0.61470074, contribution: 0.377857, constant: -5.39274, height_coefficient: 0.05115, age_coefficient: 0.16905 },
        V50: { unit: "L/s", residual: 0.924124, multiple_r: 0.46016519, contribution: 0.211752, constant: -4.15103, height_coefficient: 0.04525, age_coefficient: 0.06723 },
        V25: { unit: "L/s", residual: 0.637419, multiple_r: 0.40536773, contribution: 0.164323, constant: -2.95157, height_coefficient: 0.029, age_coefficient: 0.03292 }
      }
    }
  }
};

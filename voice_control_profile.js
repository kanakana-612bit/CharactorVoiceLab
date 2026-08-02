(function () {
  const CONTROL_DEFINITIONS = Object.freeze([
    { key: "f0_mean_hz", label: "基準F0", min: 60, max: 350, step: 1, unit: "Hz", digits: 0 },
    { key: "f0_range_semitones", label: "F0可動幅", min: 2, max: 14, step: 0.1, unit: "st", digits: 1 },
    { key: "breathiness", label: "気息成分", min: 0, max: 1, step: 0.01, unit: "", digits: 2 },
    { key: "spectral_tilt_db", label: "スペクトル傾斜", min: 4, max: 28, step: 0.1, unit: "dB", digits: 1 },
    { key: "vocal_tract_length_scale", label: "声道長スケール", min: 0.75, max: 1.25, step: 0.01, unit: "x", digits: 2 },
    { key: "timbre_brightness", label: "音色の明るさ", min: 0, max: 1, step: 0.01, unit: "", digits: 2 },
    { key: "energy", label: "発話エネルギー", min: 0.5, max: 1.5, step: 0.01, unit: "x", digits: 2 },
    { key: "speaking_rate", label: "発話速度", min: 0.6, max: 1.4, step: 0.01, unit: "x", digits: 2 },
    { key: "articulation_clarity", label: "構音明瞭度", min: 0.4, max: 1.6, step: 0.01, unit: "x", digits: 2 },
    { key: "breath_phrase_scale", label: "一息の長さ", min: 0.5, max: 1.5, step: 0.01, unit: "x", digits: 2 },
  ]);

  const DEFINITION_BY_KEY = new Map(CONTROL_DEFINITIONS.map((definition) => [definition.key, definition]));

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function finite(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function round(value, digits = 4) {
    return Number(Number(value).toFixed(digits));
  }

  function center(constraints, key, fallback) {
    return finite(constraints?.[key]?.center, fallback);
  }

  function statisticalCenter(constraints, key, fallback) {
    const item = constraints?.[key];
    return finite(item?.statistics?.reference_center ?? item?.statistical_center ?? item?.center, fallback);
  }

  function performanceRange(constraints, overrides, key) {
    return overrides?.[key]
      ?? constraints?.[key]?.performance_control_range
      ?? constraints?.[key]?.constraint_range
      ?? null;
  }

  function estimatePitchRange(constraints, rangeOverrides, sex) {
    const range = performanceRange(constraints, rangeOverrides, "vocal_fold_spring_constant");
    const min = finite(range?.min, NaN);
    const max = finite(range?.max, NaN);
    if (Number.isFinite(min) && Number.isFinite(max) && min > 0 && max > min) {
      return clamp(6 * Math.log2(max / min), 3, 12);
    }
    return sex === "female" ? 8 : sex === "male" ? 7 : 7.5;
  }

  function estimateControls(context) {
    const constraints = context.constraints ?? {};
    const rangeOverrides = context.performance_range_overrides ?? {};
    const f0 = clamp(center(constraints, "f0_mean_hz", context.sex_reference_class === "male" ? 125 : 210), 60, 350);
    const tilt = clamp(center(constraints, "glottal_spectral_tilt_db", 14), 4, 28);
    const tractLength = center(constraints, "vocal_tract_length_cm", 16.5);
    const tractReference = statisticalCenter(constraints, "vocal_tract_length_cm", tractLength || 16.5);
    const tractScale = clamp(tractLength / Math.max(8, tractReference), 0.75, 1.25);
    const ventilation = center(constraints, "maximum_ventilation_l_min", 100);
    const ventilationReference = statisticalCenter(constraints, "maximum_ventilation_l_min", ventilation || 100);
    const brightness = clamp(0.5 + (1 - tractScale) * 0.8 + (14 - tilt) * 0.02, 0, 1);

    return {
      f0_mean_hz: {
        value: f0,
        confidence: 0.65,
        origin: "appearance_and_physiology_proxy",
        source_keys: ["voice_constraints.f0_mean_hz", "inputs.age", "inputs.sex_reference_class"],
      },
      f0_range_semitones: {
        value: estimatePitchRange(constraints, rangeOverrides, context.sex_reference_class),
        confidence: 0.35,
        origin: "performance_range_proxy",
        source_keys: ["performance_range_overrides.vocal_fold_spring_constant"],
      },
      breathiness: {
        value: clamp(center(constraints, "glottal_breathiness", 0.12) / 0.6, 0, 1),
        confidence: 0.45,
        origin: "glottal_profile_proxy",
        source_keys: ["voice_constraints.glottal_breathiness", "voice_constraints.glottal_open_quotient"],
      },
      spectral_tilt_db: {
        value: tilt,
        confidence: 0.45,
        origin: "glottal_profile_proxy",
        source_keys: ["voice_constraints.glottal_spectral_tilt_db"],
      },
      vocal_tract_length_scale: {
        value: tractScale,
        confidence: 0.7,
        origin: "appearance_geometry_proxy",
        source_keys: ["voice_constraints.vocal_tract_length_cm", "vocal_tract_geometry"],
        absolute_value: round(tractLength, 3),
        absolute_unit: "cm",
      },
      timbre_brightness: {
        value: brightness,
        confidence: 0.35,
        origin: "derived_timbre_proxy",
        source_keys: ["voice_constraints.vocal_tract_length_cm", "voice_constraints.glottal_spectral_tilt_db"],
      },
      energy: {
        value: clamp(center(constraints, "respiratory_support", 1), 0.5, 1.5),
        confidence: 0.45,
        origin: "respiratory_profile_proxy",
        source_keys: ["voice_constraints.respiratory_support", "voice_constraints.maximum_respiratory_pressure_pa"],
      },
      speaking_rate: {
        value: 1,
        confidence: 0.2,
        origin: "engineering_neutral",
        source_keys: ["design_neutral.speaking_rate"],
      },
      articulation_clarity: {
        value: clamp(center(constraints, "articulatory_range_utilization", 1), 0.4, 1.6),
        confidence: 0.4,
        origin: "articulatory_profile_proxy",
        source_keys: ["voice_constraints.articulatory_range_utilization", "voice_constraints.motor_control_precision"],
      },
      breath_phrase_scale: {
        value: clamp(ventilation / Math.max(20, ventilationReference), 0.5, 1.5),
        confidence: 0.4,
        origin: "respiratory_capacity_proxy",
        source_keys: ["voice_constraints.maximum_ventilation_l_min", "voice_constraints.predicted_vc_l"],
      },
    };
  }

  function normalizeOverrides(overrides) {
    const result = {};
    for (const definition of CONTROL_DEFINITIONS) {
      const value = Number(overrides?.[definition.key]);
      if (!Number.isFinite(value)) continue;
      result[definition.key] = round(clamp(value, definition.min, definition.max), definition.digits + 2);
    }
    return result;
  }

  function ageDescriptor(age, sex) {
    const years = finite(age, 20);
    if (years < 7) return "幼い子ども";
    if (years < 15) return sex === "female" ? "少女" : sex === "male" ? "少年" : "若い人物";
    if (years < 20) return sex === "female" ? "若い女性" : sex === "male" ? "若い男性" : "若い中性的な人物";
    if (years < 55) return sex === "female" ? "成人女性" : sex === "male" ? "成人男性" : "中性的な成人";
    return sex === "female" ? "落ち着いた年長の女性" : sex === "male" ? "落ち着いた年長の男性" : "落ち着いた年長の人物";
  }

  function captionFromControls(controls, context) {
    const value = (key) => finite(controls?.[key]?.effective_value, 1);
    const brightness = value("timbre_brightness") >= 0.68 ? "明るく抜ける音色" : value("timbre_brightness") <= 0.35 ? "暗く厚みのある音色" : "自然な明るさの音色";
    const breath = value("breathiness") >= 0.68 ? "強い気息感" : value("breathiness") >= 0.38 ? "わずかな気息感" : "気息感の少ない明瞭な声質";
    const clarity = value("articulation_clarity") >= 1.2 ? "輪郭のはっきりした構音" : value("articulation_clarity") <= 0.8 ? "やや柔らかく曖昧な構音" : "自然で聞き取りやすい構音";
    const energy = value("energy") >= 1.16 ? "力強い発声" : value("energy") <= 0.84 ? "控えめな発声" : "安定した発声";
    const speed = value("speaking_rate") >= 1.12 ? "やや速い話速" : value("speaking_rate") <= 0.88 ? "ゆっくりした話速" : "自然な話速";
    const tract = value("vocal_tract_length_scale") >= 1.08 ? "深い共鳴" : value("vocal_tract_length_scale") <= 0.92 ? "小さく前寄りの共鳴" : "均整の取れた共鳴";
    return `${ageDescriptor(context.age, context.sex_reference_class)}。${brightness}。${tract}、${breath}。${clarity}、${energy}、${speed}で話す。`;
  }

  function buildControlFunctions(controls) {
    const value = (key) => controls[key].effective_value;
    return {
      pitch: {
        type: "exponential_semitone_map",
        input_domain: [-1, 1],
        anchor_hz: value("f0_mean_hz"),
        half_range_semitones: round(value("f0_range_semitones") / 2, 4),
        expression: "f0_hz = anchor_hz * 2 ^ (input * half_range_semitones / 12)",
      },
      breathiness: {
        type: "affine_clamped",
        input_domain: [-1, 1],
        anchor: value("breathiness"),
        response_span: 0.22,
        output_domain: [0, 1],
      },
      energy: {
        type: "multiplicative_clamped",
        input_domain: [-1, 1],
        anchor: value("energy"),
        response_span: 0.35,
        output_domain: [0.35, 1.8],
      },
      speaking_rate: {
        type: "multiplicative_clamped",
        input_domain: [-1, 1],
        anchor: value("speaking_rate"),
        response_span: 0.25,
        output_domain: [0.5, 1.6],
      },
      articulation: {
        type: "affine_clamped",
        input_domain: [-1, 1],
        anchor: value("articulation_clarity"),
        response_span: 0.35,
        output_domain: [0.25, 1.75],
      },
      breath_phrase: {
        type: "multiplicative_clamped",
        input_domain: [-1, 1],
        anchor: value("breath_phrase_scale"),
        response_span: 0.3,
        output_domain: [0.4, 1.8],
      },
    };
  }

  function build(context = {}) {
    const estimates = estimateControls(context);
    const overrides = normalizeOverrides(context.design_overrides);
    const controls = {};
    for (const definition of CONTROL_DEFINITIONS) {
      const estimate = estimates[definition.key];
      const appearanceEstimate = round(clamp(estimate.value, definition.min, definition.max), definition.digits + 2);
      const hasOverride = Object.prototype.hasOwnProperty.call(overrides, definition.key);
      controls[definition.key] = {
        label: definition.label,
        unit: definition.unit,
        appearance_estimate: appearanceEstimate,
        design_override: hasOverride ? overrides[definition.key] : null,
        effective_value: hasOverride ? overrides[definition.key] : appearanceEstimate,
        estimate_origin: estimate.origin,
        confidence: estimate.confidence,
        source_keys: estimate.source_keys,
        ...(Number.isFinite(estimate.absolute_value) ? { absolute_value: estimate.absolute_value, absolute_unit: estimate.absolute_unit } : {}),
      };
    }
    const caption = captionFromControls(controls, context);
    return {
      schema_version: "character_voice_identity_function_0.1",
      app: "CharacterVoiceDesigner",
      app_version: context.app_version ?? "0.2",
      project_title: context.project_title ?? "voice_profile",
      generated_at: context.generated_at ?? new Date().toISOString(),
      purpose: "backend-neutral intermediate functions for preserving designed external voice identity",
      identity_anchor: Object.fromEntries(Object.entries(controls).map(([key, item]) => [key, item.effective_value])),
      evidence: controls,
      control_functions: buildControlFunctions(controls),
      tts_adapters: {
        audio_cpp: {
          family: "irodori_tts",
          task: "vdes",
          language: "ja",
          model_hint: "Irodori-TTS-600M-v3-VoiceDesign",
          caption_ja: caption,
          mapping_kind: "deterministic_descriptor_adapter",
          limitation: "Caption conditioning approximates non-pitch controls. F0 is handled separately by optional Praat PSOLA post-processing.",
        },
      },
    };
  }

  function buildAudioCppRequest(profile, settings = {}) {
    const anchor = profile.identity_anchor;
    const caption = String(settings.caption || profile.tts_adapters.audio_cpp.caption_ja).trim();
    const speakingRate = clamp(finite(anchor.speaking_rate, 1), 0.6, 1.4);
    return {
      model: String(settings.model || "irodori-vdes"),
      input: String(settings.text || "").trim(),
      language: "ja",
      seed: Math.trunc(clamp(finite(settings.seed, 20260719), 0, 2147483647)),
      num_inference_steps: Math.trunc(clamp(finite(settings.num_inference_steps, 20), 4, 100)),
      options: {
        no_ref: true,
        caption,
        duration_scale: round(clamp(1 / speakingRate, 0.65, 1.5), 4),
        caption_guidance_scale: round(clamp(finite(settings.caption_guidance_scale, 2), 0.5, 10), 3),
        trim_tail: true,
      },
      postprocess: {
        f0: {
          enabled: settings.f0_correction_enabled !== false,
          target_hz: round(clamp(finite(anchor.f0_mean_hz, 180), 60, 500), 3),
          strength: round(clamp(finite(settings.f0_correction_strength, 1), 0, 1), 4),
          method: "praat_psola_contour_preserving_median_shift",
        },
      },
    };
  }

  function formatControlValue(key, value) {
    const definition = DEFINITION_BY_KEY.get(key);
    if (!definition) return String(value);
    return `${Number(value).toFixed(definition.digits)}${definition.unit ? ` ${definition.unit}` : ""}`;
  }

  window.CVD_PROFILE = {
    controlDefinitions: CONTROL_DEFINITIONS,
    build,
    buildAudioCppRequest,
    normalizeOverrides,
    formatControlValue,
  };
})();

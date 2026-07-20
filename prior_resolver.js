(function () {
  const localPdfPriors = window.CVL_LOCAL_PDF_PRIORS;

  const sourceSets = {
    current_mvp: {
      label: "MVP priors",
      status: "active",
      note: "Uses bundled placeholder and literature-derived priors.",
    },
    japanese_age_band_planned: {
      label: "Japanese age-band priors",
      status: "planned",
      note: "Resolver-ready slot for National Health and Nutrition Survey, AIST, and local PDF-derived tables.",
    },
    manual_design: {
      label: "Manual design",
      status: "active",
      note: "Keeps priors visible but treats user edits as design intent.",
    },
  };

  function sexMean(mean, sex) {
    return mean?.[sex] ?? mean?.neutral ?? mean?.all ?? 0;
  }

  function resolveFeaturePrior(key, definition, context) {
    const sourceSet = sourceSets[context.sourceSet] ?? sourceSets.current_mvp;
    const populationMatch = !definition.reference_population || definition.reference_population === context.population;
    const resolvedSex = populationMatch ? context.sex : "neutral";
    const mean = sexMean(definition.mean, resolvedSex);
    const median = definition.median ? sexMean(definition.median, resolvedSex) : mean;
    let sd = typeof definition.sd === "object" ? sexMean(definition.sd, resolvedSex) : definition.sd;
    if (!populationMatch) sd *= definition.general_uncertainty_multiplier ?? 1.5;
    const base = {
      key,
      mean,
      median,
      median_source: definition.median_source
        ? (typeof definition.median_source === "object" ? definition.median_source[resolvedSex] ?? "mean_proxy" : definition.median_source)
        : definition.median ? "source_table" : "mean_proxy",
      sd,
      source: definition.source,
      source_note: definition.source_note,
      evidence: definition.evidence,
      evidence_level: definition.evidence_level,
      source_set: context.sourceSet,
      source_set_label: sourceSet.label,
      resolver_status: sourceSet.status,
      reference_population: definition.reference_population ?? "General",
      requested_population: context.population,
      population_match: populationMatch,
      warnings: [],
    };

    if (!populationMatch) {
      base.evidence_level = `${base.evidence_level || "prior"}+general_fallback`;
      base.warnings.push("No approved aggregate table matches the selected morphology reference population; using the source-neutral center as a widened design fallback.");
    }

    if (key === "neck_root_width_cm" && (context.age < 18 || context.age > 36)) {
      sd *= 1.5;
      base.sd = sd;
      base.warnings.push("The neck-root breadth table is a young-adult aggregate; uncertainty is widened outside ages 18-36.");
    }

    if (context.sourceSet === "japanese_age_band_planned") {
      base.warnings.push("Japanese age-band table is not loaded yet; using bundled fallback prior.");
      if (context.age < 20 && ["shoulder_width_cm", "torso_length_cm", "pelvis_width_cm"].includes(key)) {
        base.warnings.push("Child/adolescent body-size correction pending National Health and Nutrition Survey/AIST cache.");
      }
      if (context.age < 12 && ["lower_face_height_cm", "interpupillary_width_cm", "jaw_width_cm"].includes(key)) {
        base.warnings.push("School-age head/face correction pending local PDF extraction.");
      }
    }

    if (base.median_source !== "source_table") {
      base.warnings.push("Median is not available for this prior; mean is used as a representative central value.");
    }

    if (context.sourceSet === "manual_design") {
      base.evidence_level = `${base.evidence_level || "prior"}+manual_design`;
      base.warnings.push("Manual design mode: statistical priors are advisory only.");
    }

    return base;
  }

  function resolveBodyReference(referenceData, context) {
    const sex = context.sex === "male" || context.sex === "female" ? context.sex : "neutral";
    const fallback = referenceData.sources.pisanski2014.extracted_values.adult_height_weight_sample[sex];
    return {
      height_cm_mean: fallback.height_cm_mean,
      height_cm_sd: fallback.height_cm_sd,
      weight_kg_mean: fallback.weight_kg_mean,
      weight_kg_sd: fallback.weight_kg_sd,
      source: "pisanski2014",
      source_set: context.sourceSet,
      warnings: context.sourceSet === "japanese_age_band_planned"
        ? ["Japanese age-band height/weight cache not loaded yet; using bundled adult fallback."]
        : [],
    };
  }

  function lerp(a, b, t) {
    return a + (b - a) * Math.max(0, Math.min(1, t));
  }

  function resolveHeadGrowth(context) {
    const table = localPdfPriors?.head_growth_schoolchildren;
    if (!table || context.age < table.age_min || context.age > table.age_max) return null;
    const sex = context.sex === "male" || context.sex === "female" ? context.sex : "female";
    const t = (context.age - table.age_min) / (table.age_max - table.age_min);
    const values = {};
    for (const [key, variable] of Object.entries(table.variables)) {
      const row = variable[sex];
      if (!row) continue;
      values[key] = {
        center: Number(lerp(row.age6, row.age11, t).toFixed(4)),
        unit: variable.unit ?? table.unit,
        source: variable.source,
        confidence: 0.38,
        note: variable.note,
      };
    }
    return {
      age_range: [table.age_min, table.age_max],
      interpolation: "linear_between_age6_and_age11",
      sex,
      values,
    };
  }

  function resolveSinusDevelopment(context) {
    const table = localPdfPriors?.pediatric_sinus_development;
    if (!table) return null;
    const entry = table.age_modifiers.find((item) => context.age <= item.age_max) ?? table.age_modifiers[table.age_modifiers.length - 1];
    return {
      sinus_volume_scale: entry.sinus_volume_scale,
      confidence: entry.confidence,
      source: table.source,
      note: table.note,
    };
  }

  function resolveYoungRespiratory(context) {
    const table = localPdfPriors?.young_respiratory_function_10_20;
    if (!table || context.age < table.age_range[0] || context.age > table.age_range[1]) return null;
    const height = context.height_cm;
    if (!Number.isFinite(height)) return null;
    const sex = context.sex === "male" || context.sex === "female" ? context.sex : "neutral";
    const predictions = {};
    const sexEquations = sex === "neutral" ? null : table.equations[sex];
    const equationKeys = Object.keys(table.equations.male);
    for (const key of equationKeys) {
      const equation = sexEquations
        ? sexEquations[key]
        : averageEquation(table.equations.male[key], table.equations.female[key]);
      const center = equation.constant + equation.height_coefficient * height + equation.age_coefficient * context.age;
      const sd = equation.residual;
      predictions[key] = {
        center: Number(center.toFixed(4)),
        reference_center: Number(center.toFixed(4)),
        min: Number((center - sd * 3).toFixed(4)),
        max: Number((center + sd * 3).toFixed(4)),
        unit: equation.unit,
        sd,
        residual: equation.residual,
        multiple_r: equation.multiple_r,
        contribution: equation.contribution,
        source: table.source,
        formula: table.formula,
      };
    }
    return {
      source: table.source,
      variables: table.variables,
      status: table.encoded_status,
      sex,
      age_range: table.age_range,
      predictions,
      confidence: 0.58,
      note: table.note,
    };
  }

  function averageEquation(a, b) {
    return {
      unit: a.unit,
      residual: (a.residual + b.residual) / 2,
      multiple_r: (a.multiple_r + b.multiple_r) / 2,
      contribution: (a.contribution + b.contribution) / 2,
      constant: (a.constant + b.constant) / 2,
      height_coefficient: (a.height_coefficient + b.height_coefficient) / 2,
      age_coefficient: (a.age_coefficient + b.age_coefficient) / 2,
    };
  }

  function resolveGrowthReferences(context) {
    return {
      head_growth: resolveHeadGrowth(context),
      sinus_development: resolveSinusDevelopment(context),
      young_respiratory: resolveYoungRespiratory(context),
    };
  }

  window.CVL_PRIOR_RESOLVER = {
    sourceSets,
    resolveFeaturePrior,
    resolveBodyReference,
    resolveGrowthReferences,
  };
})();

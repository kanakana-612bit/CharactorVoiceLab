const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const indexHtml = fs.readFileSync(path.join(projectRoot, "index.html"), "utf8");
const styleSheet = fs.readFileSync(path.join(projectRoot, "styles.css"), "utf8");

if (!/<select id="referenceImageStyleInput">\s*<option value="illustration" selected>/.test(indexHtml)) {
  throw new Error("Illustration is not the default reference-image style");
}
if (!/<select id="phoneticTargetProfileInput">\s*<option value="ja_JP_standard_neutral_aggregate_0_1" selected>/.test(indexHtml)) {
  throw new Error("Japanese aggregate phonetic target is not the default in the UI");
}
if (!/<select id="synthesisBackendSelect">\s*<option value="tube" selected>/.test(indexHtml)) {
  throw new Error("1D tube is not the default synthesis backend in the UI");
}
if (!/<aside class="floating-action-dock"[^>]*>[\s\S]*id="playSampleButton"[\s\S]*id="analyzeBtn"/.test(indexHtml)) {
  throw new Error("Persistent sample-playback and analysis actions are missing from the UI");
}
if (!/\.floating-action-dock\s*\{[^}]*position:\s*fixed;[^}]*right:\s*16px;[^}]*bottom:\s*16px;/.test(styleSheet)) {
  throw new Error("Persistent action dock is not fixed to the desktop viewport");
}
if (!/@media \(max-width: 640px\)\s*\{[\s\S]*?\.floating-action-dock\s*\{[^}]*grid-template-columns:\s*1fr 1fr;/.test(styleSheet)) {
  throw new Error("Persistent action dock is not adapted to the mobile viewport");
}

global.window = global;

const elements = new Map();

function makeContext() {
  return {
    clearRect() {},
    fillRect() {},
    beginPath() {},
    moveTo() {},
    lineTo() {},
    closePath() {},
    fill() {},
    stroke() {},
    arc() {},
    ellipse() {},
    setLineDash() {},
    fillText() {},
    measureText(text) {
      return { width: String(text).length * 7 };
    },
    save() {},
    restore() {},
    quadraticCurveTo() {},
  };
}

function element(id) {
  if (!elements.has(id)) {
    elements.set(id, {
      id,
      value: "",
      checked: false,
      width: 720,
      height: 560,
      options: [],
      dataset: {},
      style: { setProperty() {} },
      classList: { toggle() {}, add() {}, remove() {} },
      setAttribute() {},
      append() {},
      appendChild() {},
      querySelector() {
        return { style: {}, title: "" };
      },
      addEventListener() {},
      getContext() {
        const context = makeContext();
        context.canvas = this;
        return context;
      },
    });
  }
  return elements.get(id);
}

global.document = {
  getElementById: element,
  querySelectorAll() {
    return [];
  },
  querySelector() {
    return null;
  },
  createElement(tag) {
    return element(`created_${tag}_${Math.random()}`);
  },
};

for (const file of [
  "reference_data.js",
  "local_pdf_growth_priors.js",
  "prior_resolver.js",
  "project_package.js",
  "landmark_schema.js",
]) {
  eval(fs.readFileSync(path.join(projectRoot, file), "utf8"));
}

for (const sourceKey of [
  "hiraharaAkahaneYamada2004JapaneseVowels",
  "kagomiya2015JapaneseVowelDuration",
  "mokhtariTanaka2000JapaneseFormantCorpus",
]) {
  if (!window.CVL_REFERENCE.sources[sourceKey]) throw new Error(`Missing phonetic reference source: ${sourceKey}`);
}

const appCode = fs.readFileSync(path.join(projectRoot, "app.js"), "utf8").replace(/\ninit\(\);\s*$/, "");

eval(`${appCode}
els.heightInput.value = 158;
els.sexInput.value = "female";
els.primaryLanguageInput.value = "ja-JP";
els.phoneticTargetProfileInput.value = "ja_JP_standard_neutral_aggregate_0_1";
els.pressureInput.value = 900;
els.profileDirectionInput.value = "right";
els.vowelSelect.value = "a";
els.synthesisBackendSelect.value = "tube";
state.features = {
  neck_root_width_cm: { integrated: 13.3 },
  jaw_width_cm: { integrated: 11.1 },
  mouth_width_cm: { integrated: 4.85 },
};
state.constraints = {
  vocal_tract_length_cm: { center: 15.5 },
  glottal_closure: { center: 0.55 },
  glottal_open_quotient: { center: 0.58 },
  glottal_speed_quotient: { center: 1.8 },
  glottal_return_phase: { center: 0.14 },
  glottal_spectral_tilt_db: { center: 12 },
  glottal_breathiness: { center: 0.08 },
  glottal_volume_velocity_drive: { center: 0.86 },
  glottal_flow_smoothing: { center: 0.34 },
  glottal_flow_inertance: { center: 0.14 },
  f0_mean_hz: { center: 180 },
  vocal_fold_spring_constant: { center: 1 },
  baseline_muscle_tension: { center: 1 },
  tension_response_curve: { center: 1 },
  inflammation_index: { center: 0 },
  airway_lumen_narrowing: { center: 0 },
  vocal_tract_wall_loss: { center: 0.018 },
  vocal_tract_viscothermal_loss: { center: 0.012 },
  vocal_tract_high_frequency_damping: { center: 0.28 },
  vocal_tract_wall_compliance: { center: 0.18 },
  vocal_tract_resonance_broadening: { center: 0.26 },
  lip_radiation_smoothing: { center: 0.32 },
  hybrid_side_branch_strength: { center: 0.32 },
  hybrid_formant_anchor: { center: 0.82 },
  hybrid_tube_texture_mix: { center: 0.04 },
  paranasal_sinus_volume_cm3: { center: 24 },
  sinus_neck_area_cm2: { center: 0.24 },
  sinus_neck_length_cm: { center: 1.2 },
  sinus_coupling: { center: 0.25 },
  sinus_damping: { center: 0.68 },
  side_branch_loss_coupling: { center: 0.22 },
  velopharyngeal_loss_coupling: { center: 0.18 },
  piriform_fossa_loss_coupling: { center: 0.14 },
  piriform_fossa_frequency_hz: { center: 3700 },
  nasal_branch_damping: { center: 0.72 },
  body_resonance_coupling: { center: 0.25 },
  body_resonance_gain_db: { center: 3 },
  thoracic_volume_l: { center: 4.6 },
  abdominal_volume_l: { center: 6.3 },
  respiratory_support: { center: 1 },
  articulatory_range_utilization: { center: 1 },
  tongue_dorsum_range_utilization: { center: 1 },
  labial_transverse_range_utilization: { center: 1 },
  palatal_vault_scale: { center: 1 },
  lip_aperture_aspect_scale: { center: 1 },
  tongue_groove_capacity: { center: 1 },
  motor_control_precision: { center: 1 },
  coarticulation_strength: { center: 0.58 },
  phonological_contrast_maturity: { center: 1 },
};
state.vocalTractGeometry = buildVocalTractGeometry();
const japaneseUReference = currentVowelReference("u", state.constraints.vocal_tract_length_cm.center);
const japaneseOReference = currentVowelReference("o", state.constraints.vocal_tract_length_cm.center);
if (japaneseUReference.profile_id !== "ja_JP_standard_neutral_aggregate_0_1") {
  throw new Error("Japanese phonetic target profile did not resolve");
}
if (japaneseUReference.base_formants_hz.length !== 4) {
  throw new Error("Japanese phonetic target does not provide four formants");
}
if (japaneseUReference.target_formants_hz[1] <= japaneseOReference.target_formants_hz[1]) {
  throw new Error("Japanese /u/ target F2 is not separated above /o/");
}
const generalProfileId = "general_five_vowel_engineering_0_1";
els.phoneticTargetProfileInput.value = generalProfileId;
const generalUReference = currentVowelReference("u", state.constraints.vocal_tract_length_cm.center);
if (generalUReference.base_formants_hz[1] !== 900) {
  throw new Error("General comparison phonetic target did not retain its provisional /u/ F2");
}
els.phoneticTargetProfileInput.value = "ja_JP_standard_neutral_aggregate_0_1";
const migratedLegacyIllustrationGesture = migrateLegacyIllustrationGestureInput(
  { inputs: { reference_image_style: "illustration" } },
  { articulatory_range_utilization: { center: 1.4884, user_override: true } },
  { articulatory_range_utilization: 1.4884 }
);
if (Math.abs(migratedLegacyIllustrationGesture.constraints.articulatory_range_utilization.center - 1) > 0.0001
  || Math.abs(migratedLegacyIllustrationGesture.overrides.articulatory_range_utilization - 1) > 0.0001) {
  throw new Error("Legacy illustration Gesture execution was not migrated to the UI baseline");
}
if (migratedLegacyIllustrationGesture.constraints.gesture_execution_calibration_gain) {
  throw new Error("Legacy illustration calibration gain was retained after response-map migration");
}
const migratedIllustrationMotorProfile = currentArticulationMotorProfile({
  articulatory_range_utilization: migratedLegacyIllustrationGesture.constraints.articulatory_range_utilization,
  gesture_execution_response_map: gestureExecutionResponseForStyle("illustration"),
});
if (Math.abs(migratedIllustrationMotorProfile.gesture_execution - 1.45) > 0.0001) {
  throw new Error("Legacy illustration Gesture execution no longer preserves its clear-speech operating point");
}
const iAreaBaseline = buildTubeAreaFunction(state.vocalTractGeometry, "i", PREVIEW_SAMPLE_RATE);
const eAreaBaseline = buildTubeAreaFunction(state.vocalTractGeometry, "e", PREVIEW_SAMPLE_RATE);
const uAreaBaseline = buildTubeAreaFunction(state.vocalTractGeometry, "u", PREVIEW_SAMPLE_RATE);
if (state.vocalTractGeometry.schema_version !== "vocal_tract_geometry_0.2") {
  throw new Error("Vocal-tract geometry was not upgraded to the 2.5D schema");
}
if (!state.vocalTractGeometry.sections.every((section) => section.cross_section?.model && Number.isFinite(section.cross_section.lateral_channel_capacity_cm2))) {
  throw new Error("2.5D vocal-tract sections are missing cross-section metadata");
}
if (iAreaBaseline.schema_version !== "area_function_tube_0.2" || iAreaBaseline.cross_sections_2_5d?.length !== iAreaBaseline.tube_count) {
  throw new Error("Tube area function is missing its 2.5D projection metadata");
}
if (!iAreaBaseline.articulation_target.cross_section || iAreaBaseline.cross_sections_2_5d.some((section) => !Number.isFinite(section.midline_area_cm2))) {
  throw new Error("2.5D vowel gesture metadata is incomplete");
}
const sumLateralArea = (areaFunction) => areaFunction.cross_sections_2_5d.reduce((total, section) => total + section.lateral_channel_area_cm2, 0);
const totalAreaDelta = (left, right) => left.areas_cm2.reduce((total, area, index) => total + Math.abs(area - right.areas_cm2[index]), 0);
if (sumLateralArea(iAreaBaseline) <= sumLateralArea(uAreaBaseline)) {
  throw new Error("2.5D /i/ target did not preserve more lateral-channel potential than /u/");
}
state.constraints.tongue_groove_capacity.center = 0.55;
const iGrooveReduced = buildTubeAreaFunction(state.vocalTractGeometry, "i", PREVIEW_SAMPLE_RATE);
state.constraints.tongue_groove_capacity.center = 1;
if (sumLateralArea(iGrooveReduced) >= sumLateralArea(iAreaBaseline) * 0.8) {
  throw new Error("Tongue-groove PerformanceControlRange did not limit the current 2.5D gesture");
}
if (totalAreaDelta(iAreaBaseline, iGrooveReduced) > 0.0001) {
  throw new Error("Tongue-groove PerformanceControlRange incorrectly altered the neutral 1D area target");
}
const iTerminalSection = iAreaBaseline.cross_sections_2_5d[Math.round((iAreaBaseline.cross_sections_2_5d.length - 1) * 0.92)];
const uTerminalSection = uAreaBaseline.cross_sections_2_5d[Math.round((uAreaBaseline.cross_sections_2_5d.length - 1) * 0.92)];
if (iTerminalSection.aspect_ratio <= uTerminalSection.aspect_ratio) {
  throw new Error("2.5D /i/ lip aperture is not wider than /u/");
}
if (!iAreaBaseline.articulation_target.tongue_warps?.length || !iAreaBaseline.articulation_target.labial_warps?.length) {
  throw new Error("Japanese /i/ articulation target did not separate tongue and labial warps");
}
if (eAreaBaseline.articulation_target.labial_transverse_profile_gain <= 1) {
  throw new Error("Japanese /e/ articulation target did not increase transverse labial range");
}
state.constraints.tongue_dorsum_range_utilization.center = 0.62;
const iTongueReduced = buildTubeAreaFunction(state.vocalTractGeometry, "i", PREVIEW_SAMPLE_RATE);
state.constraints.tongue_dorsum_range_utilization.center = 1;
state.constraints.labial_transverse_range_utilization.center = 0.62;
const eLabialReduced = buildTubeAreaFunction(state.vocalTractGeometry, "e", PREVIEW_SAMPLE_RATE);
state.constraints.labial_transverse_range_utilization.center = 1;
if (totalAreaDelta(iAreaBaseline, iTongueReduced) < 0.15) {
  throw new Error("Tongue-dorsum range control did not affect the Japanese /i/ area function");
}
if (totalAreaDelta(eAreaBaseline, eLabialReduced) < 0.05) {
  throw new Error("Labial transverse range control did not affect the Japanese /e/ area function");
}
state.constraints.tongue_dorsum_range_utilization.center = 1.55;
const iTongueExpandedRange = buildTubeAreaFunction(state.vocalTractGeometry, "i", PREVIEW_SAMPLE_RATE);
state.constraints.tongue_dorsum_range_utilization.center = 1;
state.constraints.labial_transverse_range_utilization.center = 1.55;
const eLabialExpandedRange = buildTubeAreaFunction(state.vocalTractGeometry, "e", PREVIEW_SAMPLE_RATE);
state.constraints.labial_transverse_range_utilization.center = 1;
if (totalAreaDelta(iAreaBaseline, iTongueExpandedRange) > 0.0001 || totalAreaDelta(eAreaBaseline, eLabialExpandedRange) > 0.0001) {
  throw new Error("PerformanceControlRange above neutral is incorrectly amplifying a fixed vowel GestureTarget");
}
const neutralGeometry = buildVocalTractGeometry();
const neutralPalatalSection = neutralGeometry.sections[Math.round((neutralGeometry.sections.length - 1) * 0.7)];
state.constraints.palatal_vault_scale.center = 1.2;
const raisedPalatalGeometry = buildVocalTractGeometry();
const raisedPalatalSection = raisedPalatalGeometry.sections[Math.round((raisedPalatalGeometry.sections.length - 1) * 0.7)];
state.constraints.palatal_vault_scale.center = 1;
if (raisedPalatalSection.sagittal_diameter_cm <= neutralPalatalSection.sagittal_diameter_cm) {
  throw new Error("2.5D palatal-vault control did not alter oral sagittal geometry");
}
state.vocalTractGeometry = neutralGeometry;
const stylizedMouthModel = inferMouthWidthModel(
  { image_value: 2.1, integrated: 2.9, statistical_median: 4.85, statistical_sd: 0.45 },
  { integrated: 11.1, statistical_median: 11.1 },
  { median: 4.85, sd: 0.45 },
  { median: 11.1, sd: 1 }
);
const realisticMouthModel = inferMouthWidthModel(
  { image_value: 2.1, integrated: 2.9, statistical_median: 4.85, statistical_sd: 0.45 },
  { integrated: 11.1, statistical_median: 11.1 },
  { median: 4.85, sd: 0.45 },
  { median: 11.1, sd: 1 },
  "photo_realistic"
);
if (stylizedMouthModel.relaxed_estimate_cm <= stylizedMouthModel.image_fused_width_cm) throw new Error("Stylized mouth width was not corrected toward the jaw-conditioned relaxed estimate");
if (Math.abs(realisticMouthModel.relaxed_estimate_cm - realisticMouthModel.image_fused_width_cm)
  >= Math.abs(stylizedMouthModel.relaxed_estimate_cm - stylizedMouthModel.image_fused_width_cm)) {
  throw new Error("Photo/realistic mouth inference does not trust the observed width more than illustration inference");
}
if (stylizedMouthModel.spread_estimate_cm / stylizedMouthModel.relaxed_estimate_cm
  <= realisticMouthModel.spread_estimate_cm / realisticMouthModel.relaxed_estimate_cm) {
  throw new Error("Illustration mouth inference does not provide the wider latent performance range");
}
if (!(stylizedMouthModel.pursed_estimate_cm < stylizedMouthModel.relaxed_estimate_cm && stylizedMouthModel.relaxed_estimate_cm < stylizedMouthModel.spread_estimate_cm)) {
  throw new Error("Mouth-width performance range is not ordered pursed < relaxed < spread");
}
const audio = synthesizeVowel("a");
if (normalizeSynthesisBackend("unknown") !== "tube") throw new Error("1D tube is not the default synthesis backend");
if (audio.sampleRate !== 44100) throw new Error("Preview synthesis is not running at 44.1 kHz");
let max = 0;
let bad = 0;
for (const sample of audio.samples) {
  if (!Number.isFinite(sample)) bad += 1;
  max = Math.max(max, Math.abs(sample));
}
if (audio.backend !== "area_function_tube") throw new Error("Tube backend was not selected");
if (!audio.area_function || audio.area_function.tube_count < 10) throw new Error("Missing tube area function");
if (audio.formant_reference?.profile_id !== "ja_JP_standard_neutral_aggregate_0_1") throw new Error("Tube output is missing phonetic-target metadata");
if (audio.area_function?.phonetic_target_profile?.id !== "ja_JP_standard_neutral_aggregate_0_1") throw new Error("Area function is missing phonetic-target metadata");
const expectedTubeCount = Math.round((15.5 * audio.sampleRate) / 35000);
if (audio.area_function.tube_count !== expectedTubeCount) throw new Error("Tube discretization does not match L * sampleRate / soundSpeed");
if (!audio.distributed_loss_model) throw new Error("Missing length-normalized distributed-loss metadata");
if (audio.distributed_loss_model.round_trip_distributed_loss_db <= -3 || audio.distributed_loss_model.round_trip_distributed_loss_db >= 0) {
  throw new Error("Default distributed loss is outside the intended lightweight human-voice range");
}
if (!audio.side_branch_loss_model || audio.side_branch_loss_model.branches.length < 3) throw new Error("Missing side-branch loss model metadata");
if (bad) throw new Error("Tube synthesis produced non-finite samples");
if (max < 0.01) throw new Error("Tube synthesis produced near-silence");
const areaDeltas = [];
for (const vowel of ["i", "u", "e", "o"]) {
  const other = synthesizeVowel(vowel);
  if (other.backend !== "area_function_tube") throw new Error(\`Tube backend was not selected for /\${vowel}/\`);
  let otherMax = 0;
  let otherBad = 0;
  for (const sample of other.samples) {
    if (!Number.isFinite(sample)) otherBad += 1;
    otherMax = Math.max(otherMax, Math.abs(sample));
  }
  if (otherBad) throw new Error(\`Tube synthesis produced non-finite samples for /\${vowel}/\`);
  if (otherMax < 0.01) throw new Error(\`Tube synthesis produced near-silence for /\${vowel}/\`);
  let areaDelta = 0;
  for (let index = 0; index < audio.area_function.areas_cm2.length; index++) {
    areaDelta += Math.abs(audio.area_function.areas_cm2[index] - other.area_function.areas_cm2[index]);
  }
  if (areaDelta < 0.5) throw new Error(\`Vowel area warps are too similar between /a/ and /\${vowel}/\`);
  let waveDelta = 0;
  const sampleLimit = Math.min(audio.samples.length, other.samples.length);
  for (let index = 0; index < sampleLimit; index++) {
    waveDelta += Math.abs(audio.samples[index] - other.samples[index]);
  }
  waveDelta /= Math.max(1, sampleLimit);
  if (waveDelta < 0.001) throw new Error(\`Synthesized waveforms are too similar between /a/ and /\${vowel}/\`);
  areaDeltas.push(\`\${vowel}:area=\${areaDelta.toFixed(4)},wave=\${waveDelta.toFixed(4)}\`);
}
console.log(\`Tube synthesis smoke passed; samples=\${audio.samples.length}; max=\${max.toFixed(4)}; tubes=\${audio.area_function.tube_count}; area_deltas=\${areaDeltas.join(",")}\`);

const transferAnalysis = Object.fromEntries(["a", "i", "u", "e", "o"].map((vowel) => {
  const analysis = analyzeTubeTransfer(vowel, { sampleCount: 4096, frequencyStep: 10, maxPeaks: 8 });
  return [vowel, analysis.resonances];
}));
const uArticulationTarget = buildTubeAreaFunction(state.vocalTractGeometry, "u", PREVIEW_SAMPLE_RATE).articulation_target;
const oArticulationTarget = buildTubeAreaFunction(state.vocalTractGeometry, "o", PREVIEW_SAMPLE_RATE).articulation_target;
const eArticulationTarget = buildTubeAreaFunction(state.vocalTractGeometry, "e", PREVIEW_SAMPLE_RATE).articulation_target;
const iArticulationTarget = buildTubeAreaFunction(state.vocalTractGeometry, "i", PREVIEW_SAMPLE_RATE).articulation_target;
if (oArticulationTarget.jaw_opening_target <= uArticulationTarget.jaw_opening_target) throw new Error("/o/ jaw opening is not separated from /u/");
if (oArticulationTarget.oral_cavity_expansion_gain <= uArticulationTarget.oral_cavity_expansion_gain) throw new Error("/o/ oral-cavity expansion is not separated from /u/");
if (oArticulationTarget.oral_aperture_gain <= uArticulationTarget.oral_aperture_gain) throw new Error("/o/ oral aperture is not separated from /u/");
if (uArticulationTarget.lip_rounding_target >= oArticulationTarget.lip_rounding_target) throw new Error("Japanese /u/ still uses more rounding than /o/");
if (uArticulationTarget.lip_compression_target <= oArticulationTarget.lip_compression_target) throw new Error("Japanese /u/ lip compression target is not separated from /o/");
if (!(iArticulationTarget.mouth_width_target_cm > eArticulationTarget.mouth_width_target_cm
  && eArticulationTarget.mouth_width_target_cm > oArticulationTarget.mouth_width_target_cm
  && oArticulationTarget.mouth_width_target_cm > uArticulationTarget.mouth_width_target_cm)) {
  throw new Error("Vowel mouth-width targets are not ordered /i/ > /e/ > /o/ > /u/");
}
console.log("Tube transfer analysis: " + JSON.stringify(transferAnalysis));
if (transferAnalysis.i[1].frequency_hz - transferAnalysis.u[1].frequency_hz < 300) {
  throw new Error("Japanese 1D /i/ and /u/ F2 separation is too small");
}
if (transferAnalysis.o[0].frequency_hz - transferAnalysis.u[0].frequency_hz < 40) {
  throw new Error("Japanese 1D /u/ and /o/ F1 separation is too small");
}
const originalClearExecution = state.constraints.articulatory_range_utilization.center;
const originalClearVtl = state.constraints.vocal_tract_length_cm.center;
const originalClearGeometry = state.vocalTractGeometry;
const originalClearGestureResponse = state.constraints.gesture_execution_response_map;
state.constraints.articulatory_range_utilization.center = 1;
state.constraints.gesture_execution_response_map = {
  response_offset: 0.25,
  response_gain: 1.2,
  effective_min: 0.25,
  effective_max: 1.9,
};
state.constraints.vocal_tract_length_cm.center = 12.8;
state.vocalTractGeometry = buildVocalTractGeometry();
if (Math.abs(currentArticulationMotorProfile(state.constraints).gesture_execution - 1.45) > 0.0001) {
  throw new Error("Gesture execution does not reach the calibrated illustration baseline");
}
state.constraints.articulatory_range_utilization.center = 1.35;
if (currentArticulationMotorProfile(state.constraints).gesture_execution <= 1.45) {
  throw new Error("Gesture execution has no headroom above the clear-speech baseline");
}
state.constraints.articulatory_range_utilization.center = 0.35;
if (currentArticulationMotorProfile(state.constraints).gesture_execution >= 1) {
  throw new Error("Gesture execution does not permit under-articulated speech below the clear-speech baseline");
}
state.constraints.articulatory_range_utilization.center = 1;
const clearArticulation = Object.fromEntries(["i", "e", "u", "o"].map((vowel) => {
  const transfer = analyzeTubeTransfer(vowel, { sampleCount: 4096, frequencyStep: 10, maxPeaks: 4 });
  const area = buildTubeAreaFunction(state.vocalTractGeometry, vowel, PREVIEW_SAMPLE_RATE);
  const adjacentAreaLogJumps = area.areas_cm2.slice(1).map((value, index) => Math.abs(
    Math.log(Math.max(0.05, value) / Math.max(0.05, area.areas_cm2[index]))
  ));
  return [vowel, {
    formants_hz: transfer.resonances.slice(0, 2).map((resonance) => resonance.frequency_hz),
    minimum_area_cm2: Math.min(...area.areas_cm2),
    terminal_area_cm2: area.areas_cm2.slice(-3),
    max_adjacent_area_log_jump: Math.max(...adjacentAreaLogJumps),
  }];
}));
for (const vowel of ["i", "e", "u", "o"]) {
  if (clearArticulation[vowel].formants_hz.length < 2) {
    throw new Error("Clear-articulation transfer lacks two formants for /" + vowel + "/");
  }
}
if (clearArticulation.i.formants_hz[1] - clearArticulation.e.formants_hz[1] < 250) {
  throw new Error("Clear /i/-/e/ F2 separation is too small");
}
if (clearArticulation.e.formants_hz[0] - clearArticulation.i.formants_hz[0] < 250) {
  throw new Error("Clear /i/-/e/ F1 separation is too small");
}
if (clearArticulation.i.formants_hz[0] < 280) {
  throw new Error("Clear /i/ F1 is too low and risks a muffled low-frequency resonance");
}
if (clearArticulation.i.max_adjacent_area_log_jump > 1.9) {
  throw new Error("Clear /i/ has an overly abrupt front constriction that risks a rolled-tongue quality");
}
if (clearArticulation.u.formants_hz[1] - clearArticulation.o.formants_hz[1] < 250) {
  throw new Error("Clear /u/-/o/ F2 separation is too small");
}
if (clearArticulation.o.formants_hz[0] - clearArticulation.u.formants_hz[0] < 80) {
  throw new Error("Clear /u/-/o/ F1 separation is too small");
}
if (clearArticulation.e.minimum_area_cm2 < 0.5) {
  throw new Error("Clear /e/ collapses into an /i/-like front constriction");
}
if (clearArticulation.o.terminal_area_cm2[1] <= clearArticulation.u.terminal_area_cm2[1]) {
  throw new Error("Clear /o/ retains a tighter terminal aperture than /u/");
}
state.constraints.articulatory_range_utilization.center = originalClearExecution;
if (originalClearGestureResponse) state.constraints.gesture_execution_response_map = originalClearGestureResponse;
else delete state.constraints.gesture_execution_response_map;
state.constraints.vocal_tract_length_cm.center = originalClearVtl;
state.vocalTractGeometry = originalClearGeometry;
for (const [vowel, resonances] of Object.entries(transferAnalysis)) {
  if (resonances.length < 3) throw new Error("Tube transfer has fewer than three detectable resonances for /" + vowel + "/");
  const reference = currentVowelReference(vowel, state.constraints.vocal_tract_length_cm.center);
  const targetF1 = reference.target_formants_hz[0];
  const targetF2 = reference.target_formants_hz[1];
  // Neutral Gesture execution intentionally undershoots the narrow /i/ target;
  // the explicit clear-articulation checks above guard its fully realized F1.
  const f1Tolerance = vowel === "i" ? 0.44 : 0.35;
  if (Math.abs(resonances[0].frequency_hz - targetF1) / targetF1 > f1Tolerance) throw new Error("Tube F1 is implausible for /" + vowel + "/");
  if (Math.abs(resonances[1].frequency_hz - targetF2) / targetF2 > 0.35) throw new Error("Tube F2 is implausible for /" + vowel + "/");
  for (const resonance of resonances.slice(0, 2)) {
    if (resonance.prominence_db < 2) throw new Error("Tube resonance is too weak for /" + vowel + "/");
    if (!Number.isFinite(resonance.bandwidth_3db_hz) || resonance.bandwidth_3db_hz < 70 || resonance.bandwidth_3db_hz > 420) {
      throw new Error("Tube resonance bandwidth is implausible for /" + vowel + "/");
    }
  }
}

const originalWallCompliance = state.constraints.vocal_tract_wall_compliance.center;
const originalBroadening = state.constraints.vocal_tract_resonance_broadening.center;
state.constraints.vocal_tract_wall_compliance.center = 0.58;
state.constraints.vocal_tract_resonance_broadening.center = 0.72;
const broadenedTube = synthesizeVowel("a");
let broadeningWaveDelta = 0;
const broadeningLimit = Math.min(audio.samples.length, broadenedTube.samples.length);
for (let index = 0; index < broadeningLimit; index++) {
  broadeningWaveDelta += Math.abs(audio.samples[index] - broadenedTube.samples[index]);
}
broadeningWaveDelta /= Math.max(1, broadeningLimit);
if (broadeningWaveDelta < 0.001) throw new Error("Wall compliance/resonance broadening did not affect tube waveform");
state.constraints.vocal_tract_wall_compliance.center = originalWallCompliance;
state.constraints.vocal_tract_resonance_broadening.center = originalBroadening;
console.log(\`Tube broadening controls passed; wave_delta=\${broadeningWaveDelta.toFixed(4)}\`);

const originalSideBranchCoupling = state.constraints.side_branch_loss_coupling.center;
const originalVpCoupling = state.constraints.velopharyngeal_loss_coupling.center;
const originalPiriformCoupling = state.constraints.piriform_fossa_loss_coupling.center;
state.constraints.side_branch_loss_coupling.center = 0.68;
state.constraints.velopharyngeal_loss_coupling.center = 0.58;
state.constraints.piriform_fossa_loss_coupling.center = 0.52;
const sideBranchedTube = synthesizeVowel("a");
let sideBranchWaveDelta = 0;
const sideBranchLimit = Math.min(audio.samples.length, sideBranchedTube.samples.length);
for (let index = 0; index < sideBranchLimit; index++) {
  sideBranchWaveDelta += Math.abs(audio.samples[index] - sideBranchedTube.samples[index]);
}
sideBranchWaveDelta /= Math.max(1, sideBranchLimit);
if (sideBranchWaveDelta < 0.001) throw new Error("Side-branch loss controls did not affect tube waveform");
state.constraints.side_branch_loss_coupling.center = originalSideBranchCoupling;
state.constraints.velopharyngeal_loss_coupling.center = originalVpCoupling;
state.constraints.piriform_fossa_loss_coupling.center = originalPiriformCoupling;
console.log(\`Side-branch loss controls passed; wave_delta=\${sideBranchWaveDelta.toFixed(4)}; branches=\${sideBranchedTube.side_branch_loss_model.branches.length}\`);

const originalVelocityDrive = state.constraints.glottal_volume_velocity_drive.center;
const originalFlowSmoothing = state.constraints.glottal_flow_smoothing.center;
const originalFlowInertance = state.constraints.glottal_flow_inertance.center;
state.constraints.glottal_volume_velocity_drive.center = 1.0;
state.constraints.glottal_flow_smoothing.center = 0.78;
state.constraints.glottal_flow_inertance.center = 0.42;
const velocityDrivenTube = synthesizeVowel("a");
let velocityDriveWaveDelta = 0;
const velocityDriveLimit = Math.min(audio.samples.length, velocityDrivenTube.samples.length);
for (let index = 0; index < velocityDriveLimit; index++) {
  velocityDriveWaveDelta += Math.abs(audio.samples[index] - velocityDrivenTube.samples[index]);
}
velocityDriveWaveDelta /= Math.max(1, velocityDriveLimit);
if (velocityDriveWaveDelta < 0.001) throw new Error("Volume-velocity source controls did not affect tube waveform");
state.constraints.glottal_volume_velocity_drive.center = originalVelocityDrive;
state.constraints.glottal_flow_smoothing.center = originalFlowSmoothing;
state.constraints.glottal_flow_inertance.center = originalFlowInertance;
console.log(\`Volume-velocity source controls passed; wave_delta=\${velocityDriveWaveDelta.toFixed(4)}\`);

els.synthesisBackendSelect.value = "hybrid";
const hybridAudio = synthesizeVowel("a");
let hybridMax = 0;
let hybridBad = 0;
for (const sample of hybridAudio.samples) {
  if (!Number.isFinite(sample)) hybridBad += 1;
  hybridMax = Math.max(hybridMax, Math.abs(sample));
}
if (hybridAudio.backend !== "hybrid_formant_guided_tube") throw new Error("Hybrid backend was not selected");
if (hybridAudio.sampleRate !== 44100) throw new Error("Hybrid preview is not running at 44.1 kHz");
if (!hybridAudio.area_function || hybridAudio.area_function.tube_count < 10) throw new Error("Hybrid output is missing area-function metadata");
if (!hybridAudio.formants || hybridAudio.formants.length !== 4) throw new Error("Hybrid output is missing four-formant metadata");
if (hybridAudio.formant_reference?.profile_id !== "ja_JP_standard_neutral_aggregate_0_1") throw new Error("Hybrid output is missing phonetic-target metadata");
if (!hybridAudio.hybrid_profile || hybridAudio.hybrid_profile.geometry_weight <= 0) throw new Error("Hybrid output is missing geometry-guided profile metadata");
if (!hybridAudio.side_branch_loss_model || hybridAudio.side_branch_loss_model.branches.length < 3) throw new Error("Hybrid output is missing side-branch loss metadata");
if (hybridAudio.side_branch_loss_model.controls.application_strength >= 1) throw new Error("Hybrid side-branch loss was not attenuated");
if (!hybridAudio.tube_reference?.level_matched) throw new Error("Hybrid tube texture was not level-matched to the formant layer");
if (Math.abs(hybridAudio.tube_reference.effective_texture_fraction - hybridAudio.tube_reference.texture_mix) > 0.001) {
  throw new Error("Hybrid texture control does not represent the effective RMS mix");
}
if (hybridAudio.source_noise_model?.aspiration_noise_owner !== "formant_layer") {
  throw new Error("Hybrid aspiration noise is not routed through a single owner");
}
if (hybridAudio.source_noise_model?.tube_aspiration_noise_scale !== 0) {
  throw new Error("Hybrid tube texture still contributes independent aspiration noise");
}
if (hybridAudio.source_noise_model?.formant_aspiration_noise_scale >= FORMANT_ASPIRATION_NOISE_SCALE) {
  throw new Error("Hybrid aspiration noise was not attenuated below the formant-only path");
}
if (hybridBad) throw new Error("Hybrid synthesis produced non-finite samples");
if (hybridMax < 0.01) throw new Error("Hybrid synthesis produced near-silence");
const hybridI = synthesizeVowel("i");
let hybridWaveDelta = 0;
const hybridLimit = Math.min(hybridAudio.samples.length, hybridI.samples.length);
for (let index = 0; index < hybridLimit; index++) {
  hybridWaveDelta += Math.abs(hybridAudio.samples[index] - hybridI.samples[index]);
}
hybridWaveDelta /= Math.max(1, hybridLimit);
if (hybridWaveDelta < 0.001) throw new Error("Hybrid synthesized waveforms are too similar between /a/ and /i/");
console.log(\`Hybrid synthesis smoke passed; max=\${hybridMax.toFixed(4)}; geometry_weight=\${hybridAudio.hybrid_profile.geometry_weight.toFixed(4)}; ai_wave_delta=\${hybridWaveDelta.toFixed(4)}\`);
console.log("Hybrid mix level matching passed; tube_match_db=" + hybridAudio.tube_reference.tube_level_match_gain_db.toFixed(2));

els.synthesisBackendSelect.value = "formant";
const formantVelocityReference = synthesizeVowel("a");
state.constraints.glottal_volume_velocity_drive.center = 0;
state.constraints.glottal_flow_smoothing.center = 0.9;
state.constraints.glottal_flow_inertance.center = 0.55;
const formantVelocityChanged = synthesizeVowel("a");
let formantVelocityDelta = 0;
const formantVelocityLimit = Math.min(formantVelocityReference.samples.length, formantVelocityChanged.samples.length);
for (let index = 0; index < formantVelocityLimit; index++) {
  formantVelocityDelta += Math.abs(formantVelocityReference.samples[index] - formantVelocityChanged.samples[index]);
}
formantVelocityDelta /= Math.max(1, formantVelocityLimit);
if (formantVelocityDelta > 1e-8) throw new Error("Tube-only volume-velocity control leaked into the formant backend");
state.constraints.glottal_volume_velocity_drive.center = originalVelocityDrive;
state.constraints.glottal_flow_smoothing.center = originalFlowSmoothing;
state.constraints.glottal_flow_inertance.center = originalFlowInertance;
console.log("Formant source isolation passed; velocity_control_delta=" + formantVelocityDelta.toFixed(8));

applyProfile({
  schema_version: "character_voice_lab_mvp_0.1",
  inputs: {
    age: 17,
    sex_reference_class: "female",
    height_cm: 158,
    weight_kg: 47,
    preview_synthesis_backend: "tube",
  },
  voice_constraints: {
    vocal_tract_length_cm: { center: 15.5 },
    glottal_closure: { center: 0.22 },
    f0_mean_hz: { center: 180 },
    vocal_fold_spring_constant: { center: 1 },
    baseline_muscle_tension: { center: 1.25 },
    tension_response_curve: { center: 1.1 },
    inflammation_index: { center: 0.1 },
    airway_lumen_narrowing: { center: 0.05 },
    maximum_respiratory_pressure_pa: { center: 840 },
    respiratory_support: { center: 1 },
  },
});
if (els.referenceImageStyleInput.value !== "illustration") {
  throw new Error("Legacy profile migration did not default the reference-image style to illustration");
}
if (els.phoneticTargetProfileInput.value !== "ja_JP_standard_neutral_aggregate_0_1") {
  throw new Error("Legacy profile migration did not choose the Japanese aggregate phonetic target for Japanese primary language");
}
const migratedExport = buildExport();
if (migratedExport.inputs.phonetic_target_profile !== "ja_JP_standard_neutral_aggregate_0_1") {
  throw new Error("Export did not preserve the active phonetic target profile");
}
if (migratedExport.phonetic_target?.vowels?.u?.target_formants_hz?.[1] <= migratedExport.phonetic_target?.vowels?.o?.target_formants_hz?.[1]) {
  throw new Error("Export did not preserve Japanese /u/-/o/ target separation");
}
if (els.synthesisBackendSelect.value !== "tube") {
  throw new Error("Legacy profile migration did not retain the 1D tube backend");
}
if (state.vocalTractGeometry.schema_version !== "vocal_tract_geometry_0.2" || !state.vocalTractGeometry.sections?.[0]?.cross_section) {
  throw new Error("Legacy profile migration did not rebuild the vocal-tract geometry as 2.5D");
}
for (const key of [
  "glottal_open_quotient",
  "mouth_width_relaxed_cm",
  "glottal_speed_quotient",
  "glottal_return_phase",
  "glottal_spectral_tilt_db",
  "glottal_breathiness",
  "glottal_volume_velocity_drive",
  "glottal_flow_smoothing",
  "glottal_flow_inertance",
  "vocal_tract_wall_loss",
  "vocal_tract_viscothermal_loss",
  "vocal_tract_high_frequency_damping",
  "vocal_tract_wall_compliance",
  "vocal_tract_resonance_broadening",
  "lip_radiation_smoothing",
  "side_branch_loss_coupling",
  "velopharyngeal_loss_coupling",
  "piriform_fossa_loss_coupling",
  "piriform_fossa_frequency_hz",
  "nasal_branch_damping",
  "hybrid_side_branch_strength",
  "hybrid_formant_anchor",
  "hybrid_tube_texture_mix",
  "palatal_vault_scale",
  "lip_aperture_aspect_scale",
  "tongue_groove_capacity",
  "tongue_dorsum_range_utilization",
  "labial_transverse_range_utilization",
]) {
  if (!Number.isFinite(state.constraints[key]?.center)) throw new Error(\`Missing migrated synthesis constraint: \${key}\`);
}
const expectedEffectiveClosure = clamp(0.22 - 0.1 * 0.22 - 0.05 * 0.1, 0, 1);
const expectedOpenQuotient = clamp(0.66 - expectedEffectiveClosure * 0.22 + 0.1 * 0.08 + (1 - 1.25) * 0.04, 0.38, 0.84);
if (Math.abs(state.constraints.glottal_open_quotient.center - expectedOpenQuotient) > 0.02) {
  throw new Error("Legacy profile migration did not recalculate glottal open quotient from loaded baseline values");
}
const migratedAudio = synthesizeVowel("a");
let migratedMax = 0;
for (const sample of migratedAudio.samples) migratedMax = Math.max(migratedMax, Math.abs(sample));
if (migratedMax < 0.01) throw new Error("Migrated legacy profile produced near-silence");
console.log(\`Legacy profile migration passed; oq=\${state.constraints.glottal_open_quotient.center.toFixed(4)}; max=\${migratedMax.toFixed(4)}\`);
`);

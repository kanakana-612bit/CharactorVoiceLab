const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const indexHtml = fs.readFileSync(path.join(projectRoot, "index.html"), "utf8");
const styleSheet = fs.readFileSync(path.join(projectRoot, "styles.css"), "utf8");

if (!/<h1>CharacterVoiceDesigner <span class="version-badge">Ver 0\.1<\/span><\/h1>/.test(indexHtml)) {
  throw new Error("The designer branch version badge is not Ver 0.1");
}
if (!/<button class="tab-button" data-tab-target="ttsModelTab">TTSモデル<\/button>/.test(indexHtml)
  || !/<button class="tab-button" data-tab-target="outputTab">出力デモ<\/button>/.test(indexHtml)) {
  throw new Error("The TTS model and output demo workflow tabs are missing");
}
if (!/<select id="referenceImageStyleInput">\s*<option value="illustration" selected>/.test(indexHtml)) {
  throw new Error("Illustration is not the default reference-image style");
}
if (!/<select id="phoneticTargetProfileInput">\s*<option value="ja_JP_standard_neutral_aggregate_0_1" selected>/.test(indexHtml)) {
  throw new Error("Japanese aggregate phonetic target is not the default in the UI");
}
if (/id="synthesisBackendSelect"|value="hybrid"|value="formant"/.test(indexHtml)) {
  throw new Error("Retired synthesis backend choices remain in the UI");
}
if (!/id="ttsModelSelect"[\s\S]*value="irodori-vdes"/.test(indexHtml)
  || !/id="generateTtsDemoBtn"/.test(indexHtml)
  || !/id="voiceControlSliders"/.test(indexHtml)) {
  throw new Error("The audio.cpp VoiceDesign workflow is incomplete");
}
if (!/id="syllableSetInput"[\s\S]*value="japanese_core_cv"/.test(indexHtml)
  || !/id="exportSyllableDatasetBtn"/.test(indexHtml)
  || !/id="resetAreaTuningBtn"/.test(indexHtml)
  || !/id="editWidthModeBtn"/.test(indexHtml)
  || !/id="recordAuditoryEvaluationBtn"/.test(indexHtml)) {
  throw new Error("Syllable dataset export or vowel A(x) tuning controls are missing from the UI");
}
if (!/data-tab-target="vowelTab">母音試聴<\/button>/.test(indexHtml)
  || !/data-tab-target="consonantTab">子音試聴<\/button>/.test(indexHtml)
  || !/id="vowelExecutionSliders"/.test(indexHtml)
  || !/id="consonantExecutionSliders"/.test(indexHtml)
  || !/id="vowelCalibrationMount"/.test(indexHtml)
  || !/id="consonantCalibrationMount"/.test(indexHtml)) {
  throw new Error("Vowel and consonant calibration workspaces are missing from the workflow tabs");
}
for (const id of [
  "nasalTokenSelect",
  "nasalProfileCanvas",
  "nasalClosurePositionInput",
  "nasalClosureAreaInput",
  "nasalVpOpeningInput",
  "nasalCoarticulationLeadInput",
  "nasalAttackFadeInput",
  "playUntunedNasalBtn",
  "playTunedNasalBtn",
  "recordNasalEvaluationBtn",
]) {
  if (!new RegExp(`id="${id}"`).test(indexHtml)) throw new Error(`Missing nasal calibration control: ${id}`);
}
if (!/<summary>2\.5D音響管・出力詳細<\/summary>/.test(indexHtml)) {
  throw new Error("The acoustic preview is not labeled as the sole 2.5D tube model");
}
if (!/<input id="projectTitleInput"[^>]*value="voice_profile"/.test(indexHtml)) {
  throw new Error("Default profile name is not voice_profile");
}
if (!/<aside id="floatingPreviewDock" class="floating-action-dock"[^>]*hidden>[\s\S]*id="vowelSelect"[\s\S]*id="playSampleButton"/.test(indexHtml)) {
  throw new Error("Detail-only phoneme selection and sample playback dock is missing from the UI");
}
if (!/<section[^>]*id="setupTab"[\s\S]*<button id="analyzeBtn"[^>]*>解析<\/button>/.test(indexHtml)) {
  throw new Error("Analysis action is not available in the basic-information workflow");
}
if (!/<section[^>]*id="detailTab"[\s\S]*<button id="recalculateBtn"[^>]*>再計算<\/button>/.test(indexHtml)) {
  throw new Error("Explicit recalculation action is not available in the detail workflow");
}
if (/id="rangeKInput"|id="glottalClosureInput"/.test(indexHtml)) {
  throw new Error("Retired global range or glottal-tendency sliders remain in the UI");
}
if (!/\.floating-action-dock\s*\{[^}]*position:\s*fixed;[^}]*right:\s*16px;[^}]*bottom:\s*16px;/.test(styleSheet)) {
  throw new Error("Persistent action dock is not fixed to the desktop viewport");
}
if (!/@media \(max-width: 640px\)\s*\{[\s\S]*?\.floating-action-dock\s*\{[^}]*grid-template-columns:\s*1fr 1fr;/.test(styleSheet)) {
  throw new Error("Persistent action dock is not adapted to the mobile viewport");
}
if (!/#analyzeBtn\s*\{[^}]*white-space:\s*nowrap;[^}]*writing-mode:\s*horizontal-tb;/.test(styleSheet)) {
  throw new Error("The basic analysis action is not protected from vertical text wrapping");
}

global.window = global;

const elements = new Map();

function makeContext() {
  return {
    clearRect() {},
    fillRect() {},
    strokeRect() {},
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
      childNodes: [],
      dataset: {},
      style: { setProperty() {} },
      classList: { toggle() {}, add() {}, remove() {} },
      setAttribute() {},
      append(...nodes) {
        this.childNodes.push(...nodes);
      },
      appendChild(node) {
        this.childNodes.push(node);
        return node;
      },
      replaceChildren(...nodes) {
        this.childNodes = [...nodes];
      },
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
  createTextNode(text) {
    return { textContent: String(text) };
  },
};

for (const file of [
  "reference_data.js",
  "local_pdf_growth_priors.js",
  "prior_resolver.js",
  "project_package.js",
  "landmark_schema.js",
  "voice_control_profile.js",
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

if (/function synthesizeFormantVowel|function synthesizeHybridVowel|function prepareHybridTubeTexture/.test(appCode)) {
  throw new Error("Retired formant or hybrid synthesis functions remain in app.js");
}
if (!/els\.analyzeBtn\.addEventListener\("click", runBasicAnalysis\)/.test(appCode)) {
  throw new Error("The basic-information analysis button is not wired to its analysis action");
}
if (!/els\.recalculateBtn\?\.addEventListener\("click", runDetailRecalculation\)/.test(appCode)) {
  throw new Error("The detail recalculation button is not wired to its recalculation action");
}
if (!/els\.globalImageWeight\?\.addEventListener\("input", renderImageWeightRecalculationState\)/.test(appCode)) {
  throw new Error("Image-weight edits are not kept pending until explicit recalculation");
}

eval(`${appCode}
els.heightInput.value = 158;
els.sexInput.value = "female";
els.primaryLanguageInput.value = "ja-JP";
els.phoneticTargetProfileInput.value = "ja_JP_standard_neutral_aggregate_0_1";
els.ageInput.value = 17;
els.weightInput.value = 47;
els.bodyFatInput.value = "";
els.populationInput.value = "General";
els.referenceImageStyleInput.value = "illustration";
els.dataSourceInput.value = "public_default";
els.globalImageWeight.value = 0.7;
els.profileDirectionInput.value = "right";
els.vowelSelect.value = "a";
if (advancedAcousticControls.some((control) => control.key === "tension_response_curve")) {
  throw new Error("Retired tension-response slider remains in the advanced acoustic controls");
}
if (advancedAcousticControls.some((control) => control.key === "side_branch_loss_coupling")) {
  throw new Error("Retired global side-branch slider remains in the advanced acoustic controls");
}
if (glottalPhysiologyControls.some((control) => ["inflammation_index", "airway_lumen_narrowing"].includes(control.key))) {
  throw new Error("Provisional inflammation or airway-narrowing controls remain in the detail UI");
}
if (!glottalPhysiologyControls.find((control) => control.key === "f0_mean_hz")?.readOnly) {
  throw new Error("Derived F0 remains user-editable");
}
for (const key of ["body_resonance_frequency_hz", "body_resonance_gain_db", "body_resonance_coupling"]) {
  if (!advancedAcousticControls.some((control) => control.key === key)) throw new Error("Missing body-resonance control: " + key);
}
state.constraintOverrides.vocal_tract_length_cm = 19.75;
const basicRevisionBefore = state.analysisRevision;
runBasicAnalysis();
if (state.analysisRevision !== basicRevisionBefore + 1 || !String(els.extractionStatus.textContent).startsWith("解析完了。")) {
  throw new Error("The basic-information analysis action did not execute a complete analysis");
}
if ("vocal_tract_length_cm" in state.constraintOverrides || Math.abs(state.constraints.vocal_tract_length_cm.center - 19.75) < 0.0001) {
  throw new Error("The basic analysis action preserved a manually edited slider center");
}
const shoulderAtAppliedWeight = state.features.shoulder_width_cm.integrated;
els.globalImageWeight.value = 0;
const pendingImageWeight = renderImageWeightRecalculationState();
if (!pendingImageWeight.pending || state.appliedImageWeight !== 0.7 || state.features.shoulder_width_cm.integrated !== shoulderAtAppliedWeight) {
  throw new Error("Image contribution changed downstream values before explicit recalculation");
}
state.constraintOverrides.pharyngeal_length_scale = 1.24;
state.constraints.pharyngeal_length_scale.center = 1.24;
const detailRevisionBefore = state.analysisRevision;
runDetailRecalculation();
if (state.analysisRevision !== detailRevisionBefore + 1 || state.appliedImageWeight !== 0) {
  throw new Error("The detail recalculation action did not apply the selected image contribution");
}
if ("pharyngeal_length_scale" in state.constraintOverrides || Math.abs(state.constraints.pharyngeal_length_scale.center - 1.24) < 0.0001) {
  throw new Error("The detail recalculation action preserved a manually edited slider center");
}
if (Math.abs(state.features.shoulder_width_cm.integrated - state.features.shoulder_width_cm.statistical_median) > 0.0001
  || Math.abs(state.features.shoulder_width_cm.integrated - shoulderAtAppliedWeight) < 0.0001) {
  throw new Error("Detail recalculation did not propagate image contribution into integrated dimensions");
}
const recalculatedProfile = buildExport();
if (recalculatedProfile.inputs.image_analysis_weight !== 0) {
  throw new Error("The last applied image contribution was not exported");
}
els.globalImageWeight.value = 0.7;
applyProfile(recalculatedProfile);
if (Number(els.globalImageWeight.value) !== 0 || state.appliedImageWeight !== 0) {
  throw new Error("The saved image contribution was not restored and applied on profile load");
}
state.features = {
  neck_root_width_cm: { integrated: 13.3 },
  jaw_width_cm: { integrated: 11.1 },
  mouth_width_cm: { integrated: 4.85 },
};
state.constraints = {
  vocal_tract_length_cm: { center: 15.5 },
  pharyngeal_length_scale: { center: 1 },
  glottal_open_quotient: { center: 0.58 },
  glottal_speed_quotient: { center: 1.8 },
  glottal_return_phase: { center: 0.14 },
  glottal_spectral_tilt_db: { center: 12 },
  glottal_breathiness: { center: 0.08 },
  glottal_volume_velocity_drive: { center: 0.86 },
  glottal_flow_smoothing: { center: 0.34 },
  glottal_flow_inertance: { center: 0.14 },
  f0_reference_hz: { center: 180 },
  f0_mean_hz: { center: 180, read_only_derived: true },
  vocal_fold_spring_constant: { center: 1 },
  baseline_muscle_tension: { center: 1 },
  inflammation_index: { center: 0 },
  airway_lumen_narrowing: { center: 0 },
  vocal_tract_wall_loss: { center: 0.018 },
  vocal_tract_viscothermal_loss: { center: 0.012 },
  vocal_tract_high_frequency_damping: { center: 0.28 },
  vocal_tract_wall_compliance: { center: 0.18 },
  vocal_tract_resonance_broadening: { center: 0.26 },
  lip_radiation_smoothing: { center: 0.32 },
  paranasal_sinus_volume_cm3: { center: 24 },
  sinus_neck_area_cm2: { center: 0.24 },
  sinus_neck_length_cm: { center: 1.2 },
  sinus_coupling: { center: 0.25 },
  sinus_damping: { center: 0.68 },
  velopharyngeal_loss_coupling: { center: 0.18 },
  piriform_fossa_loss_coupling: { center: 0.14 },
  piriform_fossa_frequency_hz: { center: 3700 },
  nasal_branch_damping: { center: 0.72 },
  body_resonance_coupling: { center: 0.25 },
  body_resonance_frequency_hz: { center: 210 },
  body_resonance_gain_db: { center: 4 },
  thoracic_volume_l: { center: 4.6 },
  abdominal_volume_l: { center: 6.3 },
  predicted_vc_l: { center: 3.1, statistics: { reference_center: 3.1 } },
  predicted_fvc_l: { center: 3.2, statistics: { reference_center: 3.2 } },
  predicted_fev1_l: { center: 2.9, statistics: { reference_center: 2.9 } },
  predicted_pef_l_s: { center: 5.6, statistics: { reference_center: 5.6 } },
  maximum_ventilation_l_min: {
    center: 95,
    statistics: { reference_center: 95 },
    derivation: {
      unconstrained_estimate_l_min: 95,
      structural_capacity_ceiling_l_min: 95,
      reference_capacity_l_min: 95,
      thoracic_reference_l: 4.6,
      abdominal_reference_l: 6.3,
      thoracic_weight: 0.62,
      abdominal_weight: 0.38,
    },
  },
  maximum_respiratory_pressure_pa: { center: 900, statistics: { reference_center: 900 } },
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
state.vowelAreaTuning = { i: normalizedAreaTuningPoints("i").map((point) => point.position === 0.66 ? { ...point, gain: 1.35 } : point) };
const iAreaTuned = buildTubeAreaFunction(state.vocalTractGeometry, "i", PREVIEW_SAMPLE_RATE);
if (totalAreaDelta(iAreaBaseline, iAreaTuned) < 0.5 || iAreaTuned.vowel_area_tuning?.find((point) => point.position === 0.66)?.gain !== 1.35) {
  throw new Error("Vowel-specific A(x) tuning did not alter or export the /i/ area function");
}
const iAreaWithoutManualTuning = buildTubeAreaFunction(
  state.vocalTractGeometry,
  "i",
  PREVIEW_SAMPLE_RATE,
  currentArticulationMotorProfile(state.constraints),
  { manualTuning: false }
);
if (totalAreaDelta(iAreaBaseline, iAreaWithoutManualTuning) > 0.0001 || iAreaWithoutManualTuning.manual_tuning_applied !== false) {
  throw new Error("Auditory A/B baseline did not bypass manual A(x) tuning");
}
const tunedI = synthesizeVowel("i");
state.vowelAreaTuning = {};
const untunedI = synthesizeVowel("i");
let tunedWaveDelta = 0;
for (let index = 0; index < Math.min(tunedI.samples.length, untunedI.samples.length, 4096); index++) {
  tunedWaveDelta += Math.abs(tunedI.samples[index] - untunedI.samples[index]);
}
if (tunedWaveDelta / 4096 < 0.001) {
  throw new Error("Vowel-specific A(x) tuning did not affect synthesized audio");
}
state.vowelWidthTuning = { i: normalizedWidthTuningPoints("i").map((point) => point.position === 0.82 ? { ...point, gain: 1.3 } : point) };
const iWidthTuned = buildTubeAreaFunction(state.vocalTractGeometry, "i", PREVIEW_SAMPLE_RATE);
const widthIndex = Math.round(0.82 * (iWidthTuned.cross_sections_2_5d.length - 1));
if (totalAreaDelta(iAreaBaseline, iWidthTuned) < 0.25
  || iWidthTuned.cross_sections_2_5d[widthIndex].coronal_width_cm <= iAreaBaseline.cross_sections_2_5d[widthIndex].coronal_width_cm
  || iWidthTuned.cross_sections_2_5d[widthIndex].sagittal_height_cm !== iAreaBaseline.cross_sections_2_5d[widthIndex].sagittal_height_cm) {
  throw new Error("Vowel-specific W(x) tuning did not recompute area at fixed sagittal height");
}
const iWidthUntunedForComparison = buildTubeAreaFunction(
  state.vocalTractGeometry,
  "i",
  PREVIEW_SAMPLE_RATE,
  currentArticulationMotorProfile(state.constraints),
  { manualTuning: false }
);
if (totalAreaDelta(iAreaBaseline, iWidthUntunedForComparison) > 0.0001) {
  throw new Error("Auditory A/B baseline did not bypass manual W(x) tuning");
}
state.auditoryEvaluationLog = [{
  id: "test-i",
  created_at: "2026-07-17T00:00:00.000Z",
  vowel: "i",
  phoneme_clarity: 4,
  target_match: 3,
  note: "low-frequency balance check",
  area_tuning: normalizedAreaTuningPoints("i"),
  width_tuning: normalizedWidthTuningPoints("i"),
}];
const calibrationExport = buildExport();
if (calibrationExport.vowel_width_tuning?.control_points?.i?.find((point) => point.position === 0.82)?.gain !== 1.3
  || calibrationExport.auditory_evaluation_log?.[0]?.phoneme_clarity !== 4
  || normalizeLoadedWidthTuning(calibrationExport.vowel_width_tuning).i?.length !== AREA_TUNING_HANDLES.length
  || normalizeAuditoryEvaluationLog(calibrationExport.auditory_evaluation_log)[0]?.note !== "low-frequency balance check") {
  throw new Error("W(x) tuning or auditory-evaluation records did not survive profile serialization");
}
state.vowelWidthTuning = {};
state.auditoryEvaluationLog = [];
const ka = synthesizeSyllable("ka");
const aOnly = synthesizeSyllable("a");
if (ka.samples.length <= aOnly.samples.length || ka.onset_model?.consonant !== "k" || ka.vowel !== "a") {
  throw new Error("CV syllable synthesis did not prepend a consonant onset");
}
const ma = synthesizeSyllable("ma");
const na = synthesizeSyllable("na");
const ni = synthesizeSyllable("ni");
const nu = synthesizeSyllable("nu");
const moraicNasal = synthesizeSyllable("n");
if (ma.nasal_model?.schema_version !== "nasal_consonant_model_1.1"
  || ma.nasal_model.nasal_class !== "m"
  || na.nasal_model?.schema_version !== "nasal_consonant_model_1.1"
  || na.nasal_model?.nasal_class !== "n"
  || moraicNasal.nasal_model?.nasal_class !== "N"
  || moraicNasal.vowel !== null) {
  throw new Error("Nasal syllables did not use the dedicated oral/nasal path model");
}
if (ma.nasal_model.level_matching?.schema_version !== "coupled_radiation_level_diagnostic_0.1"
  || na.nasal_model.level_matching?.schema_version !== "coupled_radiation_level_diagnostic_0.1"
  || na.nasal_model.level_matching?.independent_level_matching !== false
  || na.nasal_model.voicing_continuity_diagnostic?.schema_version !== "nasal_voicing_continuity_diagnostic_0.2"
  || na.nasal_model.voicing_continuity_diagnostic?.release_periodicity_method
    !== "RMS-weighted 2.5-period frame correlation"
  || moraicNasal.nasal_model.level_matching !== null) {
  throw new Error("CV nasal level matching metadata is missing or was incorrectly applied to moraic /N/");
}
if (na.nasal_model.acoustic_topology?.schema_version !== "branched_nasal_oral_waveguide_0.2"
  || ma.nasal_model.acoustic_topology?.schema_version !== "branched_nasal_oral_waveguide_0.2"
  || na.nasal_model.acoustic_topology?.scattering !== "lossy_three_port_pressure_junction"
  || na.nasal_model.acoustic_topology?.shared_glottal_source !== true
  || na.nasal_model.acoustic_topology?.oral_and_nasal_radiation_summed_once !== true
  || na.nasal_model.resonance_model?.explicit_nasal_pole_zero_filter !== false
  || na.nasal_model.side_branch_loss_model?.excluded_branches?.includes("velopharyngeal_nasal") !== true
  || !(na.nasal_model.acoustic_topology.peak_vp_port_area_cm2 > na.nasal_model.acoustic_topology.minimum_vp_port_area_cm2)
  || !(ma.nasal_model.acoustic_topology.requested_oral_contact_junction
    > na.nasal_model.acoustic_topology.requested_oral_contact_junction)
  || ma.nasal_model.acoustic_topology.peak_oral_contact_strength < 0.7) {
  throw new Error("CV nasals did not use the pressure-coupled branched waveguide exclusively");
}
for (const alveolarAudio of [na, ni, nu]) {
  if (alveolarAudio.nasal_model?.acoustic_topology?.schema_version !== "branched_nasal_oral_waveguide_0.2"
    || alveolarAudio.samples.some((sample) => !Number.isFinite(sample))
    || alveolarAudio.samples.reduce((peak, sample) => Math.max(peak, Math.abs(sample)), 0) < 0.01) {
    throw new Error("The pressure-coupled alveolar nasal failed for /" + alveolarAudio.token + "/");
  }
}
if (ma.nasal_model.release_trajectory?.area_trajectory_schema !== "multi_stage_area_trajectory_0.1"
  || na.nasal_model.release_trajectory?.area_trajectory_schema !== "multi_stage_area_trajectory_0.1"
  || ma.nasal_model.release_trajectory?.schema_version !== "nasal_release_trajectory_0.8"
  || na.nasal_model.release_trajectory?.schema_version !== "nasal_release_trajectory_0.8"
  || na.nasal_model.release_trajectory?.vp_area_trajectory_schema !== "velopharyngeal_port_area_trajectory_0.1"
  || na.nasal_model.release_trajectory?.pressure_coupled_branch !== true
  || ma.nasal_model.release_trajectory.continuous_oral_render !== true
  || ma.nasal_model.release_trajectory.waveform_switch_after_release !== false
  || ma.nasal_model.release_trajectory.shared_glottal_source !== true
  || ma.nasal_model.release_trajectory.independent_path_normalization !== false
  || ma.nasal_model.release_trajectory.place_specific_coronal_release !== false
  || ma.nasal_model.release_trajectory.place_cue_keyframe_sample !== null
  || na.nasal_model.release_trajectory.place_specific_coronal_release !== true
  || !(na.nasal_model.release_trajectory.place_cue_keyframe_sample
    > na.nasal_model.release_trajectory.oral_release_sample)
  || !(na.nasal_model.release_trajectory.place_cue_keyframe_sample
    < na.nasal_model.release_trajectory.vowel_target_sample)
  || moraicNasal.nasal_model.release_trajectory !== null
  || ma.nasal_model.release_cue?.type !== "waveguide_geometry_transient"
  || na.nasal_model.release_cue?.type !== "waveguide_geometry_transient"
  || na.nasal_model.release_cue?.stochastic_excitation !== false
  || ma.nasal_model.release_cue?.stochastic_excitation !== false) {
  throw new Error("Place-specific nasal release trajectories or cues were not exported");
}
if (ma.nasal_model.place_gesture?.kind !== "bilabial_end_closure"
  || ma.nasal_model.coronal_release_area_function !== null
  || na.nasal_model.place_gesture?.kind !== "coronal_alveolar"
  || na.nasal_model.coronal_release_area_function?.schema_version !== "nasal_oral_closure_area_0.3"
  || na.nasal_model.coronal_release_area_function.closure_area_cm2
    <= na.nasal_model.oral_closure_area_function.closure_area_cm2
  || na.nasal_model.coronal_release_area_function.place_gesture_strength >= 1) {
  throw new Error("The alveolar nasal did not derive its coronal tongue and release geometry from place");
}
if (!(ma.nasal_model.timing.coarticulation_start_ms < ma.nasal_model.timing.oral_release_ms)
  || !(ma.nasal_model.timing.oral_release_ms < ma.nasal_model.timing.vowel_target_ms)
  || ma.nasal_model.routing.shared_glottal_source !== true
  || ma.nasal_model.routing.independent_path_normalization !== false
  || normalizedNasalTuning("m", false).coarticulation_lead_ms <= 0
  || normalizedNasalTuning("N", false).coarticulation_lead_ms !== 0) {
  throw new Error("Nasal CV timing anchors or shared-source routing metadata are invalid");
}
const migratedPreAnchorNasal = normalizeLoadedNasalTuning({
  profiles: { m: { hold_duration_ms: 45, transition_ms: 19, attack_fade_ms: 30 } },
});
if (migratedPreAnchorNasal.m?.hold_duration_ms !== 45
  || migratedPreAnchorNasal.m?.transition_ms !== 19
  || migratedPreAnchorNasal.m?.attack_fade_ms !== 30
  || migratedPreAnchorNasal.m?.coarticulation_lead_ms !== NASAL_DEFAULTS.m.coarticulation_lead_ms) {
  throw new Error("Pre-anchor nasal profiles did not retain saved timing while receiving the new coarticulation default");
}
if (normalizedNasalTuning("n", false).closure_position !== 0.88
  || normalizedNasalTuning("n", false).closure_area_cm2 !== 0.008) {
  throw new Error("The alveolar nasal default is outside its intended place/contact target");
}
const migratedV3NasalTuning = normalizeLoadedNasalTuning({
  schema_version: "nasal_articulation_tuning_0.3",
  profiles: { n: { closure_area_cm2: 0.2656 } },
});
const directV4NasalTuning = normalizeLoadedNasalTuning({
  schema_version: "nasal_articulation_tuning_0.4",
  profiles: { n: { closure_area_cm2: 0.025 } },
});
if (migratedV3NasalTuning.n?.closure_area_cm2 !== 0.025
  || directV4NasalTuning.n?.closure_area_cm2 !== 0.025) {
  throw new Error("Legacy hidden /n/ closure-area scaling was not migrated to direct physical units");
}
const reportedMannerDriftM = nasalArticulationValidity(normalizedNasalTuningFromSource("m", {
  closure_position: 0.915,
  closure_area_cm2: 0.35,
  closure_width: 0.135,
  velopharyngeal_opening: 1,
  nasal_path_gain: 1.33,
  branch_damping: 0.66,
  hold_duration_ms: 45,
  coarticulation_lead_ms: 38,
  transition_ms: 15,
  attack_fade_ms: 6,
}));
const reportedMannerDriftN = nasalArticulationValidity(normalizedNasalTuningFromSource("n", {
  closure_position: 0.7268,
  closure_area_cm2: migratedV3NasalTuning.n.closure_area_cm2,
  closure_width: 0.11,
  velopharyngeal_opening: 1,
  nasal_path_gain: 0.55,
  branch_damping: 0.48,
  hold_duration_ms: 45,
  coarticulation_lead_ms: 22,
  transition_ms: 102,
  attack_fade_ms: 15,
}));
if (!reportedMannerDriftM.issues.some((issue) => issue.code === "incomplete_oral_contact")
  || !reportedMannerDriftM.issues.some((issue) => issue.code === "excessive_early_coarticulation")
  || !reportedMannerDriftN.issues.some((issue) => issue.code === "closure_place_outside_target")
  || !reportedMannerDriftN.issues.some((issue) => issue.code === "prolonged_vowel_transition")
  || !reportedMannerDriftN.issues.some((issue) => issue.code === "weak_nasal_radiation")) {
  throw new Error("Reported /ma/→/wa/ or /na/→/ma/ settings were not detected as manner drift");
}
if (ma.nasal_model.oral_side_cavity.primary_antiresonance_hz
  >= na.nasal_model.oral_side_cavity.primary_antiresonance_hz) {
  throw new Error("Nasal place of articulation did not alter the oral-side antiresonance");
}
if (ma.samples.length <= aOnly.samples.length || moraicNasal.samples.length <= 1000) {
  throw new Error("Nasal hold and CV transition timing were not included in synthesis");
}
const windowRms = (samples, start, end) => {
  let sum = 0;
  let count = 0;
  for (let index = Math.max(0, start); index < Math.min(samples.length, end); index++) {
    sum += samples[index] * samples[index];
    count += 1;
  }
  return Math.sqrt(sum / Math.max(1, count));
};
const nasalLevelDiagnostics = [];
for (const nasalAudio of [ma, na]) {
  const releaseEnd = Math.round(
    (nasalAudio.nasal_model.timing.hold_duration_ms + nasalAudio.nasal_model.timing.transition_ms)
      * nasalAudio.sampleRate / 1000
  );
  const shortWindow = Math.round(nasalAudio.sampleRate * 0.008);
  const junctionRms = windowRms(nasalAudio.samples, releaseEnd - shortWindow, releaseEnd + shortWindow);
  const beforeRms = windowRms(nasalAudio.samples, releaseEnd - shortWindow * 3, releaseEnd - shortWindow * 2);
  const afterRms = windowRms(nasalAudio.samples, releaseEnd + shortWindow * 2, releaseEnd + shortWindow * 3);
  if (junctionRms < Math.max(beforeRms, afterRms) * 0.18) {
    throw new Error("Nasal-to-vowel release contains an unintended low-energy gap for /" + nasalAudio.token + "/");
  }
  const holdStart = Math.round(nasalAudio.sampleRate * 0.025);
  const holdEnd = Math.max(holdStart + 1, Math.round(nasalAudio.nasal_model.timing.hold_duration_ms * nasalAudio.sampleRate / 1000) - shortWindow);
  const vowelStart = releaseEnd + Math.round(nasalAudio.sampleRate * 0.12);
  const nasalRms = windowRms(nasalAudio.samples, holdStart, holdEnd);
  const vowelRms = windowRms(nasalAudio.samples, vowelStart, vowelStart + Math.round(nasalAudio.sampleRate * 0.18));
  const nasalToVowelDb = 20 * Math.log10(Math.max(1e-8, nasalRms) / Math.max(1e-8, vowelRms));
  const minimumBalanceDb = -12;
  const maximumBalanceDb = -4;
  if (nasalToVowelDb < minimumBalanceDb || nasalToVowelDb > maximumBalanceDb) {
    throw new Error("CV nasal level is not plausibly matched to the following vowel for /" + nasalAudio.token + "/: " + nasalToVowelDb.toFixed(3) + " dB; " + JSON.stringify(nasalAudio.nasal_model.level_matching));
  }
  nasalLevelDiagnostics.push({
    token: nasalAudio.token,
    nasal_rms: Number(nasalRms.toFixed(5)),
    vowel_rms: Number(vowelRms.toFixed(5)),
    nasal_to_vowel_db: Number(nasalToVowelDb.toFixed(3)),
  });
}
console.log("Nasal level diagnostics: " + JSON.stringify(nasalLevelDiagnostics));
const reportedAlveolarTuning = {
  closure_position: 0.8635,
  closure_area_cm2: 0.006,
  closure_width: 0.05,
  velopharyngeal_opening: 1,
  nasal_path_gain: 1.4,
  branch_damping: 0.3,
  hold_duration_ms: 45,
  coarticulation_lead_ms: 22,
  transition_ms: 18,
  attack_fade_ms: 13,
};
state.nasalTuning = { n: reportedAlveolarTuning };
const reportedNa = synthesizeSyllable("na");
const reportedNi = synthesizeSyllable("ni");
const reportedBalances = [reportedNa, reportedNi].map((audio) => ({
  token: audio.token,
  nasal_to_vowel_db: audio.nasal_model.level_matching.measured_nasal_to_vowel_db,
  nasal_radiation_scale: audio.nasal_model.routing.nasal_radiation_scale,
  maximum_vp_port_area_cm2: audio.nasal_model.routing.maximum_vp_port_area_cm2,
}));
console.log("Reported /n/ tuning diagnostics: " + JSON.stringify(reportedBalances));
console.log("Reported /na/ continuity: " + JSON.stringify(reportedNa.nasal_model.voicing_continuity_diagnostic));
if (reportedBalances.some((entry) => entry.nasal_to_vowel_db < -10)
  || reportedNa.nasal_model.release_cue.stochastic_excitation !== false
  || reportedNa.nasal_model.voicing_continuity_diagnostic?.hold_periodicity < 0.85
  || reportedNa.nasal_model.voicing_continuity_diagnostic?.release_periodicity < 0.2
  || reportedNa.nasal_model.voicing_continuity_diagnostic?.hold_low_to_high_energy_db < 10) {
  throw new Error("The reported /n/ tuning still collapses into a weak nasal hold or adds a stop-like burst");
}
state.nasalTuning = { n: { ...reportedAlveolarTuning, nasal_path_gain: 0.35 } };
const lowRadiationNa = synthesizeSyllable("na");
state.nasalTuning = { n: reportedAlveolarTuning };
const highRadiationNa = synthesizeSyllable("na");
const lowRadiationBalanceDb = lowRadiationNa.nasal_model.level_matching.measured_nasal_to_vowel_db;
const highRadiationBalanceDb = highRadiationNa.nasal_model.level_matching.measured_nasal_to_vowel_db;
console.log("Nasal radiation sweep: " + JSON.stringify({
  low_db: lowRadiationBalanceDb,
  high_db: highRadiationBalanceDb,
  fixed_vp_area_cm2: highRadiationNa.nasal_model.routing.maximum_vp_port_area_cm2,
  low_components: lowRadiationNa.nasal_model.level_matching.component_radiation_rms,
  high_components: highRadiationNa.nasal_model.level_matching.component_radiation_rms,
}));
if (Math.abs(
  lowRadiationNa.nasal_model.routing.maximum_vp_port_area_cm2
  - highRadiationNa.nasal_model.routing.maximum_vp_port_area_cm2
) > 1e-6
  || highRadiationNa.nasal_model.routing.nasal_radiation_scale
    <= lowRadiationNa.nasal_model.routing.nasal_radiation_scale * 2.5
  || highRadiationBalanceDb <= lowRadiationBalanceDb + 4) {
  throw new Error("Nasal radiation control still changes VP branch geometry or is not monotonic");
}
state.nasalTuning = {};
const peakMagnitude = (samples, start, end) => {
  let peak = 0;
  for (let index = Math.max(0, start); index < Math.min(samples.length, end); index++) {
    peak = Math.max(peak, Math.abs(samples[index]));
  }
  return peak;
};
const naturalMiTuning = {
  closure_position: 0.863,
  closure_area_cm2: 0.015,
  closure_width: 0.16,
  velopharyngeal_opening: 1,
  nasal_path_gain: 0.35,
  branch_damping: 0.59,
  hold_duration_ms: 45,
  coarticulation_lead_ms: 22,
  transition_ms: 19,
  attack_fade_ms: 15,
};
state.nasalTuning = { m: naturalMiTuning };
const naturalMiFaded = synthesizeSyllable("mi");
state.nasalTuning = { m: { ...naturalMiTuning, attack_fade_ms: 0 } };
const naturalMiUnfaded = synthesizeSyllable("mi");
const firstTenMs = Math.round(naturalMiFaded.sampleRate * 0.01);
const steadyStart = Math.round(naturalMiFaded.sampleRate * 0.022);
const steadyEnd = Math.round(naturalMiFaded.sampleRate * 0.04);
const fadedAttackRatio = peakMagnitude(naturalMiFaded.samples, 0, firstTenMs)
  / Math.max(1e-8, windowRms(naturalMiFaded.samples, steadyStart, steadyEnd));
const unfadedAttackRatio = peakMagnitude(naturalMiUnfaded.samples, 0, firstTenMs)
  / Math.max(1e-8, windowRms(naturalMiUnfaded.samples, steadyStart, steadyEnd));
if (naturalMiFaded.nasal_model.timing.attack_fade_curve !== "half_cosine"
  || naturalMiFaded.nasal_model.timing.attack_fade_ms !== 15
  || fadedAttackRatio >= unfadedAttackRatio * 0.72) {
  throw new Error("Half-cosine nasal attack fade did not suppress the reproduced /mi/ onset transient");
}
console.log("Natural /mi/ attack diagnostics: " + JSON.stringify({
  faded_ratio: Number(fadedAttackRatio.toFixed(4)),
  unfaded_ratio: Number(unfadedAttackRatio.toFixed(4)),
}));
state.nasalTuning = {};
let nasalPlaceWaveDelta = 0;
for (let index = 0; index < Math.min(ma.samples.length, na.samples.length, 4096); index++) {
  nasalPlaceWaveDelta += Math.abs(ma.samples[index] - na.samples[index]);
}
if (nasalPlaceWaveDelta / 4096 < 0.001) {
  throw new Error("Bilabial and alveolar nasal targets produced indistinguishable waveforms");
}
const normalizedLogSpectrum = (samples, start, length, sampleRate) => {
  const levels = [];
  for (let frequencyHz = 200; frequencyHz <= 3000; frequencyHz += 100) {
    let real = 0;
    let imaginary = 0;
    for (let index = 0; index < length; index++) {
      const window = 0.5 - 0.5 * Math.cos(2 * Math.PI * index / Math.max(1, length - 1));
      const phase = 2 * Math.PI * frequencyHz * index / sampleRate;
      const sample = samples[start + index] ?? 0;
      real += sample * window * Math.cos(phase);
      imaginary -= sample * window * Math.sin(phase);
    }
    levels.push(20 * Math.log10(Math.max(1e-8, Math.hypot(real, imaginary))));
  }
  const peak = Math.max(...levels);
  return levels.map((level) => level - peak);
};
const meanSpectrumDistanceDb = (left, right) => left.reduce(
  (sum, level, index) => sum + Math.abs(level - right[index]),
  0
) / Math.max(1, left.length);
const nasalSpectrumLength = 1024;
const nasalHoldStart = Math.round(PREVIEW_SAMPLE_RATE * 0.015);
const maHoldSpectrum = normalizedLogSpectrum(ma.samples, nasalHoldStart, nasalSpectrumLength, PREVIEW_SAMPLE_RATE);
const naHoldSpectrum = normalizedLogSpectrum(na.samples, nasalHoldStart, nasalSpectrumLength, PREVIEW_SAMPLE_RATE);
const maReleaseStart = Math.round(ma.nasal_model.timing.oral_release_ms * PREVIEW_SAMPLE_RATE / 1000);
const naReleaseStart = Math.round(na.nasal_model.timing.oral_release_ms * PREVIEW_SAMPLE_RATE / 1000);
const maReleaseSpectrum = normalizedLogSpectrum(ma.samples, maReleaseStart, nasalSpectrumLength, PREVIEW_SAMPLE_RATE);
const naReleaseSpectrum = normalizedLogSpectrum(na.samples, naReleaseStart, nasalSpectrumLength, PREVIEW_SAMPLE_RATE);
const nasalHoldSpectrumDistanceDb = meanSpectrumDistanceDb(maHoldSpectrum, naHoldSpectrum);
const nasalReleaseSpectrumDistanceDb = meanSpectrumDistanceDb(maReleaseSpectrum, naReleaseSpectrum);
console.log("Nasal place spectrum diagnostics: " + JSON.stringify({
  hold_distance_db: Number(nasalHoldSpectrumDistanceDb.toFixed(3)),
  release_distance_db: Number(nasalReleaseSpectrumDistanceDb.toFixed(3)),
  n_place_cue_ms: na.nasal_model.timing.place_cue_peak_ms,
}));
if (nasalReleaseSpectrumDistanceDb < 1.5
  || nasalReleaseSpectrumDistanceDb <= nasalHoldSpectrumDistanceDb * 1.08) {
  throw new Error("The derived alveolar release did not create a distinct m/n transition spectrum");
}
state.nasalTuning = {
  m: {
    ...normalizedNasalTuning("m"),
    velopharyngeal_opening: 0.34,
    nasal_path_gain: 0.42,
    coarticulation_lead_ms: 17,
    attack_fade_ms: 23,
  },
};
const tunedMa = synthesizeSyllable("ma");
const untunedMa = synthesizeSyllable("ma", { manualTuning: false });
let nasalTuningWaveDelta = 0;
for (let index = 0; index < Math.min(tunedMa.samples.length, untunedMa.samples.length, 4096); index++) {
  nasalTuningWaveDelta += Math.abs(tunedMa.samples[index] - untunedMa.samples[index]);
}
if (nasalTuningWaveDelta / 4096 < 0.001) {
  throw new Error("Nasal A/B baseline did not bypass manual tuning or tuning did not affect synthesis");
}
state.nasalEvaluationLog = [{
  id: "test-ma",
  created_at: "2026-07-18T00:00:00.000Z",
  token: "ma",
  nasal_class: "m",
  nasal_clarity: 4,
  transition_quality: 5,
  note: "nasal transition check",
  tuning: normalizedNasalTuning("m"),
}];
const nasalCalibrationExport = buildExport();
if (nasalCalibrationExport.nasal_articulation_tuning?.schema_version !== "nasal_articulation_tuning_0.4"
  || nasalCalibrationExport.nasal_articulation_tuning?.profiles?.m?.velopharyngeal_opening !== 0.34
  || nasalCalibrationExport.nasal_auditory_evaluation_log?.[0]?.transition_quality !== 5
  || normalizeLoadedNasalTuning(nasalCalibrationExport.nasal_articulation_tuning).m?.nasal_path_gain !== 0.42
  || normalizeLoadedNasalTuning(nasalCalibrationExport.nasal_articulation_tuning).m?.coarticulation_lead_ms !== 17
  || normalizeLoadedNasalTuning(nasalCalibrationExport.nasal_articulation_tuning).m?.attack_fade_ms !== 23
  || normalizeNasalEvaluationLog(nasalCalibrationExport.nasal_auditory_evaluation_log)[0]?.note !== "nasal transition check") {
  throw new Error("Nasal tuning or auditory-evaluation records did not survive profile serialization");
}
state.nasalTuning = {};
state.nasalEvaluationLog = [];
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
state.constraints.pharyngeal_length_scale.center = 1.2;
const elongatedPharyngealGeometry = buildVocalTractGeometry();
state.constraints.pharyngeal_length_scale.center = 1;
if (elongatedPharyngealGeometry.region_summary.pharyngeal.length_cm <= neutralGeometry.region_summary.pharyngeal.length_cm) {
  throw new Error("Pharyngeal-length scale did not reallocate 2.5D tract length to the pharyngeal region");
}
if (elongatedPharyngealGeometry.cross_section_model.pharyngeal_length_scale !== 1.2) {
  throw new Error("Pharyngeal-length scale was not recorded in 2.5D geometry metadata");
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
if ("global_coupling" in audio.side_branch_loss_model.controls) throw new Error("Retired global side-branch coupling remains in synthesis metadata");
if (Math.abs(audio.derived_f0_hz - currentDerivedF0(state.constraints)) > 0.0001) throw new Error("Synthesized F0 is not derived from physical controls");
if (audio.body_resonance_model?.frequency_hz !== 210 || audio.body_resonance_model?.gain_db !== 4
  || audio.body_resonance_model?.coupling !== 0.25 || audio.body_resonance_model?.topology !== "parallel_wet_dry_branch") {
  throw new Error("Body-resonance frequency, gain, and coupling are not independent branch parameters");
}
if (!audio.respiratory_drive || Math.abs(audio.respiratory_drive.effective_support - 1) > 0.001) {
  throw new Error("Respiratory physiology was not connected to source drive");
}
if (bad) throw new Error("Tube synthesis produced non-finite samples");
if (max < 0.01) throw new Error("Tube synthesis produced near-silence");
const originalSpringForF0 = state.constraints.vocal_fold_spring_constant.center;
state.constraints.vocal_fold_spring_constant.center = 1.21;
const raisedF0Audio = synthesizeVowel("a");
state.constraints.vocal_fold_spring_constant.center = originalSpringForF0;
if (raisedF0Audio.derived_f0_hz <= audio.derived_f0_hz * 1.08) {
  throw new Error("Vocal-fold spring constant did not raise derived F0");
}
const respiratorySnapshot = {
  vc: state.constraints.predicted_vc_l.center,
  fvc: state.constraints.predicted_fvc_l.center,
  fev1: state.constraints.predicted_fev1_l.center,
  pef: state.constraints.predicted_pef_l_s.center,
  ventilation: state.constraints.maximum_ventilation_l_min.center,
  ventilationOverride: state.constraints.maximum_ventilation_l_min.user_override,
  pressure: state.constraints.maximum_respiratory_pressure_pa.center,
  support: state.constraints.respiratory_support.center,
};
state.constraints.predicted_vc_l.center *= 0.72;
state.constraints.predicted_fvc_l.center *= 0.72;
state.constraints.predicted_fev1_l.center *= 0.68;
state.constraints.predicted_pef_l_s.center *= 0.68;
state.constraints.maximum_ventilation_l_min.center = 65;
state.constraints.maximum_ventilation_l_min.user_override = true;
state.constraints.maximum_respiratory_pressure_pa.center = 700;
state.constraints.respiratory_support.center = 0.82;
const reducedRespiratoryAudio = synthesizeVowel("a");
state.constraints.predicted_vc_l.center = respiratorySnapshot.vc;
state.constraints.predicted_fvc_l.center = respiratorySnapshot.fvc;
state.constraints.predicted_fev1_l.center = respiratorySnapshot.fev1;
state.constraints.predicted_pef_l_s.center = respiratorySnapshot.pef;
state.constraints.maximum_ventilation_l_min.center = respiratorySnapshot.ventilation;
if (respiratorySnapshot.ventilationOverride) state.constraints.maximum_ventilation_l_min.user_override = respiratorySnapshot.ventilationOverride;
else delete state.constraints.maximum_ventilation_l_min.user_override;
state.constraints.maximum_respiratory_pressure_pa.center = respiratorySnapshot.pressure;
state.constraints.respiratory_support.center = respiratorySnapshot.support;
if (reducedRespiratoryAudio.respiratory_drive.effective_support >= audio.respiratory_drive.effective_support
  || reducedRespiratoryAudio.respiratory_drive.effective_pressure_pa >= audio.respiratory_drive.effective_pressure_pa
  || reducedRespiratoryAudio.samples.length >= audio.samples.length) {
  throw new Error("VC/FVC/FEV1/PEF/ventilation/pressure controls did not reduce respiratory source capacity");
}
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

const originalSinusCoupling = state.constraints.sinus_coupling.center;
const originalVpCoupling = state.constraints.velopharyngeal_loss_coupling.center;
const originalPiriformCoupling = state.constraints.piriform_fossa_loss_coupling.center;
state.constraints.sinus_coupling.center = 0.78;
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
state.constraints.sinus_coupling.center = originalSinusCoupling;
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

state.performanceRangeOverrides = {
  respiratory_support: { min: 0.72, max: 1.28, basis: "test range", user_override: true },
};
applyPerformanceRangeOverrides();
state.constraints.body_resonance_frequency_hz.center = 245;
state.constraintOverrides.body_resonance_frequency_hz = 245;
state.constraintOverrides.f0_mean_hz = 123;
const rangeExport = buildExport();
if (rangeExport.schema_version !== "character_voice_designer_0.1") {
  throw new Error("Export schema was not upgraded for the range-semantics revision");
}
if (rangeExport.app_version !== "0.1" || rangeExport.app !== "CharacterVoiceDesigner") {
  throw new Error("Export metadata is not marked as CharacterVoiceDesigner 0.1");
}
if (rangeExport.performance_range_overrides?.respiratory_support?.min !== 0.72
  || state.constraints.respiratory_support.constraint_range?.max !== 1.28) {
  throw new Error("PerformanceControlRange override was not exported with its compatibility alias");
}
if (rangeExport.voice_constraints.body_resonance_frequency_hz.center !== 245
  || rangeExport.constraint_overrides.body_resonance_frequency_hz !== 245) {
  throw new Error("Edited body-resonance frequency was not persisted");
}
if ("f0_mean_hz" in rangeExport.constraint_overrides) throw new Error("Read-only derived F0 was exported as an override");
state.performanceRangeOverrides = {};
state.constraints.body_resonance_frequency_hz.center = 210;
delete state.constraintOverrides.body_resonance_frequency_hz;
delete state.constraintOverrides.f0_mean_hz;

applyProfile({
  schema_version: "character_voice_lab_mvp_0.1",
  inputs: {
    age: 17,
    sex_reference_class: "female",
    height_cm: 158,
    weight_kg: 47,
    preview_synthesis_backend: "hybrid",
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
    side_branch_loss_coupling: { center: 0.5 },
    hybrid_side_branch_strength: { center: 0.65 },
    hybrid_formant_anchor: { center: 0.78 },
    hybrid_tube_texture_mix: { center: 0.12 },
  },
  performance_range_overrides: {
    hybrid_tube_texture_mix: { min: 0, max: 0.2 },
  },
});
if (els.referenceImageStyleInput.value !== "illustration") {
  throw new Error("Legacy profile migration did not default the reference-image style to illustration");
}
if (Number(els.globalImageWeight.value) !== 0.7 || state.appliedImageWeight !== 0.7) {
  throw new Error("Legacy profile migration did not use the deterministic default image contribution");
}
if (els.phoneticTargetProfileInput.value !== "ja_JP_standard_neutral_aggregate_0_1") {
  throw new Error("Legacy profile migration did not choose the Japanese aggregate phonetic target for Japanese primary language");
}
const migratedExport = buildExport();
for (const key of ["smoking_history", "exercise_habit", "diet_habit", "respiratory_history"]) {
  if (key in migratedExport.inputs) throw new Error("Sensitive lifestyle/history input remains exported: " + key);
}
for (const key of ["inflammation_index", "airway_lumen_narrowing", "pediatric_vocal_cord_to_carina_cm", "pediatric_safe_airway_insertion_cm"]) {
  if (key in migratedExport.voice_constraints) throw new Error("Retired clinical constraint remains exported: " + key);
}
if (migratedExport.inputs.phonetic_target_profile !== "ja_JP_standard_neutral_aggregate_0_1") {
  throw new Error("Export did not preserve the active phonetic target profile");
}
if (migratedExport.phonetic_target?.vowels?.u?.target_formants_hz?.[1] <= migratedExport.phonetic_target?.vowels?.o?.target_formants_hz?.[1]) {
  throw new Error("Export did not preserve Japanese /u/-/o/ target separation");
}
if (migratedExport.inputs.preview_synthesis_backend !== "tube") {
  throw new Error("Legacy preview backend was not migrated to the sole tube backend");
}
for (const key of ["hybrid_side_branch_strength", "hybrid_formant_anchor", "hybrid_tube_texture_mix", "tension_response_curve", "glottal_closure", "side_branch_loss_coupling"]) {
  if (key in state.constraints || key in migratedExport.voice_constraints || key in migratedExport.performance_range_overrides) {
    throw new Error(\`Retired hybrid control survived profile migration: \${key}\`);
  }
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
  "velopharyngeal_loss_coupling",
  "piriform_fossa_loss_coupling",
  "piriform_fossa_frequency_hz",
  "nasal_branch_damping",
  "palatal_vault_scale",
  "lip_aperture_aspect_scale",
  "tongue_groove_capacity",
  "tongue_dorsum_range_utilization",
  "labial_transverse_range_utilization",
]) {
  if (!Number.isFinite(state.constraints[key]?.center)) throw new Error(\`Missing migrated synthesis constraint: \${key}\`);
}
if (Math.abs(state.constraints.sinus_coupling.center - 0.45) > 0.001
  || Math.abs(state.constraints.velopharyngeal_loss_coupling.center - 0.35) > 0.001
  || Math.abs(state.constraints.piriform_fossa_loss_coupling.center - 0.275) > 0.001) {
  throw new Error("Legacy global side-branch coupling was not distributed to branch-local controls");
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

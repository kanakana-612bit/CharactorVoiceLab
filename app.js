const state = {
  mode: "body",
  images: { body: null, face: null, profile: null },
  imageNames: { body: null, face: null, profile: null },
  imageFiles: { body: null, face: null, profile: null },
  landmarks: {
    body: {
      head_top: { x: 360, y: 80 },
      chin: { x: 360, y: 132 },
      left_shoulder: { x: 260, y: 170 },
      right_shoulder: { x: 460, y: 170 },
      left_hip: { x: 300, y: 330 },
      right_hip: { x: 420, y: 330 },
      left_foot: { x: 320, y: 488 },
      right_foot: { x: 400, y: 488 },
    },
    face: {
      face_top: { x: 360, y: 94 },
      chin: { x: 360, y: 430 },
      nose: { x: 360, y: 276 },
      mouth_left: { x: 320, y: 332 },
      mouth_right: { x: 400, y: 332 },
      pupil_left: { x: 315, y: 212 },
      pupil_right: { x: 405, y: 212 },
      jaw_left: { x: 286, y: 365 },
      jaw_right: { x: 434, y: 365 },
      neck_left: { x: 306, y: 468 },
      neck_right: { x: 414, y: 468 },
    },
    profile: {
      profile_vertex: { x: 350, y: 86 },
      profile_occiput: { x: 258, y: 184 },
      profile_nasion: { x: 404, y: 214 },
      profile_nose_tip: { x: 454, y: 250 },
      profile_subnasale: { x: 426, y: 292 },
      profile_lip: { x: 424, y: 326 },
      profile_ans: { x: 405, y: 294 },
      profile_pns: { x: 335, y: 292 },
      profile_soft_palate_hinge: { x: 336, y: 294 },
      profile_velum_tip: { x: 326, y: 326 },
      profile_posterior_pharyngeal_wall: { x: 302, y: 314 },
      profile_chin: { x: 392, y: 430 },
      profile_menton: { x: 392, y: 438 },
      profile_jaw_angle: { x: 318, y: 374 },
      profile_tragion: { x: 315, y: 246 },
      profile_hyoid: { x: 366, y: 404 },
      profile_larynx: { x: 350, y: 455 },
      profile_neck_front: { x: 382, y: 486 },
      profile_neck_back: { x: 278, y: 486 },
    },
  },
  features: {},
  constraints: {},
  constraintOverrides: {},
  performanceRangeOverrides: {},
  extractionReports: {},
  priorResolution: {},
  calibration: null,
  vocalTractGeometry: null,
  activeTab: "setupTab",
  appliedImageWeight: null,
  analysisRevision: 0,
  drag: null,
  cursor: { point: null, target: null },
  profileDrag: null,
  profileCursor: { point: null, target: null },
  lastWav: null,
  vowelAreaTuning: {},
  vowelWidthTuning: {},
  tractEditMode: "area",
  areaTuningDrag: null,
  selectedTractTuningHandle: null,
  selectedSyllableToken: "a",
  auditoryEvaluationLog: [],
  nasalTuning: {},
  nasalEvaluationLog: [],
  nasalPreviewDiagnostics: {},
  nasalProfileDrag: null,
  voiceControlOverrides: {},
  ttsCaptionManual: false,
  ttsResultBlob: null,
  ttsResultUrl: null,
  audioCppModels: [],
  voiceIdentityResources: null,
  activeCompiledIdentityId: null,
  activeCompiledIdentity: null,
  lastIdentityEvaluation: null,
  experimentResources: null,
  experimentJobs: [],
  activeExperimentTool: "runtime_observation",
  activeExperimentJobId: null,
  experimentPollTimer: null,
  evaluationInputIds: new Set(),
  evaluationReferenceResources: [],
  voiceIdentityCalibrationIds: new Set(),
  resourcePreviewAudio: null,
  resourcePreviewButton: null,
  resourcePreviewUrl: null,
  selectedIdentitySpeakerId: null,
};

const referenceData = window.CVL_REFERENCE;
const priorResolver = window.CVL_PRIOR_RESOLVER;
const projectPackage = window.CVL_PROJECT_PACKAGE;
const landmarkSystem = window.CVL_LANDMARKS;
const voiceControlProfile = window.CVD_PROFILE;
const labels = landmarkSystem.labels;
const featureDefs = referenceData.anthropometricFeaturePriors;
const APP_VERSION = "0.1";
const STANDARD_TTS_INFERENCE_STEPS = 20;
const MAX_EVALUATION_RESOURCES = 16;
const MAX_CALIBRATION_RESOURCES = 16;
const GESTURE_EXECUTION_INPUT_MIN = 0.35;
const GESTURE_EXECUTION_INPUT_MAX = 1.35;
const LEGACY_GESTURE_EXECUTION_EFFECTIVE_MAX = 1.45;
const GESTURE_EXECUTION_EFFECTIVE_MAX = 1.9;
const ILLUSTRATION_GESTURE_EXECUTION_RESPONSE = Object.freeze({
  input_center: 1,
  effective_center: 1.45,
  response_offset: 0.25,
  response_gain: 1.2,
  effective_min: 0.25,
  effective_max: GESTURE_EXECUTION_EFFECTIVE_MAX,
});
const REALISTIC_GESTURE_EXECUTION_RESPONSE = Object.freeze({
  input_center: 1,
  effective_center: 1,
  response_offset: 0,
  response_gain: 1,
  effective_min: 0.2,
  effective_max: GESTURE_EXECUTION_EFFECTIVE_MAX,
});
const profileArticulationLandmarks = new Set([
  "profile_ans",
  "profile_pns",
  "profile_soft_palate_hinge",
  "profile_velum_tip",
  "profile_posterior_pharyngeal_wall",
  "profile_menton",
]);

const vocalTractProfileControls = [
  { key: "vocal_tract_length_cm", label: "声道長", min: 11, max: 20, step: 0.1, unit: "cm" },
  { key: "mouth_width_relaxed_cm", label: "推定安静口裂幅", min: 2.5, max: 7.5, step: 0.01, unit: "cm" },
  { key: "pharyngeal_length_scale", label: "咽頭長スケール", min: 0.75, max: 1.25, step: 0.01, unit: "x" },
  { key: "pharyngeal_area_scale", label: "咽頭断面スケール", min: 0.7, max: 1.3, step: 0.01, unit: "x" },
  { key: "tracheal_transverse_design_cm", label: "気管横径（設計）", min: 1, max: 2.5, step: 0.01, unit: "cm" },
  { key: "nasal_cavity_volume_cm3", label: "鼻腔体積", min: 8, max: 35, step: 0.1, unit: "cm3" },
  { key: "paranasal_sinus_volume_cm3", label: "副鼻腔容積", min: 6, max: 70, step: 0.5, unit: "cm3" },
  { key: "palatal_vault_scale", label: "口蓋高スケール", min: 0.7, max: 1.35, step: 0.01, unit: "x" },
  { key: "lip_aperture_aspect_scale", label: "口唇開口縦横比", min: 0.65, max: 1.45, step: 0.01, unit: "x" },
];

const glottalPhysiologyControls = [
  { key: "f0_mean_hz", label: "推定基本周波数（導出値）", min: 60, max: 350, step: 1, unit: "Hz", readOnly: true },
  { key: "vocal_fold_spring_constant", label: "声帯ばね定数", min: 0.55, max: 1.65, step: 0.01, unit: "x" },
  { key: "baseline_muscle_tension", label: "基礎筋緊張", min: 0.35, max: 1.6, step: 0.01, unit: "x" },
  { key: "glottal_open_quotient", label: "声門開放率", min: 0.35, max: 0.9, step: 0.01, unit: "" },
  { key: "glottal_speed_quotient", label: "声門速度比", min: 0.8, max: 2.8, step: 0.01, unit: "" },
  { key: "glottal_return_phase", label: "声門復帰相", min: 0.04, max: 0.32, step: 0.01, unit: "cycle" },
];

const trunkPhysiologyControls = [
  { key: "predicted_vc_l", label: "推定肺活量 VC", min: 0.5, max: 8, step: 0.01, unit: "L" },
  { key: "predicted_fvc_l", label: "推定努力性肺活量 FVC", min: 0.5, max: 8, step: 0.01, unit: "L" },
  { key: "predicted_fev1_l", label: "推定1秒量 FEV1", min: 0.5, max: 7, step: 0.01, unit: "L" },
  { key: "predicted_pef_l_s", label: "推定最大呼気流量 PEF", min: 1, max: 14, step: 0.01, unit: "L/s" },
  { key: "maximum_ventilation_l_min", label: "最大換気量", min: 40, max: 180, step: 1, unit: "L/min" },
  { key: "thoracic_volume_l", label: "胸腔容積", min: 2, max: 9, step: 0.1, unit: "L" },
  { key: "abdominal_volume_l", label: "腹腔容積", min: 2, max: 12, step: 0.1, unit: "L" },
  { key: "maximum_respiratory_pressure_pa", label: "推定最大呼吸圧", min: 200, max: 3000, step: 10, unit: "Pa" },
  { key: "respiratory_support", label: "発話時呼吸支持利用率", min: 0.55, max: 1.45, step: 0.01, unit: "x" },
];

const executionControls = [
  { key: "articulatory_range_utilization", label: "Gesture execution", min: GESTURE_EXECUTION_INPUT_MIN, max: GESTURE_EXECUTION_INPUT_MAX, step: 0.01, unit: "" },
  { key: "tongue_dorsum_range_utilization", label: "Tongue dorsum range availability", min: 0.35, max: 1.45, step: 0.01, unit: "" },
  { key: "labial_transverse_range_utilization", label: "Labial transverse range availability", min: 0.35, max: 1.45, step: 0.01, unit: "" },
  { key: "tongue_groove_capacity", label: "Tongue groove range availability", min: 0.35, max: 1.45, step: 0.01, unit: "" },
  { key: "motor_control_precision", label: "Motor control precision", min: 0.25, max: 1.25, step: 0.01, unit: "" },
  { key: "coarticulation_strength", label: "Coarticulation strength", min: 0, max: 1, step: 0.01, unit: "" },
  { key: "motor_control_maturity", label: "Motor control maturity", min: 0.25, max: 1.15, step: 0.01, unit: "" },
  { key: "phonological_contrast_maturity", label: "Phonological contrast maturity", min: 0.25, max: 1.15, step: 0.01, unit: "" },
];

const vowelExecutionControls = executionControls.filter((control) => [
  "articulatory_range_utilization",
  "tongue_dorsum_range_utilization",
  "labial_transverse_range_utilization",
  "tongue_groove_capacity",
].includes(control.key));

const consonantExecutionControls = executionControls.filter((control) => [
  "motor_control_precision",
  "coarticulation_strength",
  "motor_control_maturity",
  "phonological_contrast_maturity",
].includes(control.key));

const advancedAcousticControls = [
  { key: "glottal_spectral_tilt_db", label: "声門源スペクトル傾斜", min: 4, max: 28, step: 0.1, unit: "dB" },
  { key: "glottal_breathiness", label: "声門源気息成分", min: 0, max: 0.6, step: 0.01, unit: "" },
  { key: "glottal_volume_velocity_drive", label: "声門体積速度入力", min: 0, max: 1, step: 0.01, unit: "" },
  { key: "glottal_flow_smoothing", label: "声門流平滑", min: 0, max: 0.9, step: 0.01, unit: "" },
  { key: "glottal_flow_inertance", label: "声門流慣性", min: 0, max: 0.55, step: 0.01, unit: "" },
  { key: "sinus_coupling", label: "副鼻腔音響結合", min: 0, max: 1, step: 0.01, unit: "" },
  { key: "body_resonance_frequency_hz", label: "身体反響周波数", min: 120, max: 320, step: 1, unit: "Hz" },
  { key: "body_resonance_gain_db", label: "身体反響枝ピーク利得", min: 0, max: 10, step: 0.1, unit: "dB" },
  { key: "body_resonance_coupling", label: "身体反響結合", min: 0, max: 1, step: 0.01, unit: "" },
  { key: "vocal_tract_wall_loss", label: "声道壁損失", min: 0, max: 0.08, step: 0.001, unit: "" },
  { key: "vocal_tract_viscothermal_loss", label: "粘性・熱損失", min: 0, max: 0.06, step: 0.001, unit: "" },
  { key: "vocal_tract_high_frequency_damping", label: "高域減衰", min: 0, max: 0.85, step: 0.01, unit: "" },
  { key: "vocal_tract_wall_compliance", label: "声道壁コンプライアンス", min: 0, max: 0.7, step: 0.01, unit: "" },
  { key: "vocal_tract_resonance_broadening", label: "共鳴帯域拡張", min: 0, max: 0.85, step: 0.01, unit: "" },
  { key: "lip_radiation_smoothing", label: "口唇放射平滑", min: 0, max: 0.85, step: 0.01, unit: "" },
  { key: "velopharyngeal_loss_coupling", label: "鼻咽腔側枝", min: 0, max: 0.75, step: 0.01, unit: "" },
  { key: "piriform_fossa_loss_coupling", label: "梨状陥凹側枝", min: 0, max: 0.65, step: 0.01, unit: "" },
  { key: "piriform_fossa_frequency_hz", label: "梨状陥凹反共振", min: 2200, max: 5200, step: 10, unit: "Hz" },
  { key: "nasal_branch_damping", label: "鼻腔側枝減衰", min: 0.25, max: 1.4, step: 0.01, unit: "" },
];

const retiredConstraintKeys = new Set([
  "hybrid_side_branch_strength",
  "hybrid_formant_anchor",
  "hybrid_tube_texture_mix",
  "tension_response_curve",
  "glottal_closure",
  "side_branch_loss_coupling",
  "lifestyle_respiratory_modifier",
  "inflammation_index",
  "airway_lumen_narrowing",
  "pediatric_vocal_cord_to_carina_cm",
  "pediatric_safe_airway_insertion_cm",
]);

const readOnlyDerivedConstraintKeys = new Set(["f0_mean_hz"]);

const performanceRangeGroups = {
  glottal: [
    glottalPhysiologyControls.find((control) => control.key === "vocal_fold_spring_constant"),
    glottalPhysiologyControls.find((control) => control.key === "baseline_muscle_tension"),
    glottalPhysiologyControls.find((control) => control.key === "glottal_open_quotient"),
    glottalPhysiologyControls.find((control) => control.key === "glottal_speed_quotient"),
    advancedAcousticControls.find((control) => control.key === "glottal_breathiness"),
  ],
  vocalTract: [
    vocalTractProfileControls.find((control) => control.key === "mouth_width_relaxed_cm"),
    executionControls.find((control) => control.key === "tongue_dorsum_range_utilization"),
    executionControls.find((control) => control.key === "labial_transverse_range_utilization"),
    executionControls.find((control) => control.key === "tongue_groove_capacity"),
  ],
  trunk: [trunkPhysiologyControls.find((control) => control.key === "respiratory_support")],
};

const els = {
  projectTitleInput: document.getElementById("projectTitleInput"),
  dataSourceInput: document.getElementById("dataSourceInput"),
  playSampleButton: document.getElementById("playSampleButton"),
  floatingPreviewDock: document.getElementById("floatingPreviewDock"),
  tabButtons: Array.from(document.querySelectorAll(".tab-button")),
  tabPanels: Array.from(document.querySelectorAll(".tab-panel")),
  bodyImageInput: document.getElementById("bodyImageInput"),
  faceImageInput: document.getElementById("faceImageInput"),
  profileImageInput: document.getElementById("profileImageInput"),
  ageInput: document.getElementById("ageInput"),
  sexInput: document.getElementById("sexInput"),
  heightInput: document.getElementById("heightInput"),
  weightInput: document.getElementById("weightInput"),
  bodyFatInput: document.getElementById("bodyFatInput"),
  primaryLanguageInput: document.getElementById("primaryLanguageInput"),
  phoneticTargetProfileInput: document.getElementById("phoneticTargetProfileInput"),
  populationInput: document.getElementById("populationInput"),
  referenceImageStyleInput: document.getElementById("referenceImageStyleInput"),
  computedBmi: document.getElementById("computedBmi"),
  computedBmiClass: document.getElementById("computedBmiClass"),
  referenceBmiMedian: document.getElementById("referenceBmiMedian"),
  referenceBmiNote: document.getElementById("referenceBmiNote"),
  bmiDelta: document.getElementById("bmiDelta"),
  bmiReferenceSource: document.getElementById("bmiReferenceSource"),
  bodyFatGuideSummary: document.getElementById("bodyFatGuideSummary"),
  bodyFatGuideBadges: document.getElementById("bodyFatGuideBadges"),
  bodyFatGuideTable: document.getElementById("bodyFatGuideTable"),
  bodyFatGuideNote: document.getElementById("bodyFatGuideNote"),
  compositionGuideMount: document.getElementById("compositionGuideMount"),
  vowelExecutionSliders: document.getElementById("vowelExecutionSliders"),
  consonantExecutionSliders: document.getElementById("consonantExecutionSliders"),
  vowelCalibrationMount: document.getElementById("vowelCalibrationMount"),
  consonantCalibrationMount: document.getElementById("consonantCalibrationMount"),
  globalImageWeight: document.getElementById("globalImageWeight"),
  globalImageWeightValue: document.getElementById("globalImageWeightValue"),
  recalculateBtn: document.getElementById("recalculateBtn"),
  detailRecalculationStatus: document.getElementById("detailRecalculationStatus"),
  analyzeBtn: document.getElementById("analyzeBtn"),
  saveProjectBtn: document.getElementById("saveProjectBtn"),
  loadProjectBtn: document.getElementById("loadProjectBtn"),
  loadProjectInput: document.getElementById("loadProjectInput"),
  saveJsonBtn: document.getElementById("saveJsonBtn"),
  extractionStatus: document.getElementById("extractionStatus"),
  bodyModeBtn: document.getElementById("bodyModeBtn"),
  faceModeBtn: document.getElementById("faceModeBtn"),
  landmarkSelect: document.getElementById("landmarkSelect"),
  profileLandmarkSelect: document.getElementById("profileLandmarkSelect"),
  profileDirectionInput: document.getElementById("profileDirectionInput"),
  bodyShowLandmarks: document.getElementById("bodyShowLandmarks"),
  faceShowLandmarks: document.getElementById("faceShowLandmarks"),
  profileShowBaseLandmarks: document.getElementById("profileShowBaseLandmarks"),
  profileShowArticulationLandmarks: document.getElementById("profileShowArticulationLandmarks"),
  profileShowVocalTract: document.getElementById("profileShowVocalTract"),
  bodyImageCanvas: document.getElementById("bodyImageCanvas"),
  bodyModelCanvas: document.getElementById("bodyModelCanvas"),
  faceImageCanvas: document.getElementById("faceImageCanvas"),
  faceModelCanvas: document.getElementById("faceModelCanvas"),
  profileImageCanvas: document.getElementById("profileImageCanvas"),
  vocalTractCanvas: document.getElementById("vocalTractCanvas"),
  tractProfileCanvas: document.getElementById("tractProfileCanvas"),
  tractCrossSectionCanvas: document.getElementById("tractCrossSectionCanvas"),
  tractRegionSummary: document.getElementById("tractRegionSummary"),
  vocalTractProfileSliders: document.getElementById("vocalTractProfileSliders"),
  glottalPhysiologySliders: document.getElementById("glottalPhysiologySliders"),
  trunkPhysiologySliders: document.getElementById("trunkPhysiologySliders"),
  advancedAcousticSliders: document.getElementById("advancedAcousticSliders"),
  glottalPerformanceRanges: document.getElementById("glottalPerformanceRanges"),
  vocalTractPerformanceRanges: document.getElementById("vocalTractPerformanceRanges"),
  trunkPerformanceRanges: document.getElementById("trunkPerformanceRanges"),
  featureTable: document.getElementById("featureTable"),
  calibrationSummary: document.getElementById("calibrationSummary"),
  landmarkReferenceTable: document.getElementById("landmarkReferenceTable"),
  landmarkHintPanel: document.getElementById("landmarkHintPanel"),
  landmarkHintTitle: document.getElementById("landmarkHintTitle"),
  landmarkHintDefinition: document.getElementById("landmarkHintDefinition"),
  landmarkHintRole: document.getElementById("landmarkHintRole"),
  constraintOutput: document.getElementById("constraintOutput"),
  publicationPolicyDisclosure: document.getElementById("publicationPolicyDisclosure"),
  publicationPolicyScope: document.getElementById("publicationPolicyScope"),
  publicationPolicyExclusions: document.getElementById("publicationPolicyExclusions"),
  referenceSourceTable: document.getElementById("referenceSourceTable"),
  vowelSelect: document.getElementById("vowelSelect"),
  saveWavBtn: document.getElementById("saveWavBtn"),
  resetAreaTuningBtn: document.getElementById("resetAreaTuningBtn"),
  tractEditStatus: document.getElementById("tractEditStatus"),
  editAreaModeBtn: document.getElementById("editAreaModeBtn"),
  editWidthModeBtn: document.getElementById("editWidthModeBtn"),
  nudgeTractDownBtn: document.getElementById("nudgeTractDownBtn"),
  nudgeTractUpBtn: document.getElementById("nudgeTractUpBtn"),
  tractSelectedPointValue: document.getElementById("tractSelectedPointValue"),
  playUntunedVowelBtn: document.getElementById("playUntunedVowelBtn"),
  playTunedVowelBtn: document.getElementById("playTunedVowelBtn"),
  phonemeClarityInput: document.getElementById("phonemeClarityInput"),
  phonemeClarityValue: document.getElementById("phonemeClarityValue"),
  targetMatchInput: document.getElementById("targetMatchInput"),
  targetMatchValue: document.getElementById("targetMatchValue"),
  auditoryNoteInput: document.getElementById("auditoryNoteInput"),
  recordAuditoryEvaluationBtn: document.getElementById("recordAuditoryEvaluationBtn"),
  auditoryEvaluationVowel: document.getElementById("auditoryEvaluationVowel"),
  auditoryEvaluationHistory: document.getElementById("auditoryEvaluationHistory"),
  nasalTokenSelect: document.getElementById("nasalTokenSelect"),
  nasalCalibrationStatus: document.getElementById("nasalCalibrationStatus"),
  nasalProfileCanvas: document.getElementById("nasalProfileCanvas"),
  nasalParameterSummary: document.getElementById("nasalParameterSummary"),
  nasalClosurePositionInput: document.getElementById("nasalClosurePositionInput"),
  nasalClosurePositionValue: document.getElementById("nasalClosurePositionValue"),
  nasalClosureAreaInput: document.getElementById("nasalClosureAreaInput"),
  nasalClosureAreaValue: document.getElementById("nasalClosureAreaValue"),
  nasalClosureWidthInput: document.getElementById("nasalClosureWidthInput"),
  nasalClosureWidthValue: document.getElementById("nasalClosureWidthValue"),
  nasalVpOpeningInput: document.getElementById("nasalVpOpeningInput"),
  nasalVpOpeningValue: document.getElementById("nasalVpOpeningValue"),
  nasalPathGainInput: document.getElementById("nasalPathGainInput"),
  nasalPathGainLabel: document.getElementById("nasalPathGainLabel"),
  nasalPathGainValue: document.getElementById("nasalPathGainValue"),
  nasalDampingInput: document.getElementById("nasalDampingInput"),
  nasalDampingValue: document.getElementById("nasalDampingValue"),
  nasalDurationInput: document.getElementById("nasalDurationInput"),
  nasalDurationValue: document.getElementById("nasalDurationValue"),
  nasalCoarticulationLeadInput: document.getElementById("nasalCoarticulationLeadInput"),
  nasalCoarticulationLeadValue: document.getElementById("nasalCoarticulationLeadValue"),
  nasalTransitionInput: document.getElementById("nasalTransitionInput"),
  nasalTransitionValue: document.getElementById("nasalTransitionValue"),
  nasalAttackFadeInput: document.getElementById("nasalAttackFadeInput"),
  nasalAttackFadeValue: document.getElementById("nasalAttackFadeValue"),
  playUntunedNasalBtn: document.getElementById("playUntunedNasalBtn"),
  playTunedNasalBtn: document.getElementById("playTunedNasalBtn"),
  resetNasalTuningBtn: document.getElementById("resetNasalTuningBtn"),
  nasalClarityInput: document.getElementById("nasalClarityInput"),
  nasalClarityValue: document.getElementById("nasalClarityValue"),
  nasalTransitionRatingInput: document.getElementById("nasalTransitionRatingInput"),
  nasalTransitionRatingValue: document.getElementById("nasalTransitionRatingValue"),
  nasalNoteInput: document.getElementById("nasalNoteInput"),
  recordNasalEvaluationBtn: document.getElementById("recordNasalEvaluationBtn"),
  nasalEvaluationHistory: document.getElementById("nasalEvaluationHistory"),
  ttsOutputLanguageInput: document.getElementById("ttsOutputLanguageInput"),
  syllableSetInput: document.getElementById("syllableSetInput"),
  datasetPrefixInput: document.getElementById("datasetPrefixInput"),
  previewSyllableBtn: document.getElementById("previewSyllableBtn"),
  exportSyllableDatasetBtn: document.getElementById("exportSyllableDatasetBtn"),
  syllableSetSummary: document.getElementById("syllableSetSummary"),
  syllableTokenList: document.getElementById("syllableTokenList"),
  datasetExportStatus: document.getElementById("datasetExportStatus"),
  voiceControlSliders: document.getElementById("voiceControlSliders"),
  resetVoiceControlOverridesBtn: document.getElementById("resetVoiceControlOverridesBtn"),
  identityF0Summary: document.getElementById("identityF0Summary"),
  identityVtlSummary: document.getElementById("identityVtlSummary"),
  identityOverrideSummary: document.getElementById("identityOverrideSummary"),
  refreshTtsModelsBtn: document.getElementById("refreshTtsModelsBtn"),
  audioCppStatusDot: document.getElementById("audioCppStatusDot"),
  audioCppStatus: document.getElementById("audioCppStatus"),
  ttsModelSelect: document.getElementById("ttsModelSelect"),
  ttsSeedInput: document.getElementById("ttsSeedInput"),
  ttsCaptionGuidanceInput: document.getElementById("ttsCaptionGuidanceInput"),
  ttsF0CorrectionEnabled: document.getElementById("ttsF0CorrectionEnabled"),
  ttsF0CorrectionStrength: document.getElementById("ttsF0CorrectionStrength"),
  ttsF0CorrectionStrengthValue: document.getElementById("ttsF0CorrectionStrengthValue"),
  ttsF0CorrectionGuide: document.getElementById("ttsF0CorrectionGuide"),
  ttsCaptionInput: document.getElementById("ttsCaptionInput"),
  regenerateTtsCaptionBtn: document.getElementById("regenerateTtsCaptionBtn"),
  ttsDemoTextInput: document.getElementById("ttsDemoTextInput"),
  ttsRequestSummary: document.getElementById("ttsRequestSummary"),
  generateTtsDemoBtn: document.getElementById("generateTtsDemoBtn"),
  downloadTtsDemoBtn: document.getElementById("downloadTtsDemoBtn"),
  exportVoiceControlProfileBtn: document.getElementById("exportVoiceControlProfileBtn"),
  ttsDemoAudio: document.getElementById("ttsDemoAudio"),
  ttsDemoStatus: document.getElementById("ttsDemoStatus"),
  refreshVoiceIdentitiesBtn: document.getElementById("refreshVoiceIdentitiesBtn"),
  voiceIdentityNameInput: document.getElementById("voiceIdentityNameInput"),
  compiledVoiceIdentitySelect: document.getElementById("compiledVoiceIdentitySelect"),
  compileVoiceIdentityBtn: document.getElementById("compileVoiceIdentityBtn"),
  identitySpeakerSelect: document.getElementById("identitySpeakerSelect"),
  identitySpeakerUpload: document.getElementById("identitySpeakerUpload"),
  identitySpeakerStatus: document.getElementById("identitySpeakerStatus"),
  identityCompileStyleF0: document.getElementById("identityCompileStyleF0"),
  identityCompileStyleVtl: document.getElementById("identityCompileStyleVtl"),
  identityCompileStyleCfg: document.getElementById("identityCompileStyleCfg"),
  identityStyleSelect: document.getElementById("identityStyleSelect"),
  identityStyleStatus: document.getElementById("identityStyleStatus"),
  identityCalibrationList: document.getElementById("identityCalibrationList"),
  identityCalibrationUpload: document.getElementById("identityCalibrationUpload"),
  identityCalibrationStatus: document.getElementById("identityCalibrationStatus"),
  compiledIdentitySpeakerValue: document.getElementById("compiledIdentitySpeakerValue"),
  compiledIdentityCompatibilityValue: document.getElementById("compiledIdentityCompatibilityValue"),
  compiledIdentityCalibrationValue: document.getElementById("compiledIdentityCalibrationValue"),
  compiledIdentityPolicyValue: document.getElementById("compiledIdentityPolicyValue"),
  voiceIdentityCompileStatus: document.getElementById("voiceIdentityCompileStatus"),
  ttsIdentityEvaluation: document.getElementById("ttsIdentityEvaluation"),
  ttsIdentityEvaluationBadge: document.getElementById("ttsIdentityEvaluationBadge"),
  ttsIdentityEvaluationValues: document.getElementById("ttsIdentityEvaluationValues"),
  ttsIdentityEvaluationWarning: document.getElementById("ttsIdentityEvaluationWarning"),
  refreshExperimentsBtn: document.getElementById("refreshExperimentsBtn"),
  experimentToolButtons: Array.from(document.querySelectorAll(".experiment-tool-button")),
  experimentToolForms: Array.from(document.querySelectorAll(".experiment-tool-form")),
  experimentSpeakerUpload: document.getElementById("experimentSpeakerUpload"),
  runtimeObservationForm: document.getElementById("runtimeObservationForm"),
  experimentObservationSteps: document.getElementById("experimentObservationSteps"),
  experimentObservationSpeaker: document.getElementById("experimentObservationSpeaker"),
  speakerCompatibilityForm: document.getElementById("speakerCompatibilityForm"),
  experimentSpeakerEmbeddings: document.getElementById("experimentSpeakerEmbeddings"),
  experimentSpeakerTokens: document.getElementById("experimentSpeakerTokens"),
  experimentSpeakerSeed: document.getElementById("experimentSpeakerSeed"),
  experimentSpeakerInitStd: document.getElementById("experimentSpeakerInitStd"),
  experimentCreateFixture: document.getElementById("experimentCreateFixture"),
  experimentHashModel: document.getElementById("experimentHashModel"),
  seedF0Form: document.getElementById("seedF0Form"),
  experimentBenchmarkProfile: document.getElementById("experimentBenchmarkProfile"),
  experimentUseCurrentProfileBtn: document.getElementById("experimentUseCurrentProfileBtn"),
  experimentProfileUpload: document.getElementById("experimentProfileUpload"),
  experimentBenchmarkSamples: document.getElementById("experimentBenchmarkSamples"),
  experimentBenchmarkSeed: document.getElementById("experimentBenchmarkSeed"),
  experimentBenchmarkLowSteps: document.getElementById("experimentBenchmarkLowSteps"),
  experimentBenchmarkFinalSteps: document.getElementById("experimentBenchmarkFinalSteps"),
  experimentBenchmarkSeconds: document.getElementById("experimentBenchmarkSeconds"),
  experimentBenchmarkTargetF0: document.getElementById("experimentBenchmarkTargetF0"),
  experimentBenchmarkCfg: document.getElementById("experimentBenchmarkCfg"),
  experimentBenchmarkDuration: document.getElementById("experimentBenchmarkDuration"),
  experimentBenchmarkText: document.getElementById("experimentBenchmarkText"),
  experimentBenchmarkCaption: document.getElementById("experimentBenchmarkCaption"),
  stepStabilityForm: document.getElementById("stepStabilityForm"),
  experimentStabilityProfile: document.getElementById("experimentStabilityProfile"),
  experimentStabilityUseCurrentProfileBtn: document.getElementById("experimentStabilityUseCurrentProfileBtn"),
  experimentStabilitySpeaker: document.getElementById("experimentStabilitySpeaker"),
  experimentStabilitySamples: document.getElementById("experimentStabilitySamples"),
  experimentStabilitySeed: document.getElementById("experimentStabilitySeed"),
  experimentStabilityTargetF0: document.getElementById("experimentStabilityTargetF0"),
  experimentStabilityCfg: document.getElementById("experimentStabilityCfg"),
  experimentStabilityDuration: document.getElementById("experimentStabilityDuration"),
  experimentStabilityText: document.getElementById("experimentStabilityText"),
  experimentStabilityCaption: document.getElementById("experimentStabilityCaption"),
  voiceEvaluationForm: document.getElementById("voiceEvaluationForm"),
  experimentWavUpload: document.getElementById("experimentWavUpload"),
  experimentReferenceWavUpload: document.getElementById("experimentReferenceWavUpload"),
  experimentRestoreExcludedInputsBtn: document.getElementById("experimentRestoreExcludedInputsBtn"),
  experimentManifestUpload: document.getElementById("experimentManifestUpload"),
  experimentEvaluationInputs: document.getElementById("experimentEvaluationInputs"),
  experimentEvaluationReferences: document.getElementById("experimentEvaluationReferences"),
  experimentEvaluationManifest: document.getElementById("experimentEvaluationManifest"),
  experimentEvaluationTargetF0: document.getElementById("experimentEvaluationTargetF0"),
  runtimeDiagnosticsForm: document.getElementById("runtimeDiagnosticsForm"),
  experimentWorkspaceStatus: document.getElementById("experimentWorkspaceStatus"),
  experimentJobRows: document.getElementById("experimentJobRows"),
  experimentJobEmpty: document.getElementById("experimentJobEmpty"),
  experimentJobStatus: document.getElementById("experimentJobStatus"),
  experimentJobTitle: document.getElementById("experimentJobTitle"),
  cancelExperimentBtn: document.getElementById("cancelExperimentBtn"),
  experimentJobProgress: document.getElementById("experimentJobProgress"),
  experimentJobProgressText: document.getElementById("experimentJobProgressText"),
  experimentArtifacts: document.getElementById("experimentArtifacts"),
  experimentArtifactAudio: document.getElementById("experimentArtifactAudio"),
  experimentJobLog: document.getElementById("experimentJobLog"),
  experimentReportDetails: document.getElementById("experimentReportDetails"),
  experimentReportText: document.getElementById("experimentReportText"),
};

function num(el, fallback = 0) {
  if (!el) return fallback;
  const value = Number(el.value);
  return Number.isFinite(value) ? value : fallback;
}

function optionalNum(el) {
  if (!el || String(el.value).trim() === "") return null;
  const value = Number(el.value);
  return Number.isFinite(value) ? value : null;
}

function dist(a, b) {
  if (!a || !b) return null;
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function mid(a, b) {
  return landmarkSystem.midpoint(a, b);
}

function cohortCenter(key) {
  return priorResolver.resolveFeaturePrior(key, featureDefs[key], currentPriorContext()).median;
}

function sexClass() {
  return els.sexInput.value === "male" ? "male" : els.sexInput.value === "female" ? "female" : "neutral";
}

function sourceLabel(key) {
  const source = referenceData.sources[key];
  return source ? source.label : key;
}

function referenceNumber(key) {
  const index = Object.keys(referenceData.sources).indexOf(key);
  return index >= 0 ? `R${String(index + 1).padStart(2, "0")}` : null;
}

function compactSourceLabel(source, key) {
  const label = source?.citation_label ?? source?.label ?? key;
  const comma = label.indexOf(",");
  return comma > 0 ? label.slice(0, comma) : label;
}

function sourceTooltipText(key) {
  const source = referenceData.sources[key];
  if (!source) return "";
  return [
    source.use,
    source.scope_note,
    source.privacy_note,
    source.method_warning,
    source.population_warning,
    source.publication_use ? `用途区分: ${source.publication_use}` : null,
    source.public_release_status ? `公開区分: ${source.public_release_status}` : null,
  ].filter(Boolean).join("\n");
}

function sourceCitationElement(key) {
  const source = referenceData.sources[key];
  const number = referenceNumber(key);
  if (!source || !number) return null;
  const citation = document.createElement("span");
  citation.className = "source-citation";
  citation.tabIndex = 0;
  citation.textContent = `${compactSourceLabel(source, key)} [${number}]`;
  const tooltip = sourceTooltipText(key);
  citation.title = tooltip;
  citation.dataset.tooltip = tooltip;
  citation.setAttribute("aria-label", `${citation.textContent}。${tooltip}`);
  return citation;
}

function appendSourceCitation(target, key, extraTooltip = "") {
  const citation = sourceCitationElement(key);
  if (!target || !citation) return false;
  if (extraTooltip) {
    const tooltip = [citation.dataset.tooltip, extraTooltip].filter(Boolean).join("\n");
    citation.title = tooltip;
    citation.dataset.tooltip = tooltip;
    citation.setAttribute("aria-label", `${citation.textContent}。${tooltip}`);
  }
  if (target.childNodes.length) target.appendChild(document.createTextNode(" / "));
  target.appendChild(citation);
  return true;
}

function confidenceFromPoints(points) {
  const present = points.filter(Boolean).length;
  return present / points.length;
}

function isProfileArticulationLandmark(key) {
  return profileArticulationLandmarks.has(key);
}

function isLandmarkVisible(mode, key) {
  if (mode === "body") return Boolean(els.bodyShowLandmarks?.checked);
  if (mode === "face") return Boolean(els.faceShowLandmarks?.checked);
  if (mode === "profile") {
    return isProfileArticulationLandmark(key)
      ? Boolean(els.profileShowArticulationLandmarks?.checked)
      : Boolean(els.profileShowBaseLandmarks?.checked);
  }
  return true;
}

function landmarkStyle(mode, key) {
  if (mode === "profile" && isProfileArticulationLandmark(key)) {
    return { fill: "#8f609d", stroke: "rgba(255, 253, 248, 0.95)", text: "#614f97" };
  }
  return { fill: "#236b5b", stroke: "white", text: "#16483d" };
}

function canvasPoint(event, canvas) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * canvas.width,
    y: ((event.clientY - rect.top) / rect.height) * canvas.height,
  };
}

function nearestLandmark(point, mode = state.mode, maxDistance = 18) {
  let nearest = null;
  let nearestDistance = maxDistance;
  for (const [key, landmark] of Object.entries(state.landmarks[mode])) {
    if (!landmark) continue;
    if (!isLandmarkVisible(mode, key)) continue;
    const distance = dist(point, landmark);
    if (distance <= nearestDistance) {
      nearest = key;
      nearestDistance = distance;
    }
  }
  return nearest;
}

function frontCanvasForMode(mode) {
  return mode === "face" ? els.faceImageCanvas : els.bodyImageCanvas;
}

function frontOverlayCanvasForMode(mode) {
  return mode === "face" ? els.faceModelCanvas : els.bodyModelCanvas;
}

function firstLandmarkKey(mode) {
  return Object.keys(state.landmarks[mode] ?? {})[0] ?? null;
}

function cursorForMode(mode) {
  return state.cursor?.mode === mode ? state.cursor : { point: null, target: null, mode };
}

function setLandmark(mode, key, point) {
  const canvas = mode === "profile" ? els.profileImageCanvas : frontCanvasForMode(mode);
  state.landmarks[mode][key] = {
    x: clamp(point.x, 0, canvas.width),
    y: clamp(point.y, 0, canvas.height),
  };
}

function modeLabel(mode) {
  return mode === "body" ? "全身正面" : mode === "profile" ? "頭頚部側面" : "頭頚部正面";
}

function updateLandmarkHint(key, mode = state.mode, interaction = "selected") {
  if (!els.landmarkHintTitle || !els.landmarkHintDefinition || !els.landmarkHintRole) return;
  if (!key) {
    els.landmarkHintTitle.textContent = "ランドマーク定義";
    els.landmarkHintDefinition.textContent = "点をつかむか、カーソルを重ねると定義を表示します。";
    els.landmarkHintRole.textContent = "全身・頭頚部・側面の点名は解剖学的表現へ統一します。";
    return;
  }
  const info = landmarkSystem.landmarkInfo(key);
  const action = interaction === "drag" ? "調整中" : interaction === "hover" ? "参照中" : "選択中";
  const english = info.name_en ? ` / ${info.name_en}` : "";
  const abbreviation = info.abbreviation && info.abbreviation !== "-" ? ` (${info.abbreviation})` : "";
  els.landmarkHintTitle.textContent = `${info.label}${abbreviation}${english}`;
  els.landmarkHintDefinition.textContent = info.definition;
  els.landmarkHintRole.textContent = `${modeLabel(mode)}で${action}。用途: ${info.role}`;
}

function handleFrontPointerDown(event, mode) {
  const canvas = frontCanvasForMode(mode);
  const point = canvasPoint(event, canvas);
  const key = nearestLandmark(point, mode);
  if (!key) {
    state.mode = mode;
    state.cursor = { point, target: null, mode };
    updateLandmarkHint(null, mode, "selected");
    draw();
    return;
  }
  state.mode = mode;
  state.cursor = { point, target: key, mode };
  setLandmark(mode, key, point);
  if (els.landmarkSelect) els.landmarkSelect.value = key;
  state.drag = { mode, key, moved: false };
  updateLandmarkHint(key, mode, "drag");
  canvas.setPointerCapture?.(event.pointerId);
  draw();
  event.preventDefault();
}

function handleFrontPointerMove(event, mode) {
  const activeMode = state.drag?.mode ?? mode;
  const canvas = frontCanvasForMode(activeMode);
  const point = canvasPoint(event, canvas);
  const target = state.drag?.key ?? nearestLandmark(point, activeMode);
  state.mode = activeMode;
  state.cursor = { point, target, mode: activeMode };
  updateLandmarkHint(target, activeMode, state.drag ? "drag" : target ? "hover" : "selected");
  if (!state.drag) {
    draw();
    return;
  }
  setLandmark(state.drag.mode, state.drag.key, point);
  state.drag.moved = true;
  draw();
  event.preventDefault();
}

function handleFrontPointerUp(event) {
  if (!state.drag) return;
  const key = state.drag.key;
  const mode = state.drag.mode;
  frontCanvasForMode(mode).releasePointerCapture?.(event.pointerId);
  state.drag = null;
  updateLandmarkHint(key, mode, "selected");
  analyze();
  event.preventDefault();
}

function handleFrontPointerLeave(event, mode) {
  if (state.drag?.mode === mode) {
    handleFrontPointerUp(event);
    return;
  }
  if (state.cursor?.mode === mode) state.cursor = { point: null, target: null, mode };
  updateLandmarkHint(null, mode, "selected");
  draw();
}

function handleProfilePointerDown(event) {
  const point = canvasPoint(event, els.profileImageCanvas);
  const key = nearestLandmark(point, "profile");
  if (!key) {
    state.profileCursor = { point, target: null };
    updateLandmarkHint(null, "profile", "selected");
    draw();
    return;
  }
  state.profileCursor = { point, target: key };
  setLandmark("profile", key, point);
  els.profileLandmarkSelect.value = key;
  state.profileDrag = { mode: "profile", key, moved: false };
  updateLandmarkHint(key, "profile", "drag");
  els.profileImageCanvas.setPointerCapture?.(event.pointerId);
  draw();
  event.preventDefault();
}

function handleProfilePointerMove(event) {
  const point = canvasPoint(event, els.profileImageCanvas);
  const target = state.profileDrag?.key ?? nearestLandmark(point, "profile");
  state.profileCursor = { point, target };
  updateLandmarkHint(target, "profile", state.profileDrag ? "drag" : target ? "hover" : "selected");
  if (state.profileDrag) {
    setLandmark("profile", state.profileDrag.key, point);
    state.profileDrag.moved = true;
  }
  draw();
  event.preventDefault();
}

function handleProfilePointerUp(event) {
  if (!state.profileDrag) return;
  const key = state.profileDrag.key;
  els.profileImageCanvas.releasePointerCapture?.(event.pointerId);
  state.profileDrag = null;
  updateLandmarkHint(key, "profile", "selected");
  analyze();
  event.preventDefault();
}

function handleProfilePointerLeave(event) {
  if (state.profileDrag) {
    handleProfilePointerUp(event);
    return;
  }
  state.profileCursor = { point: null, target: null };
  updateLandmarkHint(null, "profile", "selected");
  draw();
}

function handleAreaTuningPointerDown(event) {
  if (!state.vocalTractGeometry?.sections?.length) return;
  drawTractProfile(state.vocalTractGeometry);
  const point = canvasPoint(event, els.tractProfileCanvas);
  const hit = nearestAreaTuningHandle(point);
  if (!hit) return;
  state.areaTuningDrag = hit;
  state.selectedTractTuningHandle = hit;
  els.tractProfileCanvas.setPointerCapture?.(event.pointerId);
  updateAreaTuningFromPoint(point);
  event.preventDefault();
}

function handleAreaTuningPointerMove(event) {
  if (!state.areaTuningDrag) return;
  const point = canvasPoint(event, els.tractProfileCanvas);
  updateAreaTuningFromPoint(point);
  event.preventDefault();
}

function handleAreaTuningPointerUp(event) {
  if (!state.areaTuningDrag) return;
  els.tractProfileCanvas.releasePointerCapture?.(event.pointerId);
  state.areaTuningDrag = null;
  updateTractEditStatus();
  renderConstraints();
  draw();
}

function nearestAreaTuningHandle(point) {
  const meta = state.areaTuningPlot;
  if (!meta) return null;
  const mode = state.tractEditMode === "width" ? "width" : "area";
  const points = mode === "width" ? normalizedWidthTuningPoints(meta.vowel) : normalizedAreaTuningPoints(meta.vowel);
  const xAt = (position) => meta.plot.left + position * (meta.plot.right - meta.plot.left);
  let best = null;
  for (let index = 0; index < points.length; index++) {
    const dx = Math.abs(point.x - xAt(points[index].position));
    if (dx > 20) continue;
    if (!best || dx < best.dx) best = { vowel: meta.vowel, handleIndex: index, mode, dx };
  }
  return best ? { vowel: best.vowel, handleIndex: best.handleIndex, mode: best.mode } : null;
}

function updateAreaTuningFromPoint(point) {
  const drag = state.areaTuningDrag;
  const meta = state.areaTuningPlot;
  if (!drag || !meta) return;
  const clampedY = clamp(point.y, meta.plot.top, meta.plot.bottom);
  const valueAtPointer = (meta.plot.bottom - clampedY) / Math.max(1, meta.plot.bottom - meta.plot.top) * meta.maxValue;
  const areaFunction = buildTubeAreaFunction(
    state.vocalTractGeometry,
    drag.vowel,
    PREVIEW_SAMPLE_RATE,
    currentArticulationMotorProfile(state.constraints)
  );
  if (drag.mode === "width") {
    const pointDef = normalizedWidthTuningPoints(drag.vowel)[drag.handleIndex];
    const widths = areaFunction.cross_sections_2_5d.map((section) => section.coronal_width_cm);
    const currentWidth = areaAtPositionFromArray(widths, pointDef.position);
    const untunedWidth = currentWidth / Math.max(0.05, pointDef.gain);
    setWidthTuningPoint(drag.vowel, drag.handleIndex, valueAtPointer / Math.max(0.05, untunedWidth));
  } else {
    const pointDef = normalizedAreaTuningPoints(drag.vowel)[drag.handleIndex];
    const currentArea = areaAtPositionFromArray(areaFunction.areas_cm2, pointDef.position);
    const untunedArea = currentArea / Math.max(0.05, pointDef.gain);
    setAreaTuningPoint(drag.vowel, drag.handleIndex, valueAtPointer / Math.max(0.05, untunedArea));
  }
  updateTractEditStatus();
  draw();
}

function setTractEditMode(mode) {
  state.tractEditMode = mode === "width" ? "width" : "area";
  state.selectedTractTuningHandle = null;
  els.editAreaModeBtn?.classList.toggle("active", state.tractEditMode === "area");
  els.editWidthModeBtn?.classList.toggle("active", state.tractEditMode === "width");
  els.editAreaModeBtn?.setAttribute("aria-pressed", state.tractEditMode === "area" ? "true" : "false");
  els.editWidthModeBtn?.setAttribute("aria-pressed", state.tractEditMode === "width" ? "true" : "false");
  updateTractEditStatus();
  draw();
}

function nudgeSelectedTractPoint(delta) {
  const selection = state.selectedTractTuningHandle;
  if (!selection || selection.vowel !== selectedVowel()) return;
  const points = selection.mode === "width"
    ? normalizedWidthTuningPoints(selection.vowel)
    : normalizedAreaTuningPoints(selection.vowel);
  const point = points[selection.handleIndex];
  if (!point) return;
  if (selection.mode === "width") setWidthTuningPoint(selection.vowel, selection.handleIndex, point.gain + delta);
  else setAreaTuningPoint(selection.vowel, selection.handleIndex, point.gain + delta);
  updateTractEditStatus();
  renderConstraints();
  draw();
}

function handleTractTuningKeyDown(event) {
  if (!["ArrowUp", "ArrowDown"].includes(event.key)) return;
  nudgeSelectedTractPoint((event.key === "ArrowUp" ? 1 : -1) * (event.shiftKey ? 0.05 : 0.01));
  event.preventDefault();
}

function loadImage(file, target, shouldAnalyze = false) {
  if (!file) return Promise.resolve(false);
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      state.images[target] = img;
      state.imageNames[target] = file.name || `${target}.png`;
      state.imageFiles[target] = file;
      URL.revokeObjectURL(url);
      if (shouldAnalyze) analyze();
      else draw();
      resolve(true);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`画像を読み込めませんでした: ${file.name || target}`));
    };
    img.src = url;
  });
}

function setMode(mode) {
  state.mode = mode;
  els.bodyModeBtn.classList.toggle("active", mode === "body");
  els.faceModeBtn.classList.toggle("active", mode === "face");
  refreshLandmarkSelect();
  updateLandmarkHint(els.landmarkSelect.value, mode, "selected");
  draw();
}

function refreshLandmarkSelect() {
  const keys = Object.keys(state.landmarks[state.mode]);
  els.landmarkSelect.innerHTML = "";
  for (const key of keys) {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = labels[key] ?? key;
    els.landmarkSelect.appendChild(option);
  }

  if (els.profileLandmarkSelect && !els.profileLandmarkSelect.options.length) {
    for (const key of Object.keys(state.landmarks.profile)) {
      const option = document.createElement("option");
      option.value = key;
      option.textContent = labels[key] ?? key;
      els.profileLandmarkSelect.appendChild(option);
    }
  }
  updateLandmarkHint(els.landmarkSelect.value, state.mode, "selected");
}

function drawImage(ctx, image, emptyLabel = null) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.fillStyle = "#ece7dc";
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  if (!image) {
    ctx.fillStyle = "#666257";
    ctx.textAlign = "center";
    ctx.font = "16px Segoe UI";
    ctx.fillText(emptyLabel ?? (state.mode === "body" ? "低ポリシェーマ上で全身ランドマークを手動配置" : "頭頚部ランドマークを手動配置"), ctx.canvas.width / 2, ctx.canvas.height / 2);
    return;
  }
  const scale = Math.min(ctx.canvas.width / image.width, ctx.canvas.height / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  const x = (ctx.canvas.width - width) / 2;
  const y = (ctx.canvas.height - height) / 2;
  ctx.drawImage(image, x, y, width, height);
}

function drawLandmarks(ctx, mode = state.mode, dragState = state.drag) {
  const points = state.landmarks[mode];
  ctx.save();
  ctx.font = "12px Segoe UI";
  ctx.textBaseline = "middle";
  for (const [key, point] of Object.entries(points)) {
    if (!point) continue;
    if (!isLandmarkVisible(mode, key)) continue;
    if (dragState?.mode === mode && dragState.key === key) continue;
    const style = landmarkStyle(mode, key);
    ctx.beginPath();
    ctx.arc(point.x, point.y, 5, 0, Math.PI * 2);
    ctx.fillStyle = style.fill;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = style.stroke;
    ctx.stroke();
    ctx.fillStyle = style.text;
    ctx.fillText(labels[key] ?? key, point.x + 8, point.y);
  }
  ctx.restore();
}

function drawCursorGuide(ctx, mode = state.mode, dragState = state.drag, cursorState = state.cursor) {
  const point = cursorState?.point;
  if (!point) return;
  const visibleTarget = cursorState.target && isLandmarkVisible(mode, cursorState.target) ? cursorState.target : null;
  const targetPoint = visibleTarget ? state.landmarks[mode][visibleTarget] : null;
  const x = targetPoint?.x ?? point.x;
  const y = targetPoint?.y ?? point.y;
  const active = Boolean(dragState || targetPoint);
  ctx.save();
  ctx.lineCap = "square";
  ctx.lineWidth = 1;
  ctx.strokeStyle = active ? "rgba(22, 72, 61, 0.95)" : "rgba(36, 35, 31, 0.78)";
  ctx.beginPath();
  ctx.moveTo(x - 22, y);
  ctx.lineTo(x - 6, y);
  ctx.moveTo(x + 6, y);
  ctx.lineTo(x + 22, y);
  ctx.moveTo(x, y - 22);
  ctx.lineTo(x, y - 6);
  ctx.moveTo(x, y + 6);
  ctx.lineTo(x, y + 22);
  ctx.stroke();

  ctx.strokeStyle = "rgba(255, 253, 248, 0.98)";
  ctx.lineWidth = dragState ? 4 : 3;
  ctx.beginPath();
  ctx.arc(x, y, dragState ? 10 : 8, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = active ? "rgba(35, 107, 91, 0.95)" : "rgba(36, 35, 31, 0.72)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(x, y, dragState ? 10 : 8, 0, Math.PI * 2);
  if (!dragState) {
    ctx.moveTo(x - 3, y);
    ctx.lineTo(x + 3, y);
    ctx.moveTo(x, y - 3);
    ctx.lineTo(x, y + 3);
  }
  ctx.stroke();

  if (visibleTarget) {
    drawCursorHud(ctx, visibleTarget);
  }
  ctx.restore();
}

function drawCursorHud(ctx, key) {
  const label = labels[key] ?? key;
  ctx.save();
  ctx.font = "13px Segoe UI";
  ctx.textBaseline = "top";
  const padX = 9;
  const padY = 6;
  const width = Math.ceil(ctx.measureText(label).width + padX * 2);
  const height = 25;
  const x = ctx.canvas.width - width - 10;
  const y = 10;
  ctx.fillStyle = "rgba(255, 253, 248, 0.9)";
  ctx.strokeStyle = "rgba(35, 107, 91, 0.42)";
  ctx.lineWidth = 1;
  roundedRectPath(ctx, x, y, width, height, 6);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#16483d";
  ctx.fillText(label, x + padX, y + padY - 1);
  ctx.restore();
}

function roundedRectPath(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawBodyModel(ctx) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  const c = state.constraints;
  const f = state.features;
  const body = state.landmarks.body;
  const shoulder = (f.shoulder_width_cm?.integrated ?? 38) / 38;
  const torso = (f.torso_length_cm?.integrated ?? 53) / 53;
  const pelvis = (f.pelvis_width_cm?.integrated ?? 31.5) / 31.5;
  const heads = f.head_units?.integrated ?? 7.25;
  const neck = c.pharyngeal_length_scale?.center ?? 1;
  const area = c.pharyngeal_area_scale?.center ?? 1;
  const shoulderMid = mid(body.left_shoulder, body.right_shoulder);
  const pelvisMid = mid(body.left_hip, body.right_hip);
  const footMid = mid(body.left_foot, body.right_foot);
  const hasBodyAnchors = body.head_top && footMid;
  const fallbackBaseY = ctx.canvas.height * 0.86;
  const fallbackTotalH = ctx.canvas.height * 0.68;
  const yHead = hasBodyAnchors ? body.head_top.y : fallbackBaseY - fallbackTotalH;
  const baseY = hasBodyAnchors ? footMid.y : fallbackBaseY;
  const totalH = Math.max(120, baseY - yHead);
  const cx = hasBodyAnchors
    ? averageX([body.head_top, body.chin, shoulderMid, pelvisMid, footMid])
    : ctx.canvas.width * 0.5;
  const headH = body.head_top && body.chin ? Math.max(24, dist(body.head_top, body.chin)) : totalH / heads;
  const headCx = body.head_top?.x ?? cx;
  const torsoH = totalH * 0.32 * torso;
  const legH = totalH - headH * 1.3 - torsoH;
  const shoulderW = body.left_shoulder && body.right_shoulder ? dist(body.left_shoulder, body.right_shoulder) : totalH * 0.24 * shoulder;
  const pelvisW = body.left_hip && body.right_hip ? dist(body.left_hip, body.right_hip) : shoulderW * 0.72 * pelvis;
  const neckW = Math.max(10, Math.min(shoulderW * 0.26, headH * 0.42) * area);
  const yNeck = body.chin ? body.chin.y : yHead + headH * 1.12;
  const yShoulder = shoulderMid ? shoulderMid.y : yNeck + Math.max(14, totalH * 0.055 * neck);
  const yPelvis = pelvisMid ? pelvisMid.y : yShoulder + torsoH;
  const yKnee = Math.min(baseY - 12, yPelvis + Math.max(20, legH * 0.52));
  const leftShoulder = body.left_shoulder ?? { x: cx - shoulderW / 2, y: yShoulder };
  const rightShoulder = body.right_shoulder ?? { x: cx + shoulderW / 2, y: yShoulder };
  const leftHip = body.left_hip ?? { x: cx - pelvisW / 2, y: yPelvis };
  const rightHip = body.right_hip ?? { x: cx + pelvisW / 2, y: yPelvis };
  const leftFoot = body.left_foot ?? { x: cx - pelvisW / 2, y: baseY };
  const rightFoot = body.right_foot ?? { x: cx + pelvisW / 2, y: baseY };
  const leftKnee = { x: (leftHip.x + leftFoot.x) / 2, y: yKnee };
  const rightKnee = { x: (rightHip.x + rightFoot.x) / 2, y: yKnee };

  ctx.save();
  ctx.lineJoin = "round";
  ctx.strokeStyle = "rgba(22, 72, 61, 0.7)";
  ctx.lineWidth = 2;

  ctx.fillStyle = "rgba(35, 107, 91, 0.18)";
  polygon(ctx, [
    [headCx - headH * 0.34, yHead],
    [headCx + headH * 0.34, yHead],
    [headCx + headH * 0.42, yHead + headH * 0.65],
    [headCx + headH * 0.24, yHead + headH],
    [headCx - headH * 0.24, yHead + headH],
    [headCx - headH * 0.42, yHead + headH * 0.65],
  ]);

  ctx.fillStyle = "rgba(155, 92, 32, 0.14)";
  polygon(ctx, [
    [cx - neckW / 2, yNeck],
    [cx + neckW / 2, yNeck],
    [cx + neckW * 0.72, yShoulder],
    [cx - neckW * 0.72, yShoulder],
  ]);

  ctx.fillStyle = "rgba(35, 107, 91, 0.22)";
  polygon(ctx, [
    [leftShoulder.x, leftShoulder.y],
    [rightShoulder.x, rightShoulder.y],
    [rightHip.x, rightHip.y],
    [leftHip.x, leftHip.y],
  ]);

  ctx.fillStyle = "rgba(35, 107, 91, 0.16)";
  limb(ctx, leftShoulder.x, leftShoulder.y + 8, leftHip.x - shoulderW * 0.16, yPelvis - 18, Math.max(10, shoulderW * 0.055));
  limb(ctx, rightShoulder.x, rightShoulder.y + 8, rightHip.x + shoulderW * 0.16, yPelvis - 18, Math.max(10, shoulderW * 0.055));
  limb(ctx, leftHip.x, leftHip.y, leftKnee.x, leftKnee.y, Math.max(12, pelvisW * 0.17));
  limb(ctx, rightHip.x, rightHip.y, rightKnee.x, rightKnee.y, Math.max(12, pelvisW * 0.17));
  limb(ctx, leftKnee.x, leftKnee.y, leftFoot.x, leftFoot.y, Math.max(10, pelvisW * 0.13));
  limb(ctx, rightKnee.x, rightKnee.y, rightFoot.x, rightFoot.y, Math.max(10, pelvisW * 0.13));

  ctx.fillStyle = "#16483d";
  ctx.font = "12px Segoe UI";
  ctx.textAlign = "left";
  ctx.fillText(`VTL ${format(c.vocal_tract_length_cm?.center, 1)} cm`, 18, 24);
  ctx.fillText(`開放率 ${format(c.glottal_open_quotient?.center, 2)}`, 18, 42);
  ctx.restore();
}

function averageX(points) {
  const present = points.filter(Boolean);
  if (!present.length) return 0;
  return present.reduce((sum, point) => sum + point.x, 0) / present.length;
}

function polygon(ctx, points) {
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (const point of points.slice(1)) ctx.lineTo(point[0], point[1]);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

function limb(ctx, x1, y1, x2, y2, width) {
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineWidth = width;
  ctx.strokeStyle = ctx.fillStyle;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.restore();
}

const tractRegions = [
  { key: "laryngeal", label: "喉頭腔", start: 0, end: 0.18, color: "rgba(138, 84, 47, 0.22)" },
  { key: "pharyngeal", label: "咽頭腔", start: 0.18, end: 0.46, color: "rgba(57, 112, 98, 0.22)" },
  { key: "oral", label: "口腔", start: 0.46, end: 0.9, color: "rgba(54, 100, 140, 0.2)" },
  { key: "labial", label: "口唇端", start: 0.9, end: 1.001, color: "rgba(163, 101, 54, 0.24)" },
];

function profileFallbackPoints() {
  return {
    profile_vertex: { x: 348, y: 78 },
    profile_occiput: { x: 278, y: 186 },
    profile_nasion: { x: 402, y: 182 },
    profile_nose_tip: { x: 452, y: 224 },
    profile_subnasale: { x: 420, y: 250 },
    profile_lip: { x: 422, y: 278 },
    profile_ans: { x: 400, y: 254 },
    profile_pns: { x: 336, y: 250 },
    profile_soft_palate_hinge: { x: 336, y: 253 },
    profile_velum_tip: { x: 326, y: 284 },
    profile_posterior_pharyngeal_wall: { x: 304, y: 286 },
    profile_chin: { x: 402, y: 334 },
    profile_menton: { x: 402, y: 344 },
    profile_jaw_angle: { x: 326, y: 322 },
    profile_tragion: { x: 310, y: 222 },
    profile_hyoid: { x: 342, y: 347 },
    profile_larynx: { x: 330, y: 398 },
    profile_neck_front: { x: 382, y: 448 },
    profile_neck_back: { x: 286, y: 448 },
  };
}

function resolvedProfilePoints() {
  const fallback = profileFallbackPoints();
  const actual = state.landmarks.profile;
  const direction = resolveProfileDirection(actual);
  if (direction === "right") return { ...fallback, ...nonNullEntries(actual) };
  const mirrored = Object.fromEntries(Object.entries(fallback).map(([key, point]) => [key, { x: els.profileImageCanvas.width - point.x, y: point.y }]));
  return { ...mirrored, ...nonNullEntries(actual) };
}

function nonNullEntries(object) {
  return Object.fromEntries(Object.entries(object).filter(([, value]) => value));
}

function resolveProfileDirection(points = state.landmarks.profile) {
  const selected = els.profileDirectionInput?.value ?? "auto";
  if (selected === "left" || selected === "right") return selected;
  if (points.profile_nose_tip && points.profile_occiput) return points.profile_nose_tip.x >= points.profile_occiput.x ? "right" : "left";
  if (points.profile_lip && points.profile_tragion) return points.profile_lip.x >= points.profile_tragion.x ? "right" : "left";
  return "right";
}

function buildVocalTractGeometry() {
  const points = resolvedProfilePoints();
  const direction = resolveProfileDirection(points);
  const sign = direction === "right" ? 1 : -1;
  const lip = points.profile_lip;
  const hyoid = points.profile_hyoid;
  const larynx = points.profile_larynx;
  const tragion = points.profile_tragion;
  const subnasale = points.profile_subnasale;
  const jaw = points.profile_jaw_angle;
  const neckFront = points.profile_neck_front;
  const neckBack = points.profile_neck_back;
  const controls = [
    larynx,
    { x: larynx.x + sign * 10, y: (larynx.y + hyoid.y) / 2 },
    { x: hyoid.x - sign * 4, y: hyoid.y - 10 },
    { x: tragion.x + sign * 32, y: (tragion.y + subnasale.y) / 2 + 20 },
    { x: (jaw.x + lip.x) / 2 + sign * 12, y: lip.y + 4 },
    lip,
  ];
  const centerline = sampleCatmullRom(controls, 44);
  const pathLengthPx = polylineLength(centerline);
  const vtlCm = state.constraints.vocal_tract_length_cm?.center ?? 15.5;
  const pxPerCm = pathLengthPx / Math.max(8, vtlCm);
  const neckDepthPx = landmarkSystem.horizontalDistance(neckFront, neckBack) ?? 96;
  const profileHeadPx = landmarkSystem.verticalDistance(points.profile_vertex, points.profile_chin) ?? 256;
  const neckDepthRatio = neckDepthPx / Math.max(1, profileHeadPx);
  const neckDepthScale = clamp(neckDepthRatio / 0.375, 0.7, 1.35);
  const profileCmPerPx = state.calibration?.views?.head_profile?.cm_per_px ?? null;
  const hondaSpace = buildHondaArticulatorySpace(points, profileCmPerPx, direction);
  const sideBranchGuides = buildSideBranchGuides(points, hondaSpace, profileCmPerPx, direction);
  const pharyngealLengthScale = clamp(state.constraints.pharyngeal_length_scale?.center ?? 1, 0.65, 1.4);
  const templatePharyngealBoundary = 0.46;
  const acousticPharyngealBoundary = clamp(templatePharyngealBoundary * pharyngealLengthScale, 0.32, 0.62);
  const pharynxScale = state.constraints.pharyngeal_area_scale?.center ?? 1;
  const palatalVaultScale = state.constraints.palatal_vault_scale?.center ?? 1;
  const lipApertureAspectScale = state.constraints.lip_aperture_aspect_scale?.center ?? 1;
  const tongueGrooveAvailability = clamp(state.constraints.tongue_groove_capacity?.center ?? 1, 0.2, 1);
  const neckWidth = state.features.neck_root_width_cm?.integrated ?? 13.3;
  const jawWidth = state.features.jaw_width_cm?.integrated ?? 11.1;
  const mouthWidth = state.constraints.mouth_width_relaxed_cm?.center
    ?? state.features.mouth_width_cm?.articulatory_baseline_cm
    ?? state.features.mouth_width_cm?.integrated
    ?? 4.85;
  const trachealWidth = state.constraints.tracheal_transverse_design_cm?.center ?? (sexClass() === "male" ? 1.8 : sexClass() === "female" ? 1.4 : 1.6);
  const widthAnchors = [
    { position: 0, width_cm: trachealWidth, source: "independent design baseline; clinical aggregate is validation-only" },
    { position: 0.2, width_cm: Math.max(1.45, neckWidth * 0.16), source: "front neck-root breadth proxy" },
    { position: 0.43, width_cm: Math.max(1.8, neckWidth * 0.21), source: "front neck-root breadth proxy" },
    { position: 0.67, width_cm: Math.max(2.2, jawWidth * 0.45), source: "front jaw breadth proxy" },
    { position: 0.86, width_cm: Math.max(1.8, mouthWidth * 0.95), source: "jaw-conditioned relaxed commissure-width proxy" },
    { position: 1, width_cm: Math.max(1.2, mouthWidth * 0.78), source: "jaw-conditioned relaxed commissure-width proxy" },
  ];
  const sagittalAnchors = [
    [0, 0.72],
    [0.12, 1.5],
    [0.28, 2.35],
    [0.46, 1.45],
    [0.64, 2.15],
    [0.8, 1.75],
    [0.92, 1.15],
    [1, 0.72],
  ];
  const sections = centerline.map((center, index) => {
    const position = index / (centerline.length - 1);
    // pharyngeal_length_scale reallocates the fixed total VTL between the
    // pharyngeal and oral portions; it does not act as a second VTL control.
    const templatePosition = position <= acousticPharyngealBoundary
      ? position / acousticPharyngealBoundary * templatePharyngealBoundary
      : templatePharyngealBoundary
        + (position - acousticPharyngealBoundary) / (1 - acousticPharyngealBoundary) * (1 - templatePharyngealBoundary);
    const baseSagittal = interpolatePairs(sagittalAnchors, templatePosition);
    const regionScale = position < acousticPharyngealBoundary ? pharynxScale * neckDepthScale : 1;
    const vaultWeight = Math.exp(-0.5 * Math.pow((templatePosition - 0.7) / 0.22, 2));
    const baseSagittalCm = clamp(baseSagittal * Math.sqrt(regionScale) * (1 + (palatalVaultScale - 1) * vaultWeight), 0.35, 4.5);
    const baseWidthCm = interpolateAnchors(widthAnchors, templatePosition);
    const ellipseShapeFactor = Math.PI / 4;
    const areaCm2 = ellipseShapeFactor * baseSagittalCm * baseWidthCm;
    const terminalWeight = Math.exp(-0.5 * Math.pow((templatePosition - 0.94) / 0.12, 2));
    const nativeAspectRatio = baseWidthCm / Math.max(0.1, baseSagittalCm);
    const aspectRatio = clamp(nativeAspectRatio * (1 + (lipApertureAspectScale - 1) * terminalWeight), 0.18, 10);
    const equivalentRectangleArea = areaCm2 / ellipseShapeFactor;
    const sagittalCm = Math.sqrt(equivalentRectangleArea / aspectRatio);
    const widthCm = Math.sqrt(equivalentRectangleArea * aspectRatio);
    const oralWeight = Math.exp(-0.5 * Math.pow((templatePosition - 0.72) / 0.24, 2));
    // This is a neutral morphological capacity. PerformanceControlRange limits
    // how much of it a current vowel gesture can recruit, not the template itself.
    const lateralChannelCapacityCm2 = clamp(areaCm2 * (0.02 + oralWeight * 0.16), 0, areaCm2 * 0.36);
    const previous = centerline[Math.max(0, index - 1)];
    const next = centerline[Math.min(centerline.length - 1, index + 1)];
    const tangentLength = Math.max(0.001, dist(previous, next));
    const normal = { x: -(next.y - previous.y) / tangentLength, y: (next.x - previous.x) / tangentLength };
    const halfWidthPx = sagittalCm * pxPerCm / 2;
    return {
      index,
      position: Number(position.toFixed(5)),
      template_position: Number(templatePosition.toFixed(5)),
      position_cm: Number((position * vtlCm).toFixed(4)),
      center,
      normal,
      sagittal_diameter_cm: Number(sagittalCm.toFixed(4)),
      frontal_width_cm: Number(widthCm.toFixed(4)),
      area_cm2: Number(areaCm2.toFixed(4)),
      ellipse_shape_factor: Number(ellipseShapeFactor.toFixed(5)),
      cross_section_aspect_ratio: Number(aspectRatio.toFixed(4)),
      lateral_channel_capacity_cm2: Number(lateralChannelCapacityCm2.toFixed(4)),
      cross_section: {
        model: "elliptical_midline_with_latent_lateral_channel_capacity",
        sagittal_height_cm: Number(sagittalCm.toFixed(4)),
        coronal_width_cm: Number(widthCm.toFixed(4)),
        ellipse_shape_factor: Number(ellipseShapeFactor.toFixed(5)),
        aspect_ratio: Number(aspectRatio.toFixed(4)),
        lateral_channel_capacity_cm2: Number(lateralChannelCapacityCm2.toFixed(4)),
        lateral_channel_capacity_fraction: Number((lateralChannelCapacityCm2 / Math.max(0.001, areaCm2)).toFixed(4)),
        source: "synthetic 2.5D design template; internal cross-section is not inferred from the image",
      },
      upper: { x: center.x + normal.x * halfWidthPx, y: center.y + normal.y * halfWidthPx },
      lower: { x: center.x - normal.x * halfWidthPx, y: center.y - normal.y * halfWidthPx },
      region: regionForPosition(templatePosition).key,
    };
  });
  const regionSummary = Object.fromEntries(tractRegions.map((region) => {
    const regionSections = sections.filter((section) => section.region === region.key);
    const meanArea = regionSections.reduce((sum, section) => sum + section.area_cm2, 0) / Math.max(1, regionSections.length);
    const minArea = regionSections.length ? Math.min(...regionSections.map((section) => section.area_cm2)) : 0;
    return [region.key, {
      label: region.label,
      mean_area_cm2: Number(meanArea.toFixed(4)),
      minimum_area_cm2: Number(minArea.toFixed(4)),
      length_cm: Number((regionSections.length / sections.length * vtlCm).toFixed(4)),
    }];
  }));

  return {
    schema_version: "vocal_tract_geometry_0.2",
    method: "landmark_calibrated_synthetic_midsagittal_plus_coronal_2_5d_template",
    direction,
    vocal_tract_length_cm: vtlCm,
    centerline_controls: controls,
    profile_external_measurements: {
      total_head_height_px: Number(profileHeadPx.toFixed(4)),
      neck_front_to_back_px: Number(neckDepthPx.toFixed(4)),
      neck_front_to_back_cm: profileCmPerPx ? Number((neckDepthPx * profileCmPerPx).toFixed(4)) : null,
      neck_depth_to_total_head_height_ratio: Number(neckDepthRatio.toFixed(5)),
    },
    width_anchors: widthAnchors,
    cross_section_model: {
      representation: "midsagittal height plus coronal width, elliptical shape factor, and latent lateral-channel capacity",
      pharyngeal_length_scale: Number(pharyngealLengthScale.toFixed(4)),
      acoustic_pharyngeal_boundary: Number(acousticPharyngealBoundary.toFixed(4)),
      palatal_vault_scale: Number(palatalVaultScale.toFixed(4)),
      lip_aperture_aspect_scale: Number(lipApertureAspectScale.toFixed(4)),
      tongue_groove_availability: Number(tongueGrooveAvailability.toFixed(4)),
      acoustic_projection: "the current browser solver receives the derived total A(x); retained section shape fields are available to a later multi-channel or 3D backend",
    },
    sections,
    region_summary: regionSummary,
    assumptions: [
      "The midsagittal cavity is a deformable design template, not a directly observed internal contour.",
      "Missing frontal widths are linearly interpolated between mouth, jaw, neck-root, and independent tracheal anchors.",
      "Each section retains sagittal height, coronal width, elliptical shape factor, and a latent lateral-channel capacity before the current solver receives derived total area A(x).",
      "The synthetic lateral-channel capacity is a design degree of freedom, not an image-inferred tongue groove or a participant-derived anatomical measurement.",
      "Published clinical tracheal measurements are used only to check plausibility, never to infer tracheal size from external neck width.",
      "ANS, PNS, Menton, posterior pharyngeal wall, and soft-palate points are manually placed design anchors for Honda-style morphological articulation-space guides.",
      "Paranasal sinus shapes are schematic side-branch guides derived from profile anchors; they are not image-observed sinus contours.",
    ],
    evidence: ["baer1991", "dediu2022", "honda2001", "aistHql2003", "japaneseTracheaUhrct2023"],
    honda_articulatory_space: hondaSpace,
    side_branch_guides: sideBranchGuides,
    confidence: state.images.profile ? 0.34 : 0.2,
  };
}

function sampleCatmullRom(points, count) {
  const output = [];
  const segments = points.length - 1;
  for (let index = 0; index < count; index++) {
    const scaled = index / (count - 1) * segments;
    const segment = Math.min(segments - 1, Math.floor(scaled));
    const t = scaled - segment;
    const p0 = points[Math.max(0, segment - 1)];
    const p1 = points[segment];
    const p2 = points[Math.min(points.length - 1, segment + 1)];
    const p3 = points[Math.min(points.length - 1, segment + 2)];
    const t2 = t * t;
    const t3 = t2 * t;
    output.push({
      x: 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
      y: 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
    });
  }
  return output;
}

function polylineLength(points) {
  let length = 0;
  for (let index = 1; index < points.length; index++) length += dist(points[index - 1], points[index]);
  return length;
}

function interpolatePairs(pairs, position) {
  for (let index = 1; index < pairs.length; index++) {
    if (position <= pairs[index][0]) {
      const [x0, y0] = pairs[index - 1];
      const [x1, y1] = pairs[index];
      const t = (position - x0) / Math.max(0.0001, x1 - x0);
      return y0 + (y1 - y0) * t;
    }
  }
  return pairs[pairs.length - 1][1];
}

function interpolateAnchors(anchors, position) {
  return interpolatePairs(anchors.map((anchor) => [anchor.position, anchor.width_cm]), position);
}

function regionForPosition(position) {
  return tractRegions.find((region) => position >= region.start && position < region.end) ?? tractRegions[tractRegions.length - 1];
}

function finitePoint(point) {
  return point && Number.isFinite(point.x) && Number.isFinite(point.y);
}

function roundMetric(value, digits = 4) {
  return Number.isFinite(value) ? Number(value.toFixed(digits)) : null;
}

function projectPointToLine(point, lineStart, lineEnd) {
  if (!finitePoint(point) || !finitePoint(lineStart) || !finitePoint(lineEnd)) return null;
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq <= 0.0001) return null;
  const t = ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / lengthSq;
  return { x: lineStart.x + dx * t, y: lineStart.y + dy * t };
}

function pointLineDistance(point, lineStart, lineEnd) {
  const projected = projectPointToLine(point, lineStart, lineEnd);
  return projected ? dist(point, projected) : null;
}

function polygonArea(points) {
  const usable = points.filter(finitePoint);
  if (usable.length < 3) return null;
  let area = 0;
  for (let index = 0; index < usable.length; index++) {
    const current = usable[index];
    const next = usable[(index + 1) % usable.length];
    area += current.x * next.y - next.x * current.y;
  }
  return Math.abs(area / 2);
}

function buildHondaArticulatorySpace(points, cmPerPx, direction) {
  const ans = points.profile_ans;
  const pns = points.profile_pns;
  const menton = points.profile_menton ?? points.profile_chin;
  const wall = points.profile_posterior_pharyngeal_wall;
  const hinge = points.profile_soft_palate_hinge;
  const velum = points.profile_velum_tip;
  if (!finitePoint(ans) || !finitePoint(pns) || !finitePoint(menton)) return null;

  const scale = Number.isFinite(cmPerPx) && cmPerPx > 0 ? cmPerPx : null;
  const oclPx = dist(ans, pns);
  const lfhPx = pointLineDistance(menton, ans, pns);
  const lfhProjection = projectPointToLine(menton, ans, pns);
  const polygonPoints = [ans, pns, wall, menton].filter(finitePoint);
  const polygonAreaPx2 = polygonArea(polygonPoints);
  const palatalPlaneAngleDeg = Math.atan2(pns.y - ans.y, Math.abs(pns.x - ans.x)) * 180 / Math.PI;
  const softPalateLengthPx = finitePoint(hinge) && finitePoint(velum) ? dist(hinge, velum) : null;
  const velumGapPx = finitePoint(velum) && finitePoint(wall) ? dist(velum, wall) : null;
  const hyoidDropPx = finitePoint(points.profile_hyoid) ? pointLineDistance(points.profile_hyoid, ans, pns) : null;
  const larynxDropPx = finitePoint(points.profile_larynx) ? pointLineDistance(points.profile_larynx, ans, pns) : null;
  const rectangularAreaPx2 = Number.isFinite(oclPx) && Number.isFinite(lfhPx) ? oclPx * lfhPx : null;

  return {
    schema_version: "honda_morphological_articulatory_space_0.1",
    source_role: "Honda 2001 conceptual/schema support; not a validated subject-specific predictor",
    direction,
    points_px: {
      ans,
      pns,
      menton,
      posterior_pharyngeal_wall: wall ?? null,
      soft_palate_hinge: hinge ?? null,
      velum_tip: velum ?? null,
      lfh_projection: lfhProjection,
      articulatory_polygon: polygonPoints,
    },
    palatal_plane_angle_deg: roundMetric(palatalPlaneAngleDeg, 3),
    oral_cavity_length_px: roundMetric(oclPx),
    oral_cavity_length_cm: scale ? roundMetric(oclPx * scale) : null,
    lower_face_height_px: roundMetric(lfhPx),
    lower_face_height_cm: scale ? roundMetric(lfhPx * scale) : null,
    articulatory_space_rect_px2: roundMetric(rectangularAreaPx2),
    articulatory_space_rect_cm2: scale ? roundMetric(rectangularAreaPx2 * scale * scale) : null,
    articulatory_polygon_px2: roundMetric(polygonAreaPx2),
    articulatory_polygon_cm2: scale && polygonAreaPx2 ? roundMetric(polygonAreaPx2 * scale * scale) : null,
    soft_palate_length_px: roundMetric(softPalateLengthPx),
    soft_palate_length_cm: scale && softPalateLengthPx ? roundMetric(softPalateLengthPx * scale) : null,
    velum_to_posterior_wall_gap_px: roundMetric(velumGapPx),
    velum_to_posterior_wall_gap_cm: scale && velumGapPx ? roundMetric(velumGapPx * scale) : null,
    hyoid_drop_from_palatal_plane_px: roundMetric(hyoidDropPx),
    hyoid_drop_from_palatal_plane_cm: scale && hyoidDropPx ? roundMetric(hyoidDropPx * scale) : null,
    larynx_drop_from_palatal_plane_px: roundMetric(larynxDropPx),
    larynx_drop_from_palatal_plane_cm: scale && larynxDropPx ? roundMetric(larynxDropPx * scale) : null,
  };
}

function buildSideBranchGuides(points, hondaSpace, cmPerPx, direction) {
  const ans = points.profile_ans;
  const pns = points.profile_pns;
  const nasion = points.profile_nasion;
  const subnasale = points.profile_subnasale;
  const velum = points.profile_velum_tip;
  const wall = points.profile_posterior_pharyngeal_wall;
  const sign = direction === "right" ? 1 : -1;
  const oclPx = hondaSpace?.oral_cavity_length_px ?? (finitePoint(ans) && finitePoint(pns) ? dist(ans, pns) : 64);
  const cmScale = Number.isFinite(cmPerPx) && cmPerPx > 0 ? cmPerPx : null;
  const centerBehind = (point, behindPx, upPx = 0) => finitePoint(point) ? { x: point.x - sign * behindPx, y: point.y - upPx } : null;
  const maxillaryBase = finitePoint(ans) && finitePoint(subnasale)
    ? { x: (ans.x + subnasale.x) / 2, y: (ans.y + subnasale.y) / 2 }
    : ans;
  const frontalCenter = centerBehind(nasion, Math.max(8, oclPx * 0.16), Math.max(20, oclPx * 0.36));
  const maxillaryCenter = centerBehind(maxillaryBase, Math.max(18, oclPx * 0.35), Math.max(22, oclPx * 0.28));
  const sphenoidCenter = centerBehind(pns, Math.max(12, oclPx * 0.22), Math.max(8, oclPx * 0.14));
  const gapPx = finitePoint(velum) && finitePoint(wall) ? dist(velum, wall) : null;
  const gapCm = cmScale && gapPx ? gapPx * cmScale : null;

  return {
    schema_version: "side_branch_guides_0.1",
    paranasal_sinus_guides: [
      { key: "frontal_sinus", label: "frontal sinus", center_px: frontalCenter, radius_px: { x: Math.max(14, oclPx * 0.22), y: Math.max(8, oclPx * 0.14) }, basis: "derived from nasion and palatal-plane scale" },
      { key: "maxillary_sinus", label: "maxillary sinus", center_px: maxillaryCenter, radius_px: { x: Math.max(18, oclPx * 0.33), y: Math.max(14, oclPx * 0.24) }, basis: "derived from ANS/subnasale and palatal-plane scale" },
      { key: "sphenoid_sinus", label: "sphenoid sinus", center_px: sphenoidCenter, radius_px: { x: Math.max(12, oclPx * 0.2), y: Math.max(8, oclPx * 0.13) }, basis: "derived from PNS and palatal-plane scale" },
    ],
    velopharyngeal_port: {
      velum_tip_px: velum ?? null,
      posterior_wall_px: wall ?? null,
      gap_px: roundMetric(gapPx),
      gap_cm: roundMetric(gapCm),
      open_coupling_hint: Number.isFinite(gapCm) ? roundMetric(clamp(gapCm / 1.2, 0, 1), 3) : null,
      note: "Geometric gap guide for future nasal-leak and velopharyngeal coupling control.",
    },
  };
}

function drawHondaGuides(ctx, geometry) {
  const honda = geometry?.honda_articulatory_space;
  const sideBranches = geometry?.side_branch_guides;
  if (!honda) return;
  const points = honda.points_px ?? {};
  ctx.save();

  for (const guide of sideBranches?.paranasal_sinus_guides ?? []) {
    const center = guide.center_px;
    if (!finitePoint(center)) continue;
    ctx.beginPath();
    ctx.ellipse(center.x, center.y, guide.radius_px.x, guide.radius_px.y, 0, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(143, 96, 157, 0.12)";
    ctx.strokeStyle = "rgba(143, 96, 157, 0.58)";
    ctx.lineWidth = 1.2;
    ctx.fill();
    ctx.stroke();
  }

  const polygon = points.articulatory_polygon ?? [];
  if (polygon.length >= 3) {
    ctx.beginPath();
    polygon.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y));
    ctx.closePath();
    ctx.fillStyle = "rgba(196, 136, 54, 0.1)";
    ctx.strokeStyle = "rgba(196, 136, 54, 0.75)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);
    ctx.fill();
    ctx.stroke();
    ctx.setLineDash([]);
  }

  if (finitePoint(points.ans) && finitePoint(points.pns)) {
    ctx.strokeStyle = "rgba(196, 136, 54, 0.95)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(points.ans.x, points.ans.y);
    ctx.lineTo(points.pns.x, points.pns.y);
    ctx.stroke();
    drawGuideLabel(ctx, "ANS-PNS", (points.ans.x + points.pns.x) / 2, (points.ans.y + points.pns.y) / 2 - 10);
  }

  if (finitePoint(points.menton) && finitePoint(points.lfh_projection)) {
    ctx.strokeStyle = "rgba(196, 136, 54, 0.82)";
    ctx.lineWidth = 1.4;
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.moveTo(points.menton.x, points.menton.y);
    ctx.lineTo(points.lfh_projection.x, points.lfh_projection.y);
    ctx.stroke();
    ctx.setLineDash([]);
    drawGuideLabel(ctx, "LFH", points.menton.x + 8, (points.menton.y + points.lfh_projection.y) / 2);
  }

  if (finitePoint(points.soft_palate_hinge) && finitePoint(points.velum_tip)) {
    ctx.strokeStyle = "rgba(97, 79, 151, 0.95)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(points.soft_palate_hinge.x, points.soft_palate_hinge.y);
    ctx.lineTo(points.velum_tip.x, points.velum_tip.y);
    ctx.stroke();
  }

  if (finitePoint(points.velum_tip) && finitePoint(points.posterior_pharyngeal_wall)) {
    ctx.strokeStyle = "rgba(97, 79, 151, 0.75)";
    ctx.lineWidth = 1.4;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(points.velum_tip.x, points.velum_tip.y);
    ctx.lineTo(points.posterior_pharyngeal_wall.x, points.posterior_pharyngeal_wall.y);
    ctx.stroke();
    ctx.setLineDash([]);
    drawGuideLabel(ctx, "VP gap", (points.velum_tip.x + points.posterior_pharyngeal_wall.x) / 2, (points.velum_tip.y + points.posterior_pharyngeal_wall.y) / 2 - 10);
  }

  ctx.restore();
}

function drawGuideLabel(ctx, text, x, y) {
  ctx.save();
  ctx.font = "11px Segoe UI";
  ctx.textBaseline = "middle";
  const width = Math.ceil(ctx.measureText(text).width + 10);
  roundedRectPath(ctx, x - width / 2, y - 10, width, 20, 5);
  ctx.fillStyle = "rgba(255, 253, 248, 0.86)";
  ctx.fill();
  ctx.fillStyle = "#4e4a42";
  ctx.textAlign = "center";
  ctx.fillText(text, x, y + 0.5);
  ctx.restore();
}

function drawVocalTractOverlay(ctx, geometry) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  if (!geometry) return;
  const showTract = Boolean(els.profileShowVocalTract?.checked);
  const showArticulationGuides = Boolean(els.profileShowArticulationLandmarks?.checked);
  if (!showTract && !showArticulationGuides) return;
  ctx.save();
  ctx.lineJoin = "round";
  if (showTract) {
  for (let index = 0; index < geometry.sections.length - 1; index++) {
    const current = geometry.sections[index];
    const next = geometry.sections[index + 1];
    ctx.fillStyle = regionForPosition(current.position).color;
    ctx.beginPath();
    ctx.moveTo(current.upper.x, current.upper.y);
    ctx.lineTo(next.upper.x, next.upper.y);
    ctx.lineTo(next.lower.x, next.lower.y);
    ctx.lineTo(current.lower.x, current.lower.y);
    ctx.closePath();
    ctx.fill();
  }
  ctx.strokeStyle = "rgba(22, 72, 61, 0.9)";
  ctx.lineWidth = 2;
  for (const side of ["upper", "lower"]) {
    ctx.beginPath();
    geometry.sections.forEach((section, index) => {
      const point = section[side];
      if (index === 0) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    });
    ctx.stroke();
  }
  ctx.setLineDash([4, 5]);
  ctx.strokeStyle = "rgba(22, 72, 61, 0.54)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  geometry.sections.forEach((section, index) => index ? ctx.lineTo(section.center.x, section.center.y) : ctx.moveTo(section.center.x, section.center.y));
  ctx.stroke();
  ctx.setLineDash([]);
  geometry.sections.forEach((section, index) => {
    if (index % 6 !== 0 && index !== geometry.sections.length - 1) return;
    ctx.strokeStyle = "rgba(255, 253, 248, 0.8)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(section.upper.x, section.upper.y);
    ctx.lineTo(section.lower.x, section.lower.y);
    ctx.stroke();
  });
  }
  if (showArticulationGuides) drawHondaGuides(ctx, geometry);
  if (showTract) {
  ctx.fillStyle = "rgba(255, 253, 248, 0.9)";
  roundedRectPath(ctx, 12, 12, 188, 48, 6);
  ctx.fill();
  ctx.fillStyle = "#16483d";
  ctx.font = "12px Segoe UI";
  ctx.fillText(`2.5D声道 ${format(geometry.vocal_tract_length_cm, 1)} cm`, 22, 31);
  ctx.fillStyle = "#666257";
  ctx.fillText("側面高 + 正面幅 + 断面形状", 22, 49);
  }
  ctx.restore();
}

function drawTractProfile(geometry = state.vocalTractGeometry) {
  const canvas = els.tractProfileCanvas;
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#fffdf8";
  ctx.fillRect(0, 0, width, height);
  if (!geometry?.sections?.length) return;
  const plot = { left: 46, right: width - 18, top: 30, bottom: height - 40 };
  const sections = geometry.sections;
  const vowel = selectedVowel();
  const areaFunction = buildTubeAreaFunction(geometry, vowel, PREVIEW_SAMPLE_RATE);
  const vowelSections = areaFunction.areas_cm2.map((area, index) => ({
    position: areaFunction.areas_cm2.length > 1 ? index / (areaFunction.areas_cm2.length - 1) : 0.5,
    vowel_area_cm2: area,
    vowel_width_cm: areaFunction.cross_sections_2_5d[index]?.coronal_width_cm ?? 1,
  }));
  const maxValue = Math.max(
    6,
    ...sections.flatMap((section) => [section.area_cm2, section.frontal_width_cm, section.sagittal_diameter_cm]),
    ...areaFunction.areas_cm2,
    ...vowelSections.map((section) => section.vowel_width_cm)
  ) * 1.08;
  const xAt = (position) => plot.left + position * (plot.right - plot.left);
  const yAt = (value) => plot.bottom - value / maxValue * (plot.bottom - plot.top);
  state.areaTuningPlot = { plot, maxValue, canvasWidth: width, canvasHeight: height, vowel };

  for (const region of tractRegions) {
    ctx.fillStyle = region.color;
    ctx.fillRect(xAt(region.start), plot.top, xAt(Math.min(1, region.end)) - xAt(region.start), plot.bottom - plot.top);
    ctx.fillStyle = "#4e4a42";
    ctx.font = "11px Segoe UI";
    ctx.textAlign = "center";
    ctx.fillText(region.label, (xAt(region.start) + xAt(Math.min(1, region.end))) / 2, 19);
  }
  ctx.strokeStyle = "#b8b1a3";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(plot.left, plot.top);
  ctx.lineTo(plot.left, plot.bottom);
  ctx.lineTo(plot.right, plot.bottom);
  ctx.stroke();
  ctx.fillStyle = "#666257";
  ctx.textAlign = "right";
  for (let tick = 0; tick <= 4; tick++) {
    const value = maxValue * tick / 4;
    const y = yAt(value);
    ctx.fillText(value.toFixed(1), plot.left - 7, y + 4);
    ctx.strokeStyle = "rgba(184,177,163,0.35)";
    ctx.beginPath();
    ctx.moveTo(plot.left, y);
    ctx.lineTo(plot.right, y);
    ctx.stroke();
  }
  drawProfileLine(ctx, sections, "area_cm2", "rgba(138,84,47,0.32)", xAt, yAt, 1.5);
  drawProfileLine(ctx, vowelSections, "vowel_area_cm2", "#8a542f", xAt, yAt, 3);
  drawProfileLine(ctx, sections, "frontal_width_cm", "rgba(54,100,140,0.30)", xAt, yAt, 1.5);
  drawProfileLine(ctx, vowelSections, "vowel_width_cm", "#36648c", xAt, yAt, 2.5);
  drawProfileLine(ctx, sections, "sagittal_diameter_cm", "#236b5b", xAt, yAt, 2);
  drawAreaTuningHandles(ctx, areaFunction, xAt, yAt);
  ctx.textAlign = "center";
  ctx.fillStyle = "#666257";
  ctx.fillText(`声門からの距離 0 - ${format(geometry.vocal_tract_length_cm, 1)} cm`, (plot.left + plot.right) / 2, height - 12);
  drawChartLegend(ctx, [
    ["母音断面積 cm²", "#8a542f"],
    ["母音横幅 cm", "#36648c"],
    ["側面径 cm", "#236b5b"],
  ], plot.right - 290, plot.top + 12);
  renderTractRegionSummary(geometry.region_summary, geometry.honda_articulatory_space, geometry.side_branch_guides);
}

function drawAreaTuningHandles(ctx, areaFunction, xAt, yAt) {
  const mode = state.tractEditMode === "width" ? "width" : "area";
  const points = mode === "width"
    ? normalizedWidthTuningPoints(areaFunction.vowel_shape)
    : normalizedAreaTuningPoints(areaFunction.vowel_shape);
  const values = mode === "width"
    ? areaFunction.cross_sections_2_5d.map((section) => section.coronal_width_cm)
    : areaFunction.areas_cm2;
  const color = mode === "width" ? "#36648c" : "#8a542f";
  ctx.save();
  for (let index = 0; index < points.length; index++) {
    const point = points[index];
    const value = areaAtPositionFromArray(values, point.position);
    const x = xAt(point.position);
    const y = yAt(value);
    ctx.fillStyle = Math.abs(point.gain - 1) > 0.0001 ? "#b9472f" : "#fffdf8";
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(x, y, 6.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    const selected = state.selectedTractTuningHandle;
    if ((state.areaTuningDrag?.handleIndex === index && state.areaTuningDrag?.mode === mode)
      || (selected?.handleIndex === index && selected?.mode === mode && selected?.vowel === areaFunction.vowel_shape)) {
      ctx.strokeStyle = "rgba(185,71,47,0.35)";
      ctx.beginPath();
      ctx.moveTo(x, y - 15);
      ctx.lineTo(x, y + 15);
      ctx.moveTo(x - 15, y);
      ctx.lineTo(x + 15, y);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function areaAtPositionFromArray(areas, position) {
  if (!areas?.length) return 1;
  if (areas.length === 1) return areas[0];
  const scaled = clamp(position, 0, 1) * (areas.length - 1);
  const leftIndex = Math.floor(scaled);
  const rightIndex = Math.min(areas.length - 1, leftIndex + 1);
  const t = scaled - leftIndex;
  return areas[leftIndex] + (areas[rightIndex] - areas[leftIndex]) * t;
}

function drawTractCrossSectionProfile(geometry = state.vocalTractGeometry, vowel = selectedVowel()) {
  const canvas = els.tractCrossSectionCanvas;
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#f8f6ef";
  ctx.fillRect(0, 0, width, height);
  if (!geometry?.sections?.length) return;
  const areaFunction = buildTubeAreaFunction(geometry, vowel, PREVIEW_SAMPLE_RATE);
  const crossSections = areaFunction.cross_sections_2_5d ?? [];
  const positions = [0.16, 0.42, 0.7, 0.92];
  const maxDimension = Math.max(2.8, ...crossSections.flatMap((section) => [section.sagittal_height_cm, section.coronal_width_cm]));
  const cellWidth = width / positions.length;
  const verticalScale = Math.min((cellWidth - 42) / maxDimension, (height - 86) / maxDimension);
  ctx.fillStyle = "#16483d";
  ctx.font = "12px Segoe UI";
  ctx.textAlign = "left";
  ctx.fillText(`/${vowel}/ 2.5D cross-sections`, 14, 20);
  positions.forEach((position, slot) => {
    const index = clamp(Math.round(position * (crossSections.length - 1)), 0, Math.max(0, crossSections.length - 1));
    const section = crossSections[index];
    if (!section) return;
    const cx = cellWidth * (slot + 0.5);
    const cy = height * 0.53;
    const radiusX = Math.max(5, section.coronal_width_cm * verticalScale / 2);
    const radiusY = Math.max(5, section.sagittal_height_cm * verticalScale / 2);
    const region = regionForPosition(section.position);
    ctx.fillStyle = region.color;
    ctx.beginPath();
    ctx.ellipse(cx, cy, radiusX, radiusY, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#16483d";
    ctx.lineWidth = 1.4;
    ctx.stroke();
    if (section.lateral_channel_area_cm2 > 0.001) {
      const lateralRadiusX = Math.max(2, radiusX * 0.16);
      const lateralRadiusY = Math.max(2, radiusY * 0.36);
      ctx.fillStyle = "rgba(97, 79, 151, 0.5)";
      for (const sign of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(cx + sign * radiusX * 0.56, cy, lateralRadiusX, lateralRadiusY, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.fillStyle = "#4e4a42";
    ctx.font = "11px Segoe UI";
    ctx.textAlign = "center";
    ctx.fillText(region.label, cx, 42);
    ctx.fillText(`${(section.position * geometry.vocal_tract_length_cm).toFixed(1)} cm`, cx, height - 35);
    ctx.fillText(`H ${section.sagittal_height_cm.toFixed(2)}  W ${section.coronal_width_cm.toFixed(2)}`, cx, height - 18);
  });
  ctx.textAlign = "left";
  ctx.fillStyle = "#666257";
  ctx.font = "10px Segoe UI";
  ctx.fillText("紫: 潜在側方流路。現在の1D音響管には総断面積のみを投影。", 14, height - 4);
}

function drawProfileLine(ctx, sections, key, color, xAt, yAt, lineWidth) {
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.beginPath();
  sections.forEach((section, index) => {
    const x = xAt(section.position);
    const y = yAt(section[key]);
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
}

function drawChartLegend(ctx, items, x, y) {
  ctx.font = "11px Segoe UI";
  ctx.textAlign = "left";
  items.forEach(([label, color], index) => {
    const rowY = y + index * 18;
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, rowY);
    ctx.lineTo(x + 18, rowY);
    ctx.stroke();
    ctx.fillStyle = "#4e4a42";
    ctx.fillText(label, x + 25, rowY + 4);
  });
}

function renderTractRegionSummary(summary, hondaSpace = null, sideBranchGuides = null) {
  if (!els.tractRegionSummary) return;
  els.tractRegionSummary.innerHTML = "";
  for (const region of tractRegions) {
    const value = summary?.[region.key];
    const item = document.createElement("div");
    item.className = "tract-region-item";
    item.innerHTML = `<strong>${region.label}</strong><span>平均 ${format(value?.mean_area_cm2, 2)} cm²</span><span>最小 ${format(value?.minimum_area_cm2, 2)} cm²</span>`;
    els.tractRegionSummary.appendChild(item);
  }
  if (hondaSpace) {
    const item = document.createElement("div");
    item.className = "tract-region-item";
    const title = document.createElement("strong");
    const ocl = document.createElement("span");
    const lfh = document.createElement("span");
    title.textContent = "形態的調音空間";
    ocl.textContent = `OCL ${format(hondaSpace.oral_cavity_length_cm, 2)} cm`;
    lfh.textContent = `LFH ${format(hondaSpace.lower_face_height_cm, 2)} cm`;
    item.append(title, ocl, lfh);
    els.tractRegionSummary.appendChild(item);
  }
  if (hondaSpace || sideBranchGuides?.velopharyngeal_port) {
    const item = document.createElement("div");
    item.className = "tract-region-item";
    const title = document.createElement("strong");
    const softPalate = document.createElement("span");
    const gap = document.createElement("span");
    title.textContent = "軟口蓋・鼻咽腔";
    softPalate.textContent = `軟口蓋長 ${format(hondaSpace?.soft_palate_length_cm, 2)} cm`;
    gap.textContent = `VP gap ${format(sideBranchGuides?.velopharyngeal_port?.gap_cm ?? hondaSpace?.velum_to_posterior_wall_gap_cm, 2)} cm`;
    item.append(title, softPalate, gap);
    els.tractRegionSummary.appendChild(item);
  }
}

function buildNasalOralClosureAreaFunction(baseAreaFunction, tuning, options = {}) {
  const placeGesture = options.placeGesture
    ?? nasalPlaceGestureModel(tuning, baseAreaFunction.vocal_tract_length_cm);
  const placeGestureStrength = clamp(options.placeGestureStrength ?? 1, 0, 1);
  const closureAreaCm2 = clamp(
    options.closureAreaCm2 ?? tuning.closure_area_cm2,
    0.006,
    0.35
  );
  const closureWidth = clamp(
    options.closureWidth ?? tuning.closure_width,
    0.01,
    0.24
  );
  const areas = baseAreaFunction.areas_cm2.map((area, index) => {
    const position = baseAreaFunction.areas_cm2.length > 1 ? index / (baseAreaFunction.areas_cm2.length - 1) : 0.5;
    let gesturedArea = area;
    if (placeGesture.kind === "coronal_alveolar" && placeGestureStrength > 0) {
      const bladeDistance = (position - placeGesture.tongue_blade_center_x_over_l)
        / placeGesture.tongue_blade_spread_x_over_l;
      const bodyDistance = (position - placeGesture.tongue_body_center_x_over_l)
        / placeGesture.tongue_body_spread_x_over_l;
      const bladeWeight = Math.exp(-0.5 * bladeDistance * bladeDistance);
      const bodyWeight = Math.exp(-0.5 * bodyDistance * bodyDistance);
      const coronalCompression = clamp(
        placeGestureStrength * (0.5 * bladeWeight + 0.2 * bodyWeight),
        0,
        0.72
      );
      gesturedArea = clamp(area * (1 - coronalCompression), 0.045, 14);
    }
    const d = (position - tuning.closure_position) / closureWidth;
    const closureWeight = Math.exp(-0.5 * d * d);
    return clamp(
      gesturedArea * (1 - closureWeight) + Math.min(gesturedArea, closureAreaCm2) * closureWeight,
      0.006,
      14
    );
  });
  let anchoredClosureIndex = null;
  if (options.anchorClosureSection && areas.length) {
    anchoredClosureIndex = clamp(
      Math.round(tuning.closure_position * Math.max(0, areas.length - 1)),
      0,
      areas.length - 1
    );
    areas[anchoredClosureIndex] = clamp(
      Math.min(baseAreaFunction.areas_cm2[anchoredClosureIndex], closureAreaCm2),
      0.006,
      14
    );
  }
  const sectionLengthCm = (baseAreaFunction.vocal_tract_length_cm ?? 15.5)
    / Math.max(1, areas.length);
  const vpIndex = Math.round(placeGesture.vp_junction_position * Math.max(0, areas.length - 1));
  const contactIndex = anchoredClosureIndex
    ?? Math.round(tuning.closure_position * Math.max(0, areas.length - 1));
  const oralSideVolumeCm3 = areas
    .slice(Math.min(vpIndex, contactIndex), Math.max(vpIndex, contactIndex) + 1)
    .reduce((sum, area) => sum + area * sectionLengthCm, 0);
  return {
    schema_version: "nasal_oral_closure_area_0.3",
    closure_position: tuning.closure_position,
    closure_area_cm2: closureAreaCm2,
    closure_width: closureWidth,
    anchored_closure_index: anchoredClosureIndex,
    place_gesture: placeGesture,
    place_gesture_strength: Number(placeGestureStrength.toFixed(4)),
    oral_side_volume_cm3: Number(oralSideVolumeCm3.toFixed(4)),
    areas_cm2: areas.map((area) => Number(area.toFixed(4))),
  };
}

function drawNasalProfile() {
  const canvas = els.nasalProfileCanvas;
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#fffdf8";
  ctx.fillRect(0, 0, width, height);
  const geometry = state.vocalTractGeometry ?? buildVocalTractGeometry();
  if (!geometry?.sections?.length) return;
  const token = selectedNasalToken();
  const parsed = parseSyllableToken(token);
  const tuning = normalizedNasalTuning(nasalClassFromToken(token));
  const baseArea = buildTubeAreaFunction(geometry, parsed.vowel, PREVIEW_SAMPLE_RATE);
  const closure = buildNasalOralClosureAreaFunction(baseArea, tuning);
  const plot = { left: 46, right: width - 18, top: 28, bottom: height - 72 };
  const closureBand = { top: height - 51, bottom: height - 20 };
  const maxValue = Math.max(6, ...baseArea.areas_cm2) * 1.06;
  const xAt = (position) => plot.left + position * (plot.right - plot.left);
  const yAt = (value) => plot.bottom - value / maxValue * (plot.bottom - plot.top);
  state.nasalProfilePlot = { plot, closureBand, maxValue };

  for (const region of tractRegions) {
    ctx.fillStyle = region.color;
    ctx.fillRect(xAt(region.start), plot.top, xAt(Math.min(1, region.end)) - xAt(region.start), plot.bottom - plot.top);
    ctx.fillStyle = "#4e4a42";
    ctx.font = "11px Segoe UI";
    ctx.textAlign = "center";
    ctx.fillText(region.label, (xAt(region.start) + xAt(Math.min(1, region.end))) / 2, 18);
  }
  ctx.strokeStyle = "rgba(184,177,163,0.42)";
  ctx.lineWidth = 1;
  for (let tick = 0; tick <= 3; tick++) {
    const value = maxValue * tick / 3;
    const y = yAt(value);
    ctx.beginPath();
    ctx.moveTo(plot.left, y);
    ctx.lineTo(plot.right, y);
    ctx.stroke();
    ctx.fillStyle = "#666257";
    ctx.textAlign = "right";
    ctx.fillText(value.toFixed(1), plot.left - 7, y + 4);
  }
  const asSections = (areas, key) => areas.map((area, index) => ({
    position: areas.length > 1 ? index / (areas.length - 1) : 0.5,
    [key]: area,
  }));
  drawProfileLine(ctx, asSections(baseArea.areas_cm2, "area"), "area", "rgba(138,84,47,0.38)", xAt, yAt, 2);
  drawProfileLine(ctx, asSections(closure.areas_cm2, "area"), "area", "#36648c", xAt, yAt, 3);
  const closureX = xAt(tuning.closure_position);
  ctx.strokeStyle = "rgba(185,71,47,0.65)";
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(closureX, plot.top);
  ctx.lineTo(closureX, plot.bottom);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = "#f1efe7";
  ctx.fillRect(plot.left, closureBand.top, plot.right - plot.left, closureBand.bottom - closureBand.top);
  ctx.strokeStyle = "#b8b1a3";
  ctx.strokeRect(plot.left, closureBand.top, plot.right - plot.left, closureBand.bottom - closureBand.top);
  const areaFraction = (tuning.closure_area_cm2 - NASAL_TUNING_FIELDS.closure_area_cm2.min)
    / (NASAL_TUNING_FIELDS.closure_area_cm2.max - NASAL_TUNING_FIELDS.closure_area_cm2.min);
  const handleY = closureBand.bottom - clamp(areaFraction, 0, 1) * (closureBand.bottom - closureBand.top);
  ctx.fillStyle = "#fffdf8";
  ctx.strokeStyle = "#b9472f";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(closureX, handleY, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#666257";
  ctx.font = "11px Segoe UI";
  ctx.textAlign = "left";
  ctx.fillText("閉鎖位置 x/L・残存面積（拡大）", plot.left + 8, closureBand.top + 13);
  drawChartLegend(ctx, [
    [`/${parsed.vowel}/ 母音A(x)`, "rgba(138,84,47,0.72)"],
    ["鼻音閉鎖A(x)", "#36648c"],
  ], plot.right - 250, plot.top + 12);
}

function updateNasalProfileFromPointer(event) {
  const meta = state.nasalProfilePlot;
  if (!meta) return;
  const point = canvasPoint(event, els.nasalProfileCanvas);
  const tuningClass = nasalClassFromToken(selectedNasalToken());
  const position = (clamp(point.x, meta.plot.left, meta.plot.right) - meta.plot.left) / (meta.plot.right - meta.plot.left);
  setNasalTuningValue(tuningClass, "closure_position", position);
  if (point.y >= meta.closureBand.top - 12) {
    const fraction = (meta.closureBand.bottom - clamp(point.y, meta.closureBand.top, meta.closureBand.bottom))
      / (meta.closureBand.bottom - meta.closureBand.top);
    const definition = NASAL_TUNING_FIELDS.closure_area_cm2;
    setNasalTuningValue(tuningClass, "closure_area_cm2", definition.min + fraction * (definition.max - definition.min));
  }
  renderNasalCalibration();
  renderConstraints();
  draw();
}

function handleNasalProfilePointerDown(event) {
  state.nasalProfileDrag = { pointerId: event.pointerId };
  els.nasalProfileCanvas.setPointerCapture?.(event.pointerId);
  updateNasalProfileFromPointer(event);
  event.preventDefault();
}

function handleNasalProfilePointerMove(event) {
  if (!state.nasalProfileDrag) return;
  updateNasalProfileFromPointer(event);
  event.preventDefault();
}

function handleNasalProfilePointerUp(event) {
  if (!state.nasalProfileDrag) return;
  els.nasalProfileCanvas.releasePointerCapture?.(event.pointerId);
  state.nasalProfileDrag = null;
  renderConstraints();
  event.preventDefault();
}

function handleNasalProfileKeyDown(event) {
  const tuningClass = nasalClassFromToken(selectedNasalToken());
  const tuning = normalizedNasalTuning(tuningClass);
  const amount = event.shiftKey ? 0.025 : 0.005;
  if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
    setNasalTuningValue(tuningClass, "closure_position", tuning.closure_position + (event.key === "ArrowRight" ? amount : -amount));
  } else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
    setNasalTuningValue(tuningClass, "closure_area_cm2", tuning.closure_area_cm2 + (event.key === "ArrowUp" ? amount : -amount));
  } else {
    return;
  }
  renderNasalCalibration();
  renderConstraints();
  draw();
  event.preventDefault();
}

function draw() {
  const bodyImageCtx = els.bodyImageCanvas.getContext("2d");
  drawImage(bodyImageCtx, state.images.body, "\u5168\u8eab\u6b63\u9762\u753b\u50cf\u3092\u8aad\u307f\u8fbc\u307f");
  const bodyModelCtx = els.bodyModelCanvas.getContext("2d");
  drawBodyModel(bodyModelCtx);
  drawLandmarks(bodyModelCtx, "body", state.drag?.mode === "body" ? state.drag : null);
  drawCursorGuide(bodyModelCtx, "body", state.drag?.mode === "body" ? state.drag : null, cursorForMode("body"));

  const faceImageCtx = els.faceImageCanvas.getContext("2d");
  drawImage(faceImageCtx, state.images.face, "\u982d\u981a\u90e8\u6b63\u9762\u753b\u50cf\u3092\u8aad\u307f\u8fbc\u307f");
  const faceModelCtx = els.faceModelCanvas.getContext("2d");
  faceModelCtx.clearRect(0, 0, faceModelCtx.canvas.width, faceModelCtx.canvas.height);
  drawLandmarks(faceModelCtx, "face", state.drag?.mode === "face" ? state.drag : null);
  drawCursorGuide(faceModelCtx, "face", state.drag?.mode === "face" ? state.drag : null, cursorForMode("face"));

  const profileCtx = els.profileImageCanvas.getContext("2d");
  drawImage(profileCtx, state.images.profile, "\u982d\u981a\u90e8\u5074\u9762\u753b\u50cf\u3092\u8aad\u307f\u8fbc\u307f");
  const liveGeometry = buildVocalTractGeometry();
  const vocalTractCtx = els.vocalTractCanvas.getContext("2d");
  drawVocalTractOverlay(vocalTractCtx, liveGeometry);
  drawLandmarks(vocalTractCtx, "profile", state.profileDrag);
  drawCursorGuide(vocalTractCtx, "profile", state.profileDrag, state.profileCursor);
  drawTractProfile(state.vocalTractGeometry ?? liveGeometry);
  drawTractCrossSectionProfile(state.vocalTractGeometry ?? liveGeometry);
  drawNasalProfile();
}

// Legacy extraction helpers are kept for future comparison experiments; the current UI is manual-only.
function extractCurrentLandmarks() {
  setExtractionStatus("自動ランドマーク推定は現在のUIでは無効です。シェーマ上の点を手動で調整してください。");
}

function extractAllLandmarks() {
  setExtractionStatus("一括自動推定は現在のUIでは無効です。全身・頭頚部・側面の各点を手動で配置してください。");
}

function applyExtractionResult(mode, result, shouldAnalyze = true) {
  if (!result.points || !Object.keys(result.points).length) {
    setExtractionStatus(result.message || "特徴点を抽出できませんでした。");
    return;
  }
  state.landmarks[mode] = { ...state.landmarks[mode], ...result.points };
  state.extractionReports[mode] = {
    method: result.method,
    confidence: result.confidence,
    message: result.message,
    updated_at: new Date().toISOString(),
  };
  const modeLabel = mode === "body" ? "全身" : mode === "profile" ? "側面" : "顔";
  setExtractionStatus(`${modeLabel}の旧推定結果を適用: 信頼度 ${Math.round(result.confidence * 100)}%。${result.message}`);
  if (shouldAnalyze) analyze();
}

function setExtractionStatus(message) {
  if (els.extractionStatus) els.extractionStatus.textContent = message;
}

function extractBodyLandmarks() {
  const frame = makeAnalysisFrame("body");
  if (!frame) return { confidence: 0, points: null, message: "全身画像がありません。" };
  const mask = makeForegroundMask(frame);
  const bbox = bboxFromMask(mask, frame.width, frame.height);
  if (!bbox) return { confidence: 0, points: null, message: "前景シルエットを検出できませんでした。" };

  const height = bbox.maxY - bbox.minY + 1;
  const top = topCenter(mask, frame.width, bbox);
  const bottomRuns = runsAtBand(mask, frame.width, bbox, bbox.minY + height * 0.94, bbox.maxY);
  const leftFootRun = bottomRuns[0] || { left: bbox.minX, right: bbox.minX + bbox.width * 0.25, y: bbox.maxY };
  const rightFootRun = bottomRuns[bottomRuns.length - 1] || { left: bbox.maxX - bbox.width * 0.25, right: bbox.maxX, y: bbox.maxY };
  const shoulderRow = widestRowInRange(mask, frame.width, bbox, 0.18, 0.34);
  const hipRow = widestRowInRange(mask, frame.width, bbox, 0.48, 0.66);
  const chinY = bbox.minY + height * 0.135;

  const points = {
    head_top: top,
    chin: { x: top.x, y: chinY },
    left_shoulder: { x: shoulderRow.left, y: shoulderRow.y },
    right_shoulder: { x: shoulderRow.right, y: shoulderRow.y },
    left_hip: { x: hipRow.left, y: hipRow.y },
    right_hip: { x: hipRow.right, y: hipRow.y },
    left_foot: { x: (leftFootRun.left + leftFootRun.right) / 2, y: leftFootRun.y },
    right_foot: { x: (rightFootRun.left + rightFootRun.right) / 2, y: rightFootRun.y },
  };
  const fillRatio = mask.count / ((bbox.maxX - bbox.minX + 1) * height);
  const confidence = clamp(0.35 + fillRatio * 0.8 + (bottomRuns.length >= 2 ? 0.12 : 0), 0.2, 0.82);
  return {
    method: "silhouette_proportion_v1",
    confidence,
    points,
    message: "シルエット比率から頭頂点・オトガイ点・肩峰点・転子外突点・足底基準点を推定しました。骨性点は手動補正してください。",
  };
}

function extractFaceLandmarks() {
  const frame = makeAnalysisFrame("face");
  if (!frame) return { confidence: 0, points: null, message: "顔画像がありません。" };
  const mask = makeForegroundMask(frame);
  const bbox = bboxFromMask(mask, frame.width, frame.height) || frame.rect;
  if (!bbox) return { confidence: 0, points: null, message: "顔領域を検出できませんでした。" };

  const dark = darkPixelCloud(frame, bbox);
  const eyeBand = filterCloud(dark, bbox, 0.22, 0.55);
  const mouthBand = filterCloud(dark, bbox, 0.55, 0.78);
  const centerX = (bbox.minX + bbox.maxX) / 2;
  const leftEye = cloudCentroid(eyeBand.filter((p) => p.x < centerX), { x: bbox.minX + bbox.width * 0.36, y: bbox.minY + bbox.height * 0.38 });
  const rightEye = cloudCentroid(eyeBand.filter((p) => p.x >= centerX), { x: bbox.minX + bbox.width * 0.64, y: bbox.minY + bbox.height * 0.38 });
  const mouth = mouthExtent(mouthBand, bbox);
  const jawRow = widestRowInRange(mask, frame.width, bbox, 0.70, 0.92);
  const neckRow = widestRowInRange(mask, frame.width, bbox, 0.88, 0.98);
  const top = { x: centerX, y: bbox.minY };
  const chin = { x: centerX, y: bbox.maxY };
  const nose = {
    x: centerX,
    y: mouth ? (leftEye.y + rightEye.y) / 2 + (mouth.y - (leftEye.y + rightEye.y) / 2) * 0.55 : bbox.minY + bbox.height * 0.56,
  };

  const points = {
    face_top: top,
    chin,
    nose,
    mouth_left: mouth ? { x: mouth.left, y: mouth.y } : { x: bbox.minX + bbox.width * 0.4, y: bbox.minY + bbox.height * 0.68 },
    mouth_right: mouth ? { x: mouth.right, y: mouth.y } : { x: bbox.minX + bbox.width * 0.6, y: bbox.minY + bbox.height * 0.68 },
    pupil_left: leftEye,
    pupil_right: rightEye,
    jaw_left: { x: jawRow.left, y: jawRow.y },
    jaw_right: { x: jawRow.right, y: jawRow.y },
    neck_left: { x: neckRow.left, y: neckRow.y },
    neck_right: { x: neckRow.right, y: neckRow.y },
  };
  const confidence = clamp(0.3 + Math.min(0.25, eyeBand.length / 1400) + (mouth ? 0.18 : 0) + (mask.count ? 0.12 : 0), 0.25, 0.8);
  return {
    method: "foreground_dark_feature_cloud_v1",
    confidence,
    points,
    message: "顔シルエットと暗色パーツから頭頂点・オトガイ点・鼻下点・瞳孔中心・口角点・顎角点を推定しました。",
  };
}

function extractProfileLandmarks() {
  const frame = makeAnalysisFrame("profile");
  if (!frame) return { confidence: 0, points: null, message: "側面画像がありません。" };
  const mask = makeForegroundMask(frame);
  const bbox = bboxFromMask(mask, frame.width, frame.height) || frame.rect;
  if (!bbox) return { confidence: 0, points: null, message: "側面シルエットを検出できませんでした。" };
  const direction = profileDirectionFromMask(mask, frame.width, bbox);
  if (els.profileDirectionInput.value === "auto") els.profileDirectionInput.dataset.detected = direction;
  const sign = direction === "right" ? 1 : -1;
  const frontAt = (ratio) => {
    const row = rowExtent(mask, frame.width, bbox, bbox.minY + bbox.height * ratio);
    if (!row) return { x: (bbox.minX + bbox.maxX) / 2, y: bbox.minY + bbox.height * ratio };
    return { x: direction === "right" ? row.right : row.left, y: row.y };
  };
  const backAt = (ratio) => {
    const row = rowExtent(mask, frame.width, bbox, bbox.minY + bbox.height * ratio);
    if (!row) return { x: (bbox.minX + bbox.maxX) / 2, y: bbox.minY + bbox.height * ratio };
    return { x: direction === "right" ? row.left : row.right, y: row.y };
  };
  const noseTip = extremeFrontInRange(mask, frame.width, bbox, 0.34, 0.56, direction);
  const tragion = {
    x: backAt(0.43).x + sign * bbox.width * 0.2,
    y: bbox.minY + bbox.height * 0.43,
  };
  const neckFront = frontAt(0.91);
  const neckBack = backAt(0.91);
  const hyoid = {
    x: neckBack.x + (neckFront.x - neckBack.x) * 0.58,
    y: bbox.minY + bbox.height * 0.78,
  };
  const larynx = {
    x: neckBack.x + (neckFront.x - neckBack.x) * 0.5,
    y: bbox.minY + bbox.height * 0.87,
  };
  const points = {
    profile_vertex: topCenter(mask, frame.width, bbox),
    profile_occiput: backAt(0.32),
    profile_nasion: frontAt(0.36),
    profile_nose_tip: noseTip,
    profile_subnasale: frontAt(0.54),
    profile_lip: frontAt(0.63),
    profile_chin: frontAt(0.75),
    profile_jaw_angle: {
      x: backAt(0.73).x + sign * bbox.width * 0.1,
      y: bbox.minY + bbox.height * 0.73,
    },
    profile_tragion: tragion,
    profile_hyoid: hyoid,
    profile_larynx: larynx,
    profile_neck_front: neckFront,
    profile_neck_back: neckBack,
  };
  const confidence = clamp(0.3 + Math.min(0.22, mask.count / Math.max(1, bbox.width * bbox.height)) + (noseTip ? 0.16 : 0), 0.28, 0.7);
  return {
    method: "profile_silhouette_template_anchor_v1",
    confidence,
    points,
    message: "側面輪郭から頭頂点・オトガイ点などの外表点を抽出し、舌骨・声門は低信頼の内部推定位置として配置しました。",
  };
}

function profileDirectionFromMask(mask, width, bbox) {
  const selected = els.profileDirectionInput.value;
  if (selected === "left" || selected === "right") return selected;
  const upper = rowExtent(mask, width, bbox, bbox.minY + bbox.height * 0.28);
  const headCenter = upper ? (upper.left + upper.right) / 2 : (bbox.minX + bbox.maxX) / 2;
  let minX = bbox.maxX;
  let maxX = bbox.minX;
  const start = Math.round(bbox.minY + bbox.height * 0.34);
  const end = Math.round(bbox.minY + bbox.height * 0.56);
  for (let y = start; y <= end; y++) {
    const row = rowExtent(mask, width, bbox, y);
    if (!row) continue;
    minX = Math.min(minX, row.left);
    maxX = Math.max(maxX, row.right);
  }
  return maxX - headCenter >= headCenter - minX ? "right" : "left";
}

function extremeFrontInRange(mask, width, bbox, startRatio, endRatio, direction) {
  const start = Math.round(bbox.minY + bbox.height * startRatio);
  const end = Math.round(bbox.minY + bbox.height * endRatio);
  let best = null;
  for (let y = start; y <= end; y++) {
    const row = rowExtent(mask, width, bbox, y);
    if (!row) continue;
    const x = direction === "left" ? row.left : row.right;
    if (!best || (direction === "left" ? x < best.x : x > best.x)) best = { x, y };
  }
  return best ?? { x: direction === "left" ? bbox.minX : bbox.maxX, y: (start + end) / 2 };
}

function makeAnalysisFrame(mode) {
  const image = state.images[mode];
  if (!image) return null;
  const sourceCanvas = mode === "profile" ? els.profileImageCanvas : frontCanvasForMode(mode);
  const width = sourceCanvas.width;
  const height = sourceCanvas.height;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.clearRect(0, 0, width, height);
  const scale = Math.min(width / image.width, height / image.height);
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;
  const x = (width - drawWidth) / 2;
  const y = (height - drawHeight) / 2;
  ctx.drawImage(image, x, y, drawWidth, drawHeight);
  return {
    width,
    height,
    rect: { minX: Math.floor(x), minY: Math.floor(y), maxX: Math.ceil(x + drawWidth - 1), maxY: Math.ceil(y + drawHeight - 1), width: drawWidth, height: drawHeight },
    data: ctx.getImageData(0, 0, width, height).data,
  };
}

function makeForegroundMask(frame) {
  const { width, height, data, rect } = frame;
  const mask = new Uint8Array(width * height);
  const bg = estimateBackgroundColor(frame);
  let count = 0;
  for (let y = rect.minY; y <= rect.maxY; y++) {
    for (let x = rect.minX; x <= rect.maxX; x++) {
      const i = (y * width + x) * 4;
      const alpha = data[i + 3];
      if (alpha < 20) continue;
      const distance = colorDistance(data[i], data[i + 1], data[i + 2], bg);
      const notBackground = alpha < 245 || distance > 42;
      if (notBackground) {
        mask[y * width + x] = 1;
        count++;
      }
    }
  }
  mask.count = count;
  return mask;
}

function estimateBackgroundColor(frame) {
  const { width, data, rect } = frame;
  const samples = [];
  const points = [
    [rect.minX + 4, rect.minY + 4],
    [rect.maxX - 4, rect.minY + 4],
    [rect.minX + 4, rect.maxY - 4],
    [rect.maxX - 4, rect.maxY - 4],
  ];
  for (const [x, y] of points) {
    const i = (Math.round(y) * width + Math.round(x)) * 4;
    if (data[i + 3] > 20) samples.push([data[i], data[i + 1], data[i + 2]]);
  }
  if (!samples.length) return [245, 243, 238];
  return samples.reduce((acc, rgb) => [acc[0] + rgb[0] / samples.length, acc[1] + rgb[1] / samples.length, acc[2] + rgb[2] / samples.length], [0, 0, 0]);
}

function colorDistance(r, g, b, bg) {
  return Math.hypot(r - bg[0], g - bg[1], b - bg[2]);
}

function bboxFromMask(mask, width, height) {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!mask[y * width + x]) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < minX || maxY < minY) return null;
  return { minX, minY, maxX, maxY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

function rowExtent(mask, width, bbox, y) {
  const yy = Math.max(bbox.minY, Math.min(bbox.maxY, Math.round(y)));
  let left = null;
  let right = null;
  for (let x = bbox.minX; x <= bbox.maxX; x++) {
    if (!mask[yy * width + x]) continue;
    if (left == null) left = x;
    right = x;
  }
  return left == null ? null : { left, right, y: yy, width: right - left + 1 };
}

function widestRowInRange(mask, width, bbox, startRatio, endRatio) {
  const start = Math.round(bbox.minY + bbox.height * startRatio);
  const end = Math.round(bbox.minY + bbox.height * endRatio);
  let best = null;
  for (let y = start; y <= end; y++) {
    const row = rowExtent(mask, width, bbox, y);
    if (row && (!best || row.width > best.width)) best = row;
  }
  return best || { left: bbox.minX, right: bbox.maxX, y: Math.round((start + end) / 2), width: bbox.width };
}

function topCenter(mask, width, bbox) {
  for (let y = bbox.minY; y <= bbox.maxY; y++) {
    const row = rowExtent(mask, width, bbox, y);
    if (row && row.width >= Math.max(2, bbox.width * 0.02)) {
      return { x: (row.left + row.right) / 2, y };
    }
  }
  return { x: (bbox.minX + bbox.maxX) / 2, y: bbox.minY };
}

function runsAtBand(mask, width, bbox, startY, endY) {
  const histogram = new Array(bbox.width).fill(0);
  const start = Math.round(startY);
  const end = Math.round(endY);
  for (let y = start; y <= end; y++) {
    for (let x = bbox.minX; x <= bbox.maxX; x++) {
      if (mask[y * width + x]) histogram[x - bbox.minX]++;
    }
  }
  const threshold = Math.max(1, Math.round((end - start + 1) * 0.2));
  const runs = [];
  let runStart = null;
  for (let i = 0; i < histogram.length; i++) {
    if (histogram[i] >= threshold && runStart == null) runStart = i;
    if ((histogram[i] < threshold || i === histogram.length - 1) && runStart != null) {
      const runEnd = histogram[i] < threshold ? i - 1 : i;
      if (runEnd - runStart > bbox.width * 0.025) runs.push({ left: bbox.minX + runStart, right: bbox.minX + runEnd, y: bbox.maxY });
      runStart = null;
    }
  }
  return runs;
}

function darkPixelCloud(frame, bbox) {
  const cloud = [];
  const { width, data } = frame;
  for (let y = bbox.minY; y <= bbox.maxY; y++) {
    for (let x = bbox.minX; x <= bbox.maxX; x++) {
      const i = (y * width + x) * 4;
      if (data[i + 3] < 20) continue;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      const redMouth = r > 90 && r > g * 1.25 && r > b * 1.2;
      if (luma < 95 || redMouth) cloud.push({ x, y, r, g, b, luma, redMouth });
    }
  }
  return cloud;
}

function filterCloud(cloud, bbox, startRatio, endRatio) {
  const start = bbox.minY + bbox.height * startRatio;
  const end = bbox.minY + bbox.height * endRatio;
  return cloud.filter((p) => p.y >= start && p.y <= end);
}

function cloudCentroid(cloud, fallback) {
  if (!cloud.length) return fallback;
  const sorted = [...cloud].sort((a, b) => a.luma - b.luma).slice(0, Math.max(12, Math.floor(cloud.length * 0.45)));
  const sum = sorted.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
  return { x: sum.x / sorted.length, y: sum.y / sorted.length };
}

function mouthExtent(cloud, bbox) {
  const mouthPixels = cloud.filter((p) => p.redMouth || p.luma < 120);
  if (mouthPixels.length < 8) return null;
  const xs = mouthPixels.map((p) => p.x).sort((a, b) => a - b);
  const ys = mouthPixels.map((p) => p.y).sort((a, b) => a - b);
  const left = quantile(xs, 0.08);
  const right = quantile(xs, 0.92);
  const y = quantile(ys, 0.55);
  if (right - left < bbox.width * 0.05) return null;
  return { left, right, y };
}

function quantile(sorted, q) {
  if (!sorted.length) return 0;
  const index = Math.max(0, Math.min(sorted.length - 1, Math.round((sorted.length - 1) * q)));
  return sorted[index];
}

function currentImageCalibration() {
  return landmarkSystem.computeCalibration({
    body: state.landmarks.body,
    face: state.landmarks.face,
    profile: state.landmarks.profile,
    heightCm: num(els.heightInput, 158),
    interpupillaryReferenceCm: cohortCenter("interpupillary_width_cm"),
  });
}

function observationFromLandmarks(calibration = currentImageCalibration()) {
  const heightCm = num(els.heightInput, 158);
  const body = state.landmarks.body;
  const face = state.landmarks.face;
  const bodyScaleCmPerPx = calibration.views.body_front.cm_per_px;
  const faceScaleCmPerPx = calibration.views.head_front.cm_per_px;
  const headHeightCm = calibration.shared_total_head_height.value_cm;
  const bodyScalePoints = [body.head_top, body.left_foot, body.right_foot];
  const frontScalePoints = calibration.shared_total_head_height.source === "body_stature_vertex_to_gnathion"
    ? [face.face_top, face.chin, body.head_top, body.chin, body.left_foot, body.right_foot]
    : [face.face_top, face.chin, face.pupil_left, face.pupil_right];

  return {
    shoulder_width_cm: measurement(landmarkSystem.horizontalDistance(body.left_shoulder, body.right_shoulder), bodyScaleCmPerPx, [body.left_shoulder, body.right_shoulder, ...bodyScalePoints]),
    torso_length_cm: measurement(landmarkSystem.verticalDistance(mid(body.left_shoulder, body.right_shoulder), mid(body.left_hip, body.right_hip)), bodyScaleCmPerPx, [body.left_shoulder, body.right_shoulder, body.left_hip, body.right_hip, ...bodyScalePoints]),
    pelvis_width_cm: measurement(landmarkSystem.horizontalDistance(body.left_hip, body.right_hip), bodyScaleCmPerPx, [body.left_hip, body.right_hip, ...bodyScalePoints]),
    head_units: {
      value: headHeightCm ? heightCm / headHeightCm : null,
      confidence: confidenceFromPoints([body.head_top, body.chin, body.left_foot, body.right_foot]),
    },
    lower_face_height_cm: measurement(landmarkSystem.verticalDistance(face.nose, face.chin), faceScaleCmPerPx, [face.nose, face.chin, ...frontScalePoints]),
    mouth_width_cm: measurement(landmarkSystem.horizontalDistance(face.mouth_left, face.mouth_right), faceScaleCmPerPx, [face.mouth_left, face.mouth_right, ...frontScalePoints]),
    interpupillary_width_cm: measurement(landmarkSystem.horizontalDistance(face.pupil_left, face.pupil_right), faceScaleCmPerPx, [face.pupil_left, face.pupil_right, ...frontScalePoints]),
    jaw_width_cm: measurement(landmarkSystem.horizontalDistance(face.jaw_left, face.jaw_right), faceScaleCmPerPx, [face.jaw_left, face.jaw_right, ...frontScalePoints]),
    neck_root_width_cm: measurement(landmarkSystem.horizontalDistance(face.neck_left, face.neck_right), faceScaleCmPerPx, [face.neck_left, face.neck_right, ...frontScalePoints]),
  };
}

function measurement(px, scale, points) {
  return {
    value: px && scale ? px * scale : null,
    confidence: confidenceFromPoints(points),
  };
}

function applyConstraintOverrides() {
  for (const [key, value] of Object.entries(state.constraintOverrides)) {
    const item = state.constraints[key];
    if (!item || item.center == null || !Number.isFinite(value)) continue;
    const bounds = item.edit_range ?? item.design_bounds ?? null;
    const min = Number(bounds?.min);
    const max = Number(bounds?.max);
    const bounded = Number.isFinite(min) && Number.isFinite(max) && max > min ? clamp(value, min, max) : value;
    item.center = Number(bounded.toFixed(4));
    item.user_override = true;
  }
}

function refreshDerivedConstraintCenters(changedKey = null) {
  const constraints = state.constraints;
  if (!constraints || !Object.keys(constraints).length) return false;
  let changed = false;
  const update = (key, value) => {
    const item = constraints[key];
    if (!item || !Number.isFinite(value) || Math.abs(Number(item.center) - value) < 0.0001) return;
    constraints[key] = recenteredConstraint(item, value);
    changed = true;
  };

  update("f0_mean_hz", currentDerivedF0(constraints));

  const volumeChanged = changedKey == null || changedKey === "thoracic_volume_l" || changedKey === "abdominal_volume_l";
  if (volumeChanged && !Number.isFinite(state.constraintOverrides.maximum_ventilation_l_min)
    && !constraints.maximum_ventilation_l_min?.user_override) {
    update("maximum_ventilation_l_min", derivedMaximumVentilationFromVolumes(constraints));
    const ventilationItem = constraints.maximum_ventilation_l_min;
    if (ventilationItem?.derivation) {
      ventilationItem.derivation = {
        ...ventilationItem.derivation,
        structural_capacity_ceiling_l_min: Number(structuralVentilationCapacityFromVolumes(constraints, ventilationItem.derivation).toFixed(4)),
      };
    }
  }
  if ((changedKey == null || changedKey === "thoracic_volume_l")
    && !Number.isFinite(state.constraintOverrides.body_resonance_frequency_hz)
    && !constraints.body_resonance_frequency_hz?.user_override) {
    update("body_resonance_frequency_hz", bodyResonanceFrequencyFromThoracicVolume(constraints));
  }
  return changed;
}

function applyPerformanceRangeOverrides() {
  for (const [key, override] of Object.entries(state.performanceRangeOverrides)) {
    const item = state.constraints[key];
    if (!item || item.center == null || !override) continue;
    const center = Number(item.center);
    const min = Number(override.min);
    const max = Number(override.max);
    if (!Number.isFinite(center) || !Number.isFinite(min) || !Number.isFinite(max)) continue;
    const normalized = {
      min: Number(Math.min(min, center).toFixed(4)),
      max: Number(Math.max(max, center).toFixed(4)),
      basis: override.basis ?? "user-defined PerformanceControlRange around the character baseline",
      user_override: true,
    };
    item.performance_control_range = normalized;
    item.constraint_range = { ...normalized };
  }
}

function selectedImageWeight() {
  return clamp(num(els.globalImageWeight, 0.7), 0, 1);
}

function renderImageWeightRecalculationState() {
  const selected = selectedImageWeight();
  const applied = Number(state.appliedImageWeight);
  const pending = !Number.isFinite(applied) || Math.abs(selected - applied) >= 0.0001;
  if (els.globalImageWeightValue) els.globalImageWeightValue.textContent = selected.toFixed(2);
  if (els.detailRecalculationStatus) {
    els.detailRecalculationStatus.textContent = pending
      ? `未反映（寄与 ${selected.toFixed(2)}・再計算が必要）`
      : `反映済み（寄与 ${selected.toFixed(2)}）`;
  }
  els.recalculateBtn?.classList.toggle("pending", pending);
  return { selected, applied: Number.isFinite(applied) ? applied : null, pending };
}

function analyze() {
  const calibration = currentImageCalibration();
  state.calibration = calibration;
  const observations = observationFromLandmarks(calibration);
  const globalWeight = selectedImageWeight();
  const sex = els.sexInput.value;
  const priorContext = currentPriorContext();
  const features = {};
  const priorResolution = {};
  for (const [key, def] of Object.entries(featureDefs)) {
    const prior = priorResolver.resolveFeaturePrior(key, def, priorContext);
    const observed = observations[key]?.value;
    const confidence = observations[key]?.confidence ?? 0;
    const mean = prior.median;
    const sd = prior.sd;
    const imageWeight = observed == null ? 0 : Math.max(0, Math.min(1, globalWeight * confidence));
    const integrated = observed == null ? mean : imageWeight * observed + (1 - imageWeight) * mean;
    priorResolution[key] = prior;
    features[key] = {
      label: def.label,
      unit: def.unit,
      image_value: observed,
      statistical_mean: prior.mean,
      statistical_median: prior.median,
      statistical_center_kind: prior.median_source === "source_table" ? "median" : "mean_proxy_for_median",
      statistical_sd: sd,
      integrated,
      scale: integrated / mean,
      z_score: (integrated - mean) / sd,
      image_weight: imageWeight,
      confidence,
      prior_source: prior.source,
      source_note: prior.source_note,
      evidence: prior.evidence,
      evidence_label: sourceLabel(prior.evidence),
      evidence_level: prior.evidence_level,
      source_set: prior.source_set,
      resolver_status: prior.resolver_status,
      prior_warnings: prior.warnings,
      source: observed == null ? "statistical_prior" : "image_and_statistical_prior",
    };
  }
  applyMouthWidthInference(features, priorResolution, normalizeReferenceImageStyle(els.referenceImageStyleInput?.value));
  state.features = features;
  state.priorResolution = priorResolution;
  state.constraints = mapVoiceConstraints(features);
  state.constraintOverrides = withoutReadOnlyDerivedOverrides(state.constraintOverrides);
  applyConstraintOverrides();
  refreshDerivedConstraintCenters();
  applyPerformanceRangeOverrides();
  state.vocalTractGeometry = buildVocalTractGeometry();
  state.appliedImageWeight = globalWeight;
  state.analysisRevision += 1;
  state.lastWav = null;
  renderDetailControls();
  renderCompositionGuide();
  renderCalibrationSummary();
  renderFeatureTable();
  renderConstraints();
  renderImageWeightRecalculationState();
  draw();
}

function resetConstraintCentersForAnalysis() {
  // Explicit analysis returns slider centers to the current estimate while
  // preserving separately edited PerformanceControlRange bounds.
  state.constraintOverrides = {};
}

function runBasicAnalysis() {
  resetConstraintCentersForAnalysis();
  analyze();
  setExtractionStatus("解析完了。基本情報と手動特徴点から推定値を更新しました。");
}

function runDetailRecalculation() {
  resetConstraintCentersForAnalysis();
  analyze();
}

function normalizeReferenceImageStyle(value) {
  return value === "photo_realistic" ? "photo_realistic" : "illustration";
}

function inferMouthWidthModel(mouthFeature, jawFeature, mouthPrior, jawPrior, referenceImageStyle = "illustration") {
  const visualStyle = normalizeReferenceImageStyle(referenceImageStyle);
  const mouthCenter = mouthPrior?.median ?? mouthFeature?.statistical_median ?? 4.85;
  const jawCenter = jawPrior?.median ?? jawFeature?.statistical_median ?? 11.1;
  const mouthSd = Math.max(0.1, mouthPrior?.sd ?? mouthFeature?.statistical_sd ?? 0.45);
  const jawWidth = jawFeature?.integrated ?? jawCenter;
  const depictedWidth = mouthFeature?.image_value;
  const fusedWidth = mouthFeature?.integrated ?? mouthCenter;
  const populationRatio = mouthCenter / Math.max(1, jawCenter);
  const jawConditionedEstimate = jawWidth * populationRatio;
  const statisticalEstimate = jawConditionedEstimate * 0.7 + mouthCenter * 0.3;
  const depictedRatio = Number.isFinite(depictedWidth) ? depictedWidth / Math.max(0.1, statisticalEstimate) : 1;
  const stylizationCorrection = visualStyle === "illustration" ? clamp((0.92 - depictedRatio) / 0.42, 0, 1) : 0;
  const statisticalWeight = visualStyle === "illustration" ? 0.55 + stylizationCorrection * 0.35 : 0.28;
  const relaxedEstimate = clamp(
    fusedWidth * (1 - statisticalWeight) + statisticalEstimate * statisticalWeight,
    Math.max(2.2, statisticalEstimate - mouthSd * 2.5),
    statisticalEstimate + mouthSd * 2.5
  );
  const pursedEstimate = visualStyle === "illustration"
    ? clamp(Number.isFinite(depictedWidth) ? depictedWidth : relaxedEstimate * 0.76, relaxedEstimate * 0.5, relaxedEstimate * 0.95)
    : relaxedEstimate * 0.72;
  const spreadEstimate = relaxedEstimate * (visualStyle === "illustration" ? 1.24 : 1.16);
  return {
    schema_version: "mouth_width_inference_0.1",
    reference_image_style: visualStyle,
    depicted_width_cm: Number.isFinite(depictedWidth) ? Number(depictedWidth.toFixed(4)) : null,
    image_fused_width_cm: Number(fusedWidth.toFixed(4)),
    jaw_conditioned_statistical_estimate_cm: Number(jawConditionedEstimate.toFixed(4)),
    relaxed_estimate_cm: Number(relaxedEstimate.toFixed(4)),
    pursed_estimate_cm: Number(pursedEstimate.toFixed(4)),
    spread_estimate_cm: Number(spreadEstimate.toFixed(4)),
    depicted_to_statistical_ratio: Number(depictedRatio.toFixed(4)),
    stylization_correction_weight: Number(stylizationCorrection.toFixed(4)),
    population_mouth_to_jaw_ratio: Number(populationRatio.toFixed(4)),
    basis: visualStyle === "illustration"
      ? "depicted commissure width is treated as a pursed/stylized lower-bound proxy; relaxed width is inferred primarily from jaw breadth and the bundled aggregate-center ratio"
      : "depicted commissure width is treated as a realistic relaxed-width observation and blended conservatively with the jaw-conditioned aggregate-center estimate",
  };
}

function applyMouthWidthInference(features, priorResolution, referenceImageStyle = "illustration") {
  const mouthFeature = features.mouth_width_cm;
  const jawFeature = features.jaw_width_cm;
  if (!mouthFeature || !jawFeature) return;
  const model = inferMouthWidthModel(
    mouthFeature,
    jawFeature,
    priorResolution.mouth_width_cm,
    priorResolution.jaw_width_cm,
    referenceImageStyle
  );
  mouthFeature.image_fused_before_stylization_correction = mouthFeature.integrated;
  mouthFeature.observation_label = mouthFeature.label;
  mouthFeature.label = "推定安静口裂幅（画像口角点から補正）";
  mouthFeature.integrated = model.relaxed_estimate_cm;
  mouthFeature.scale = model.relaxed_estimate_cm / Math.max(0.1, mouthFeature.statistical_median);
  mouthFeature.z_score = (model.relaxed_estimate_cm - mouthFeature.statistical_median) / Math.max(0.1, mouthFeature.statistical_sd);
  mouthFeature.articulatory_baseline_cm = model.relaxed_estimate_cm;
  mouthFeature.performance_width_range_cm = {
    min: model.pursed_estimate_cm,
    center: model.relaxed_estimate_cm,
    max: model.spread_estimate_cm,
  };
  mouthFeature.mouth_width_inference = model;
  mouthFeature.source = "depicted_lower_bound_and_jaw_conditioned_prior";
  mouthFeature.source_note = `${mouthFeature.source_note} The depicted width is retained as a stylized/pursed proxy; the articulatory baseline is jaw-conditioned.`;
}

function currentPriorContext() {
  return {
    age: num(els.ageInput, 17),
    sex: sexClass(),
    height_cm: num(els.heightInput, 158),
    weight_kg: num(els.weightInput, 47),
    population: els.populationInput.value,
    reference_image_style: normalizeReferenceImageStyle(els.referenceImageStyleInput?.value),
    sourceSet: els.dataSourceInput?.value ?? "current_mvp",
  };
}

function calculatedBmi() {
  const heightCm = num(els.heightInput, 0);
  const weightKg = num(els.weightInput, 0);
  if (!heightCm || !weightKg) return null;
  const heightM = heightCm / 100;
  return weightKg / (heightM * heightM);
}

function bmiClassLabel(bmi) {
  if (bmi == null) return "身長・体重を入力";
  if (bmi < 18.5) return "BMI区分: やせ";
  if (bmi < 25) return "BMI区分: 普通";
  return "BMI区分: 肥満";
}

function activeBodyCompositionGuide(context = currentPriorContext()) {
  const guides = referenceData.bodyCompositionGuides ?? {};
  const guide = guides.young_japanese_female_bia_18_19;
  if (!guide) return { guide: null, available: false, reason: "体脂肪率分布ガイドは未搭載です。" };
  const sexMatch = context.sex === guide.sex;
  const ageMatch = context.age >= guide.age_min && context.age <= guide.age_max;
  return {
    guide,
    available: sexMatch && ageMatch,
    sexMatch,
    ageMatch,
    reason: !sexMatch
      ? "現在の性別区分に対応する体脂肪率分布ガイドは未搭載です。"
      : !ageMatch
        ? "現在の年齢に対応する体脂肪率分布ガイドは未搭載です。"
        : null,
  };
}

function allowsJapaneseAggregateBodyComposition(context = currentPriorContext()) {
  return context.population === "Japanese_public_aggregate" || context.sourceSet === "japanese_age_band_planned";
}

function selectBodyCompositionGroupForSex(guide, sex, age) {
  const groups = guide?.groups?.[sex] ?? [];
  if (!groups.length) return null;
  const exact = groups.find((group) => age >= group.age_min && age <= group.age_max) ?? null;
  const nearest = groups
    .map((group) => ({ group, distance: Math.abs(age - group.age_center) }))
    .sort((a, b) => a.distance - b.distance)[0];
  const selected = exact ?? nearest?.group ?? null;
  if (!selected) return null;
  return {
    sex,
    group: selected,
    exact_age_band: Boolean(exact),
    age_distance: Number(Math.abs(age - selected.age_center).toFixed(4)),
  };
}

function averageStatObjects(left, right) {
  if (!left && !right) return null;
  const values = [left, right].filter(Boolean);
  const meanValues = values.map((value) => value.mean).filter((value) => Number.isFinite(value));
  if (!meanValues.length) return null;
  const result = {
    mean: Number((meanValues.reduce((sum, value) => sum + value, 0) / meanValues.length).toFixed(4)),
  };
  const sdValues = values.map((value) => value.sd).filter((value) => Number.isFinite(value));
  if (sdValues.length) {
    result.sd = Number((sdValues.reduce((sum, value) => sum + value, 0) / sdValues.length).toFixed(4));
  }
  const percentValues = values.map((value) => value.percent_of_body_weight).filter((value) => Number.isFinite(value));
  if (percentValues.length) {
    result.percent_of_body_weight = Number((percentValues.reduce((sum, value) => sum + value, 0) / percentValues.length).toFixed(4));
  }
  return result;
}

function averageBodyCompositionGroups(left, right) {
  if (!left || !right) return null;
  const metricKeys = [
    "height_cm",
    "weight_kg",
    "bmi",
    "body_fat_mass_kg",
    "body_fat_percent",
    "subcutaneous_fat_kg",
    "internal_fat_kg",
    "lean_body_mass_kg",
    "lbm_to_fat_ratio",
    "triceps_skinfold_mm",
    "subscapular_skinfold_mm",
    "waist_hip_ratio",
  ];
  const group = {
    id: `neutral_${left.id}_${right.id}`,
    label: `neutral mean (${left.label} / ${right.label})`,
    age_min: Math.min(left.age_min, right.age_min),
    age_max: Math.max(left.age_max, right.age_max),
    age_center: Number(((left.age_center + right.age_center) / 2).toFixed(4)),
    derived: true,
  };
  for (const key of metricKeys) {
    const value = averageStatObjects(left[key], right[key]);
    if (value) group[key] = value;
  }
  return group;
}

function resolveJapaneseBodyCompositionReference(context = currentPriorContext()) {
  const guide = referenceData.bodyCompositionGuides?.japanese_body_composition_komiya_1997;
  if (!guide || !allowsJapaneseAggregateBodyComposition(context)) return null;
  if (context.sex === "male" || context.sex === "female") {
    const selected = selectBodyCompositionGroupForSex(guide, context.sex, context.age);
    if (!selected) return null;
    return {
      guide,
      sex: context.sex,
      group: selected.group,
      exact_age_band: selected.exact_age_band,
      status: selected.exact_age_band ? "public_aggregate_mean" : "nearest_public_aggregate_mean_proxy",
      source: guide.source,
      label: selected.exact_age_band ? selected.group.label : `${selected.group.label} nearest proxy`,
      note: selected.exact_age_band
        ? `${guide.scope_note} Current age falls within the extracted age band.`
        : `${guide.scope_note} No exact age band is embedded; nearest group center is used as a weak proxy.`,
    };
  }
  const male = selectBodyCompositionGroupForSex(guide, "male", context.age);
  const female = selectBodyCompositionGroupForSex(guide, "female", context.age);
  const group = averageBodyCompositionGroups(male?.group, female?.group);
  if (!group) return null;
  return {
    guide,
    sex: "neutral",
    group,
    exact_age_band: Boolean(male?.exact_age_band && female?.exact_age_band),
    status: male?.exact_age_band && female?.exact_age_band ? "sex_averaged_public_aggregate_mean" : "sex_averaged_nearest_mean_proxy",
    source: guide.source,
    label: group.label,
    note: `${guide.scope_note} Neutral is a simple male/female aggregate average and is not a source-table value.`,
  };
}

function ageBandEntry(entries = [], age) {
  return entries.find((entry) => age >= entry.age_min && age <= entry.age_max) ?? null;
}

function resolveAdultBmiFallback(context = currentPriorContext()) {
  const table = referenceData.bodyCompositionGuides?.general_adult_bmi_nhanes_2011_2014;
  if (!table || context.age < table.age_min || context.age > table.age_max) return null;
  const sex = context.sex === "male" || context.sex === "female" ? context.sex : "neutral";
  if (sex === "neutral") {
    const male = ageBandEntry(table.percentile_50_by_age_band.male, context.age);
    const female = ageBandEntry(table.percentile_50_by_age_band.female, context.age);
    if (!male || !female) return null;
    return {
      median: (male.median + female.median) / 2,
      age_band: `${male.age_min}-${male.age_max}`,
      source: table.source,
      note: `${table.scope_note} neutralは男女中央値の単純平均。`,
    };
  }
  const entry = ageBandEntry(table.percentile_50_by_age_band[sex], context.age);
  if (!entry) return null;
  return {
    median: entry.median,
    age_band: `${entry.age_min}-${entry.age_max}`,
    source: table.source,
    note: table.scope_note,
  };
}

function resolveBmiReference(context = currentPriorContext()) {
  const active = activeBodyCompositionGuide(context);
  if (active.available) {
    return {
      value: active.guide.bmi_median_proxy,
      label: `${active.guide.age_band_label} grouped median proxy`,
      source: active.guide.source,
      note: active.guide.bmi_median_proxy_basis,
      status: "grouped_median_proxy",
    };
  }
  const japaneseReference = resolveJapaneseBodyCompositionReference(context);
  if (japaneseReference?.group?.bmi?.mean != null) {
    return {
      value: japaneseReference.group.bmi.mean,
      label: `${japaneseReference.label} mean proxy`,
      source: japaneseReference.source,
      note: `${japaneseReference.note} BMI is a source-table mean, not a median.`,
      status: japaneseReference.status,
    };
  }
  const adultFallback = resolveAdultBmiFallback(context);
  if (adultFallback) {
    return {
      value: adultFallback.median,
      label: `${adultFallback.age_band} adult General fallback`,
      source: adultFallback.source,
      note: adultFallback.note,
      status: context.population === "Japanese_public_aggregate" ? "non_japanese_general_fallback" : "public_aggregate_median",
    };
  }
  return {
    value: null,
    label: "未搭載",
    source: null,
    note: active.reason ?? "この年齢階級のBMI中央値はまだ参照データ化していません。",
    status: "missing_age_band_median",
  };
}

function sexCodeForBodyFatFormula(sex = sexClass()) {
  if (sex === "male") return 1;
  if (sex === "female") return 0;
  return 0.5;
}

function formulaBodyFatEstimate(context = currentPriorContext(), bmi = calculatedBmi()) {
  const guide = referenceData.bodyCompositionGuides?.deurenberg_body_fat_formula;
  if (!guide || bmi == null) return null;
  const sexCode = sexCodeForBodyFatFormula(context.sex);
  const raw = context.age <= 15
    ? 1.51 * bmi - 0.7 * context.age - 3.6 * sexCode + 1.4
    : 1.2 * bmi + 0.23 * context.age - 10.8 * sexCode - 5.4;
  return {
    value: Number(clamp(raw, 3, 65).toFixed(2)),
    source: guide.source,
    formula: context.age <= 15 ? guide.child_formula : guide.adult_formula,
    note: guide.scope_note,
  };
}

function averageSkinfoldSexData(guide, key) {
  const male = guide.sites?.male?.[key];
  const female = guide.sites?.female?.[key];
  if (!male && !female) return null;
  const values = [male, female].filter(Boolean);
  return {
    label: values[0].label,
    mean_mm: values.reduce((sum, value) => sum + value.mean_mm, 0) / values.length,
    sd_mm: values.reduce((sum, value) => sum + value.sd_mm, 0) / values.length,
    slope_mm_per_body_fat_percent: values.reduce((sum, value) => sum + value.slope_mm_per_body_fat_percent, 0) / values.length,
  };
}

function skinfoldSexReference(guide, sex) {
  if (sex === "male" || sex === "female") {
    return {
      meanBodyFat: guide.mean_body_fat_percent?.[sex]?.mean ?? null,
      sites: guide.sites?.[sex] ?? {},
      sex,
    };
  }
  const maleBodyFat = guide.mean_body_fat_percent?.male?.mean;
  const femaleBodyFat = guide.mean_body_fat_percent?.female?.mean;
  const siteKeys = new Set([
    ...Object.keys(guide.sites?.male ?? {}),
    ...Object.keys(guide.sites?.female ?? {}),
  ]);
  const sites = {};
  for (const key of siteKeys) {
    const value = averageSkinfoldSexData(guide, key);
    if (value) sites[key] = value;
  }
  return {
    meanBodyFat: Number.isFinite(maleBodyFat) && Number.isFinite(femaleBodyFat) ? (maleBodyFat + femaleBodyFat) / 2 : null,
    sites,
    sex: "neutral",
  };
}

function estimateRegionalSkinfold(context = currentPriorContext(), bodyFatPercent = null) {
  const guide = referenceData.bodyCompositionGuides?.regional_skinfold_response_1996;
  if (!guide || bodyFatPercent == null) return null;
  const reference = skinfoldSexReference(guide, context.sex);
  if (reference.meanBodyFat == null) return null;
  const delta = bodyFatPercent - reference.meanBodyFat;
  const sites = {};
  for (const [key, site] of Object.entries(reference.sites)) {
    const estimated = clamp(site.mean_mm + site.slope_mm_per_body_fat_percent * delta, 0, 80);
    sites[key] = {
      label: site.label,
      estimated_mm: Number(estimated.toFixed(4)),
      reference_mean_mm: Number(site.mean_mm.toFixed(4)),
      delta_mm: Number((estimated - site.mean_mm).toFixed(4)),
      slope_mm_per_body_fat_percent: site.slope_mm_per_body_fat_percent,
    };
  }
  return {
    source: guide.source,
    population: guide.population,
    scope_note: guide.scope_note,
    sex_reference: reference.sex,
    body_fat_percent: Number(bodyFatPercent.toFixed(4)),
    reference_body_fat_percent: Number(reference.meanBodyFat.toFixed(4)),
    delta_body_fat_percent: Number(delta.toFixed(4)),
    status: context.age >= 18 && context.age <= 49 ? "within_source_age_range" : "age_extrapolated_method_reference",
    sites,
  };
}

function bodyCompositionModelEstimate(context = currentPriorContext(), bmi = calculatedBmi()) {
  const bodyFatInput = optionalNum(els.bodyFatInput);
  const activeGuide = activeBodyCompositionGuide(context);
  const japaneseReference = resolveJapaneseBodyCompositionReference(context);
  const formulaEstimate = formulaBodyFatEstimate(context, bmi);
  const guideReferenceBodyFat = activeGuide.available ? activeGuide.guide.body_fat_percent_median_proxy : null;
  const referenceBodyFat = guideReferenceBodyFat ?? japaneseReference?.group?.body_fat_percent?.mean ?? formulaEstimate?.value ?? null;
  const bodyFatPercent = bodyFatInput ?? referenceBodyFat;
  const regionalSkinfold = estimateRegionalSkinfold(context, bodyFatPercent);
  return {
    body_fat_percent: bodyFatPercent == null ? null : Number(bodyFatPercent.toFixed(4)),
    body_fat_percent_source: bodyFatInput != null
      ? "user_input"
      : guideReferenceBodyFat != null
        ? "young_japanese_female_grouped_median_proxy"
      : japaneseReference?.group?.body_fat_percent?.mean != null
        ? "japanese_public_aggregate_mean_proxy"
        : formulaEstimate
          ? "formula_estimate"
          : "missing",
    reference_body_fat_percent: referenceBodyFat == null ? null : Number(referenceBodyFat.toFixed(4)),
    delta_body_fat_percent: bodyFatPercent != null && referenceBodyFat != null ? Number((bodyFatPercent - referenceBodyFat).toFixed(4)) : null,
    japanese_body_composition_reference: japaneseReference ? {
      label: japaneseReference.label,
      status: japaneseReference.status,
      source: japaneseReference.source,
      note: japaneseReference.note,
      group: japaneseReference.group,
    } : null,
    young_japanese_female_distribution_reference: activeGuide.available ? {
      source: activeGuide.guide.source,
      body_fat_percent_median_proxy: activeGuide.guide.body_fat_percent_median_proxy,
      basis: activeGuide.guide.body_fat_percent_median_proxy_basis,
    } : null,
    body_fat_formula_estimate: formulaEstimate,
    regional_skinfold_estimate: regionalSkinfold,
  };
}

function bodyFatCategoryLabel(percent) {
  if (percent == null) return "体脂肪率: 未入力";
  if (percent < 20) return "体脂肪率区分: 低脂肪";
  if (percent < 25) return "体脂肪率区分: 普通";
  if (percent < 30) return "体脂肪率区分: やや高い";
  return "体脂肪率区分: 高い";
}

function bodyFatGroupMatches(groupId, bmi, percent) {
  if (bmi == null || percent == null) return false;
  switch (groupId) {
    case "low_weight":
      return bmi < 18.5 && percent < 20;
    case "sham_low_weight":
      return bmi < 18.5 && percent >= 20 && percent < 25;
    case "normal":
      return bmi >= 18.5 && bmi < 25 && percent >= 20 && percent < 25;
    case "pre_masked_obesity":
      return bmi < 25 && percent >= 25 && percent < 30;
    case "masked_obesity":
      return bmi >= 18.5 && bmi < 25 && percent >= 30;
    case "obesity":
      return bmi >= 25 && percent >= 30;
    default:
      return false;
  }
}

function bodyFatGuideMatch(bmi, percent, guide) {
  if (!guide || bmi == null || percent == null) return null;
  return guide.groups.find((group) => bodyFatGroupMatches(group.id, bmi, percent)) ?? null;
}

function motorMaturityFromAge(age) {
  if (!Number.isFinite(age)) return 1;
  if (age <= 2) return 0.28;
  if (age <= 4) return 0.42 + (age - 2) * 0.09;
  if (age <= 7) return 0.6 + (age - 4) * 0.07;
  if (age <= 12) return 0.81 + (age - 7) * 0.028;
  if (age <= 18) return 0.95 + (age - 12) * 0.008;
  return 1;
}

function buildBodyCompositionSummary() {
  const context = currentPriorContext();
  const bmi = calculatedBmi();
  const bodyFatPercent = optionalNum(els.bodyFatInput);
  const bmiReference = resolveBmiReference(context);
  const active = activeBodyCompositionGuide(context);
  const formulaEstimate = formulaBodyFatEstimate(context, bmi);
  const modelEstimate = bodyCompositionModelEstimate(context, bmi);
  const matchedGroup = active.guide ? bodyFatGuideMatch(bmi, bodyFatPercent, active.guide) : null;
  return {
    bmi: bmi == null ? null : Number(bmi.toFixed(4)),
    bmi_class: bmiClassLabel(bmi),
    bmi_reference: bmiReference,
    bmi_delta: bmi != null && bmiReference.value != null ? Number((bmi - bmiReference.value).toFixed(4)) : null,
    body_fat_percent: bodyFatPercent,
    active_body_fat_percent: modelEstimate.body_fat_percent,
    body_fat_percent_source: modelEstimate.body_fat_percent_source,
    body_fat_class: bodyFatCategoryLabel(bodyFatPercent),
    body_fat_formula_estimate: formulaEstimate,
    japanese_body_composition_reference: modelEstimate.japanese_body_composition_reference,
    regional_skinfold_estimate: modelEstimate.regional_skinfold_estimate,
    body_composition_model: modelEstimate,
    body_fat_distribution_guide: active.guide ? {
      id: "young_japanese_female_bia_18_19",
      available_for_current_context: active.available,
      reason: active.reason,
      matched_group_id: matchedGroup?.id ?? null,
      matched_group_label: matchedGroup?.label ?? null,
      source: active.guide.source,
      scope_note: active.guide.sample_note,
    } : null,
  };
}

function renderCompositionGuide() {
  const context = currentPriorContext();
  const bmi = calculatedBmi();
  const bodyFatPercent = optionalNum(els.bodyFatInput);
  const bmiReference = resolveBmiReference(context);
  const active = activeBodyCompositionGuide(context);
  const guide = active.guide;
  const formulaEstimate = formulaBodyFatEstimate(context, bmi);
  const modelEstimate = bodyCompositionModelEstimate(context, bmi);
  const matchedGroup = guide ? bodyFatGuideMatch(bmi, bodyFatPercent, guide) : null;

  if (els.computedBmi) els.computedBmi.textContent = format(bmi, 1);
  if (els.computedBmiClass) els.computedBmiClass.textContent = bmiClassLabel(bmi);
  if (els.referenceBmiMedian) els.referenceBmiMedian.textContent = format(bmiReference.value, 1);
  if (els.referenceBmiNote) els.referenceBmiNote.textContent = bmiReference.note;
  if (els.bmiDelta) els.bmiDelta.textContent = bmi != null && bmiReference.value != null ? `${bmi >= bmiReference.value ? "+" : ""}${format(bmi - bmiReference.value, 1)}` : "-";
  if (els.bmiReferenceSource) {
    els.bmiReferenceSource.replaceChildren();
    if (bmiReference.source) appendSourceCitation(els.bmiReferenceSource, bmiReference.source, bmiReference.note);
    if (!els.bmiReferenceSource.childNodes.length) els.bmiReferenceSource.textContent = bmiReference.status;
  }

  if (els.bodyFatGuideBadges) {
    els.bodyFatGuideBadges.innerHTML = "";
    const estimateText = formulaEstimate ? `式推定 ${format(formulaEstimate.value, 1)}%` : "式推定なし";
    for (const text of [bmiClassLabel(bmi), bodyFatCategoryLabel(bodyFatPercent), estimateText, guide ? `${guide.age_band_label}: ${active.available ? "参照中" : "範囲外"}` : "ガイド未搭載"]) {
      const badge = document.createElement("span");
      badge.textContent = text;
      els.bodyFatGuideBadges.appendChild(badge);
    }
    const extraBadges = [];
    if (modelEstimate.body_fat_percent != null) {
      extraBadges.push(`active BF ${format(modelEstimate.body_fat_percent, 1)}%`);
    }
    if (modelEstimate.japanese_body_composition_reference) {
      extraBadges.push("Komiya aggregate");
    }
    if (modelEstimate.regional_skinfold_estimate?.sites?.abdomen) {
      extraBadges.push(`abdomen SF ${format(modelEstimate.regional_skinfold_estimate.sites.abdomen.estimated_mm, 1)} mm`);
    }
    for (const text of extraBadges) {
      const badge = document.createElement("span");
      badge.textContent = text;
      els.bodyFatGuideBadges.appendChild(badge);
    }
  }

  if (els.bodyFatGuideSummary) {
    if (!guide) {
      els.bodyFatGuideSummary.textContent = formulaEstimate
        ? `年齢階級別の実測分布は未搭載です。暫定的には文献式から体脂肪率 ${format(formulaEstimate.value, 1)}% 程度を推定できます。`
        : "年齢階級別の体脂肪率分布ガイドはまだ登録されていません。";
    } else if (!active.available) {
      const formulaPart = formulaEstimate ? `暫定式推定は ${format(formulaEstimate.value, 1)}% です。` : "";
      els.bodyFatGuideSummary.textContent = `${active.reason} ${formulaPart} ${guide.applicability_note}`;
    } else if (bodyFatPercent == null) {
      const formulaPart = formulaEstimate ? `BMI・年齢・性別からの式推定は ${format(formulaEstimate.value, 1)}% です。` : "";
      els.bodyFatGuideSummary.textContent = `${guide.applicability_note} ${formulaPart} 体脂肪率を入力すると、BMIとの組み合わせから近い体型群を表示します。`;
    } else if (matchedGroup) {
      const delta = formulaEstimate ? `式推定との差 ${format(bodyFatPercent - formulaEstimate.value, 1)}%。` : "";
      els.bodyFatGuideSummary.textContent = `現在の設定は「${matchedGroup.label}」に近いです。${delta}${matchedGroup.interpretation}`;
    } else {
      const formulaPart = formulaEstimate ? `文献式推定は ${format(formulaEstimate.value, 1)}% です。` : "";
      els.bodyFatGuideSummary.textContent = `現在のBMIと体脂肪率の組み合わせは、この論文の6分類には直接対応しません。${formulaPart}設計値として扱い、分布補正は手動判断してください。`;
    }
    const komiyaGroup = modelEstimate.japanese_body_composition_reference?.group;
    const abdomenSkinfold = modelEstimate.regional_skinfold_estimate?.sites?.abdomen;
    const supplements = [];
    if (komiyaGroup) {
      supplements.push(`Komiya reference: ${modelEstimate.japanese_body_composition_reference.label}, BF center ${format(komiyaGroup.body_fat_percent?.mean, 1)}%.`);
    }
    if (abdomenSkinfold) {
      supplements.push(`Skinfold response guide: abdomen ${format(abdomenSkinfold.estimated_mm, 1)} mm (${modelEstimate.regional_skinfold_estimate.status}).`);
    }
    if (supplements.length) {
      els.bodyFatGuideSummary.textContent = `${els.bodyFatGuideSummary.textContent} ${supplements.join(" ")}`;
    }
  }

  if (els.bodyFatGuideTable) {
    els.bodyFatGuideTable.innerHTML = "";
    for (const group of guide?.groups ?? []) {
      const row = document.createElement("tr");
      if (matchedGroup?.id === group.id) row.className = "matched-guide-row";
      const distribution = `脚 ${format(group.regional_percent.leg, 1)}% / 体幹 ${format(group.regional_percent.trunk, 1)}%`;
      for (const text of [
        `${group.label} (n=${group.n})`,
        group.criteria,
        `${format(group.bmi.mean, 1)} ± ${format(group.bmi.sd, 1)}`,
        `${format(group.body_fat_percent.mean, 1)} ± ${format(group.body_fat_percent.sd, 1)}%`,
        distribution,
      ]) {
        const cell = document.createElement("td");
        cell.textContent = text;
        row.appendChild(cell);
      }
      els.bodyFatGuideTable.appendChild(row);
    }
    const komiyaGroup = modelEstimate.japanese_body_composition_reference?.group;
    if (komiyaGroup) {
      const row = document.createElement("tr");
      row.className = "model-guide-row";
      const skinfoldText = [
        komiyaGroup.subcutaneous_fat_kg?.mean != null ? `SC fat ${format(komiyaGroup.subcutaneous_fat_kg.mean, 1)} kg` : null,
        komiyaGroup.triceps_skinfold_mm?.mean != null ? `triceps ${format(komiyaGroup.triceps_skinfold_mm.mean, 1)} mm` : null,
        komiyaGroup.subscapular_skinfold_mm?.mean != null ? `subscapular ${format(komiyaGroup.subscapular_skinfold_mm.mean, 1)} mm` : null,
      ].filter(Boolean).join(" / ");
      for (const text of [
        `${komiyaGroup.label}`,
        modelEstimate.japanese_body_composition_reference.status,
        `${format(komiyaGroup.bmi?.mean, 1)} ± ${format(komiyaGroup.bmi?.sd, 1)}`,
        `${format(komiyaGroup.body_fat_percent?.mean, 1)}%`,
        skinfoldText,
      ]) {
        const cell = document.createElement("td");
        cell.textContent = text;
        row.appendChild(cell);
      }
      els.bodyFatGuideTable.appendChild(row);
    }
  }

  if (els.bodyFatGuideNote) {
    els.bodyFatGuideNote.replaceChildren();
    if (guide) appendSourceCitation(els.bodyFatGuideNote, guide.source, `${guide.sample_note}\n${guide.applicability_note}`);
    if (formulaEstimate) appendSourceCitation(els.bodyFatGuideNote, formulaEstimate.source, "分布中央値ではなく、BMI・年齢・性別に基づく式推定です。");
    if (modelEstimate.japanese_body_composition_reference) {
      appendSourceCitation(
        els.bodyFatGuideNote,
        modelEstimate.japanese_body_composition_reference.source,
        "日本人公開集計の平均値プロキシであり、中央値または臨床基準ではありません。",
      );
    }
    if (modelEstimate.regional_skinfold_estimate) {
      appendSourceCitation(
        els.bodyFatGuideNote,
        modelEstimate.regional_skinfold_estimate.source,
        "部位別皮下脂肪厚の相対応答だけに使用し、日本人母集団中心値には使用しません。",
      );
    }
  }
}

function mapVoiceConstraints(features) {
  const sex = sexClass();
  const height = num(els.heightInput, 158);
  const weight = num(els.weightInput, 47);
  const age = num(els.ageInput, 17);
  const priorContext = currentPriorContext();
  const referenceImageStyle = priorContext.reference_image_style;
  const growthRefs = priorResolver.resolveGrowthReferences(priorContext);
  const youngRespiratory = growthRefs.young_respiratory?.predictions ?? null;
  const youngRespiratoryScale = youngRespiratoryCapacityScale(youngRespiratory, sex);
  const k = 1;
  const voiceSex = sex;
  const voicePriors = referenceData.sources.pisanski2016.extracted_values.voice_table_1[voiceSex];
  const bodyPriors = priorResolver.resolveBodyReference(referenceData, currentPriorContext());
  const baseVtl = voicePriors.vtl_df_cm.mean;
  const baseVtlSd = voicePriors.vtl_df_cm.sd;
  const heightZ = (height - bodyPriors.height_cm_mean) / bodyPriors.height_cm_sd;
  const weightScale = weight / bodyPriors.weight_kg_mean;
  const heightScale = height / bodyPriors.height_cm_mean;
  const headScale = Math.max(0.86, Math.min(1.16, 7.25 / features.head_units.integrated));
  const lowerFaceScale = features.lower_face_height_cm.scale;
  const jawScale = features.jaw_width_cm.scale;
  const shoulderScale = features.shoulder_width_cm.scale;
  const torsoScale = features.torso_length_cm.scale;
  const pelvisScale = features.pelvis_width_cm.scale;
  const mouthScale = features.mouth_width_cm.scale;
  const mouthWidthRelaxed = features.mouth_width_cm.articulatory_baseline_cm ?? features.mouth_width_cm.integrated;
  const mouthWidthRange = features.mouth_width_cm.performance_width_range_cm ?? {
    min: mouthWidthRelaxed * 0.72,
    center: mouthWidthRelaxed,
    max: mouthWidthRelaxed * 1.18,
  };
  const mouthReferenceCenter = Math.max(0.1, features.mouth_width_cm.statistical_median ?? 4.85);
  const headZ = (headScale - 1) / 0.08;
  const lowerFaceZ = features.lower_face_height_cm.z_score;
  const torsoZ = features.torso_length_cm.z_score;
  const limitedMorphologyZ = clamp(0.35 * heightZ + 0.2 * headZ + 0.25 * lowerFaceZ + 0.1 * torsoZ, -1.25, 1.25);
  const vtl = baseVtl + limitedMorphologyZ * baseVtlSd;
  const pharynxLen = 0.5 * lowerFaceScale + 0.3 * heightScale + 0.2 * torsoScale;
  const pharynxArea = 0.45 * jawScale + 0.3 * shoulderScale + 0.25 * pelvisScale;
  const nasal = (sex === "male" ? 22 : sex === "female" ? 18 : 20) * (0.55 * headScale + 0.25 * lowerFaceScale + 0.2 * jawScale);
  const ventilationBase = sex === "male" ? 125 : sex === "female" ? 95 : 110;
  const ventilationEstimate = ventilationBase * (0.5 * heightScale + 0.3 * Math.sqrt(weightScale) + 0.2 * torsoScale) * youngRespiratoryScale;
  const pressure = num(els.pressureInput, 900);
  const ageTension = clamp(1.08 - Math.max(0, age - 20) * 0.0025 + (age < 18 ? 0.06 : 0), 0.86, 1.16);
  const springConstant = clamp(ageTension, 0.55, 1.65);
  const baselineTension = clamp(ageTension * 1.03, 0.35, 1.6);
  const sinusBase = sex === "male" ? 32 : sex === "female" ? 24 : 28;
  const thoracicBase = sex === "male" ? 6.0 : sex === "female" ? 4.6 : 5.3;
  const abdominalBase = sex === "male" ? 7.4 : sex === "female" ? 6.3 : 6.85;
  const bodyComposition = bodyCompositionModelEstimate(priorContext);
  const bodyFatDeltaPercent = bodyComposition.delta_body_fat_percent ?? 0;
  const abdomenSkinfoldDeltaMm = bodyComposition.regional_skinfold_estimate?.sites?.abdomen?.delta_mm ?? 0;
  const thoracicSoftTissueScale = clamp(1 - Math.max(0, bodyFatDeltaPercent) * 0.0015, 0.94, 1.04);
  const abdominalSoftTissueScale = clamp(1 + bodyFatDeltaPercent * 0.006 + abdomenSkinfoldDeltaMm * 0.002, 0.88, 1.16);
  const sinusDevelopmentScale = growthRefs.sinus_development?.sinus_volume_scale ?? 1;
  const sinusVolume = sinusBase * (0.45 * headScale + 0.25 * lowerFaceScale + 0.2 * jawScale + 0.1 * heightScale) * sinusDevelopmentScale;
  const thoracicVolume = thoracicBase * (0.45 * torsoScale + 0.3 * shoulderScale + 0.15 * heightScale + 0.1 * Math.sqrt(weightScale)) * thoracicSoftTissueScale;
  const abdominalVolume = abdominalBase * (0.4 * torsoScale + 0.35 * pelvisScale + 0.25 * Math.sqrt(weightScale)) * abdominalSoftTissueScale;
  const structuralVentilationRatio = 0.62 * (thoracicVolume / thoracicBase) + 0.38 * (abdominalVolume / abdominalBase);
  const ventilationCapacityCeiling = ventilationBase * youngRespiratoryScale * structuralVentilationRatio;
  const ventilation = Math.min(ventilationEstimate, ventilationCapacityCeiling);
  const respiratorySupport = 1;
  const sinusCoupling = clamp(0.18 + (nasal / (sex === "male" ? 22 : sex === "female" ? 18 : 20) - 1) * 0.18 + (sinusVolume / sinusBase - 1) * 0.22, 0.04, 0.55);
  const velopharyngealLossCoupling = clamp(0.10 + sinusCoupling * 0.24 + (1 - baselineTension) * 0.04, 0.03, 0.42);
  const piriformFossaLossCoupling = clamp(0.12 + (vtl / baseVtl - 1) * 0.08 + (pharynxLen - 1) * 0.06, 0.04, 0.36);
  const piriformFossaFrequency = clamp(3700 * Math.pow(baseVtl / vtl, 0.42), 2600, 4800);
  const bodyResonanceCoupling = clamp(0.22 + (thoracicVolume / thoracicBase - 1) * 0.24 + bodyFatDeltaPercent * 0.003 + abdomenSkinfoldDeltaMm * 0.002, 0.04, 0.7);
  const bodyResonanceFrequency = clamp(210 / Math.pow(thoracicVolume / thoracicBase, 0.38), 120, 320);
  const bodyResonanceGain = 4;
  const maturity = motorMaturityFromAge(age);
  const gestureExecutionInput = 1;
  const gestureExecutionResponse = gestureExecutionResponseForStyle(referenceImageStyle);
  const articulationSource = referenceImageStyle === "illustration"
    ? "normalized phoneme-gesture execution: UI 1.00 is the modeled normal clear-speech baseline; lower values intentionally undershoot vowel gestures and higher values exaggerate them. Illustration calibration compensates for depicted facial motion being a lower-bound proxy."
    : "normalized phoneme-gesture execution: UI 1.00 is the modeled normal clear-speech baseline; lower values intentionally undershoot vowel gestures and higher values exaggerate them.";
  const motorControlPrecision = clamp(0.55 + maturity * 0.45, 0.25, 1.25);
  const coarticulationStrength = clamp(0.58 + (1 - maturity) * 0.22 + (1 - motorControlPrecision) * 0.18 - (gestureExecutionInput - 1) * 0.12, 0, 1);
  const phonologicalContrastMaturity = clamp(0.48 + maturity * 0.52 + (motorControlPrecision - 1) * 0.12, 0.25, 1.15);
  const glottalOpenQuotient = clamp(0.58 + (1 - baselineTension) * 0.06, 0.38, 0.84);
  const glottalSpeedQuotient = clamp(1.72 + (baselineTension - 1) * 0.35, 0.9, 2.6);
  const glottalReturnPhase = clamp(0.15 + (1 - baselineTension) * 0.03, 0.06, 0.28);
  const glottalSpectralTiltDb = clamp(14.2 - baselineTension * 1.2, 6, 24);
  const glottalBreathiness = clamp(0.08 + Math.max(0, 1 - baselineTension) * 0.08, 0, 0.48);
  const glottalVolumeVelocityDrive = 0.88;
  const glottalFlowSmoothing = 0.37;
  const glottalFlowInertance = clamp(0.15 + (baselineTension - 1) * 0.025, 0.02, 0.42);
  const trachealTransverseDesign = sex === "male" ? 1.8 : sex === "female" ? 1.4 : 1.6;
  const f0Prior = voicePriors.f0_mean_hz;
  const f0Center = derivedF0FromPhysicalValues(f0Prior.mean, springConstant, baselineTension);
  const maximumVentilationConstraint = {
    ...range(ventilation, 14 * k, "L/min", "height/weight/torso estimate limited by thoracic and abdominal structural capacity", 0.28, "sourceMap"),
    derivation: {
      unconstrained_estimate_l_min: Number(ventilationEstimate.toFixed(4)),
      structural_capacity_ceiling_l_min: Number(ventilationCapacityCeiling.toFixed(4)),
      reference_capacity_l_min: Number((ventilationBase * youngRespiratoryScale).toFixed(4)),
      thoracic_reference_l: thoracicBase,
      abdominal_reference_l: abdominalBase,
      thoracic_weight: 0.62,
      abdominal_weight: 0.38,
    },
  };
  const voiceSource = "Pisanski et al. 2016 Table 1; morphology correction is conservative per Pisanski et al. 2014/2016";

  return {
    vocal_tract_length_cm: range(vtl, Math.max(0.45, baseVtlSd * k), "cm", voiceSource, 0.72, "pisanski2016"),
    f0_reference_hz: range(f0Prior.mean, f0Prior.sd * k, "Hz", "Pisanski et al. 2016 Table 1 reference center for the selected sex class", 0.65, "pisanski2016"),
    f0_mean_hz: {
      ...range(f0Center, f0Prior.sd * k, "Hz", "derived from the reference center, vocal-fold spring constant, and baseline muscle tension", 0.65, "pisanski2016"),
      read_only_derived: true,
      derived_from: ["f0_reference_hz", "vocal_fold_spring_constant", "baseline_muscle_tension"],
    },
    formant_reference_hz: {
      f1: voicePriors.f1_hz,
      f2: voicePriors.f2_hz,
      f3: voicePriors.f3_hz,
      f4: voicePriors.f4_hz,
      unit: "Hz",
      source: "Pisanski et al. 2016 Table 1",
      evidence: "pisanski2016",
      confidence: 0.7,
    },
    pharyngeal_length_scale: range(pharynxLen, 0.07 * k, "ratio", "lower-face/height/torso proxy; Dediu 2022 supports keeping this separate from oral cavity scale", 0.42, "dediu2022"),
    pharyngeal_area_scale: range(pharynxArea, 0.08 * k, "ratio", "jaw/shoulder/pelvis proxy; numeric cohort prior pending", 0.34, "dediu2022"),
    palatal_vault_scale: editableControl(
      1,
      0.7,
      1.35,
      "ratio",
      "synthetic 2.5D palatal-vault design control; not inferred from the external image",
      0.1,
      "sourceMap",
      staticConstraintRange(1)
    ),
    lip_aperture_aspect_scale: editableControl(
      1,
      0.65,
      1.45,
      "ratio",
      "synthetic 2.5D lip-aperture width-to-height design control; external commissure width constrains scale but not this internal aperture aspect",
      0.1,
      "sourceMap",
      staticConstraintRange(1)
    ),
    tongue_groove_capacity: editableControl(
      1,
      0.35,
      1.45,
      "ratio",
      "available tongue-groove and lateral-channel performance range for the 2.5D design layer; values above the neutral range expand availability but do not exaggerate a fixed vowel target",
      0.1,
      "sourceMap",
      performanceConstraintRange(1, 0.55, 1.25, "reduced-to-emphatic tongue-groove and lateral-channel performance range")
    ),
    tracheal_transverse_design_cm: editableControl(trachealTransverseDesign, 1.0, 2.5, "cm", "independent engineering design baseline; Miyamoto et al. 2023 UHRCT aggregate is used only as an adult plausibility check", 0.14, "japaneseTracheaUhrct2023"),
    larynx_height_offset_mm: range((age < 18 ? -1.5 : 0) + (sex === "male" ? 2 : sex === "female" ? -1 : 0), 3.5 * k, "mm", "age and sex reference class; numeric laryngeal-position prior pending", 0.25, "sourceMap"),
    nasal_cavity_volume_cm3: range(nasal, 3.0 * k, "cm3", "head/lower-face/jaw proxy only; nasal-cavity volume source is pending", 0.2, "sourceMap"),
    paranasal_sinus_volume_cm3: range(sinusVolume, 8.0 * k, "cm3", "head/lower-face/jaw proxy; used as a side-branch resonance control, not a validated sinus-volume estimate", 0.18, "sourceMap"),
    pediatric_sinus_development_modifier: {
      center: Number(sinusDevelopmentScale.toFixed(4)),
      unit: "ratio",
      source: "local pediatric head/neck imaging qualitative extract",
      evidence: growthRefs.sinus_development?.source ?? "sourceMap",
      confidence: growthRefs.sinus_development?.confidence ?? 0.1,
      edit_range: { min: 0.1, max: 1.1, basis: "explicit UI design-value editing range" },
      resting_anatomical_state: restingState(Number(sinusDevelopmentScale.toFixed(4)), "ratio"),
      morphological_plausibility_range: plausibilityRange(0.1, 1.1, "ratio", "explicit pediatric sinus-development design range"),
      performance_control_range: staticConstraintRange(Number(sinusDevelopmentScale.toFixed(4))),
      constraint_range: staticConstraintRange(Number(sinusDevelopmentScale.toFixed(4))),
      note: growthRefs.sinus_development?.note ?? "No age-specific sinus development modifier available.",
    },
    sinus_neck_area_cm2: range(0.24 * Math.pow(sinusVolume / sinusBase, 0.35), 0.08 * k, "cm2", "Helmholtz side-branch proxy; manual/detail parameter pending", 0.12, "sourceMap"),
    sinus_neck_length_cm: range(1.2 * Math.pow(sinusVolume / sinusBase, 0.12), 0.25 * k, "cm", "Helmholtz side-branch proxy; manual/detail parameter pending", 0.12, "sourceMap"),
    sinus_coupling: editableControl(sinusCoupling, 0, 1, "ratio", "nasal/sinus proxy plus manual slider", 0.22, "sourceMap"),
    sinus_damping: editableControl(0.68, 0.25, 1.2, "ratio", "preview synthesis control; higher values smear sinus effect", 0.1, "sourceMap"),
    velopharyngeal_loss_coupling: editableControl(velopharyngealLossCoupling, 0, 0.75, "ratio", "nasal side-branch loss control guided by the manually placed velopharyngeal gap when available", 0.1, "sourceMap"),
    piriform_fossa_loss_coupling: editableControl(piriformFossaLossCoupling, 0, 0.65, "ratio", "piriform-fossa antiresonance preview control; not an image-observed cavity estimate", 0.1, "sourceMap"),
    piriform_fossa_frequency_hz: editableControl(piriformFossaFrequency, 2200, 5200, "Hz", "vocal-tract-length-scaled piriform-fossa antiresonance preview frequency", 0.1, "sourceMap"),
    nasal_branch_damping: editableControl(0.72, 0.25, 1.4, "ratio", "nasal/velopharyngeal side-branch damping control for the lightweight preview", 0.1, "sourceMap"),
    maximum_ventilation_l_min: maximumVentilationConstraint,
    young_respiratory_capacity_modifier: {
      center: Number(youngRespiratoryScale.toFixed(4)),
      unit: "ratio",
      source: youngRespiratory ? "local young Japanese respiratory-function regression" : "not active outside ages 10-20",
      evidence: youngRespiratory ? "youngJapaneseRespiratory1020" : "sourceMap",
      confidence: youngRespiratory ? 0.44 : 0.08,
      edit_range: { min: 0.65, max: 1.18, basis: "explicit UI design-value editing range" },
      resting_anatomical_state: restingState(Number(youngRespiratoryScale.toFixed(4)), "ratio"),
      morphological_plausibility_range: plausibilityRange(0.65, 1.18, "ratio", "young respiratory equation modifier range"),
      performance_control_range: staticConstraintRange(Number(youngRespiratoryScale.toFixed(4))),
      constraint_range: staticConstraintRange(Number(youngRespiratoryScale.toFixed(4))),
    },
    predicted_vc_l: respiratoryRangeFromPrediction(youngRespiratory?.VC, k),
    predicted_fvc_l: respiratoryRangeFromPrediction(youngRespiratory?.FVC, k),
    predicted_fev1_l: respiratoryRangeFromPrediction(youngRespiratory?.FEV1, k),
    predicted_fev1_percent_gaensler: respiratoryRangeFromPrediction(youngRespiratory?.FEV1_percent_Gaensler, k),
    predicted_fev1_percent_tiffeneau: respiratoryRangeFromPrediction(youngRespiratory?.FEV1_percent_Tiffeneau, k),
    predicted_pef_l_s: respiratoryRangeFromPrediction(youngRespiratory?.PEF, k),
    predicted_v50_l_s: respiratoryRangeFromPrediction(youngRespiratory?.V50, k),
    predicted_v25_l_s: respiratoryRangeFromPrediction(youngRespiratory?.V25, k),
    thoracic_volume_l: range(thoracicVolume, 0.8 * k, "L", "torso/shoulder/height/weight proxy with conservative body-composition soft-tissue modifier; limits maximum ventilation and sets body-resonance frequency", 0.22, "komiya1997JapaneseBodyComposition"),
    abdominal_volume_l: range(abdominalVolume, 0.9 * k, "L", "torso/pelvis/weight proxy with conservative body-fat and abdominal skinfold modifier; limits maximum ventilation", 0.2, "regionalSkinfoldThickness1996"),
    respiratory_support: editableControl(
      respiratorySupport,
      0.55,
      1.45,
      "ratio",
      "performance utilization of the available respiratory capacity during speech; structural volumes are applied upstream through maximum ventilation",
      0.24,
      "sourceMap",
      performanceConstraintRange(respiratorySupport, clamp(respiratorySupport * 0.76, 0.55, 1.45), clamp(respiratorySupport * 1.24, 0.55, 1.45), "relaxed-to-supported respiratory performance range")
    ),
    articulatory_range_utilization: editableControl(
      gestureExecutionInput,
      GESTURE_EXECUTION_INPUT_MIN,
      GESTURE_EXECUTION_INPUT_MAX,
      "ratio",
      articulationSource,
      0.22,
      "sourceMap",
      performanceConstraintRange(gestureExecutionInput, clamp(gestureExecutionInput * 0.76, 0.25, GESTURE_EXECUTION_INPUT_MAX), clamp(gestureExecutionInput * 1.18, 0.25, GESTURE_EXECUTION_INPUT_MAX), "quiet-to-emphatic articulatory target utilization range")
    ),
    gesture_execution_response_map: {
      schema_version: "gesture_execution_response_0.1",
      center: Number(gestureExecutionResponse.effective_center.toFixed(4)),
      input_center: gestureExecutionResponse.input_center,
      effective_center: gestureExecutionResponse.effective_center,
      response_offset: gestureExecutionResponse.response_offset,
      response_gain: gestureExecutionResponse.response_gain,
      effective_min: gestureExecutionResponse.effective_min,
      effective_max: gestureExecutionResponse.effective_max,
      unit: "internal_gesture_ratio",
      source: referenceImageStyle === "illustration"
        ? "non-anatomical response curve: UI Gesture execution 1.00 maps to modeled normal clear speech; below 1.00 under-executes gestures and above 1.00 exaggerates them after illustration calibration"
        : "non-anatomical response curve: UI Gesture execution 1.00 maps to modeled normal clear speech; below 1.00 under-executes gestures and above 1.00 exaggerates them",
      evidence: "sourceMap",
      confidence: 0.22,
      edit_range: { min: gestureExecutionResponse.effective_min, max: gestureExecutionResponse.effective_max, basis: "internal UI response-curve output range" },
      resting_anatomical_state: restingState(Number(gestureExecutionResponse.effective_center.toFixed(4)), "internal_gesture_ratio"),
      morphological_plausibility_range: plausibilityRange(gestureExecutionResponse.effective_min, gestureExecutionResponse.effective_max, "internal_gesture_ratio", "non-anatomical gesture-execution response curve"),
      performance_control_range: staticConstraintRange(Number(gestureExecutionResponse.effective_center.toFixed(4))),
      constraint_range: staticConstraintRange(Number(gestureExecutionResponse.effective_center.toFixed(4))),
    },
    tongue_dorsum_range_utilization: editableControl(
      1,
      0.35,
      1.45,
      "ratio",
      "available tongue-dorsum PerformanceControlRange; it limits a target when reduced but does not amplify a fixed vowel target above the neutral available range",
      0.16,
      "sourceMap",
      performanceConstraintRange(1, 0.62, 1.3, "undershot-to-emphatic tongue-dorsum target utilization range")
    ),
    labial_transverse_range_utilization: editableControl(
      1,
      0.35,
      1.45,
      "ratio",
      "available lip and cheek transverse PerformanceControlRange; it limits a target when reduced but does not amplify a fixed vowel target above the neutral available range",
      0.16,
      "sourceMap",
      performanceConstraintRange(1, 0.62, 1.3, "reduced-to-emphatic lip and cheek transverse-spread utilization range")
    ),
    motor_control_precision: editableControl(
      motorControlPrecision,
      0.25,
      1.25,
      "ratio",
      "current deterministic preview precision for how tightly the realized tract reaches its intended target; temporal target-arrival variance is reserved for motor_control_maturity in the future TTS layer",
      0.2,
      "sourceMap",
      performanceConstraintRange(motorControlPrecision, clamp(motorControlPrecision * 0.78, 0.2, 1.35), clamp(motorControlPrecision * 1.14, 0.2, 1.35), "unstable-to-precise articulatory motor-control range")
    ),
    coarticulation_strength: editableControl(
      coarticulationStrength,
      0,
      1,
      "ratio",
      "strength of adjacent-sound pull on articulatory targets; higher values increase natural smearing and lower segmental clarity",
      0.18,
      "sourceMap",
      performanceConstraintRange(coarticulationStrength, clamp(coarticulationStrength * 0.65, 0, 1), clamp(coarticulationStrength + 0.22, 0, 1), "careful-to-fluid speech coarticulation range")
    ),
    motor_control_maturity: editableControl(
      maturity,
      0.25,
      1.15,
      "ratio",
      "age-based motor-coordination capacity reserved for stochastic target-arrival accuracy in the future temporal TTS layer; isolated-vowel preview remains deterministic",
      0.18,
      "sourceMap",
      staticConstraintRange(Number(maturity.toFixed(4)))
    ),
    phonological_contrast_maturity: editableControl(
      phonologicalContrastMaturity,
      0.25,
      1.15,
      "ratio",
      "age-based maturity of phonological contrast targets; lower values collapse vowel/consonant target separation",
      0.18,
      "sourceMap",
      performanceConstraintRange(phonologicalContrastMaturity, clamp(phonologicalContrastMaturity * 0.82, 0.2, 1.2), clamp(phonologicalContrastMaturity * 1.08, 0.2, 1.2), "reduced-to-clear phonological target contrast range")
    ),
    body_resonance_frequency_hz: range(bodyResonanceFrequency, 35 * k, "Hz", "initial value derived from thoracic volume; editable value is persisted and used directly by preview synthesis", 0.18, "sourceMap"),
    body_resonance_gain_db: range(bodyResonanceGain, 1.5 * k, "dB", "independent peak gain of the body-resonance branch before wet/dry coupling", 0.12, "sourceMap"),
    body_resonance_coupling: editableControl(bodyResonanceCoupling, 0, 1, "ratio", "wet/dry coupling of the body-resonance branch; estimated from thoracic volume and conservative body-composition proxies", 0.2, "regionalSkinfoldThickness1996"),
    maximum_respiratory_pressure_pa: range(pressure, 180 * k, "Pa", "manual setting; maximal pressure reference source pending", 0.2, "sourceMap"),
    glottal_open_quotient: editableControl(
      glottalOpenQuotient,
      0.35,
      0.9,
      "ratio",
      "LF-style glottal-source open quotient preview control initialized from baseline tension",
      0.12,
      "sourceMap",
      performanceConstraintRange(glottalOpenQuotient, clamp(glottalOpenQuotient - 0.08, 0.2, 0.95), clamp(glottalOpenQuotient + 0.08, 0.2, 0.95), "phonatory open-quotient performance range around the baseline")
    ),
    glottal_speed_quotient: editableControl(
      glottalSpeedQuotient,
      0.8,
      2.8,
      "ratio",
      "LF-style opening-to-closing speed quotient preview control initialized from baseline tension",
      0.12,
      "sourceMap",
      performanceConstraintRange(glottalSpeedQuotient, clamp(glottalSpeedQuotient * 0.88, 0.6, 3.2), clamp(glottalSpeedQuotient * 1.12, 0.6, 3.2), "phonatory speed-quotient performance range around the baseline")
    ),
    glottal_return_phase: editableControl(
      glottalReturnPhase,
      0.04,
      0.32,
      "cycle",
      "LF-style return-phase duration preview control initialized from baseline tension",
      0.12,
      "sourceMap",
      performanceConstraintRange(glottalReturnPhase, clamp(glottalReturnPhase - 0.035, 0.03, 0.38), clamp(glottalReturnPhase + 0.035, 0.03, 0.38), "phonatory return-phase performance range around the baseline")
    ),
    glottal_spectral_tilt_db: editableControl(
      glottalSpectralTiltDb,
      4,
      28,
      "dB",
      "general human glottal-source spectral tilt preview control initialized from tension",
      0.12,
      "sourceMap",
      performanceConstraintRange(glottalSpectralTiltDb, clamp(glottalSpectralTiltDb - 4, 2, 32), clamp(glottalSpectralTiltDb + 4, 2, 32), "phonatory spectral-tilt performance range around the baseline")
    ),
    glottal_breathiness: editableControl(
      glottalBreathiness,
      0,
      0.6,
      "ratio",
      "aspiration-noise amount mixed into the glottal source and initialized from baseline tension",
      0.12,
      "sourceMap",
      performanceConstraintRange(glottalBreathiness, clamp(glottalBreathiness * 0.65, 0, 0.75), clamp(glottalBreathiness + 0.12, 0, 0.75), "breathiness performance range around the baseline")
    ),
    glottal_volume_velocity_drive: editableControl(
      glottalVolumeVelocityDrive,
      0,
      1,
      "ratio",
      "blend from derivative/pressure-like excitation toward glottal volume-velocity input for the 1D tube preview",
      0.1,
      "sourceMap",
      performanceConstraintRange(glottalVolumeVelocityDrive, clamp(glottalVolumeVelocityDrive - 0.10, 0, 1), clamp(glottalVolumeVelocityDrive + 0.08, 0, 1), "phonatory source-input mode range around the baseline")
    ),
    glottal_flow_smoothing: editableControl(
      glottalFlowSmoothing,
      0,
      0.9,
      "ratio",
      "low-pass smoothing applied to the LF-style glottal-flow input before tube injection",
      0.1,
      "sourceMap",
      performanceConstraintRange(glottalFlowSmoothing, clamp(glottalFlowSmoothing - 0.12, 0, 0.95), clamp(glottalFlowSmoothing + 0.14, 0, 0.95), "phonatory flow-smoothing range around the baseline")
    ),
    glottal_flow_inertance: editableControl(
      glottalFlowInertance,
      0,
      0.55,
      "ratio",
      "small inertive component mixed with the volume-velocity source input for onset and harmonic definition",
      0.1,
      "sourceMap",
      performanceConstraintRange(glottalFlowInertance, clamp(glottalFlowInertance - 0.08, 0, 0.65), clamp(glottalFlowInertance + 0.10, 0, 0.65), "phonatory inertive-flow range around the baseline")
    ),
    vocal_tract_wall_loss: editableControl(0.018, 0, 0.08, "ratio", "generalized wall-loss damping for the lightweight 1D tube preview; human-average placeholder", 0.1, "sourceMap"),
    vocal_tract_viscothermal_loss: editableControl(0.012, 0, 0.06, "ratio", "generalized viscothermal damping for the lightweight 1D tube preview; human-average placeholder", 0.1, "sourceMap"),
    vocal_tract_high_frequency_damping: editableControl(0.28, 0, 0.85, "ratio", "generalized high-frequency loss for the lightweight 1D tube preview; human-average placeholder", 0.1, "sourceMap"),
    vocal_tract_wall_compliance: editableControl(0.18, 0, 0.7, "ratio", "soft-wall compliance approximation for broadening raw 1D tube resonances; human-average placeholder", 0.1, "sourceMap"),
    vocal_tract_resonance_broadening: editableControl(0.26, 0, 0.85, "ratio", "frequency-dependent resonance broadening for the raw 1D tube preview; human-average placeholder", 0.1, "sourceMap"),
    lip_radiation_smoothing: editableControl(0.32, 0, 0.85, "ratio", "mouth-radiation smoothing for the lightweight 1D tube preview; human-average placeholder", 0.1, "sourceMap"),
    vocal_fold_spring_constant: range(
      springConstant,
      0.18 * k,
      "ratio",
      "age-class engineering baseline; physical core calibration remains pending",
      0.18,
      "sourceMap",
      performanceConstraintRange(springConstant, clamp(springConstant * 0.85, 0.35, 2.0), clamp(springConstant * 1.16, 0.35, 2.0), "relaxed-to-strained vocal-fold stiffness performance range")
    ),
    baseline_muscle_tension: range(
      baselineTension,
      0.2 * k,
      "ratio",
      "age-class engineering baseline; user-editable base tension",
      0.18,
      "sourceMap",
      performanceConstraintRange(baselineTension, clamp(baselineTension * 0.7, 0.2, 2.0), clamp(baselineTension * 1.35, 0.2, 2.0), "maximally relaxed-to-strained muscle-tension performance range")
    ),
    local_pdf_growth_reference: {
      head_growth: growthRefs.head_growth,
      young_respiratory: growthRefs.young_respiratory,
      source: "local_pdf_growth_priors.js",
      confidence: growthRefs.head_growth || growthRefs.young_respiratory ? 0.3 : 0.08,
    },
    mouth_width_relaxed_cm: range(
      mouthWidthRelaxed,
      features.mouth_width_cm.statistical_sd * k,
      "cm",
      "depicted commissure width interpreted as a stylized/pursed proxy; relaxed baseline inferred from jaw breadth and bundled mouth-to-jaw aggregate-center ratio",
      0.22,
      "pendingAist",
      performanceConstraintRange(
        mouthWidthRelaxed,
        mouthWidthRange.min,
        mouthWidthRange.max,
        "pursed/stylized lower-bound proxy to estimated maximal lip spreading around the character's relaxed commissure width"
      )
    ),
    mouth_radiation_scale: range(
      mouthScale,
      0.08 * k,
      "ratio",
      "jaw-conditioned relaxed mouth-width proxy; direct Japanese mouth-breadth table remains pending",
      0.28,
      "pendingAist",
      performanceConstraintRange(
        mouthScale,
        mouthWidthRange.min / mouthReferenceCenter,
        mouthWidthRange.max / mouthReferenceCenter,
        "ratio form of the inferred mouth-width performance range"
      )
    ),
    body_reference: {
      height_cm: { observed: height, cohort_mean: bodyPriors.height_cm_mean, cohort_sd: bodyPriors.height_cm_sd, z_score: Number(heightZ.toFixed(4)) },
      weight_kg: { observed: weight, cohort_mean: bodyPriors.weight_kg_mean, cohort_sd: bodyPriors.weight_kg_sd },
      body_composition: bodyComposition,
      body_composition_modifiers: {
        body_fat_delta_percent: Number(bodyFatDeltaPercent.toFixed(4)),
        abdomen_skinfold_delta_mm: Number(abdomenSkinfoldDeltaMm.toFixed(4)),
        thoracic_soft_tissue_scale: Number(thoracicSoftTissueScale.toFixed(4)),
        abdominal_soft_tissue_scale: Number(abdominalSoftTissueScale.toFixed(4)),
      },
      source: "Pisanski et al. 2014 cross-cultural adult sample",
      evidence: "pisanski2014",
    },
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function range(center, sd, unit, source, confidence = 0.5, evidence = null, dynamicRange = null) {
  const oneSd = Math.abs(sd);
  const roundedCenter = Number(center.toFixed(4));
  const editMin = Number((center - oneSd * 3).toFixed(4));
  const editMax = Number((center + oneSd * 3).toFixed(4));
  return {
    center: roundedCenter,
    unit,
    source,
    evidence,
    confidence,
    statistics: {
      reference_center: roundedCenter,
      sd: Number(oneSd.toFixed(4)),
      minus_3sd: editMin,
      plus_3sd: editMax,
    },
    edit_range: {
      min: editMin,
      max: editMax,
      basis: "reference_center ± 3SD; UI design-value editing range",
    },
    ...parameterRangeMetadata(roundedCenter, editMin, editMax, unit, dynamicRange, "reference_center +/- 3SD from image/statistical fusion"),
  };
}

function staticConstraintRange(center) {
  return {
    min: center,
    max: center,
    basis: "static or baseline design parameter; no performance range is modeled yet",
  };
}

function performanceConstraintRange(center, min, max, basis) {
  return {
    min: Number(min.toFixed(4)),
    max: Number(max.toFixed(4)),
    basis,
  };
}

function restingState(center, unit) {
  return {
    value: center,
    unit,
    basis: "resting/no-phonation baseline state for the character",
  };
}

function plausibilityRange(min, max, unit, basis) {
  return { min, max, unit, basis };
}

function parameterRangeMetadata(center, min, max, unit, dynamicRange, plausibilityBasis) {
  const performanceRange = dynamicRange ?? staticConstraintRange(center);
  return {
    resting_anatomical_state: restingState(center, unit),
    morphological_plausibility_range: plausibilityRange(min, max, unit, plausibilityBasis),
    performance_control_range: performanceRange,
    constraint_range: performanceRange,
  };
}

function editableControl(center, min, max, unit, source, confidence = 0.5, evidence = null, dynamicRange = null) {
  const roundedCenter = Number(center.toFixed(4));
  const sd = Math.max(Math.abs(max - min) / 6, 0.0001);
  const roundedSd = Number(sd.toFixed(4));
  const editMin = Number((roundedCenter - sd * 3).toFixed(4));
  const editMax = Number((roundedCenter + sd * 3).toFixed(4));
  return {
    center: roundedCenter,
    unit,
    source,
    evidence,
    confidence,
    statistics: {
      reference_center: roundedCenter,
      sd: roundedSd,
      minus_3sd: editMin,
      plus_3sd: editMax,
    },
    edit_range: {
      min: editMin,
      max: editMax,
      basis: "reference_center ± 3SD; UI design-value editing range",
    },
    design_bounds: {
      min,
      max,
      basis: "nominal physical/control-domain bounds before center-aligned UI expansion",
    },
    ...parameterRangeMetadata(roundedCenter, editMin, editMax, unit, dynamicRange, "center-aligned UI/plausibility range; hard design bounds are stored separately when available"),
  };
}

function respiratoryRangeFromPrediction(prediction, k = 1) {
  if (!prediction) {
    return {
      center: null,
      min: null,
      max: null,
      unit: null,
      source: "available only when local young respiratory equations match age/sex input",
      evidence: "youngJapaneseRespiratory1020",
      confidence: 0,
    };
  }
  const sd = Math.abs(prediction.residual * k);
  const editMin = Number((prediction.center - sd * 3).toFixed(4));
  const editMax = Number((prediction.center + sd * 3).toFixed(4));
  return {
    center: prediction.center,
    unit: prediction.unit,
    source: prediction.formula,
    evidence: prediction.source,
    confidence: Math.max(0.2, Math.min(0.72, prediction.contribution)),
    statistics: {
      reference_center: prediction.center,
      sd: Number(sd.toFixed(4)),
      minus_3sd: editMin,
      plus_3sd: editMax,
    },
    edit_range: {
      min: editMin,
      max: editMax,
      basis: "prediction residual × range factor × 3; UI design-value editing range",
    },
    ...parameterRangeMetadata(prediction.center, editMin, editMax, prediction.unit, staticConstraintRange(prediction.center), "prediction residual interval for plausibility inspection"),
    residual: prediction.residual,
    multiple_r: prediction.multiple_r,
    contribution: prediction.contribution,
  };
}

function youngRespiratoryCapacityScale(predictions, sex) {
  if (!predictions?.FVC?.center) return 1;
  const adolescentAdultReference = sex === "male" ? 4.25 : sex === "female" ? 3.25 : 3.75;
  return clamp(predictions.FVC.center / adolescentAdultReference, 0.65, 1.18);
}

function renderDetailControls() {
  renderSliderGroup(els.vocalTractProfileSliders, vocalTractProfileControls);
  renderSliderGroup(els.glottalPhysiologySliders, glottalPhysiologyControls);
  renderSliderGroup(els.trunkPhysiologySliders, trunkPhysiologyControls);
  renderSliderGroup(els.vowelExecutionSliders, vowelExecutionControls);
  renderSliderGroup(els.consonantExecutionSliders, consonantExecutionControls);
  renderSliderGroup(els.advancedAcousticSliders, advancedAcousticControls);
  renderPerformanceRangeEditors();
}

function renderPerformanceRangeEditors() {
  renderPerformanceRangeGroup(els.glottalPerformanceRanges, performanceRangeGroups.glottal);
  renderPerformanceRangeGroup(els.vocalTractPerformanceRanges, performanceRangeGroups.vocalTract);
  renderPerformanceRangeGroup(els.trunkPerformanceRanges, performanceRangeGroups.trunk);
}

function hasPerformanceRangeEditor(key) {
  return Object.values(performanceRangeGroups).some((controls) => controls.filter(Boolean).some((control) => control.key === key));
}

function renderSliderGroup(container, controls) {
  if (!container) return;
  container.innerHTML = "";
  for (const control of controls.filter(Boolean)) renderConstraintSlider(container, control);
}

function renderPerformanceRangeGroup(container, controls) {
  if (!container) return;
  container.innerHTML = "";
  for (const control of controls.filter(Boolean)) renderPerformanceRangeEditor(container, control);
}

function renderConstraintSlider(container, control) {
  const item = state.constraints[control.key];
  if (!item || item.center == null) return;
  const bounds = sliderBounds(item, control);
  const row = document.createElement("div");
  row.className = "slider-row";
  if (control.readOnly) row.classList.add("derived-readonly-row");
  const caption = document.createElement("div");
  caption.className = "slider-caption";
  const captionLabel = document.createElement("label");
  const inputId = `constraint-${control.key}`;
  captionLabel.htmlFor = inputId;
  captionLabel.textContent = control.label;
  caption.appendChild(captionLabel);
  const citation = sourceCitationElement(item.evidence);
  if (citation) caption.appendChild(citation);
  const sliderCell = document.createElement("div");
  sliderCell.className = "slider-cell";
  const input = document.createElement("input");
  input.id = inputId;
  input.type = "range";
  input.min = bounds.min;
  input.max = bounds.max;
  input.step = control.step;
  input.value = clamp(item.center, bounds.min, bounds.max);
  input.className = "sd-range";
  input.title = item.source || "";
  input.disabled = Boolean(control.readOnly);
  if (control.readOnly) input.setAttribute("aria-readonly", "true");
  const scale = makeSliderScale(item, bounds, control);
  sliderCell.append(input, scale);
  const output = document.createElement("output");
  const warning = document.createElement("span");
  warning.className = "slider-warning";
  const update = (persistOverride = false) => {
    const value = Number(input.value);
    if (!control.readOnly) state.constraints[control.key].center = value;
    if (persistOverride && !control.readOnly) {
      state.constraintOverrides[control.key] = value;
      state.constraints[control.key].user_override = true;
      const performanceRange = state.constraints[control.key].performance_control_range;
      if (performanceRange) {
        const nextRange = {
          ...performanceRange,
          min: Number(Math.min(Number(performanceRange.min), value).toFixed(4)),
          max: Number(Math.max(Number(performanceRange.max), value).toFixed(4)),
        };
        state.constraints[control.key].performance_control_range = nextRange;
        state.constraints[control.key].constraint_range = { ...nextRange };
        if (state.performanceRangeOverrides[control.key]) {
          state.performanceRangeOverrides[control.key] = { ...nextRange };
        }
      }
    }
    state.lastWav = null;
    if (!control.readOnly && state.constraints[control.key].resting_anatomical_state) {
      state.constraints[control.key].resting_anatomical_state.value = value;
    }
    output.textContent = `${format(value, control.step < 0.1 ? 2 : 1)} ${control.unit}`;
    const z = sliderZ(value, item);
    row.classList.toggle("warn-2sd", Math.abs(z) > 2);
    row.classList.toggle("warn-3sd", Math.abs(z) > 3);
    warning.textContent = Math.abs(z) > 2 ? "!" : "";
    updateSliderScale(scale, value, item, bounds, control);
    if (persistOverride && !control.readOnly) refreshDerivedConstraintCenters(control.key);
    state.vocalTractGeometry = buildVocalTractGeometry();
    renderConstraints();
    draw();
    if (persistOverride && hasPerformanceRangeEditor(control.key)) renderPerformanceRangeEditors();
  };
  if (!control.readOnly) {
    input.addEventListener("input", () => update(true));
    if (["vocal_fold_spring_constant", "baseline_muscle_tension", "thoracic_volume_l", "abdominal_volume_l"].includes(control.key)) {
      input.addEventListener("change", () => {
        refreshDerivedConstraintCenters(control.key);
        renderDetailControls();
        renderConstraints();
        draw();
      });
    }
  }
  update(false);
  row.append(caption, sliderCell, output, warning);
  container.appendChild(row);
}

function renderPerformanceRangeEditor(container, control) {
  const item = state.constraints[control.key];
  if (!item || item.center == null) return;
  const center = Number(item.center);
  const range = item.performance_control_range ?? staticConstraintRange(center);
  const domain = performanceEditorBounds(item, control, range);
  const row = document.createElement("div");
  row.className = "performance-range-row";

  const heading = document.createElement("div");
  heading.className = "performance-range-heading";
  const label = document.createElement("strong");
  label.textContent = control.label;
  heading.appendChild(label);
  const citation = sourceCitationElement(item.evidence);
  if (citation) heading.appendChild(citation);

  const values = document.createElement("div");
  values.className = "performance-range-values";
  const minInput = performanceRangeNumberInput("MIN", range.min, domain.min, center, control.step, control.unit);
  const base = document.createElement("div");
  base.className = "performance-range-base";
  base.innerHTML = `<span>BASE</span><strong>${format(center, control.step < 0.1 ? 2 : 1)} ${control.unit}</strong>`;
  const maxInput = performanceRangeNumberInput("MAX", range.max, center, domain.max, control.step, control.unit);
  minInput.input.dataset.performanceKey = control.key;
  minInput.input.dataset.rangeBound = "min";
  maxInput.input.dataset.performanceKey = control.key;
  maxInput.input.dataset.rangeBound = "max";
  values.append(minInput.wrapper, base, maxInput.wrapper);

  const track = document.createElement("div");
  track.className = "performance-range-track";
  const fill = document.createElement("span");
  fill.className = "performance-range-fill";
  const marker = document.createElement("span");
  marker.className = "performance-range-center";
  track.append(fill, marker);

  const update = (persistOverride = true) => {
    const min = clamp(Number(minInput.input.value), domain.min, center);
    const max = clamp(Number(maxInput.input.value), center, domain.max);
    minInput.input.value = String(min);
    maxInput.input.value = String(max);
    if (persistOverride) {
      const next = {
        min: Number(min.toFixed(4)),
        max: Number(max.toFixed(4)),
        basis: "user-defined PerformanceControlRange around the character baseline",
        user_override: true,
      };
      item.performance_control_range = next;
      item.constraint_range = { ...next };
      state.performanceRangeOverrides[control.key] = { ...next };
    }
    const denominator = Math.max(0.0001, domain.max - domain.min);
    const start = ((min - domain.min) / denominator) * 100;
    const end = ((max - domain.min) / denominator) * 100;
    const centerPercent = ((center - domain.min) / denominator) * 100;
    fill.style.left = `${start}%`;
    fill.style.width = `${Math.max(0, end - start)}%`;
    marker.style.left = `${centerPercent}%`;
    track.title = `${format(min, 2)} ～ ${format(max, 2)} ${control.unit}; BASE ${format(center, 2)}`;
    state.lastWav = null;
    if (persistOverride) renderConstraints();
  };
  minInput.input.addEventListener("input", () => update(true));
  maxInput.input.addEventListener("input", () => update(true));
  update(false);
  row.append(heading, values, track);
  container.appendChild(row);
}

function performanceRangeNumberInput(labelText, value, min, max, step, unit) {
  const wrapper = document.createElement("label");
  wrapper.className = "performance-range-number";
  const label = document.createElement("span");
  label.textContent = labelText;
  const input = document.createElement("input");
  input.type = "number";
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  input.value = String(value);
  input.setAttribute("aria-label", `${labelText} ${unit}`.trim());
  wrapper.append(label, input);
  return { wrapper, input };
}

function performanceEditorBounds(item, control, range) {
  const candidates = [
    Number(item.design_bounds?.min),
    Number(item.edit_range?.min),
    Number(control.min),
    Number(range.min),
  ].filter(Number.isFinite);
  const upperCandidates = [
    Number(item.design_bounds?.max),
    Number(item.edit_range?.max),
    Number(control.max),
    Number(range.max),
  ].filter(Number.isFinite);
  return {
    min: Math.min(...candidates),
    max: Math.max(...upperCandidates),
  };
}

function sliderBounds(item, control) {
  const itemMin = Number(item.edit_range?.min ?? item.min);
  const itemMax = Number(item.edit_range?.max ?? item.max);
  const fallbackMin = Number(control.min);
  const fallbackMax = Number(control.max);
  if (Number.isFinite(itemMin) && Number.isFinite(itemMax) && itemMax > itemMin) {
    return { min: itemMin, max: itemMax };
  }
  return { min: fallbackMin, max: fallbackMax };
}

function makeSliderScale(item, bounds, control) {
  const scale = document.createElement("div");
  scale.className = "slider-scale";
  scale.style.setProperty("--sd-start", `${statPercent(statValue(item, -3), bounds)}%`);
  scale.style.setProperty("--sd-m2", `${statPercent(statValue(item, -2), bounds)}%`);
  scale.style.setProperty("--sd-m1", `${statPercent(statValue(item, -1), bounds)}%`);
  scale.style.setProperty("--sd-p1", `${statPercent(statValue(item, 1), bounds)}%`);
  scale.style.setProperty("--sd-p2", `${statPercent(statValue(item, 2), bounds)}%`);
  scale.style.setProperty("--sd-end", `${statPercent(statValue(item, 3), bounds)}%`);
  const marker = document.createElement("span");
  marker.className = "slider-current-marker";
  scale.appendChild(marker);
  for (const sd of [-3, -2, -1, 0, 1, 2, 3]) {
    const tick = document.createElement("span");
    tick.className = "slider-tick";
    tick.style.left = `${statPercent(statValue(item, sd), bounds)}%`;
    tick.textContent = sd === 0 ? "0" : `${sd > 0 ? "+" : ""}${sd}`;
    tick.title = `${sd > 0 ? "+" : ""}${sd}SD: ${format(statValue(item, sd), control.step < 0.1 ? 2 : 1)} ${control.unit}`;
    scale.appendChild(tick);
  }
  return scale;
}

function updateSliderScale(scale, value, item, bounds, control) {
  const marker = scale.querySelector(".slider-current-marker");
  const z = sliderZ(value, item);
  if (marker) {
    marker.style.left = `${statPercent(value, bounds)}%`;
    marker.title = `current: ${format(value, control.step < 0.1 ? 2 : 1)} ${control.unit}; z=${format(z, 2)}`;
  }
}

function statValue(item, sd) {
  const min = Number(item.edit_range?.min ?? item.min);
  const max = Number(item.edit_range?.max ?? item.max);
  if (!Number.isFinite(min) || !Number.isFinite(max)) return item.center ?? 0;
  const center = Number.isFinite(item.statistics?.reference_center) ? item.statistics.reference_center : Number.isFinite(item.center) ? item.center : (min + max) / 2;
  const unitSd = Number.isFinite(item.statistics?.sd) && item.statistics.sd > 0 ? item.statistics.sd : (max - min) / 6;
  return center + unitSd * sd;
}

function statPercent(value, bounds) {
  const min = Number(bounds.min);
  const max = Number(bounds.max);
  if (!Number.isFinite(value) || !Number.isFinite(min) || !Number.isFinite(max) || min === max) return 50;
  return clamp(((value - min) / (max - min)) * 100, 0, 100);
}

function sliderZ(value, item) {
  const min = Number(item.edit_range?.min ?? item.min);
  const max = Number(item.edit_range?.max ?? item.max);
  if (!Number.isFinite(min) || !Number.isFinite(max) || max === min) return 0;
  const center = Number.isFinite(item.statistics?.reference_center) ? item.statistics.reference_center : Number.isFinite(item.center) ? item.center : (min + max) / 2;
  const oneSd = Number.isFinite(item.statistics?.sd) && item.statistics.sd > 0 ? item.statistics.sd : Math.max(Math.abs(max - min) / 6, 0.0001);
  return (value - center) / oneSd;
}

function renderCalibrationSummary() {
  if (!els.calibrationSummary) return;
  const calibration = state.calibration;
  els.calibrationSummary.innerHTML = "";
  if (!calibration) return;
  const metrics = [
    {
      label: "全身正面 B1",
      value: calibration.stature.cm_per_px
        ? `${format(calibration.stature.pixel_height, 1)} px / ${format(calibration.stature.cm_per_px, 4)} cm·px⁻¹`
        : "未設定",
      note: "頭頂点－足底基準面",
    },
    {
      label: "共通全頭高 A36",
      value: calibration.shared_total_head_height.value_cm
        ? `${format(calibration.shared_total_head_height.value_cm, 2)} cm`
        : "未設定",
      note: calibration.shared_total_head_height.source === "body_stature_vertex_to_gnathion"
        ? "全身画像の頭頂点－オトガイ点を基準"
        : calibration.shared_total_head_height.source === "front_interpupillary_statistical_fallback"
          ? "瞳孔間幅事前値による暫定基準"
          : "基準点を配置してください",
    },
    {
      label: "頭頚部正面 A36",
      value: calibration.views.head_front.cm_per_px
        ? calibration.views.head_front.total_head_height_px
          ? `${format(calibration.views.head_front.total_head_height_px, 1)} px / ${format(calibration.views.head_front.cm_per_px, 4)} cm·px⁻¹`
          : `${format(calibration.views.head_front.cm_per_px, 4)} cm·px⁻¹`
        : "未設定",
      note: calibration.views.head_front.scale_source === "shared_total_head_height"
        ? "頭頂点－オトガイ点を共通全頭高へ一致"
        : calibration.views.head_front.scale_source === "interpupillary_statistical_fallback"
          ? "瞳孔間幅事前値による暫定換算"
          : "頭頂点とオトガイ点を配置してください",
    },
    {
      label: "頭頚部側面 A36",
      value: calibration.views.head_profile.cm_per_px
        ? `${format(calibration.views.head_profile.total_head_height_px, 1)} px / ${format(calibration.views.head_profile.cm_per_px, 4)} cm·px⁻¹`
        : "未設定",
      note: calibration.views.head_profile.scale_source === "shared_total_head_height"
        ? "頭頂点－オトガイ点を共通全頭高へ一致"
        : "頭頂点とオトガイ点を配置してください",
    },
  ];
  for (const metric of metrics) {
    const item = document.createElement("div");
    item.className = "calibration-metric";
    const label = document.createElement("strong");
    const value = document.createElement("span");
    const note = document.createElement("small");
    label.textContent = metric.label;
    value.textContent = metric.value;
    note.textContent = metric.note;
    item.append(label, value, note);
    els.calibrationSummary.appendChild(item);
  }
  if (calibration.cross_view_consistency.status !== "reconciled") {
    const status = document.createElement("p");
    status.className = `calibration-status ${calibration.cross_view_consistency.status}`;
    status.textContent = "共通全頭高を比較できる画像が不足しています。";
    els.calibrationSummary.appendChild(status);
  }
  if (calibration.warnings.length) {
    const warnings = document.createElement("ul");
    warnings.className = "calibration-warnings";
    for (const message of calibration.warnings) {
      const item = document.createElement("li");
      item.textContent = message;
      warnings.appendChild(item);
    }
    els.calibrationSummary.appendChild(warnings);
  }
}

function renderLandmarkReference() {
  if (!els.landmarkReferenceTable) return;
  els.landmarkReferenceTable.innerHTML = "";
  for (const concept of landmarkSystem.schema.concepts) {
    const row = document.createElement("tr");
    const nameCell = document.createElement("td");
    const name = document.createElement("strong");
    const latin = document.createElement("small");
    name.textContent = concept.name_ja;
    latin.textContent = `${concept.name_en} [${concept.abbreviation}]`;
    nameCell.append(name, latin);
    row.append(
      nameCell,
      landmarkViewCell(concept.views.body_front),
      landmarkViewCell(concept.views.head_front),
      landmarkViewCell(concept.views.head_profile),
    );
    const definitionCell = document.createElement("td");
    definitionCell.textContent = `${concept.definition} ${concept.role}`;
    row.appendChild(definitionCell);
    els.landmarkReferenceTable.appendChild(row);
  }
}

function landmarkViewCell(keys) {
  const cell = document.createElement("td");
  if (!keys) {
    cell.textContent = "-";
    return cell;
  }
  cell.textContent = keys.split("/").map((key) => labels[key.trim()] ?? key.trim()).join(" / ");
  return cell;
}

function renderFeatureTable() {
  els.featureTable.innerHTML = "";
  for (const [key, f] of Object.entries(state.features)) {
    const row = document.createElement("tr");
    const centerTitle = f.statistical_center_kind === "median"
      ? "source median"
      : "median unavailable; mean used as representative center";
    const evidenceCell = document.createElement("td");
    const citation = sourceCitationElement(f.evidence);
    if (citation) {
      const sourceSpecificNote = [sourceTooltipText(f.evidence), f.source_note].filter(Boolean).join("\n");
      citation.title = sourceSpecificNote;
      citation.dataset.tooltip = sourceSpecificNote;
      evidenceCell.appendChild(citation);
    } else {
      evidenceCell.textContent = f.evidence_level;
      evidenceCell.title = f.source_note ?? "";
    }
    const cells = [
      f.label,
      `${format(f.integrated, 2)} ${f.unit}`,
      `${format(f.statistical_median, 2)} ${f.unit}`,
      format(f.z_score, 2),
      format(f.image_weight, 2),
    ].map((text) => {
      const cell = document.createElement("td");
      cell.textContent = text;
      return cell;
    });
    cells[2].title = centerTitle;
    row.append(...cells, evidenceCell);
    els.featureTable.appendChild(row);
  }
}

function renderPublicationReferences() {
  const policy = referenceData.publicationPolicy;
  if (policy && els.publicationPolicyDisclosure) {
    els.publicationPolicyDisclosure.textContent = policy.disclosure;
    renderList(els.publicationPolicyScope, policy.scope);
    renderList(els.publicationPolicyExclusions, policy.exclusions);
  }

  if (!els.referenceSourceTable) return;
  els.referenceSourceTable.innerHTML = "";
  for (const [key, source] of Object.entries(referenceData.sources)) {
    if (source.display_in_reference_table === false) continue;
    const row = document.createElement("tr");
    const numberCell = document.createElement("td");
    const labelCell = document.createElement("td");
    const roleCell = document.createElement("td");

    const href = source.doi ? `https://doi.org/${source.doi}` : source.url;
    const title = document.createElement(href ? "a" : "span");
    title.textContent = source.label ?? key;
    if (href) {
      title.href = href;
      title.target = "_blank";
      title.rel = "noreferrer";
    }
    const keyLine = document.createElement("small");
    keyLine.textContent = source.doi ? `DOI: ${source.doi}` : source.url ? "公式資料・公開ページ" : "DOI未確認";
    numberCell.textContent = `[${referenceNumber(key)}]`;
    labelCell.append(title, keyLine);

    const details = [
      source.use,
      `公開区分: ${source.publication_use ?? "reference"} / ${source.public_release_status ?? source.evidence_level ?? "unclassified"}`,
      source.privacy_note ?? source.scope_note ?? source.method_warning,
    ].filter(Boolean).join("\n");
    labelCell.tabIndex = 0;
    labelCell.dataset.tooltip = details;
    labelCell.setAttribute("aria-label", `${source.label ?? key}。${details}`);
    roleCell.textContent = source.publication_use ?? "reference";

    row.append(numberCell, labelCell, roleCell);
    els.referenceSourceTable.appendChild(row);
  }
}

function renderList(target, items = []) {
  if (!target) return;
  target.innerHTML = "";
  for (const item of items) {
    const li = document.createElement("li");
    li.textContent = item;
    target.appendChild(li);
  }
}

function renderConstraints() {
  els.constraintOutput.textContent = JSON.stringify(buildExport(), null, 2);
}

function voiceControlProfileContext() {
  return {
    app_version: APP_VERSION,
    project_title: els.projectTitleInput?.value?.trim() || "voice_profile",
    age: num(els.ageInput, 17),
    sex_reference_class: els.sexInput?.value ?? "neutral",
    reference_image_style: normalizeReferenceImageStyle(els.referenceImageStyleInput?.value),
    constraints: withoutRetiredConstraints(state.constraints),
    performance_range_overrides: withoutReadOnlyDerivedOverrides(withoutRetiredConstraints(state.performanceRangeOverrides)),
    design_overrides: state.voiceControlOverrides,
  };
}

function buildVoiceControlProfile() {
  if (!voiceControlProfile?.build) return null;
  return voiceControlProfile.build(voiceControlProfileContext());
}

function buildTtsConfiguration() {
  return {
    schema_version: "character_voice_designer_tts_configuration_0.1",
    transport: "audio_cpp_http",
    selected_model: els.ttsModelSelect?.value || "irodori-vdes",
    seed: Math.trunc(num(els.ttsSeedInput, 20260719)),
    num_inference_steps: STANDARD_TTS_INFERENCE_STEPS,
    candidate_count: 1,
    automatic_retry: false,
    compiled_voice_identity_id: state.activeCompiledIdentityId,
    caption_guidance_scale: num(els.ttsCaptionGuidanceInput, 2),
    f0_postprocess: {
      enabled: els.ttsF0CorrectionEnabled?.checked !== false,
      strength: num(els.ttsF0CorrectionStrength, 1),
      method: "praat_psola_contour_preserving_median_shift",
    },
    caption_override: state.ttsCaptionManual ? els.ttsCaptionInput?.value?.trim() || null : null,
    endpoint: "/api/audio-cpp/speech",
  };
}

function activeTtsCaption(profile = buildVoiceControlProfile()) {
  const manual = state.ttsCaptionManual ? els.ttsCaptionInput?.value?.trim() : "";
  return manual || profile?.tts_adapters?.audio_cpp?.caption_ja || "";
}

function compiledRequestProfile(fallback = buildVoiceControlProfile()) {
  const identity = state.activeCompiledIdentity;
  if (!identity?.style?.identity_anchor) return fallback;
  return {
    ...fallback,
    identity_anchor: identity.style.identity_anchor,
    tts_adapters: {
      ...(fallback?.tts_adapters || {}),
      audio_cpp: {
        ...(fallback?.tts_adapters?.audio_cpp || {}),
        caption_ja: identity.style.caption || "",
      },
    },
  };
}

function setVoiceIdentityStatus(message, isError = false) {
  if (!els.voiceIdentityCompileStatus) return;
  els.voiceIdentityCompileStatus.textContent = message;
  els.voiceIdentityCompileStatus.classList.toggle("error", isError);
}

function voiceIdentityApiErrorMessage(error, action) {
  const detail = error?.message || String(error);
  if (/HTTP 404|不正な応答|Unexpected token|not found/i.test(detail)) {
    return `${action}できません。更新前のPythonサーバーが動作している可能性があります。WebUIを停止し、webui.batまたはwebui.shで再起動してください。`;
  }
  return `${action}できません: ${detail}`;
}

function renderVoiceIdentityWorkspace() {
  const profile = buildVoiceControlProfile();
  if (profile) {
    if (els.identityCompileStyleF0) {
      els.identityCompileStyleF0.textContent = `${Math.round(profile.identity_anchor.f0_mean_hz)} Hz`;
    }
    if (els.identityCompileStyleVtl) {
      els.identityCompileStyleVtl.textContent = `${Number(profile.identity_anchor.vocal_tract_length_scale).toFixed(2)}x`;
    }
    if (els.identityCompileStyleCfg) {
      els.identityCompileStyleCfg.textContent = Number(num(els.ttsCaptionGuidanceInput, 2)).toFixed(1);
    }
  }

  const selectedSpeakerId = state.selectedIdentitySpeakerId || els.identitySpeakerSelect?.value;
  const selectedSpeaker = (state.experimentResources?.speech_speaker_conditions || [])
    .find((item) => item.id === selectedSpeakerId);
  if (els.identitySpeakerStatus) {
    els.identitySpeakerStatus.textContent = selectedSpeaker
      ? `${selectedSpeaker.shape?.join("x") || "shape不明"} / ${selectedSpeaker.model_binding_status || "unbound"}`
      : "Speaker Embeddingを使用しない";
  }
  const selectedStyle = (state.voiceIdentityResources?.styles || [])
    .find((item) => item.id === els.identityStyleSelect?.value);
  if (els.identityStyleStatus) {
    els.identityStyleStatus.textContent = selectedStyle
      ? `${selectedStyle.label}を再利用します。現在の設計値は変更されません。`
      : "現在の設計値をコンパイル時に独立したStyle JSONへ保存します。";
  }
  const calibrationCount = state.voiceIdentityCalibrationIds.size;
  if (els.identityCalibrationStatus) {
    els.identityCalibrationStatus.textContent = calibrationCount
      ? `${calibrationCount}件を選択中。${calibrationCount >= 3 ? "校正分布を構築できます。" : "閾値尺度は暫定fallbackです。"}`
      : "未選択。音響値は表示しますが話者距離は算出できません。";
  }

  const identity = state.activeCompiledIdentity;
  if (els.compiledIdentitySpeakerValue) {
    els.compiledIdentitySpeakerValue.textContent = identity?.speaker?.file || "なし";
  }
  if (els.compiledIdentityCompatibilityValue) {
    els.compiledIdentityCompatibilityValue.textContent = identity?.speaker
      ? identity.speaker.model_contract_compatible ? "互換" : "非互換"
      : identity ? "Speaker未使用" : "-";
  }
  if (els.compiledIdentityCalibrationValue) {
    els.compiledIdentityCalibrationValue.textContent = String(identity?.calibration?.sample_count ?? 0);
  }
  if (els.compiledIdentityPolicyValue) {
    els.compiledIdentityPolicyValue.textContent = identity
      ? `${identity.standard_generation?.num_inference_steps ?? 20} Step / 警告のみ`
      : "警告のみ";
  }
  if (identity) {
    setVoiceIdentityStatus(
      `${identity.name}を通常生成に使用中。Speaker、Style、校正基準は固定されています。`,
    );
  }
}

function renderVoiceIdentityResources() {
  const resources = state.voiceIdentityResources || {};
  const identities = (resources.identities || []).map((item) => ({
    id: item.id,
    label: `${item.label} / ${item.model?.id || "model不明"}`,
  }));
  populateExperimentSelect(
    els.compiledVoiceIdentitySelect,
    identities,
    "未コンパイル（軽量評価のみ）",
  );
  if (els.compiledVoiceIdentitySelect) {
    els.compiledVoiceIdentitySelect.value = state.activeCompiledIdentityId || "";
  }
  const speechSpeakers = state.experimentResources?.speech_speaker_conditions || [];
  const availableSpeakerIds = new Set(speechSpeakers.map((item) => item.id));
  const selectedSpeakerId = state.selectedIdentitySpeakerId || els.identitySpeakerSelect?.value;
  populateExperimentSelect(els.identitySpeakerSelect, speechSpeakers, "使用しない");
  state.selectedIdentitySpeakerId = availableSpeakerIds.has(selectedSpeakerId)
    ? selectedSpeakerId
    : null;
  if (els.identitySpeakerSelect) {
    els.identitySpeakerSelect.value = state.selectedIdentitySpeakerId || "";
  }
  populateExperimentSelect(
    els.identityStyleSelect,
    resources.styles || [],
    "現在のVoiceControlProfileを新規固定",
  );
  renderVoiceIdentityCalibrationList();
  renderVoiceIdentityWorkspace();
}

function renderVoiceIdentityCalibrationList() {
  const container = els.identityCalibrationList;
  if (!container) return;
  stopResourceAudioPreview(container);
  const calibrations = state.voiceIdentityResources?.calibrations || [];
  const availableIds = new Set(calibrations.map((item) => item.id));
  for (const id of Array.from(state.voiceIdentityCalibrationIds)) {
    if (!availableIds.has(id)) state.voiceIdentityCalibrationIds.delete(id);
  }
  container.replaceChildren();
  if (!calibrations.length) {
    const empty = document.createElement("p");
    empty.className = "evaluation-file-empty";
    empty.textContent = "校正WAVは未登録です。";
    container.append(empty);
    return;
  }
  for (const calibration of calibrations) {
    const row = document.createElement("div");
    row.className = "evaluation-file-row calibration";
    row.setAttribute("role", "listitem");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = state.voiceIdentityCalibrationIds.has(calibration.id);
    checkbox.setAttribute("aria-label", `${calibration.label}を校正に使用する`);
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) {
        if (state.voiceIdentityCalibrationIds.size >= MAX_CALIBRATION_RESOURCES) {
          checkbox.checked = false;
          setVoiceIdentityStatus(`校正音声は最大${MAX_CALIBRATION_RESOURCES}件です。`, true);
          return;
        }
        state.voiceIdentityCalibrationIds.add(calibration.id);
      } else {
        state.voiceIdentityCalibrationIds.delete(calibration.id);
      }
      renderVoiceIdentityWorkspace();
    });
    const name = document.createElement("span");
    name.className = "evaluation-file-name";
    name.textContent = calibration.label;
    name.title = calibration.label;
    const play = createResourceAudioPreviewButton(
      `/api/voice-identities/calibrations/${encodeURIComponent(calibration.id)}/audio`,
      calibration.label,
      (error) => setVoiceIdentityStatus(`校正音声を再生できません: ${error.message}`, true),
    );
    row.append(checkbox, name, play);
    container.append(row);
  }
}

async function refreshVoiceIdentities({ silent = false } = {}) {
  if (!els.compiledVoiceIdentitySelect) return;
  if (!silent) setVoiceIdentityStatus("音声同一性の状態を更新しています。");
  try {
    const [resources, experimentResources] = await Promise.all([
      experimentApi("/api/voice-identities/resources"),
      experimentApi("/api/experiments/resources"),
    ]);
    state.voiceIdentityResources = resources;
    state.experimentResources = experimentResources;
    if (
      state.activeCompiledIdentityId &&
      !(resources.identities || []).some((item) => item.id === state.activeCompiledIdentityId)
    ) {
      state.activeCompiledIdentityId = null;
    }
    state.activeCompiledIdentity = state.activeCompiledIdentityId
      ? await experimentApi(`/api/voice-identities/${state.activeCompiledIdentityId}`)
      : null;
    renderVoiceIdentityResources();
    if (!silent && !state.activeCompiledIdentity) {
      setVoiceIdentityStatus("コンパイルするSpeaker、Style、校正音声を選択してください。");
    }
  } catch (error) {
    setVoiceIdentityStatus(voiceIdentityApiErrorMessage(error, "音声同一性を読み込み"), true);
  }
}

async function selectCompiledVoiceIdentity(identityId) {
  state.activeCompiledIdentityId = identityId || null;
  state.activeCompiledIdentity = identityId
    ? await experimentApi(`/api/voice-identities/${identityId}`)
    : null;
  state.lastIdentityEvaluation = null;
  renderVoiceIdentityWorkspace();
  renderTtsRequestSummary();
  renderTtsIdentityEvaluation(null);
  renderConstraints();
}

async function uploadVoiceCalibration(file) {
  if (!file) return null;
  setVoiceIdentityStatus(`${file.name}を校正音声として解析しています。`);
  const query = new URLSearchParams({ name: file.name });
  const calibration = await experimentApi(`/api/voice-identities/calibrations?${query}`, {
    method: "POST",
    headers: { "Content-Type": file.type || "audio/wav" },
    body: file,
  });
  return calibration;
}

async function compileVoiceIdentity() {
  const profile = buildVoiceControlProfile();
  if (!profile) throw new Error("VoiceControlProfileを構築できません。");
  const speakerCondition = state.selectedIdentitySpeakerId
    || els.identitySpeakerSelect?.value
    || null;
  if (
    speakerCondition
    && !(state.experimentResources?.speech_speaker_conditions || [])
      .some((item) => item.id === speakerCondition)
  ) {
    throw new Error("選択したSpeaker Embeddingは現在のモデルで使用できません。状態を更新してください。");
  }
  setVoiceIdentityStatus("音声同一性をコンパイルしています。");
  if (els.compileVoiceIdentityBtn) els.compileVoiceIdentityBtn.disabled = true;
  try {
    const identity = await experimentApi("/api/voice-identities/compile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: els.voiceIdentityNameInput?.value?.trim() || "voice_profile",
        model: els.ttsModelSelect?.value || "irodori-vdes",
        speaker_condition: speakerCondition,
        style_id: els.identityStyleSelect?.value || null,
        style_profile: profile,
        caption: activeTtsCaption(profile),
        caption_guidance_scale: num(els.ttsCaptionGuidanceInput, 2),
        calibration_ids: Array.from(state.voiceIdentityCalibrationIds),
      }),
    });
    if (speakerCondition && identity?.speaker?.file !== speakerCondition) {
      throw new Error(
        `Speaker Embeddingの固定を確認できません。要求: ${speakerCondition} / 応答: ${identity?.speaker?.file || "未使用"}`,
      );
    }
    state.activeCompiledIdentityId = identity.id;
    state.activeCompiledIdentity = identity;
    await refreshVoiceIdentities({ silent: true });
    if (els.compiledVoiceIdentitySelect) els.compiledVoiceIdentitySelect.value = identity.id;
    renderVoiceIdentityWorkspace();
    renderTtsRequestSummary();
    renderConstraints();
  } finally {
    if (els.compileVoiceIdentityBtn) els.compileVoiceIdentityBtn.disabled = false;
  }
}

function renderTtsIdentityEvaluation(evaluation = state.lastIdentityEvaluation) {
  if (!els.ttsIdentityEvaluationValues) return;
  els.ttsIdentityEvaluationValues.replaceChildren();
  if (!evaluation) {
    if (els.ttsIdentityEvaluationBadge) {
      els.ttsIdentityEvaluationBadge.textContent = "未評価";
      els.ttsIdentityEvaluationBadge.dataset.status = "";
    }
    if (els.ttsIdentityEvaluationWarning) {
      els.ttsIdentityEvaluationWarning.textContent =
        "20 Step単発生成後に評価します。閾値超過時も自動再試行は行いません。";
    }
    return;
  }
  const values = evaluation.acoustic_values || {};
  const distance = evaluation.distance || {};
  const items = [
    ["話者距離 proxy", distance.combined_proxy_distance == null ? "算出不可" : Number(distance.combined_proxy_distance).toFixed(2)],
    ["F0中央値", values.f0_median_hz == null ? "-" : `${Number(values.f0_median_hz).toFixed(1)} Hz`],
    ["F0誤差", values.target_error_semitones == null ? "-" : `${Number(values.target_error_semitones).toFixed(2)} st`],
    ["スペクトル重心", values.spectral_centroid_hz == null ? "-" : `${Math.round(values.spectral_centroid_hz)} Hz`],
    ["有声率", values.voiced_frame_ratio == null ? "-" : `${Math.round(values.voiced_frame_ratio * 100)}%`],
    ["RMS", values.rms == null ? "-" : Number(values.rms).toFixed(4)],
    ["クリップ率", values.clipping_ratio == null ? "-" : `${(values.clipping_ratio * 100).toFixed(3)}%`],
    ["自動再試行", "なし"],
  ];
  for (const [labelText, valueText] of items) {
    const item = document.createElement("div");
    const label = document.createElement("span");
    const value = document.createElement("strong");
    label.textContent = labelText;
    value.textContent = valueText;
    item.append(label, value);
    els.ttsIdentityEvaluationValues.append(item);
  }
  if (els.ttsIdentityEvaluationBadge) {
    els.ttsIdentityEvaluationBadge.textContent =
      evaluation.status === "warning" ? "警告" : "暫定範囲内";
    els.ttsIdentityEvaluationBadge.dataset.status = evaluation.status;
  }
  if (els.ttsIdentityEvaluationWarning) {
    els.ttsIdentityEvaluationWarning.textContent = evaluation.warnings?.length
      ? `警告: ${evaluation.warnings.join(", ")}。生成結果は保持され、自動再試行しません。`
      : "暫定基準内です。閾値は未検証であり、話者同一性の証明ではありません。";
  }
}

async function evaluateGeneratedTts(blob) {
  const identityPath = state.activeCompiledIdentityId
    ? `/api/voice-identities/${state.activeCompiledIdentityId}/evaluate`
    : "/api/voice-identities/evaluate";
  const evaluation = await experimentApi(identityPath, {
    method: "POST",
    headers: { "Content-Type": "audio/wav" },
    body: blob,
  });
  state.lastIdentityEvaluation = evaluation;
  renderTtsIdentityEvaluation(evaluation);
  return evaluation;
}

function renderVoiceDesignerControls() {
  const profile = buildVoiceControlProfile();
  if (!profile) return;
  renderVoiceDesignerDerivedViews(profile);
  if (!els.voiceControlSliders) return;
  els.voiceControlSliders.innerHTML = "";

  for (const definition of voiceControlProfile.controlDefinitions) {
    const evidence = profile.evidence[definition.key];
    const row = document.createElement("div");
    const hasOverride = evidence.design_override != null;
    row.className = `voice-control-row${hasOverride ? " is-overridden" : ""}`;

    const heading = document.createElement("div");
    heading.className = "voice-control-heading";
    const title = document.createElement("strong");
    title.textContent = definition.label;
    const origin = document.createElement("span");
    origin.className = "voice-control-origin";
    origin.textContent = hasOverride ? "設計上書き" : "推定値";
    origin.title = `${evidence.estimate_origin} / confidence ${evidence.confidence}`;
    heading.append(title, origin);

    const input = document.createElement("input");
    input.type = "range";
    input.min = String(definition.min);
    input.max = String(definition.max);
    input.step = String(definition.step);
    input.value = String(evidence.effective_value);
    input.setAttribute("aria-label", definition.label);

    const value = document.createElement("output");
    value.textContent = voiceControlProfile.formatControlValue(definition.key, evidence.effective_value);

    const footer = document.createElement("div");
    footer.className = "voice-control-footer";
    const estimate = document.createElement("span");
    estimate.textContent = `推定 ${voiceControlProfile.formatControlValue(definition.key, evidence.appearance_estimate)}`;
    const reset = document.createElement("button");
    reset.type = "button";
    reset.className = "voice-control-reset";
    reset.textContent = "戻す";
    reset.hidden = !hasOverride;
    footer.append(estimate, reset);

    input.addEventListener("input", () => {
      state.voiceControlOverrides[definition.key] = Number(input.value);
      const updated = buildVoiceControlProfile().evidence[definition.key];
      value.textContent = voiceControlProfile.formatControlValue(definition.key, updated.effective_value);
      row.classList.add("is-overridden");
      origin.textContent = "設計上書き";
      reset.hidden = false;
      renderVoiceDesignerDerivedViews();
      renderConstraints();
    });
    reset.addEventListener("click", () => {
      delete state.voiceControlOverrides[definition.key];
      renderVoiceDesignerControls();
      renderConstraints();
    });

    row.append(heading, input, value, footer);
    els.voiceControlSliders.appendChild(row);
  }
}

function renderVoiceDesignerDerivedViews(profile = buildVoiceControlProfile()) {
  if (!profile) return;
  const anchor = profile.identity_anchor;
  if (els.identityF0Summary) els.identityF0Summary.textContent = `${Math.round(anchor.f0_mean_hz)} Hz`;
  if (els.identityVtlSummary) els.identityVtlSummary.textContent = `${Number(anchor.vocal_tract_length_scale).toFixed(2)}x`;
  if (els.identityOverrideSummary) els.identityOverrideSummary.textContent = String(Object.keys(state.voiceControlOverrides).length);
  if (els.ttsCaptionInput && !state.ttsCaptionManual) {
    els.ttsCaptionInput.value = profile.tts_adapters.audio_cpp.caption_ja;
  }
  if (els.ttsF0CorrectionStrengthValue) {
    els.ttsF0CorrectionStrengthValue.textContent = `${Math.round(num(els.ttsF0CorrectionStrength, 1) * 100)}%`;
  }
  if (els.ttsF0CorrectionGuide) {
    const enabled = els.ttsF0CorrectionEnabled?.checked !== false;
    els.ttsF0CorrectionGuide.textContent = enabled
      ? `Praat PSOLAで抑揚と元波形を保持し、有声区間中央値を ${Math.round(anchor.f0_mean_hz)} Hzへ補正します。`
      : "F0後処理は無効です。生成モデル側のF0をそのまま使用します。";
  }
  renderTtsRequestSummary(profile);
  renderVoiceIdentityWorkspace();
}

function ttsF0CorrectionSettings() {
  return {
    f0_correction_enabled: els.ttsF0CorrectionEnabled?.checked !== false,
    f0_correction_strength: num(els.ttsF0CorrectionStrength, 1),
  };
}

function renderTtsRequestSummary(profile = buildVoiceControlProfile()) {
  if (!els.ttsRequestSummary || !profile) return;
  const requestProfile = compiledRequestProfile(profile);
  const identity = state.activeCompiledIdentity;
  const request = voiceControlProfile.buildAudioCppRequest(requestProfile, {
    model: identity?.model?.id || els.ttsModelSelect?.value,
    text: els.ttsDemoTextInput?.value,
    seed: num(els.ttsSeedInput, 20260719),
    num_inference_steps: STANDARD_TTS_INFERENCE_STEPS,
    caption_guidance_scale: identity?.style?.caption_guidance_scale ?? num(els.ttsCaptionGuidanceInput, 2),
    caption: identity?.style?.caption || activeTtsCaption(profile),
    ...ttsF0CorrectionSettings(),
  });
  const items = [
    ["MODEL", request.model],
    ["IDENTITY", identity?.name || "未コンパイル"],
    ["GENERATION", `${STANDARD_TTS_INFERENCE_STEPS} Step / 1候補`],
    ["F0 TARGET", `${Math.round(requestProfile.identity_anchor.f0_mean_hz)} Hz`],
    ["RATE", `${Number(requestProfile.identity_anchor.speaking_rate).toFixed(2)}x`],
    ["DURATION", `${Number(request.options.duration_scale).toFixed(2)}x`],
  ];
  els.ttsRequestSummary.innerHTML = "";
  for (const [labelText, valueText] of items) {
    const item = document.createElement("div");
    const label = document.createElement("span");
    const value = document.createElement("strong");
    label.textContent = labelText;
    value.textContent = valueText;
    item.append(label, value);
    els.ttsRequestSummary.appendChild(item);
  }
}

function setAudioCppStatus(kind, message) {
  if (els.audioCppStatus) els.audioCppStatus.textContent = message;
  if (els.audioCppStatusDot) els.audioCppStatusDot.dataset.status = kind;
}

function audioCppModelIds(payload) {
  const source = Array.isArray(payload) ? payload : payload?.data ?? payload?.models ?? [];
  if (!Array.isArray(source)) return [];
  return source
    .map((item) => typeof item === "string" ? item : item?.id ?? item?.model ?? item?.name)
    .filter((id) => typeof id === "string" && id.trim())
    .map((id) => id.trim());
}

async function refreshAudioCppModels() {
  setAudioCppStatus("pending", "接続確認中");
  if (els.refreshTtsModelsBtn) els.refreshTtsModelsBtn.disabled = true;
  try {
    const response = await fetch("/api/audio-cpp/models", { headers: { Accept: "application/json" } });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || payload.message || `HTTP ${response.status}`);
    const modelIds = audioCppModelIds(payload);
    state.audioCppModels = modelIds;
    const selected = els.ttsModelSelect?.value || "irodori-vdes";
    if (els.ttsModelSelect && modelIds.length) {
      els.ttsModelSelect.innerHTML = "";
      for (const id of modelIds) {
        const option = document.createElement("option");
        option.value = id;
        option.textContent = id;
        els.ttsModelSelect.appendChild(option);
      }
      els.ttsModelSelect.value = modelIds.includes(selected) ? selected : modelIds[0];
    }
    setAudioCppStatus("ready", modelIds.length ? `接続済み / ${modelIds.length}モデル` : "接続済み / モデル未登録");
    renderTtsRequestSummary();
    return modelIds;
  } catch (error) {
    state.audioCppModels = [];
    setAudioCppStatus("error", `未接続: ${error.message}`);
    return [];
  } finally {
    if (els.refreshTtsModelsBtn) els.refreshTtsModelsBtn.disabled = false;
  }
}

async function generateTtsDemo() {
  const text = els.ttsDemoTextInput?.value?.trim() || "";
  if (!text) {
    if (els.ttsDemoStatus) els.ttsDemoStatus.textContent = "読み上げテキストを入力してください。";
    return;
  }
  if (state.activeCompiledIdentityId && !state.activeCompiledIdentity) {
    await refreshVoiceIdentities({ silent: true });
  }
  const profile = compiledRequestProfile(buildVoiceControlProfile());
  const identity = state.activeCompiledIdentity;
  const request = voiceControlProfile.buildAudioCppRequest(profile, {
    model: identity?.model?.id || els.ttsModelSelect?.value,
    text,
    seed: num(els.ttsSeedInput, 20260719),
    num_inference_steps: STANDARD_TTS_INFERENCE_STEPS,
    caption_guidance_scale: identity?.style?.caption_guidance_scale ?? num(els.ttsCaptionGuidanceInput, 2),
    caption: identity?.style?.caption || activeTtsCaption(profile),
    ...ttsF0CorrectionSettings(),
  });
  if (identity?.speaker?.file) {
    request.speaker_condition = { file: identity.speaker.file };
  }
  request.generation_mode = "standard_single";
  request.observation = {
    enabled: true,
    label: "standard-single-20step",
    include_text: false,
    analyze_f0: true,
    capture_internal_conditions: true,
    latent_snapshot_steps: [],
  };
  state.lastIdentityEvaluation = null;
  renderTtsIdentityEvaluation(null);
  if (els.generateTtsDemoBtn) els.generateTtsDemoBtn.disabled = true;
  if (els.ttsDemoStatus) {
    els.ttsDemoStatus.textContent = "audio.cppで20 Step・1候補を生成中です。初回はモデル読み込みに時間がかかります。";
  }
  try {
    const response = await fetch("/api/audio-cpp/speech", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "audio/wav" },
      body: JSON.stringify(request),
    });
    if (!response.ok) {
      const contentType = response.headers.get("content-type") || "";
      const detail = contentType.includes("application/json")
        ? (await response.json().catch(() => ({}))).error
        : await response.text();
      throw new Error(detail || `HTTP ${response.status}`);
    }
    const responseNumber = (name) => {
      const raw = response.headers.get(name);
      return raw == null ? Number.NaN : Number(raw);
    };
    const measuredF0 = responseNumber("X-CVD-F0-Measured-Hz");
    const targetF0 = responseNumber("X-CVD-F0-Target-Hz");
    const outputF0 = responseNumber("X-CVD-F0-Output-Hz");
    const shiftSemitones = responseNumber("X-CVD-F0-Shift-Semitones");
    const observationId = response.headers.get("X-CVD-Observation-ID");
    const blob = await response.blob();
    if (!blob.size) throw new Error("空の音声応答を受信しました。");
    if (state.ttsResultUrl) URL.revokeObjectURL(state.ttsResultUrl);
    state.ttsResultBlob = blob;
    state.ttsResultUrl = URL.createObjectURL(blob);
    if (els.ttsDemoAudio) {
      els.ttsDemoAudio.src = state.ttsResultUrl;
      els.ttsDemoAudio.load();
      els.ttsDemoAudio.play().catch(() => {});
    }
    if (els.downloadTtsDemoBtn) els.downloadTtsDemoBtn.disabled = false;
    if (els.ttsDemoStatus) {
      els.ttsDemoStatus.textContent = "生成完了。軽量な話者距離と音響値を評価しています。";
    }
    let evaluation = null;
    try {
      evaluation = await evaluateGeneratedTts(blob);
    } catch (evaluationError) {
      renderTtsIdentityEvaluation({
        status: "warning",
        acoustic_values: {},
        distance: {},
        warnings: [`evaluation_unavailable: ${evaluationError.message}`],
      });
    }
    if (els.ttsDemoStatus) {
      const correctionSummary = [measuredF0, targetF0, outputF0, shiftSemitones].every(Number.isFinite)
        ? ` / F0 ${measuredF0.toFixed(1)} → ${outputF0.toFixed(1)} Hz（目標 ${targetF0.toFixed(1)} Hz, ${shiftSemitones.toFixed(2)} st）`
        : "";
      const identitySummary = identity ? ` / identity ${identity.name}` : " / identity未コンパイル";
      const evaluationSummary = evaluation?.status === "warning" ? " / 評価警告あり" : " / 評価完了";
      const observationSummary = observationId ? ` / observation ${observationId}` : "";
      els.ttsDemoStatus.textContent =
        `生成完了 / ${request.model} / 20 Step / 1候補 / seed ${request.seed}` +
        `${identitySummary}${evaluationSummary}${observationSummary}${correctionSummary}`;
    }
    setAudioCppStatus("ready", "接続済み");
  } catch (error) {
    if (els.ttsDemoStatus) els.ttsDemoStatus.textContent = `生成失敗: ${error.message}`;
    setAudioCppStatus("error", `生成失敗: ${error.message}`);
  } finally {
    if (els.generateTtsDemoBtn) els.generateTtsDemoBtn.disabled = false;
  }
}

function downloadTtsDemo() {
  if (!state.ttsResultBlob) return;
  download(`${localDateStamp()}-${safeFilePart(els.projectTitleInput?.value)}-tts.wav`, state.ttsResultBlob);
}

function exportVoiceControlProfile() {
  const blob = new Blob([JSON.stringify(buildVoiceControlProfile(), null, 2)], { type: "application/json" });
  download(`${localDateStamp()}-${safeFilePart(els.projectTitleInput?.value)}-voice-control-profile.json`, blob);
}

function renderSyllableDatasetPreview() {
  const tokens = selectedSyllableTokens();
  if (!tokens.includes(state.selectedSyllableToken)) state.selectedSyllableToken = tokens[0] ?? "a";
  if (els.syllableSetSummary) {
    els.syllableSetSummary.textContent = `${tokens.length} samples / ${selectedSyllableSetKey()} / ${els.ttsOutputLanguageInput?.value ?? "ja-JP"}`;
  }
  if (els.syllableTokenList) {
    els.syllableTokenList.innerHTML = "";
    for (const token of tokens) {
      const item = document.createElement("button");
      item.type = "button";
      item.textContent = `/${token}/`;
      item.classList.toggle("active", token === state.selectedSyllableToken);
      item.setAttribute("aria-pressed", token === state.selectedSyllableToken ? "true" : "false");
      item.addEventListener("click", () => {
        state.selectedSyllableToken = token;
        if (["m", "n"].includes(parseSyllableToken(token).consonant) || token === "n") {
          if (els.nasalTokenSelect) els.nasalTokenSelect.value = token;
          renderNasalCalibration();
        }
        renderSyllableDatasetPreview();
      });
      els.syllableTokenList.appendChild(item);
    }
  }
}

function updateTractEditStatus() {
  if (!els.tractEditStatus) return;
  const vowel = selectedVowel();
  const mode = state.tractEditMode === "width" ? "width" : "area";
  const points = mode === "width" ? normalizedWidthTuningPoints(vowel) : normalizedAreaTuningPoints(vowel);
  const changed = points.filter((point) => Math.abs(point.gain - 1) > 0.0001);
  const label = mode === "width" ? "W(x)横幅" : "A(x)断面積";
  els.tractEditStatus.textContent = changed.length
    ? `/${vowel}/ ${label}補正: ${changed.map((point) => `${Math.round(point.position * 100)}%=${point.gain.toFixed(2)}x`).join(" / ")}`
    : `/${vowel}/ ${label}補正なし。丸い補正点を上下にドラッグできます。`;
  const selected = state.selectedTractTuningHandle;
  if (els.tractSelectedPointValue) {
    const selectedPoints = selected?.mode === "width" ? normalizedWidthTuningPoints(vowel) : normalizedAreaTuningPoints(vowel);
    const point = selected?.vowel === vowel ? selectedPoints[selected.handleIndex] : null;
    els.tractSelectedPointValue.textContent = point ? `${Math.round(point.position * 100)}%  ${point.gain.toFixed(2)}x` : "点を選択";
  }
}

function exportVowelAreaTuning() {
  const exported = {};
  for (const vowel of Object.keys(vowelFormants)) {
    const points = normalizedAreaTuningPoints(vowel);
    if (!points.some((point) => Math.abs(point.gain - 1) > 0.0001)) continue;
    exported[vowel] = points;
  }
  return {
    schema_version: "vowel_area_tuning_0.1",
    gain_range: { min: AREA_TUNING_GAIN_MIN, max: AREA_TUNING_GAIN_MAX },
    control_points: exported,
  };
}

function exportVowelWidthTuning() {
  const exported = {};
  for (const vowel of Object.keys(vowelFormants)) {
    const points = normalizedWidthTuningPoints(vowel);
    if (!points.some((point) => Math.abs(point.gain - 1) > 0.0001)) continue;
    exported[vowel] = points;
  }
  return {
    schema_version: "vowel_width_tuning_0.1",
    gain_range: { min: WIDTH_TUNING_GAIN_MIN, max: WIDTH_TUNING_GAIN_MAX },
    control_points: exported,
    semantics: "coronal width gain at fixed sagittal height; total A(x) is recomputed from the 2.5D section",
  };
}

function normalizeLoadedAreaTuning(data) {
  const source = data?.control_points ?? data;
  const next = {};
  if (!source || typeof source !== "object") return next;
  for (const vowel of Object.keys(vowelFormants)) {
    if (!Array.isArray(source[vowel])) continue;
    const points = source[vowel]
      .map((point) => ({
        position: Number(point.position),
        gain: Number(point.gain),
      }))
      .filter((point) => Number.isFinite(point.position) && Number.isFinite(point.gain));
    if (!points.length) continue;
    next[vowel] = points.map((point) => ({
      position: Number(clamp(point.position, 0, 1).toFixed(4)),
      gain: Number(clamp(point.gain, AREA_TUNING_GAIN_MIN, AREA_TUNING_GAIN_MAX).toFixed(4)),
    }));
  }
  return next;
}

function normalizeLoadedWidthTuning(data) {
  const source = data?.control_points ?? data;
  const next = {};
  if (!source || typeof source !== "object") return next;
  for (const vowel of Object.keys(vowelFormants)) {
    if (!Array.isArray(source[vowel])) continue;
    const points = source[vowel]
      .map((point) => ({ position: Number(point.position), gain: Number(point.gain) }))
      .filter((point) => Number.isFinite(point.position) && Number.isFinite(point.gain));
    if (!points.length) continue;
    next[vowel] = points.map((point) => ({
      position: Number(clamp(point.position, 0, 1).toFixed(4)),
      gain: Number(clamp(point.gain, WIDTH_TUNING_GAIN_MIN, WIDTH_TUNING_GAIN_MAX).toFixed(4)),
    }));
  }
  return next;
}

function overridesFromConstraints(constraints = {}) {
  const overrides = {};
  if (!constraints || typeof constraints !== "object") return overrides;
  for (const [key, item] of Object.entries(constraints)) {
    if (item?.user_override && Number.isFinite(item.center)) overrides[key] = item.center;
  }
  return overrides;
}

function performanceRangeOverridesFromLegacyConstraints(constraints = {}) {
  const overrides = {};
  if (!constraints || typeof constraints !== "object") return overrides;
  for (const [key, item] of Object.entries(constraints)) {
    const range = item?.performance_control_range ?? item?.constraint_range;
    const min = Number(range?.min);
    const max = Number(range?.max);
    if (!Number.isFinite(min) || !Number.isFinite(max) || Math.abs(max - min) < 0.0001) continue;
    overrides[key] = {
      min,
      max,
      basis: "migrated per-parameter range from a pre-0.3 profile",
      user_override: true,
    };
  }
  return overrides;
}

function loadedConstraintCenter(savedConstraints, savedOverrides, key) {
  const overrideValue = savedOverrides?.[key];
  if (Number.isFinite(overrideValue)) return overrideValue;
  const savedValue = savedConstraints?.[key]?.center;
  return Number.isFinite(savedValue) ? savedValue : null;
}

function gestureExecutionResponseForStyle(referenceImageStyle) {
  return referenceImageStyle === "illustration"
    ? { ...ILLUSTRATION_GESTURE_EXECUTION_RESPONSE }
    : { ...REALISTIC_GESTURE_EXECUTION_RESPONSE };
}

function gestureExecutionResponseFromConstraints(constraints) {
  const saved = constraints?.gesture_execution_response_map;
  const legacyGain = Number(constraints?.gesture_execution_calibration_gain?.center);
  const fallback = Number.isFinite(legacyGain)
    ? {
      response_offset: 0,
      response_gain: clamp(legacyGain, 0.5, LEGACY_GESTURE_EXECUTION_EFFECTIVE_MAX),
      effective_min: 0.2,
      effective_max: LEGACY_GESTURE_EXECUTION_EFFECTIVE_MAX,
    }
    : REALISTIC_GESTURE_EXECUTION_RESPONSE;
  const effectiveMin = Number(saved?.effective_min);
  const effectiveMax = Number(saved?.effective_max);
  const responseOffset = Number(saved?.response_offset);
  const responseGain = Number(saved?.response_gain);
  return {
    response_offset: Number.isFinite(responseOffset) ? responseOffset : fallback.response_offset,
    response_gain: Number.isFinite(responseGain) && responseGain > 0 ? responseGain : fallback.response_gain,
    effective_min: Number.isFinite(effectiveMin) ? effectiveMin : fallback.effective_min,
    effective_max: Number.isFinite(effectiveMax) ? effectiveMax : fallback.effective_max,
  };
}

function migrateLegacyIllustrationGestureInput(data, savedConstraints, savedOverrides) {
  if (!savedConstraints || typeof savedConstraints !== "object") {
    return { constraints: savedConstraints, overrides: savedOverrides };
  }
  const savedResponseGain = Number(savedConstraints.gesture_execution_response_map?.response_gain);
  if (Number.isFinite(savedResponseGain) || normalizeReferenceImageStyle(data?.inputs?.reference_image_style) !== "illustration") {
    return { constraints: savedConstraints, overrides: savedOverrides };
  }
  const savedInput = loadedConstraintCenter(savedConstraints, savedOverrides, "articulatory_range_utilization");
  if (!Number.isFinite(savedInput)) return { constraints: savedConstraints, overrides: savedOverrides };

  // Projects before response-map 0.1 stored either the effective gesture value
  // directly, or the same value multiplied by a 1.45 illustration calibration.
  // Convert that audible operating point into the new UI-centered response curve.
  const savedCalibration = Number(savedConstraints.gesture_execution_calibration_gain?.center);
  const legacyGain = Number.isFinite(savedCalibration)
    ? clamp(savedCalibration, 0.5, LEGACY_GESTURE_EXECUTION_EFFECTIVE_MAX)
    : 1;
  const legacyEffectiveGesture = clamp(savedInput * legacyGain, 0.2, LEGACY_GESTURE_EXECUTION_EFFECTIVE_MAX);
  const response = gestureExecutionResponseForStyle("illustration");
  const migratedInput = Number(clamp(
    (legacyEffectiveGesture - response.response_offset) / response.response_gain,
    GESTURE_EXECUTION_INPUT_MIN,
    GESTURE_EXECUTION_INPUT_MAX
  ).toFixed(4));
  const nextGesture = {
    ...(savedConstraints.articulatory_range_utilization ?? {}),
    center: migratedInput,
    user_override: true,
    migrated_from_gesture_execution_response_0_1: true,
  };
  const { gesture_execution_calibration_gain: _ignoredLegacyCalibration, ...withoutLegacyCalibration } = savedConstraints;
  return {
    constraints: {
      ...withoutLegacyCalibration,
      articulatory_range_utilization: nextGesture,
    },
    overrides: {
      ...(savedOverrides ?? {}),
      articulatory_range_utilization: migratedInput,
    },
  };
}

function migrateLegacyDevelopmentControls(savedConstraints = {}, savedOverrides = {}) {
  const migratedConstraints = { ...(savedConstraints ?? {}) };
  const migratedOverrides = { ...(savedOverrides ?? {}) };

  // DEVELOPMENT/MIGRATION ONLY: glottal_closure was an ambiguous master
  // control in pre-0.3 projects. It is read once to seed explicit LF-style
  // source quantities and is never retained in the live schema or synthesis.
  const legacyClosure = loadedConstraintCenter(savedConstraints, savedOverrides, "glottal_closure");
  if (Number.isFinite(legacyClosure)) {
    const legacyParams = legacyGlottalSourceParamsFromClosure(
      legacyClosure,
      loadedConstraintCenter(savedConstraints, savedOverrides, "baseline_muscle_tension") ?? 1,
      0,
      0
    );
    const updates = {
      glottal_open_quotient: legacyParams.open_quotient,
      glottal_speed_quotient: legacyParams.speed_quotient,
      glottal_return_phase: legacyParams.return_phase,
      glottal_spectral_tilt_db: legacyParams.spectral_tilt_db,
      glottal_breathiness: legacyParams.breathiness,
      glottal_volume_velocity_drive: legacyParams.volume_velocity_drive,
      glottal_flow_smoothing: legacyParams.flow_smoothing,
      glottal_flow_inertance: legacyParams.flow_inertance,
    };
    for (const [key, value] of Object.entries(updates)) {
      if (Number.isFinite(loadedConstraintCenter(savedConstraints, savedOverrides, key))) continue;
      migratedConstraints[key] = {
        center: Number(value.toFixed(4)),
        user_override: true,
        migrated_from_legacy_glottal_closure: true,
      };
      migratedOverrides[key] = Number(value.toFixed(4));
    }
  }

  // DEVELOPMENT/MIGRATION ONLY: the retired global side-branch control is
  // distributed to branch-local controls only when an old profile lacks them.
  const legacySideBranch = loadedConstraintCenter(savedConstraints, savedOverrides, "side_branch_loss_coupling");
  if (Number.isFinite(legacySideBranch)) {
    const branchUpdates = {
      sinus_coupling: clamp(legacySideBranch * 0.9, 0, 1),
      velopharyngeal_loss_coupling: clamp(legacySideBranch * 0.7, 0, 0.75),
      piriform_fossa_loss_coupling: clamp(legacySideBranch * 0.55, 0, 0.65),
    };
    for (const [key, value] of Object.entries(branchUpdates)) {
      if (Number.isFinite(loadedConstraintCenter(savedConstraints, savedOverrides, key))) continue;
      migratedConstraints[key] = {
        center: Number(value.toFixed(4)),
        user_override: true,
        migrated_from_legacy_side_branch_master: true,
      };
      migratedOverrides[key] = Number(value.toFixed(4));
    }
  }

  return {
    constraints: withoutRetiredConstraints(migratedConstraints),
    overrides: withoutReadOnlyDerivedOverrides(withoutRetiredConstraints(migratedOverrides)),
  };
}

function mergeLoadedVoiceConstraints(currentConstraints, savedConstraints = {}) {
  if (!savedConstraints || typeof savedConstraints !== "object") return currentConstraints;
  const merged = { ...currentConstraints };
  for (const [key, savedItem] of Object.entries(savedConstraints)) {
    if (retiredConstraintKeys.has(key) || readOnlyDerivedConstraintKeys.has(key)) continue;
    if (!savedItem || typeof savedItem !== "object") continue;
    const currentItem = merged[key];
    if (!currentItem) {
      merged[key] = { ...savedItem, migrated_from_legacy_profile: true };
      continue;
    }
    merged[key] = mergeConstraintItem(currentItem, savedItem);
  }
  return merged;
}

function mergeConstraintItem(currentItem, savedItem) {
  const merged = { ...currentItem };
  const savedCenter = Number(savedItem.center);
  if (Number.isFinite(savedCenter)) {
    const bounds = currentItem.edit_range ?? currentItem.design_bounds ?? null;
    const min = Number(bounds?.min);
    const max = Number(bounds?.max);
    const center = Number.isFinite(min) && Number.isFinite(max) && max > min ? clamp(savedCenter, min, max) : savedCenter;
    merged.center = Number(center.toFixed(4));
  }
  if (savedItem.user_override) merged.user_override = true;
  if (savedItem.note && !merged.note) merged.note = savedItem.note;
  merged.migrated_from_legacy_profile = true;
  return merged;
}

function recenteredConstraint(item, center) {
  if (!item || !Number.isFinite(center)) return item;
  const next = {
    ...item,
    center: Number(center.toFixed(4)),
    derived_center_refreshed: true,
  };
  const sd = Number(next.statistics?.sd);
  if (Number.isFinite(sd) && sd > 0) {
    next.statistics = {
      ...next.statistics,
      reference_center: next.center,
      minus_3sd: Number((next.center - sd * 3).toFixed(4)),
      plus_3sd: Number((next.center + sd * 3).toFixed(4)),
    };
    next.edit_range = {
      ...(next.edit_range ?? {}),
      min: next.statistics.minus_3sd,
      max: next.statistics.plus_3sd,
      basis: next.edit_range?.basis ?? "reference_center ± 3SD; UI design-value editing range",
    };
  }
  if (next.resting_anatomical_state) next.resting_anatomical_state = { ...next.resting_anatomical_state, value: next.center };
  return next;
}

function buildExport() {
  return {
    schema_version: "character_voice_designer_0.1",
    app: "CharacterVoiceDesigner",
    app_version: APP_VERSION,
    project: {
      title: els.projectTitleInput.value.trim() || "voice_profile",
      updated_at: new Date().toISOString(),
    },
    inputs: {
      full_body_image: state.imageNames.body,
      face_front_image: state.imageNames.face,
      face_profile_image: state.imageNames.profile,
      age: num(els.ageInput, 17),
      sex_reference_class: els.sexInput.value,
      height_cm: num(els.heightInput, 158),
      weight_kg: num(els.weightInput, 47),
      body_fat_percent: els.bodyFatInput.value === "" ? null : num(els.bodyFatInput, 0),
      primary_language: els.primaryLanguageInput.value,
      phonetic_target_profile: normalizePhoneticTargetProfile(els.phoneticTargetProfileInput?.value, els.primaryLanguageInput.value),
      morphology_reference_population: els.populationInput.value,
      reference_population: els.populationInput.value,
      reference_image_style: normalizeReferenceImageStyle(els.referenceImageStyleInput?.value),
      data_source_set: els.dataSourceInput.value,
      image_analysis_weight: Number((state.appliedImageWeight ?? selectedImageWeight()).toFixed(4)),
      preview_synthesis_backend: "tube",
      tts_output_language: els.ttsOutputLanguageInput?.value ?? "ja-JP",
      syllable_dataset_set: selectedSyllableSetKey(),
      dataset_prefix: els.datasetPrefixInput?.value?.trim() || "voice_profile",
      tts_model: els.ttsModelSelect?.value || "irodori-vdes",
    },
    landmark_schema: landmarkSystem.schema,
    landmarks: state.landmarks,
    landmark_extraction: state.extractionReports,
    image_calibration: state.calibration,
    prior_resolution: state.priorResolution,
    integrated_features: state.features,
    body_composition_summary: buildBodyCompositionSummary(),
    phonetic_target: currentPhoneticTargetSummary(),
    vocal_tract_geometry: state.vocalTractGeometry,
    vowel_area_tuning: exportVowelAreaTuning(),
    vowel_width_tuning: exportVowelWidthTuning(),
    auditory_evaluation_log: state.auditoryEvaluationLog,
    nasal_articulation_tuning: exportNasalTuning(),
    nasal_auditory_evaluation_log: state.nasalEvaluationLog,
    voice_control_profile: buildVoiceControlProfile(),
    tts_configuration: buildTtsConfiguration(),
    voice_constraints: withoutRetiredConstraints(state.constraints),
    constraint_overrides: withoutReadOnlyDerivedOverrides(withoutRetiredConstraints(state.constraintOverrides)),
    performance_range_overrides: withoutReadOnlyDerivedOverrides(withoutRetiredConstraints(state.performanceRangeOverrides)),
    range_semantics: {
      baseline: "resting/no-phonation character design value",
      morphological_plausibility_range: "anatomically plausible design interval",
      performance_control_range: "dynamic interval reachable from the baseline during performance",
      constraint_range: "deprecated compatibility alias of performance_control_range",
      global_range_k: "retired; ranges are edited per physical parameter",
    },
    publication_policy: referenceData.publicationPolicy,
    reference_sources: referenceData.sources,
    notes: [
      "Public releases should use only broadly used reference values, formula-level mappings, aggregate statistics, and validity-check references.",
      "Case reports, participant IDs, row-level clinical data, and direct patient-derived materials are out of scope for this prototype.",
      "VTL and F0 priors are extracted from Pisanski et al. 2016 Table 1.",
      "Height and weight reference values are extracted from Pisanski et al. 2014.",
      "BMI and body-fat guidance are source-labeled separately; fallback body-fat estimates are formula-level guides, not measured distributions.",
      "Head/face/body dimensional priors remain marked as placeholders where the referenced numeric cohort table was not bundled.",
      "External cohort acquisition is out of scope unless a source is explicitly approved under the project ethics policy.",
      "Image estimates are based on manual anatomical landmark placement on reference images or the built-in schematic preview; automatic landmark extraction is disabled in the UI.",
      "Anatomical landmark names follow the AIST anthropometry manual. Legacy internal keys are retained only for saved-project compatibility.",
      "Image scale is resolved from stature first, then full-body total head height, and the same total head height is imposed on head-front and head-profile images.",
      "Heights use vertical projected distance and breadths use horizontal projected distance.",
      "The 2D vocal tract is an externally warped design template. Internal soft-tissue contours are not claimed to be observed from character art.",
      "Frontal width anchors are linearly interpolated and combined with sagittal diameter using an explicit elliptical cross-section approximation.",
      "Primary language, phonetic target profile, and morphology reference population are separate settings. The phonetic target profile selects aggregate language/variety targets and is never an ancestry or ethnicity selector.",
      "The Japanese phonetic profile embeds only published aggregate F1/F2 targets. Its provisional F3/F4 extension remains explicitly source-labeled and should be replaced when an appropriate public aggregate Japanese F3/F4 table is approved.",
      "Generated vowel previews use only the browser 2.5D-derived area-function tube model with LF-style volume-velocity source input and simple side-branch losses, not VocalTractLab.",
      "Legacy formant/hybrid preview selections, hybrid-only controls, and tension_response_curve are ignored when older profiles are loaded.",
      "ConstraintRangeK was retired before app 1.0. Statistical edit ranges and PerformanceControlRange values are now independent per parameter.",
      "Legacy glottal_closure and side_branch_loss_coupling values are read only during one-way project migration and are never retained in the live schema or synthesis path.",
      "F0 is a read-only value derived from the reference center, vocal-fold spring constant, and baseline muscle tension.",
      "Lifestyle, disease-history, inflammation, airway-narrowing, and pediatric intubation-depth mappings are excluded from the public implementation.",
      "Thoracic and abdominal volumes limit estimated maximum ventilation; VC/FVC/FEV1/PEF, ventilation, respiratory pressure, and speech-support utilization feed the preview respiratory drive once.",
      "Body-resonance frequency starts from thoracic volume, remains user-editable, and is persisted as the frequency used by preview synthesis.",
      "CharacterVoiceDesigner exports backend-neutral identity anchors and serializable control functions separately from model-specific TTS adapter settings.",
      "The audio.cpp Irodori adapter maps identity anchors to a deterministic Japanese VoiceDesign caption; it does not claim direct physical control of the learned TTS latent space.",
    ],
  };
}

function format(value, digits = 2) {
  if (value == null || Number.isNaN(value)) return "-";
  return Number(value).toFixed(digits);
}

async function experimentApi(path, options = {}) {
  const response = await fetch(path, {
    headers: { Accept: "application/json", ...(options.headers || {}) },
    ...options,
  });
  const text = await response.text();
  let payload = {};
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      throw new Error(`実験APIが不正な応答を返しました (HTTP ${response.status})。`);
    }
  }
  if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`);
  return payload;
}

function setExperimentStatus(message, isError = false) {
  if (!els.experimentWorkspaceStatus) return;
  els.experimentWorkspaceStatus.textContent = message;
  els.experimentWorkspaceStatus.classList.toggle("error", isError);
}

function setExperimentTool(tool) {
  state.activeExperimentTool = tool;
  for (const button of els.experimentToolButtons) {
    const active = button.dataset.experimentTool === tool;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", active ? "true" : "false");
  }
  for (const form of els.experimentToolForms) {
    const active = form.dataset.experimentForm === tool;
    form.classList.toggle("active", active);
    form.hidden = !active;
  }
}

function selectedOptionValues(select) {
  return select ? Array.from(select.selectedOptions, (option) => option.value).filter(Boolean) : [];
}

function populateExperimentSelect(select, items, baseLabel = null) {
  if (!select) return;
  const selected = new Set(selectedOptionValues(select));
  select.replaceChildren();
  if (baseLabel != null) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = baseLabel;
    select.append(option);
  }
  for (const item of items || []) {
    const option = document.createElement("option");
    option.value = item.id;
    option.textContent = item.label;
    option.selected = selected.has(item.id);
    select.append(option);
  }
}

function stopResourceAudioPreview(container = null) {
  const button = state.resourcePreviewButton;
  if (container && button && !container.contains(button)) return;
  if (state.resourcePreviewAudio) {
    state.resourcePreviewAudio.pause();
    state.resourcePreviewAudio.currentTime = 0;
  }
  if (button) {
    button.textContent = "▶";
    button.classList.remove("playing");
    button.setAttribute("aria-pressed", "false");
  }
  state.resourcePreviewAudio = null;
  state.resourcePreviewButton = null;
  state.resourcePreviewUrl = null;
}

function createResourceAudioPreviewButton(url, label, onError) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "resource-audio-preview";
  button.textContent = "▶";
  button.title = `${label}を再生`;
  button.setAttribute("aria-label", `${label}を確認再生`);
  button.setAttribute("aria-pressed", "false");
  button.addEventListener("click", async () => {
    if (state.resourcePreviewUrl === url && state.resourcePreviewAudio) {
      stopResourceAudioPreview();
      return;
    }
    stopResourceAudioPreview();
    const audio = new Audio(url);
    state.resourcePreviewAudio = audio;
    state.resourcePreviewButton = button;
    state.resourcePreviewUrl = url;
    button.textContent = "■";
    button.classList.add("playing");
    button.setAttribute("aria-pressed", "true");
    audio.addEventListener("ended", () => stopResourceAudioPreview(), { once: true });
    audio.addEventListener("error", () => {
      stopResourceAudioPreview();
      onError?.(new Error("音声ファイルを読み込めません。"));
    }, { once: true });
    try {
      await audio.play();
    } catch (error) {
      stopResourceAudioPreview();
      onError?.(error);
    }
  });
  return button;
}

function renderEvaluationFileList(container, items, { reference = false } = {}) {
  if (!container) return;
  stopResourceAudioPreview(container);
  container.replaceChildren();
  if (!items.length) {
    const empty = document.createElement("p");
    empty.className = "evaluation-file-empty";
    empty.textContent = reference
      ? "参照音声は未指定です。必要な場合だけアップロードしてください。"
      : "表示できる評価対象がありません。WAVを追加してください。";
    container.append(empty);
    return;
  }
  for (const item of items) {
    const row = document.createElement("div");
    row.className = `evaluation-file-row${reference ? " reference" : ""}`;
    row.setAttribute("role", "listitem");
    if (!reference) {
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = state.evaluationInputIds.has(item.id);
      checkbox.setAttribute("aria-label", `${item.label}を評価対象にする`);
      checkbox.addEventListener("change", () => {
        if (checkbox.checked) {
          if (state.evaluationInputIds.size >= MAX_EVALUATION_RESOURCES) {
            checkbox.checked = false;
            setExperimentStatus(`評価対象は最大${MAX_EVALUATION_RESOURCES}件です。`, true);
            return;
          }
          state.evaluationInputIds.add(item.id);
        } else {
          state.evaluationInputIds.delete(item.id);
        }
      });
      row.append(checkbox);
    }
    const name = document.createElement("span");
    name.className = "evaluation-file-name";
    name.textContent = item.label;
    name.title = item.label;
    const play = createResourceAudioPreviewButton(
      `/api/experiments/resources/audio?id=${encodeURIComponent(item.id)}`,
      item.label,
      (error) => setExperimentStatus(`音声を再生できません: ${error.message}`, true),
    );
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "evaluation-file-remove";
    remove.textContent = "×";
    remove.title = reference ? "参照音声を取り消す" : "一覧から除外";
    remove.setAttribute("aria-label", `${item.label}を${reference ? "取り消す" : "一覧から除外する"}`);
    remove.addEventListener("click", () => {
      const action = reference ? discardEvaluationReference(item.id) : excludeEvaluationInput(item.id);
      action.catch((error) => setExperimentStatus(`一覧を更新できません: ${error.message}`, true));
    });
    row.append(name, play, remove);
    container.append(row);
  }
}

function renderEvaluationResources() {
  const inputs = state.experimentResources?.voice_inputs || [];
  const availableIds = new Set(inputs.map((item) => item.id));
  for (const id of Array.from(state.evaluationInputIds)) {
    if (!availableIds.has(id)) state.evaluationInputIds.delete(id);
  }
  renderEvaluationFileList(els.experimentEvaluationInputs, inputs);
  renderEvaluationFileList(
    els.experimentEvaluationReferences,
    state.evaluationReferenceResources,
    { reference: true },
  );
  const excludedCount = Number(state.experimentResources?.excluded_voice_input_count || 0);
  if (els.experimentRestoreExcludedInputsBtn) {
    els.experimentRestoreExcludedInputsBtn.hidden = excludedCount <= 0;
    els.experimentRestoreExcludedInputsBtn.textContent = `除外を戻す (${excludedCount})`;
  }
}

async function excludeEvaluationInput(resourceId) {
  await experimentApi("/api/experiments/resources/exclude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: resourceId }),
  });
  state.evaluationInputIds.delete(resourceId);
  await refreshExperimentWorkspace({ silent: true });
}

async function restoreEvaluationInputs() {
  await experimentApi("/api/experiments/resources/restore", { method: "POST" });
  await refreshExperimentWorkspace({ silent: true });
}

async function discardEvaluationReference(resourceId) {
  await experimentApi("/api/experiments/uploads/discard-reference", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: resourceId }),
  });
  state.evaluationReferenceResources = state.evaluationReferenceResources.filter(
    (item) => item.id !== resourceId,
  );
  renderEvaluationResources();
}

function renderExperimentResources() {
  const resources = state.experimentResources || {};
  populateExperimentSelect(
    els.experimentObservationSpeaker,
    resources.speech_speaker_conditions || resources.speaker_conditions,
    "使用しない",
  );
  populateExperimentSelect(els.experimentSpeakerEmbeddings, resources.speaker_conditions);
  populateExperimentSelect(els.experimentBenchmarkProfile, resources.profiles, "既定値を使用");
  populateExperimentSelect(els.experimentStabilityProfile, resources.profiles, "既定値を使用");
  populateExperimentSelect(
    els.experimentStabilitySpeaker,
    resources.speech_speaker_conditions || resources.speaker_conditions,
    "使用しない",
  );
  renderEvaluationResources();
  populateExperimentSelect(
    els.experimentEvaluationManifest,
    resources.manifests,
    "使用しない",
  );
}

const experimentStatusLabels = {
  queued: "待機",
  running: "実行中",
  cancelling: "中止処理中",
  complete: "完了",
  failed: "失敗",
  cancelled: "中止",
  interrupted: "中断",
};

function formatExperimentTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("ja-JP", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function renderExperimentJobs() {
  if (!els.experimentJobRows) return;
  els.experimentJobRows.replaceChildren();
  const jobs = state.experimentJobs || [];
  if (els.experimentJobEmpty) els.experimentJobEmpty.hidden = jobs.length > 0;
  for (const job of jobs) {
    const row = document.createElement("tr");
    row.dataset.jobId = job.id;
    row.classList.toggle("selected", job.id === state.activeExperimentJobId);
    row.tabIndex = 0;
    for (const value of [
      job.label,
      experimentStatusLabels[job.status] || job.status,
      formatExperimentTime(job.started_at || job.created_at),
    ]) {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.append(cell);
    }
    const select = () => {
      state.activeExperimentJobId = job.id;
      renderExperimentJobs();
      renderExperimentJobDetail(job);
    };
    row.addEventListener("click", select);
    row.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        select();
      }
    });
    els.experimentJobRows.append(row);
  }
  const selected = jobs.find((job) => job.id === state.activeExperimentJobId);
  renderExperimentJobDetail(selected || null);
}

function renderExperimentJobDetail(job) {
  if (!els.experimentJobTitle) return;
  if (!job) {
    els.experimentJobStatus.textContent = "未選択";
    els.experimentJobStatus.dataset.status = "";
    els.experimentJobTitle.textContent = "ジョブを選択してください";
    els.cancelExperimentBtn.disabled = true;
    els.experimentJobProgress.value = 0;
    els.experimentJobProgressText.textContent = "-";
    els.experimentJobLog.textContent = "-";
    els.experimentArtifacts.replaceChildren();
    els.experimentArtifactAudio.hidden = true;
    els.experimentReportDetails.hidden = true;
    return;
  }
  const status = experimentStatusLabels[job.status] || job.status;
  els.experimentJobStatus.textContent = status;
  els.experimentJobStatus.dataset.status = job.status;
  els.experimentJobTitle.textContent = `${job.label} / ${job.id}`;
  els.cancelExperimentBtn.disabled = !job.can_cancel;
  const ratio = Number(job.progress?.ratio);
  if (Number.isFinite(ratio)) {
    els.experimentJobProgress.value = Math.max(0, Math.min(1, ratio));
  } else if (job.status === "running") {
    els.experimentJobProgress.removeAttribute("value");
  } else {
    els.experimentJobProgress.value = job.status === "complete" ? 1 : 0;
  }
  const progress = job.progress || {};
  const count = progress.total ? ` ${progress.current}/${progress.total}` : "";
  els.experimentJobProgressText.textContent = `${progress.phase || status}${count}${
    job.error ? ` / ${job.error}` : ""
  }`;
  els.experimentJobLog.textContent = job.log || "-";
  els.experimentJobLog.scrollTop = els.experimentJobLog.scrollHeight;
  els.experimentArtifacts.replaceChildren();
  for (const artifact of job.artifacts || []) {
    if (artifact.media_type === "audio/wav" || artifact.name.toLowerCase().endsWith(".wav")) {
      const play = document.createElement("button");
      play.type = "button";
      play.className = "experiment-artifact-action";
      play.textContent = `再生 ${artifact.name}`;
      play.addEventListener("click", () => {
        els.experimentArtifactAudio.src = artifact.url;
        els.experimentArtifactAudio.hidden = false;
        els.experimentArtifactAudio.play().catch(() => {});
      });
      els.experimentArtifacts.append(play);
    }
    const link = document.createElement("a");
    link.className = "experiment-artifact-action";
    link.href = artifact.url;
    link.download = artifact.name;
    link.textContent = `保存 ${artifact.name}`;
    els.experimentArtifacts.append(link);
  }
  els.experimentReportDetails.hidden = !job.report_text;
  els.experimentReportText.textContent = job.report_text || "";
}

function scheduleExperimentPoll() {
  if (state.experimentPollTimer) clearTimeout(state.experimentPollTimer);
  state.experimentPollTimer = null;
  const active = state.experimentJobs.some((job) =>
    ["queued", "running", "cancelling"].includes(job.status),
  );
  if (state.activeTab === "experimentTab" && active) {
    state.experimentPollTimer = setTimeout(() => {
      refreshExperimentWorkspace({ silent: true }).catch(() => {});
    }, 1000);
  }
}

async function refreshExperimentWorkspace({ silent = false } = {}) {
  if (!els.experimentJobRows) return;
  if (!silent) setExperimentStatus("実験ツールと履歴を更新しています。");
  try {
    const [resources, jobsPayload] = await Promise.all([
      experimentApi("/api/experiments/resources"),
      experimentApi("/api/experiments/jobs"),
    ]);
    state.experimentResources = resources;
    state.experimentJobs = jobsPayload.jobs || [];
    if (
      !state.activeExperimentJobId ||
      !state.experimentJobs.some((job) => job.id === state.activeExperimentJobId)
    ) {
      state.activeExperimentJobId = state.experimentJobs[0]?.id || null;
    }
    renderExperimentResources();
    renderExperimentJobs();
    if (!silent) setExperimentStatus("ローカル実験環境を使用できます。");
    scheduleExperimentPoll();
  } catch (error) {
    setExperimentStatus(`実験ツールを読み込めません: ${error.message}`, true);
  }
}

async function startExperiment(tool, options) {
  setExperimentStatus("実験ジョブを登録しています。");
  try {
    const job = await experimentApi("/api/experiments/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tool, options }),
    });
    state.activeExperimentJobId = job.id;
    setExperimentStatus(`${job.label}を開始しました。`);
    await refreshExperimentWorkspace({ silent: true });
    return job;
  } catch (error) {
    setExperimentStatus(`実行できません: ${error.message}`, true);
    return null;
  }
}

async function uploadExperimentFile(file, kind, target = "") {
  if (!file) return null;
  setExperimentStatus(`${file.name}をローカル実験領域へ登録しています。`);
  const query = new URLSearchParams({ kind, name: file.name });
  if (target) query.set("target", target);
  const resource = await experimentApi(`/api/experiments/uploads?${query}`, {
    method: "POST",
    headers: { "Content-Type": file.type || "application/octet-stream" },
    body: file,
  });
  await refreshExperimentWorkspace({ silent: true });
  setExperimentStatus(`${file.name}を登録しました。`);
  return resource;
}

async function registerSpeakerConditionFiles(files) {
  const selected = Array.from(files || []);
  const embeddings = selected.filter((file) =>
    file.name.toLowerCase().endsWith(".speaker.safetensors"),
  );
  const sidecars = selected.filter((file) => file.name.toLowerCase().endsWith(".json"));
  if (!embeddings.length) {
    throw new Error("`.speaker.safetensors`を1件以上選択してください。");
  }
  const expectedSidecarNames = new Set(
    embeddings.map((file) => file.name.replace(/\.safetensors$/i, ".json").toLowerCase()),
  );
  const unmatched = sidecars.filter(
    (file) => !expectedSidecarNames.has(file.name.toLowerCase()),
  );
  if (unmatched.length) {
    throw new Error(
      `対応する話者状態がないsidecarがあります: ${unmatched.map((file) => file.name).join(", ")}`,
    );
  }
  const registered = [];
  for (const embedding of embeddings) {
    const resource = await uploadExperimentFile(embedding, "speaker");
    if (!resource) continue;
    registered.push(resource.id);
    const expectedName = embedding.name.replace(/\.safetensors$/i, ".json");
    const sidecar = sidecars.find(
      (file) => file.name.toLowerCase() === expectedName.toLowerCase(),
    );
    if (sidecar) {
      await uploadExperimentFile(sidecar, "speaker-sidecar", resource.id);
    }
  }
  await refreshExperimentWorkspace({ silent: true });
  if (registered.length) {
    els.experimentObservationSpeaker.value = registered[registered.length - 1];
    if (els.experimentStabilitySpeaker) {
      els.experimentStabilitySpeaker.value = registered[registered.length - 1];
    }
    for (const option of els.experimentSpeakerEmbeddings.options) {
      option.selected = registered.includes(option.value);
    }
  }
  setExperimentStatus(`${registered.length}件の話者状態を管理領域へ登録しました。`);
  return registered;
}

async function registerCurrentExperimentProfile() {
  const profile = buildVoiceControlProfile();
  if (!profile) throw new Error("現在のプロファイルを構築できません。");
  const title = (els.projectTitleInput?.value || "voice_profile").replace(/[^A-Za-z0-9_.-]+/g, "-");
  const file = new File(
    [JSON.stringify(profile, null, 2)],
    `${title || "voice_profile"}.json`,
    { type: "application/json" },
  );
  const resource = await uploadExperimentFile(file, "profile");
  if (resource && els.experimentBenchmarkProfile) {
    els.experimentBenchmarkProfile.value = resource.id;
  }
  if (resource && els.experimentStabilityProfile) {
    els.experimentStabilityProfile.value = resource.id;
  }
}

function installExperimentHandlers() {
  for (const button of els.experimentToolButtons) {
    button.addEventListener("click", () => setExperimentTool(button.dataset.experimentTool));
  }
  els.refreshExperimentsBtn?.addEventListener("click", () => refreshExperimentWorkspace());
  els.runtimeObservationForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    startExperiment("runtime_observation", {
      steps: num(els.experimentObservationSteps, 4),
      speaker_condition: els.experimentObservationSpeaker?.value || "",
    });
  });
  els.speakerCompatibilityForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    startExperiment("speaker_compatibility", {
      embeddings: selectedOptionValues(els.experimentSpeakerEmbeddings),
      tokens: num(els.experimentSpeakerTokens, 16),
      seed: num(els.experimentSpeakerSeed, 0),
      init_std: num(els.experimentSpeakerInitStd, 0.02),
      create_format_fixture: els.experimentCreateFixture?.checked === true,
      hash_model: els.experimentHashModel?.checked === true,
    });
  });
  els.seedF0Form?.addEventListener("submit", (event) => {
    event.preventDefault();
    startExperiment("seed_f0", {
      profile_id: els.experimentBenchmarkProfile?.value || "",
      samples: num(els.experimentBenchmarkSamples, 10),
      seed_start: num(els.experimentBenchmarkSeed, 20260719),
      low_steps: num(els.experimentBenchmarkLowSteps, 4),
      final_steps: num(els.experimentBenchmarkFinalSteps, 40),
      analysis_seconds: num(els.experimentBenchmarkSeconds, 3),
      target_f0: optionalNum(els.experimentBenchmarkTargetF0),
      text: els.experimentBenchmarkText?.value || "",
      caption: els.experimentBenchmarkCaption?.value || "",
      model: els.ttsModelSelect?.value || "irodori-vdes",
      caption_guidance: num(els.experimentBenchmarkCfg, 2),
      duration_scale: num(els.experimentBenchmarkDuration, 1),
    });
  });
  els.stepStabilityForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    startExperiment("step_stability", {
      profile_id: els.experimentStabilityProfile?.value || "",
      speaker_condition: els.experimentStabilitySpeaker?.value || "",
      samples: num(els.experimentStabilitySamples, 3),
      seed_start: num(els.experimentStabilitySeed, 20260719),
      target_f0: optionalNum(els.experimentStabilityTargetF0),
      text: els.experimentStabilityText?.value || "",
      caption: els.experimentStabilityCaption?.value || "",
      model: els.ttsModelSelect?.value || "irodori-vdes",
      caption_guidance: num(els.experimentStabilityCfg, 2),
      duration_scale: num(els.experimentStabilityDuration, 1),
    });
  });
  els.voiceEvaluationForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const job = await startExperiment("voice_evaluation", {
      inputs: Array.from(state.evaluationInputIds),
      references: state.evaluationReferenceResources.map((item) => item.id),
      manifest_id: els.experimentEvaluationManifest?.value || "",
      target_f0: optionalNum(els.experimentEvaluationTargetF0),
    });
    if (job) {
      state.evaluationReferenceResources = [];
      renderEvaluationResources();
    }
  });
  els.runtimeDiagnosticsForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    startExperiment("runtime_diagnostics", {});
  });
  els.experimentUseCurrentProfileBtn?.addEventListener("click", () => {
    registerCurrentExperimentProfile().catch((error) =>
      setExperimentStatus(`登録できません: ${error.message}`, true),
    );
  });
  els.experimentStabilityUseCurrentProfileBtn?.addEventListener("click", () => {
    registerCurrentExperimentProfile().catch((error) =>
      setExperimentStatus(`登録できません: ${error.message}`, true),
    );
  });
  els.experimentSpeakerUpload?.addEventListener("change", async (event) => {
    try {
      await registerSpeakerConditionFiles(event.target.files);
    } catch (error) {
      setExperimentStatus(`話者状態を登録できません: ${error.message}`, true);
    } finally {
      event.target.value = "";
    }
  });
  els.experimentProfileUpload?.addEventListener("change", async (event) => {
    try {
      const resource = await uploadExperimentFile(event.target.files?.[0], "profile");
      if (resource) {
        els.experimentBenchmarkProfile.value = resource.id;
        if (els.experimentStabilityProfile) {
          els.experimentStabilityProfile.value = resource.id;
        }
      }
    } catch (error) {
      setExperimentStatus(`登録できません: ${error.message}`, true);
    } finally {
      event.target.value = "";
    }
  });
  els.experimentManifestUpload?.addEventListener("change", async (event) => {
    try {
      const resource = await uploadExperimentFile(event.target.files?.[0], "manifest");
      if (resource) els.experimentEvaluationManifest.value = resource.id;
    } catch (error) {
      setExperimentStatus(`登録できません: ${error.message}`, true);
    } finally {
      event.target.value = "";
    }
  });
  els.experimentWavUpload?.addEventListener("change", async (event) => {
    const uploaded = [];
    let reachedLimit = false;
    try {
      for (const file of Array.from(event.target.files || [])) {
        const resource = await uploadExperimentFile(file, "wav");
        if (resource) uploaded.push(resource.id);
      }
      for (const id of uploaded) {
        if (state.evaluationInputIds.has(id)) continue;
        if (state.evaluationInputIds.size >= MAX_EVALUATION_RESOURCES) {
          reachedLimit = true;
          break;
        }
        state.evaluationInputIds.add(id);
      }
      renderEvaluationResources();
      if (reachedLimit) {
        setExperimentStatus(
          `ファイルは登録しましたが、評価対象の選択は最大${MAX_EVALUATION_RESOURCES}件です。`,
          true,
        );
      }
    } catch (error) {
      setExperimentStatus(`登録できません: ${error.message}`, true);
    } finally {
      event.target.value = "";
    }
  });
  els.experimentReferenceWavUpload?.addEventListener("change", async (event) => {
    try {
      for (const file of Array.from(event.target.files || [])) {
        if (state.evaluationReferenceResources.length >= MAX_EVALUATION_RESOURCES) {
          setExperimentStatus(`参照音声は最大${MAX_EVALUATION_RESOURCES}件です。`, true);
          break;
        }
        const resource = await uploadExperimentFile(file, "reference-wav");
        if (
          resource
          && !state.evaluationReferenceResources.some((item) => item.id === resource.id)
        ) {
          state.evaluationReferenceResources.push(resource);
        }
      }
      renderEvaluationResources();
    } catch (error) {
      setExperimentStatus(`参照音声を登録できません: ${error.message}`, true);
    } finally {
      event.target.value = "";
    }
  });
  els.experimentRestoreExcludedInputsBtn?.addEventListener("click", () => {
    restoreEvaluationInputs().catch((error) =>
      setExperimentStatus(`除外を戻せません: ${error.message}`, true),
    );
  });
  els.cancelExperimentBtn?.addEventListener("click", async () => {
    if (!state.activeExperimentJobId) return;
    try {
      await experimentApi(`/api/experiments/jobs/${state.activeExperimentJobId}/cancel`, {
        method: "POST",
      });
      setExperimentStatus("中止要求を送信しました。");
      await refreshExperimentWorkspace({ silent: true });
    } catch (error) {
      setExperimentStatus(`中止できません: ${error.message}`, true);
    }
  });
}

function setActiveTab(tabId) {
  state.activeTab = tabId;
  for (const button of els.tabButtons) {
    const active = button.dataset.tabTarget === tabId;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", active ? "true" : "false");
  }
  for (const panel of els.tabPanels) {
    const active = panel.id === tabId;
    panel.classList.toggle("active", active);
    panel.hidden = !active;
  }
  if (els.floatingPreviewDock) {
    els.floatingPreviewDock.hidden = !["detailTab", "vowelTab"].includes(tabId);
  }
  if (tabId === "ttsModelTab" || tabId === "outputTab") {
    renderVoiceDesignerControls();
    refreshVoiceIdentities({ silent: true });
  }
  if (tabId === "experimentTab") {
    const profile = buildVoiceControlProfile();
    if (els.experimentBenchmarkCaption && !els.experimentBenchmarkCaption.value) {
      els.experimentBenchmarkCaption.value = activeTtsCaption(profile);
    }
    if (els.experimentBenchmarkTargetF0 && !els.experimentBenchmarkTargetF0.value) {
      els.experimentBenchmarkTargetF0.value = format(profile?.identity_anchor?.f0_mean_hz, 1);
    }
    refreshExperimentWorkspace();
  } else {
    scheduleExperimentPoll();
  }
  draw();
}

function escapeAttr(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");
}

function withoutRetiredConstraints(record) {
  if (!record || typeof record !== "object" || Array.isArray(record)) return record;
  return Object.fromEntries(Object.entries(record).filter(([key]) => !retiredConstraintKeys.has(key)));
}

function withoutReadOnlyDerivedOverrides(record) {
  if (!record || typeof record !== "object" || Array.isArray(record)) return record;
  return Object.fromEntries(Object.entries(record).filter(([key]) => !readOnlyDerivedConstraintKeys.has(key)));
}

const vowelFormants = {
  a: { label: "/a/", formants: [730, 1090, 2440, 3500], bandwidths: [90, 110, 180, 290], amplitude: 1.0 },
  i: { label: "/i/", formants: [300, 2200, 3000, 3650], bandwidths: [70, 130, 220, 310], amplitude: 0.82 },
  u: { label: "/u/", formants: [350, 900, 2200, 3400], bandwidths: [80, 120, 220, 300], amplitude: 0.78 },
  e: { label: "/e/", formants: [500, 1900, 2600, 3500], bandwidths: [80, 130, 200, 300], amplitude: 0.9 },
  o: { label: "/o/", formants: [500, 1000, 2400, 3400], bandwidths: [85, 120, 190, 295], amplitude: 0.88 },
};

const DEFAULT_PHONETIC_TARGET_PROFILE_ID = "ja_JP_standard_neutral_aggregate_0_1";
const GENERAL_PHONETIC_TARGET_PROFILE_ID = "general_five_vowel_engineering_0_1";

function phoneticTargetProfiles() {
  return referenceData.phoneticTargetProfiles ?? {};
}

function defaultPhoneticTargetProfileId(primaryLanguage = els.primaryLanguageInput?.value) {
  return primaryLanguage === "en" || primaryLanguage === "other"
    ? GENERAL_PHONETIC_TARGET_PROFILE_ID
    : DEFAULT_PHONETIC_TARGET_PROFILE_ID;
}

function normalizePhoneticTargetProfile(value, primaryLanguage = els.primaryLanguageInput?.value) {
  const profiles = phoneticTargetProfiles();
  if (profiles[value]) return value;
  const fallback = defaultPhoneticTargetProfileId(primaryLanguage);
  return profiles[fallback] ? fallback : Object.keys(profiles)[0] ?? GENERAL_PHONETIC_TARGET_PROFILE_ID;
}

function activePhoneticTargetProfile() {
  const id = normalizePhoneticTargetProfile(els.phoneticTargetProfileInput?.value, els.primaryLanguageInput?.value);
  return { id, profile: phoneticTargetProfiles()[id] ?? null };
}

function phoneticReferenceVtlCm(profile, sex = sexClass()) {
  const value = Number(profile?.reference_vtl_cm_by_sex?.[sex]);
  if (Number.isFinite(value) && value > 0) return value;
  return 17;
}

function highFormantBaselineBySex(sex = sexClass()) {
  const table = referenceData.sources?.pisanski2016?.extracted_values?.voice_table_1?.[sex]
    ?? referenceData.sources?.pisanski2016?.extracted_values?.voice_table_1?.neutral;
  return [Number(table?.f3_hz?.mean) || 2800, Number(table?.f4_hz?.mean) || 3800];
}

function currentVowelReference(vowel, vtl = null) {
  const fallback = vowelFormants[vowel] ?? vowelFormants.a;
  const { id, profile } = activePhoneticTargetProfile();
  const sex = sexClass();
  const vowelProfile = profile?.vowels?.[vowel] ?? profile?.vowels?.a;
  let formants = vowelProfile?.formants_hz?.slice();
  let f1F2Source = profile?.f1_f2_source ?? "engineering_general_0_1";
  let f3F4Source = profile?.f3_f4_source ?? "engineering_general_0_1";

  if (!formants && vowelProfile?.f1_f2_hz_by_sex) {
    const f1F2 = vowelProfile.f1_f2_hz_by_sex[sex]
      ?? vowelProfile.f1_f2_hz_by_sex.neutral
      ?? vowelProfile.f1_f2_hz_by_sex.female
      ?? vowelProfile.f1_f2_hz_by_sex.male;
    const highBaseline = highFormantBaselineBySex(sex);
    const factors = vowelProfile.higher_formant_factors ?? [1, 1];
    formants = [f1F2?.[0], f1F2?.[1], highBaseline[0] * factors[0], highBaseline[1] * factors[1]];
  }

  const baseFormants = (formants ?? fallback.formants).map((value, index) => Number(value) || fallback.formants[index] || fallback.formants.at(-1));
  const bandwidths = (vowelProfile?.bandwidths_hz ?? fallback.bandwidths).map((value, index) => Number(value) || fallback.bandwidths[index] || 300);
  const referenceVtlCm = phoneticReferenceVtlCm(profile, sex);
  const scale = Number.isFinite(vtl) && vtl > 0 ? referenceVtlCm / vtl : 1;
  const sourceKeys = profile?.source_keys?.length ? profile.source_keys : [];
  return {
    profile_id: id,
    profile_label: profile?.label ?? "Fallback vowel profile",
    profile_scope: profile?.profile_scope ?? "Fallback engineering vowel profile.",
    evidence_scope: profile?.evidence_scope ?? "Fallback engineering target.",
    language: profile?.language ?? "und",
    speech_style: profile?.speech_style ?? "engineering comparison",
    vowel,
    label: vowelProfile?.label ?? fallback.label,
    sex_reference_class: sex,
    reference_vtl_cm: Number(referenceVtlCm.toFixed(4)),
    vtl_scale: Number(scale.toFixed(6)),
    base_formants_hz: baseFormants.map((value) => Number(value.toFixed(3))),
    target_formants_hz: baseFormants.map((value) => Number((value * scale).toFixed(3))),
    bandwidths_hz: bandwidths.map((value) => Number(value.toFixed(3))),
    amplitude: Number(vowelProfile?.amplitude ?? fallback.amplitude ?? 0.9),
    sources: {
      f1_f2: f1F2Source,
      f3_f4: f3F4Source,
      profile_sources: sourceKeys,
    },
  };
}

function currentPhoneticTargetSummary() {
  const { id, profile } = activePhoneticTargetProfile();
  const vtl = state.constraints?.vocal_tract_length_cm?.center ?? null;
  return {
    profile_id: id,
    profile_label: profile?.label ?? "Fallback vowel profile",
    language: profile?.language ?? "und",
    speech_style: profile?.speech_style ?? "engineering comparison",
    profile_scope: profile?.profile_scope ?? "Fallback engineering vowel profile.",
    evidence_scope: profile?.evidence_scope ?? "Fallback engineering target.",
    source_keys: profile?.source_keys ?? [],
    vowels: Object.fromEntries(Object.keys(vowelFormants).map((vowel) => [vowel, currentVowelReference(vowel, vtl)])),
  };
}

const PREVIEW_REFERENCE_SAMPLE_RATE = 22050;
const PREVIEW_SAMPLE_RATE = 44100;
const AREA_TUNING_HANDLES = Object.freeze([0.08, 0.2, 0.34, 0.5, 0.66, 0.82, 0.94]);
const AREA_TUNING_GAIN_MIN = 0.45;
const AREA_TUNING_GAIN_MAX = 1.8;
const WIDTH_TUNING_GAIN_MIN = 0.55;
const WIDTH_TUNING_GAIN_MAX = 1.65;
const SYLLABLE_SETS = Object.freeze({
  vowels: ["a", "i", "u", "e", "o"],
  japanese_core_cv: [
    "a", "i", "u", "e", "o",
    "ka", "ki", "ku", "ke", "ko",
    "sa", "shi", "su", "se", "so",
    "ta", "chi", "tsu", "te", "to",
    "na", "ni", "nu", "ne", "no",
    "ha", "hi", "fu", "he", "ho",
    "ma", "mi", "mu", "me", "mo",
    "ya", "yu", "yo",
    "ra", "ri", "ru", "re", "ro",
    "wa", "wo", "n",
  ],
  japanese_extended_cv: [
    "a", "i", "u", "e", "o",
    "ka", "ki", "ku", "ke", "ko",
    "ga", "gi", "gu", "ge", "go",
    "sa", "shi", "su", "se", "so",
    "za", "ji", "zu", "ze", "zo",
    "ta", "chi", "tsu", "te", "to",
    "da", "di", "du", "de", "do",
    "na", "ni", "nu", "ne", "no",
    "ha", "hi", "fu", "he", "ho",
    "ba", "bi", "bu", "be", "bo",
    "pa", "pi", "pu", "pe", "po",
    "ma", "mi", "mu", "me", "mo",
    "ya", "yu", "yo",
    "ra", "ri", "ru", "re", "ro",
    "wa", "wo", "n",
  ],
});

const NASAL_TUNING_FIELDS = Object.freeze({
  closure_position: { min: 0.42, max: 0.99, step: 0.005 },
  closure_area_cm2: { min: 0.006, max: 0.35, step: 0.001 },
  closure_width: { min: 0.02, max: 0.16, step: 0.005 },
  velopharyngeal_opening: { min: 0.2, max: 1, step: 0.01 },
  nasal_path_gain: { min: 0.35, max: 1.4, step: 0.01 },
  branch_damping: { min: 0.3, max: 1.4, step: 0.01 },
  hold_duration_ms: { min: 45, max: 240, step: 1 },
  coarticulation_lead_ms: { min: 0, max: 60, step: 1 },
  transition_ms: { min: 15, max: 130, step: 1 },
  attack_fade_ms: { min: 0, max: 30, step: 1 },
});

const NASAL_DEFAULTS = Object.freeze({
  m: Object.freeze({
    label: "両唇鼻音 /m/",
    closure_position: 0.975,
    closure_area_cm2: 0.008,
    closure_width: 0.035,
    velopharyngeal_opening: 0.88,
    nasal_path_gain: 0.92,
    branch_damping: 0.72,
    hold_duration_ms: 52,
    coarticulation_lead_ms: 24,
    transition_ms: 22,
    attack_fade_ms: 15,
  }),
  n: Object.freeze({
    label: "歯茎鼻音 /n/",
    closure_position: 0.88,
    closure_area_cm2: 0.008,
    closure_width: 0.05,
    velopharyngeal_opening: 0.86,
    nasal_path_gain: 0.9,
    branch_damping: 0.74,
    hold_duration_ms: 50,
    coarticulation_lead_ms: 22,
    transition_ms: 20,
    attack_fade_ms: 15,
  }),
  N: Object.freeze({
    label: "撥音 /N/（後続音未指定）",
    closure_position: 0.64,
    closure_area_cm2: 0.08,
    closure_width: 0.085,
    velopharyngeal_opening: 0.9,
    nasal_path_gain: 0.96,
    branch_damping: 0.8,
    hold_duration_ms: 170,
    coarticulation_lead_ms: 0,
    transition_ms: 64,
    attack_fade_ms: 12,
  }),
});

function nasalClassFromToken(token) {
  const normalized = String(token || "ma").toLowerCase();
  if (normalized === "n") return "N";
  if (normalized.startsWith("m")) return "m";
  return "n";
}

function selectedNasalToken() {
  return String(els.nasalTokenSelect?.value || "ma");
}

function normalizedNasalTuning(nasalClass, manualTuning = true) {
  const key = NASAL_DEFAULTS[nasalClass] ? nasalClass : "m";
  const defaults = NASAL_DEFAULTS[key];
  const saved = manualTuning && state.nasalTuning?.[key] ? state.nasalTuning[key] : {};
  const tuning = { nasal_class: key, label: defaults.label };
  for (const [field, definition] of Object.entries(NASAL_TUNING_FIELDS)) {
    const value = Number(saved[field]);
    const fallback = defaults[field];
    const rounded = definition.step >= 1 ? Math.round(Number.isFinite(value) ? value : fallback) : Number((Number.isFinite(value) ? value : fallback).toFixed(4));
    tuning[field] = clamp(rounded, definition.min, definition.max);
  }
  return tuning;
}

function setNasalTuningValue(nasalClass, field, value) {
  const definition = NASAL_TUNING_FIELDS[field];
  if (!definition) return;
  const current = normalizedNasalTuning(nasalClass);
  const numeric = clamp(Number(value), definition.min, definition.max);
  current[field] = definition.step >= 1 ? Math.round(numeric) : Number(numeric.toFixed(4));
  const { nasal_class, label, ...saved } = current;
  state.nasalTuning = { ...(state.nasalTuning ?? {}), [nasalClass]: saved };
  state.nasalPreviewDiagnostics = {};
  state.lastWav = null;
}

function resetNasalTuning(nasalClass = nasalClassFromToken(selectedNasalToken())) {
  const next = { ...(state.nasalTuning ?? {}) };
  delete next[nasalClass];
  state.nasalTuning = next;
  state.nasalPreviewDiagnostics = {};
  state.lastWav = null;
  renderNasalCalibration();
  renderConstraints();
  draw();
}

function exportNasalTuning() {
  const profiles = {};
  for (const nasalClass of Object.keys(NASAL_DEFAULTS)) {
    if (!state.nasalTuning?.[nasalClass]) continue;
    profiles[nasalClass] = normalizedNasalTuning(nasalClass);
  }
  return {
    schema_version: "nasal_articulation_tuning_0.4",
    position_axis: "normalized glottis-to-lips distance x/L",
    parameter_semantics: {
      closure_position: "oral closure location along the vowel area function",
      closure_area_cm2: "residual oral area at maximum closure",
      closure_width: "longitudinal spread of the closure gesture",
      velopharyngeal_opening: "dynamic nasal-port opening during the consonant",
      nasal_path_gain: "nostril-radiation efficiency scale; velopharyngeal_opening controls branch admittance independently",
      branch_damping: "frequency-dependent nasal-path wall and viscothermal loss control",
      hold_duration_ms: "oral-release anchor measured from nasal onset",
      coarticulation_lead_ms: "time before oral release when the closed internal oral tract begins moving toward the following vowel",
      transition_ms: "duration from oral-release anchor to full following-vowel target",
      attack_fade_ms: "half-cosine output fade that suppresses initial waveguide transients",
    },
    profiles,
  };
}

function normalizeLoadedNasalTuning(data) {
  const source = data?.profiles ?? data;
  const directClosureAreaSchema = data?.schema_version === "nasal_articulation_tuning_0.4";
  const next = {};
  if (!source || typeof source !== "object") return next;
  for (const nasalClass of Object.keys(NASAL_DEFAULTS)) {
    if (!source[nasalClass] || typeof source[nasalClass] !== "object") continue;
    const profileSource = { ...source[nasalClass] };
    if (nasalClass === "n" && !directClosureAreaSchema && Number.isFinite(Number(profileSource.closure_area_cm2))) {
      profileSource.closure_area_cm2 = clamp(Number(profileSource.closure_area_cm2) * 0.2, 0.006, 0.025);
    }
    const normalized = normalizedNasalTuningFromSource(nasalClass, profileSource);
    const { nasal_class, label, ...saved } = normalized;
    next[nasalClass] = saved;
  }
  return next;
}

function normalizedNasalTuningFromSource(nasalClass, source) {
  const defaults = NASAL_DEFAULTS[nasalClass];
  const tuning = { nasal_class: nasalClass, label: defaults.label };
  for (const [field, definition] of Object.entries(NASAL_TUNING_FIELDS)) {
    const value = Number(source?.[field]);
    const fallback = defaults[field];
    const clamped = clamp(Number.isFinite(value) ? value : fallback, definition.min, definition.max);
    tuning[field] = definition.step >= 1 ? Math.round(clamped) : Number(clamped.toFixed(4));
  }
  return tuning;
}

function selectedVowel() {
  return vowelFormants[els.vowelSelect.value] ? els.vowelSelect.value : "a";
}

function selectedSyllableSetKey() {
  const key = els.syllableSetInput?.value ?? "vowels";
  return SYLLABLE_SETS[key] ? key : "vowels";
}

function selectedSyllableTokens() {
  return SYLLABLE_SETS[selectedSyllableSetKey()] ?? SYLLABLE_SETS.vowels;
}

function selectedSyllableToken() {
  const tokens = selectedSyllableTokens();
  return tokens.includes(state.selectedSyllableToken) ? state.selectedSyllableToken : tokens[0] ?? selectedVowel();
}

function defaultAreaTuningPoints() {
  return AREA_TUNING_HANDLES.map((position) => ({ position, gain: 1 }));
}

function normalizedAreaTuningPoints(vowel = selectedVowel()) {
  const saved = Array.isArray(state.vowelAreaTuning?.[vowel]) ? state.vowelAreaTuning[vowel] : [];
  const byPosition = new Map(saved.map((point) => [Number(point.position).toFixed(3), point]));
  return AREA_TUNING_HANDLES.map((position) => {
    const savedPoint = byPosition.get(Number(position).toFixed(3));
    const gain = Number(savedPoint?.gain);
    return {
      position,
      gain: Number(clamp(Number.isFinite(gain) ? gain : 1, AREA_TUNING_GAIN_MIN, AREA_TUNING_GAIN_MAX).toFixed(4)),
    };
  });
}

function setAreaTuningPoint(vowel, handleIndex, gain) {
  const points = normalizedAreaTuningPoints(vowel);
  const point = points[handleIndex];
  if (!point) return;
  point.gain = Number(clamp(gain, AREA_TUNING_GAIN_MIN, AREA_TUNING_GAIN_MAX).toFixed(4));
  state.vowelAreaTuning = {
    ...(state.vowelAreaTuning ?? {}),
    [vowel]: points,
  };
  state.lastWav = null;
}

function normalizedWidthTuningPoints(vowel = selectedVowel()) {
  const saved = Array.isArray(state.vowelWidthTuning?.[vowel]) ? state.vowelWidthTuning[vowel] : [];
  const byPosition = new Map(saved.map((point) => [Number(point.position).toFixed(3), point]));
  return AREA_TUNING_HANDLES.map((position) => {
    const savedPoint = byPosition.get(Number(position).toFixed(3));
    const gain = Number(savedPoint?.gain);
    return {
      position,
      gain: Number(clamp(Number.isFinite(gain) ? gain : 1, WIDTH_TUNING_GAIN_MIN, WIDTH_TUNING_GAIN_MAX).toFixed(4)),
    };
  });
}

function setWidthTuningPoint(vowel, handleIndex, gain) {
  const points = normalizedWidthTuningPoints(vowel);
  const point = points[handleIndex];
  if (!point) return;
  point.gain = Number(clamp(gain, WIDTH_TUNING_GAIN_MIN, WIDTH_TUNING_GAIN_MAX).toFixed(4));
  state.vowelWidthTuning = {
    ...(state.vowelWidthTuning ?? {}),
    [vowel]: points,
  };
  state.lastWav = null;
}

function resetAreaTuning(vowel = selectedVowel()) {
  const nextArea = { ...(state.vowelAreaTuning ?? {}) };
  const nextWidth = { ...(state.vowelWidthTuning ?? {}) };
  delete nextArea[vowel];
  delete nextWidth[vowel];
  state.vowelAreaTuning = nextArea;
  state.vowelWidthTuning = nextWidth;
  state.selectedTractTuningHandle = null;
  state.lastWav = null;
  updateTractEditStatus();
  renderConstraints();
  draw();
}

function areaTuningGainAt(position, vowel = selectedVowel()) {
  const points = normalizedAreaTuningPoints(vowel);
  if (!points.length) return 1;
  if (position <= points[0].position) return points[0].gain;
  for (let index = 1; index < points.length; index++) {
    const right = points[index];
    if (position > right.position) continue;
    const left = points[index - 1];
    const t = (position - left.position) / Math.max(0.0001, right.position - left.position);
    const smoothT = t * t * (3 - 2 * t);
    return left.gain + (right.gain - left.gain) * smoothT;
  }
  return points.at(-1).gain;
}

function widthTuningGainAt(position, vowel = selectedVowel()) {
  const points = normalizedWidthTuningPoints(vowel);
  if (position <= points[0].position) return points[0].gain;
  for (let index = 1; index < points.length; index++) {
    const right = points[index];
    if (position > right.position) continue;
    const left = points[index - 1];
    const t = (position - left.position) / Math.max(0.0001, right.position - left.position);
    const smoothT = t * t * (3 - 2 * t);
    return left.gain + (right.gain - left.gain) * smoothT;
  }
  return points.at(-1).gain;
}

function applyAreaTuning(areas, vowel) {
  const hasCustom = normalizedAreaTuningPoints(vowel).some((point) => Math.abs(point.gain - 1) > 0.0001);
  if (!hasCustom) return areas;
  return areas.map((area, index) => {
    const position = areas.length > 1 ? index / (areas.length - 1) : 0.5;
    return clamp(area * areaTuningGainAt(position, vowel), 0.07, 14);
  });
}

function synthesizeVowel(vowel = selectedVowel(), options = {}) {
  return synthesizeTubeVowel(vowel, options);
}

function constraintCenter(constraints, key, fallback) {
  const value = constraints?.[key]?.center;
  return Number.isFinite(value) ? value : fallback;
}

function derivedF0FromPhysicalValues(referenceHz, springConstant, baselineTension) {
  return clamp(
    referenceHz
      * Math.sqrt(clamp(springConstant, 0.35, 2))
      * Math.pow(clamp(baselineTension, 0.2, 2), 0.18),
    45,
    520
  );
}

function currentDerivedF0(constraints) {
  return derivedF0FromPhysicalValues(
    constraintCenter(constraints, "f0_reference_hz", constraintCenter(constraints, "f0_mean_hz", 165)),
    constraintCenter(constraints, "vocal_fold_spring_constant", 1),
    constraintCenter(constraints, "baseline_muscle_tension", 1)
  );
}

function currentGlottalSourceParams(constraints, tension) {
  const baseTension = clamp(tension ?? constraintCenter(constraints, "baseline_muscle_tension", 1), 0.25, 2);
  return {
    open_quotient: clamp(constraintCenter(constraints, "glottal_open_quotient", 0.58 + (1 - baseTension) * 0.06), 0.32, 0.9),
    speed_quotient: clamp(constraintCenter(constraints, "glottal_speed_quotient", 1.72 + (baseTension - 1) * 0.35), 0.75, 3.2),
    return_phase: clamp(constraintCenter(constraints, "glottal_return_phase", 0.15 + (1 - baseTension) * 0.03), 0.04, 0.36),
    spectral_tilt_db: clamp(constraintCenter(constraints, "glottal_spectral_tilt_db", 14.2 - baseTension * 1.2), 3, 32),
    breathiness: clamp(constraintCenter(constraints, "glottal_breathiness", 0.08 + Math.max(0, 1 - baseTension) * 0.08), 0, 0.75),
    volume_velocity_drive: clamp(constraintCenter(constraints, "glottal_volume_velocity_drive", 0.88), 0, 1),
    flow_smoothing: clamp(constraintCenter(constraints, "glottal_flow_smoothing", 0.37), 0, 0.95),
    flow_inertance: clamp(constraintCenter(constraints, "glottal_flow_inertance", 0.15 + (baseTension - 1) * 0.025), 0, 0.65),
  };
}

// DEVELOPMENT/MIGRATION ONLY. This reproduces the pre-0.3 master-control
// mapping so old projects can be converted once to explicit source variables.
function legacyGlottalSourceParamsFromClosure(legacyClosure, tension = 1) {
  const baseTension = clamp(tension, 0.25, 2);
  const closure = clamp(legacyClosure, 0, 1);
  return {
    open_quotient: clamp(0.66 - closure * 0.22 + (1 - baseTension) * 0.04, 0.32, 0.9),
    speed_quotient: clamp(1.45 + closure * 0.58 + baseTension * 0.14, 0.75, 3.2),
    return_phase: clamp(0.11 + (1 - closure) * 0.08, 0.04, 0.36),
    spectral_tilt_db: clamp(10.5 + (1 - closure) * 7.5 - baseTension * 1.2, 3, 32),
    breathiness: clamp((1 - closure) * 0.16, 0, 0.75),
    volume_velocity_drive: clamp(0.86 + (1 - closure) * 0.04, 0, 1),
    flow_smoothing: clamp(0.30 + (1 - closure) * 0.16, 0, 0.95),
    flow_inertance: clamp(0.10 + closure * 0.10 + baseTension * 0.025, 0, 0.65),
  };
}

function glottalClosureProxyFromOpenQuotient(openQuotient) {
  return clamp((0.9 - openQuotient) / 0.55, 0, 1);
}

function currentTubeLossParams(constraints) {
  return {
    wall_loss: clamp(constraintCenter(constraints, "vocal_tract_wall_loss", 0.018), 0, 0.1),
    viscothermal_loss: clamp(constraintCenter(constraints, "vocal_tract_viscothermal_loss", 0.012), 0, 0.1),
    high_frequency_damping: clamp(constraintCenter(constraints, "vocal_tract_high_frequency_damping", 0.28), 0, 0.9),
    wall_compliance: clamp(constraintCenter(constraints, "vocal_tract_wall_compliance", 0.18), 0, 0.8),
    resonance_broadening: clamp(constraintCenter(constraints, "vocal_tract_resonance_broadening", 0.26), 0, 0.9),
    lip_radiation_smoothing: clamp(constraintCenter(constraints, "lip_radiation_smoothing", 0.32), 0, 0.9),
  };
}

function lfLikeGlottalFlow(phase, params) {
  const oq = clamp(params.open_quotient, 0.32, 0.9);
  const sq = clamp(params.speed_quotient, 0.75, 3.2);
  const returnPhase = clamp(params.return_phase, 0.04, 0.36);
  const riseEnd = clamp(oq * sq / (sq + 1), 0.12, oq - 0.04);
  if (phase < riseEnd) {
    const x = phase / riseEnd;
    return 0.5 - 0.5 * Math.cos(Math.PI * x);
  }
  if (phase < oq) {
    const x = (phase - riseEnd) / Math.max(0.0001, oq - riseEnd);
    return Math.pow(Math.cos((Math.PI * x) / 2), 2.2);
  }
  const x = (phase - oq) / returnPhase;
  return -0.035 * Math.exp(-7 * x);
}

function glottalTiltAlpha(sampleRate, tiltDb) {
  const cutoff = clamp(7200 * Math.pow(0.5, clamp(tiltDb, 0, 36) / 12), 600, 7200);
  return 1 - Math.exp((-2 * Math.PI * cutoff) / sampleRate);
}

function sampleRateAdjustedAlpha(referenceAlpha, sampleRate) {
  const alpha = clamp(referenceAlpha, 0.000001, 1);
  return 1 - Math.pow(1 - alpha, PREVIEW_REFERENCE_SAMPLE_RATE / sampleRate);
}

function sampleRateAdjustedPole(referencePole, sampleRate) {
  return Math.pow(clamp(referencePole, 0.000001, 0.999999), PREVIEW_REFERENCE_SAMPLE_RATE / sampleRate);
}

function glottalVolumeVelocitySample(glottalFlow, sourceState, params, effectiveClosure, noise, pressureLikeScale = 1, options = {}) {
  const rawDerivative = glottalFlow - sourceState.lastRawFlow;
  sourceState.lastRawFlow = glottalFlow;
  const referenceFlowAlpha = clamp(1 - (options.flowSmoothing ?? params.flow_smoothing ?? 0.34), 0.04, 1);
  const flowAlpha = sampleRateAdjustedAlpha(referenceFlowAlpha, options.sampleRate ?? PREVIEW_REFERENCE_SAMPLE_RATE);
  sourceState.smoothedFlow += flowAlpha * (glottalFlow - sourceState.smoothedFlow);
  const smoothedDerivative = sourceState.smoothedFlow - sourceState.lastSmoothedFlow;
  sourceState.lastSmoothedFlow = sourceState.smoothedFlow;
  const velocityDrive = clamp(options.velocityDrive ?? params.volume_velocity_drive ?? 0.86, 0, 1);
  const inertance = clamp(options.flowInertance ?? params.flow_inertance ?? 0.12, 0, 0.65);
  const volumeVelocity = sourceState.smoothedFlow * (0.90 + effectiveClosure * 0.12);
  const pressureLike = rawDerivative * (0.65 + effectiveClosure * 0.18) * pressureLikeScale;
  const inertiveKick = smoothedDerivative * inertance * (1.0 + effectiveClosure * 0.35);
  return volumeVelocity * velocityDrive + pressureLike * (1 - velocityDrive) + inertiveKick + noise;
}

function areaFunctionDescriptor(areaFunction) {
  const areas = areaFunction?.areas_cm2?.length ? areaFunction.areas_cm2 : [1.5];
  return {
    global: areaStats(areas, 0, 1.001),
    laryngeal: areaStats(areas, 0, 0.18),
    pharyngeal: areaStats(areas, 0.18, 0.46),
    back_oral: areaStats(areas, 0.46, 0.72),
    front_oral: areaStats(areas, 0.72, 0.9),
    labial: areaStats(areas, 0.9, 1.001),
  };
}

function areaStats(areas, start, end) {
  const selected = [];
  for (let index = 0; index < areas.length; index++) {
    const position = areas.length > 1 ? index / (areas.length - 1) : 0.5;
    if (position >= start && position < end) selected.push(areas[index]);
  }
  const values = selected.length ? selected : areas;
  const sum = values.reduce((total, value) => total + value, 0);
  const min = Math.min(...values);
  const max = Math.max(...values);
  return {
    mean: Number((sum / values.length).toFixed(4)),
    min: Number(min.toFixed(4)),
    max: Number(max.toFixed(4)),
  };
}

function synthesizeTubeVowel(vowel = selectedVowel(), options = {}) {
  const sampleRate = PREVIEW_SAMPLE_RATE;
  const constraints = state.constraints;
  const geometry = state.vocalTractGeometry ?? buildVocalTractGeometry();
  const vtl = geometry?.vocal_tract_length_cm ?? constraints.vocal_tract_length_cm?.center ?? 15.5;
  const tension = constraints.baseline_muscle_tension?.center ?? 1;
  const respiratoryProfile = currentRespiratoryProfile(constraints);
  const respiratorySupport = respiratoryProfile.effective_support;
  const pressure = respiratoryProfile.effective_pressure_pa;
  const duration = (1.05 + clamp(respiratorySupport, 0.55, 1.45) * 0.34) * respiratoryProfile.duration_ratio;
  const n = Math.floor(sampleRate * duration);
  const f0 = currentDerivedF0(constraints);
  const motorProfile = currentArticulationMotorProfile(constraints);
  const areaFunction = buildTubeAreaFunction(geometry, vowel, sampleRate, motorProfile, options);
  const glottalParams = currentGlottalSourceParams(constraints, tension);
  const effectiveClosure = glottalClosureProxyFromOpenQuotient(glottalParams.open_quotient);
  const aspirationNoiseScale = 1;
  const lossParams = currentTubeLossParams(constraints);
  const tubeLossModel = buildTubeDistributedLossModel(lossParams, sampleRate, areaFunction.areas_cm2.length);
  const out = synthesizeKellyLochbaumTube(areaFunction.areas_cm2, {
    sampleCount: n,
    sampleRate,
    f0,
    pressure,
    effectiveClosure,
    respiratorySupport,
    tension,
    amplitude: currentVowelReference(vowel, vtl).amplitude,
    motorControlPrecision: motorProfile.motor_control_precision,
    glottalParams,
    aspirationNoiseScale,
    lossParams,
    lossModel: tubeLossModel,
  });
  const sideBranchLossModel = applySideBranchLosses(out, sampleRate, constraints, vowel, geometry, areaFunction, { strength: 1 });
  const bodyResonanceModel = applyBodyResonance(out, sampleRate, constraints);
  normalize(out, 0.92);
  return {
    sampleRate,
    samples: out,
    vowel,
    formant_reference: currentVowelReference(vowel, vtl),
    backend: "area_function_tube",
    area_function: areaFunction,
    distributed_loss_model: tubeLossModel,
    side_branch_loss_model: sideBranchLossModel,
    body_resonance_model: bodyResonanceModel,
    respiratory_drive: respiratoryProfile,
    derived_f0_hz: Number(f0.toFixed(4)),
    source_noise_model: {
      schema_version: "tube_source_noise_0.1",
      aspiration_noise_scale: Number(aspirationNoiseScale.toFixed(4)),
      injection: "tube_glottal_source",
    },
  };
}

function currentArticulationMotorProfile(constraints) {
  const gestureExecutionInput = clamp(constraints.articulatory_range_utilization?.center ?? 1, 0.2, 2.5);
  const gestureExecutionResponse = gestureExecutionResponseFromConstraints(constraints);
  const gestureExecution = clamp(
    gestureExecutionResponse.response_offset + gestureExecutionInput * gestureExecutionResponse.response_gain,
    gestureExecutionResponse.effective_min,
    gestureExecutionResponse.effective_max
  );
  const tongueDorsumRange = constraints.tongue_dorsum_range_utilization?.center ?? 1;
  const labialTransverseRange = constraints.labial_transverse_range_utilization?.center ?? 1;
  const tongueGrooveRange = constraints.tongue_groove_capacity?.center ?? 1;
  const precision = constraints.motor_control_precision?.center ?? 1;
  const coarticulation = constraints.coarticulation_strength?.center ?? 0.58;
  const maturity = constraints.motor_control_maturity?.center ?? 1;
  const contrast = constraints.phonological_contrast_maturity?.center ?? 1;
  return {
    gesture_execution: gestureExecution,
    gesture_execution_input: gestureExecutionInput,
    gesture_execution_response_offset: gestureExecutionResponse.response_offset,
    gesture_execution_response_gain: gestureExecutionResponse.response_gain,
    articulatory_range_utilization: gestureExecutionInput,
    tongue_dorsum_performance_range: clamp(tongueDorsumRange, 0.2, 1),
    labial_transverse_performance_range: clamp(labialTransverseRange, 0.2, 1),
    tongue_groove_performance_range: clamp(tongueGrooveRange, 0.2, 1),
    tongue_dorsum_range_utilization: clamp(tongueDorsumRange, 0.2, 1),
    labial_transverse_range_utilization: clamp(labialTransverseRange, 0.2, 1),
    motor_control_precision: clamp(precision, 0.15, 1.4),
    coarticulation_strength: clamp(coarticulation, 0, 1),
    // Reserved for stochastic target-arrival error in the future temporal TTS
    // motion layer. The isolated-vowel preview remains deterministic.
    motor_control_maturity: clamp(maturity, 0.2, 1.2),
    phonological_contrast_maturity: clamp(contrast, 0.2, 1.2),
  };
}

function buildTubeAreaFunction(geometry, vowel, sampleRate, motorProfile = currentArticulationMotorProfile(state.constraints), options = {}) {
  const fallbackVtl = state.constraints.vocal_tract_length_cm?.center ?? 15.5;
  const vtlCm = geometry?.vocal_tract_length_cm ?? fallbackVtl;
  const cCmPerS = 35000;
  const tubeCount = clamp(Math.round((vtlCm * sampleRate) / cCmPerS), 6, 36);
  const rawAreas = [];
  const rawCrossSections = [];
  for (let index = 0; index < tubeCount; index++) {
    const position = (index + 0.5) / tubeCount;
    const section = crossSectionAtPosition(geometry?.sections ?? [], position);
    rawCrossSections.push(section);
    rawAreas.push(section.area_cm2);
  }
  const articulationTarget = vowelArticulationTarget(vowel);
  const useManualTuning = options.manualTuning !== false;
  const vowelWarpedAreas = applyVowelAreaWarp(rawAreas, vowel, motorProfile, articulationTarget);
  const warpedAreas = useManualTuning ? applyAreaTuning(vowelWarpedAreas, vowel) : vowelWarpedAreas;
  const crossSections2_5d = realizeVowelCrossSections2_5D(
    rawCrossSections,
    warpedAreas,
    vowel,
    articulationTarget,
    motorProfile,
    { manualWidthTuning: useManualTuning }
  );
  const derivedAreas = crossSections2_5d.map((section) => section.total_area_cm2);
  const formantReference = currentVowelReference(vowel, vtlCm);
  return {
    schema_version: "area_function_tube_0.2",
    source_geometry: geometry?.schema_version ?? "fallback",
    acoustic_model: "lossy Kelly-Lochbaum style 1D tube with volume-velocity source input and post side-branch coloring",
    geometry_projection: "synthetic 2.5D sections are projected to total A(x) for the current single-channel browser solver",
    vowel_shape: vowel,
    vocal_tract_length_cm: Number(vtlCm.toFixed(4)),
    tube_count: tubeCount,
    section_length_cm: Number((vtlCm / tubeCount).toFixed(4)),
    areas_cm2: derivedAreas.map((area) => Number(area.toFixed(4))),
    raw_areas_cm2: rawAreas.map((area) => Number(area.toFixed(4))),
    vowel_area_tuning: normalizedAreaTuningPoints(vowel),
    vowel_width_tuning: normalizedWidthTuningPoints(vowel),
    manual_tuning_applied: useManualTuning,
    cross_sections_2_5d: crossSections2_5d,
    phonetic_target_profile: {
      id: formantReference.profile_id,
      label: formantReference.profile_label,
      language: formantReference.language,
      speech_style: formantReference.speech_style,
      source_keys: formantReference.sources.profile_sources,
    },
    formant_target_reference: formantReference,
    articulation_target: {
      jaw_opening_target: articulationTarget.jaw_opening_target,
      oral_cavity_expansion_gain: articulationTarget.oral_cavity_expansion_gain,
      mandibular_release_gain: articulationTarget.mandibular_release_gain,
      oral_aperture_gain: articulationTarget.oral_aperture_gain,
      lip_rounding_target: articulationTarget.lip_rounding_target,
      lip_compression_target: articulationTarget.lip_compression_target,
      mouth_spread_target: articulationTarget.mouth_spread_target,
      mouth_width_target_cm: articulationTarget.mouth_width_target_cm,
      transverse_mouth_width_gain: articulationTarget.transverse_mouth_width_gain,
      transverse_mouth_center: articulationTarget.transverse_mouth_center,
      transverse_mouth_width: articulationTarget.transverse_mouth_width,
      tongue_dorsum_profile_gain: articulationTarget.tongue_dorsum_profile_gain,
      labial_transverse_profile_gain: articulationTarget.labial_transverse_profile_gain,
      tongue_warps: articulationTarget.tongue_warps,
      labial_warps: articulationTarget.labial_warps,
      cross_section: articulationTarget.cross_section,
    },
    motor_profile: motorProfile,
    note: "Areas are derived from a synthetic 2.5D midsagittal-plus-coronal template, then projected to total A(x). The retained lateral-channel fields are design metadata for a later multi-channel or 3D backend, not individually observed anatomy.",
  };
}

function areaAtPosition(sections, position) {
  if (!sections.length) return 1.5;
  if (position <= sections[0].position) return clamp(sections[0].area_cm2, 0.08, 12);
  for (let index = 1; index < sections.length; index++) {
    const current = sections[index];
    if (position > current.position) continue;
    const previous = sections[index - 1];
    const t = (position - previous.position) / Math.max(0.0001, current.position - previous.position);
    return clamp(previous.area_cm2 + (current.area_cm2 - previous.area_cm2) * t, 0.08, 12);
  }
  return clamp(sections[sections.length - 1].area_cm2, 0.08, 12);
}

function crossSectionAtPosition(sections, position) {
  const fallback = {
    position: Number(position.toFixed(5)),
    region: regionForPosition(position).key,
    area_cm2: 1.5,
    sagittal_height_cm: 1.38,
    coronal_width_cm: 1.38,
    ellipse_shape_factor: Math.PI / 4,
    aspect_ratio: 1,
    lateral_channel_capacity_cm2: 0.12,
  };
  if (!sections.length) return fallback;
  const normalized = (section) => {
    const area = clamp(Number(section.area_cm2) || 1.5, 0.08, 12);
    const sagittal = clamp(Number(section.cross_section?.sagittal_height_cm ?? section.sagittal_diameter_cm) || Math.sqrt(area / (Math.PI / 4)), 0.08, 6);
    const coronal = clamp(Number(section.cross_section?.coronal_width_cm ?? section.frontal_width_cm) || Math.sqrt(area / (Math.PI / 4)), 0.08, 8);
    const factor = clamp(Number(section.cross_section?.ellipse_shape_factor ?? section.ellipse_shape_factor) || Math.PI / 4, 0.45, 1);
    const capacity = clamp(Number(section.cross_section?.lateral_channel_capacity_cm2 ?? section.lateral_channel_capacity_cm2) || area * 0.08, 0, area * 0.45);
    return {
      position: Number(section.position ?? position),
      region: section.region ?? regionForPosition(section.position ?? position).key,
      area_cm2: area,
      sagittal_height_cm: sagittal,
      coronal_width_cm: coronal,
      ellipse_shape_factor: factor,
      aspect_ratio: clamp(coronal / Math.max(0.08, sagittal), 0.12, 12),
      lateral_channel_capacity_cm2: capacity,
    };
  };
  const interpolate = (left, right, t) => {
    const mix = (key) => left[key] + (right[key] - left[key]) * t;
    const area = clamp(mix("area_cm2"), 0.08, 12);
    return {
      position: Number(position.toFixed(5)),
      region: regionForPosition(position).key,
      area_cm2: area,
      sagittal_height_cm: clamp(mix("sagittal_height_cm"), 0.08, 6),
      coronal_width_cm: clamp(mix("coronal_width_cm"), 0.08, 8),
      ellipse_shape_factor: clamp(mix("ellipse_shape_factor"), 0.45, 1),
      aspect_ratio: clamp(mix("aspect_ratio"), 0.12, 12),
      lateral_channel_capacity_cm2: clamp(mix("lateral_channel_capacity_cm2"), 0, area * 0.45),
    };
  };
  const first = normalized(sections[0]);
  if (position <= first.position) return { ...first, position: Number(position.toFixed(5)) };
  for (let index = 1; index < sections.length; index++) {
    const right = normalized(sections[index]);
    if (position > right.position) continue;
    const left = normalized(sections[index - 1]);
    const t = (position - left.position) / Math.max(0.0001, right.position - left.position);
    return interpolate(left, right, t);
  }
  const last = normalized(sections[sections.length - 1]);
  return { ...last, position: Number(position.toFixed(5)) };
}

function realizeVowelCrossSections2_5D(rawSections, warpedAreas, vowel, articulationTarget, motorProfile, options = {}) {
  const gestureExecution = clamp(motorProfile.gesture_execution ?? motorProfile.articulatory_range_utilization, 0.18, GESTURE_EXECUTION_EFFECTIVE_MAX);
  const tongueAvailability = clamp(motorProfile.tongue_dorsum_performance_range ?? motorProfile.tongue_dorsum_range_utilization, 0.2, 1);
  const labialAvailability = clamp(motorProfile.labial_transverse_performance_range ?? motorProfile.labial_transverse_range_utilization, 0.2, 1);
  const grooveAvailability = clamp(motorProfile.tongue_groove_performance_range ?? 1, 0.2, 1);
  const crossTarget = articulationTarget.cross_section ?? {};
  const lipAspectTarget = clamp(crossTarget.lip_aperture_aspect_target ?? 1, 0.55, 1.8);
  const tongueGrooveTarget = clamp(crossTarget.tongue_groove_target ?? 0, 0, 1);
  const lateralChannelTarget = clamp(crossTarget.lateral_channel_target ?? 0, 0, 1);
  return rawSections.map((raw, index) => {
    const baseTotalArea = clamp(warpedAreas[index], 0.07, 14);
    const terminalWeight = Math.exp(-0.5 * Math.pow((raw.position - 0.94) / 0.105, 2));
    const tongueZone = Math.exp(-0.5 * Math.pow((raw.position - 0.72) / 0.18, 2));
    const aspectFactor = 1 + (lipAspectTarget - 1) * terminalWeight * labialAvailability * gestureExecution;
    const aspectRatio = clamp(raw.aspect_ratio * aspectFactor, 0.16, 12);
    const shapeFactor = clamp(raw.ellipse_shape_factor, 0.45, 1);
    const equivalentRectangleArea = baseTotalArea / shapeFactor;
    const widthGain = options.manualWidthTuning === false ? 1 : widthTuningGainAt(raw.position, vowel);
    const coronalWidth = Math.sqrt(equivalentRectangleArea * aspectRatio) * widthGain;
    const sagittalHeight = Math.sqrt(equivalentRectangleArea / aspectRatio);
    const totalArea = clamp(coronalWidth * sagittalHeight * shapeFactor, 0.07, 14);
    const realizedAspectRatio = clamp(coronalWidth / Math.max(0.08, sagittalHeight), 0.16, 12);
    const constriction = clamp(1 - totalArea / Math.max(0.08, raw.area_cm2), 0, 1);
    const tongueGrooveDepth = clamp(tongueGrooveTarget * tongueAvailability * grooveAvailability * gestureExecution * tongueZone, 0, 1);
    const lateralDemand = clamp(lateralChannelTarget * 3 + tongueGrooveTarget * 0.45, 0, 1);
    const lateralActivation = clamp(lateralDemand * grooveAvailability * gestureExecution * (0.3 + constriction * 0.7), 0, 1);
    const lateralArea = clamp(raw.lateral_channel_capacity_cm2 * lateralActivation, 0, totalArea * 0.34);
    return {
      index,
      position: raw.position,
      region: raw.region,
      vowel,
      total_area_cm2: Number(totalArea.toFixed(4)),
      midline_area_cm2: Number((totalArea - lateralArea).toFixed(4)),
      lateral_channel_area_cm2: Number(lateralArea.toFixed(4)),
      sagittal_height_cm: Number(sagittalHeight.toFixed(4)),
      coronal_width_cm: Number(coronalWidth.toFixed(4)),
      ellipse_shape_factor: Number(shapeFactor.toFixed(5)),
      aspect_ratio: Number(realizedAspectRatio.toFixed(4)),
      width_tuning_gain: Number(widthGain.toFixed(4)),
      tongue_groove_depth: Number(tongueGrooveDepth.toFixed(4)),
      lateral_channel_activation: Number(lateralActivation.toFixed(4)),
      projection: "total_area_cm2 is supplied to the current single-channel 1D tube solver",
    };
  });
}

function currentMouthWidthPerformanceModel() {
  const feature = state.features.mouth_width_cm ?? {};
  const constraint = state.constraints.mouth_width_relaxed_cm;
  const relaxedWidth = constraint?.center
    ?? feature.articulatory_baseline_cm
    ?? feature.integrated
    ?? feature.statistical_median
    ?? 4.85;
  const sourceCenter = constraint?.resting_anatomical_state?.value
    ?? constraint?.statistics?.reference_center
    ?? feature.performance_width_range_cm?.center
    ?? relaxedWidth;
  const sourceRange = constraint?.performance_control_range ?? feature.performance_width_range_cm;
  const centerScale = relaxedWidth / Math.max(0.1, sourceCenter);
  const min = (sourceRange?.min ?? relaxedWidth * 0.72) * centerScale;
  const max = (sourceRange?.max ?? relaxedWidth * 1.18) * centerScale;
  return {
    relaxed_width_cm: relaxedWidth,
    pursed_width_cm: Math.min(relaxedWidth, min),
    spread_width_cm: Math.max(relaxedWidth, max),
  };
}

function vowelArticulationTarget(vowel) {
  const targets = {
    a: {
      jaw_opening_target: 0.9,
      oral_cavity_expansion_gain: 1.25,
      mandibular_release_gain: 1,
      oral_aperture_gain: 1,
      lip_rounding_target: 0.05,
      mouth_spread_target: 0.58,
      cross_section: { lip_aperture_aspect_target: 1, tongue_groove_target: 0.03, lateral_channel_target: 0.02 },
      tongue_warps: [{ center: 0.38, width: 0.16, gain: 0.48 }],
      labial_warps: [{ center: 0.94, width: 0.09, gain: 1.05 }],
      warps: [{ center: 0.38, width: 0.16, gain: 0.48 }, { center: 0.94, width: 0.09, gain: 1.05 }],
    },
    i: {
      jaw_opening_target: 0.24,
      oral_cavity_expansion_gain: 1,
      mandibular_release_gain: 1,
      oral_aperture_gain: 1.05,
      lip_rounding_target: 0.02,
      lip_compression_target: 0.1,
      mouth_spread_target: 0.98,
      cross_section: { lip_aperture_aspect_target: 1.45, tongue_groove_target: 0.18, lateral_channel_target: 0.14 },
      tongue_dorsum_profile_gain: 1.04,
      labial_transverse_profile_gain: 0.72,
      transverse_mouth_center: 0.935,
      transverse_mouth_width: 0.065,
      tongue_warps: [{ center: 0.3, width: 0.2, gain: 2 }, { center: 0.72, width: 0.115, gain: 0.36 }],
      labial_warps: [{ center: 0.95, width: 0.08, gain: 0.88 }],
      warps: [{ center: 0.3, width: 0.2, gain: 2 }, { center: 0.72, width: 0.115, gain: 0.36 }, { center: 0.95, width: 0.08, gain: 0.88 }],
    },
    u: {
      jaw_opening_target: 0.16,
      oral_cavity_expansion_gain: 1.1,
      mandibular_release_gain: 1,
      oral_aperture_gain: 0.66,
      lip_rounding_target: 0.18,
      lip_compression_target: 0.84,
      mouth_spread_target: 0.28,
      cross_section: { lip_aperture_aspect_target: 0.72, tongue_groove_target: 0.08, lateral_channel_target: 0.06 },
      tongue_warps: [{ center: 0.21, width: 0.15, gain: 1.12 }, { center: 0.56, width: 0.15, gain: 0.55 }],
      labial_warps: [{ center: 0.92, width: 0.08, gain: 0.42 }],
      warps: [{ center: 0.21, width: 0.15, gain: 1.12 }, { center: 0.56, width: 0.15, gain: 0.55 }, { center: 0.92, width: 0.08, gain: 0.42 }],
    },
    e: {
      jaw_opening_target: 0.43,
      oral_cavity_expansion_gain: 1,
      mandibular_release_gain: 1,
      oral_aperture_gain: 1.02,
      lip_rounding_target: 0.05,
      lip_compression_target: 0.08,
      mouth_spread_target: 0.91,
      cross_section: { lip_aperture_aspect_target: 1.34, tongue_groove_target: 0.11, lateral_channel_target: 0.08 },
      tongue_warps: [{ center: 0.34, width: 0.18, gain: 1.22 }, { center: 0.67, width: 0.13, gain: 0.38 }],
      labial_warps: [{ center: 0.94, width: 0.09, gain: 0.9 }],
      warps: [{ center: 0.34, width: 0.18, gain: 1.22 }, { center: 0.67, width: 0.13, gain: 0.38 }, { center: 0.94, width: 0.09, gain: 0.9 }],
    },
    o: {
      jaw_opening_target: 0.68,
      oral_cavity_expansion_gain: 1.48,
      mandibular_release_gain: 1.04,
      oral_aperture_gain: 1.3,
      lip_rounding_target: 0.7,
      lip_compression_target: 0.26,
      mouth_spread_target: 0.5,
      cross_section: { lip_aperture_aspect_target: 0.84, tongue_groove_target: 0.04, lateral_channel_target: 0.04 },
      tongue_warps: [{ center: 0.2, width: 0.15, gain: 0.6 }, { center: 0.42, width: 0.16, gain: 0.4 }],
      labial_warps: [{ center: 0.95, width: 0.08, gain: 0.42 }],
      warps: [{ center: 0.2, width: 0.15, gain: 0.6 }, { center: 0.42, width: 0.16, gain: 0.4 }, { center: 0.95, width: 0.08, gain: 0.42 }],
    },
  };
  const fallbackTarget = targets[vowel] ?? targets.a;
  const profileTarget = activePhoneticTargetProfile().profile?.vowels?.[vowel]?.articulation;
  const target = {
    ...fallbackTarget,
    ...(profileTarget ?? {}),
    warps: profileTarget?.warps ?? fallbackTarget.warps,
    tongue_warps: profileTarget?.tongue_warps ?? fallbackTarget.tongue_warps ?? profileTarget?.warps ?? fallbackTarget.warps,
    labial_warps: profileTarget?.labial_warps ?? fallbackTarget.labial_warps ?? [],
    lip_compression_target: profileTarget?.lip_compression_target ?? fallbackTarget.lip_compression_target ?? 0,
    tongue_dorsum_profile_gain: profileTarget?.tongue_dorsum_profile_gain ?? fallbackTarget.tongue_dorsum_profile_gain ?? 1,
    labial_transverse_profile_gain: profileTarget?.labial_transverse_profile_gain ?? fallbackTarget.labial_transverse_profile_gain ?? 1,
    transverse_mouth_center: profileTarget?.transverse_mouth_center ?? fallbackTarget.transverse_mouth_center ?? 0.92,
    transverse_mouth_width: profileTarget?.transverse_mouth_width ?? fallbackTarget.transverse_mouth_width ?? 0.09,
    cross_section: {
      ...(fallbackTarget.cross_section ?? {}),
      ...(profileTarget?.cross_section ?? {}),
    },
  };
  const widthModel = currentMouthWidthPerformanceModel();
  const widthTarget = widthModel.pursed_width_cm
    + (widthModel.spread_width_cm - widthModel.pursed_width_cm) * target.mouth_spread_target;
  return {
    ...target,
    mouth_width_target_cm: Number(widthTarget.toFixed(4)),
    transverse_mouth_width_gain: Number((widthTarget / Math.max(0.1, widthModel.relaxed_width_cm)).toFixed(4)),
  };
}

function applyVowelAreaWarp(areas, vowel, motorProfile = currentArticulationMotorProfile(state.constraints), articulationTarget = vowelArticulationTarget(vowel)) {
  const tongueWarps = articulationTarget.tongue_warps ?? articulationTarget.warps ?? [];
  const labialWarps = articulationTarget.labial_warps ?? [];
  const gestureExecution = clamp(motorProfile.gesture_execution ?? motorProfile.articulatory_range_utilization, 0.2, GESTURE_EXECUTION_EFFECTIVE_MAX);
  const tongueRangeAvailability = clamp(motorProfile.tongue_dorsum_performance_range ?? motorProfile.tongue_dorsum_range_utilization, 0.2, 1);
  const labialRangeAvailability = clamp(motorProfile.labial_transverse_performance_range ?? motorProfile.labial_transverse_range_utilization, 0.2, 1);
  const precision = clamp(motorProfile.motor_control_precision, 0.15, 1.4);
  const coarticulation = clamp(motorProfile.coarticulation_strength, 0, 1);
  const contrast = clamp(motorProfile.phonological_contrast_maturity, 0.2, 1.2);
  const effectiveDepth = clamp(gestureExecution * (0.72 + contrast * 0.28), 0.18, GESTURE_EXECUTION_EFFECTIVE_MAX);
  const tongueDepth = clamp(
    effectiveDepth * tongueRangeAvailability * articulationTarget.tongue_dorsum_profile_gain,
    0.18,
    GESTURE_EXECUTION_EFFECTIVE_MAX
  );
  const labialDepth = clamp(
    effectiveDepth * labialRangeAvailability * articulationTarget.labial_transverse_profile_gain,
    0.18,
    GESTURE_EXECUTION_EFFECTIVE_MAX
  );
  const spatialSmoothing = clamp(0.035 + coarticulation * 0.04 + Math.max(0, 1 - precision) * 0.12 + Math.max(0, 1 - contrast) * 0.08, 0.02, 0.22);
  const targets = areas.map((area, index) => {
    const position = areas.length > 1 ? index / (areas.length - 1) : 0;
    let gain = 1;
    for (const warp of tongueWarps) {
      const d = (position - warp.center) / Math.max(0.01, warp.width);
      gain *= 1 + (warp.gain - 1) * tongueDepth * Math.exp(-0.5 * d * d);
    }
    for (const warp of labialWarps) {
      const d = (position - warp.center) / Math.max(0.01, warp.width);
      gain *= 1 + (warp.gain - 1) * labialDepth * Math.exp(-0.5 * d * d);
    }
    const jawD = (position - 0.67) / 0.2;
    gain *= 1 + (articulationTarget.oral_cavity_expansion_gain - 1) * effectiveDepth * Math.exp(-0.5 * jawD * jawD);
    const mandibularReleaseD = (position - 0.42) / 0.17;
    gain *= 1 + (articulationTarget.mandibular_release_gain - 1) * effectiveDepth * Math.exp(-0.5 * mandibularReleaseD * mandibularReleaseD);
    const oralApertureD = (position - 0.86) / 0.075;
    gain *= 1 + (articulationTarget.oral_aperture_gain - 1) * effectiveDepth * Math.exp(-0.5 * oralApertureD * oralApertureD);
    const transverseMouthD = (position - articulationTarget.transverse_mouth_center) / Math.max(0.02, articulationTarget.transverse_mouth_width);
    gain *= 1 + (articulationTarget.transverse_mouth_width_gain - 1) * labialDepth * Math.exp(-0.5 * transverseMouthD * transverseMouthD);
    const labialShapeD = (position - 0.965) / 0.065;
    // Roundness primarily changes aperture shape; compression is the stronger
    // determinant of its total-area reduction for the Japanese /u/-/o/ contrast.
    const labialNarrowing = clamp(
      articulationTarget.lip_rounding_target * 0.09 + articulationTarget.lip_compression_target * 0.32,
      0,
      0.34
    );
    gain *= 1 - labialNarrowing * labialDepth * Math.exp(-0.5 * labialShapeD * labialShapeD);
    return clamp(area * gain, 0.07, 14);
  });
  const smoothedTargets = smoothAreaSeries(targets, 1);
  return targets.map((target, index) => clamp(target * (1 - spatialSmoothing) + smoothedTargets[index] * spatialSmoothing, 0.07, 14));
}

function smoothAreaSeries(values, passes = 1) {
  let current = values.slice();
  for (let pass = 0; pass < passes; pass++) {
    current = current.map((value, index) => {
      const previous = current[Math.max(0, index - 1)];
      const next = current[Math.min(current.length - 1, index + 1)];
      return previous * 0.25 + value * 0.5 + next * 0.25;
    });
  }
  return current;
}

function synthesizeTubeSourceSamples(options) {
  const sampleCount = Math.max(1, Math.round(options.sampleCount ?? 1));
  const sampleRate = Math.max(8000, options.sampleRate ?? PREVIEW_SAMPLE_RATE);
  const out = new Float32Array(sampleCount);
  if (options.sourceMode === "impulse") {
    out[0] = options.impulseAmplitude ?? 1;
    return out;
  }

  const tension = options.tension ?? 1;
  const respiratorySupport = options.respiratorySupport ?? 1;
  const effectiveClosure = options.effectiveClosure ?? 0.55;
  const precision = clamp(options.motorControlPrecision ?? 1, 0.15, 1.4);
  const glottalParams = options.glottalParams
    ?? currentGlottalSourceParams({}, tension);
  const aspirationNoiseScale = clamp(options.aspirationNoiseScale ?? 1, 0, 1);
  const sourceAttackSeconds = Math.max(0, options.sourceAttackSeconds ?? 0.08);
  const sourceReleaseSeconds = Math.max(0, options.sourceReleaseSeconds ?? (0.1 + respiratorySupport * 0.05));
  const sampleRateNoiseScale = Math.sqrt(PREVIEW_REFERENCE_SAMPLE_RATE / sampleRate);
  const tiltAlpha = glottalTiltAlpha(sampleRate, glottalParams.spectral_tilt_db);
  const glottalSourceState = { lastRawFlow: 0, smoothedFlow: 0, lastSmoothedFlow: 0 };
  let glottalTiltState = 0;
  let phase = 0;
  let seed = 1;

  for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex++) {
    const t = sampleIndex / sampleRate;
    const attackEnvelope = sourceAttackSeconds > 0 ? t / sourceAttackSeconds : 1;
    const releaseEnvelope = sourceReleaseSeconds > 0 ? (sampleCount / sampleRate - t) / sourceReleaseSeconds : 1;
    const env = clamp(Math.min(1, attackEnvelope, releaseEnvelope), 0, 1);
    const instability = Math.max(0, 1 - precision) * 0.006;
    const jitterFraction = Math.sin(Math.PI * 2 * t * (4.1 + tension * 1.7)) * instability;
    phase += ((options.f0 ?? 165) * (1 + jitterFraction)) / sampleRate;
    phase -= Math.floor(phase);
    const glottalFlow = lfLikeGlottalFlow(phase, glottalParams);
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const noise = ((seed / 0xffffffff) * 2 - 1)
      * (glottalParams.breathiness + (1 - effectiveClosure) * 0.04)
      * sampleRateNoiseScale
      * aspirationNoiseScale;
    const pressureDrive = Math.min(
      1.35,
      ((options.pressure ?? 900) / 900) * (0.86 + respiratorySupport * 0.14)
    );
    const sourceSample = glottalVolumeVelocitySample(
      glottalFlow,
      glottalSourceState,
      glottalParams,
      effectiveClosure,
      noise,
      0.62,
      { sampleRate }
    );
    glottalTiltState += tiltAlpha * (sourceSample - glottalTiltState);
    out[sampleIndex] = glottalTiltState * env * pressureDrive * 0.145;
  }
  return out;
}

function smoothstep01(value) {
  const t = clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
}

function synthesizeKellyLochbaumTube(areas, options) {
  const count = Math.max(3, areas.length);
  const sampleCount = options.sampleCount;
  const sampleRate = options.sampleRate;
  const out = new Float32Array(sampleCount);
  let right = new Float32Array(count + 1);
  let left = new Float32Array(count + 1);
  let nextRight = new Float32Array(count + 1);
  let nextLeft = new Float32Array(count + 1);
  const reflections = new Float32Array(count);
  const areaTrajectory = options.areaTrajectory;
  const trajectoryStartAreas = areaTrajectory?.start_areas_cm2;
  const trajectoryEndAreas = areaTrajectory?.end_areas_cm2;
  const trajectoryKeyframes = Array.isArray(areaTrajectory?.keyframes)
    ? areaTrajectory.keyframes
      .filter((keyframe) => Array.isArray(keyframe?.areas_cm2) && keyframe.areas_cm2.length >= count)
      .map((keyframe) => ({
        sample: clamp(Math.round(keyframe.sample ?? 0), 0, Math.max(0, sampleCount - 1)),
        areas_cm2: keyframe.areas_cm2,
      }))
      .sort((a, b) => a.sample - b.sample)
    : [];
  const hasKeyframeTrajectory = trajectoryKeyframes.length >= 2;
  const hasLinearTrajectory = Array.isArray(trajectoryStartAreas)
    && Array.isArray(trajectoryEndAreas)
    && trajectoryStartAreas.length >= count
    && trajectoryEndAreas.length >= count;
  const hasAreaTrajectory = hasKeyframeTrajectory || hasLinearTrajectory;
  const trajectoryStartSample = hasLinearTrajectory
    ? clamp(Math.round(areaTrajectory.start_sample ?? 0), 0, Math.max(0, sampleCount - 1))
    : 0;
  const trajectoryEndSample = hasLinearTrajectory
    ? clamp(Math.round(areaTrajectory.end_sample ?? sampleCount - 1), trajectoryStartSample + 1, Math.max(trajectoryStartSample + 1, sampleCount - 1))
    : 0;
  const activeAreas = hasAreaTrajectory ? new Float32Array(count) : areas;
  let lipReflection = -0.8;
  let meanArea = 1;
  const updateTubeGeometry = (sampleIndex = 0) => {
    if (hasKeyframeTrajectory) {
      let leftKeyframe = trajectoryKeyframes[0];
      let rightKeyframe = trajectoryKeyframes[trajectoryKeyframes.length - 1];
      for (let index = 1; index < trajectoryKeyframes.length; index++) {
        if (sampleIndex <= trajectoryKeyframes[index].sample) {
          rightKeyframe = trajectoryKeyframes[index];
          leftKeyframe = trajectoryKeyframes[index - 1];
          break;
        }
        leftKeyframe = trajectoryKeyframes[index];
      }
      const progress = smoothstep01(
        (sampleIndex - leftKeyframe.sample) / Math.max(1, rightKeyframe.sample - leftKeyframe.sample)
      );
      for (let index = 0; index < count; index++) {
        const start = Math.max(0.012, leftKeyframe.areas_cm2[index]);
        const end = Math.max(0.012, rightKeyframe.areas_cm2[index]);
        activeAreas[index] = start + (end - start) * progress;
      }
    } else if (hasLinearTrajectory) {
      const progress = clamp(
        (sampleIndex - trajectoryStartSample) / Math.max(1, trajectoryEndSample - trajectoryStartSample),
        0,
        1
      );
      for (let index = 0; index < count; index++) {
        const start = Math.max(0.012, trajectoryStartAreas[index]);
        const end = Math.max(0.012, trajectoryEndAreas[index]);
        activeAreas[index] = start + (end - start) * progress;
      }
    }
    for (let index = 1; index < count; index++) {
      const a0 = Math.max(0.04, activeAreas[index - 1]);
      const a1 = Math.max(0.04, activeAreas[index]);
      reflections[index] = clamp((a0 - a1) / (a0 + a1), -0.94, 0.94);
    }
    const lipArea = activeAreas[count - 1] ?? 1;
    lipReflection = clamp(-0.92 + Math.min(0.2, lipArea * 0.022), -0.93, -0.66);
    let areaSum = 0;
    for (let index = 0; index < count; index++) areaSum += Math.max(0.05, activeAreas[index]);
    meanArea = areaSum / count;
  };
  updateTubeGeometry(0);
  const glottalReflection = clamp(0.64 + options.effectiveClosure * 0.3, 0.52, 0.96);
  const lossParams = options.lossParams ?? currentTubeLossParams({});
  const lossModel = options.lossModel ?? buildTubeDistributedLossModel(lossParams, sampleRate, count);
  const damping = lossModel.per_section_gain;
  const complianceBaseMix = lossModel.wall_memory_mix;
  const complianceRelaxation = lossModel.wall_memory_relaxation;
  const wallRight = new Float32Array(count + 1);
  const wallLeft = new Float32Array(count + 1);
  let lastMouthFlow = 0;
  let lastOutput = 0;
  let radiationSmoothState = 0;
  const radiationAlpha = sampleRateAdjustedAlpha(clamp(1 - lossParams.lip_radiation_smoothing, 0.08, 1), sampleRate);
  const radiationMemory = sampleRateAdjustedPole(clamp(0.985 - lossParams.high_frequency_damping * 0.12, 0.82, 0.99), sampleRate);
  const outputMemory = sampleRateAdjustedPole(clamp(0.12 + lossParams.high_frequency_damping * 0.12, 0.08, 0.28), sampleRate);
  const sourceSamples = options.sourceSamples?.length >= sampleCount
    ? options.sourceSamples
    : synthesizeTubeSourceSamples(options);
  for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex++) {
    if (hasAreaTrajectory) updateTubeGeometry(sampleIndex);
    nextRight.fill(0);
    nextLeft.fill(0);
    const source = sourceSamples[sampleIndex] ?? 0;
    nextRight[1] += (source + glottalReflection * left[0]) * damping;
    const mouthFlow = (1 - lipReflection) * right[count];
    nextLeft[count - 1] += lipReflection * right[count] * damping;
    for (let junction = 1; junction < count; junction++) {
      const r = reflections[junction];
      const rin = right[junction];
      const lin = left[junction];
      const junctionLoss = damping * (1 - lossModel.discontinuity_loss_scale * Math.abs(r));
      nextLeft[junction - 1] += (r * rin + (1 - r) * lin) * junctionLoss;
      nextRight[junction + 1] += ((1 + r) * rin - r * lin) * junctionLoss;
    }
    applyWallComplianceToTubeState(nextRight, nextLeft, wallRight, wallLeft, activeAreas, meanArea, complianceBaseMix, complianceRelaxation);
    radiationSmoothState += radiationAlpha * (mouthFlow - radiationSmoothState);
    const radiated = (radiationSmoothState - lastMouthFlow * radiationMemory) + lastOutput * outputMemory;
    lastMouthFlow = radiationSmoothState;
    lastOutput = radiated;
    out[sampleIndex] = radiated * 0.68 * (options.amplitude ?? 0.9);
    const swapR = right;
    right = nextRight;
    nextRight = swapR;
    const swapL = left;
    left = nextLeft;
    nextLeft = swapL;
  }
  applyTubeOutputConditioning(out, sampleRate, lossParams);
  return out;
}

function synthesizeBranchedNasalOralTube(oralAreas, nasalAreas, options) {
  const oralCount = Math.max(4, oralAreas.length);
  const nasalCount = Math.max(3, nasalAreas.length);
  const sampleCount = Math.max(1, Math.round(options.sampleCount ?? 1));
  const sampleRate = Math.max(8000, options.sampleRate ?? PREVIEW_SAMPLE_RATE);
  const vpJunction = clamp(
    Math.round((oralCount - 1) * clamp(options.vpJunctionPosition ?? 0.34, 0.12, 0.72)),
    2,
    oralCount - 2
  );
  const requestedContactJunction = Number.isFinite(Number(options.oralContactPosition))
    ? clamp(
      Math.round((oralCount - 1) * clamp(Number(options.oralContactPosition), 0, 1)),
      vpJunction + 1,
      oralCount - 1
    )
    : -1;
  const out = new Float32Array(sampleCount);
  const oralRadiation = new Float32Array(sampleCount);
  const nasalRadiation = new Float32Array(sampleCount);
  let oralRight = new Float32Array(oralCount + 1);
  let oralLeft = new Float32Array(oralCount + 1);
  let nextOralRight = new Float32Array(oralCount + 1);
  let nextOralLeft = new Float32Array(oralCount + 1);
  let nasalRight = new Float32Array(nasalCount + 1);
  let nasalLeft = new Float32Array(nasalCount + 1);
  let nextNasalRight = new Float32Array(nasalCount + 1);
  let nextNasalLeft = new Float32Array(nasalCount + 1);
  const oralReflections = new Float32Array(oralCount);
  const nasalReflections = new Float32Array(nasalCount);
  const activeOralAreas = Float32Array.from(oralAreas, (area) => Math.max(0.006, area));
  const activeNasalAreas = Float32Array.from(nasalAreas, (area) => Math.max(0.012, area));
  const oralTrajectory = Array.isArray(options.areaTrajectory?.keyframes)
    ? options.areaTrajectory.keyframes
      .filter((keyframe) => Array.isArray(keyframe?.areas_cm2) && keyframe.areas_cm2.length >= oralCount)
      .map((keyframe) => ({
        sample: clamp(Math.round(keyframe.sample ?? 0), 0, Math.max(0, sampleCount - 1)),
        areas_cm2: keyframe.areas_cm2,
      }))
      .sort((a, b) => a.sample - b.sample)
    : [];
  const vpTrajectory = Array.isArray(options.velopharyngealAreaTrajectory?.keyframes)
    ? options.velopharyngealAreaTrajectory.keyframes
      .filter((keyframe) => Number.isFinite(Number(keyframe?.area_cm2)))
      .map((keyframe) => ({
        sample: clamp(Math.round(keyframe.sample ?? 0), 0, Math.max(0, sampleCount - 1)),
        area_cm2: Math.max(0.008, Number(keyframe.area_cm2)),
      }))
      .sort((a, b) => a.sample - b.sample)
    : [];
  const interpolateKeyframes = (keyframes, sampleIndex, valueAt) => {
    if (!keyframes.length) return null;
    let leftKeyframe = keyframes[0];
    let rightKeyframe = keyframes[keyframes.length - 1];
    for (let index = 1; index < keyframes.length; index++) {
      if (sampleIndex <= keyframes[index].sample) {
        rightKeyframe = keyframes[index];
        leftKeyframe = keyframes[index - 1];
        break;
      }
      leftKeyframe = keyframes[index];
    }
    const progress = smoothstep01(
      (sampleIndex - leftKeyframe.sample) / Math.max(1, rightKeyframe.sample - leftKeyframe.sample)
    );
    const start = valueAt(leftKeyframe);
    return start + (valueAt(rightKeyframe) - start) * progress;
  };
  let vpPortArea = Math.max(0.008, options.velopharyngealPortAreaCm2 ?? activeNasalAreas[0]);
  let lipReflection = -0.8;
  let noseReflection = -0.78;
  let oralMeanArea = 1;
  let nasalMeanArea = 1;
  let oralContactJunction = -1;
  let oralContactStrength = 0;
  let peakOralContactStrength = 0;
  const updateGeometry = (sampleIndex) => {
    if (oralTrajectory.length >= 2) {
      let leftKeyframe = oralTrajectory[0];
      let rightKeyframe = oralTrajectory[oralTrajectory.length - 1];
      for (let index = 1; index < oralTrajectory.length; index++) {
        if (sampleIndex <= oralTrajectory[index].sample) {
          rightKeyframe = oralTrajectory[index];
          leftKeyframe = oralTrajectory[index - 1];
          break;
        }
        leftKeyframe = oralTrajectory[index];
      }
      const progress = smoothstep01(
        (sampleIndex - leftKeyframe.sample) / Math.max(1, rightKeyframe.sample - leftKeyframe.sample)
      );
      for (let index = 0; index < oralCount; index++) {
        const start = Math.max(0.006, leftKeyframe.areas_cm2[index]);
        const end = Math.max(0.006, rightKeyframe.areas_cm2[index]);
        activeOralAreas[index] = start + (end - start) * progress;
      }
    }
    const interpolatedPortArea = interpolateKeyframes(vpTrajectory, sampleIndex, (keyframe) => keyframe.area_cm2);
    if (interpolatedPortArea !== null) vpPortArea = Math.max(0.008, interpolatedPortArea);
    activeNasalAreas[0] = vpPortArea;
    let oralAreaSum = 0;
    let minimumOralArea = Number.POSITIVE_INFINITY;
    let minimumOralAreaIndex = -1;
    for (let index = 0; index < oralCount; index++) {
      oralAreaSum += Math.max(0.006, activeOralAreas[index]);
      if (index > vpJunction && index < oralCount - 1 && activeOralAreas[index] < minimumOralArea) {
        minimumOralArea = activeOralAreas[index];
        minimumOralAreaIndex = index;
      }
      if (index === 0) continue;
      const a0 = Math.max(0.006, activeOralAreas[index - 1]);
      const a1 = Math.max(0.006, activeOralAreas[index]);
      oralReflections[index] = clamp((a0 - a1) / (a0 + a1), -0.995, 0.995);
    }
    oralContactJunction = requestedContactJunction >= 0 ? requestedContactJunction : minimumOralAreaIndex;
    const contactArea = oralContactJunction >= 0
      ? activeOralAreas[oralContactJunction]
      : minimumOralArea;
    oralContactStrength = oralContactJunction >= 0
      ? 1 - smoothstep01((contactArea - 0.006) / 0.044)
      : 0;
    peakOralContactStrength = Math.max(peakOralContactStrength, oralContactStrength);
    let nasalAreaSum = 0;
    for (let index = 0; index < nasalCount; index++) {
      nasalAreaSum += Math.max(0.04, activeNasalAreas[index]);
      if (index === 0) continue;
      const a0 = Math.max(0.04, activeNasalAreas[index - 1]);
      const a1 = Math.max(0.04, activeNasalAreas[index]);
      nasalReflections[index] = clamp((a0 - a1) / (a0 + a1), -0.94, 0.94);
    }
    oralMeanArea = oralAreaSum / oralCount;
    nasalMeanArea = nasalAreaSum / nasalCount;
    const lipArea = activeOralAreas[oralCount - 1] ?? 1;
    const nostrilArea = activeNasalAreas[nasalCount - 1] ?? 1;
    lipReflection = clamp(-0.92 + Math.min(0.2, lipArea * 0.022), -0.93, -0.66);
    noseReflection = clamp(-0.88 + Math.min(0.16, nostrilArea * 0.018), -0.9, -0.7);
  };
  updateGeometry(0);

  const glottalReflection = clamp(0.64 + options.effectiveClosure * 0.3, 0.52, 0.96);
  const lossParams = options.lossParams ?? currentTubeLossParams({});
  const oralLossModel = options.lossModel ?? buildTubeDistributedLossModel(lossParams, sampleRate, oralCount);
  const nasalLossModel = buildTubeDistributedLossModel(lossParams, sampleRate, nasalCount);
  const oralDamping = oralLossModel.per_section_gain;
  const nasalDampingControl = clamp(options.nasalBranchDamping ?? 0.74, 0.3, 1.4);
  const nasalDamping = clamp(
    Math.pow(nasalLossModel.per_section_gain, 0.9) * Math.exp(-0.002 - 0.004 * nasalDampingControl),
    0.9,
    0.9998
  );
  const nasalWallMemoryMix = clamp(
    nasalLossModel.wall_memory_mix * 1.8 + 0.012 + nasalDampingControl * 0.028,
    0.016,
    0.075
  );
  const nasalWallMemoryRelaxation = sampleRateAdjustedAlpha(
    clamp(0.11 + nasalDampingControl * 0.07, 0.1, 0.24),
    sampleRate
  );
  const nasalRadiationScale = clamp(options.nasalRadiationScale ?? 0.3, 0.08, 0.72);
  const oralWallRight = new Float32Array(oralCount + 1);
  const oralWallLeft = new Float32Array(oralCount + 1);
  const nasalWallRight = new Float32Array(nasalCount + 1);
  const nasalWallLeft = new Float32Array(nasalCount + 1);
  const sourceSamples = options.sourceSamples?.length >= sampleCount
    ? options.sourceSamples
    : synthesizeTubeSourceSamples(options);
  const radiationAlpha = sampleRateAdjustedAlpha(clamp(1 - lossParams.lip_radiation_smoothing, 0.08, 1), sampleRate);
  const oralRadiationMemory = sampleRateAdjustedPole(clamp(0.985 - lossParams.high_frequency_damping * 0.12, 0.82, 0.99), sampleRate);
  const nasalRadiationMemory = sampleRateAdjustedPole(clamp(0.988 - lossParams.high_frequency_damping * 0.1, 0.84, 0.992), sampleRate);
  const outputMemory = sampleRateAdjustedPole(clamp(0.12 + lossParams.high_frequency_damping * 0.12, 0.08, 0.28), sampleRate);
  let oralFlowState = 0;
  let nasalFlowState = 0;
  let previousOralFlow = 0;
  let previousNasalFlow = 0;
  let previousOralOutput = 0;
  let previousNasalOutput = 0;
  let peakVpPortArea = vpPortArea;
  let minimumVpPortArea = vpPortArea;

  for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex++) {
    updateGeometry(sampleIndex);
    peakVpPortArea = Math.max(peakVpPortArea, vpPortArea);
    minimumVpPortArea = Math.min(minimumVpPortArea, vpPortArea);
    nextOralRight.fill(0);
    nextOralLeft.fill(0);
    nextNasalRight.fill(0);
    nextNasalLeft.fill(0);
    const source = sourceSamples[sampleIndex] ?? 0;
    nextOralRight[1] += (source + glottalReflection * oralLeft[0]) * oralDamping;

    const mouthFlow = (1 - lipReflection)
      * oralRight[oralCount]
      * Math.max(0.006, activeOralAreas[oralCount - 1]);
    nextOralLeft[oralCount - 1] += lipReflection * oralRight[oralCount] * oralDamping;
    const noseFlow = (1 - noseReflection)
      * nasalRight[nasalCount]
      * Math.max(0.04, activeNasalAreas[nasalCount - 1]);
    nextNasalLeft[nasalCount - 1] += noseReflection * nasalRight[nasalCount] * nasalDamping;

    for (let junction = 1; junction < oralCount; junction++) {
      if (junction === vpJunction) continue;
      const reflection = oralReflections[junction];
      const incomingRight = oralRight[junction];
      const incomingLeft = oralLeft[junction];
      const junctionLoss = oralDamping * (1 - oralLossModel.discontinuity_loss_scale * Math.abs(reflection));
      const normalLeft = reflection * incomingRight + (1 - reflection) * incomingLeft;
      const normalRight = (1 + reflection) * incomingRight - reflection * incomingLeft;
      const contactMix = junction === oralContactJunction ? oralContactStrength : 0;
      nextOralLeft[junction - 1] += (
        normalLeft * (1 - contactMix) + incomingRight * contactMix
      ) * junctionLoss;
      nextOralRight[junction + 1] += (
        normalRight * (1 - contactMix) + incomingLeft * contactMix
      ) * junctionLoss;
    }
    for (let junction = 1; junction < nasalCount; junction++) {
      const reflection = nasalReflections[junction];
      const incomingRight = nasalRight[junction];
      const incomingLeft = nasalLeft[junction];
      const junctionLoss = nasalDamping * (1 - nasalLossModel.discontinuity_loss_scale * Math.abs(reflection));
      nextNasalLeft[junction - 1] += (reflection * incomingRight + (1 - reflection) * incomingLeft) * junctionLoss;
      nextNasalRight[junction + 1] += ((1 + reflection) * incomingRight - reflection * incomingLeft) * junctionLoss;
    }

    const commonAdmittance = Math.max(0.006, activeOralAreas[vpJunction - 1]);
    const oralAdmittance = Math.max(0.006, activeOralAreas[vpJunction]);
    const nasalAdmittance = Math.max(0.008, vpPortArea);
    const incomingCommon = oralRight[vpJunction];
    const incomingOral = oralLeft[vpJunction];
    const incomingNasal = nasalLeft[0];
    const junctionPressure = 2 * (
      commonAdmittance * incomingCommon
      + oralAdmittance * incomingOral
      + nasalAdmittance * incomingNasal
    ) / Math.max(0.032, commonAdmittance + oralAdmittance + nasalAdmittance);
    const branchLoss = Math.min(oralDamping, nasalDamping);
    nextOralLeft[vpJunction - 1] += (junctionPressure - incomingCommon) * branchLoss;
    nextOralRight[vpJunction + 1] += (junctionPressure - incomingOral) * branchLoss;
    nextNasalRight[1] += (junctionPressure - incomingNasal) * branchLoss;

    applyWallComplianceToTubeState(
      nextOralRight,
      nextOralLeft,
      oralWallRight,
      oralWallLeft,
      activeOralAreas,
      oralMeanArea,
      oralLossModel.wall_memory_mix,
      oralLossModel.wall_memory_relaxation
    );
    applyWallComplianceToTubeState(
      nextNasalRight,
      nextNasalLeft,
      nasalWallRight,
      nasalWallLeft,
      activeNasalAreas,
      nasalMeanArea,
      nasalWallMemoryMix,
      nasalWallMemoryRelaxation
    );

    oralFlowState += radiationAlpha * (mouthFlow - oralFlowState);
    nasalFlowState += radiationAlpha * 0.82 * (noseFlow - nasalFlowState);
    const mouthRadiated = (oralFlowState - previousOralFlow * oralRadiationMemory) + previousOralOutput * outputMemory;
    const noseRadiated = (nasalFlowState - previousNasalFlow * nasalRadiationMemory) + previousNasalOutput * outputMemory;
    previousOralFlow = oralFlowState;
    previousNasalFlow = nasalFlowState;
    previousOralOutput = mouthRadiated;
    previousNasalOutput = noseRadiated;
    oralRadiation[sampleIndex] = mouthRadiated;
    nasalRadiation[sampleIndex] = noseRadiated;
    out[sampleIndex] = (mouthRadiated * 0.68 + noseRadiated * nasalRadiationScale) * (options.amplitude ?? 0.9);

    [oralRight, nextOralRight] = [nextOralRight, oralRight];
    [oralLeft, nextOralLeft] = [nextOralLeft, oralLeft];
    [nasalRight, nextNasalRight] = [nextNasalRight, nasalRight];
    [nasalLeft, nextNasalLeft] = [nextNasalLeft, nasalLeft];
  }
  applyTubeOutputConditioning(out, sampleRate, lossParams);
  return {
    samples: out,
    oral_radiation: oralRadiation,
    nasal_radiation: nasalRadiation,
    topology: {
      schema_version: "branched_nasal_oral_waveguide_0.2",
      scattering: "lossy_three_port_pressure_junction",
      vp_junction_index: vpJunction,
      vp_junction_position: Number((vpJunction / Math.max(1, oralCount - 1)).toFixed(4)),
      oral_section_count: oralCount,
      nasal_section_count: nasalCount,
      peak_vp_port_area_cm2: Number(peakVpPortArea.toFixed(5)),
      minimum_vp_port_area_cm2: Number(minimumVpPortArea.toFixed(5)),
      nasal_radiation_scale: Number(nasalRadiationScale.toFixed(5)),
      nasal_wall_memory_mix: Number(nasalWallMemoryMix.toFixed(6)),
      nasal_wall_memory_relaxation: Number(nasalWallMemoryRelaxation.toFixed(6)),
      nasal_per_section_gain: Number(nasalDamping.toFixed(7)),
      oral_contact_boundary: "continuous rigid-contact blend below 0.05 cm2",
      requested_oral_contact_junction: requestedContactJunction,
      requested_oral_contact_position: requestedContactJunction >= 0
        ? Number((requestedContactJunction / Math.max(1, oralCount - 1)).toFixed(4))
        : null,
      peak_oral_contact_strength: Number(peakOralContactStrength.toFixed(6)),
      oral_and_nasal_radiation_summed_once: true,
      shared_glottal_source: true,
    },
  };
}

function buildTubeDistributedLossModel(lossParams, sampleRate, tubeCount) {
  const count = Math.max(1, tubeCount);
  const sectionLengthCm = 35000 / sampleRate;
  const tractLengthCm = sectionLengthCm * count;
  const referenceLengthCm = 15.5;
  const referenceSectionLengthCm = 35000 / PREVIEW_REFERENCE_SAMPLE_RATE;
  const sectionLengthScale = sectionLengthCm / referenceSectionLengthCm;
  const oneWayLossNpAtReference =
    lossParams.wall_loss * 0.9
    + lossParams.viscothermal_loss * 1.25
    + lossParams.resonance_broadening * 0.065;
  const oneWayLossNp = oneWayLossNpAtReference * (tractLengthCm / referenceLengthCm);
  const perSectionGain = Math.exp(-oneWayLossNp / count);
  return {
    schema_version: "tube_distributed_loss_0.1",
    section_length_cm: Number(sectionLengthCm.toFixed(6)),
    tract_length_cm: Number(tractLengthCm.toFixed(4)),
    per_section_gain: perSectionGain,
    one_way_loss_db: Number((-8.685889638 * oneWayLossNp).toFixed(4)),
    round_trip_distributed_loss_db: Number((-17.371779276 * oneWayLossNp).toFixed(4)),
    discontinuity_loss_scale: clamp(lossParams.viscothermal_loss * 0.035 * sectionLengthScale, 0, 0.012),
    wall_memory_mix: clamp(lossParams.wall_compliance * 0.018 * sectionLengthScale, 0, 0.018),
    wall_memory_relaxation: sampleRateAdjustedAlpha(
      clamp(0.08 + lossParams.wall_compliance * 0.2 + lossParams.viscothermal_loss * 0.4, 0.06, 0.28),
      sampleRate
    ),
    basis: "length-normalized lightweight distributed loss; controls are no longer reapplied as full loss at every tube section",
  };
}

function analyzeTubeTransfer(vowel = selectedVowel(), options = {}) {
  const sampleRate = options.sampleRate ?? PREVIEW_SAMPLE_RATE;
  const constraints = options.constraints ?? state.constraints;
  const geometry = options.geometry ?? state.vocalTractGeometry ?? buildVocalTractGeometry();
  const motorProfile = options.motorProfile ?? currentArticulationMotorProfile(constraints);
  const areaFunction = options.areaFunction ?? buildTubeAreaFunction(geometry, vowel, sampleRate, motorProfile);
  const glottalParams = currentGlottalSourceParams(constraints, 1);
  const effectiveClosure = glottalClosureProxyFromOpenQuotient(glottalParams.open_quotient);
  const lossParams = currentTubeLossParams(constraints);
  const distributedLossModel = buildTubeDistributedLossModel(lossParams, sampleRate, areaFunction.areas_cm2.length);
  const impulse = synthesizeKellyLochbaumTube(areaFunction.areas_cm2, {
    sampleCount: options.sampleCount ?? 8192,
    sampleRate,
    sourceMode: "impulse",
    impulseAmplitude: 1,
    f0: 0,
    pressure: 900,
    effectiveClosure,
    respiratorySupport: 1,
    tension: 1,
    amplitude: 1,
    motorControlPrecision: motorProfile.motor_control_precision,
    glottalParams,
    lossParams,
    lossModel: distributedLossModel,
  });
  const spectrum = sampledMagnitudeSpectrum(
    impulse,
    sampleRate,
    options.minFrequency ?? 120,
    options.maxFrequency ?? 4500,
    options.frequencyStep ?? 10
  );
  return {
    schema_version: "tube_transfer_analysis_0.1",
    vowel,
    area_function: areaFunction,
    distributed_loss_model: distributedLossModel,
    resonances: selectResonancePeaks(spectrum, options.minimumPeakSpacingHz ?? 260, options.maxPeaks ?? 5),
    spectrum,
  };
}

function sampledMagnitudeSpectrum(samples, sampleRate, minFrequency, maxFrequency, frequencyStep) {
  const spectrum = [];
  const step = Math.max(2, frequencyStep);
  for (let frequency = minFrequency; frequency <= maxFrequency; frequency += step) {
    const omega = 2 * Math.PI * frequency / sampleRate;
    const coefficient = 2 * Math.cos(omega);
    let s1 = 0;
    let s2 = 0;
    for (let index = 0; index < samples.length; index++) {
      const s0 = samples[index] + coefficient * s1 - s2;
      s2 = s1;
      s1 = s0;
    }
    const power = Math.max(1e-24, s1 * s1 + s2 * s2 - coefficient * s1 * s2);
    spectrum.push({ frequency_hz: frequency, level_db: 10 * Math.log10(power) });
  }
  const maxLevel = Math.max(...spectrum.map((point) => point.level_db));
  return spectrum.map((point) => ({
    frequency_hz: point.frequency_hz,
    level_db: Number((point.level_db - maxLevel).toFixed(3)),
  }));
}

function selectResonancePeaks(spectrum, minimumSpacingHz, maxPeaks) {
  const smoothed = spectrum.map((point, index) => {
    const start = Math.max(0, index - 2);
    const end = Math.min(spectrum.length, index + 3);
    let total = 0;
    for (let cursor = start; cursor < end; cursor++) total += spectrum[cursor].level_db;
    return { frequency_hz: point.frequency_hz, level_db: total / (end - start), index };
  });
  const candidates = [];
  for (let index = 1; index < smoothed.length - 1; index++) {
    const point = smoothed[index];
    if (point.level_db < smoothed[index - 1].level_db || point.level_db <= smoothed[index + 1].level_db) continue;
    const shoulderBins = Math.max(2, Math.round(180 / Math.max(1, spectrum[1].frequency_hz - spectrum[0].frequency_hz)));
    let leftFloor = point.level_db;
    let rightFloor = point.level_db;
    for (let cursor = Math.max(0, index - shoulderBins); cursor < index; cursor++) leftFloor = Math.min(leftFloor, smoothed[cursor].level_db);
    for (let cursor = index + 1; cursor <= Math.min(smoothed.length - 1, index + shoulderBins); cursor++) rightFloor = Math.min(rightFloor, smoothed[cursor].level_db);
    const halfPowerLevel = point.level_db - 3;
    let lowerIndex = index;
    let upperIndex = index;
    while (lowerIndex > 0 && smoothed[lowerIndex].level_db > halfPowerLevel) lowerIndex -= 1;
    while (upperIndex < smoothed.length - 1 && smoothed[upperIndex].level_db > halfPowerLevel) upperIndex += 1;
    candidates.push({
      frequency_hz: point.frequency_hz,
      level_db: Number(point.level_db.toFixed(3)),
      prominence_db: Number((point.level_db - Math.max(leftFloor, rightFloor)).toFixed(3)),
      bandwidth_3db_hz: smoothed[lowerIndex].level_db <= halfPowerLevel && smoothed[upperIndex].level_db <= halfPowerLevel
        ? smoothed[upperIndex].frequency_hz - smoothed[lowerIndex].frequency_hz
        : null,
    });
  }
  const selected = [];
  for (const candidate of candidates.sort((a, b) => b.prominence_db - a.prominence_db || b.level_db - a.level_db)) {
    if (selected.some((peak) => Math.abs(peak.frequency_hz - candidate.frequency_hz) < minimumSpacingHz)) continue;
    selected.push(candidate);
    if (selected.length >= maxPeaks) break;
  }
  return selected.sort((a, b) => a.frequency_hz - b.frequency_hz);
}

function applyWallComplianceToTubeState(nextRight, nextLeft, wallRight, wallLeft, areas, meanArea, complianceBaseMix, complianceRelaxation) {
  if (complianceBaseMix <= 0) return;
  const count = areas.length;
  for (let waveIndex = 1; waveIndex <= count; waveIndex++) {
    const area = Math.max(0.05, areas[Math.min(count - 1, Math.max(0, waveIndex - 1))] ?? meanArea);
    const narrowness = clamp(Math.sqrt(meanArea / area), 0.55, 1.8);
    const complianceMix = clamp(complianceBaseMix * narrowness, 0, 0.34);
    wallRight[waveIndex] += complianceRelaxation * (nextRight[waveIndex] - wallRight[waveIndex]);
    wallLeft[waveIndex] += complianceRelaxation * (nextLeft[waveIndex] - wallLeft[waveIndex]);
    nextRight[waveIndex] = nextRight[waveIndex] * (1 - complianceMix) + wallRight[waveIndex] * complianceMix;
    nextLeft[waveIndex] = nextLeft[waveIndex] * (1 - complianceMix) + wallLeft[waveIndex] * complianceMix;
  }
}

function applyTubeOutputConditioning(samples, sampleRate, lossParams) {
  const wallCompliance = clamp(lossParams.wall_compliance ?? 0, 0, 1);
  const highDamping = clamp(lossParams.high_frequency_damping ?? 0, 0, 1);
  const smoothingMix = clamp(highDamping * 0.08 + wallCompliance * 0.025, 0, 0.18);
  if (smoothingMix > 0.001) {
    const cutoff = clamp(9000 - highDamping * 3500 - wallCompliance * 900, 4800, 9200);
    applyOnePoleLowpassBlend(samples, sampleRate, cutoff, smoothingMix);
  }
  const warmthMix = clamp(wallCompliance * 0.018, 0, 0.025);
  if (warmthMix > 0.001) {
    applyOnePoleLowpassBlend(samples, sampleRate, 1450, warmthMix);
  }
}

function buildSideBranchLossModel(constraints, vowel, geometry = null, areaFunction = null, options = {}) {
  const applicationStrength = clamp(options.strength ?? 1, 0, 1.5);
  const excludedBranches = new Set(Array.isArray(options.excludeBranches) ? options.excludeBranches : []);
  const volume = constraints.paranasal_sinus_volume_cm3?.center ?? 24;
  const neckArea = constraints.sinus_neck_area_cm2?.center ?? 0.24;
  const neckLength = constraints.sinus_neck_length_cm?.center ?? 1.2;
  const sinusCoupling = clamp(constraints.sinus_coupling?.center ?? 0, 0, 1);
  const damping = constraints.sinus_damping?.center ?? 0.68;
  const vowelNasalFactor = vowel === "i" || vowel === "u" ? 0.72 : 1;
  const nasalVolume = clamp(constraints.nasal_cavity_volume_cm3?.center ?? 20, 5, 50);
  const nasalDamping = clamp(constraints.nasal_branch_damping?.center ?? 0.72, 0.2, 1.6);
  const vp = geometry?.side_branch_guides?.velopharyngeal_port ?? {};
  const vpGapHint = Number.isFinite(vp.open_coupling_hint) ? vp.open_coupling_hint : 0.14;
  const vpGapCm = Number.isFinite(vp.gap_cm) ? vp.gap_cm : null;
  const vpControl = clamp(constraints.velopharyngeal_loss_coupling?.center ?? 0.14, 0, 0.75);
  const areaDescriptor = areaFunctionDescriptor(areaFunction);
  const tractLength = areaFunction?.vocal_tract_length_cm ?? constraints.vocal_tract_length_cm?.center ?? 15.5;
  const piriformControl = clamp(constraints.piriform_fossa_loss_coupling?.center ?? 0.14, 0, 0.65);
  const piriformFrequency = clamp(constraints.piriform_fossa_frequency_hz?.center ?? 3700 * Math.pow(15.5 / tractLength, 0.42), 2200, 5200);
  const laryngealNarrowness = clamp((1.10 - areaDescriptor.laryngeal.mean) / 1.10, 0, 1);
  const branches = [];

  const c = 34300;
  if (sinusCoupling >= 0.01 && volume > 0 && neckArea > 0 && neckLength > 0) {
    const helmholtz = c / (2 * Math.PI) * Math.sqrt(neckArea / (volume * neckLength));
    const notchFrequency = clamp(helmholtz, 380, 1450);
    const peakFrequency = clamp(notchFrequency * 1.55, 700, 2600);
    const q = clamp(3.8 / damping, 1.2, 8);
    const effectiveCoupling = clamp(sinusCoupling * vowelNasalFactor, 0, 1);
    branches.push({
      key: "paranasal_sinus_peak",
      branch: "paranasal_sinus",
      filter: "peaking",
      frequency_hz: roundMetric(peakFrequency, 2),
      q: roundMetric(q * 0.7, 3),
      gain_db: roundMetric(4.5 * effectiveCoupling * applicationStrength, 3),
      basis: "Helmholtz side-branch peak paired with sinus antiresonance",
    });
    branches.push({
      key: "paranasal_sinus_antiresonance",
      branch: "paranasal_sinus",
      filter: "peaking",
      frequency_hz: roundMetric(notchFrequency, 2),
      q: roundMetric(q, 3),
      gain_db: roundMetric(-14 * effectiveCoupling * applicationStrength, 3),
      basis: "Helmholtz side-branch notch from sinus volume/neck proxy",
    });
  }

  const vpCoupling = clamp(vpControl * (0.55 + vpGapHint * 0.75) * vowelNasalFactor, 0, 0.75);
  if (vpCoupling >= 0.01) {
    const nasalAntiresonance = clamp(310 + nasalVolume * 10.5 + (vpGapCm ?? 0.14) * 260, 340, 1050);
    const nasalMurmur = clamp(nasalAntiresonance * 0.58, 180, 620);
    const q = clamp(2.6 / nasalDamping, 0.75, 5.8);
    branches.push({
      key: "velopharyngeal_nasal_murmur",
      branch: "velopharyngeal_nasal",
      filter: "peaking",
      frequency_hz: roundMetric(nasalMurmur, 2),
      q: roundMetric(q * 0.62, 3),
      gain_db: roundMetric(2.2 * vpCoupling * applicationStrength, 3),
      basis: "low nasal side-branch emphasis from velopharyngeal coupling proxy",
    });
    branches.push({
      key: "velopharyngeal_nasal_antiresonance",
      branch: "velopharyngeal_nasal",
      filter: "peaking",
      frequency_hz: roundMetric(nasalAntiresonance, 2),
      q: roundMetric(q, 3),
      gain_db: roundMetric(-11.5 * vpCoupling * applicationStrength, 3),
      basis: "nasal side-branch antiresonance guided by the manually placed velopharyngeal gap",
    });
    branches.push({
      key: "velopharyngeal_broad_loss",
      branch: "velopharyngeal_nasal",
      filter: "lowpass_blend",
      cutoff_hz: roundMetric(clamp(5200 - vpCoupling * 2100 - nasalDamping * 260, 2600, 6200), 2),
      mix: roundMetric(clamp(vpCoupling * 0.14 * applicationStrength, 0, 0.22), 4),
      basis: "broad high-frequency loss for nasal-leak preview",
    });
  }

  const piriformCoupling = clamp(piriformControl * (0.86 + laryngealNarrowness * 0.38), 0, 0.7);
  if (piriformCoupling >= 0.01) {
    branches.push({
      key: "piriform_fossa_antiresonance",
      branch: "piriform_fossa",
      filter: "peaking",
      frequency_hz: roundMetric(piriformFrequency, 2),
      q: roundMetric(clamp(2.4 + laryngealNarrowness * 1.2, 1.2, 5.0), 3),
      gain_db: roundMetric(-9 * piriformCoupling * applicationStrength, 3),
      basis: "high-frequency piriform-fossa side-branch antiresonance preview",
    });
  }

  return {
    schema_version: "side_branch_loss_model_0.1",
    source_role: "lightweight browser-preview coloring; not a subject-specific anatomical side-branch solver",
    controls: {
      sinus_coupling: roundMetric(sinusCoupling, 4),
      velopharyngeal_coupling: roundMetric(vpControl, 4),
      piriform_fossa_coupling: roundMetric(piriformControl, 4),
      nasal_branch_damping: roundMetric(nasalDamping, 4),
      application_strength: roundMetric(applicationStrength, 4),
    },
    geometry_hints: {
      velopharyngeal_gap_cm: roundMetric(vpGapCm, 4),
      velopharyngeal_open_coupling_hint: roundMetric(vpGapHint, 4),
      tract_length_cm: roundMetric(tractLength, 4),
      laryngeal_narrowness: roundMetric(laryngealNarrowness, 4),
    },
    excluded_branches: [...excludedBranches],
    branches: branches.filter((branch) => !excludedBranches.has(branch.branch)),
  };
}

function applySideBranchLosses(samples, sampleRate, constraints, vowel, geometry = null, areaFunction = null, options = {}) {
  const model = buildSideBranchLossModel(constraints, vowel, geometry, areaFunction, options);
  for (const branch of model.branches) {
    if (branch.filter === "peaking" && Math.abs(branch.gain_db ?? 0) > 0.01) {
      applyBiquadInPlace(samples, makeBiquad("peaking", branch.frequency_hz, branch.q, branch.gain_db, sampleRate));
    } else if (branch.filter === "lowpass_blend" && (branch.mix ?? 0) > 0.001) {
      applyOnePoleLowpassBlend(samples, sampleRate, branch.cutoff_hz, branch.mix);
    }
  }
  return model;
}

function applyBodyResonance(samples, sampleRate, constraints) {
  const coupling = clamp(constraints.body_resonance_coupling?.center ?? 0, 0, 1);
  const frequency = currentBodyResonanceFrequency(constraints);
  const gainDb = clamp(constraints.body_resonance_gain_db?.center ?? 4, 0, 12);
  const q = 1.3;
  if (coupling < 0.01 || gainDb < 0.01) return { frequency_hz: frequency, gain_db: gainDb, coupling, q };
  const wet = Float32Array.from(samples);
  applyBiquadInPlace(wet, makeBiquad("peaking", frequency, q, gainDb, sampleRate));
  for (let index = 0; index < samples.length; index++) {
    samples[index] = samples[index] * (1 - coupling) + wet[index] * coupling;
  }
  return { frequency_hz: frequency, gain_db: gainDb, coupling, q, topology: "parallel_wet_dry_branch" };
}

function constraintRatioToReference(constraints, key) {
  const item = constraints?.[key];
  const center = Number(item?.center);
  const reference = Number(item?.statistics?.reference_center);
  if (!Number.isFinite(center) || !Number.isFinite(reference) || Math.abs(reference) < 0.0001) return null;
  return clamp(center / reference, 0.35, 2.5);
}

function meanAvailable(values, fallback = 1) {
  const available = values.filter(Number.isFinite);
  if (!available.length) return fallback;
  return available.reduce((sum, value) => sum + value, 0) / available.length;
}

function structuralVentilationCapacityFromVolumes(constraints, derivation) {
  const thoracic = constraintCenter(constraints, "thoracic_volume_l", derivation.thoracic_reference_l);
  const abdominal = constraintCenter(constraints, "abdominal_volume_l", derivation.abdominal_reference_l);
  const structuralRatio = derivation.thoracic_weight * thoracic / derivation.thoracic_reference_l
    + derivation.abdominal_weight * abdominal / derivation.abdominal_reference_l;
  return derivation.reference_capacity_l_min * structuralRatio;
}

function derivedMaximumVentilationFromVolumes(constraints) {
  const item = constraints?.maximum_ventilation_l_min;
  const derivation = item?.derivation;
  if (!derivation) return constraintCenter(constraints, "maximum_ventilation_l_min", 100);
  const structuralCeiling = structuralVentilationCapacityFromVolumes(constraints, derivation);
  return clamp(Math.min(derivation.unconstrained_estimate_l_min, structuralCeiling), 20, 260);
}

function effectiveMaximumVentilation(constraints) {
  const item = constraints?.maximum_ventilation_l_min;
  return item?.user_override
    ? clamp(Number(item.center), 20, 260)
    : derivedMaximumVentilationFromVolumes(constraints);
}

function currentRespiratoryProfile(constraints) {
  const maximumVentilation = effectiveMaximumVentilation(constraints);
  const ventilationItem = constraints?.maximum_ventilation_l_min;
  const ventilationReference = Number(ventilationItem?.derivation?.reference_capacity_l_min)
    || Number(ventilationItem?.statistics?.reference_center)
    || maximumVentilation;
  const ventilationRatio = clamp(maximumVentilation / Math.max(1, ventilationReference), 0.45, 1.8);
  const volumeRatio = meanAvailable([
    constraintRatioToReference(constraints, "predicted_vc_l"),
    constraintRatioToReference(constraints, "predicted_fvc_l"),
  ]);
  const airflowRatio = meanAvailable([
    constraintRatioToReference(constraints, "predicted_fev1_l"),
    constraintRatioToReference(constraints, "predicted_pef_l_s"),
  ]);
  const utilization = clamp(constraintCenter(constraints, "respiratory_support", 1), 0.4, 1.6);
  const capacityRatio = clamp(ventilationRatio * 0.45 + volumeRatio * 0.25 + airflowRatio * 0.30, 0.5, 1.55);
  const effectiveSupport = clamp(utilization * capacityRatio, 0.45, 1.65);
  const maximumPressure = clamp(constraintCenter(constraints, "maximum_respiratory_pressure_pa", 900), 100, 5000);
  const effectivePressure = maximumPressure
    * clamp(0.84 + airflowRatio * 0.16, 0.7, 1.2)
    * clamp(0.85 + utilization * 0.15, 0.75, 1.2);
  const durationRatio = clamp(0.72 + volumeRatio * 0.18 + ventilationRatio * 0.10, 0.72, 1.25);
  return {
    schema_version: "respiratory_drive_0.1",
    maximum_ventilation_l_min: Number(maximumVentilation.toFixed(4)),
    ventilation_ratio: Number(ventilationRatio.toFixed(4)),
    volume_ratio: Number(volumeRatio.toFixed(4)),
    airflow_ratio: Number(airflowRatio.toFixed(4)),
    capacity_ratio: Number(capacityRatio.toFixed(4)),
    support_utilization: Number(utilization.toFixed(4)),
    effective_support: Number(effectiveSupport.toFixed(4)),
    maximum_pressure_pa: Number(maximumPressure.toFixed(4)),
    effective_pressure_pa: Number(effectivePressure.toFixed(4)),
    duration_ratio: Number(durationRatio.toFixed(4)),
  };
}

function currentRespiratorySupport(constraints) {
  return currentRespiratoryProfile(constraints).effective_support;
}

function bodyResonanceFrequencyFromThoracicVolume(constraints) {
  const sex = sexClass();
  const thoracicBase = sex === "male" ? 6.0 : sex === "female" ? 4.6 : 5.3;
  const thoracic = constraints.thoracic_volume_l?.center ?? thoracicBase;
  return clamp(210 / Math.pow(thoracic / thoracicBase, 0.38), 120, 320);
}

function currentBodyResonanceFrequency(constraints) {
  return clamp(constraintCenter(constraints, "body_resonance_frequency_hz", bodyResonanceFrequencyFromThoracicVolume(constraints)), 120, 320);
}

function makeBiquad(type, frequency, q, gainDb, sampleRate) {
  const omega = 2 * Math.PI * clamp(frequency, 20, sampleRate * 0.45) / sampleRate;
  const alpha = Math.sin(omega) / (2 * Math.max(0.05, q));
  const cosw = Math.cos(omega);
  const a = Math.pow(10, gainDb / 40);
  let b0;
  let b1;
  let b2;
  let a0;
  let a1;
  let a2;
  if (type === "peaking") {
    b0 = 1 + alpha * a;
    b1 = -2 * cosw;
    b2 = 1 - alpha * a;
    a0 = 1 + alpha / a;
    a1 = -2 * cosw;
    a2 = 1 - alpha / a;
  } else {
    b0 = 1;
    b1 = -2 * cosw;
    b2 = 1;
    a0 = 1 + alpha;
    a1 = -2 * cosw;
    a2 = 1 - alpha;
  }
  return {
    b0: b0 / a0,
    b1: b1 / a0,
    b2: b2 / a0,
    a1: a1 / a0,
    a2: a2 / a0,
  };
}

function applyBiquadInPlace(samples, coeffs) {
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  for (let i = 0; i < samples.length; i++) {
    const x0 = samples[i];
    const y0 = coeffs.b0 * x0 + coeffs.b1 * x1 + coeffs.b2 * x2 - coeffs.a1 * y1 - coeffs.a2 * y2;
    samples[i] = y0;
    x2 = x1;
    x1 = x0;
    y2 = y1;
    y1 = y0;
  }
}

function applyOnePoleLowpassBlend(samples, sampleRate, cutoffHz, mix) {
  const blend = clamp(mix, 0, 1);
  if (blend <= 0) return;
  const cutoff = clamp(cutoffHz, 60, sampleRate * 0.45);
  const alpha = 1 - Math.exp((-2 * Math.PI * cutoff) / sampleRate);
  let state = samples[0] ?? 0;
  for (let index = 0; index < samples.length; index++) {
    state += alpha * (samples[index] - state);
    samples[index] = samples[index] * (1 - blend) + state * blend;
  }
}

function normalize(samples, peak) {
  let max = 0;
  for (const s of samples) max = Math.max(max, Math.abs(s));
  if (max < 1e-6) return;
  const gain = peak / max;
  for (let i = 0; i < samples.length; i++) samples[i] *= gain;
}

async function playVowel() {
  if (!Object.keys(state.constraints).length) analyze();
  const audio = synthesizeVowel();
  state.lastWav = encodeWav(audio.samples, audio.sampleRate);
  await playAudioSamples(audio.samples, audio.sampleRate);
}

async function playAudioSamples(samples, sampleRate) {
  const context = new AudioContext({ sampleRate });
  const buffer = context.createBuffer(1, samples.length, sampleRate);
  buffer.copyToChannel(samples, 0);
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.connect(context.destination);
  source.start();
}

async function playVowelCalibrationVariant(manualTuning) {
  if (!Object.keys(state.constraints).length) analyze();
  const vowel = selectedVowel();
  const audio = synthesizeVowel(vowel, { manualTuning });
  await playAudioSamples(audio.samples, audio.sampleRate);
}

async function playNasalCalibrationVariant(manualTuning) {
  if (!Object.keys(state.constraints).length) analyze();
  const token = selectedNasalToken();
  const audio = synthesizeSyllable(token, { manualTuning });
  state.nasalPreviewDiagnostics = {
    ...(state.nasalPreviewDiagnostics ?? {}),
    [token]: {
      manual_tuning: manualTuning,
      level: audio.nasal_model?.level_matching ?? null,
      continuity: audio.nasal_model?.voicing_continuity_diagnostic ?? null,
    },
  };
  renderNasalCalibration();
  await playAudioSamples(audio.samples, audio.sampleRate);
}

function renderAuditoryEvaluation() {
  const vowel = selectedVowel();
  const records = state.auditoryEvaluationLog.filter((entry) => entry.vowel === vowel);
  const latest = records.at(-1);
  if (els.auditoryEvaluationVowel) els.auditoryEvaluationVowel.textContent = `/${vowel}/ の評価`;
  if (els.phonemeClarityInput) els.phonemeClarityInput.value = String(latest?.phoneme_clarity ?? 3);
  if (els.targetMatchInput) els.targetMatchInput.value = String(latest?.target_match ?? 3);
  if (els.auditoryNoteInput) els.auditoryNoteInput.value = latest?.note ?? "";
  updateAuditoryRatingOutputs();
  if (!els.auditoryEvaluationHistory) return;
  els.auditoryEvaluationHistory.innerHTML = "";
  for (const entry of records.slice(-5).reverse()) {
    const row = document.createElement("div");
    row.className = "auditory-evaluation-entry";
    const token = document.createElement("strong");
    token.textContent = `/${entry.vowel}/`;
    const score = document.createElement("span");
    score.textContent = `判別 ${entry.phoneme_clarity}/5 · 一致 ${entry.target_match}/5`;
    const note = document.createElement("span");
    note.textContent = entry.note || "メモなし";
    row.append(token, score, note);
    els.auditoryEvaluationHistory.appendChild(row);
  }
}

function updateAuditoryRatingOutputs() {
  if (els.phonemeClarityValue) els.phonemeClarityValue.textContent = `${num(els.phonemeClarityInput, 3)} / 5`;
  if (els.targetMatchValue) els.targetMatchValue.textContent = `${num(els.targetMatchInput, 3)} / 5`;
}

function recordAuditoryEvaluation() {
  const vowel = selectedVowel();
  state.auditoryEvaluationLog.push({
    id: `${Date.now()}-${vowel}`,
    created_at: new Date().toISOString(),
    vowel,
    phoneme_clarity: clamp(Math.round(num(els.phonemeClarityInput, 3)), 1, 5),
    target_match: clamp(Math.round(num(els.targetMatchInput, 3)), 1, 5),
    note: String(els.auditoryNoteInput?.value ?? "").trim(),
    area_tuning: normalizedAreaTuningPoints(vowel),
    width_tuning: normalizedWidthTuningPoints(vowel),
  });
  state.auditoryEvaluationLog = state.auditoryEvaluationLog.slice(-100);
  renderAuditoryEvaluation();
  renderConstraints();
}

function normalizeAuditoryEvaluationLog(data) {
  if (!Array.isArray(data)) return [];
  return data.slice(-100).map((entry, index) => ({
    id: String(entry?.id ?? `migrated-${index}`),
    created_at: String(entry?.created_at ?? ""),
    vowel: vowelFormants[entry?.vowel] ? entry.vowel : "a",
    phoneme_clarity: clamp(Math.round(Number(entry?.phoneme_clarity) || 3), 1, 5),
    target_match: clamp(Math.round(Number(entry?.target_match) || 3), 1, 5),
    note: String(entry?.note ?? "").slice(0, 400),
    area_tuning: Array.isArray(entry?.area_tuning) ? entry.area_tuning : [],
    width_tuning: Array.isArray(entry?.width_tuning) ? entry.width_tuning : [],
  }));
}

function nasalPlaceGestureModel(tuning, vocalTractLengthCm = 15.5) {
  const vpJunctionPosition = 0.34;
  if (tuning.nasal_class !== "n") {
    return {
      schema_version: "nasal_place_gesture_0.1",
      kind: tuning.nasal_class === "m" ? "bilabial_end_closure" : "moraic_neutral",
      vp_junction_position: vpJunctionPosition,
      contact_position_x_over_l: tuning.closure_position,
      coronal_shaping: false,
      release_locus_fraction: null,
      release_constriction_area_cm2: null,
      acoustic_basis: tuning.nasal_class === "m"
        ? "lip-end closure with neutral tongue posture"
        : "moraic nasal without a fixed following-vowel place gesture",
    };
  }
  const bladeCenter = clamp(
    tuning.closure_position - Math.max(0.04, tuning.closure_width * 0.8),
    0.72,
    0.9
  );
  const bodyCenter = clamp(
    tuning.closure_position - Math.max(0.14, tuning.closure_width * 2.7),
    0.56,
    0.78
  );
  return {
    schema_version: "nasal_place_gesture_0.1",
    kind: "coronal_alveolar",
    vp_junction_position: vpJunctionPosition,
    contact_position_x_over_l: tuning.closure_position,
    tongue_blade_center_x_over_l: Number(bladeCenter.toFixed(5)),
    tongue_blade_spread_x_over_l: Number(clamp(tuning.closure_width * 0.9, 0.038, 0.075).toFixed(5)),
    tongue_body_center_x_over_l: Number(bodyCenter.toFixed(5)),
    tongue_body_spread_x_over_l: Number(clamp(tuning.closure_width * 1.9, 0.08, 0.14).toFixed(5)),
    coronal_shaping: true,
    release_locus_fraction: 0.42,
    release_constriction_area_cm2: Number(clamp(
      0.3 + Math.max(0, tuning.closure_area_cm2 - 0.006) * 0.4,
      0.3,
      0.35
    ).toFixed(5)),
    nominal_vocal_tract_length_cm: Number(vocalTractLengthCm.toFixed(4)),
    acoustic_basis: "derived tongue-blade dome and residual alveolar constriction during voiced release",
  };
}

function nasalOralSideCavityModel(tuning, vocalTractLengthCm = 15.5) {
  const vpJunctionPosition = 0.34;
  const sideLengthCm = clamp((tuning.closure_position - vpJunctionPosition) * vocalTractLengthCm, 2.2, 12.5);
  const primaryAntiresonanceHz = clamp(34300 / (4 * sideLengthCm), 650, 3900);
  return {
    vp_junction_position: vpJunctionPosition,
    oral_side_cavity_length_cm: Number(sideLengthCm.toFixed(4)),
    primary_antiresonance_hz: Number(primaryAntiresonanceHz.toFixed(2)),
    secondary_antiresonance_hz: Number(clamp(primaryAntiresonanceHz * 2.45, 1500, 7600).toFixed(2)),
  };
}

function nasalCouplingModel(tuning, nasalInletAreaCm2) {
  const nasalInletArea = Math.max(0.08, Number(nasalInletAreaCm2) || 1);
  return {
    maximum_vp_port_area_cm2: clamp(
      nasalInletArea * tuning.velopharyngeal_opening * 0.36,
      0.05,
      0.72
    ),
    nasal_radiation_scale: clamp(
      0.3 * tuning.nasal_path_gain / (NASAL_DEFAULTS[tuning.nasal_class]?.nasal_path_gain ?? NASAL_DEFAULTS.n.nasal_path_gain),
      0.08,
      0.72
    ),
  };
}

function nasalArticulationValidity(tuning) {
  const nasalClass = tuning.nasal_class;
  const isCvNasal = nasalClass === "m" || nasalClass === "n";
  const targetPlace = nasalClass === "m"
    ? { min: 0.94, max: 1, label: "両唇閉鎖域" }
    : nasalClass === "n"
      ? { min: 0.82, max: 0.93, label: "歯茎閉鎖域" }
      : null;
  const contactStrength = isCvNasal
    ? 1 - smoothstep01((tuning.closure_area_cm2 - 0.006) / 0.044)
    : null;
  const coarticulationRatio = isCvNasal
    ? tuning.coarticulation_lead_ms / Math.max(1, tuning.hold_duration_ms)
    : 0;
  const issues = [];
  if (targetPlace && (tuning.closure_position < targetPlace.min || tuning.closure_position > targetPlace.max)) {
    issues.push({
      code: "closure_place_outside_target",
      severity: "warning",
      label_ja: `${targetPlace.label}外（${targetPlace.min.toFixed(2)}-${targetPlace.max.toFixed(2)} x/L）`,
    });
  }
  if (isCvNasal && contactStrength < 0.7) {
    issues.push({
      code: "incomplete_oral_contact",
      severity: "warning",
      label_ja: nasalClass === "m" ? "唇閉鎖が弱く /w/ 化しやすい" : "舌端閉鎖が弱く鼻音位置が曖昧",
    });
  }
  if (isCvNasal && coarticulationRatio > 0.7) {
    issues.push({
      code: "excessive_early_coarticulation",
      severity: "warning",
      label_ja: "保持区間の大半が母音移行になっている",
    });
  }
  if (isCvNasal && tuning.transition_ms > 60) {
    issues.push({
      code: "prolonged_vowel_transition",
      severity: "warning",
      label_ja: "母音移行が長く接近音・音列化しやすい",
    });
  }
  if (nasalClass === "n" && tuning.nasal_path_gain < 0.65) {
    issues.push({
      code: "weak_nasal_radiation",
      severity: "warning",
      label_ja: "鼻音保持部が後続母音に埋もれやすい",
    });
  }
  return {
    schema_version: "nasal_articulation_validity_0.1",
    target_manner: nasalClass === "m" ? "bilabial_nasal" : nasalClass === "n" ? "alveolar_nasal" : "moraic_nasal",
    target_place_range_x_over_l: targetPlace ? [targetPlace.min, targetPlace.max] : null,
    oral_contact_strength: contactStrength === null ? null : Number(contactStrength.toFixed(5)),
    coarticulation_fraction_of_hold: Number(coarticulationRatio.toFixed(5)),
    within_target_guide: issues.length === 0,
    issues,
    basis: "engineering target guide for manner retention; non-target designs remain allowed",
  };
}

function renderNasalCalibration() {
  if (!els.nasalTokenSelect) return;
  const token = selectedNasalToken();
  const parsed = parseSyllableToken(token);
  const nasalClass = nasalClassFromToken(token);
  const tuning = normalizedNasalTuning(nasalClass);
  const vtl = state.vocalTractGeometry?.vocal_tract_length_cm ?? state.constraints.vocal_tract_length_cm?.center ?? 15.5;
  const sideCavity = nasalOralSideCavityModel(tuning, vtl);
  const fields = [
    [els.nasalClosurePositionInput, els.nasalClosurePositionValue, "closure_position", (value) => `${value.toFixed(3)} x/L`],
    [els.nasalClosureAreaInput, els.nasalClosureAreaValue, "closure_area_cm2", (value) => `${value.toFixed(3)} cm²`],
    [els.nasalClosureWidthInput, els.nasalClosureWidthValue, "closure_width", (value) => `${value.toFixed(3)} x/L`],
    [els.nasalVpOpeningInput, els.nasalVpOpeningValue, "velopharyngeal_opening", (value) => value.toFixed(2)],
    [els.nasalPathGainInput, els.nasalPathGainValue, "nasal_path_gain", (value) => `${value.toFixed(2)} x`],
    [els.nasalDampingInput, els.nasalDampingValue, "branch_damping", (value) => value.toFixed(2)],
    [els.nasalDurationInput, els.nasalDurationValue, "hold_duration_ms", (value) => `${Math.round(value)} ms`],
    [els.nasalCoarticulationLeadInput, els.nasalCoarticulationLeadValue, "coarticulation_lead_ms", (value) => `${Math.round(value)} ms`],
    [els.nasalTransitionInput, els.nasalTransitionValue, "transition_ms", (value) => `${Math.round(value)} ms`],
    [els.nasalAttackFadeInput, els.nasalAttackFadeValue, "attack_fade_ms", (value) => `${Math.round(value)} ms`],
  ];
  for (const [input, output, field, formatter] of fields) {
    if (input) input.value = String(tuning[field]);
    if (output) output.textContent = formatter(tuning[field]);
  }
  if (els.nasalTransitionInput) els.nasalTransitionInput.disabled = parsed.moraic_nasal;
  if (els.nasalCoarticulationLeadInput) els.nasalCoarticulationLeadInput.disabled = parsed.moraic_nasal;
  if (els.nasalPathGainLabel) {
    els.nasalPathGainLabel.textContent = nasalClass !== "N"
      ? "鼻腔放射寄与"
      : "鼻腔経路寄与";
  }
  if (parsed.moraic_nasal && els.nasalTransitionValue) els.nasalTransitionValue.textContent = "終端フェード固定";
  if (els.nasalCalibrationStatus) {
    els.nasalCalibrationStatus.textContent = `/${token === "n" ? "N" : token}/ · ${tuning.label} · ${parsed.moraic_nasal ? "単独終端" : `→ /${parsed.vowel}/`}`;
  }
  renderNasalParameterSummary(tuning, sideCavity);
  renderNasalEvaluation();
}

function renderNasalParameterSummary(tuning, sideCavity) {
  if (!els.nasalParameterSummary) return;
  els.nasalParameterSummary.innerHTML = "";
  const vpGap = state.vocalTractGeometry?.side_branch_guides?.velopharyngeal_port?.gap_cm;
  const coarticulationStartMs = Math.max(0, tuning.hold_duration_ms - tuning.coarticulation_lead_ms);
  const vowelTargetMs = tuning.hold_duration_ms + tuning.transition_ms;
  const nasalPath = tuning.nasal_class !== "N"
    ? buildNasalPathAreaFunction(state.constraints, PREVIEW_SAMPLE_RATE)
    : null;
  const coupling = nasalPath
    ? nasalCouplingModel(tuning, nasalPath.areas_cm2[0])
    : null;
  const previewDiagnostic = state.nasalPreviewDiagnostics?.[selectedNasalToken()] ?? null;
  const articulationValidity = nasalArticulationValidity(tuning);
  const placeGesture = nasalPlaceGestureModel(
    tuning,
    state.vocalTractGeometry?.vocal_tract_length_cm
      ?? state.constraints.vocal_tract_length_cm?.center
      ?? 15.5
  );
  const items = [
    ["基準鼻腔容積", `${format(state.constraints.nasal_cavity_volume_cm3?.center, 1)} cm³`, "詳細設定の安静時物理量"],
    ["VP gap", `${format(vpGap, 2)} cm`, "側面ランドマーク由来ガイド"],
    ["閉鎖側枝長", `${sideCavity.oral_side_cavity_length_cm.toFixed(2)} cm`, "VP分岐から口腔閉鎖まで"],
    ["一次反共振", `${Math.round(sideCavity.primary_antiresonance_hz)} Hz`, `閉鎖位置 ${tuning.closure_position.toFixed(3)} x/L`],
    [
      tuning.nasal_class === "N" ? "鼻腔経路寄与" : "鼻腔放射寄与",
      tuning.nasal_class === "N"
        ? "単独音"
        : `${tuning.nasal_path_gain.toFixed(2)} ×`,
      tuning.nasal_class === "N"
        ? "後続母音がないためRMS整合なし"
        : "鼻咽腔開放とは独立して鼻孔放射効率へ写像",
    ],
  ];
  if (tuning.nasal_class !== "N") {
    items.push([
      "調音部位派生",
      placeGesture.kind === "coronal_alveolar" ? "舌端・歯茎" : "両唇端",
      placeGesture.kind === "coronal_alveolar"
        ? `冠舌ドームと ${placeGesture.release_constriction_area_cm2.toFixed(2)} cm² の開放狭窄を閉鎖位置から自動生成`
        : "舌形状を中立に保ち、口唇終端だけを閉鎖",
    ]);
    items.push(["音響トポロジ", "三分岐波導管", "共通咽頭から口腔・鼻腔へ圧力結合"]);
    items.push([
      "VP最大開口",
      `${coupling.maximum_vp_port_area_cm2.toFixed(3)} cm²`,
      "鼻咽腔開放から算出し、鼻腔放射寄与から独立",
    ]);
    items.push(["固定開放バースト", "なし", "連続する口腔断面・VP開口変化だけで開放過渡を生成"]);
    if (previewDiagnostic?.continuity && previewDiagnostic?.level) {
      items.push([
        previewDiagnostic.manual_tuning ? "調整後・保持音レベル" : "推定原形・保持音レベル",
        `${previewDiagnostic.level.measured_nasal_to_vowel_db.toFixed(1)} dB`,
        "後続母音の定常区間に対するRMS比",
      ]);
      items.push([
        "有声連続性",
        `${previewDiagnostic.continuity.hold_periodicity.toFixed(2)} / ${previewDiagnostic.continuity.release_periodicity.toFixed(2)}`,
        "保持区間 / 開放区間の短時間F0周期相関（工学診断値）",
      ]);
      items.push([
        "保持音の低域集中",
        `${previewDiagnostic.continuity.hold_low_to_high_energy_db.toFixed(1)} dB`,
        "900 Hzを境界とした簡易エネルギー比",
      ]);
    }
  }
  if (articulationValidity.issues.length) {
    items.unshift([
      "調音様式整合",
      `警告 ${articulationValidity.issues.length}件`,
      articulationValidity.issues.map((issue) => issue.label_ja).join(" / "),
      "warning",
    ]);
  } else if (tuning.nasal_class !== "N") {
    items.unshift(["調音様式整合", "基準範囲内", "調音位置・接触・時間軌道の工学ガイド", "ok"]);
  }
  items.push([
    "CV時間アンカー",
    tuning.nasal_class === "N"
      ? `0 → ${Math.round(tuning.hold_duration_ms)} ms`
      : `0 / ${Math.round(coarticulationStartMs)} / ${Math.round(tuning.hold_duration_ms)} / ${Math.round(vowelTargetMs)} ms`,
    tuning.nasal_class === "N" ? "鼻音開始 → 終端" : "鼻音開始 / 共調音開始 / 口腔開放 / 母音到達",
  ]);
  for (const [label, value, note, tone] of items) {
    const item = document.createElement("div");
    item.className = "nasal-summary-item";
    if (tone) item.classList.add(tone);
    const strong = document.createElement("strong");
    const span = document.createElement("span");
    const small = document.createElement("small");
    strong.textContent = label;
    span.textContent = value;
    small.textContent = note;
    item.append(strong, span, small);
    els.nasalParameterSummary.appendChild(item);
  }
}

function updateNasalTuningFromInput(field, input) {
  const nasalClass = nasalClassFromToken(selectedNasalToken());
  setNasalTuningValue(nasalClass, field, num(input, NASAL_DEFAULTS[nasalClass][field]));
  renderNasalCalibration();
  renderConstraints();
  draw();
}

function renderNasalEvaluation() {
  if (!els.nasalEvaluationHistory) return;
  const token = selectedNasalToken();
  const records = state.nasalEvaluationLog.filter((entry) => entry.token === token);
  const latest = records.at(-1);
  if (els.nasalClarityInput) els.nasalClarityInput.value = String(latest?.nasal_clarity ?? 3);
  if (els.nasalTransitionRatingInput) els.nasalTransitionRatingInput.value = String(latest?.transition_quality ?? 3);
  if (els.nasalNoteInput) els.nasalNoteInput.value = latest?.note ?? "";
  updateNasalRatingOutputs();
  els.nasalEvaluationHistory.innerHTML = "";
  for (const entry of records.slice(-5).reverse()) {
    const row = document.createElement("div");
    row.className = "auditory-evaluation-entry";
    const tokenLabel = document.createElement("strong");
    tokenLabel.textContent = `/${entry.token === "n" ? "N" : entry.token}/`;
    const score = document.createElement("span");
    score.textContent = `判別 ${entry.nasal_clarity}/5 · 接続 ${entry.transition_quality}/5`;
    const note = document.createElement("span");
    note.textContent = entry.note || "メモなし";
    row.append(tokenLabel, score, note);
    els.nasalEvaluationHistory.appendChild(row);
  }
}

function updateNasalRatingOutputs() {
  if (els.nasalClarityValue) els.nasalClarityValue.textContent = `${num(els.nasalClarityInput, 3)} / 5`;
  if (els.nasalTransitionRatingValue) els.nasalTransitionRatingValue.textContent = `${num(els.nasalTransitionRatingInput, 3)} / 5`;
}

function recordNasalEvaluation() {
  const token = selectedNasalToken();
  const nasalClass = nasalClassFromToken(token);
  state.nasalEvaluationLog.push({
    id: `${Date.now()}-${token}`,
    created_at: new Date().toISOString(),
    token,
    nasal_class: nasalClass,
    nasal_clarity: clamp(Math.round(num(els.nasalClarityInput, 3)), 1, 5),
    transition_quality: clamp(Math.round(num(els.nasalTransitionRatingInput, 3)), 1, 5),
    note: String(els.nasalNoteInput?.value ?? "").trim(),
    tuning: normalizedNasalTuning(nasalClass),
  });
  state.nasalEvaluationLog = state.nasalEvaluationLog.slice(-100);
  renderNasalEvaluation();
  renderConstraints();
}

function normalizeNasalEvaluationLog(data) {
  if (!Array.isArray(data)) return [];
  return data.slice(-100).map((entry, index) => {
    const token = String(entry?.token || "ma").toLowerCase();
    const nasalClass = nasalClassFromToken(token);
    return {
      id: String(entry?.id ?? `migrated-nasal-${index}`),
      created_at: String(entry?.created_at ?? ""),
      token,
      nasal_class: nasalClass,
      nasal_clarity: clamp(Math.round(Number(entry?.nasal_clarity) || 3), 1, 5),
      transition_quality: clamp(Math.round(Number(entry?.transition_quality) || 3), 1, 5),
      note: String(entry?.note ?? "").slice(0, 400),
      tuning: normalizedNasalTuningFromSource(nasalClass, entry?.tuning ?? {}),
    };
  });
}

async function playSelectedSyllablePreview() {
  if (!Object.keys(state.constraints).length) analyze();
  const token = selectedSyllableToken();
  const audio = synthesizeSyllable(token);
  await playAudioSamples(audio.samples, audio.sampleRate);
  if (els.datasetExportStatus) els.datasetExportStatus.textContent = `/${token}/ を再生しました。`;
}

function parseSyllableToken(token) {
  if (token === "n") return { consonant: "N", vowel: "u", moraic_nasal: true };
  const normalized = String(token || "a").toLowerCase();
  const vowel = [...normalized].reverse().find((char) => vowelFormants[char]) ?? "a";
  const consonant = normalized.endsWith(vowel) ? normalized.slice(0, -1) : "";
  return { consonant, vowel, moraic_nasal: false };
}

function synthesizeSyllable(token, options = {}) {
  const parsed = parseSyllableToken(token);
  if (parsed.moraic_nasal || ["m", "n"].includes(parsed.consonant)) {
    return synthesizeNasalSyllable(token, parsed, options);
  }
  const vowelAudio = synthesizeVowel(parsed.vowel);
  const onset = synthesizeConsonantOnset(parsed, vowelAudio.sampleRate, currentDerivedF0(state.constraints));
  const samples = new Float32Array(onset.length + vowelAudio.samples.length);
  samples.set(onset, 0);
  samples.set(vowelAudio.samples, onset.length);
  applyFade(samples, 0, Math.min(samples.length, Math.floor(vowelAudio.sampleRate * 0.012)));
  applyFade(samples, Math.max(0, samples.length - Math.floor(vowelAudio.sampleRate * 0.04)), samples.length, true);
  normalize(samples, 0.92);
  return {
    ...vowelAudio,
    token,
    vowel: parsed.vowel,
    consonant: parsed.consonant,
    samples,
    onset_model: onsetDescriptor(parsed),
  };
}

function buildNasalPathAreaFunction(constraints, sampleRate) {
  const volumeCm3 = clamp(constraints.nasal_cavity_volume_cm3?.center ?? 20, 5, 50);
  const vtl = constraints.vocal_tract_length_cm?.center ?? 15.5;
  const pathLengthCm = clamp(vtl * 0.76 + (volumeCm3 - 20) * 0.055, 9.5, 16.5);
  const tubeCount = clamp(Math.round(pathLengthCm * sampleRate / 35000), 6, 36);
  const meanArea = clamp(volumeCm3 / pathLengthCm, 0.65, 4.2);
  const areas = Array.from({ length: tubeCount }, (_, index) => {
    const position = tubeCount > 1 ? index / (tubeCount - 1) : 0.5;
    const inlet = 0.72 + 0.28 * Math.min(1, position / 0.24);
    const turbinateShape = 1 - 0.22 * Math.exp(-0.5 * Math.pow((position - 0.48) / 0.16, 2));
    const outlet = 1 - 0.34 * Math.exp(-0.5 * Math.pow((position - 0.94) / 0.10, 2));
    return Number(clamp(meanArea * inlet * turbinateShape * outlet, 0.35, 5.5).toFixed(4));
  });
  return {
    schema_version: "synthetic_nasal_path_area_0.1",
    source_role: "engineering nasal-path geometry derived from aggregate-scale design volume; not observed internal anatomy",
    nasal_cavity_volume_cm3: Number(volumeCm3.toFixed(4)),
    path_length_cm: Number(pathLengthCm.toFixed(4)),
    tube_count: tubeCount,
    section_length_cm: Number((pathLengthCm / tubeCount).toFixed(4)),
    areas_cm2: areas,
  };
}

function nasalTubeSynthesisOptions(sampleCount, sampleRate, constraints, areaCount) {
  const tension = constraints.baseline_muscle_tension?.center ?? 1;
  const respiratoryProfile = currentRespiratoryProfile(constraints);
  const glottalParams = currentGlottalSourceParams(constraints, tension);
  const lossParams = currentTubeLossParams(constraints);
  return {
    sampleCount,
    sampleRate,
    f0: currentDerivedF0(constraints),
    pressure: respiratoryProfile.effective_pressure_pa * 0.88,
    effectiveClosure: glottalClosureProxyFromOpenQuotient(glottalParams.open_quotient),
    respiratorySupport: respiratoryProfile.effective_support,
    tension,
    amplitude: 0.78,
    motorControlPrecision: currentArticulationMotorProfile(constraints).motor_control_precision,
    glottalParams,
    aspirationNoiseScale: 0.5,
    lossParams,
    lossModel: buildTubeDistributedLossModel(lossParams, sampleRate, areaCount),
  };
}

function oralReleaseTubeSynthesisOptions(sampleCount, sampleRate, constraints, areaCount, vowel, vocalTractLengthCm) {
  const options = nasalTubeSynthesisOptions(sampleCount, sampleRate, constraints, areaCount);
  const respiratoryProfile = currentRespiratoryProfile(constraints);
  return {
    ...options,
    pressure: respiratoryProfile.effective_pressure_pa,
    respiratorySupport: respiratoryProfile.effective_support,
    amplitude: currentVowelReference(vowel, vocalTractLengthCm).amplitude,
    aspirationNoiseScale: 0.82,
  };
}

function nasalReleaseCueMetadata(transitionSamples, sampleRate) {
  return {
    type: "waveguide_geometry_transient",
    gain: 0,
    duration_ms: Number((Math.max(0, transitionSamples) * 1000 / sampleRate).toFixed(2)),
    stochastic_excitation: false,
    source: "continuous oral-area and velopharyngeal-port trajectories",
  };
}

function signalRms(samples, startSample, endSample) {
  let sum = 0;
  let count = 0;
  const start = clamp(Math.floor(startSample), 0, samples.length);
  const end = clamp(Math.ceil(endSample), start, samples.length);
  for (let index = start; index < end; index++) {
    sum += samples[index] * samples[index];
    count += 1;
  }
  return Math.sqrt(sum / Math.max(1, count));
}

function signalLagPeriodicity(samples, startSample, endSample, lagSamples) {
  const start = clamp(Math.floor(startSample), 0, samples.length);
  const end = clamp(Math.ceil(endSample), start, samples.length);
  const lag = Math.max(1, Math.round(lagSamples));
  if (end - start <= lag * 2) return 0;
  let mean = 0;
  for (let index = start; index < end; index++) mean += samples[index];
  mean /= Math.max(1, end - start);
  let cross = 0;
  let leftEnergy = 0;
  let rightEnergy = 0;
  for (let index = start; index < end - lag; index++) {
    const left = samples[index] - mean;
    const right = samples[index + lag] - mean;
    cross += left * right;
    leftEnergy += left * left;
    rightEnergy += right * right;
  }
  return clamp(cross / Math.sqrt(Math.max(1e-16, leftEnergy * rightEnergy)), -1, 1);
}

function signalFramewiseLagPeriodicity(samples, startSample, endSample, lagSamples) {
  const lag = Math.max(1, Math.round(lagSamples));
  const start = clamp(Math.floor(startSample), 0, samples.length);
  const end = clamp(Math.ceil(endSample), start, samples.length);
  const frameLength = Math.max(lag * 2 + 1, Math.round(lag * 2.5));
  if (end - start <= frameLength) {
    return Math.max(0, signalLagPeriodicity(samples, start, end, lag));
  }
  const step = Math.max(1, Math.round(lag * 0.75));
  let weightedSum = 0;
  let weightTotal = 0;
  for (let frameStart = start; frameStart + frameLength <= end; frameStart += step) {
    const frameEnd = frameStart + frameLength;
    const frameRms = signalRms(samples, frameStart, frameEnd);
    const periodicity = Math.max(0, signalLagPeriodicity(samples, frameStart, frameEnd, lag));
    const weight = Math.max(1e-8, frameRms * frameRms);
    weightedSum += periodicity * weight;
    weightTotal += weight;
  }
  return weightTotal > 0 ? clamp(weightedSum / weightTotal, 0, 1) : 0;
}

function signalLowHighEnergyRatioDb(samples, startSample, endSample, sampleRate, crossoverHz = 900) {
  const start = clamp(Math.floor(startSample), 0, samples.length);
  const end = clamp(Math.ceil(endSample), start, samples.length);
  if (end - start < 2) return 0;
  let mean = 0;
  for (let index = start; index < end; index++) mean += samples[index];
  mean /= Math.max(1, end - start);
  const alpha = 1 - Math.exp(-2 * Math.PI * crossoverHz / sampleRate);
  let lowState = 0;
  let lowEnergy = 0;
  let highEnergy = 0;
  for (let index = start; index < end; index++) {
    const sample = samples[index] - mean;
    lowState += alpha * (sample - lowState);
    const high = sample - lowState;
    lowEnergy += lowState * lowState;
    highEnergy += high * high;
  }
  return 10 * Math.log10(Math.max(1e-16, lowEnergy) / Math.max(1e-16, highEnergy));
}

function matchNasalLevelToVowel(nasalSamples, oralSamples, sampleRate, holdSamples, transitionSamples, tuning, nasalClass) {
  const holdStart = Math.min(Math.floor(sampleRate * 0.025), Math.floor(holdSamples * 0.45));
  const holdEnd = Math.max(holdStart + 1, holdSamples - Math.floor(sampleRate * 0.006));
  const vowelStart = holdSamples + transitionSamples + Math.floor(sampleRate * 0.12);
  const vowelEnd = vowelStart + Math.floor(sampleRate * 0.18);
  const nasalRms = signalRms(nasalSamples, holdStart, holdEnd);
  const vowelRms = signalRms(oralSamples, vowelStart, vowelEnd);
  const defaults = NASAL_DEFAULTS[nasalClass] ?? NASAL_DEFAULTS.n;
  const baseTargetDb = -2;
  const userControlScale = clamp(
    (tuning.nasal_path_gain / defaults.nasal_path_gain)
      * (tuning.velopharyngeal_opening / defaults.velopharyngeal_opening),
    0.18,
    2
  );
  const targetRatio = Math.pow(10, baseTargetDb / 20) * userControlScale;
  const requestedRms = Math.max(1e-6, vowelRms) * targetRatio;
  const appliedGain = clamp(requestedRms / Math.max(1e-6, nasalRms), 0.02, 5);
  return {
    schema_version: "nasal_vowel_level_match_0.1",
    basis: "steady-window RMS matching; engineering target, not a clinical or population norm",
    base_target_db: baseTargetDb,
    user_control_scale: Number(userControlScale.toFixed(4)),
    effective_target_db: Number((baseTargetDb + 20 * Math.log10(userControlScale)).toFixed(3)),
    measured_nasal_path_rms: Number(nasalRms.toFixed(6)),
    measured_vowel_path_rms: Number(vowelRms.toFixed(6)),
    applied_nasal_gain: Number(appliedGain.toFixed(5)),
    hold_measurement_ms: [
      Number((holdStart * 1000 / sampleRate).toFixed(2)),
      Number((holdEnd * 1000 / sampleRate).toFixed(2)),
    ],
    vowel_measurement_ms: [
      Number((vowelStart * 1000 / sampleRate).toFixed(2)),
      Number((vowelEnd * 1000 / sampleRate).toFixed(2)),
    ],
  };
}

function applyNasalPathResonances(samples, sampleRate, tuning, sideCavity, constraints) {
  const volumeCm3 = clamp(constraints.nasal_cavity_volume_cm3?.center ?? 20, 5, 50);
  const damping = clamp(tuning.branch_damping, 0.3, 1.4);
  const opening = clamp(tuning.velopharyngeal_opening, 0.2, 1);
  const murmurHz = clamp(245 + (20 - volumeCm3) * 2.2, 190, 340);
  const q = clamp(3.1 / damping, 1.1, 7.5);
  const branches = [
    { key: "nasal_murmur", frequency_hz: murmurHz, q: q * 0.62, gain_db: 5.5 * opening },
    { key: "oral_side_primary_antiresonance", frequency_hz: sideCavity.primary_antiresonance_hz, q, gain_db: -10.5 * opening },
    { key: "oral_side_secondary_antiresonance", frequency_hz: sideCavity.secondary_antiresonance_hz, q: q * 0.82, gain_db: -6.5 * opening },
  ];
  for (const branch of branches) {
    applyBiquadInPlace(samples, makeBiquad("peaking", branch.frequency_hz, branch.q, branch.gain_db, sampleRate));
  }
  const lowpassCutoffHz = clamp(4300 - opening * 900 + damping * 320, 2800, 4800);
  applyOnePoleLowpassBlend(samples, sampleRate, lowpassCutoffHz, clamp(0.22 + opening * 0.24, 0, 0.55));
  return {
    schema_version: "nasal_path_resonance_0.1",
    branches: branches.map((branch) => ({
      ...branch,
      frequency_hz: Number(branch.frequency_hz.toFixed(2)),
      q: Number(branch.q.toFixed(3)),
      gain_db: Number(branch.gain_db.toFixed(3)),
    })),
    lowpass_cutoff_hz: Number(lowpassCutoffHz.toFixed(2)),
    damping,
    velopharyngeal_opening: opening,
  };
}

function synthesizeCoupledNasalSyllable(context) {
  const {
    token,
    parsed,
    nasalClass,
    constraints,
    sampleRate,
    tuning,
    vowelAudio,
    closureArea,
    neutralClosureArea,
    coronalReleaseArea,
    placeGesture,
    nasalPath,
    sideCavity,
    oralSampleCount,
    oralReleaseOptions,
    sharedSourceSamples,
    holdSamples,
    coarticulationStartSample,
    appliedTransitionSamples,
    vowelTargetSample,
  } = context;
  const nasalInletArea = Math.max(0.08, nasalPath.areas_cm2[0] ?? 1);
  const coupling = nasalCouplingModel(tuning, nasalInletArea);
  const maximumVpPortArea = coupling.maximum_vp_port_area_cm2;
  const nasalRadiationScale = coupling.nasal_radiation_scale;
  const closedVpPortArea = 0.008;
  const hasCoronalReleaseCue = nasalClass === "n"
    && coronalReleaseArea
    && vowelTargetSample > holdSamples + 1;
  const coronalReleaseSample = hasCoronalReleaseCue
    ? clamp(
      holdSamples + Math.round(appliedTransitionSamples * placeGesture.release_locus_fraction),
      holdSamples + 1,
      vowelTargetSample - 1
    )
    : null;
  const oralAreaTrajectory = {
    ...oralReleaseOptions.areaTrajectory,
    keyframes: [
      { role: "nasal_neutral_closed", sample: 0, areas_cm2: neutralClosureArea.areas_cm2 },
      { role: "coarticulation_start", sample: coarticulationStartSample, areas_cm2: neutralClosureArea.areas_cm2 },
      { role: "oral_release", sample: holdSamples, areas_cm2: closureArea.areas_cm2 },
      ...(hasCoronalReleaseCue ? [{
        role: "coronal_release_locus",
        sample: coronalReleaseSample,
        areas_cm2: coronalReleaseArea.areas_cm2,
      }] : []),
      { role: "vowel_target", sample: vowelTargetSample, areas_cm2: vowelAudio.area_function.areas_cm2 },
    ],
  };
  const vpAreaTrajectory = {
    schema_version: "velopharyngeal_port_area_trajectory_0.1",
    interpolation: "smoothstep_per_keyframe",
    keyframes: [
      { role: "nasal_hold", sample: 0, area_cm2: maximumVpPortArea },
      { role: "coarticulation_start", sample: coarticulationStartSample, area_cm2: maximumVpPortArea },
      { role: "oral_release", sample: holdSamples, area_cm2: maximumVpPortArea * 0.85 },
      ...(hasCoronalReleaseCue ? [{
        role: "coronal_release_locus",
        sample: coronalReleaseSample,
        area_cm2: maximumVpPortArea * 0.58,
      }] : []),
      { role: "vowel_target", sample: vowelTargetSample, area_cm2: closedVpPortArea },
    ],
  };
  const coupled = synthesizeBranchedNasalOralTube(
    closureArea.areas_cm2,
    nasalPath.areas_cm2,
    {
      ...oralReleaseOptions,
      sourceSamples: sharedSourceSamples,
      areaTrajectory: oralAreaTrajectory,
      velopharyngealAreaTrajectory: vpAreaTrajectory,
      velopharyngealPortAreaCm2: maximumVpPortArea,
      vpJunctionPosition: sideCavity.vp_junction_position,
      nasalBranchDamping: tuning.branch_damping,
      nasalRadiationScale,
      oralContactPosition: tuning.closure_position,
    }
  );
  const samples = coupled.samples;
  const sideBranchLossModel = applySideBranchLosses(
    samples,
    sampleRate,
    constraints,
    parsed.vowel,
    state.vocalTractGeometry,
    vowelAudio.area_function,
    { strength: 1, excludeBranches: ["velopharyngeal_nasal"] }
  );
  const releaseCue = nasalReleaseCueMetadata(appliedTransitionSamples, sampleRate);
  const bodyResonanceModel = applyBodyResonance(samples, sampleRate, constraints);
  applyHalfCosineFade(samples, 0, Math.min(samples.length, Math.floor(sampleRate * tuning.attack_fade_ms / 1000)));
  applyFade(samples, Math.max(0, samples.length - Math.floor(sampleRate * 0.04)), samples.length, true);

  const holdStart = Math.min(Math.floor(sampleRate * 0.025), Math.floor(holdSamples * 0.45));
  const holdEnd = Math.max(holdStart + 1, holdSamples - Math.floor(sampleRate * 0.006));
  const vowelStart = holdSamples + appliedTransitionSamples + Math.floor(sampleRate * 0.12);
  const vowelEnd = vowelStart + Math.floor(sampleRate * 0.18);
  const nasalWindowRms = signalRms(samples, holdStart, holdEnd);
  const vowelWindowRms = signalRms(samples, vowelStart, vowelEnd);
  const oralRadiationHoldRms = signalRms(coupled.oral_radiation, holdStart, holdEnd);
  const nasalRadiationHoldRms = signalRms(coupled.nasal_radiation, holdStart, holdEnd);
  const oralRadiationVowelRms = signalRms(coupled.oral_radiation, vowelStart, vowelEnd);
  const nasalRadiationVowelRms = signalRms(coupled.nasal_radiation, vowelStart, vowelEnd);
  const measuredBalanceDb = 20 * Math.log10(
    Math.max(1e-8, nasalWindowRms) / Math.max(1e-8, vowelWindowRms)
  );
  const f0Hz = currentDerivedF0(constraints);
  const f0LagSamples = sampleRate / Math.max(50, f0Hz);
  const continuityDiagnostic = {
    schema_version: "nasal_voicing_continuity_diagnostic_0.2",
    basis: "engineering waveform diagnostic; framewise during changing geometry; not a perceptual or clinical threshold",
    expected_f0_hz: Number(f0Hz.toFixed(4)),
    hold_periodicity: Number(signalLagPeriodicity(
      samples,
      holdStart,
      holdEnd,
      f0LagSamples
    ).toFixed(5)),
    release_periodicity: Number(signalFramewiseLagPeriodicity(
      samples,
      holdSamples,
      Math.max(holdSamples + 1, vowelTargetSample),
      f0LagSamples
    ).toFixed(5)),
    release_periodicity_method: "RMS-weighted 2.5-period frame correlation",
    hold_low_to_high_energy_db: Number(signalLowHighEnergyRatioDb(
      samples,
      holdStart,
      holdEnd,
      sampleRate
    ).toFixed(3)),
    stochastic_release_excitation: false,
  };
  const levelDiagnostic = {
    schema_version: "coupled_radiation_level_diagnostic_0.1",
    basis: "measured output windows from one coupled waveguide; no independent nasal-path normalization",
    measured_nasal_window_rms: Number(nasalWindowRms.toFixed(6)),
    measured_vowel_window_rms: Number(vowelWindowRms.toFixed(6)),
    measured_nasal_to_vowel_db: Number(measuredBalanceDb.toFixed(3)),
    component_radiation_rms: {
      hold_oral: Number(oralRadiationHoldRms.toFixed(6)),
      hold_nasal: Number(nasalRadiationHoldRms.toFixed(6)),
      vowel_oral: Number(oralRadiationVowelRms.toFixed(6)),
      vowel_nasal: Number(nasalRadiationVowelRms.toFixed(6)),
    },
    applied_nasal_gain: 1,
    independent_level_matching: false,
  };
  normalize(samples, 0.92);
  const releaseTrajectory = {
    schema_version: "nasal_release_trajectory_0.8",
    interpolation: "simultaneous smoothstep A(x,t) and velopharyngeal-port area trajectories",
    area_trajectory_schema: oralAreaTrajectory.schema_version,
    vp_area_trajectory_schema: vpAreaTrajectory.schema_version,
    coarticulation_start_sample: coarticulationStartSample,
    oral_release_sample: holdSamples,
    place_cue_keyframe_sample: coronalReleaseSample,
    vowel_target_sample: vowelTargetSample,
    closure_position: tuning.closure_position,
    continuous_oral_render: true,
    waveform_switch_after_release: false,
    shared_glottal_source: true,
    independent_path_normalization: false,
    pressure_coupled_branch: true,
    place_specific_coronal_release: hasCoronalReleaseCue,
    oral_render_duration_ms: Number((oralSampleCount * 1000 / sampleRate).toFixed(2)),
  };
  const nasalModel = {
    schema_version: "nasal_consonant_model_1.1",
    nasal_class: nasalClass,
    token,
    following_vowel: parsed.vowel,
    tuning,
    oral_closure_area_function: closureArea,
    neutral_oral_closure_area_function: neutralClosureArea,
    coronal_release_area_function: coronalReleaseArea,
    place_gesture: placeGesture,
    nasal_path_area_function: nasalPath,
    oral_side_cavity: sideCavity,
    resonance_model: {
      schema_version: "coupled_branch_resonance_0.1",
      generated_by: coupled.topology.schema_version,
      explicit_nasal_pole_zero_filter: false,
      oral_side_antiresonance_generated_by_closed_branch: true,
    },
    acoustic_topology: coupled.topology,
    side_branch_loss_model: sideBranchLossModel,
    level_matching: levelDiagnostic,
    voicing_continuity_diagnostic: continuityDiagnostic,
    articulation_validity: nasalArticulationValidity(tuning),
    release_trajectory: releaseTrajectory,
    release_cue: releaseCue,
    routing: {
      nasal_path_gain: tuning.nasal_path_gain,
      requested_nasal_path_gain: tuning.nasal_path_gain,
      maximum_vp_port_area_cm2: Number(maximumVpPortArea.toFixed(5)),
      closed_vp_port_area_cm2: closedVpPortArea,
      nasal_radiation_scale: Number(nasalRadiationScale.toFixed(5)),
      requested_closure_area_cm2: tuning.closure_area_cm2,
      effective_contact_area_cm2: closureArea.closure_area_cm2,
      closure_mapping: `${nasalClass === "m" ? "bilabial" : "alveolar"} contact maps the editable residual-area control directly to the anchored acoustic section`,
      control_mapping: "velopharyngeal_opening scales three-port branch admittance; nasal_path_gain scales nostril radiation efficiency",
      route_curve: "continuous_vp_port_area_trajectory",
      shared_glottal_source: true,
      independent_path_normalization: false,
    },
    timing: {
      hold_duration_ms: tuning.hold_duration_ms,
      coarticulation_lead_ms: tuning.coarticulation_lead_ms,
      coarticulation_start_ms: Number((coarticulationStartSample * 1000 / sampleRate).toFixed(3)),
      oral_release_ms: tuning.hold_duration_ms,
      vowel_target_ms: Number((vowelTargetSample * 1000 / sampleRate).toFixed(3)),
      transition_ms: tuning.transition_ms,
      transition_samples: appliedTransitionSamples,
      place_cue_peak_ms: coronalReleaseSample === null
        ? null
        : Number((coronalReleaseSample * 1000 / sampleRate).toFixed(3)),
      attack_fade_ms: tuning.attack_fade_ms,
      attack_fade_curve: "half_cosine",
      transition_model: "single-state branched waveguide with time-varying oral closure, place-derived tongue posture, vowel posture, and velopharyngeal port",
    },
    limitation: "The nasal geometry is an aggregate-scale synthetic tube; the three-port junction and derived coronal tongue dome are one-dimensional approximations.",
  };
  return {
    ...vowelAudio,
    samples,
    token,
    vowel: parsed.vowel,
    consonant: nasalClass,
    nasal_model: nasalModel,
    onset_model: nasalModel,
    body_resonance_model: bodyResonanceModel,
  };
}

function synthesizeNasalSyllable(token, parsed, options = {}) {
  const constraints = state.constraints;
  const sampleRate = PREVIEW_SAMPLE_RATE;
  const nasalClass = parsed.moraic_nasal ? "N" : parsed.consonant;
  const tuning = normalizedNasalTuning(nasalClass, options.manualTuning !== false);
  const vowelAudio = synthesizeVowel(parsed.vowel);
  const placeGesture = nasalPlaceGestureModel(
    tuning,
    vowelAudio.area_function.vocal_tract_length_cm
  );
  const closureArea = buildNasalOralClosureAreaFunction(
    vowelAudio.area_function,
    tuning,
    { placeGesture }
  );
  const neutralAreaFunction = {
    ...vowelAudio.area_function,
    areas_cm2: vowelAudio.area_function.raw_areas_cm2?.length === vowelAudio.area_function.areas_cm2.length
      ? vowelAudio.area_function.raw_areas_cm2
      : vowelAudio.area_function.areas_cm2,
  };
  const neutralClosureArea = buildNasalOralClosureAreaFunction(
    neutralAreaFunction,
    tuning,
    { placeGesture }
  );
  const nasalPath = buildNasalPathAreaFunction(constraints, sampleRate);
  const holdSamples = Math.floor(sampleRate * tuning.hold_duration_ms / 1000);
  const coarticulationLeadSamples = parsed.moraic_nasal
    ? 0
    : Math.min(
      Math.max(0, holdSamples - 1),
      Math.floor(sampleRate * tuning.coarticulation_lead_ms / 1000)
    );
  const coarticulationStartSample = holdSamples - coarticulationLeadSamples;
  const transitionSamples = Math.floor(sampleRate * tuning.transition_ms / 1000);
  const nasalSampleCount = Math.max(1, holdSamples + (parsed.moraic_nasal ? 0 : transitionSamples));
  const appliedTransitionSamples = parsed.moraic_nasal
    ? 0
    : Math.min(transitionSamples, nasalSampleCount - holdSamples);
  const vowelTargetSample = holdSamples + appliedTransitionSamples - 1;
  const sideCavity = nasalOralSideCavityModel(tuning, vowelAudio.area_function.vocal_tract_length_cm);
  const nasalOptions = nasalTubeSynthesisOptions(
    nasalSampleCount,
    sampleRate,
    constraints,
    nasalPath.areas_cm2.length
  );
  let oralReleaseOptions = null;
  let oralSampleCount = 0;
  let sharedSourceSamples = null;
  if (!parsed.moraic_nasal) {
    oralSampleCount = nasalSampleCount + vowelAudio.samples.length;
    oralReleaseOptions = oralReleaseTubeSynthesisOptions(
      oralSampleCount,
      sampleRate,
      constraints,
      closureArea.areas_cm2.length,
      parsed.vowel,
      vowelAudio.area_function.vocal_tract_length_cm
    );
    oralReleaseOptions.sourceAttackSeconds = tuning.attack_fade_ms / 1000;
    oralReleaseOptions.areaTrajectory = {
      schema_version: "multi_stage_area_trajectory_0.1",
      interpolation: "smoothstep_per_keyframe",
      keyframes: [
        { role: "nasal_neutral_closed", sample: 0, areas_cm2: neutralClosureArea.areas_cm2 },
        { role: "coarticulation_start", sample: coarticulationStartSample, areas_cm2: neutralClosureArea.areas_cm2 },
        { role: "oral_release", sample: holdSamples, areas_cm2: closureArea.areas_cm2 },
        { role: "vowel_target", sample: vowelTargetSample, areas_cm2: vowelAudio.area_function.areas_cm2 },
      ],
    };
    sharedSourceSamples = synthesizeTubeSourceSamples({
      ...oralReleaseOptions,
      aspirationNoiseScale: 0.68,
      sourceReleaseSeconds: 0,
    });
    nasalOptions.sourceSamples = sharedSourceSamples;
    oralReleaseOptions.sourceSamples = sharedSourceSamples;
  }
  if ((nasalClass === "m" || nasalClass === "n") && !parsed.moraic_nasal) {
    const coupledClosureTuning = { ...tuning };
    const coupledClosureArea = buildNasalOralClosureAreaFunction(
      vowelAudio.area_function,
      coupledClosureTuning,
      { anchorClosureSection: true, placeGesture }
    );
    const coupledNeutralClosureArea = buildNasalOralClosureAreaFunction(
      neutralAreaFunction,
      coupledClosureTuning,
      { anchorClosureSection: true, placeGesture }
    );
    const coronalReleaseArea = nasalClass === "n"
      ? buildNasalOralClosureAreaFunction(
        vowelAudio.area_function,
        coupledClosureTuning,
        {
          anchorClosureSection: true,
          placeGesture,
          placeGestureStrength: 0.5,
          closureAreaCm2: placeGesture.release_constriction_area_cm2,
          closureWidth: clamp(coupledClosureTuning.closure_width * 0.82, 0.032, 0.065),
        }
      )
      : null;
    return synthesizeCoupledNasalSyllable({
      token,
      parsed,
      nasalClass,
      constraints,
      sampleRate,
      tuning,
      vowelAudio,
      closureArea: coupledClosureArea,
      neutralClosureArea: coupledNeutralClosureArea,
      coronalReleaseArea,
      placeGesture,
      nasalPath,
      sideCavity,
      oralSampleCount,
      oralReleaseOptions,
      sharedSourceSamples,
      holdSamples,
      coarticulationStartSample,
      appliedTransitionSamples,
      vowelTargetSample,
    });
  }
  const nasalSamples = synthesizeKellyLochbaumTube(
    nasalPath.areas_cm2,
    nasalOptions
  );
  const resonanceModel = applyNasalPathResonances(nasalSamples, sampleRate, tuning, sideCavity, constraints);
  const nasalGain = tuning.nasal_path_gain * tuning.velopharyngeal_opening;
  let effectiveNasalGain = nasalGain;
  let levelMatching = null;
  let samples;
  let bodyResonanceModel;
  let releaseTrajectory = null;
  let releaseCue = { type: "none", gain: 0, duration_ms: 0 };
  let oralLeakGain;
  if (parsed.moraic_nasal) {
    normalize(nasalSamples, 0.74);
    const oralLeakSamples = synthesizeKellyLochbaumTube(
      closureArea.areas_cm2,
      nasalTubeSynthesisOptions(nasalSampleCount, sampleRate, constraints, closureArea.areas_cm2.length)
    );
    normalize(oralLeakSamples, 0.58);
    oralLeakGain = clamp((1 - tuning.velopharyngeal_opening) * 0.24 + tuning.closure_area_cm2 * 0.22, 0.018, 0.24);
    samples = new Float32Array(nasalSampleCount);
    for (let index = 0; index < samples.length; index++) {
      samples[index] = nasalSamples[index] * nasalGain + oralLeakSamples[index] * oralLeakGain;
    }
    bodyResonanceModel = applyBodyResonance(samples, sampleRate, constraints);
    applyHalfCosineFade(samples, 0, Math.min(samples.length, Math.floor(sampleRate * tuning.attack_fade_ms / 1000)));
    applyFade(samples, Math.max(0, samples.length - Math.floor(sampleRate * 0.045)), samples.length, true);
  } else {
    const oralReleaseSamples = synthesizeKellyLochbaumTube(closureArea.areas_cm2, oralReleaseOptions);
    applySideBranchLosses(
      oralReleaseSamples,
      sampleRate,
      constraints,
      parsed.vowel,
      state.vocalTractGeometry,
      vowelAudio.area_function,
      { strength: 1 }
    );
    bodyResonanceModel = applyBodyResonance(oralReleaseSamples, sampleRate, constraints);
    applyBodyResonance(nasalSamples, sampleRate, constraints);
    levelMatching = matchNasalLevelToVowel(
      nasalSamples,
      oralReleaseSamples,
      sampleRate,
      holdSamples,
      appliedTransitionSamples,
      tuning,
      nasalClass
    );
    effectiveNasalGain = levelMatching.applied_nasal_gain;
    oralLeakGain = clamp(
      (1 - tuning.velopharyngeal_opening) * 0.055 + tuning.closure_area_cm2 * 0.04,
      0.003,
      0.035
    );
    samples = new Float32Array(oralSampleCount);
    for (let index = 0; index < coarticulationStartSample; index++) {
      samples[index] = nasalSamples[index] * effectiveNasalGain + oralReleaseSamples[index] * oralLeakGain;
    }
    for (let index = coarticulationStartSample; index < holdSamples; index++) {
      const progress = smoothstep01(
        (index - coarticulationStartSample) / Math.max(1, holdSamples - coarticulationStartSample - 1)
      );
      const nasalRoute = effectiveNasalGain * (1 - 0.15 * progress);
      samples[index] = nasalSamples[index] * nasalRoute + oralReleaseSamples[index] * oralLeakGain;
    }
    for (let index = 0; index < appliedTransitionSamples; index++) {
      const progress = smoothstep01(appliedTransitionSamples > 1 ? index / (appliedTransitionSamples - 1) : 1);
      const sampleIndex = holdSamples + index;
      const nasalRoute = effectiveNasalGain * 0.85 * Math.cos(progress * Math.PI / 2);
      const oralRoute = oralLeakGain + (1 - oralLeakGain) * Math.sin(progress * Math.PI / 2);
      samples[sampleIndex] = nasalSamples[sampleIndex] * nasalRoute + oralReleaseSamples[sampleIndex] * oralRoute;
    }
    const vowelContinuationStart = holdSamples + appliedTransitionSamples;
    for (let index = vowelContinuationStart; index < samples.length; index++) {
      samples[index] = oralReleaseSamples[index];
    }
    releaseCue = { type: "none", gain: 0, duration_ms: 0 };
    applyHalfCosineFade(samples, 0, Math.min(samples.length, Math.floor(sampleRate * tuning.attack_fade_ms / 1000)));
    applyFade(samples, Math.max(0, samples.length - Math.floor(sampleRate * 0.04)), samples.length, true);
    releaseTrajectory = {
      schema_version: "nasal_release_trajectory_0.4",
      interpolation: "smoothstep keyframes: closed neutral tract to closed vowel posture, then oral release to the full vowel target",
      area_trajectory_schema: oralReleaseOptions.areaTrajectory.schema_version,
      coarticulation_start_sample: coarticulationStartSample,
      oral_release_sample: holdSamples,
      vowel_target_sample: vowelTargetSample,
      closure_position: tuning.closure_position,
      nasal_route_at_release_end: 0,
      oral_route_at_release_end: 1,
      continuous_oral_render: true,
      waveform_switch_after_release: false,
      shared_glottal_source: true,
      independent_path_normalization: false,
      oral_render_duration_ms: Number((oralSampleCount * 1000 / sampleRate).toFixed(2)),
    };
  }
  normalize(samples, 0.92);
  const nasalModel = {
    schema_version: "nasal_consonant_model_0.7",
    nasal_class: nasalClass,
    token,
    following_vowel: parsed.moraic_nasal ? null : parsed.vowel,
    tuning,
    oral_closure_area_function: closureArea,
    neutral_oral_closure_area_function: neutralClosureArea,
    nasal_path_area_function: nasalPath,
    oral_side_cavity: sideCavity,
    resonance_model: resonanceModel,
    level_matching: levelMatching,
    articulation_validity: nasalArticulationValidity(tuning),
    release_trajectory: releaseTrajectory,
    release_cue: releaseCue,
    routing: {
      nasal_path_gain: Number(effectiveNasalGain.toFixed(4)),
      requested_nasal_path_gain: Number(nasalGain.toFixed(4)),
      oral_leak_gain: Number(oralLeakGain.toFixed(4)),
      route_curve: parsed.moraic_nasal ? "static" : "smoothstep_equal_power_release",
      shared_glottal_source: !parsed.moraic_nasal,
      independent_path_normalization: parsed.moraic_nasal,
    },
    timing: {
      hold_duration_ms: tuning.hold_duration_ms,
      coarticulation_lead_ms: parsed.moraic_nasal ? 0 : tuning.coarticulation_lead_ms,
      coarticulation_start_ms: parsed.moraic_nasal
        ? null
        : Number((coarticulationStartSample * 1000 / sampleRate).toFixed(3)),
      oral_release_ms: parsed.moraic_nasal ? null : tuning.hold_duration_ms,
      vowel_target_ms: parsed.moraic_nasal
        ? null
        : Number((vowelTargetSample * 1000 / sampleRate).toFixed(3)),
      transition_ms: parsed.moraic_nasal ? 0 : tuning.transition_ms,
      transition_samples: appliedTransitionSamples,
      attack_fade_ms: tuning.attack_fade_ms,
      attack_fade_curve: "half_cosine",
      transition_model: parsed.moraic_nasal ? "nasal hold with release fade" : "shared-source anchored coarticulation with a closed internal posture lead, smooth oral release, and uninterrupted vowel continuation",
    },
    limitation: "The oral and nasal tubes share one glottal source and are mixed without independent path normalization, but they remain separate filters rather than one pressure-coupled branched waveguide.",
  };
  return {
    ...vowelAudio,
    samples,
    token,
    vowel: parsed.moraic_nasal ? null : parsed.vowel,
    consonant: nasalClass,
    nasal_model: nasalModel,
    onset_model: nasalModel,
    body_resonance_model: bodyResonanceModel,
  };
}

function synthesizeConsonantOnset(parsed, sampleRate, f0) {
  const consonant = parsed.consonant;
  const durationMs = parsed.moraic_nasal ? 180
    : ["s", "sh", "z", "j", "h", "f"].includes(consonant) ? 95
      : ["k", "g", "t", "d", "p", "b", "ch", "ts"].includes(consonant) ? 72
        : ["m", "n", "r", "y", "w"].includes(consonant) ? 64
          : 0;
  const count = Math.floor(sampleRate * durationMs / 1000);
  const onset = new Float32Array(count);
  if (!count) return onset;
  let seed = 17 + consonant.length * 31;
  const noise = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return ((seed / 0xffffffff) * 2 - 1);
  };
  let state1 = 0;
  let state2 = 0;
  for (let index = 0; index < count; index++) {
    const t = index / Math.max(1, count - 1);
    const attack = Math.min(1, t / 0.18);
    const release = Math.min(1, (1 - t) / 0.35);
    const env = Math.sin(Math.PI * Math.min(1, t)) * Math.min(attack, release);
    let sample = 0;
    if (parsed.moraic_nasal || ["m", "n"].includes(consonant)) {
      sample = Math.sin(2 * Math.PI * f0 * index / sampleRate) * 0.22 + Math.sin(2 * Math.PI * 260 * index / sampleRate) * 0.08;
      sample *= env;
    } else if (["s", "sh", "z", "j", "h", "f", "ch", "ts"].includes(consonant)) {
      const cutoff = ["sh", "ch", "j"].includes(consonant) ? 3600 : consonant === "f" || consonant === "h" ? 1800 : 5200;
      state1 += (noise() - state1) * 0.72;
      state2 += (state1 - state2) * clamp(cutoff / sampleRate, 0.02, 0.4);
      sample = (state1 - state2) * 0.42 * env;
      if (["z", "j"].includes(consonant)) sample += Math.sin(2 * Math.PI * f0 * index / sampleRate) * 0.08 * env;
    } else if (["k", "g", "t", "d", "p", "b"].includes(consonant)) {
      const burst = t < 0.24 ? Math.pow(1 - t / 0.24, 2) : 0;
      sample = noise() * burst * 0.55 + Math.sin(2 * Math.PI * f0 * index / sampleRate) * (["g", "d", "b"].includes(consonant) ? 0.05 : 0) * env;
    } else if (consonant === "r") {
      const tap = Math.exp(-Math.pow((t - 0.32) / 0.12, 2));
      sample = (Math.sin(2 * Math.PI * 1450 * index / sampleRate) * 0.18 + noise() * 0.08) * tap;
    } else if (["y", "w"].includes(consonant)) {
      const glideHz = consonant === "y" ? 1800 : 520;
      sample = Math.sin(2 * Math.PI * glideHz * index / sampleRate) * 0.10 * env;
    }
    onset[index] = sample;
  }
  return onset;
}

function onsetDescriptor(parsed) {
  return {
    schema_version: "cv_onset_placeholder_0.1",
    consonant: parsed.consonant,
    moraic_nasal: parsed.moraic_nasal,
    note: "Simple browser placeholder onset for dataset scaffolding; replace with the future temporal TTS/articulation layer.",
  };
}

function applyFade(samples, start, end, fadeOut = false) {
  const length = Math.max(1, end - start);
  for (let index = start; index < end; index++) {
    const t = (index - start) / length;
    const gain = fadeOut ? 1 - t : t;
    samples[index] *= clamp(gain, 0, 1);
  }
}

function applyHalfCosineFade(samples, start, end, fadeOut = false) {
  const length = Math.max(1, end - start);
  for (let index = start; index < end; index++) {
    const t = length > 1 ? (index - start) / (length - 1) : 1;
    const raisedCosine = 0.5 - 0.5 * Math.cos(Math.PI * clamp(t, 0, 1));
    samples[index] *= fadeOut ? 1 - raisedCosine : raisedCosine;
  }
}

async function exportSyllableDataset() {
  if (!Object.keys(state.constraints).length) analyze();
  const tokens = selectedSyllableTokens();
  const prefix = safeFilePart(els.datasetPrefixInput?.value || els.projectTitleInput.value || "voice_profile");
  const entries = [];
  const samples = [];
  for (const token of tokens) {
    const audio = synthesizeSyllable(token);
    const wavName = `wav/${prefix}_${token}.wav`;
    entries.push({ name: wavName, data: encodeWav(audio.samples, audio.sampleRate) });
    samples.push({
      id: token,
      file: wavName,
      token,
      vowel: audio.vowel,
      consonant: audio.consonant,
      sample_rate_hz: audio.sampleRate,
      duration_s: Number((audio.samples.length / audio.sampleRate).toFixed(4)),
      derived_f0_hz: audio.derived_f0_hz,
      area_function: areaFunctionDescriptor(audio.area_function),
      onset_model: audio.onset_model,
      nasal_model: audio.nasal_model ?? null,
    });
  }
  const metadata = {
    schema_version: "character_voice_lab_syllable_dataset_0.1",
    app_version: APP_VERSION,
    created_at: new Date().toISOString(),
    project_title: els.projectTitleInput.value.trim() || "voice_profile",
    language: els.ttsOutputLanguageInput?.value ?? "ja-JP",
    syllable_set: selectedSyllableSetKey(),
    synthesis_backend: "area_function_tube",
    profile: buildExport(),
    samples,
    ethics: "Generated synthetic audio and local design metadata only; no participant-level records, source recordings, or clinical images are included.",
  };
  entries.push({ name: "metadata.json", data: JSON.stringify(metadata, null, 2) });
  const blob = await projectPackage.createZip(entries);
  download(`${localDateStamp()}-${prefix}-${selectedSyllableSetKey()}-syllables.zip`, blob);
  if (els.datasetExportStatus) els.datasetExportStatus.textContent = `${tokens.length}件の音節サンプルを書き出しました。`;
}

function encodeWav(samples, sampleRate) {
  const bytesPerSample = 2;
  const blockAlign = bytesPerSample;
  const buffer = new ArrayBuffer(44 + samples.length * bytesPerSample);
  const view = new DataView(buffer);
  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + samples.length * bytesPerSample, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, "data");
  view.setUint32(40, samples.length * bytesPerSample, true);
  let offset = 44;
  for (const sample of samples) {
    const s = Math.max(-1, Math.min(1, sample));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }
  return new Blob([view], { type: "audio/wav" });
}

function writeString(view, offset, string) {
  for (let i = 0; i < string.length; i++) view.setUint8(offset + i, string.charCodeAt(i));
}

function download(name, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function saveJson() {
  if (!Object.keys(state.constraints).length) analyze();
  const blob = new Blob([JSON.stringify(buildExport(), null, 2)], { type: "application/json" });
  download(`${localDateStamp()}-${safeFilePart(els.projectTitleInput.value)}-profile.json`, blob);
}

async function saveProject() {
  if (!Object.keys(state.constraints).length) analyze();
  const title = els.projectTitleInput.value.trim() || "voice_profile";
  const imageEntries = [];
  const imageManifest = {};
  const names = {
    body: "full_body_front",
    face: "head_neck_front",
    profile: "head_neck_profile",
  };
  for (const target of Object.keys(names)) {
    const file = state.imageFiles[target];
    if (!file) continue;
    const extension = imageExtension(state.imageNames[target], file.type);
    const path = `images/${names[target]}.${extension}`;
    imageEntries.push({ name: path, data: file });
    imageManifest[target] = { path, original_name: state.imageNames[target], mime_type: file.type || projectPackage.mimeFromName(path) };
  }
  const manifest = {
    schema_version: "character_voice_designer_project_0.1",
    app: "CharacterVoiceDesigner",
    app_version: APP_VERSION,
    title,
    saved_at: new Date().toISOString(),
    profile: "profile.json",
    images: imageManifest,
    privacy: "Package contains only user-supplied reference images and local project variables. No external participant records are included.",
  };
  const profile = buildExport();
  const blob = await projectPackage.createZip([
    { name: "manifest.json", data: JSON.stringify(manifest, null, 2) },
    { name: "profile.json", data: JSON.stringify(profile, null, 2) },
    ...imageEntries,
  ]);
  download(`${localDateStamp()}-${safeFilePart(title)}.zip`, blob);
}

async function loadProjectFile(file) {
  if (!file) return;
  try {
    if (file.name.toLowerCase().endsWith(".json") || file.type === "application/json") {
      applyProfile(JSON.parse(await file.text()));
      setExtractionStatus("JSONプロファイルを読み込みました。画像はJSONに含まれません。");
      return;
    }
    const entries = await projectPackage.readZip(file);
    const manifestBytes = entries.get("manifest.json");
    const profileBytes = entries.get("profile.json");
    if (!profileBytes) throw new Error("profile.json が見つかりません。");
    const manifest = manifestBytes ? JSON.parse(projectPackage.text(manifestBytes)) : { images: {} };
    const profile = JSON.parse(projectPackage.text(profileBytes));
    if (manifest.title) els.projectTitleInput.value = manifest.title;
    for (const [target, imageInfo] of Object.entries(manifest.images ?? {})) {
      const bytes = entries.get(imageInfo.path);
      if (!bytes || !(target in state.images)) continue;
      const blob = new Blob([bytes], { type: imageInfo.mime_type || projectPackage.mimeFromName(imageInfo.path) });
      const imageFile = new File([blob], imageInfo.original_name || imageInfo.path.split("/").pop(), { type: blob.type });
      await loadImage(imageFile, target, false);
    }
    applyProfile(profile);
    setExtractionStatus(`プロジェクト「${manifest.title || file.name}」を読み込みました。`);
  } catch (error) {
    setExtractionStatus(`読み込み失敗: ${error.message}`);
  } finally {
    els.loadProjectInput.value = "";
  }
}

function normalizeLoadedVocalTractGeometry(savedGeometry) {
  const firstSection = savedGeometry?.sections?.[0];
  const has2_5DSections = Boolean(
    savedGeometry?.schema_version === "vocal_tract_geometry_0.2"
      && firstSection?.cross_section
      && Number.isFinite(firstSection.cross_section.sagittal_height_cm)
      && Number.isFinite(firstSection.cross_section.coronal_width_cm)
      && Number.isFinite(savedGeometry.cross_section_model?.pharyngeal_length_scale)
  );
  return has2_5DSections ? savedGeometry : buildVocalTractGeometry();
}

function applyProfile(data) {
  if (data.project?.title) els.projectTitleInput.value = data.project.title;
  const savedVoiceOverrides = {};
  for (const [key, item] of Object.entries(data.voice_control_profile?.evidence ?? {})) {
    if (Number.isFinite(Number(item?.design_override))) savedVoiceOverrides[key] = Number(item.design_override);
  }
  state.voiceControlOverrides = voiceControlProfile?.normalizeOverrides(savedVoiceOverrides) ?? {};
  const savedTtsConfiguration = data.tts_configuration ?? {};
  state.ttsCaptionManual = Boolean(savedTtsConfiguration.caption_override);
  state.activeCompiledIdentityId = savedTtsConfiguration.compiled_voice_identity_id || null;
  state.activeCompiledIdentity = null;
  if (els.ttsCaptionInput && state.ttsCaptionManual) els.ttsCaptionInput.value = savedTtsConfiguration.caption_override;
  if (els.ttsSeedInput && Number.isFinite(Number(savedTtsConfiguration.seed))) els.ttsSeedInput.value = String(savedTtsConfiguration.seed);
  if (els.ttsCaptionGuidanceInput && Number.isFinite(Number(savedTtsConfiguration.caption_guidance_scale))) {
    els.ttsCaptionGuidanceInput.value = String(savedTtsConfiguration.caption_guidance_scale);
  }
  const savedF0Postprocess = savedTtsConfiguration.f0_postprocess ?? {};
  if (els.ttsF0CorrectionEnabled && typeof savedF0Postprocess.enabled === "boolean") {
    els.ttsF0CorrectionEnabled.checked = savedF0Postprocess.enabled;
  }
  if (els.ttsF0CorrectionStrength && Number.isFinite(Number(savedF0Postprocess.strength))) {
    els.ttsF0CorrectionStrength.value = String(savedF0Postprocess.strength);
  }
  const savedTtsModel = savedTtsConfiguration.selected_model ?? data.inputs?.tts_model;
  if (els.ttsModelSelect && savedTtsModel) {
    if (!Array.from(els.ttsModelSelect.options ?? []).some((option) => option.value === savedTtsModel)) {
      const option = document.createElement("option");
      option.value = savedTtsModel;
      option.textContent = savedTtsModel;
      els.ttsModelSelect.appendChild(option);
    }
    els.ttsModelSelect.value = savedTtsModel;
  }
  const rawSavedConstraints = data.voice_constraints ?? null;
  const rawSavedOverrides = data.constraint_overrides ?? overridesFromConstraints(rawSavedConstraints);
  const migratedDevelopmentControls = migrateLegacyDevelopmentControls(rawSavedConstraints, rawSavedOverrides);
  const initialSavedConstraints = migratedDevelopmentControls.constraints;
  const initialSavedOverrides = migratedDevelopmentControls.overrides;
  const migratedGesture = migrateLegacyIllustrationGestureInput(data, initialSavedConstraints, initialSavedOverrides);
  const savedConstraints = migratedGesture.constraints;
  const savedOverrides = migratedGesture.overrides;
  const savedPerformanceRangeOverrides = withoutReadOnlyDerivedOverrides(withoutRetiredConstraints(
    data.performance_range_overrides ?? performanceRangeOverridesFromLegacyConstraints(savedConstraints)
  ));
  if (data.inputs) {
    els.ageInput.value = data.inputs.age ?? els.ageInput.value;
    els.sexInput.value = data.inputs.sex_reference_class ?? els.sexInput.value;
    els.heightInput.value = data.inputs.height_cm ?? els.heightInput.value;
    els.weightInput.value = data.inputs.weight_kg ?? els.weightInput.value;
    els.bodyFatInput.value = data.inputs.body_fat_percent ?? els.bodyFatInput.value;
    els.primaryLanguageInput.value = data.inputs.primary_language ?? els.primaryLanguageInput.value;
    if (els.phoneticTargetProfileInput) {
      const legacyFallback = defaultPhoneticTargetProfileId(data.inputs.primary_language ?? els.primaryLanguageInput.value);
      els.phoneticTargetProfileInput.value = normalizePhoneticTargetProfile(data.inputs.phonetic_target_profile ?? legacyFallback, els.primaryLanguageInput.value);
    }
    const population = data.inputs.morphology_reference_population ?? data.inputs.reference_population;
    els.populationInput.value = population === "Japanese" ? "Japanese_public_aggregate" : population === "Generic" ? "General" : population ?? els.populationInput.value;
    if (els.referenceImageStyleInput) els.referenceImageStyleInput.value = normalizeReferenceImageStyle(data.inputs.reference_image_style);
    els.dataSourceInput.value = data.inputs.data_source_set ?? els.dataSourceInput.value;
    if (els.ttsOutputLanguageInput) els.ttsOutputLanguageInput.value = data.inputs.tts_output_language ?? els.ttsOutputLanguageInput.value;
    if (els.syllableSetInput) els.syllableSetInput.value = SYLLABLE_SETS[data.inputs.syllable_dataset_set] ? data.inputs.syllable_dataset_set : els.syllableSetInput.value;
    if (els.datasetPrefixInput) els.datasetPrefixInput.value = data.inputs.dataset_prefix ?? els.projectTitleInput.value ?? els.datasetPrefixInput.value;
    const savedImageWeight = Number(data.inputs.image_analysis_weight ?? data.inputs.global_image_weight);
    if (els.globalImageWeight) {
      els.globalImageWeight.value = Number.isFinite(savedImageWeight) ? clamp(savedImageWeight, 0, 1) : 0.7;
    }
  }
  if (data.landmarks) {
    state.landmarks = {
      body: { ...state.landmarks.body, ...(data.landmarks.body ?? {}) },
      face: { ...state.landmarks.face, ...(data.landmarks.face ?? {}) },
      profile: { ...state.landmarks.profile, ...(data.landmarks.profile ?? {}) },
    };
  }
  if (data.landmark_extraction) state.extractionReports = data.landmark_extraction;
  state.constraintOverrides = savedOverrides;
  state.performanceRangeOverrides = savedPerformanceRangeOverrides;
  state.vowelAreaTuning = normalizeLoadedAreaTuning(data.vowel_area_tuning);
  state.vowelWidthTuning = normalizeLoadedWidthTuning(data.vowel_width_tuning);
  state.auditoryEvaluationLog = normalizeAuditoryEvaluationLog(data.auditory_evaluation_log);
  state.nasalTuning = normalizeLoadedNasalTuning(data.nasal_articulation_tuning);
  state.nasalPreviewDiagnostics = {};
  state.nasalEvaluationLog = normalizeNasalEvaluationLog(data.nasal_auditory_evaluation_log);
  analyze();
  if (data.integrated_features) state.features = data.integrated_features;
  if (data.prior_resolution) state.priorResolution = data.prior_resolution;
  if (savedConstraints) state.constraints = mergeLoadedVoiceConstraints(state.constraints, savedConstraints);
  if (savedConstraints && !data.constraint_overrides) state.constraintOverrides = overridesFromConstraints(state.constraints);
  state.constraintOverrides = withoutReadOnlyDerivedOverrides(withoutRetiredConstraints(state.constraintOverrides));
  refreshDerivedConstraintCenters();
  state.vocalTractGeometry = normalizeLoadedVocalTractGeometry(data.vocal_tract_geometry);
  renderDetailControls();
  renderFeatureTable();
  renderConstraints();
  renderSyllableDatasetPreview();
  updateTractEditStatus();
  renderAuditoryEvaluation();
  renderNasalCalibration();
  renderVoiceDesignerControls();
  draw();
}

function localDateStamp(date = new Date()) {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("");
}

function safeFilePart(value) {
  const cleaned = String(value || "voice_profile").trim().replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-").replace(/\s+/g, "-").replace(/-+/g, "-");
  return cleaned.slice(0, 64) || "voice_profile";
}

function imageExtension(name, mimeType) {
  const fromName = String(name || "").split(".").pop()?.toLowerCase();
  if (["png", "jpg", "jpeg", "webp", "gif", "bmp"].includes(fromName)) return fromName;
  return { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif", "image/bmp": "bmp" }[mimeType] ?? "png";
}

function mountCompositionGuide() {
  const guide = document.querySelector(".composition-guide");
  if (guide && els.compositionGuideMount && guide.parentElement !== els.compositionGuideMount) {
    els.compositionGuideMount.appendChild(guide);
  }
}

function mountArticulationWorkspaces() {
  const tractAnalysis = document.querySelector(".tract-analysis");
  const nasalCalibration = document.querySelector(".nasal-calibration");
  if (nasalCalibration && els.consonantCalibrationMount && nasalCalibration.parentElement !== els.consonantCalibrationMount) {
    els.consonantCalibrationMount.appendChild(nasalCalibration);
  }
  if (tractAnalysis && els.vowelCalibrationMount && tractAnalysis.parentElement !== els.vowelCalibrationMount) {
    els.vowelCalibrationMount.appendChild(tractAnalysis);
  }
}

function installVoiceIdentityHandlers() {
  if (!els.compileVoiceIdentityBtn || els.compileVoiceIdentityBtn.dataset.handlerInstalled === "true") {
    return;
  }
  els.compileVoiceIdentityBtn.dataset.handlerInstalled = "true";
  els.refreshVoiceIdentitiesBtn?.addEventListener("click", () => refreshVoiceIdentities());
  els.compiledVoiceIdentitySelect?.addEventListener("change", (event) => {
    selectCompiledVoiceIdentity(event.target.value).catch((error) =>
      setVoiceIdentityStatus(`音声同一性を選択できません: ${error.message}`, true),
    );
  });
  els.identitySpeakerSelect?.addEventListener("input", (event) => {
    state.selectedIdentitySpeakerId = event.target.value || null;
    renderVoiceIdentityWorkspace();
  });
  els.identityStyleSelect?.addEventListener("input", renderVoiceIdentityWorkspace);
  els.identitySpeakerUpload?.addEventListener("change", async (event) => {
    try {
      const registered = await registerSpeakerConditionFiles(event.target.files);
      if (registered.length) {
        state.selectedIdentitySpeakerId = registered[registered.length - 1];
      }
      await refreshVoiceIdentities({ silent: true });
      if (registered.length && els.identitySpeakerSelect) {
        els.identitySpeakerSelect.value = state.selectedIdentitySpeakerId;
      }
      renderVoiceIdentityWorkspace();
      setVoiceIdentityStatus(`${registered.length}件のSpeaker状態を登録しました。`);
    } catch (error) {
      setVoiceIdentityStatus(`Speaker状態を登録できません: ${error.message}`, true);
    } finally {
      event.target.value = "";
    }
  });
  els.identityCalibrationUpload?.addEventListener("change", async (event) => {
    const uploaded = [];
    try {
      for (const file of Array.from(event.target.files || [])) {
        const calibration = await uploadVoiceCalibration(file);
        if (calibration) uploaded.push(calibration.id);
      }
      let reachedLimit = false;
      for (const id of uploaded) {
        if (state.voiceIdentityCalibrationIds.has(id)) continue;
        if (state.voiceIdentityCalibrationIds.size >= MAX_CALIBRATION_RESOURCES) {
          reachedLimit = true;
          break;
        }
        state.voiceIdentityCalibrationIds.add(id);
      }
      await refreshVoiceIdentities({ silent: true });
      renderVoiceIdentityWorkspace();
      setVoiceIdentityStatus(
        reachedLimit
          ? `校正WAVを登録しました。選択は最大${MAX_CALIBRATION_RESOURCES}件です。`
          : `${uploaded.length}件の校正音声を登録しました。`,
        reachedLimit,
      );
    } catch (error) {
      setVoiceIdentityStatus(`校正音声を登録できません: ${error.message}`, true);
    } finally {
      event.target.value = "";
    }
  });
  els.compileVoiceIdentityBtn.addEventListener("click", () => {
    compileVoiceIdentity().catch((error) =>
      setVoiceIdentityStatus(voiceIdentityApiErrorMessage(error, "コンパイル"), true),
    );
  });
}

function init() {
  installVoiceIdentityHandlers();
  refreshLandmarkSelect();
  mountCompositionGuide();
  mountArticulationWorkspaces();
  renderLandmarkReference();
  renderPublicationReferences();
  installExperimentHandlers();
  setExperimentTool(state.activeExperimentTool);
  analyze();
  for (const button of els.tabButtons) {
    button.addEventListener("click", () => setActiveTab(button.dataset.tabTarget));
  }
  els.bodyImageInput.addEventListener("change", (e) => loadImage(e.target.files[0], "body").catch((error) => setExtractionStatus(error.message)));
  els.faceImageInput.addEventListener("change", (e) => loadImage(e.target.files[0], "face").catch((error) => setExtractionStatus(error.message)));
  els.profileImageInput.addEventListener("change", (e) => loadImage(e.target.files[0], "profile").catch((error) => setExtractionStatus(error.message)));
  els.bodyModeBtn.addEventListener("click", () => setMode("body"));
  els.faceModeBtn.addEventListener("click", () => setMode("face"));
  els.landmarkSelect.addEventListener("input", () => updateLandmarkHint(els.landmarkSelect.value, state.mode, "selected"));
  els.profileLandmarkSelect.addEventListener("input", () => updateLandmarkHint(els.profileLandmarkSelect.value, "profile", "selected"));
  els.bodyImageCanvas.addEventListener("pointerdown", (event) => handleFrontPointerDown(event, "body"));
  els.bodyImageCanvas.addEventListener("pointermove", (event) => handleFrontPointerMove(event, "body"));
  els.bodyImageCanvas.addEventListener("pointerup", handleFrontPointerUp);
  els.bodyImageCanvas.addEventListener("pointercancel", handleFrontPointerUp);
  els.bodyImageCanvas.addEventListener("pointerleave", (event) => handleFrontPointerLeave(event, "body"));
  els.faceImageCanvas.addEventListener("pointerdown", (event) => handleFrontPointerDown(event, "face"));
  els.faceImageCanvas.addEventListener("pointermove", (event) => handleFrontPointerMove(event, "face"));
  els.faceImageCanvas.addEventListener("pointerup", handleFrontPointerUp);
  els.faceImageCanvas.addEventListener("pointercancel", handleFrontPointerUp);
  els.faceImageCanvas.addEventListener("pointerleave", (event) => handleFrontPointerLeave(event, "face"));
  els.profileImageCanvas.addEventListener("pointerdown", handleProfilePointerDown);
  els.profileImageCanvas.addEventListener("pointermove", handleProfilePointerMove);
  els.profileImageCanvas.addEventListener("pointerup", handleProfilePointerUp);
  els.profileImageCanvas.addEventListener("pointercancel", handleProfilePointerUp);
  els.profileImageCanvas.addEventListener("pointerleave", handleProfilePointerLeave);
  els.tractProfileCanvas?.addEventListener("pointerdown", handleAreaTuningPointerDown);
  els.tractProfileCanvas?.addEventListener("pointermove", handleAreaTuningPointerMove);
  els.tractProfileCanvas?.addEventListener("pointerup", handleAreaTuningPointerUp);
  els.tractProfileCanvas?.addEventListener("pointercancel", handleAreaTuningPointerUp);
  els.tractProfileCanvas?.addEventListener("pointerleave", handleAreaTuningPointerUp);
  els.tractProfileCanvas?.addEventListener("keydown", handleTractTuningKeyDown);
  els.nasalProfileCanvas?.addEventListener("pointerdown", handleNasalProfilePointerDown);
  els.nasalProfileCanvas?.addEventListener("pointermove", handleNasalProfilePointerMove);
  els.nasalProfileCanvas?.addEventListener("pointerup", handleNasalProfilePointerUp);
  els.nasalProfileCanvas?.addEventListener("pointercancel", handleNasalProfilePointerUp);
  els.nasalProfileCanvas?.addEventListener("pointerleave", handleNasalProfilePointerUp);
  els.nasalProfileCanvas?.addEventListener("keydown", handleNasalProfileKeyDown);
  for (const el of [els.ageInput, els.sexInput, els.heightInput, els.weightInput, els.bodyFatInput, els.primaryLanguageInput, els.phoneticTargetProfileInput, els.populationInput, els.referenceImageStyleInput, els.dataSourceInput].filter(Boolean)) {
    el.addEventListener("input", analyze);
  }
  els.globalImageWeight?.addEventListener("input", renderImageWeightRecalculationState);
  els.projectTitleInput.addEventListener("input", renderConstraints);
  els.profileDirectionInput.addEventListener("input", analyze);
  for (const toggle of [
    els.bodyShowLandmarks,
    els.faceShowLandmarks,
    els.profileShowBaseLandmarks,
    els.profileShowArticulationLandmarks,
    els.profileShowVocalTract,
  ]) {
    toggle?.addEventListener("change", draw);
  }
  els.analyzeBtn.addEventListener("click", runBasicAnalysis);
  els.recalculateBtn?.addEventListener("click", runDetailRecalculation);
  els.playSampleButton.addEventListener("click", playVowel);
  els.vowelSelect.addEventListener("input", () => {
    state.lastWav = null;
    state.selectedTractTuningHandle = null;
    updateTractEditStatus();
    renderAuditoryEvaluation();
    draw();
  });
  els.resetAreaTuningBtn?.addEventListener("click", () => resetAreaTuning(selectedVowel()));
  els.editAreaModeBtn?.addEventListener("click", () => setTractEditMode("area"));
  els.editWidthModeBtn?.addEventListener("click", () => setTractEditMode("width"));
  els.nudgeTractDownBtn?.addEventListener("click", () => nudgeSelectedTractPoint(-0.01));
  els.nudgeTractUpBtn?.addEventListener("click", () => nudgeSelectedTractPoint(0.01));
  els.playUntunedVowelBtn?.addEventListener("click", () => playVowelCalibrationVariant(false));
  els.playTunedVowelBtn?.addEventListener("click", () => playVowelCalibrationVariant(true));
  els.phonemeClarityInput?.addEventListener("input", updateAuditoryRatingOutputs);
  els.targetMatchInput?.addEventListener("input", updateAuditoryRatingOutputs);
  els.recordAuditoryEvaluationBtn?.addEventListener("click", recordAuditoryEvaluation);
  els.nasalTokenSelect?.addEventListener("input", () => {
    renderNasalCalibration();
    draw();
  });
  for (const [input, field] of [
    [els.nasalClosurePositionInput, "closure_position"],
    [els.nasalClosureAreaInput, "closure_area_cm2"],
    [els.nasalClosureWidthInput, "closure_width"],
    [els.nasalVpOpeningInput, "velopharyngeal_opening"],
    [els.nasalPathGainInput, "nasal_path_gain"],
    [els.nasalDampingInput, "branch_damping"],
    [els.nasalDurationInput, "hold_duration_ms"],
    [els.nasalCoarticulationLeadInput, "coarticulation_lead_ms"],
    [els.nasalTransitionInput, "transition_ms"],
    [els.nasalAttackFadeInput, "attack_fade_ms"],
  ]) {
    input?.addEventListener("input", () => updateNasalTuningFromInput(field, input));
  }
  els.playUntunedNasalBtn?.addEventListener("click", () => playNasalCalibrationVariant(false));
  els.playTunedNasalBtn?.addEventListener("click", () => playNasalCalibrationVariant(true));
  els.resetNasalTuningBtn?.addEventListener("click", () => resetNasalTuning());
  els.nasalClarityInput?.addEventListener("input", updateNasalRatingOutputs);
  els.nasalTransitionRatingInput?.addEventListener("input", updateNasalRatingOutputs);
  els.recordNasalEvaluationBtn?.addEventListener("click", recordNasalEvaluation);
  els.syllableSetInput?.addEventListener("input", () => {
    renderSyllableDatasetPreview();
    renderConstraints();
  });
  els.ttsOutputLanguageInput?.addEventListener("input", renderConstraints);
  els.datasetPrefixInput?.addEventListener("input", renderConstraints);
  els.resetVoiceControlOverridesBtn?.addEventListener("click", () => {
    state.voiceControlOverrides = {};
    renderVoiceDesignerControls();
    renderConstraints();
  });
  els.refreshTtsModelsBtn?.addEventListener("click", refreshAudioCppModels);
  els.ttsCaptionInput?.addEventListener("input", () => {
    state.ttsCaptionManual = true;
    renderTtsRequestSummary();
    renderConstraints();
  });
  els.regenerateTtsCaptionBtn?.addEventListener("click", () => {
    state.ttsCaptionManual = false;
    renderVoiceDesignerDerivedViews();
    renderConstraints();
  });
  for (const input of [
    els.ttsModelSelect,
    els.ttsSeedInput,
    els.ttsCaptionGuidanceInput,
    els.ttsF0CorrectionEnabled,
    els.ttsF0CorrectionStrength,
  ].filter(Boolean)) {
    input.addEventListener("input", () => {
      renderVoiceDesignerDerivedViews();
      renderConstraints();
    });
  }
  els.ttsDemoTextInput?.addEventListener("input", renderTtsRequestSummary);
  els.generateTtsDemoBtn?.addEventListener("click", generateTtsDemo);
  els.downloadTtsDemoBtn?.addEventListener("click", downloadTtsDemo);
  els.exportVoiceControlProfileBtn?.addEventListener("click", exportVoiceControlProfile);
  els.previewSyllableBtn?.addEventListener("click", () => playSelectedSyllablePreview().catch((error) => {
    if (els.datasetExportStatus) els.datasetExportStatus.textContent = `再生失敗: ${error.message}`;
  }));
  els.exportSyllableDatasetBtn?.addEventListener("click", () => exportSyllableDataset().catch((error) => {
    if (els.datasetExportStatus) els.datasetExportStatus.textContent = `書き出し失敗: ${error.message}`;
  }));
  els.saveWavBtn.addEventListener("click", () => {
    const vowel = selectedVowel();
    const audio = synthesizeVowel(vowel);
    state.lastWav = encodeWav(audio.samples, audio.sampleRate);
    download(`preview_${vowel}.wav`, state.lastWav);
  });
  els.saveJsonBtn.addEventListener("click", saveJson);
  els.saveProjectBtn.addEventListener("click", () => saveProject().catch((error) => setExtractionStatus(`保存失敗: ${error.message}`)));
  els.loadProjectBtn.addEventListener("click", () => els.loadProjectInput.click());
  els.loadProjectInput.addEventListener("change", (e) => loadProjectFile(e.target.files[0]));
  updateLandmarkHint(els.landmarkSelect.value, state.mode, "selected");
  renderSyllableDatasetPreview();
  updateTractEditStatus();
  renderAuditoryEvaluation();
  renderNasalCalibration();
  renderVoiceDesignerControls();
  draw();
}

init();

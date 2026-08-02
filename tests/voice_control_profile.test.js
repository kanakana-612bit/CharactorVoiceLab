const fs = require("fs");
const path = require("path");

global.window = global;
const projectRoot = path.resolve(__dirname, "..");
eval(fs.readFileSync(path.join(projectRoot, "voice_control_profile.js"), "utf8"));

const context = {
  app_version: "0.2",
  project_title: "test_voice",
  age: 17,
  sex_reference_class: "female",
  constraints: {
    f0_mean_hz: { center: 225 },
    glottal_breathiness: { center: 0.12 },
    glottal_spectral_tilt_db: { center: 13 },
    vocal_tract_length_cm: { center: 14.2, statistics: { reference_center: 15 } },
    respiratory_support: { center: 1.04 },
    maximum_ventilation_l_min: { center: 105, statistics: { reference_center: 100 } },
    articulatory_range_utilization: { center: 1.08 },
    vocal_fold_spring_constant: {
      center: 1,
      performance_control_range: { min: 0.72, max: 1.32 },
    },
  },
  design_overrides: { timbre_brightness: 0.82, speaking_rate: 1.2 },
};

const profile = window.CVD_PROFILE.build(context);
if (profile.schema_version !== "character_voice_identity_function_0.1") {
  throw new Error("Unexpected VoiceControlProfile schema");
}
if (profile.evidence.timbre_brightness.design_override !== 0.82
  || profile.evidence.timbre_brightness.appearance_estimate === 0.82) {
  throw new Error("Appearance estimate and design override were not kept separate");
}
if (profile.identity_anchor.speaking_rate !== 1.2) {
  throw new Error("Effective speaking-rate override was not applied");
}
if (!profile.control_functions.pitch.expression.includes("anchor_hz")
  || !profile.tts_adapters.audio_cpp.caption_ja.includes("若い女性")
  || profile.tts_adapters.audio_cpp.caption_ja.includes("高めの声")) {
  throw new Error("Intermediate functions or deterministic caption are missing");
}

const request = window.CVD_PROFILE.buildAudioCppRequest(profile, {
  model: "irodori-vdes",
  text: "テストです。",
  seed: 42,
  num_inference_steps: 40,
  caption_guidance_scale: 3,
  f0_correction_enabled: true,
  f0_correction_strength: 1,
});
if (request.model !== "irodori-vdes" || request.options.no_ref !== true || request.options.caption.length < 10) {
  throw new Error("audio.cpp VoiceDesign request mapping is incomplete");
}
if (Math.abs(request.options.duration_scale - (1 / 1.2)) > 0.001) {
  throw new Error("Speaking rate was not mapped to Irodori duration_scale");
}
if (!request.postprocess.f0.enabled || request.postprocess.f0.target_hz !== 225) {
  throw new Error("Direct F0 target was not mapped to the WORLD postprocessor");
}

console.log("VoiceControlProfile and audio.cpp adapter tests passed");

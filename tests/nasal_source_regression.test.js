const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { performance } = require("node:perf_hooks");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "app.js"), "utf8").replace(/\ninit\(\);\s*$/, "");
const elements = new Map();
const element = (id) => {
  if (!elements.has(id)) elements.set(id, {
    id, value: "", checked: false, options: [], dataset: {}, childNodes: [],
    classList: { add() {}, remove() {}, toggle() {} }, style: { setProperty() {} },
    addEventListener() {}, setAttribute() {}, removeAttribute() {},
    append(...nodes) { this.childNodes.push(...nodes); },
    appendChild(node) { this.childNodes.push(node); return node; },
    replaceChildren(...nodes) { this.childNodes = nodes; },
    querySelector() { return null; },
  });
  return elements.get(id);
};
const context = globalThis;
Object.assign(context, {
  console, performance, setTimeout, clearTimeout, Blob, TextEncoder, TextDecoder,
  document: {
    getElementById: element, querySelectorAll: () => [], querySelector: () => null,
    createElement: (tag) => element(`created_${tag}_${elements.size}`),
    createTextNode: (text) => ({ textContent: String(text) }),
  },
});
context.window = context;
for (const file of ["reference_data.js", "local_pdf_growth_priors.js", "prior_resolver.js", "project_package.js", "landmark_schema.js", "voice_control_profile.js"]) {
  eval(fs.readFileSync(path.join(root, file), "utf8"));
}
// A lexical evaluator avoids VM-global proxy overhead in per-sample physics.
const execute = eval(`(() => { ${source}\nreturn (code) => eval(code); })()`);
execute(`
els.heightInput.value = 158;
els.sexInput.value = "female";
els.primaryLanguageInput.value = "ja-JP";
els.phoneticTargetProfileInput.value = "ja_JP_standard_neutral_aggregate_0_1";
els.ageInput.value = 17;
els.weightInput.value = 47;
els.populationInput.value = "General";
els.referenceImageStyleInput.value = "illustration";
els.profileDirectionInput.value = "right";
els.vowelSelect.value = "a";
els.nasalTokenSelect.value = "ma";
state.features = {
  neck_root_width_cm: { integrated: 13.3 },
  jaw_width_cm: { integrated: 11.1 },
  mouth_width_cm: { integrated: 4.85 },
};
const testCenters = {
  vocal_tract_length_cm: 15.5, pharyngeal_length_scale: 1,
  glottal_open_quotient: 0.58, glottal_speed_quotient: 1.8, glottal_return_phase: 0.14,
  glottal_spectral_tilt_db: 12, glottal_breathiness: 0.08,
  glottal_volume_velocity_drive: 0.86, glottal_flow_smoothing: 0.34, glottal_flow_inertance: 0.14,
  f0_reference_hz: 180, f0_mean_hz: 180, vocal_fold_spring_constant: 1, baseline_muscle_tension: 1,
  vocal_tract_wall_loss: 0.018, vocal_tract_viscothermal_loss: 0.012,
  vocal_tract_high_frequency_damping: 0.28, vocal_tract_wall_compliance: 0.18,
  vocal_tract_resonance_broadening: 0.26, lip_radiation_smoothing: 0.32,
  nasal_cavity_volume_cm3: 20, paranasal_sinus_volume_cm3: 24,
  sinus_neck_area_cm2: 0.24, sinus_neck_length_cm: 1.2, sinus_coupling: 0.25, sinus_damping: 0.68,
  velopharyngeal_loss_coupling: 0.18, piriform_fossa_loss_coupling: 0.14,
  piriform_fossa_frequency_hz: 3700, nasal_branch_damping: 0.72,
  body_resonance_coupling: 0.25, body_resonance_frequency_hz: 210, body_resonance_gain_db: 4,
  thoracic_volume_l: 4.6, abdominal_volume_l: 6.3,
  predicted_vc_l: 3.1, predicted_fvc_l: 3.2, predicted_fev1_l: 2.9, predicted_pef_l_s: 5.6,
  maximum_ventilation_l_min: 95, maximum_respiratory_pressure_pa: 900, respiratory_support: 1,
  articulatory_range_utilization: 1, tongue_dorsum_range_utilization: 1, labial_transverse_range_utilization: 1,
  palatal_vault_scale: 1, lip_aperture_aspect_scale: 1, tongue_groove_capacity: 1,
  motor_control_precision: 1, coarticulation_strength: 0.58, phonological_contrast_maturity: 1,
};
state.constraints = Object.fromEntries(Object.entries(testCenters).map(([key, center]) => [key, { center }]));
state.vocalTractGeometry = buildVocalTractGeometry();
`);

function run(code) { return execute(code); }

// Feedback must reach the oscillator exactly once; prescribed-source modulation
// is a separate legacy path, not a second feedback stage on the new source.
run(`
globalThis.originalOscillator = createReducedTwoMassGlottalOscillator;
globalThis.originalPrescribedSource = synthesizeTubeSourceSamples;
globalThis.oscillatorCalls = [];
createReducedTwoMassGlottalOscillator = () => ({
  metadata: { schema_version: "test_oscillator" },
  step: (load, index) => { oscillatorCalls.push([load, index]); return 0.2 + load; },
});
synthesizeTubeSourceSamples = () => { throw new Error("Unexpected LF fallback"); };
globalThis.boundary = createNasalGlottalBoundary({ sampleCount: 4, selfOscillatingSourceEnabled: true }, 44100, 0.7);
globalThis.boundaryOutput = boundary.step(0.3, 0);
globalThis.uncoupled = createNasalGlottalBoundary({ sampleCount: 4, selfOscillatingSourceEnabled: true, sourceTractCouplingEnabled: false }, 44100, 0.7);
uncoupled.step(0.4, 1);
createReducedTwoMassGlottalOscillator = originalOscillator;
synthesizeTubeSourceSamples = originalPrescribedSource;
`);
assert.ok(Math.abs(context.boundaryOutput - 0.71) < 1e-12);
assert.deepEqual(JSON.parse(JSON.stringify(context.oscillatorCalls)), [[0.3, 0], [0, 1]]);
assert.equal(context.boundary.metadata.continuous_state, true);
assert.ok(Math.abs(context.boundary.source[0] - 0.5) < 1e-6);

run(`
globalThis.legacyBoundary = createNasalGlottalBoundary({
  sampleCount: 2, selfOscillatingSourceEnabled: false,
  sourceSamples: new Float32Array([0.1, 0.2]), sourceTractCouplingEnabled: false,
}, 44100, 0.7);
globalThis.legacyOutput = legacyBoundary.step(0.3, 1);
`);
assert.ok(Math.abs(context.legacyOutput - 0.41) < 1e-6);
assert.equal(context.legacyBoundary.metadata.active_model.schema_version, "lf_like_glottal_source_legacy_0.1");

let lastRenderScript;
for (const sampleRate of [44100, 48000]) {
  for (const factor of [1, 2]) {
    for (const solver of ["synthesizeBranchedNasalOralTube", "synthesizeCoronalMultiChannelNasalOralTube"]) {
      context.testSampleRate = sampleRate;
      context.CVD_PHYSICAL_TUBE_OVERSAMPLING = factor;
      lastRenderScript = `(() => {
        const count = Math.round(15.5 * testSampleRate / 35000);
        const oral = Array.from({ length: count }, (_, index) => index / count > 0.8 && index / count < 0.9 ? 0.008 : 2);
        const nasal = Array(Math.round(12 * testSampleRate / 35000)).fill(1.4);
        const options = oralReleaseTubeSynthesisOptions(Math.round(testSampleRate * 0.12), testSampleRate, state.constraints, count, "a", 15.5);
        options.areaTrajectory = { keyframes: [
          { sample: 0, areas_cm2: oral },
          { sample: Math.round(testSampleRate * 0.05), areas_cm2: oral },
          { sample: Math.round(testSampleRate * 0.08), areas_cm2: Array(count).fill(2) },
        ] };
        options.velopharyngealAreaTrajectory = { keyframes: [
          { sample: 0, area_cm2: 0.4 },
          { sample: Math.round(testSampleRate * 0.08), area_cm2: 0.008 },
        ] };
        return ${solver}(oral, nasal, options);
      })()`;
      const result = run(lastRenderScript);
      assert.equal(result.samples.length, Math.round(sampleRate * 0.12));
      for (const field of ["samples", "glottal_source", "glottal_return_pressure", "oral_radiation", "nasal_radiation"]) {
        assert.equal(result[field].length, result.samples.length, field);
        assert.ok(result[field].every(Number.isFinite), `${solver} ${sampleRate}/${factor} ${field}`);
        assert.ok(result[field].some((value) => Math.abs(value) > 1e-8), `${field} must not be silent`);
      }
      assert.equal(result.source_model.active_model.schema_version, "reduced_two_mass_glottal_source_0.2");
      assert.equal(result.source_model.integration_sample_rate_hz, sampleRate * factor);
      assert.match(result.source_model.source_tract_interaction_model.model, /oscillator/);
      context.latestResult = result;
    }
  }
}
const repeated = run(lastRenderScript);
assert.deepEqual(repeated.samples, context.latestResult.samples, "Fixed source and geometry must be reproducible");

const diagnostic = run(`nasalStageDiagnostics(latestResult, latestResult.samples, testSampleRate, 180, [
  ["closed_hold", "hold", 1200, 2400],
  ["oral_release", "release", 2400, 2450],
  ["vowel_sustain", "vowel", 4000, 5760],
])`);
assert.equal(diagnostic.stages.length, 3);
assert.equal(diagnostic.stages[1].observed_f0_hz, null);
assert.equal(diagnostic.stages[1].f0_status, "window_too_short");
for (const stage of diagnostic.stages) {
  assert.ok(stage.return_pressure_rms > 0);
  assert.ok(stage.nasal_component_energy_fraction >= 0 && stage.nasal_component_energy_fraction <= 1);
}
const silent = run(`nasalStageDiagnostics({
  oral_radiation: new Float32Array(5000), nasal_radiation: new Float32Array(5000),
  glottal_source: new Float32Array(5000), glottal_return_pressure: new Float32Array(5000),
  topology: { nasal_radiation_scale: 0.3 },
}, new Float32Array(5000), 44100, 180, [["closed_hold", "hold", 0, 5000]])`);
assert.equal(silent.stages[0].observed_f0_hz, null);
assert.equal(silent.stages[0].nasal_component_energy_fraction, null);

assert.equal(run(`oralReleaseTubeSynthesisOptions(1000, 44100, state.constraints, 20, "a", 15.5).selfOscillatingSourceEnabled`), true);
assert.equal(run(`oralReleaseTubeSynthesisOptions(1000, 44100, state.constraints, 20, "a", 15.5, { self_oscillating_source: false }).selfOscillatingSourceEnabled`), false);
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
for (const id of ["compareNasalPairBtn", "exportNasalPairBtn", "nasalStageDiagnostics"]) assert.ok(html.includes(`id="${id}"`));
assert.match(html, /data-tab-target="consonantTab"/);

async function main() {
  context.fixtureDiagnostic = diagnostic;
  run(`
    globalThis.originalSyllable = synthesizeSyllable;
    globalThis.originalNasalCalibration = renderNasalCalibration;
    globalThis.originalDownload = download;
    globalThis.fixtureTokens = [];
    synthesizeSyllable = (token, options) => {
      fixtureTokens.push({ token, manual: options.manualTuning });
      return { token, sampleRate: 44100, samples: new Float32Array(24), nasal_model: { stage_diagnostic: fixtureDiagnostic } };
    };
    renderNasalCalibration = () => renderNasalStageDiagnostics();
    download = (filename, blob) => { globalThis.fixtureDownload = { filename, blob }; };
  `);
  await run("compareNasalPair()");
  assert.deepEqual(context.fixtureTokens, [{ token: "ma", manual: false }, { token: "na", manual: false }]);
  assert.equal(run("state.nasalPairComparison.report.conditions.phonetic_target_profile"), "ja_JP_standard_neutral_aggregate_0_1");
  assert.equal(element("compareNasalPairBtn").disabled, false);
  assert.equal(element("exportNasalPairBtn").disabled, false);
  assert.equal(element("nasalStageDiagnostics").childNodes[1].childNodes[1].childNodes.length, 6);
  await run("exportNasalPair()");
  assert.match(context.fixtureDownload.filename, /nasal-mn-a\.zip$/);
  assert.ok(context.fixtureDownload.blob.size > 0);
  run("state.constraints.glottal_breathiness.center += 0.01; renderNasalStageDiagnostics()");
  assert.ok(element("nasalPairStatus").textContent.includes("再比較"));
  run("synthesizeSyllable = () => { throw new Error('test render failure'); }");
  await run("compareNasalPair()");
  assert.equal(element("compareNasalPairBtn").disabled, false);
  assert.match(element("nasalPairStatus").textContent, /test render failure/);
  run(`
    state.constraints.glottal_breathiness.center -= 0.01;
    synthesizeSyllable = originalSyllable;
    renderNasalCalibration = originalNasalCalibration;
    download = originalDownload;
    state.nasalPairComparison = null;
    renderNasalStageDiagnostics();
  `);
  assert.equal(element("exportNasalPairBtn").disabled, true);
  assert.equal(element("nasalPairStatus").textContent, "");
  if (process.argv.includes("--render-pair")) {
    context.CVD_PHYSICAL_TUBE_OVERSAMPLING = 2;
    const out = path.join(root, "runtime", "nasal_diagnostics", "baseline-mn-a");
    fs.mkdirSync(out, { recursive: true });
    const report = { schema_version: "nasal_source_regression_pair_0.1", conditions: run(`nasalPairConditions("a")`), samples: [] };
    for (const token of ["ma", "na"]) {
      const started = performance.now();
      const audio = run(`synthesizeSyllable("${token}", { manualTuning: false })`);
      assert.equal(audio.source_noise_model.active_model.schema_version, "reduced_two_mass_glottal_source_0.2");
      assert.equal(audio.nasal_model.glottal_source_model, audio.source_noise_model);
      assert.ok(audio.samples.every(Number.isFinite));
      assert.ok(audio.samples.some((sample) => Math.abs(sample) > 0.01));
      assert.equal(audio.nasal_model.stage_diagnostic.stages.length, 3);
      context.exportAudio = audio;
      const wav = run(`encodeWav(exportAudio.samples, exportAudio.sampleRate)`);
      fs.writeFileSync(path.join(out, `${token}.wav`), Buffer.from(await wav.arrayBuffer()));
      report.samples.push({ token, elapsed_ms: performance.now() - started, nasal_model: audio.nasal_model });
      console.log(`${token}: ${report.samples.at(-1).elapsed_ms.toFixed(0)} ms`);
    }
    fs.writeFileSync(path.join(out, "comparison.json"), JSON.stringify(report, null, 2));
    console.log("Fixed synthetic ma/na pair saved under runtime/nasal_diagnostics/baseline-mn-a");
  }
  console.log("Nasal shared-source and stage-diagnostic regression checks passed");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });

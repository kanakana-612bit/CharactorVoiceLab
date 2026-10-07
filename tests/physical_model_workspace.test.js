const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");

if (!/data-tab-target="physicalModelTab"[^>]*>[\s\S]*?物理モデル<\/button>/.test(html)) {
  throw new Error("The physical vocal-tract workspace tab is missing");
}

for (const id of [
  "physicalSagittalCanvas",
  "physicalTransferCanvas",
  "physicalGlottalCanvas",
  "physicalCrossSectionCanvas",
  "physicalModelStatus",
]) {
  if (!new RegExp(`id="${id}"`).test(html)) throw new Error(`Missing physical workspace element: ${id}`);
}

for (const vowel of ["a", "i", "u", "e", "o"]) {
  if (!new RegExp(`data-physical-vowel="${vowel}"`).test(html)) {
    throw new Error(`Missing physical workspace vowel selector: ${vowel}`);
  }
}

const sampleRateSelectors = html.match(/data-output-sample-rate/g) ?? [];
if (sampleRateSelectors.length !== 2 || !/value="44100"/.test(html) || !/value="48000"/.test(html)) {
  throw new Error("The synchronized 44.1/48 kHz output sample-rate controls are missing");
}

if (!/function setOutputSampleRate\([\s\S]*state\.physicalTransferCache = null/.test(app)
  || !/const sampleRate = currentOutputSampleRate\(\)/.test(app)
  || !/output_sample_rate_hz: currentOutputSampleRate\(\)/.test(app)) {
  throw new Error("The sample-rate controls are not connected to physical synthesis and TTS output");
}

if (!/function drawPhysicalModelWorkspace\([\s\S]*buildTubeAreaFunction\([\s\S]*currentPhysicalTransferAnalysis\(/.test(app)) {
  throw new Error("The physical workspace is not connected to the existing area-function and transfer models");
}

if (!/\["detailTab", "physicalModelTab", "vowelTab", "consonantTab"\]/.test(app)) {
  throw new Error("The sample preview dock is not available in every acoustic workspace");
}

if (!/function playActivePhonemePreview\(\)[\s\S]*state\.activeTab === "consonantTab"[\s\S]*playNasalCalibrationVariant\(true\)[\s\S]*playVowel\(\)/.test(app)
  || !/playSampleButton\.addEventListener\("click", playActivePhonemePreview\)/.test(app)) {
  throw new Error("The shared sample button does not dispatch consonant and vowel previews correctly");
}

if (!/#physicalModelTab\s*\{[\s\S]*grid-template-columns/.test(css)
  || !/@media \(max-width: 1100px\)[\s\S]*#physicalModelTab/.test(css)) {
  throw new Error("The physical workspace lacks desktop or responsive layout rules");
}

if (!/#physicalModelTab\s*\{[\s\S]*grid-template-areas:\s*"stage stage"\s*"geometry transfer"\s*"source transfer"\s*"target sections"\s*"advanced advanced"/.test(css)
  || !/\.physical-model-shape-pane\s*\{\s*grid-area:\s*geometry/.test(css)
  || !/\.physical-transfer-pane\s*\{\s*grid-area:\s*transfer/.test(css)
  || !/\.physical-source-pane\s*\{\s*grid-area:\s*source/.test(css)
  || !/\.physical-advanced-settings\s*\{\s*grid-area:\s*advanced/.test(css)) {
  throw new Error("The physical workspace does not follow the geometry/source, transfer, then advanced-settings hierarchy");
}

if (/id="physicalAreaCanvas"|class="physical-audition-diagnostics"/.test(html)) {
  throw new Error("Duplicate area-function or audition-path controls remain in the physical workspace");
}

if (!/id="physicalAdvancedSettings"[\s\S]*<summary>高度な設定<\/summary>/.test(html)
  || !/while \(legacyDetailTab\.firstChild\) advancedSettingsMount\.appendChild/.test(app)) {
  throw new Error("Legacy detail controls are not mounted into the physical advanced-settings disclosure");
}

if (!/<h2>構音空間プレビュー<\/h2>/.test(html)) {
  throw new Error("The articulatory geometry preview is not named consistently");
}

const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
if (duplicates.length) throw new Error(`Duplicate HTML ids: ${[...new Set(duplicates)].join(", ")}`);

console.log("Physical vocal-tract workspace static checks passed");

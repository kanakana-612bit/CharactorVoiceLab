const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");

const stages = [
  ["setupTab", "画像と特徴点"],
  ["physicalModelTab", "物理モデル"],
  ["vowelTab", "母音確認"],
  ["seedSearchTab", "Seed探索"],
  ["speakerTrainingTab", "話者学習"],
  ["finalPreviewTab", "最終確認"],
];

for (const [id, label] of stages) {
  if (!html.includes(`data-tab-target="${id}"`) || !html.includes(`id="${id}"`)) {
    throw new Error(`Missing public workflow stage: ${label}`);
  }
}

for (const id of [
  "publicSeedCount",
  "publicSeedCandidates",
  "publicTrainingSamples",
  "publicVoiceName",
  "publicVoiceId",
]) {
  if (!html.includes(`id="${id}"`)) throw new Error(`Missing public workflow control: ${id}`);
}

if (!/function installPublicWorkflowHandlers\(/.test(app)
  || !/function renderPublicWorkflowCandidates\(/.test(app)
  || !/function renderPublicTrainingSamples\(/.test(app)) {
  throw new Error("Public workflow controls are not connected");
}

if (/drawBodyModel\(bodyModelCtx\)/.test(app)) {
  throw new Error("The retired low-poly full-body preview is still rendered");
}

if (!/\.workflow-nav/.test(css) || !/\.public-flow-panel/.test(css)) {
  throw new Error("Public workflow styling is missing");
}

const guidePosition = html.indexOf('class="composition-guide"');
const privacyPosition = html.indexOf('class="privacy-notice"');
if (guidePosition < 0 || privacyPosition < guidePosition) {
  throw new Error("The compact body-composition guide must precede the privacy notice in the input column");
}

if (/\.public-release canvas\s*\{\s*filter:\s*grayscale/.test(css)) {
  throw new Error("Reference images and diagnostic graphs must retain their functional colors");
}

if (!/function drawImage\([\s\S]*?ctx\.fillStyle = "#ffffff"/.test(app)
  || !/#setupTab \.canvas-stack[\s\S]*?background: #fff/.test(css)) {
  throw new Error("Reference-image preview surfaces must use a white background without recoloring the image");
}

for (const legacyWarmColor of ["#fff8ed", "#f8f6ef", "#f1efe7", "#ece7dc", "#e9e6dc", "#f3efe5"]) {
  if (css.includes(legacyWarmColor) || app.includes(legacyWarmColor)) {
    throw new Error(`Legacy warm UI color remains: ${legacyWarmColor}`);
  }
}

console.log("Public jxiv-reader workflow static checks passed");

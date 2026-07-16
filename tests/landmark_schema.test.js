const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
global.window = global;
eval(fs.readFileSync(path.join(projectRoot, "landmark_schema.js"), "utf8"));

function close(actual, expected, label) {
  if (Math.abs(actual - expected) > 1e-9) throw new Error(`${label}: expected ${expected}, got ${actual}`);
}

const bodyAnchored = CVL_LANDMARKS.computeCalibration({
  heightCm: 160,
  interpupillaryReferenceCm: 6.2,
  body: {
    head_top: { x: 100, y: 10 },
    chin: { x: 102, y: 110 },
    left_foot: { x: 80, y: 510 },
    right_foot: { x: 120, y: 510 },
  },
  face: {
    face_top: { x: 200, y: 20 },
    chin: { x: 205, y: 220 },
    pupil_left: { x: 170, y: 90 },
    pupil_right: { x: 230, y: 92 },
  },
  profile: {
    profile_vertex: { x: 300, y: 30 },
    profile_chin: { x: 360, y: 190 },
  },
});

close(bodyAnchored.stature.cm_per_px, 0.32, "body scale");
close(bodyAnchored.shared_total_head_height.value_cm, 32, "shared total head height");
close(bodyAnchored.views.head_front.cm_per_px, 0.16, "front scale");
close(bodyAnchored.views.head_profile.cm_per_px, 0.2, "profile scale");
close(bodyAnchored.cross_view_consistency.max_total_head_height_delta_cm, 0, "cross-view delta");
if (bodyAnchored.cross_view_consistency.status !== "reconciled") throw new Error("Body-anchored views were not reconciled");

const fallback = CVL_LANDMARKS.computeCalibration({
  heightCm: 160,
  interpupillaryReferenceCm: 6.2,
  face: {
    face_top: { x: 0, y: 0 },
    chin: { x: 0, y: 100 },
    pupil_left: { x: 10, y: 40 },
    pupil_right: { x: 60, y: 42 },
  },
  profile: {
    profile_vertex: { x: 0, y: 0 },
    profile_chin: { x: 40, y: 124 },
  },
});

close(fallback.views.head_front.cm_per_px, 0.124, "IPD fallback front scale");
close(fallback.shared_total_head_height.value_cm, 12.4, "IPD fallback head height");
close(fallback.views.head_profile.cm_per_px, 0.1, "IPD fallback profile scale");
if (fallback.shared_total_head_height.source !== "front_interpupillary_statistical_fallback") throw new Error("Fallback source metadata failed");
close(CVL_LANDMARKS.horizontalDistance({ x: 5, y: 1 }, { x: 15, y: 99 }), 10, "horizontal breadth");
close(CVL_LANDMARKS.verticalDistance({ x: 5, y: 1 }, { x: 99, y: 21 }), 20, "vertical height");
for (const key of Object.keys(CVL_LANDMARKS.labels)) {
  const info = CVL_LANDMARKS.landmarkInfo(key);
  if (!info.definition || info.definition.includes("未登録")) throw new Error(`Missing landmark definition: ${key}`);
}

const app = fs.readFileSync(path.join(projectRoot, "app.js"), "utf8");
const html = fs.readFileSync(path.join(projectRoot, "index.html"), "utf8");
const referencedIds = [...app.matchAll(/getElementById\("([^"]+)"\)/g)].map((match) => match[1]);
const missingIds = [...new Set(referencedIds)].filter((id) => !html.includes(`id="${id}"`));
if (missingIds.length) throw new Error(`Missing HTML IDs: ${missingIds.join(", ")}`);
const htmlIds = [...html.matchAll(/id="([^"]+)"/g)].map((match) => match[1]);
const duplicateIds = htmlIds.filter((id, index) => htmlIds.indexOf(id) !== index);
if (duplicateIds.length) throw new Error(`Duplicate HTML IDs: ${[...new Set(duplicateIds)].join(", ")}`);
for (const removedId of ["autoCurrentBtn", "autoAllBtn", "autoProfileBtn", "aistRefSelect", "aistRefImage"]) {
  if (html.includes(`id="${removedId}"`)) throw new Error(`Removed UI is still present: ${removedId}`);
}
if (!html.includes(`id="landmarkHintPanel"`)) throw new Error("Missing landmark hint panel");

console.log(`Landmark calibration passed; ${new Set(referencedIds).size} app IDs resolved; ${htmlIds.length} unique HTML IDs.`);

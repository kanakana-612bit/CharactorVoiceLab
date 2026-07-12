const state = {
  mode: "body",
  images: { body: null, face: null },
  imageNames: { body: null, face: null },
  landmarks: {
    body: {
      head_top: null,
      chin: null,
      left_shoulder: null,
      right_shoulder: null,
      left_hip: null,
      right_hip: null,
      left_foot: null,
      right_foot: null,
    },
    face: {
      face_top: null,
      chin: null,
      nose: null,
      mouth_left: null,
      mouth_right: null,
      pupil_left: null,
      pupil_right: null,
      jaw_left: null,
      jaw_right: null,
    },
  },
  features: {},
  constraints: {},
  extractionReports: {},
  drag: null,
  lastWav: null,
};

const labels = {
  head_top: "頭頂",
  chin: "顎先",
  left_shoulder: "左肩",
  right_shoulder: "右肩",
  left_hip: "左骨盤",
  right_hip: "右骨盤",
  left_foot: "左足底",
  right_foot: "右足底",
  face_top: "顔上端",
  nose: "鼻下",
  mouth_left: "口裂左",
  mouth_right: "口裂右",
  pupil_left: "左瞳孔",
  pupil_right: "右瞳孔",
  jaw_left: "左下顎角",
  jaw_right: "右下顎角",
};

const referenceData = window.CVL_REFERENCE;
const featureDefs = referenceData.anthropometricFeaturePriors;

const quickControls = [
  { key: "vocal_tract_length_cm", label: "声道長", min: 11, max: 20, step: 0.1, unit: "cm" },
  { key: "pharyngeal_length_scale", label: "咽頭長スケール", min: 0.75, max: 1.25, step: 0.01, unit: "x" },
  { key: "pharyngeal_area_scale", label: "咽頭断面スケール", min: 0.7, max: 1.3, step: 0.01, unit: "x" },
  { key: "maximum_ventilation_l_min", label: "最大換気量", min: 40, max: 180, step: 1, unit: "L/min" },
  { key: "nasal_cavity_volume_cm3", label: "鼻腔体積", min: 8, max: 35, step: 0.1, unit: "cm3" },
  { key: "glottal_closure", label: "声門閉鎖傾向", min: 0, max: 1, step: 0.01, unit: "" },
];

const els = {
  bodyImageInput: document.getElementById("bodyImageInput"),
  faceImageInput: document.getElementById("faceImageInput"),
  ageInput: document.getElementById("ageInput"),
  sexInput: document.getElementById("sexInput"),
  heightInput: document.getElementById("heightInput"),
  weightInput: document.getElementById("weightInput"),
  bodyFatInput: document.getElementById("bodyFatInput"),
  populationInput: document.getElementById("populationInput"),
  globalImageWeight: document.getElementById("globalImageWeight"),
  rangeKInput: document.getElementById("rangeKInput"),
  glottalClosureInput: document.getElementById("glottalClosureInput"),
  pressureInput: document.getElementById("pressureInput"),
  analyzeBtn: document.getElementById("analyzeBtn"),
  saveJsonBtn: document.getElementById("saveJsonBtn"),
  loadJsonBtn: document.getElementById("loadJsonBtn"),
  loadJsonInput: document.getElementById("loadJsonInput"),
  autoCurrentBtn: document.getElementById("autoCurrentBtn"),
  autoAllBtn: document.getElementById("autoAllBtn"),
  extractionStatus: document.getElementById("extractionStatus"),
  bodyModeBtn: document.getElementById("bodyModeBtn"),
  faceModeBtn: document.getElementById("faceModeBtn"),
  landmarkSelect: document.getElementById("landmarkSelect"),
  showLandmarks: document.getElementById("showLandmarks"),
  showModel: document.getElementById("showModel"),
  imageCanvas: document.getElementById("imageCanvas"),
  bodyModelCanvas: document.getElementById("bodyModelCanvas"),
  quickSliders: document.getElementById("quickSliders"),
  featureTable: document.getElementById("featureTable"),
  constraintOutput: document.getElementById("constraintOutput"),
  vowelSelect: document.getElementById("vowelSelect"),
  playVowelButton: document.getElementById("playVowelButton"),
  saveWavBtn: document.getElementById("saveWavBtn"),
};

function num(el, fallback = 0) {
  const value = Number(el.value);
  return Number.isFinite(value) ? value : fallback;
}

function dist(a, b) {
  if (!a || !b) return null;
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function mid(a, b) {
  if (!a || !b) return null;
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function cohortMean(key) {
  return featureDefs[key].mean[els.sexInput.value] ?? featureDefs[key].mean.neutral;
}

function sexClass() {
  return els.sexInput.value === "male" ? "male" : els.sexInput.value === "female" ? "female" : "neutral";
}

function sourceLabel(key) {
  const source = referenceData.sources[key];
  return source ? source.label : key;
}

function confidenceFromPoints(points) {
  const present = points.filter(Boolean).length;
  return present / points.length;
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
    const distance = dist(point, landmark);
    if (distance <= nearestDistance) {
      nearest = key;
      nearestDistance = distance;
    }
  }
  return nearest;
}

function setLandmark(mode, key, point) {
  state.landmarks[mode][key] = {
    x: clamp(point.x, 0, els.imageCanvas.width),
    y: clamp(point.y, 0, els.imageCanvas.height),
  };
}

function handleCanvasPointerDown(event) {
  const point = canvasPoint(event, els.imageCanvas);
  const key = nearestLandmark(point) ?? els.landmarkSelect.value;
  setLandmark(state.mode, key, point);
  els.landmarkSelect.value = key;
  state.drag = { mode: state.mode, key, moved: false };
  els.imageCanvas.setPointerCapture?.(event.pointerId);
  draw();
  event.preventDefault();
}

function handleCanvasPointerMove(event) {
  const point = canvasPoint(event, els.imageCanvas);
  if (!state.drag) {
    els.imageCanvas.style.cursor = nearestLandmark(point) ? "grab" : "crosshair";
    return;
  }
  setLandmark(state.drag.mode, state.drag.key, point);
  state.drag.moved = true;
  draw();
  event.preventDefault();
}

function handleCanvasPointerUp(event) {
  if (!state.drag) return;
  els.imageCanvas.releasePointerCapture?.(event.pointerId);
  state.drag = null;
  els.imageCanvas.style.cursor = "crosshair";
  analyze();
  event.preventDefault();
}

function loadImage(file, target) {
  if (!file) return;
  const img = new Image();
  img.onload = () => {
    state.images[target] = img;
    state.imageNames[target] = file.name;
    draw();
  };
  img.src = URL.createObjectURL(file);
}

function setMode(mode) {
  state.mode = mode;
  els.bodyModeBtn.classList.toggle("active", mode === "body");
  els.faceModeBtn.classList.toggle("active", mode === "face");
  refreshLandmarkSelect();
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
}

function drawImage(ctx, image) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.fillStyle = "#ece7dc";
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  if (!image) {
    ctx.fillStyle = "#666257";
    ctx.textAlign = "center";
    ctx.font = "16px Segoe UI";
    ctx.fillText(state.mode === "body" ? "全身画像を読み込み" : "顔画像を読み込み", ctx.canvas.width / 2, ctx.canvas.height / 2);
    return;
  }
  const scale = Math.min(ctx.canvas.width / image.width, ctx.canvas.height / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  const x = (ctx.canvas.width - width) / 2;
  const y = (ctx.canvas.height - height) / 2;
  ctx.drawImage(image, x, y, width, height);
}

function drawLandmarks(ctx) {
  if (!els.showLandmarks.checked) return;
  const points = state.landmarks[state.mode];
  ctx.save();
  ctx.font = "12px Segoe UI";
  ctx.textBaseline = "middle";
  for (const [key, point] of Object.entries(points)) {
    if (!point) continue;
    ctx.beginPath();
    ctx.arc(point.x, point.y, 5, 0, Math.PI * 2);
    ctx.fillStyle = "#236b5b";
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "white";
    ctx.stroke();
    ctx.fillStyle = "#16483d";
    ctx.fillText(labels[key] ?? key, point.x + 8, point.y);
  }
  ctx.restore();
}

function drawBodyModel(ctx) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  if (!els.showModel.checked) return;
  if (state.mode !== "body") return;
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
  ctx.fillText(`閉鎖 ${format(c.glottal_closure?.center, 2)}`, 18, 42);
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

function draw() {
  const imageCtx = els.imageCanvas.getContext("2d");
  drawImage(imageCtx, state.images[state.mode]);
  drawLandmarks(imageCtx);
  drawBodyModel(els.bodyModelCanvas.getContext("2d"));
}

function extractCurrentLandmarks() {
  const result = state.mode === "body" ? extractBodyLandmarks() : extractFaceLandmarks();
  applyExtractionResult(state.mode, result);
}

function extractAllLandmarks() {
  const reports = [];
  if (state.images.body) {
    const result = extractBodyLandmarks();
    applyExtractionResult("body", result, false);
    reports.push(`全身 ${Math.round(result.confidence * 100)}%`);
  }
  if (state.images.face) {
    const result = extractFaceLandmarks();
    applyExtractionResult("face", result, false);
    reports.push(`顔 ${Math.round(result.confidence * 100)}%`);
  }
  if (!reports.length) {
    setExtractionStatus("画像がまだ読み込まれていません。");
    return;
  }
  setExtractionStatus(`自動抽出: ${reports.join(" / ")}。必要なら点を手動補正してください。`);
  analyze();
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
  setExtractionStatus(`${mode === "body" ? "全身" : "顔"}を自動抽出: 信頼度 ${Math.round(result.confidence * 100)}%。${result.message}`);
  if (shouldAnalyze) analyze();
}

function setExtractionStatus(message) {
  els.extractionStatus.textContent = message;
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
    message: "シルエット比率から頭頂・肩・骨盤・足底を推定しました。",
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
  };
  const confidence = clamp(0.3 + Math.min(0.25, eyeBand.length / 1400) + (mouth ? 0.18 : 0) + (mask.count ? 0.12 : 0), 0.25, 0.8);
  return {
    method: "foreground_dark_feature_cloud_v1",
    confidence,
    points,
    message: "顔シルエットと暗色パーツから瞳孔・口裂・顎を推定しました。",
  };
}

function makeAnalysisFrame(mode) {
  const image = state.images[mode];
  if (!image) return null;
  const width = els.imageCanvas.width;
  const height = els.imageCanvas.height;
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

function observationFromLandmarks() {
  const heightCm = num(els.heightInput, 158);
  const body = state.landmarks.body;
  const face = state.landmarks.face;
  const fullPx = dist(body.head_top, mid(body.left_foot, body.right_foot));
  const headPx = dist(body.head_top, body.chin);
  const pxToCm = fullPx ? heightCm / fullPx : null;
  const faceScaleCmPerPx = (() => {
    const ipdPx = dist(face.pupil_left, face.pupil_right);
    if (!ipdPx) return null;
    return cohortMean("interpupillary_width_cm") / ipdPx;
  })();

  return {
    shoulder_width_cm: measurement(dist(body.left_shoulder, body.right_shoulder), pxToCm, [body.left_shoulder, body.right_shoulder]),
    torso_length_cm: measurement(dist(mid(body.left_shoulder, body.right_shoulder), mid(body.left_hip, body.right_hip)), pxToCm, [body.left_shoulder, body.right_shoulder, body.left_hip, body.right_hip]),
    pelvis_width_cm: measurement(dist(body.left_hip, body.right_hip), pxToCm, [body.left_hip, body.right_hip]),
    head_units: {
      value: fullPx && headPx ? fullPx / headPx : null,
      confidence: confidenceFromPoints([body.head_top, body.chin, body.left_foot, body.right_foot]),
    },
    lower_face_height_cm: measurement(dist(face.nose, face.chin), faceScaleCmPerPx, [face.nose, face.chin, face.pupil_left, face.pupil_right]),
    mouth_width_cm: measurement(dist(face.mouth_left, face.mouth_right), faceScaleCmPerPx, [face.mouth_left, face.mouth_right, face.pupil_left, face.pupil_right]),
    interpupillary_width_cm: measurement(dist(face.pupil_left, face.pupil_right), faceScaleCmPerPx, [face.pupil_left, face.pupil_right]),
    jaw_width_cm: measurement(dist(face.jaw_left, face.jaw_right), faceScaleCmPerPx, [face.jaw_left, face.jaw_right, face.pupil_left, face.pupil_right]),
  };
}

function measurement(px, scale, points) {
  return {
    value: px && scale ? px * scale : null,
    confidence: confidenceFromPoints(points),
  };
}

function analyze() {
  const observations = observationFromLandmarks();
  const globalWeight = num(els.globalImageWeight, 0.7);
  const sex = els.sexInput.value;
  const features = {};
  for (const [key, def] of Object.entries(featureDefs)) {
    const observed = observations[key]?.value;
    const confidence = observations[key]?.confidence ?? 0;
    const mean = def.mean[sex] ?? def.mean.neutral;
    const sd = def.sd;
    const imageWeight = observed == null ? 0 : Math.max(0, Math.min(1, globalWeight * confidence));
    const integrated = observed == null ? mean : imageWeight * observed + (1 - imageWeight) * mean;
    features[key] = {
      label: def.label,
      unit: def.unit,
      image_value: observed,
      statistical_mean: mean,
      statistical_sd: sd,
      integrated,
      scale: integrated / mean,
      z_score: (integrated - mean) / sd,
      image_weight: imageWeight,
      confidence,
      prior_source: def.source,
      source_note: def.source_note,
      evidence: def.evidence,
      evidence_label: sourceLabel(def.evidence),
      evidence_level: def.evidence_level,
      source: observed == null ? "statistical_prior" : "image_and_statistical_prior",
    };
  }
  state.features = features;
  state.constraints = mapVoiceConstraints(features);
  renderQuickSliders();
  renderFeatureTable();
  renderConstraints();
  draw();
}

function mapVoiceConstraints(features) {
  const sex = sexClass();
  const height = num(els.heightInput, 158);
  const weight = num(els.weightInput, 47);
  const age = num(els.ageInput, 17);
  const k = num(els.rangeKInput, 1);
  const voiceSex = sex;
  const voicePriors = referenceData.sources.pisanski2016.extracted_values.voice_table_1[voiceSex];
  const bodyPriors = referenceData.sources.pisanski2014.extracted_values.adult_height_weight_sample[voiceSex];
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
  const headZ = (headScale - 1) / 0.08;
  const lowerFaceZ = features.lower_face_height_cm.z_score;
  const torsoZ = features.torso_length_cm.z_score;
  const limitedMorphologyZ = clamp(0.35 * heightZ + 0.2 * headZ + 0.25 * lowerFaceZ + 0.1 * torsoZ, -1.25, 1.25);
  const vtl = baseVtl + limitedMorphologyZ * baseVtlSd;
  const pharynxLen = 0.5 * lowerFaceScale + 0.3 * heightScale + 0.2 * torsoScale;
  const pharynxArea = 0.45 * jawScale + 0.3 * shoulderScale + 0.25 * pelvisScale;
  const nasal = (sex === "male" ? 22 : sex === "female" ? 18 : 20) * (0.55 * headScale + 0.25 * lowerFaceScale + 0.2 * jawScale);
  const ventilation = (sex === "male" ? 125 : sex === "female" ? 95 : 110) * (0.5 * heightScale + 0.3 * Math.sqrt(weightScale) + 0.2 * torsoScale);
  const pressure = num(els.pressureInput, 900);
  const closure = num(els.glottalClosureInput, 0.5);
  const f0Prior = voicePriors.f0_mean_hz;
  const f0Center = f0Prior.mean * (0.98 + 0.04 * closure);
  const voiceSource = "Pisanski et al. 2016 Table 1; morphology correction is conservative per Pisanski et al. 2014/2016";

  return {
    vocal_tract_length_cm: range(vtl, Math.max(0.45, baseVtlSd * k), "cm", voiceSource, 0.72, "pisanski2016"),
    f0_mean_hz: range(f0Center, f0Prior.sd * k, "Hz", "Pisanski et al. 2016 Table 1 baseline; closure only shifts preview control slightly", 0.65, "pisanski2016"),
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
    larynx_height_offset_mm: range((age < 18 ? -1.5 : 0) + (sex === "male" ? 2 : sex === "female" ? -1 : 0), 3.5 * k, "mm", "age and sex reference class; numeric laryngeal-position prior pending", 0.25, "sourceMap"),
    nasal_cavity_volume_cm3: range(nasal, 3.0 * k, "cm3", "head/lower-face/jaw proxy only; nasal-cavity volume source is pending", 0.2, "sourceMap"),
    maximum_ventilation_l_min: range(ventilation, 14 * k, "L/min", "height/weight/torso proxy; respiratory reference table pending", 0.28, "sourceMap"),
    maximum_respiratory_pressure_pa: range(pressure, 180 * k, "Pa", "manual setting; maximal pressure reference source pending", 0.2, "sourceMap"),
    glottal_closure: { center: closure, min: 0, max: 1, unit: "ratio", source: "manual", confidence: 0.5 },
    mouth_radiation_scale: range(mouthScale, 0.08 * k, "ratio", "mouth width proxy; AIST-style mouth-width prior pending", 0.35, "pendingAist"),
    body_reference: {
      height_cm: { observed: height, cohort_mean: bodyPriors.height_cm_mean, cohort_sd: bodyPriors.height_cm_sd, z_score: Number(heightZ.toFixed(4)) },
      weight_kg: { observed: weight, cohort_mean: bodyPriors.weight_kg_mean, cohort_sd: bodyPriors.weight_kg_sd },
      source: "Pisanski et al. 2014 cross-cultural adult sample",
      evidence: "pisanski2014",
    },
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function range(center, halfWidth, unit, source, confidence = 0.5, evidence = null) {
  return {
    center: Number(center.toFixed(4)),
    min: Number((center - halfWidth).toFixed(4)),
    max: Number((center + halfWidth).toFixed(4)),
    unit,
    source,
    evidence,
    confidence,
  };
}

function renderQuickSliders() {
  els.quickSliders.innerHTML = "";
  for (const control of quickControls) {
    const item = state.constraints[control.key];
    if (!item) continue;
    const row = document.createElement("label");
    row.className = "slider-row";
    const input = document.createElement("input");
    input.type = "range";
    input.min = control.min;
    input.max = control.max;
    input.step = control.step;
    input.value = item.center;
    const output = document.createElement("output");
    output.textContent = `${format(item.center, control.step < 0.1 ? 2 : 1)} ${control.unit}`;
    input.addEventListener("input", () => {
      const value = Number(input.value);
      state.constraints[control.key].center = value;
      if (control.key === "glottal_closure") els.glottalClosureInput.value = String(value);
      output.textContent = `${format(value, control.step < 0.1 ? 2 : 1)} ${control.unit}`;
      renderConstraints();
      draw();
    });
    row.append(`${control.label}`);
    row.append(input, output);
    els.quickSliders.appendChild(row);
  }
}

function renderFeatureTable() {
  els.featureTable.innerHTML = "";
  for (const [key, f] of Object.entries(state.features)) {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${f.label}</td>
      <td>${format(f.integrated, 2)} ${f.unit}</td>
      <td>${format(f.statistical_mean, 2)} ${f.unit}</td>
      <td>${format(f.z_score, 2)}</td>
      <td>${format(f.image_weight, 2)}</td>
      <td title="${escapeAttr(f.source_note)}">${f.evidence_level}</td>
    `;
    els.featureTable.appendChild(row);
  }
}

function renderConstraints() {
  els.constraintOutput.textContent = JSON.stringify(buildExport(), null, 2);
}

function buildExport() {
  return {
    schema_version: "character_voice_lab_mvp_0.1",
    inputs: {
      full_body_image: state.imageNames.body,
      face_image: state.imageNames.face,
      age: num(els.ageInput, 17),
      sex_reference_class: els.sexInput.value,
      height_cm: num(els.heightInput, 158),
      weight_kg: num(els.weightInput, 47),
      body_fat_percent: els.bodyFatInput.value === "" ? null : num(els.bodyFatInput, 0),
      reference_population: els.populationInput.value,
    },
    landmarks: state.landmarks,
    landmark_extraction: state.extractionReports,
    integrated_features: state.features,
    voice_constraints: state.constraints,
    reference_sources: referenceData.sources,
    notes: [
      "VTL and F0 priors are extracted from Pisanski et al. 2016 Table 1.",
      "Height and weight reference values are extracted from Pisanski et al. 2014.",
      "Head/face/body dimensional priors remain marked as placeholders where the referenced numeric cohort table was not bundled.",
      "Image estimates are based on browser-side heuristic landmark extraction plus manual correction; automatic SMPL-X/Face Mesh adapters are not included.",
      "Generated vowel previews use fallback formant synthesis, not VocalTractLab.",
    ],
  };
}

function format(value, digits = 2) {
  if (value == null || Number.isNaN(value)) return "-";
  return Number(value).toFixed(digits);
}

function escapeAttr(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");
}

const vowelFormants = {
  a: { label: "/a/", formants: [730, 1090, 2440], bandwidths: [90, 110, 180], amplitude: 1.0 },
  i: { label: "/i/", formants: [300, 2200, 3000], bandwidths: [70, 130, 220], amplitude: 0.82 },
  u: { label: "/u/", formants: [350, 900, 2200], bandwidths: [80, 120, 220], amplitude: 0.78 },
  e: { label: "/e/", formants: [500, 1900, 2600], bandwidths: [80, 130, 200], amplitude: 0.9 },
  o: { label: "/o/", formants: [500, 1000, 2400], bandwidths: [85, 120, 190], amplitude: 0.88 },
};

function selectedVowel() {
  return vowelFormants[els.vowelSelect.value] ? els.vowelSelect.value : "a";
}

function synthesizeVowel(vowel = selectedVowel()) {
  const sampleRate = 22050;
  const duration = 1.35;
  const n = Math.floor(sampleRate * duration);
  const constraints = state.constraints;
  const vtl = constraints.vocal_tract_length_cm?.center ?? 15.5;
  const closure = constraints.glottal_closure?.center ?? 0.5;
  const pressure = constraints.maximum_respiratory_pressure_pa?.center ?? num(els.pressureInput, 900);
  const f0 = (constraints.f0_mean_hz?.center ?? 165) * Math.pow(15.5 / vtl, 0.18);
  const scale = 17.0 / vtl;
  const profile = vowelFormants[vowel] ?? vowelFormants.a;
  const formants = profile.formants.map((frequency, index) => ({
    f: frequency * scale,
    bw: profile.bandwidths[index] + (index === 0 ? (1 - closure) * 45 : 0),
  }));
  const resonators = formants.map((f) => makeResonator(f.f, f.bw, sampleRate));
  const out = new Float32Array(n);
  let phase = 0;
  let seed = 1;
  for (let i = 0; i < n; i++) {
    const t = i / sampleRate;
    const env = Math.min(1, t / 0.08, (duration - t) / 0.12);
    phase += f0 / sampleRate;
    phase -= Math.floor(phase);
    const pulse = closure < 0.55
      ? Math.sin(Math.PI * 2 * phase) * 0.65 + Math.sin(Math.PI * 4 * phase) * 0.25
      : 1 - 2 * phase;
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const noise = ((seed / 0xffffffff) * 2 - 1) * (1 - closure) * 0.12;
    let sample = (pulse * (0.75 + closure * 0.35) + noise) * env * Math.min(1.2, pressure / 900);
    for (const resonator of resonators) sample = resonator(sample);
    out[i] = sample * 0.18 * profile.amplitude;
  }
  normalize(out, 0.92);
  return { sampleRate, samples: out, vowel, formants };
}

function makeResonator(freq, bandwidth, sampleRate) {
  const r = Math.exp(-Math.PI * bandwidth / sampleRate);
  const theta = 2 * Math.PI * freq / sampleRate;
  const a1 = 2 * r * Math.cos(theta);
  const a2 = -r * r;
  const b0 = 1 - r;
  let y1 = 0;
  let y2 = 0;
  return (x) => {
    const y = b0 * x + a1 * y1 + a2 * y2;
    y2 = y1;
    y1 = y;
    return y;
  };
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
  const context = new AudioContext({ sampleRate: audio.sampleRate });
  const buffer = context.createBuffer(1, audio.samples.length, audio.sampleRate);
  buffer.copyToChannel(audio.samples, 0);
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.connect(context.destination);
  source.start();
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
  URL.revokeObjectURL(url);
}

function saveJson() {
  if (!Object.keys(state.constraints).length) analyze();
  const blob = new Blob([JSON.stringify(buildExport(), null, 2)], { type: "application/json" });
  download("character_voice_profile.json", blob);
}

function loadJson(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const data = JSON.parse(String(reader.result));
    if (data.inputs) {
      els.ageInput.value = data.inputs.age ?? els.ageInput.value;
      els.sexInput.value = data.inputs.sex_reference_class ?? els.sexInput.value;
      els.heightInput.value = data.inputs.height_cm ?? els.heightInput.value;
      els.weightInput.value = data.inputs.weight_kg ?? els.weightInput.value;
      els.populationInput.value = data.inputs.reference_population ?? els.populationInput.value;
    }
    if (data.landmarks) state.landmarks = data.landmarks;
    analyze();
  };
  reader.readAsText(file, "utf-8");
}

function init() {
  refreshLandmarkSelect();
  renderQuickSliders();
  analyze();
  els.bodyImageInput.addEventListener("change", (e) => loadImage(e.target.files[0], "body"));
  els.faceImageInput.addEventListener("change", (e) => loadImage(e.target.files[0], "face"));
  els.autoCurrentBtn.addEventListener("click", extractCurrentLandmarks);
  els.autoAllBtn.addEventListener("click", extractAllLandmarks);
  els.bodyModeBtn.addEventListener("click", () => setMode("body"));
  els.faceModeBtn.addEventListener("click", () => setMode("face"));
  els.imageCanvas.addEventListener("pointerdown", handleCanvasPointerDown);
  els.imageCanvas.addEventListener("pointermove", handleCanvasPointerMove);
  els.imageCanvas.addEventListener("pointerup", handleCanvasPointerUp);
  els.imageCanvas.addEventListener("pointercancel", handleCanvasPointerUp);
  els.imageCanvas.addEventListener("pointerleave", (event) => {
    if (state.drag) handleCanvasPointerUp(event);
  });
  for (const el of [els.ageInput, els.sexInput, els.heightInput, els.weightInput, els.populationInput, els.globalImageWeight, els.rangeKInput, els.glottalClosureInput, els.pressureInput]) {
    el.addEventListener("input", analyze);
  }
  els.showLandmarks.addEventListener("change", draw);
  els.showModel.addEventListener("change", draw);
  els.analyzeBtn.addEventListener("click", analyze);
  els.playVowelButton.addEventListener("click", playVowel);
  els.vowelSelect.addEventListener("input", () => {
    state.lastWav = null;
  });
  els.saveWavBtn.addEventListener("click", () => {
    const vowel = selectedVowel();
    if (!state.lastWav) {
      const audio = synthesizeVowel(vowel);
      state.lastWav = encodeWav(audio.samples, audio.sampleRate);
    }
    download(`preview_${vowel}.wav`, state.lastWav);
  });
  els.saveJsonBtn.addEventListener("click", saveJson);
  els.loadJsonBtn.addEventListener("click", () => els.loadJsonInput.click());
  els.loadJsonInput.addEventListener("change", (e) => loadJson(e.target.files[0]));
  draw();
}

init();

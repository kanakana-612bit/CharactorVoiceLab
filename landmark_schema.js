(function () {
  const schema = {
    schema_version: "anatomical_landmarks_0.3",
    terminology_source: "aistAnthropometryManual",
    coordinate_policy: {
      height: "vertical projected pixel distance",
      breadth: "horizontal projected pixel distance",
      free_distance: "Euclidean pixel distance",
      scale_priority: [
        "full-body stature: vertex to floor plane",
        "full-body total head height: vertex to gnathion",
        "shared total head height applied independently to head-front and head-profile images",
        "front interpupillary statistical fallback only when the full-body head anchor is unavailable",
      ],
    },
    concepts: [
      {
        id: "vertex",
        name_ja: "頭頂点",
        name_en: "vertex",
        abbreviation: "v",
        definition: "耳眼面を水平にしたとき、正中線上における頭頂部の最高点。",
        views: { body_front: "head_top", head_front: "face_top", head_profile: "profile_vertex" },
        role: "全頭高の上端・身長の上端",
      },
      {
        id: "gnathion",
        name_ja: "オトガイ点",
        name_en: "gnathion",
        abbreviation: "gn",
        definition: "耳眼面を水平にしたとき、正中線上における下顎の最下点。",
        views: { body_front: "chin", head_front: "chin", head_profile: "profile_chin" },
        role: "全頭高の下端・鼻下オトガイ高の下端",
      },
      {
        id: "subnasale",
        name_ja: "鼻下点",
        name_en: "subnasale",
        abbreviation: "sn",
        definition: "正中線上で鼻中隔前縁の下端が上唇の皮膚へ移行する点。",
        views: { head_front: "nose", head_profile: "profile_subnasale" },
        role: "鼻下オトガイ高の上端",
      },
      {
        id: "gonion",
        name_ja: "顎角点",
        name_en: "gonion",
        abbreviation: "go",
        definition: "下顎角が最も外側に突出している点。",
        views: { head_front: "jaw_left / jaw_right", head_profile: "profile_jaw_angle" },
        role: "下顎角幅の端点",
      },
      {
        id: "cheilion",
        name_ja: "口角点",
        name_en: "cheilion",
        abbreviation: "ch",
        definition: "口角で上赤唇と下赤唇の外端が移行する点。",
        views: { head_front: "mouth_left / mouth_right" },
        role: "口裂幅の端点",
      },
      {
        id: "pupil_center",
        name_ja: "瞳孔中心",
        name_en: "pupil center",
        abbreviation: "-",
        definition: "瞳孔領域の幾何学的中心。外表計測では、正面頭部画像の補助スケール点として扱う。",
        views: { head_front: "pupil_left / pupil_right" },
        role: "瞳孔間幅の端点・顔正面スケールの補助基準",
      },
      {
        id: "stomion",
        name_ja: "口点",
        name_en: "stomion",
        abbreviation: "sto",
        definition: "自然に口を閉じた状態で、口裂線と正中線が交わる点。",
        views: { head_profile: "profile_lip" },
        role: "側面口腔端の外表基準",
      },
      {
        id: "nasion",
        name_ja: "鼻根点",
        name_en: "nasion",
        abbreviation: "n",
        definition: "前頭鼻骨縫合と正中線の交点。",
        views: { head_profile: "profile_nasion" },
        role: "側面頭蓋顔面基準",
      },
      {
        id: "pronasale",
        name_ja: "鼻尖点",
        name_en: "pronasale",
        abbreviation: "prn",
        definition: "耳眼面を水平にしたとき、鼻尖の正中線上で最も前方に突出する点。",
        views: { head_profile: "profile_nose_tip" },
        role: "鼻突出の側面基準",
      },
      {
        id: "opistocranion",
        name_ja: "後頭点",
        name_en: "opistocranion",
        abbreviation: "op",
        definition: "正中線上で眉間点から最も遠い後頭部の点。",
        views: { head_profile: "profile_occiput" },
        role: "頭部前後径の後端",
      },
      {
        id: "tragion",
        name_ja: "耳珠点",
        name_en: "tragion",
        abbreviation: "tr",
        definition: "耳珠軟骨の上縁が側頭部皮膚へ移行する点。",
        views: { head_profile: "profile_tragion" },
        role: "耳眼面・頭耳高の基準",
      },
      {
        id: "anterior_nasal_spine",
        name_ja: "前鼻棘",
        name_en: "anterior nasal spine",
        abbreviation: "ANS",
        definition: "上顎骨正中部で鼻腔底・硬口蓋前端の基準となる骨性点。通常のキャラクター側面画像では直接観察できないため、声道設計用の手動推定点として扱う。",
        views: { head_profile: "profile_ans" },
        role: "Honda型の口蓋平面・口腔長 OCL の前方基準",
      },
      {
        id: "posterior_nasal_spine",
        name_ja: "後鼻棘",
        name_en: "posterior nasal spine",
        abbreviation: "PNS",
        definition: "硬口蓋後端の正中基準点。通常の参照画像では直接同定しにくいため、軟口蓋基部と口蓋平面を決める手動設計点として扱う。",
        views: { head_profile: "profile_pns" },
        role: "Honda型の口蓋平面・口腔長 OCL の後方基準",
      },
      {
        id: "menton",
        name_ja: "オトガイ下点",
        name_en: "menton",
        abbreviation: "me",
        definition: "下顎正中部の最下点。既存のオトガイ点より下顔面高 LFH の下端として明示的に扱う。",
        views: { head_profile: "profile_menton" },
        role: "口蓋平面から下顔面高 LFH を求めるための下端基準",
      },
      {
        id: "posterior_pharyngeal_wall",
        name_ja: "咽頭後壁",
        name_en: "posterior pharyngeal wall",
        abbreviation: "PPW",
        definition: "中咽頭から鼻咽腔後方の壁を代表する側面設計点。外表から直接観察される点ではなく、軟口蓋との距離と咽頭側の空間枠を決めるために配置する。",
        views: { head_profile: "profile_posterior_pharyngeal_wall" },
        role: "鼻咽腔閉鎖ギャップと形態的調音空間の後方境界",
      },
      {
        id: "soft_palate_hinge",
        name_ja: "軟口蓋基部",
        name_en: "soft palate hinge",
        abbreviation: "-",
        definition: "硬口蓋から軟口蓋へ移行する付近を表す側面設計点。PNSに近いが、声道テンプレートでは軟口蓋の回転・変形基部として分けて扱う。",
        views: { head_profile: "profile_soft_palate_hinge" },
        role: "軟口蓋長と鼻咽腔結合ガイドの基部",
      },
      {
        id: "velum_tip",
        name_ja: "軟口蓋後端",
        name_en: "velum tip",
        abbreviation: "-",
        definition: "軟口蓋の自由端を表す側面設計点。咽頭後壁との距離を鼻咽腔開放度・鼻腔漏れの幾何ガイドとして使う。",
        views: { head_profile: "profile_velum_tip" },
        role: "軟口蓋長・鼻咽腔ギャップ・鼻腔結合の設計基準",
      },
      {
        id: "hyoid_reference",
        name_ja: "舌骨位置",
        name_en: "hyoid reference point",
        abbreviation: "-",
        definition: "舌骨体の近傍を示す側面設計点。通常の参照画像では直接同定しにくいため、声道テンプレート変形用の推定制御点として扱う。",
        views: { head_profile: "profile_hyoid" },
        role: "舌根・咽頭下部のテンプレート制御点",
      },
      {
        id: "glottal_reference",
        name_ja: "声門位置",
        name_en: "glottal reference point",
        abbreviation: "-",
        definition: "声帯・声門の高さを近似する側面設計点。外表点ではなく、喉頭位置を声道モデルへ写像するための内部基準点。",
        views: { head_profile: "profile_larynx" },
        role: "声道長の起点・喉頭高さの設計基準",
      },
      {
        id: "anterior_neck_contour",
        name_ja: "頸部前縁点",
        name_en: "anterior neck contour point",
        abbreviation: "-",
        definition: "側面画像で頸部前縁の外表輪郭を代表する点。気管内径ではなく、頸部厚径と声道テンプレートの外形制御に用いる。",
        views: { head_profile: "profile_neck_front" },
        role: "側面頸部厚径の前方端",
      },
      {
        id: "posterior_neck_contour",
        name_ja: "頸部後縁点",
        name_en: "posterior neck contour point",
        abbreviation: "-",
        definition: "側面画像で頸部後縁の外表輪郭を代表する点。頸部厚径と頭頚部側面テンプレートの後方境界として扱う。",
        views: { head_profile: "profile_neck_back" },
        role: "側面頸部厚径の後方端",
      },
      {
        id: "acromiale",
        name_ja: "肩峰点",
        name_en: "acromiale",
        abbreviation: "a",
        definition: "肩峰外側縁上で肩部前後径の中央に位置する点。",
        views: { body_front: "left_shoulder / right_shoulder" },
        role: "肩峰幅の端点",
      },
      {
        id: "trochanterion_laterale",
        name_ja: "転子外突点",
        name_en: "trochanterion laterale",
        abbreviation: "tro",
        definition: "大腿骨大転子部で最も外側に突出する点。",
        views: { body_front: "left_hip / right_hip" },
        role: "大転子間幅の端点",
      },
      {
        id: "neck_side_point",
        name_ja: "頸側点",
        name_en: "neck side point",
        abbreviation: "-",
        definition: "僧帽筋前縁と頸付根線の交点。",
        views: { head_front: "neck_left / neck_right" },
        role: "頸付根幅の端点",
      },
      {
        id: "floor_reference",
        name_ja: "足底基準点",
        name_en: "floor reference",
        abbreviation: "-",
        definition: "正立画像で足底が床面に接する高さを示す画像上の基準点。解剖学的触知点ではない。",
        views: { body_front: "left_foot / right_foot" },
        role: "身長の床面基準",
      },
    ],
  };

  const labels = {
    head_top: "頭頂点",
    chin: "オトガイ点",
    left_shoulder: "左肩峰点（推定）",
    right_shoulder: "右肩峰点（推定）",
    left_hip: "左転子外突点（推定）",
    right_hip: "右転子外突点（推定）",
    left_foot: "左足底基準点",
    right_foot: "右足底基準点",
    face_top: "頭頂点",
    nose: "鼻下点",
    mouth_left: "左口角点",
    mouth_right: "右口角点",
    pupil_left: "左瞳孔中心",
    pupil_right: "右瞳孔中心",
    jaw_left: "左顎角点",
    jaw_right: "右顎角点",
    neck_left: "左頸側点",
    neck_right: "右頸側点",
    profile_vertex: "頭頂点",
    profile_occiput: "後頭点",
    profile_nasion: "鼻根点",
    profile_nose_tip: "鼻尖点",
    profile_subnasale: "鼻下点",
    profile_lip: "口点",
    profile_ans: "前鼻棘（ANS）",
    profile_pns: "後鼻棘（PNS）",
    profile_soft_palate_hinge: "軟口蓋基部",
    profile_velum_tip: "軟口蓋後端",
    profile_posterior_pharyngeal_wall: "咽頭後壁",
    profile_chin: "オトガイ点",
    profile_menton: "オトガイ下点",
    profile_jaw_angle: "顎角点",
    profile_tragion: "耳珠点",
    profile_hyoid: "舌骨位置（推定）",
    profile_larynx: "声門位置（推定）",
    profile_neck_front: "頸部前縁点（設計）",
    profile_neck_back: "頸部後縁点（設計）",
  };

  function horizontalDistance(a, b) {
    return a && b ? Math.abs(a.x - b.x) : null;
  }

  function verticalDistance(a, b) {
    return a && b ? Math.abs(a.y - b.y) : null;
  }

  function midpoint(a, b) {
    if (!a && !b) return null;
    if (!a) return { ...b };
    if (!b) return { ...a };
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }

  function finitePositive(value) {
    return Number.isFinite(value) && value > 0;
  }

  function splitViewKeys(value) {
    if (!value) return [];
    return String(value).split("/").map((key) => key.trim()).filter(Boolean);
  }

  function conceptForKey(key) {
    return schema.concepts.find((concept) => {
      return Object.values(concept.views ?? {}).some((viewKeys) => splitViewKeys(viewKeys).includes(key));
    }) ?? null;
  }

  function landmarkInfo(key) {
    const concept = conceptForKey(key);
    return {
      key,
      label: labels[key] ?? key,
      concept_id: concept?.id ?? null,
      name_ja: concept?.name_ja ?? labels[key] ?? key,
      name_en: concept?.name_en ?? "",
      abbreviation: concept?.abbreviation ?? "",
      definition: concept?.definition ?? "この点の定義は未登録です。暫定的な設計点として扱ってください。",
      role: concept?.role ?? "手動配置された設計点",
      terminology_source: concept ? schema.terminology_source : "project_local_design",
    };
  }

  function computeCalibration({ body = {}, face = {}, profile = {}, heightCm, interpupillaryReferenceCm }) {
    const floorPoint = midpoint(body.left_foot, body.right_foot);
    const staturePx = verticalDistance(body.head_top, floorPoint);
    const bodyCmPerPx = finitePositive(heightCm) && finitePositive(staturePx) ? heightCm / staturePx : null;
    const bodyHeadPx = verticalDistance(body.head_top, body.chin);
    const frontHeadPx = verticalDistance(face.face_top, face.chin);
    const profileHeadPx = verticalDistance(profile.profile_vertex, profile.profile_chin);
    const frontIpdPx = horizontalDistance(face.pupil_left, face.pupil_right);
    let sharedHeadHeightCm = finitePositive(bodyCmPerPx) && finitePositive(bodyHeadPx) ? bodyCmPerPx * bodyHeadPx : null;
    let sharedHeadHeightSource = sharedHeadHeightCm ? "body_stature_vertex_to_gnathion" : null;
    let frontCmPerPx = finitePositive(sharedHeadHeightCm) && finitePositive(frontHeadPx) ? sharedHeadHeightCm / frontHeadPx : null;
    let frontScaleSource = frontCmPerPx ? "shared_total_head_height" : null;

    if (!frontCmPerPx && finitePositive(frontIpdPx) && finitePositive(interpupillaryReferenceCm)) {
      frontCmPerPx = interpupillaryReferenceCm / frontIpdPx;
      frontScaleSource = "interpupillary_statistical_fallback";
      if (!sharedHeadHeightCm && finitePositive(frontHeadPx)) {
        sharedHeadHeightCm = frontCmPerPx * frontHeadPx;
        sharedHeadHeightSource = "front_interpupillary_statistical_fallback";
      }
    }

    const profileCmPerPx = finitePositive(sharedHeadHeightCm) && finitePositive(profileHeadPx)
      ? sharedHeadHeightCm / profileHeadPx
      : null;
    const profileScaleSource = profileCmPerPx ? "shared_total_head_height" : null;
    const reconstructedHeadHeights = {
      body_front_cm: finitePositive(bodyCmPerPx) && finitePositive(bodyHeadPx) ? bodyCmPerPx * bodyHeadPx : null,
      head_front_cm: finitePositive(frontCmPerPx) && finitePositive(frontHeadPx) ? frontCmPerPx * frontHeadPx : null,
      head_profile_cm: finitePositive(profileCmPerPx) && finitePositive(profileHeadPx) ? profileCmPerPx * profileHeadPx : null,
    };
    const availableHeadHeights = Object.values(reconstructedHeadHeights).filter(finitePositive);
    const maxCrossViewDeltaCm = availableHeadHeights.length > 1
      ? Math.max(...availableHeadHeights) - Math.min(...availableHeadHeights)
      : null;
    const warnings = [];
    if (!bodyCmPerPx) warnings.push("全身画像の頭頂点と足底基準面が未確定のため、身長による一次スケールを使用できません。");
    if (!sharedHeadHeightCm) warnings.push("全頭高を確定できないため、顔正面と顔側面の共通cmスケールは未設定です。");
    if (sharedHeadHeightSource === "front_interpupillary_statistical_fallback") warnings.push("全身基準がないため、顔正面の瞳孔間幅事前値から全頭高を暫定推定しています。");
    if (sharedHeadHeightCm && !frontCmPerPx) warnings.push("顔正面の頭頂点とオトガイ点が未確定です。");
    if (sharedHeadHeightCm && !profileCmPerPx) warnings.push("顔側面の頭頂点とオトガイ点が未確定です。");

    return {
      schema_version: "image_calibration_0.2",
      policy: "body_stature_then_shared_total_head_height",
      stature: {
        input_height_cm: finitePositive(heightCm) ? heightCm : null,
        pixel_height: staturePx,
        cm_per_px: bodyCmPerPx,
        measurement: "vertical_vertex_to_floor_plane",
      },
      shared_total_head_height: {
        value_cm: sharedHeadHeightCm,
        source: sharedHeadHeightSource,
        measurement: "vertical_vertex_to_gnathion",
      },
      views: {
        body_front: { total_head_height_px: bodyHeadPx, cm_per_px: bodyCmPerPx, total_head_height_cm: reconstructedHeadHeights.body_front_cm },
        head_front: { total_head_height_px: frontHeadPx, cm_per_px: frontCmPerPx, scale_source: frontScaleSource, total_head_height_cm: reconstructedHeadHeights.head_front_cm },
        head_profile: { total_head_height_px: profileHeadPx, cm_per_px: profileCmPerPx, scale_source: profileScaleSource, total_head_height_cm: reconstructedHeadHeights.head_profile_cm },
      },
      cross_view_consistency: {
        compared_view_count: availableHeadHeights.length,
        max_total_head_height_delta_cm: maxCrossViewDeltaCm,
        status: availableHeadHeights.length > 1 ? (maxCrossViewDeltaCm < 0.001 ? "reconciled" : "conflict") : "insufficient_views",
      },
      warnings,
    };
  }

  window.CVL_LANDMARKS = { schema, labels, horizontalDistance, verticalDistance, midpoint, conceptForKey, landmarkInfo, computeCalibration };
})();

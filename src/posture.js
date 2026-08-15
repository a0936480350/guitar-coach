// ─────────────────────────────────────────────────────────────────────────────
// posture.js · 左手姿勢幾何分析（純函式，不碰鏡頭、不碰 DOM）
//
// 輸入：MediaPipe HandLandmarker 的 21 個關鍵點
//   [{x,y,z}, ...]  x/y 已正規化到 0..1，z 是相對深度
//
// 刻意的設計限制：**只算關節之間的相對角度，不試圖知道琴頸在哪。**
// 「食指按在第幾弦第幾格」需要先偵測琴頸/琴衍位置、處理相機角度與遮擋，
// 那是研究等級的題目（見 .agents/DECISIONS.md D-0001）。
// 相對角度完全避開那些問題，而且正好是老師最在意的東西。
// ─────────────────────────────────────────────────────────────────────────────

/** MediaPipe Hands 的 21 點索引 */
export const LM = {
  WRIST: 0,
  THUMB_CMC: 1, THUMB_MCP: 2, THUMB_IP: 3, THUMB_TIP: 4,
  INDEX_MCP: 5, INDEX_PIP: 6, INDEX_DIP: 7, INDEX_TIP: 8,
  MIDDLE_MCP: 9, MIDDLE_PIP: 10, MIDDLE_DIP: 11, MIDDLE_TIP: 12,
  RING_MCP: 13, RING_PIP: 14, RING_DIP: 15, RING_TIP: 16,
  PINKY_MCP: 17, PINKY_PIP: 18, PINKY_DIP: 19, PINKY_TIP: 20,
};

export const FINGERS = [
  { name: '食指', mcp: LM.INDEX_MCP,  pip: LM.INDEX_PIP,  dip: LM.INDEX_DIP,  tip: LM.INDEX_TIP },
  { name: '中指', mcp: LM.MIDDLE_MCP, pip: LM.MIDDLE_PIP, dip: LM.MIDDLE_DIP, tip: LM.MIDDLE_TIP },
  { name: '無名', mcp: LM.RING_MCP,   pip: LM.RING_PIP,   dip: LM.RING_DIP,   tip: LM.RING_TIP },
  { name: '小指', mcp: LM.PINKY_MCP,  pip: LM.PINKY_PIP,  dip: LM.PINKY_DIP,  tip: LM.PINKY_TIP },
];

const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: (a.z ?? 0) - (b.z ?? 0) });
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const len = a => Math.hypot(a.x, a.y, a.z);

/** 三點夾角（度）。b 是頂點。 */
export function angleAt(a, b, c) {
  const u = sub(a, b), v = sub(c, b);
  const d = len(u) * len(v);
  if (d === 0) return NaN;
  return Math.acos(Math.max(-1, Math.min(1, dot(u, v) / d))) * 180 / Math.PI;
}

/**
 * 每根手指在 PIP 關節的彎曲角度。
 * 180° = 完全打直，數字越小彎越多。
 *
 * 為什麼看 PIP：按弦時手指要「立起來」用指尖壓，PIP 太直代表用指腹壓，
 * 容易壓到隔壁弦。這是初學最常見的問題之一。
 */
export function fingerCurls(lms) {
  return FINGERS.map(f => ({
    name: f.name,
    pip: angleAt(lms[f.mcp], lms[f.pip], lms[f.tip]),
  }));
}

/**
 * 拇指是否越過琴頸。
 *
 * 判準：拇指指尖相對「食指根部→小指根部」那條掌緣線的哪一側。
 * 用手掌自己的座標系，所以相機角度轉一點也不影響 —— 這是關鍵。
 *
 * @returns {{side:number, over:boolean}} side 正值代表越過掌背側
 */
export function thumbOverNeck(lms, threshold = 0.02) {
  const a = lms[LM.INDEX_MCP], b = lms[LM.PINKY_MCP];
  const t = lms[LM.THUMB_TIP];
  // 掌緣線的法向量（2D 即可，深度在此不可靠）
  const ex = b.x - a.x, ey = b.y - a.y;
  const nx = -ey, ny = ex;
  const n = Math.hypot(nx, ny) || 1;
  const side = ((t.x - a.x) * nx + (t.y - a.y) * ny) / n;
  return { side, over: side > threshold };
}

/** 手掌張開程度：食指根到小指根的距離 ÷ 手腕到中指根的距離。用比值才不受遠近影響。 */
export function palmSpread(lms) {
  const w = Math.hypot(lms[LM.PINKY_MCP].x - lms[LM.INDEX_MCP].x,
                       lms[LM.PINKY_MCP].y - lms[LM.INDEX_MCP].y);
  const h = Math.hypot(lms[LM.MIDDLE_MCP].x - lms[LM.WRIST].x,
                       lms[LM.MIDDLE_MCP].y - lms[LM.WRIST].y);
  return h === 0 ? NaN : w / h;
}

/**
 * ⚠ 目前做不到：手腕彎折角度。
 *
 * 真正的手腕彎折要 前臂方向 vs 手掌方向，而 HandLandmarker 只給手，
 * 沒有手肘。要算它必須另外跑 PoseLandmarker 拿到 elbow。
 * 這是 M1.5，不是現在。誠實標示，不要假裝算得出來。
 */
export const WRIST_ANGLE_UNAVAILABLE =
  '手腕彎折角度需要前臂方向（手肘），HandLandmarker 沒有提供。需另跑 Pose 模型。';

/**
 * 預設門檻 —— **這些數字是placeholder，不是教學標準。**
 *
 * 每一條都要 Mike 用真實學生的手校準過才有意義。
 * 演算法算得出「PIP 是 168 度」，但「168 度該不該提醒」是教學判斷，
 * 那是十幾年經驗換來的東西，不是寫程式能生出來的。
 */
export const DEFAULT_RULES = {
  fingerTooFlat: 155,     // PIP 大於這個角度 = 手指太平，可能用指腹壓弦
  thumbOverSide: 0.02,    // 拇指越過掌緣多少算「越頸」
  calibrated: false,      // Mike 校準過才改成 true
};

/**
 * 產生回饋。回傳的每一則都標明信心來源，避免把 placeholder 當成教學標準。
 */
export function analyse(lms, rules = DEFAULT_RULES) {
  if (!lms || lms.length < 21) return { ok: false, issues: [], metrics: null };

  const curls = fingerCurls(lms);
  const thumb = thumbOverNeck(lms, rules.thumbOverSide);
  const spread = palmSpread(lms);

  const issues = [];
  for (const c of curls) {
    if (Number.isFinite(c.pip) && c.pip > rules.fingerTooFlat) {
      issues.push({
        code: 'finger-flat',
        text: `${c.name}太平（${c.pip.toFixed(0)}°）— 立起來用指尖壓`,
        value: c.pip,
      });
    }
  }
  if (thumb.over) {
    issues.push({
      code: 'thumb-over',
      text: `拇指越過琴頸（${thumb.side.toFixed(3)}）`,
      value: thumb.side,
    });
  }

  return {
    ok: true,
    issues,
    metrics: { curls, thumb, spread },
    calibrated: rules.calibrated,
  };
}

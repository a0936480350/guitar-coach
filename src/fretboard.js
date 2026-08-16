// ─────────────────────────────────────────────────────────────────────────────
// fretboard.js · 指板座標對應（純函式，不碰鏡頭）
//
// 目標：知道指尖在畫面上的座標 → 算出他按在第幾弦第幾格。
//
// 為什麼可行（我先前說這是研究級，那句話只對了一半）：
//   · 讓程式「自動」找出琴頸/琴衍 → 確實是研究級題目
//   · 但讓使用者「先校準四個角」→ 就只是單應性變換，成熟幾何
//
// 校準點（畫面座標）：
//   P0 上弦枕 · 第1弦側      P1 上弦枕 · 第6弦側
//   P2 第12格 · 第1弦側      P3 第12格 · 第6弦側
//
// 對應到指板座標系：
//   x：0 = 上弦枕，1 = 第 12 格
//   y：0 = 第 1 弦（最細），1 = 第 6 弦（最粗）
// ─────────────────────────────────────────────────────────────────────────────

const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

/** 標準調音各弦空弦 MIDI（index 0 = 第1弦，最細） */
export const STRING_MIDI = [64, 59, 55, 50, 45, 40];

/**
 * 求 4 點對 4 點的單應性矩陣（3x3，最後一項固定為 1）。
 * 解一個 8x8 線性方程組，用高斯消去法。
 *
 * @param {{x:number,y:number}[]} src 4 個來源點
 * @param {{x:number,y:number}[]} dst 4 個目標點
 * @returns {number[]|null} 長度 9 的矩陣，退化時回傳 null
 */
export function computeHomography(src, dst) {
  if (src.length !== 4 || dst.length !== 4) return null;
  const A = [], b = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = src[i], { x: X, y: Y } = dst[i];
    A.push([x, y, 1, 0, 0, 0, -X * x, -X * y]); b.push(X);
    A.push([0, 0, 0, x, y, 1, -Y * x, -Y * y]); b.push(Y);
  }
  const h = solve(A, b);
  if (!h) return null;
  return [...h, 1];
}

/** 高斯消去（含部分主元選取），8x8 用這個夠了 */
function solve(A, b) {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let piv = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
    if (Math.abs(M[piv][c]) < 1e-12) return null;         // 退化：四點共線之類
    [M[c], M[piv]] = [M[piv], M[c]];
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c] / M[c][c];
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  return M.map((row, i) => row[n] / row[i]);
}

/** 用單應性矩陣把一個點投影過去 */
export function applyHomography(H, p) {
  const w = H[6] * p.x + H[7] * p.y + H[8];
  if (Math.abs(w) < 1e-12) return null;
  return {
    x: (H[0] * p.x + H[1] * p.y + H[2]) / w,
    y: (H[3] * p.x + H[4] * p.y + H[5]) / w,
  };
}

/**
 * 指板 x 座標 → 格數。
 *
 * ⚠ **琴衍間距不是等距的。** 第 n 格距上弦枕的比例是 1 - 2^(-n/12)，
 * 到第 12 格剛好是弦長的一半。所以校準 0..1 對應「上弦枕..第12格」時：
 *     x = (1 - 2^(-n/12)) / 0.5 = 2 * (1 - 2^(-n/12))
 * 反解：n = -12 * log2(1 - x/2)
 *
 * 用線性換算（x*12）會嚴重偏掉 —— 例如第 5 格線性算是 x=0.417，
 * 實際是 x=0.5，差了將近一格半。
 */
export function xToFret(x) {
  const inner = 1 - x / 2;
  if (inner <= 0) return null;              // 超過理論極限
  return -12 * Math.log2(inner);
}

/** 反向：格數 → 指板 x（畫格線用） */
export function fretToX(n) {
  return 2 * (1 - Math.pow(2, -n / 12));
}

/** 指板 y 座標 → 弦號（0 = 第1弦） */
export function yToString(y) {
  return y * 5;                              // 0..1 對應 6 條弦的 0..5
}

/**
 * 指尖畫面座標 → 按在哪。
 * @returns {{string:number, fret:number, midi:number, note:string, ok:boolean, why?:string}}
 */
export function locate(H, point, opts = {}) {
  const maxFret = opts.maxFret ?? 15;
  const fb = applyHomography(H, point);
  if (!fb) return { ok: false, why: '投影退化' };

  const fretF = xToFret(fb.x);
  if (fretF === null) return { ok: false, why: '超出指板範圍' };
  const strF = yToString(fb.y);

  // 容差：稍微超出邊界仍接受，但明顯在外面就拒絕
  if (fb.x < -0.06 || fretF > maxFret + 0.5) return { ok: false, why: '不在指板上（縱向）' };
  if (strF < -0.6 || strF > 5.6)             return { ok: false, why: '不在指板上（橫向）' };

  // 按下去的位置在兩根琴衍之間，發出的是「較高那一格」的音
  const fret = Math.max(0, Math.min(maxFret, Math.ceil(fretF - 1e-6)));
  const string = Math.max(0, Math.min(5, Math.round(strF)));
  const midi = STRING_MIDI[string] + fret;

  return {
    ok: true,
    string, fret, midi,
    note: NOTE_NAMES[((midi % 12) + 12) % 12],
    octave: Math.floor(midi / 12) - 1,
    raw: { x: fb.x, y: fb.y, fretF, strF },
  };
}

/** 校準點的合理性檢查 —— 四點亂點會做出無意義的變換 */
export function validateCalibration(pts) {
  if (!pts || pts.length !== 4) return { ok: false, why: '需要 4 個點' };
  const H = computeHomography(pts, [{x:0,y:0},{x:0,y:1},{x:1,y:0},{x:1,y:1}]);
  if (!H) return { ok: false, why: '四點退化（可能共線或重疊）' };
  // 面積太小代表點得太擠，換算會非常不穩
  const area = Math.abs(
    (pts[1].x-pts[0].x)*(pts[2].y-pts[0].y) - (pts[2].x-pts[0].x)*(pts[1].y-pts[0].y)
  );
  if (area < 0.004) return { ok: false, why: '四點範圍太小，請沿著整個指板點' };
  return { ok: true, H };
}

/** 標準的目標矩形：對應 P0..P3 的順序 */
export const TARGET_RECT = [
  { x: 0, y: 0 },   // 上弦枕 · 第1弦
  { x: 0, y: 1 },   // 上弦枕 · 第6弦
  { x: 1, y: 0 },   // 第12格 · 第1弦
  { x: 1, y: 1 },   // 第12格 · 第6弦
];

export const CALIB_STEPS = [
  '上弦枕（琴頭那端）· 第 1 弦側（最細的弦）',
  '上弦枕 · 第 6 弦側（最粗的弦）',
  '第 12 格 · 第 1 弦側',
  '第 12 格 · 第 6 弦側',
];

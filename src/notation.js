// ─────────────────────────────────────────────────────────────────────────────
// notation.js · 五線譜與 TAB 譜（產生 SVG 字串，純函式）
//
// 自己畫而不引入 VexFlow：少一個 CDN 依賴、檔案小、而且我們只需要
// 「顯示幾個音」這種最單純的用途，不需要完整的排版引擎。
//
// ⚠ TAB 譜的弦序：**第 1 弦（最細的高音 E）畫在最上面**。
// 這跟一般人直覺相反，而且是吉他教材最常見的致命錯誤 —— 畫反了學生會全部彈錯。
// ─────────────────────────────────────────────────────────────────────────────

const SHARP_TO_STEP = {
  0:{step:'C',acc:0}, 1:{step:'C',acc:1}, 2:{step:'D',acc:0}, 3:{step:'D',acc:1},
  4:{step:'E',acc:0}, 5:{step:'F',acc:0}, 6:{step:'F',acc:1}, 7:{step:'G',acc:0},
  8:{step:'G',acc:1}, 9:{step:'A',acc:0}, 10:{step:'A',acc:1}, 11:{step:'B',acc:0},
};
const STEP_ORDER = { C:0, D:1, E:2, F:3, G:4, A:5, B:6 };

/** MIDI → 五線譜上的「線位」(diatonic step)，用來決定畫在第幾線 */
function diatonicIndex(midi) {
  const pc = ((midi % 12) + 12) % 12;
  const oct = Math.floor(midi / 12) - 1;
  const { step, acc } = SHARP_TO_STEP[pc];
  return { index: oct * 7 + STEP_ORDER[step], acc, step, oct };
}

/**
 * 五線譜 SVG。高音譜號，中央 C 以下用下加線。
 * @param {number[][]} groups 每個元素是同時發聲的一組 MIDI（單音就給長度 1）
 */
export function staffSVG(groups, opts = {}) {
  const W = opts.width ?? Math.max(260, 90 + groups.length * 74);
  const H = 150;
  const LINE_GAP = 11;                 // 線與線的距離
  const TOP = 46;                      // 最上面那條線的 y
  // 高音譜號：E4(midi 64) 在最下面那條線
  const baseIdx = diatonicIndex(64).index;
  const yOf = midi => {
    const d = diatonicIndex(midi).index - baseIdx;
    return TOP + 4 * LINE_GAP - d * (LINE_GAP / 2);
  };

  let sv = '';
  // 五條線
  for (let i = 0; i < 5; i++) {
    const y = TOP + i * LINE_GAP;
    sv += `<line x1="14" y1="${y}" x2="${W - 10}" y2="${y}" stroke="#2a2f3a" stroke-width="1.1"/>`;
  }
  // 高音譜號（簡化的 G 記號造型，不是完整字型）
  sv += `<text x="20" y="${TOP + 4 * LINE_GAP}" font-size="46" fill="#1b2029"
          font-family="Georgia,serif" dominant-baseline="alphabetic">𝄞</text>`;

  groups.forEach((g, gi) => {
    const x = 86 + gi * 74;
    g.forEach(midi => {
      const y = yOf(midi);
      const { acc } = diatonicIndex(midi);
      // 下加線 / 上加線
      const bottom = TOP + 4 * LINE_GAP, top = TOP;
      for (let ly = bottom + LINE_GAP; ly <= y + 0.5; ly += LINE_GAP)
        sv += `<line x1="${x-13}" y1="${ly}" x2="${x+13}" y2="${ly}" stroke="#2a2f3a" stroke-width="1.1"/>`;
      for (let ly = top - LINE_GAP; ly >= y - 0.5; ly -= LINE_GAP)
        sv += `<line x1="${x-13}" y1="${ly}" x2="${x+13}" y2="${ly}" stroke="#2a2f3a" stroke-width="1.1"/>`;
      sv += `<ellipse cx="${x}" cy="${y}" rx="7" ry="5.2" fill="#12161d" transform="rotate(-18 ${x} ${y})"/>`;
      if (acc) sv += `<text x="${x-20}" y="${y+5}" font-size="17" fill="#12161d" font-family="Georgia,serif">♯</text>`;
    });
  });

  return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"
    xmlns="http://www.w3.org/2000/svg" role="img" aria-label="五線譜">${sv}</svg>`;
}

/** 標準調音每條弦的空弦 MIDI（第1弦→第6弦，跟畫面由上到下一致） */
export const STRING_MIDI = [64, 59, 55, 50, 45, 40];
export const STRING_LABEL = ['E', 'B', 'G', 'D', 'A', 'E'];

/**
 * 把一個 MIDI 音找出合理的 (弦, 格)。
 * 偏好低把位、且不要用太高的格數。
 */
export function midiToFret(midi, maxFret = 14) {
  let best = null;
  for (let s = 0; s < 6; s++) {
    const fret = midi - STRING_MIDI[s];
    if (fret < 0 || fret > maxFret) continue;
    if (!best || fret < best.fret) best = { string: s, fret };
  }
  return best;
}

/**
 * TAB 譜 SVG。**第 1 弦在最上面** —— 見檔頭警告。
 */
export function tabSVG(groups, opts = {}) {
  const W = opts.width ?? Math.max(260, 90 + groups.length * 74);
  const GAP = 15, TOP = 26, H = TOP + 5 * GAP + 34;

  let sv = '';
  for (let i = 0; i < 6; i++) {
    const y = TOP + i * GAP;
    sv += `<line x1="40" y1="${y}" x2="${W - 10}" y2="${y}" stroke="#2a2f3a" stroke-width="1.1"/>`;
    sv += `<text x="14" y="${y + 4}" font-size="11" fill="#5b6472"
            font-family="ui-monospace,monospace">${STRING_LABEL[i]}</text>`;
  }
  sv += `<text x="40" y="${TOP + 5 * GAP + 26}" font-size="10" fill="#5b6472"
          font-family="ui-monospace,monospace">第 1 弦（最細）在最上面</text>`;

  groups.forEach((g, gi) => {
    const x = 86 + gi * 74;
    g.forEach(midi => {
      const pos = midiToFret(midi);
      if (!pos) return;
      const y = TOP + pos.string * GAP;
      sv += `<rect x="${x - 10}" y="${y - 8}" width="20" height="16" fill="#f7f8fa"/>`;
      sv += `<text x="${x}" y="${y + 4}" font-size="13" font-weight="700" fill="#12161d"
              text-anchor="middle" font-family="ui-monospace,monospace">${pos.fret}</text>`;
    });
  });

  return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"
    xmlns="http://www.w3.org/2000/svg" role="img" aria-label="TAB 譜">${sv}</svg>`;
}

/** 依模式產生樂譜 */
export function renderNotation(notation, mode = 'staff') {
  if (!notation) return '';
  const groups = notation.chords ? notation.chords
               : notation.midis ? notation.midis.map(m => [m])
               : [];
  if (!groups.length) return '';
  return mode === 'tab' ? tabSVG(groups) : staffSVG(groups);
}

// ─────────────────────────────────────────────────────────────────────────────
// chroma.js · 和弦辨識核心（純函式，不碰 DOM、不碰麥克風）
//
// 拆成獨立模組是為了「可測試」：同一份程式碼既能吃麥克風的即時音訊，
// 也能吃合成出來的測試音。沒有吉他也能證明演算法會動。
//
// 流程：頻譜 → 12 音級能量（chroma）→ 和弦範本比對 → 最像的和弦
// ─────────────────────────────────────────────────────────────────────────────

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/**
 * 和弦範本：12 維向量，該和弦包含的音級設 1，其餘 0。
 * 只放吉他初學最常用的開放和弦 —— 範圍小，辨識才準。
 * 這是刻意的：辨識 24 個和弦的準確率遠低於辨識 8 個。
 */
/**
 * 和弦分級。**級別越高，和弦越多，準確率越低** —— 這是必然的取捨，
 * 因為和弦一多，彼此共用的音就多，chroma 的區辨力會下降。
 * 所以由使用者自己選，而不是預設全開。
 */
export const CHORD_SETS = {
  basic: {
    label: '初級 · 開放和弦',
    note: '最準。9 個最常用的開放和弦。',
    spec: {
      'C':[0,4,7], 'D':[2,6,9], 'E':[4,8,11], 'F':[5,9,0], 'G':[7,11,2], 'A':[9,1,4],
      'Am':[9,0,4], 'Em':[4,7,11], 'Dm':[2,5,9],
    },
  },
  seventh: {
    label: '中級 · 加七和弦',
    note: '多了屬七與小七。七和弦多一個音，跟三和弦的區辨變難。',
    spec: {
      'C':[0,4,7], 'D':[2,6,9], 'E':[4,8,11], 'F':[5,9,0], 'G':[7,11,2], 'A':[9,1,4],
      'Am':[9,0,4], 'Em':[4,7,11], 'Dm':[2,5,9],
      'G7':[7,11,2,5], 'C7':[0,4,7,10], 'D7':[2,6,9,0], 'A7':[9,1,4,7], 'E7':[4,8,11,2],
      'B7':[11,3,6,9],
      'Am7':[9,0,4,7], 'Em7':[4,7,11,2], 'Dm7':[2,5,9,0],
      'Cmaj7':[0,4,7,11], 'Fmaj7':[5,9,0,4], 'Gmaj7':[7,11,2,6],
    },
  },
  full: {
    label: '進階 · 含封閉與掛留',
    note: '再加封閉和弦與 sus。**準確率會明顯下降**，只在安靜環境用。',
    spec: {
      'C':[0,4,7], 'D':[2,6,9], 'E':[4,8,11], 'F':[5,9,0], 'G':[7,11,2], 'A':[9,1,4],
      'B':[11,3,6], 'Bb':[10,2,5],
      'Am':[9,0,4], 'Em':[4,7,11], 'Dm':[2,5,9], 'Bm':[11,2,6], 'Cm':[0,3,7],
      'F#m':[6,9,1], 'Gm':[7,10,2],
      'G7':[7,11,2,5], 'C7':[0,4,7,10], 'D7':[2,6,9,0], 'A7':[9,1,4,7], 'E7':[4,8,11,2],
      'B7':[11,3,6,9],
      'Am7':[9,0,4,7], 'Em7':[4,7,11,2], 'Dm7':[2,5,9,0], 'Bm7':[11,2,6,9],
      'Cmaj7':[0,4,7,11], 'Fmaj7':[5,9,0,4], 'Gmaj7':[7,11,2,6],
      'Dsus4':[2,7,9], 'Asus4':[9,2,4], 'Esus4':[4,9,11], 'Dsus2':[2,4,9], 'Asus2':[9,11,4],
    },
  },
};

/** 目前使用的範本（預設初級）。用 setChordSet() 切換。 */
export let CHORD_TEMPLATES = buildTemplates(CHORD_SETS.basic.spec);

export function setChordSet(key) {
  const set = CHORD_SETS[key];
  if (!set) throw new Error(`未知的和弦組: ${key}`);
  CHORD_TEMPLATES = buildTemplates(set.spec);
  return CHORD_TEMPLATES;
}

function buildTemplates(spec) {
  const out = {};
  for (const [name, pitchClasses] of Object.entries(spec)) {
    const v = new Array(12).fill(0);
    for (const pc of pitchClasses) v[pc] = 1;
    out[name] = v;
  }
  return out;
}

/**
 * 頻譜 → chroma 向量。
 *
 * 對每個 FFT bin 算出它的頻率，換成音級（pitch class），把能量累加進去。
 * 用 magnitude 而非 power：吉他泛音很強，平方會讓泛音過度主導。
 *
 * @param {Float32Array|number[]} magnitudes 線性振幅頻譜（非 dB）
 * @param {number} sampleRate
 * @param {number} fftSize
 * @param {{fMin?:number, fMax?:number}} [opts]
 * @returns {number[]} 長度 12，已正規化成最大值為 1（全靜音時全 0）
 */
export function computeChroma(magnitudes, sampleRate, fftSize, opts = {}) {
  // 吉他最低音 E2 ≈ 82Hz。上限 2000Hz —— 再高幾乎只剩泛音跟雜訊，
  // 納入反而會把 chroma 拉糊。
  const fMin = opts.fMin ?? 75;
  const fMax = opts.fMax ?? 2000;

  const chroma = new Array(12).fill(0);
  const binHz = sampleRate / fftSize;

  for (let i = 1; i < magnitudes.length; i++) {
    const freq = i * binHz;
    if (freq < fMin || freq > fMax) continue;

    const mag = magnitudes[i];
    if (!(mag > 0)) continue;

    // MIDI 音高：69 = A4 = 440Hz
    const midi = 69 + 12 * Math.log2(freq / 440);
    const pc = ((Math.round(midi) % 12) + 12) % 12;
    chroma[pc] += mag;
  }

  const max = Math.max(...chroma);
  if (max <= 0) return chroma;
  return chroma.map(v => v / max);
}

/** 餘弦相似度 —— 只看向量方向，不受整體音量影響。 */
export function cosineSimilarity(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na  += a[i] * a[i];
    nb  += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/**
 * 比對 chroma 跟所有和弦範本，回傳排序後的結果。
 * @returns {{chord:string, score:number}[]} 由高到低
 */
export function matchChord(chroma, templates = CHORD_TEMPLATES) {
  const scored = Object.entries(templates)
    .map(([chord, tpl]) => ({ chord, score: cosineSimilarity(chroma, tpl) }))
    .sort((a, b) => b.score - a.score);
  return scored;
}

/**
 * 完整判定：給 chroma，回傳最佳猜測與是否夠有把握。
 *
 * `margin` 是第一名與第二名的差距 —— 這比單看分數重要。
 * C 和 Am 共用兩個音，分數都會高；真正代表「我確定」的是拉開的差距。
 */
export function identify(chroma, opts = {}) {
  const minScore  = opts.minScore  ?? 0.75;
  const minMargin = opts.minMargin ?? 0.04;

  const ranked = matchChord(chroma, opts.templates);
  const best = ranked[0];
  const second = ranked[1];
  const margin = second ? best.score - second.score : 1;

  return {
    chord: best.chord,
    score: best.score,
    margin,
    confident: best.score >= minScore && margin >= minMargin,
    ranked: ranked.slice(0, 3),
  };
}

/** 這個和弦「應該」有哪些音名 —— 給 UI 顯示用。 */
export function chordNotes(chord, templates = CHORD_TEMPLATES) {
  const tpl = templates[chord];
  if (!tpl) return [];
  return tpl.map((v, i) => (v ? NOTE_NAMES[i] : null)).filter(Boolean);
}

/**
 * 找出音級集合「完全相同」的和弦group。
 *
 * 例：Dsus2 = D·E·A，Asus4 = A·D·E —— 同一組音，只是根音不同。
 * chroma 是十二音級的能量分布，**天生就丟掉了八度與低音資訊**，
 * 所以這類和弦在原理上就分不出來，不是演算法沒調好。
 *
 * 誠實的做法是把它們一起回報，而不是硬選一個裝作有把握。
 */
export function ambiguityGroups(templates = CHORD_TEMPLATES) {
  const byKey = {};
  for (const [name, vec] of Object.entries(templates)) {
    const key = vec.join('');
    (byKey[key] ||= []).push(name);
  }
  return Object.values(byKey).filter(g => g.length > 1);
}

/** 這個和弦有哪些「聽起來完全一樣」的同伴（不含自己）。 */
export function ambiguousWith(chord, templates = CHORD_TEMPLATES) {
  const vec = templates[chord];
  if (!vec) return [];
  const key = vec.join('');
  return Object.entries(templates)
    .filter(([n, v]) => n !== chord && v.join('') === key)
    .map(([n]) => n);
}

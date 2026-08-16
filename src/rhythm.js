// ─────────────────────────────────────────────────────────────────────────────
// rhythm.js · 節拍細分與鼓機節奏型（純資料 + 純函式，不碰 Web Audio）
//
// 分離的理由同前：排程與合成交給 UI，這裡只負責「什麼時候該響什麼」，
// 所以可以在沒有喇叭的情況下驗證每個節奏型的時間點是否正確。
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 細分模式：一拍要切成幾等份。
 * sound 是給人看的擬聲，對應 Mike 說的「搭滴滴滴」。
 */
export const SUBDIVISIONS = {
  quarter: { n: 1, label: '四分音符', sound: '搭 搭 搭 搭' },
  eighth:  { n: 2, label: '八分音符', sound: '搭滴 搭滴' },
  triplet: { n: 3, label: '三連音',   sound: '搭滴滴 搭滴滴' },
  sixteen: { n: 4, label: '十六分音符', sound: '搭滴滴滴' },
  quint:   { n: 5, label: '五連音',   sound: '搭滴滴滴滴' },
  sextup:  { n: 6, label: '六連音',   sound: '搭滴滴波滴滴' },
};

/**
 * 產生一個小節內所有點擊的時間（以「拍」為單位，0 起算）。
 * @returns {{beat:number, accent:'bar'|'beat'|'sub'}[]}
 */
export function clickGrid(beatsPerBar, subdivisionKey) {
  const sub = SUBDIVISIONS[subdivisionKey];
  if (!sub) throw new Error(`未知的細分: ${subdivisionKey}`);
  const out = [];
  for (let b = 0; b < beatsPerBar; b++) {
    for (let s = 0; s < sub.n; s++) {
      out.push({
        beat: b + s / sub.n,
        accent: b === 0 && s === 0 ? 'bar' : s === 0 ? 'beat' : 'sub',
      });
    }
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// 鼓機節奏型
//
// 每個型用 16 格（十六分音符）表示一小節 4/4。1 = 打，0 = 不打。
// swing 為 true 時，偶數格的八分音符會往後挪（三連音感）。
// ─────────────────────────────────────────────────────────────────────────────
export const DRUM_STYLES = {
  rock: {
    label: '搖滾 8 beat', bpm: 100, beats: 4, swing: false,
    kick:  [1,0,0,0, 0,0,1,0, 1,0,0,0, 0,0,0,0],
    snare: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
    hat:   [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0],
  },
  rock16: {
    label: '搖滾 16 beat', bpm: 92, beats: 4, swing: false,
    kick:  [1,0,0,0, 0,0,1,0, 0,0,1,0, 0,0,0,0],
    snare: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,1],
    hat:   [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1],
  },
  blues: {
    label: '藍調 Shuffle', bpm: 88, beats: 4, swing: true,
    kick:  [1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0],
    snare: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
    hat:   [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0],
  },
  ballad: {
    label: '抒情 慢板', bpm: 68, beats: 4, swing: false,
    kick:  [1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0],
    snare: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
    hat:   [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0],
  },
  funk: {
    label: 'Funk', bpm: 104, beats: 4, swing: false,
    kick:  [1,0,0,1, 0,0,1,0, 0,0,1,0, 0,1,0,0],
    snare: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,1,0],
    hat:   [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1],
  },
  bossa: {
    label: 'Bossa Nova', bpm: 128, beats: 4, swing: false,
    kick:  [1,0,0,1, 0,0,1,0, 1,0,0,1, 0,0,1,0],
    snare: [0,0,1,0, 0,1,0,0, 0,0,1,0, 0,1,0,0],
    hat:   [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0],
  },
  jazz: {
    label: '爵士 Swing', bpm: 132, beats: 4, swing: true,
    kick:  [1,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0],
    snare: [0,0,0,0, 0,0,1,0, 0,0,0,0, 0,0,1,0],
    hat:   [1,0,1,1, 1,0,1,1, 1,0,1,1, 1,0,1,1],
  },
  waltz: {
    label: '華爾滋 3/4', bpm: 120, beats: 3, swing: false,
    kick:  [1,0,0,0, 0,0,0,0, 0,0,0,0],
    snare: [0,0,0,0, 1,0,0,0, 1,0,0,0],
    hat:   [1,0,1,0, 1,0,1,0, 1,0,1,0],
  },
};

/**
 * 把節奏型展開成事件序列。
 * @returns {{beat:number, drum:'kick'|'snare'|'hat'}[]} beat 以拍為單位
 */
export function drumGrid(styleKey) {
  const st = DRUM_STYLES[styleKey];
  if (!st) throw new Error(`未知的鼓組風格: ${styleKey}`);
  const steps = st.beats * 4;                 // 每拍 4 個十六分音符
  const out = [];
  for (const drum of ['kick', 'snare', 'hat']) {
    const pat = st[drum];
    for (let i = 0; i < steps; i++) {
      if (!pat[i]) continue;
      let beat = i / 4;
      // Swing：把每拍的第 2 個八分音符往後挪到三連音的第 3 點
      if (st.swing && i % 4 === 2) beat = Math.floor(i / 4) + 2 / 3;
      out.push({ beat, drum });
    }
  }
  return out.sort((a, b) => a.beat - b.beat);
}

/** 一小節有幾拍 */
export const barBeats = styleKey => DRUM_STYLES[styleKey].beats;

// ─────────────────────────────────────────────────────────────────────────────
// pitch.js · 單音音高偵測（YIN）＋ 時間平滑器（純函式，不碰瀏覽器 API）
//
// 兩個獨立用途：
//   1. YIN —— 抓單一音的基頻。用於調音器、唱音比對、音階練習、單音 solo
//   2. Smoother —— 把逐幀的 chroma 在時間上平均，解決「判定一直跳」
// ─────────────────────────────────────────────────────────────────────────────

export const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

/**
 * YIN 基頻偵測。
 *
 * 為什麼不用單純的自相關：自相關在八度上很容易抓錯（把 E2 抓成 E3）。
 * YIN 的累積平均正規化差分函數（CMND）就是專門壓這個八度錯誤的。
 *
 * @param {Float32Array} buf   時域樣本（-1..1）
 * @param {number} sampleRate
 * @param {{threshold?:number, fMin?:number, fMax?:number}} [opts]
 * @returns {{freq:number, clarity:number}} freq<=0 代表沒抓到
 */
export function yin(buf, sampleRate, opts = {}) {
  const threshold = opts.threshold ?? 0.15;
  const fMin = opts.fMin ?? 70;    // 吉他最低 E2≈82，留一點餘裕
  const fMax = opts.fMax ?? 1400;  // 唱歌與吉他高把位都夠

  const tauMin = Math.max(2, Math.floor(sampleRate / fMax));
  const tauMax = Math.min(Math.floor(buf.length / 2), Math.floor(sampleRate / fMin));
  if (tauMax <= tauMin) return { freq: 0, clarity: 0 };

  // ① 差分函數
  const d = new Float32Array(tauMax + 1);
  for (let tau = tauMin; tau <= tauMax; tau++) {
    let sum = 0;
    for (let i = 0; i + tau < buf.length; i++) {
      const diff = buf[i] - buf[i + tau];
      sum += diff * diff;
    }
    d[tau] = sum;
  }

  // ② 累積平均正規化 —— 這步是 YIN 壓八度錯誤的關鍵
  const cmnd = new Float32Array(tauMax + 1);
  cmnd[tauMin] = 1;
  let running = 0;
  for (let tau = tauMin; tau <= tauMax; tau++) {
    running += d[tau];
    cmnd[tau] = running === 0 ? 1 : (d[tau] * (tau - tauMin + 1)) / running;
  }

  // ③ 找第一個低於門檻的谷底（第一個，不是最小的 —— 找最小的會抓到高八度）
  let tau = -1;
  for (let t = tauMin + 1; t < tauMax; t++) {
    if (cmnd[t] < threshold) {
      while (t + 1 < tauMax && cmnd[t + 1] < cmnd[t]) t++;
      tau = t; break;
    }
  }
  if (tau < 0) {
    // 沒有低於門檻的，退而求其次取全域最小
    let best = tauMin, bestV = Infinity;
    for (let t = tauMin + 1; t < tauMax; t++) if (cmnd[t] < bestV) { bestV = cmnd[t]; best = t; }
    if (bestV > 0.5) return { freq: 0, clarity: 0 };
    tau = best;
  }

  // ④ 拋物線內插 —— 讓解析度不受取樣點間隔限制，調音器需要這個精度
  let better = tau;
  if (tau > tauMin && tau < tauMax - 1) {
    const a = cmnd[tau - 1], b = cmnd[tau], c = cmnd[tau + 1];
    const denom = 2 * (2 * b - a - c);
    if (denom !== 0) better = tau + (c - a) / denom;
  }

  return { freq: sampleRate / better, clarity: 1 - cmnd[tau] };
}

/** 頻率 → MIDI 音高（可為小數） */
export const freqToMidi = f => 69 + 12 * Math.log2(f / 440);
/** MIDI → 頻率 */
export const midiToFreq = m => 440 * Math.pow(2, (m - 69) / 12);

/**
 * 頻率 → 最接近的音名 + 偏差音分。
 * 音分（cent）＝半音的百分之一。調音器上 ±5 音分內算準。
 */
export function freqToNote(freq) {
  if (!(freq > 0)) return null;
  const midi = freqToMidi(freq);
  const nearest = Math.round(midi);
  const cents = (midi - nearest) * 100;
  return {
    name: NOTE_NAMES[((nearest % 12) + 12) % 12],
    octave: Math.floor(nearest / 12) - 1,
    midi: nearest,
    cents,
    inTune: Math.abs(cents) <= 5,
  };
}

/** 標準調音（第6弦→第1弦） */
export const STANDARD_TUNING = [
  { label: '6 E', midi: 40 }, { label: '5 A', midi: 45 }, { label: '4 D', midi: 50 },
  { label: '3 G', midi: 55 }, { label: '2 B', midi: 59 }, { label: '1 E', midi: 64 },
];

/** 找出這個頻率最接近哪一條空弦 */
export function nearestString(freq, tuning = STANDARD_TUNING) {
  if (!(freq > 0)) return null;
  const midi = freqToMidi(freq);
  let best = tuning[0], bestD = Infinity;
  for (const s of tuning) {
    const d = Math.abs(midi - s.midi);
    if (d < bestD) { bestD = d; best = s; }
  }
  return { ...best, cents: (midi - best.midi) * 100 };
}

/**
 * 時間平滑器 —— 解決「判定一直跳」。
 *
 * 問題：逐幀判定時，刷弦後的衰減過程中頻譜一直在變，
 * 每一幀單獨判定就會在幾個相近和弦之間跳來跳去。
 *
 * 解法：先把最近 N 幀的 chroma 平均起來，再拿平均值去判定。
 * 平滑的是「特徵」而不是「結論」—— 這比對結論做投票穩定得多，
 * 因為結論是離散的，平均不了。
 */
export class Smoother {
  constructor(size = 24, dims = 12) {
    this.size = size; this.dims = dims;
    this.buf = []; this.sum = new Array(dims).fill(0);
  }
  /** 推入一幀，回傳目前的平均向量 */
  push(vec) {
    this.buf.push(vec);
    for (let i = 0; i < this.dims; i++) this.sum[i] += vec[i];
    if (this.buf.length > this.size) {
      const old = this.buf.shift();
      for (let i = 0; i < this.dims; i++) this.sum[i] -= old[i];
    }
    return this.mean();
  }
  mean() {
    const n = this.buf.length || 1;
    const m = this.sum.map(v => v / n);
    const mx = Math.max(...m);
    return mx > 0 ? m.map(v => v / mx) : m;   // 重新正規化，比對才不受音量影響
  }
  get filled() { return this.buf.length >= this.size; }
  reset() { this.buf = []; this.sum = new Array(this.dims).fill(0); }
}

/**
 * 遲滯（hysteresis）—— 已經確定的答案，要有明顯更好的候選才換掉。
 *
 * 沒有這層的話，兩個分數接近的和弦會在邊界反覆互換，畫面一樣會閃。
 */
export class Hysteresis {
  constructor(margin = 0.05, minFrames = 8) {
    this.margin = margin; this.minFrames = minFrames;
    this.current = null; this.candidate = null; this.count = 0;
  }
  /** @returns {string|null} 目前應該顯示的答案 */
  update(chord, score, currentScore) {
    if (this.current === null) { this.current = chord; this.count = 0; return this.current; }
    if (chord === this.current) { this.candidate = null; this.count = 0; return this.current; }
    // 不同答案：要連續夠多幀、而且分數明顯較高，才換
    if (chord === this.candidate) this.count++;
    else { this.candidate = chord; this.count = 1; }
    if (this.count >= this.minFrames && score > currentScore + this.margin) {
      this.current = chord; this.candidate = null; this.count = 0;
    }
    return this.current;
  }
  reset() { this.current = null; this.candidate = null; this.count = 0; }
}

// ─────────────────────────────────────────────────────────────────────────────
// synth.js · 音色合成（需要 AudioContext，所以這支不是純函式）
//
// 為什麼原本聽起來「很 MIDI」：純振盪器（sine/triangle/saw）加一個音量包絡，
// 那就是 1980 年代 FM 合成的聲音。真實的弦樂器泛音會隨時間變化 ——
// 高頻先衰減、低頻留下來，而振盪器的泛音比例是固定的。
//
// 解法：Karplus-Strong 撥弦物理模型。
//   1. 用一段白噪音當「撥弦瞬間」（寬頻，什麼泛音都有）
//   2. 讓它在一個長度 = 週期的延遲線裡循環
//   3. 每繞一圈做一次低通平均 → 高頻每圈都衰減得比低頻快
// 這正是真實琴弦的物理行為，所以聽起來像弦而不像電子琴。
// ─────────────────────────────────────────────────────────────────────────────

const bufCache = new Map();

/**
 * 產生一個 Karplus-Strong 撥弦音的 AudioBuffer。
 * @param {AudioContext} ctx
 * @param {number} freq   基頻
 * @param {number} dur    長度（秒）
 * @param {object} opts   damping 0..1 越大衰減越快；bright 0..1 起音亮度
 */
export function pluckBuffer(ctx, freq, dur = 2.2, opts = {}) {
  const damping = opts.damping ?? 0.5;
  const bright  = opts.bright  ?? 0.5;
  const key = `${Math.round(freq*10)}_${Math.round(dur*10)}_${damping}_${bright}`;
  if (bufCache.has(key)) return bufCache.get(key);

  const sr = ctx.sampleRate;
  const n = Math.max(1, Math.floor(sr * dur));
  const N = Math.max(2, Math.round(sr / freq));          // 延遲線長度 = 一個週期
  const buf = ctx.createBuffer(1, n, sr);
  const out = buf.getChannelData(0);

  // 起音的激發訊號：白噪音，bright 越低就先過一層低通（悶一點）
  const exc = new Float32Array(N);
  let prev = 0;
  for (let i = 0; i < N; i++) {
    const white = Math.random() * 2 - 1;
    prev = prev + (white - prev) * (0.25 + bright * 0.75);
    exc[i] = prev;
  }

  // 主迴圈：延遲線 + 每圈一次兩點平均（低通）
  // blend 讓高頻衰減得比低頻快，這是「弦」的關鍵特徵
  const line = exc.slice();
  const decay = 0.996 - damping * 0.02;
  let idx = 0, last = 0;
  for (let i = 0; i < n; i++) {
    const cur = line[idx];
    const filtered = (cur + last) * 0.5 * decay;
    last = cur;
    line[idx] = filtered;
    idx = (idx + 1) % N;
    out[i] = cur;
  }

  // 尾端淡出，避免喀聲
  const fade = Math.min(n, Math.floor(sr * 0.06));
  for (let i = 0; i < fade; i++) out[n - 1 - i] *= i / fade;

  bufCache.set(key, buf);
  return buf;
}

/** 撥一個音 */
export function pluck(ctx, dest, time, freq, dur, gain = 0.3, opts = {}) {
  const src = ctx.createBufferSource();
  src.buffer = pluckBuffer(ctx, freq, dur, opts);
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, time);
  g.gain.setValueAtTime(gain, time + dur * 0.7);
  g.gain.linearRampToValueAtTime(0, time + dur);
  src.connect(g); g.connect(dest);
  src.start(time);
  return src;
}

/**
 * 簡單的殘響（回饋延遲網路）。
 * 沒有殘響的乾聲會很「貼耳」，那也是聽起來假的原因之一 ——
 * 真實樂器一定有空間感。
 */
export function makeReverb(ctx, dest, mix = 0.22) {
  const input = ctx.createGain();
  const wet = ctx.createGain(); wet.gain.value = mix;
  const dry = ctx.createGain(); dry.gain.value = 1 - mix * 0.5;

  // 四條互質長度的延遲，避免共振集中在某個頻率
  const times = [0.0297, 0.0371, 0.0411, 0.0437];
  const merge = ctx.createGain();
  times.forEach(t => {
    const d = ctx.createDelay(1.0); d.delayTime.value = t;
    const fb = ctx.createGain(); fb.gain.value = 0.72;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3200;
    input.connect(d); d.connect(lp); lp.connect(fb); fb.connect(d); lp.connect(merge);
  });
  merge.connect(wet); wet.connect(dest);
  input.connect(dry); dry.connect(dest);
  return input;
}

/** 更真實的鼓：多層疊加，而不是單一噪音爆發 */
export function drumHit(ctx, dest, time, drum, vel = 1) {
  if (drum === 'kick') {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(155, time);
    o.frequency.exponentialRampToValueAtTime(41, time + 0.13);
    g.gain.setValueAtTime(0.9 * vel, time);
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.32);
    o.connect(g); g.connect(dest); o.start(time); o.stop(time + 0.34);
    // 拍擊感：一小段高頻，讓它在小喇叭上也聽得到
    noise(ctx, dest, time, 0.02, 2600, 1.0, 0.22 * vel);
  } else if (drum === 'snare') {
    // 鼓皮（兩個略微失諧的正弦）＋ 響線（噪音）
    [188, 243].forEach((f, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = f;
      g.gain.setValueAtTime(0.26 * vel / (i + 1), time);
      g.gain.exponentialRampToValueAtTime(0.0001, time + 0.1);
      o.connect(g); g.connect(dest); o.start(time); o.stop(time + 0.12);
    });
    noise(ctx, dest, time, 0.16, 1750, 0.55, 0.42 * vel);
    noise(ctx, dest, time, 0.05, 5200, 0.8, 0.16 * vel);
  } else if (drum === 'hat') {
    noise(ctx, dest, time, 0.035, 9500, 1.4, 0.14 * vel);
    noise(ctx, dest, time, 0.012, 13000, 2.0, 0.09 * vel);
  }
}

function noise(ctx, dest, time, dur, freq, q, vol) {
  const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const b = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.2);
  const s = ctx.createBufferSource(); s.buffer = b;
  const f = ctx.createBiquadFilter(); f.type = 'bandpass';
  f.frequency.value = freq; f.Q.value = q;
  const g = ctx.createGain(); g.gain.value = vol;
  s.connect(f); f.connect(g); g.connect(dest); s.start(time);
}

/**
 * 人性化：真人不會每個音都一樣大聲、也不會精準到毫秒。
 * 完全對齊格線就是「聽起來像機器」的另一個原因。
 */
export function humanize(time, vel, amount = 1) {
  return {
    time: time + (Math.random() - 0.5) * 0.011 * amount,
    vel:  vel * (0.86 + Math.random() * 0.28 * amount),
  };
}

export const midiToHz = m => 440 * Math.pow(2, (m - 69) / 12);

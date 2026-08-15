// ─────────────────────────────────────────────────────────────────────────────
// selftest.mjs · 用合成音驗證和弦辨識，不需要吉他也不需要麥克風
//
//   node src/selftest.mjs
//
// 做法：用真實的開放和弦按法（每條弦的實際音高）合成波形，
// 每個音加上衰減的泛音列（吉他泛音很強，不模擬泛音就不像真的），
// 自己算 DFT → 丟進 computeChroma → 看 identify 猜對沒。
// ─────────────────────────────────────────────────────────────────────────────

import { computeChroma, identify, chordNotes, NOTE_NAMES } from './chroma.js';

const SR = 22050;
const FFT = 8192;

/** 音名+八度 → 頻率。A4 = 440Hz */
function noteToFreq(name) {
  const m = /^([A-G])(#|b)?(-?\d)$/.exec(name);
  if (!m) throw new Error(`音名格式錯誤: ${name}`);
  const base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]];
  const acc = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0;
  const oct = parseInt(m[3], 10);
  const midi = 12 * (oct + 1) + base + acc;
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/**
 * 標準調音下，各開放和弦每條弦實際發出的音（低音弦→高音弦）。
 * x 代表該弦不彈。
 */
const VOICINGS = {
  'Em': ['E2', 'B2', 'E3', 'G3', 'B3', 'E4'],
  'Am': ['x',  'A2', 'E3', 'A3', 'C4', 'E4'],
  'G':  ['G2', 'B2', 'D3', 'G3', 'B3', 'G4'],
  'C':  ['x',  'C3', 'E3', 'G3', 'C4', 'E4'],
  'D':  ['x',  'x',  'D3', 'A3', 'D4', 'F#4'],
  'E':  ['E2', 'B2', 'E3', 'G#3','B3', 'E4'],
  'A':  ['x',  'A2', 'E3', 'A3', 'C#4','E4'],
  'Dm': ['x',  'x',  'D3', 'A3', 'D4', 'F4'],
  'F':  ['F2', 'C3', 'F3', 'A3', 'C4', 'F4'],
};

/** 合成一次刷弦：每條弦稍微錯開起始時間，泛音強度隨階數衰減。 */
function synthChord(notes, seconds = 1.0) {
  const n = Math.floor(SR * seconds);
  const buf = new Float32Array(n);
  const played = notes.filter(x => x !== 'x');

  played.forEach((note, idx) => {
    const f0 = noteToFreq(note);
    const delay = Math.floor(idx * 0.012 * SR);   // 刷弦不是同時發聲
    for (let h = 1; h <= 6; h++) {                // 六階泛音
      const fh = f0 * h;
      if (fh > SR / 2) break;
      const amp = 1 / (h * h);                    // 泛音強度衰減
      const phase = (h * 0.7) % (2 * Math.PI);
      for (let i = delay; i < n; i++) {
        const t = (i - delay) / SR;
        const env = Math.exp(-2.2 * t);           // 撥弦後衰減
        buf[i] += amp * env * Math.sin(2 * Math.PI * fh * t + phase);
      }
    }
  });

  let peak = 0;
  for (const v of buf) peak = Math.max(peak, Math.abs(v));
  if (peak > 0) for (let i = 0; i < n; i++) buf[i] /= peak;
  return buf;
}

/** 直接算 DFT 的振幅頻譜（慢，但這是離線測試，正確比快重要）。 */
function magnitudeSpectrum(signal, fftSize) {
  const N = fftSize;
  const frame = new Float32Array(N);
  const start = Math.floor(SR * 0.05);            // 跳過起音瞬間
  for (let i = 0; i < N; i++) {
    const s = signal[start + i] ?? 0;
    frame[i] = s * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1)));  // Hann
  }
  const bins = N / 2;
  const mag = new Float32Array(bins);
  for (let k = 0; k < bins; k++) {
    let re = 0, im = 0;
    const w = (-2 * Math.PI * k) / N;
    for (let i = 0; i < N; i++) {
      re += frame[i] * Math.cos(w * i);
      im += frame[i] * Math.sin(w * i);
    }
    mag[k] = Math.sqrt(re * re + im * im) / N;
  }
  return mag;
}

// ── 執行 ──────────────────────────────────────────────────────────────────────
console.log('和弦辨識自我測試 · 合成音 → chroma → 比對\n');
console.log('和弦   判定    分數   領先   把握   前三名');
console.log('─'.repeat(64));

let pass = 0, total = 0;
const failures = [];

for (const [expected, voicing] of Object.entries(VOICINGS)) {
  const sig = synthChord(voicing);
  const mag = magnitudeSpectrum(sig, FFT);
  const chroma = computeChroma(mag, SR, FFT);
  const r = identify(chroma);

  total++;
  const ok = r.chord === expected;
  if (ok) pass++; else failures.push({ expected, got: r.chord, ranked: r.ranked });

  const top3 = r.ranked.map(x => `${x.chord}:${x.score.toFixed(2)}`).join(' ');
  console.log(
    `${expected.padEnd(6)} ${(ok ? 'OK  ' : 'FAIL').padEnd(7)}` +
    `${r.score.toFixed(3)}  ${r.margin.toFixed(3)}  ` +
    `${(r.confident ? 'yes' : 'no ').padEnd(6)} ${top3}`
  );
}

console.log('─'.repeat(64));
console.log(`\n通過 ${pass}/${total}`);

if (failures.length) {
  console.log('\n失敗細節：');
  for (const f of failures) {
    console.log(`  期望 ${f.expected}，判成 ${f.got}`);
    console.log(`    ${f.ranked.map(x => `${x.chord}=${x.score.toFixed(3)}`).join('  ')}`);
  }
}

process.exit(failures.length ? 1 : 0);

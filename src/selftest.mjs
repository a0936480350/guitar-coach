// ─────────────────────────────────────────────────────────────────────────────
// selftest.mjs · 用合成音驗證和弦辨識，不需要吉他也不需要麥克風
//
//   node src/selftest.mjs
//
// 做法：用真實的開放和弦按法（每條弦的實際音高）合成波形，
// 每個音加上衰減的泛音列（吉他泛音很強，不模擬泛音就不像真的），
// 自己算 DFT → 丟進 computeChroma → 看 identify 猜對沒。
// ─────────────────────────────────────────────────────────────────────────────

import { computeChroma, identify, CHORD_SETS, setChordSet, ambiguousWith, ambiguityGroups } from './chroma.js';

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

// ── 更多和弦的實際按法（進階級才會用到）──────────────────────────────────────
const MORE = {
  'G7':   ['G2','B2','D3','G3','B3','F4'],
  'C7':   ['x','C3','E3','A#3','C4','E4'],
  'D7':   ['x','x','D3','A3','C4','F#4'],
  'A7':   ['x','A2','E3','G3','C#4','E4'],
  'E7':   ['E2','B2','D3','G#3','B3','E4'],
  'Am7':  ['x','A2','E3','G3','C4','E4'],
  'Em7':  ['E2','B2','D3','G3','B3','E4'],
  'Dm7':  ['x','x','D3','A3','C4','F4'],
  'Cmaj7':['x','C3','E3','G3','B3','E4'],
  'Bm':   ['x','B2','F#3','B3','D4','F#4'],
  'Dsus4':['x','x','D3','A3','D4','G4'],
  'Dsus2':['x','x','D3','A3','D4','E4'],
};

function runTier(key){
  setChordSet(key);
  const set = CHORD_SETS[key];
  const cases = Object.assign({}, VOICINGS);
  for (const [n,v] of Object.entries(MORE)) if (set.spec[n]) cases[n] = v;

  let pass = 0, total = 0, ambig = 0;
  const fails = [], ambigList = [];
  for (const [expected, voicing] of Object.entries(cases)){
    const mag = magnitudeSpectrum(synthChord(voicing), FFT);
    const r = identify(computeChroma(mag, SR, FFT));
    total++;
    if (r.chord === expected) pass++;
    else if (ambiguousWith(expected).includes(r.chord)) { ambig++; ambigList.push(expected + '≡' + r.chord); }
    else fails.push(expected + '→' + r.chord);
  }
  const pct = (100 * (pass + ambig) / total).toFixed(0);
  console.log(set.label.padEnd(20) + ' ' +
    String(Object.keys(set.spec).length).padStart(2) + ' 個和弦   測 ' +
    String(total).padStart(2) + ' 個   通過 ' + String(pass).padStart(2) + '/' + total +
    ' (' + pct + '%' + (ambig ? '，含 ' + ambig + ' 個原理上不可分' : '') + ')');
  if (ambigList.length) console.log(' '.repeat(22) + '音級完全相同、原理上分不出：' + ambigList.join('  '));
  if (fails.length)     console.log(' '.repeat(22) + '真誤判：' + fails.join('  '));
  return { key, pass, total, ambig, fails };
}

console.log('和弦辨識自我測試 · 合成音 → chroma → 比對');
console.log('');
const results = ['basic','seventh','full'].map(runTier);
console.log('');
console.log('和弦越多越不準，這是必然的 —— 所以由使用者自己選級別，不預設全開。');

setChordSet('basic');
const basic = results[0];
const groups = (() => { setChordSet('full'); const g = ambiguityGroups(); setChordSet('basic'); return g; })();
console.log('');
console.log('音級集合完全相同的和弦（chroma 原理上分不出，不是演算法問題）：');
groups.forEach(g => console.log('  ' + g.join(' ＝ ')));

if (basic.pass !== basic.total){
  console.error('');
  console.error('✗ 初級組必須 100% 通過，目前 ' + basic.pass + '/' + basic.total);
  process.exit(1);
}
console.log('');
console.log('✓ 初級組 ' + basic.pass + '/' + basic.total + '（基準線，掉了就是回歸）');

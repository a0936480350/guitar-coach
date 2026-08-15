// 用合成正弦波驗證 YIN 與平滑器 —— 不需要麥克風
import { yin, freqToNote, nearestString, Smoother, Hysteresis, midiToFreq } from './pitch.js';

const SR = 44100;
let pass=0, fail=0;
const t=(n,c,e='')=>{ if(c){pass++;console.log('  OK   '+n);} else {fail++;console.log('  FAIL '+n+'  '+e);} };

/** 合成一個帶泛音的音（吉他不是純正弦，要模擬泛音才有意義） */
function tone(freq, sec=0.2, harmonics=5){
  const n=Math.floor(SR*sec), b=new Float32Array(n);
  for(let h=1;h<=harmonics;h++){
    const f=freq*h; if(f>SR/2) break;
    const a=1/(h*h);
    for(let i=0;i<n;i++) b[i]+=a*Math.sin(2*Math.PI*f*i/SR + h*0.6);
  }
  let pk=0; for(const v of b) pk=Math.max(pk,Math.abs(v));
  if(pk>0) for(let i=0;i<n;i++) b[i]/=pk;
  return b;
}

console.log('YIN 音高偵測（含泛音的合成音）\n');
console.log('  目標Hz    偵測Hz    誤差(音分)  判定');
const targets=[82.41,110.00,146.83,196.00,246.94,329.63,440.00,659.25];
let worst=0;
for(const f of targets){
  const r=yin(tone(f), SR);
  const cents=1200*Math.log2(r.freq/f);
  worst=Math.max(worst,Math.abs(cents));
  const ok=Math.abs(cents)<5;
  if(ok)pass++;else fail++;
  console.log(`  ${f.toFixed(2).padStart(7)}  ${r.freq.toFixed(2).padStart(8)}  ${cents.toFixed(2).padStart(9)}   ${ok?'OK':'FAIL'}`);
}
console.log(`\n  最大誤差 ${worst.toFixed(2)} 音分（調音器需要 <5）`);

console.log('\n八度錯誤測試（自相關最常犯的錯）：');
for(const f of [82.41,110.00,164.81]){
  const r=yin(tone(f,0.2,8), SR);
  const ratio=r.freq/f;
  t(`${f.toFixed(1)}Hz 沒有抓成八度`, ratio>0.97&&ratio<1.03, `比值=${ratio.toFixed(3)}`);
}

console.log('\n音名換算：');
const n1=freqToNote(440);
t('440Hz = A4', n1.name==='A'&&n1.octave===4&&Math.abs(n1.cents)<0.01);
const n2=freqToNote(82.41);
t('82.41Hz = E2', n2.name==='E'&&n2.octave===2);
t('偏高 20 音分會被判定不準', !freqToNote(440*Math.pow(2,20/1200)).inTune);
t('偏高 3 音分算準', freqToNote(440*Math.pow(2,3/1200)).inTune);

console.log('\n空弦對應：');
const s=nearestString(196.5);
t('196.5Hz 對到第 3 弦 G', s.label==='3 G', s.label);
t('低音 E 對到第 6 弦', nearestString(82.4).label==='6 E');

console.log('\n平滑器：');
const sm=new Smoother(4,3);
sm.push([1,0,0]); sm.push([1,0,0]); sm.push([0,1,0]); sm.push([1,0,0]);
const m=sm.mean();
t('平均後最大值仍是第 0 維', m[0]>m[1]&&m[0]>m[2], JSON.stringify(m.map(x=>x.toFixed(2))));
t('視窗滿了', sm.filled);
sm.push([0,1,0]); sm.push([0,1,0]);
t('舊資料會滑出視窗', sm.mean()[1] > sm.mean()[0]);

console.log('\n遲滯（防止畫面閃爍）：');
const h=new Hysteresis(0.05,3);
t('第一次直接接受', h.update('Em',0.9,0)==='Em');
t('分數沒明顯高不換', h.update('E',0.91,0.9)==='Em');
h.update('E',0.99,0.9); h.update('E',0.99,0.9);
t('連續且明顯較高才換', h.update('E',0.99,0.9)==='E');

console.log(`
小計 通過 ${pass}，失敗 ${fail}`);

// ── 閃爍抑制實測（對應 Mike 回報的「會一直跳」）─────────────────────────────
import { computeChroma, identify, setChordSet } from './chroma.js';
setChordSet('basic');

console.log('\n閃爍抑制（模擬 300 幀，其中 20% 是被雜訊污染的幀）：');

// Em 的理想 chroma，加上隨機雜訊模擬真實麥克風
function noisyEm(bad){
  const v = new Array(12).fill(0.05);
  [4,7,11].forEach(i => v[i] = 1);
  if (bad){ v[0] = 1; v[9] = 0.9; }        // 偶爾污染成像 C/Am
  return v.map(x => Math.max(0, x + (Math.sin(x*997.3 + Math.random()*7) * 0.18)));
}

function runSim(useSmoothing){
  const sm = new Smoother(24, 12);
  const hy = new Hysteresis(0.05, 8);
  let last = null, flips = 0, lastScore = 0;
  let seed = 12345;
  const rnd = () => (seed = (seed*1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;

  for (let f = 0; f < 300; f++){
    const raw = noisyEm(rnd() < 0.20);
    const feat = useSmoothing ? sm.push(raw) : raw;
    const r = identify(feat);
    const shown = useSmoothing ? hy.update(r.chord, r.score, lastScore) : r.chord;
    if (useSmoothing && shown === r.chord) lastScore = r.score;
    if (last !== null && shown !== last) flips++;
    last = shown;
  }
  return { flips, final: last };
}

const before = runSim(false);
const after  = runSim(true);
console.log(`  未平滑：輸出翻轉 ${String(before.flips).padStart(3)} 次   最終=${before.final}`);
console.log(`  已平滑：輸出翻轉 ${String(after.flips).padStart(3)} 次   最終=${after.final}`);
const reduction = before.flips ? (100*(1 - after.flips/before.flips)).toFixed(0) : '—';
console.log(`  減少 ${reduction}%`);
t('平滑後翻轉次數明顯下降', after.flips < before.flips * 0.3, `${before.flips}→${after.flips}`);
t('平滑後仍收斂到正確答案 Em', after.final === 'Em', String(after.final));

console.log(`\n總計 通過 ${pass}，失敗 ${fail}`);
process.exit(fail?1:0);

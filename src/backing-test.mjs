// 驗證 full band 伴奏產生器 —— 不需要喇叭、不需要瀏覽器
import { BACKING_STYLES, generateBacking, cycleBars, chordSequence,
         BASS_RANGE, CHORD_RANGE, KEYS, makeRng } from './backing.js';

let pass = 0, fail = 0;
const t = (n, c, e = '') => { if (c) { pass++; } else { fail++; console.log('  FAIL ' + n + '  ' + e); } };

console.log('Full band 伴奏產生器測試\n');

// ── 樂理正確性：獨立算一次大調音階，不靠 degreeToChord 自己驗自己 ────────────
// 這是最重要的一段，和弦組成音錯了會直接教錯學生。
const KEY_ROOT = { 'C':0, 'G':7, 'D':2, 'A':9, 'E':4, 'F':5, 'Bb':10 };
const SCALE = [0, 2, 4, 5, 7, 9, 11];                 // 大調音階半音位置
const DEG_INDEX = { I:0, ii:1, iii:2, IV:3, V:4, vi:5, vii:6 };
const DEG_QUALITY = { I:'maj', ii:'min', iii:'min', IV:'maj', V:'maj', vi:'min', vii:'dim' };
const TRIAD = { maj:[0,4,7], min:[0,3,7], dim:[0,3,6] };
const pcOf = n => ((n % 12) + 12) % 12;

function expectedNotes(roman, key) {
  const root = pcOf(KEY_ROOT[key] + SCALE[DEG_INDEX[roman]]);
  return TRIAD[DEG_QUALITY[roman]].map(i => pcOf(root + i)).sort((a, b) => a - b);
}

console.log('樂理正確性（每種曲風 × 每個 key，逐小節比對組成音）：');
let theoryBad = 0, theoryChecked = 0;
for (const styleKey of Object.keys(BACKING_STYLES)) {
  for (const key of KEYS) {
    const bk = generateBacking(styleKey, { key });
    for (const bar of bk.bars) {
      theoryChecked++;
      const got = bar.notes.slice().sort((a, b) => a - b);
      const want = expectedNotes(bar.roman, key);
      if (JSON.stringify(got) !== JSON.stringify(want)) {
        theoryBad++;
        if (theoryBad <= 3) console.log(`    ${styleKey}/${key} bar${bar.bar} ${bar.roman}: 得到 ${got} 應為 ${want}`);
      }
      // 根音必須就是和弦的第一個組成音
      if (bar.root !== bar.notes[0]) theoryBad++;
    }
  }
}
t('每小節的和弦組成音與該 key 的級數相符', theoryBad === 0, `${theoryBad} 個小節不符`);
console.log(`  ${theoryChecked} 個小節 × ${KEYS.length} 個 key 全部比對完成`);

// ── 每種曲風的基本健全性 ──────────────────────────────────────────────────
console.log('\n曲風總覽：');
for (const [k, st] of Object.entries(BACKING_STYLES)) {
  const bk = generateBacking(k, { key: 'C' });
  const ev = bk.events;
  const bass = ev.filter(e => e.type === 'bass');
  const chord = ev.filter(e => e.type === 'chord');
  const drum = ev.filter(e => e.type === 'drum');

  t(`${st.label} 有事件`, ev.length > 0);
  t(`${st.label} 三個聲部都有`, bass.length > 0 && chord.length > 0 && drum.length > 0,
    `bass=${bass.length} chord=${chord.length} drum=${drum.length}`);
  t(`${st.label} 時間非負`, ev.every(e => e.time >= 0));
  t(`${st.label} 時間單調遞增`, ev.every((e, i) => i === 0 || e.time >= ev[i - 1].time));
  t(`${st.label} 事件不超出總長`, ev.every(e => e.time < bk.totalBeats),
    `最大 ${Math.max(...ev.map(e => e.time))} / ${bk.totalBeats}`);
  t(`${st.label} 每個事件都有正的 dur`, ev.every(e => e.dur > 0));
  t(`${st.label} 貝斯音域 ${BASS_RANGE.lo}–${BASS_RANGE.hi}`,
    bass.every(e => e.midi >= BASS_RANGE.lo && e.midi <= BASS_RANGE.hi),
    `範圍 ${Math.min(...bass.map(e => e.midi))}–${Math.max(...bass.map(e => e.midi))}`);
  t(`${st.label} 和弦音域 ${CHORD_RANGE.lo}–${CHORD_RANGE.hi}`,
    chord.every(e => e.midi >= CHORD_RANGE.lo && e.midi <= CHORD_RANGE.hi),
    `範圍 ${Math.min(...chord.map(e => e.midi))}–${Math.max(...chord.map(e => e.midi))}`);
  t(`${st.label} 鼓事件有 drum 欄位`, drum.every(e => !!e.drum && e.midi === undefined));
  t(`${st.label} 小節數＝一個循環`, bk.bars.length === cycleBars(k), `${bk.bars.length}`);
  t(`${st.label} bar 欄位對得上時間`, ev.every(e => e.bar === Math.floor(e.time / bk.beatsPerBar)));

  console.log(`  ${st.label.padEnd(14)} ${String(st.bpm).padStart(3)} BPM ${st.beats}/4  ` +
    `${String(bk.totalBars).padStart(2)} 小節  ` +
    `貝斯${String(bass.length).padStart(3)} 和弦${String(chord.length).padStart(3)} 鼓${String(drum.length).padStart(3)}  ` +
    `${chordSequence(bk).join(' ')}`);
}

// ── 藍調 12 小節：位置錯了就不是藍調了 ────────────────────────────────────
console.log('\n藍調 12 小節進行：');
const blues = generateBacking('blues12', { key: 'A' });
t('藍調確實是 12 小節', blues.bars.length === 12, `${blues.bars.length}`);
const romans = blues.bars.map(b => b.roman);
const wantRomans = ['I','I','I','I','IV','IV','I','I','V','IV','I','V'];
t('I–IV–V 位置正確', JSON.stringify(romans) === JSON.stringify(wantRomans), romans.join(' '));
t('藍調 A 調的和弦是 A/D/E', JSON.stringify([...new Set(chordSequence(blues))].sort()) === JSON.stringify(['A','D','E']),
  chordSequence(blues).join(' '));
console.log(`  ${romans.join(' ')}`);
console.log(`  ${chordSequence(blues).join(' ')}`);

// ── key 的隨機與指定 ──────────────────────────────────────────────────────
console.log('\nKey：');
const rnd = makeRng(2026);
const seen = new Set();
let keyBad = 0;
for (let i = 0; i < 400; i++) {
  const bk = generateBacking('pop', { rng: rnd });
  if (!KEYS.includes(bk.key)) keyBad++;
  seen.add(bk.key);
}
t('隨機 key 全部落在合法清單', keyBad === 0, `${keyBad} 次不合法`);
t('隨機 key 有涵蓋多個調', seen.size >= 5, `只出現 ${seen.size} 種`);
let fixedBad = 0;
for (const k of Object.keys(BACKING_STYLES)) {
  for (const key of KEYS) if (generateBacking(k, { key }).key !== key) fixedBad++;
}
t('指定 key 時確實照用', fixedBad === 0, `${fixedBad} 次沒照用`);
t('未知 key 會爆錯', (() => { try { generateBacking('pop', { key: 'H' }); return false; } catch { return true; } })());
t('未知曲風會爆錯', (() => { try { generateBacking('nope'); return false; } catch { return true; } })());
console.log(`  400 次隨機共出現 ${seen.size} 種 key：${[...seen].sort().join(' ')}`);

// ── 長度控制 ──────────────────────────────────────────────────────────────
console.log('\n長度控制：');
const long = generateBacking('jazz', { key: 'C', bars: 16 });
t('opts.bars 決定小節數', long.bars.length === 16 && long.totalBars === 16);
t('超過一個循環時進行會接續循環', long.bars[0].roman === long.bars[4].roman
  && long.bars[1].roman === long.bars[5].roman, long.bars.map(b => b.roman).join(' '));
t('totalBeats = 小節數 × 拍數', long.totalBeats === 16 * long.beatsPerBar);
const one = generateBacking('jazz', { key: 'C', bars: 1 });
t('只要 1 小節也能產生', one.bars.length === 1 && one.events.length > 0);
console.log(`  jazz × 16 小節：${long.bars.map(b => b.roman).join(' ')}`);

// ── 可重現性 ──────────────────────────────────────────────────────────────
console.log('\n可重現性：');
let reproBad = 0;
for (const k of Object.keys(BACKING_STYLES)) {
  const A = generateBacking(k, { rng: makeRng(1234) });
  const B = generateBacking(k, { rng: makeRng(1234) });
  if (JSON.stringify(A) !== JSON.stringify(B)) reproBad++;
}
t('同 seed 每種曲風都完全重現', reproBad === 0, `${reproBad} 種不一致`);
// 不同 seed 至少要能抽到不同的 key，否則等於沒有隨機。
// 注意：makeRng 是 LCG，相鄰的小 seed（1,2,3…）第一次抽樣幾乎一樣，
// 所以 seed 要拉開。UI 若用遞增的 seed 當「換一首」，會一直抽到同一個 key。
const seedKeys = new Set([1, 700, 1400, 2100, 2800, 3500, 4200, 4900, 5600, 6300]
  .map(s => generateBacking('bossa', { rng: makeRng(s) }).key));
t('不同 seed 會抽到不同 key', seedKeys.size > 1, `10 個 seed 只抽到 ${[...seedKeys]}`);
console.log(`  10 個拉開的 seed 抽到 ${seedKeys.size} 種 key：${[...seedKeys].sort().join(' ')}`);

// ── walking bass 的線條品質 ───────────────────────────────────────────────
console.log('\nWalking bass：');
const jz = generateBacking('jazz', { key: 'C', bars: 8 });
const jzBass = jz.events.filter(e => e.type === 'bass');
t('爵士每小節 4 個貝斯音', jzBass.length === 8 * 4, `${jzBass.length}`);
const leaps = jzBass.slice(1).map((e, i) => Math.abs(e.midi - jzBass[i].midi));
t('walking 線條沒有超過八度的大跳', Math.max(...leaps) <= 12, `最大跳 ${Math.max(...leaps)}`);
console.log(`  音高線條：${jzBass.slice(0, 12).map(e => e.midi).join(' → ')} …`);

console.log(`\n通過 ${pass}，失敗 ${fail}`);
process.exit(fail ? 1 : 0);

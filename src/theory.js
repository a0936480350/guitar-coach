// ─────────────────────────────────────────────────────────────────────────────
// theory.js · 級數記法切換 ＋ 音階/調性判斷（純函式）
//
// 兩套級數記法都是對的，差別在讀者是誰：
//   古典羅馬數字   I ii iii IV V vi vii°   大寫=大三，小寫=小三，°=減三
//   Nashville 級數 1 2m 3m 4 5 6m 7dim     阿拉伯數字 + 明確的品質後綴
//
// ⚠ 有個陷阱：斜線的意思完全不同。
//   羅馬數字 `V/V`   = 「V 的 V 級」→ 次屬和弦（D7 in C）
//   Nashville `5/2` = 「5 級和弦，低音放 2 音」→ 分割和弦（G/D in C）
// 所以不能只做字串轉換，要分開處理。
// ─────────────────────────────────────────────────────────────────────────────

export const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const pc = n => ((n % 12) + 12) % 12;

/** 大調七個級數的品質與根音位移 */
export const MAJOR_DEGREES = [
  { num: 1, offset: 0,  quality: 'maj' },
  { num: 2, offset: 2,  quality: 'min' },
  { num: 3, offset: 4,  quality: 'min' },
  { num: 4, offset: 5,  quality: 'maj' },
  { num: 5, offset: 7,  quality: 'maj' },
  { num: 6, offset: 9,  quality: 'min' },
  { num: 7, offset: 11, quality: 'dim' },
];

const ROMAN = ['I','II','III','IV','V','VI','VII'];

/**
 * 級數 → 顯示字串。
 * @param {number} num      1..7
 * @param {string} quality  maj/min/dim/aug/dom7/min7/maj7/m7b5...
 * @param {'roman'|'nashville'} style
 */
export function degreeLabel(num, quality, style = 'roman') {
  const i = num - 1;
  if (style === 'nashville') {
    return String(num) + (NASHVILLE_SUFFIX[quality] ?? '');
  }
  // 羅馬數字：大小寫本身就帶了大三/小三的資訊
  const base = ['min','dim','min7','m7b5','dim7','min9'].includes(quality)
    ? ROMAN[i].toLowerCase() : ROMAN[i];
  return base + (ROMAN_SUFFIX[quality] ?? '');
}

const NASHVILLE_SUFFIX = {
  maj:'', min:'m', dim:'dim', aug:'+',
  dom7:'7', min7:'m7', maj7:'M7', m7b5:'m7b5', dim7:'dim7',
  sus2:'sus2', sus4:'sus4', add9:'add9',
  dom9:'9', min9:'m9', maj9:'M9',
};
const ROMAN_SUFFIX = {
  maj:'', min:'', dim:'°', aug:'+',
  dom7:'7', min7:'7', maj7:'maj7', m7b5:'ø7', dim7:'°7',
  sus2:'sus2', sus4:'sus4', add9:'add9',
  dom9:'9', min9:'9', maj9:'maj9',
};

/** 整條進行的顯示 */
export function progressionLabel(degrees, style = 'roman') {
  return degrees.map(d => {
    const spec = MAJOR_DEGREES.find(x => x.num === d.num) || {};
    return degreeLabel(d.num, d.quality ?? spec.quality, style);
  }).join(style === 'nashville' ? ' ' : ' – ');
}

/** 分割和弦（低音不是根音）—— 兩套寫法不同 */
export function slashLabel(num, quality, bassNum, style = 'roman') {
  const top = degreeLabel(num, quality, style);
  return style === 'nashville' ? `${top}/${bassNum}` : `${top}/${ROMAN[bassNum-1]}`;
}

export const NOTATION_STYLES = {
  roman:     { label:'羅馬數字', note:'古典和聲的標準寫法。大寫＝大三，小寫＝小三，°＝減三。' },
  nashville: { label:'級數數字', note:'Nashville Number System。流行/錄音室常用，品質寫成後綴。' },
};

// ─────────────────────────────────────────────────────────────────────────────
// 音階與調性判斷
// ─────────────────────────────────────────────────────────────────────────────

export const SCALES = {
  major:      { label:'大調 / Ionian',  steps:[0,2,4,5,7,9,11] },
  natminor:   { label:'自然小調 / Aeolian', steps:[0,2,3,5,7,8,10] },
  harmminor:  { label:'和聲小調',       steps:[0,2,3,5,7,8,11] },
  melminor:   { label:'旋律小調',       steps:[0,2,3,5,7,9,11] },
  dorian:     { label:'Dorian',        steps:[0,2,3,5,7,9,10] },
  phrygian:   { label:'Phrygian',      steps:[0,1,3,5,7,8,10] },
  lydian:     { label:'Lydian',        steps:[0,2,4,6,7,9,11] },
  mixolydian: { label:'Mixolydian',    steps:[0,2,4,5,7,9,10] },
  locrian:    { label:'Locrian',       steps:[0,1,3,5,6,8,10] },
  majpent:    { label:'大調五聲',       steps:[0,2,4,7,9] },
  minpent:    { label:'小調五聲',       steps:[0,3,5,7,10] },
  blues:      { label:'藍調音階',       steps:[0,3,5,6,7,10] },
};

/** 音階的 12 維向量 */
export function scaleVector(rootPc, scaleKey) {
  const sc = SCALES[scaleKey];
  if (!sc) throw new Error(`未知音階: ${scaleKey}`);
  const v = new Array(12).fill(0);
  sc.steps.forEach(s => v[pc(rootPc + s)] = 1);
  return v;
}

/**
 * Krumhansl-Schmuckler 的調性感知權重。
 *
 * 為什麼不用「音階裡有沒有這個音」的 0/1 向量：那樣 C 大調跟 A 小調
 * 完全相同（一樣的七個音），永遠分不出來。這組權重來自實驗心理學 ——
 * 主音、屬音、三音的份量本來就比其他音重，用它才分得出關係大小調。
 */
const KS_MAJOR = [6.35,2.23,3.48,2.33,4.38,4.09,2.52,5.19,2.39,3.66,2.29,2.88];
const KS_MINOR = [6.33,2.68,3.52,5.38,2.60,3.53,2.54,4.75,3.98,2.69,3.34,3.17];

function corr(a, b) {
  const n = a.length;
  const ma = a.reduce((s,x)=>s+x,0)/n, mb = b.reduce((s,x)=>s+x,0)/n;
  let num=0, da=0, db=0;
  for (let i=0;i<n;i++){ const x=a[i]-ma, y=b[i]-mb; num+=x*y; da+=x*x; db+=y*y; }
  return (da===0||db===0) ? 0 : num/Math.sqrt(da*db);
}

/**
 * 從 chroma 判斷調性。
 * @returns {{key:string, mode:'major'|'minor', score:number, ranked:Array}}
 */
export function detectKey(chroma) {
  const out = [];
  for (let r = 0; r < 12; r++) {
    const rot = chroma.map((_, i) => chroma[pc(i + r)]);
    out.push({ key: NOTE_NAMES[r], mode: 'major', score: corr(rot, KS_MAJOR) });
    out.push({ key: NOTE_NAMES[r], mode: 'minor', score: corr(rot, KS_MINOR) });
  }
  out.sort((a,b) => b.score - a.score);
  const best = out[0];
  return {
    ...best,
    margin: best.score - out[1].score,
    ranked: out.slice(0, 4),
    label: best.key + (best.mode === 'minor' ? ' 小調' : ' 大調'),
  };
}

/** 這個音在不在音階裡 */
export function inScale(midi, rootPc, scaleKey) {
  return scaleVector(rootPc, scaleKey)[pc(midi)] === 1;
}

/** 這個音是音階的第幾級（不在音階裡回傳 null） */
export function scaleDegreeOf(midi, rootPc, scaleKey) {
  const sc = SCALES[scaleKey];
  const rel = pc(midi - rootPc);
  const i = sc.steps.indexOf(rel);
  return i < 0 ? null : i + 1;
}

/** 音階上每個音的名稱，給 UI 列出來 */
export function scaleNotes(rootPc, scaleKey) {
  return SCALES[scaleKey].steps.map(s => NOTE_NAMES[pc(rootPc + s)]);
}

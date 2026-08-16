// ─────────────────────────────────────────────────────────────────────────────
// eartraining.js · 聽力練習題目產生器（純函式，不碰音訊、不碰 DOM）
//
// 三類題型：
//   interval    音程 —— 上行 / 下行 / 同時（和聲）
//   progression 和弦進行級數 —— 聽一段進行，答出級數（I–V–vi–IV）
//   chordtone   和弦組成 —— 聽一個和弦，答出它由哪些音組成
//
// 純函式所以可測試：題目正確性、答案唯一性、選項合理性，
// 全都能在沒有喇叭沒有耳朵的情況下驗證。
// ─────────────────────────────────────────────────────────────────────────────

export const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

/** 音程表。半音數 → 名稱 */
export const INTERVALS = [
  { semis: 0,  name: '完全一度', short: 'P1' },
  { semis: 1,  name: '小二度',   short: 'm2' },
  { semis: 2,  name: '大二度',   short: 'M2' },
  { semis: 3,  name: '小三度',   short: 'm3' },
  { semis: 4,  name: '大三度',   short: 'M3' },
  { semis: 5,  name: '完全四度', short: 'P4' },
  { semis: 6,  name: '增四度',   short: 'TT' },
  { semis: 7,  name: '完全五度', short: 'P5' },
  { semis: 8,  name: '小六度',   short: 'm6' },
  { semis: 9,  name: '大六度',   short: 'M6' },
  { semis: 10, name: '小七度',   short: 'm7' },
  { semis: 11, name: '大七度',   short: 'M7' },
  { semis: 12, name: '完全八度', short: 'P8' },
];

/** 大調音階各級的和弦品質與根音半音位移 */
export const DEGREES = [
  { roman: 'I',   offset: 0,  quality: 'maj' },
  { roman: 'ii',  offset: 2,  quality: 'min' },
  { roman: 'iii', offset: 4,  quality: 'min' },
  { roman: 'IV',  offset: 5,  quality: 'maj' },
  { roman: 'V',   offset: 7,  quality: 'maj' },
  { roman: 'vi',  offset: 9,  quality: 'min' },
  { roman: 'vii', offset: 11, quality: 'dim' },
];

/** 常見和弦進行（用級數表示，跟 key 無關） */
export const PROGRESSIONS = [
  { id: 'I-V-vi-IV',   degrees: ['I','V','vi','IV'],  label: 'I – V – vi – IV', note: '流行歌最常見' },
  { id: 'I-vi-IV-V',   degrees: ['I','vi','IV','V'],  label: 'I – vi – IV – V', note: '50 年代進行' },
  { id: 'ii-V-I',      degrees: ['ii','V','I'],       label: 'ii – V – I',      note: '爵士核心' },
  { id: 'I-IV-V',      degrees: ['I','IV','V'],       label: 'I – IV – V',      note: '藍調 / 三和弦' },
  { id: 'vi-IV-I-V',   degrees: ['vi','IV','I','V'],  label: 'vi – IV – I – V', note: '小調感的流行進行' },
  { id: 'I-IV-vi-V',   degrees: ['I','IV','vi','V'],  label: 'I – IV – vi – V', note: '' },
];

/**
 * 和弦品質。**分成三組讓使用者自己選範圍** —— 全開的話干擾項會太接近，
 * 初學者根本分不出來，那不是訓練是折磨。
 */
export const QUALITY_INTERVALS = {
  maj:[0,4,7], min:[0,3,7], dim:[0,3,6], aug:[0,4,8],
  dom7:[0,4,7,10], min7:[0,3,7,10], maj7:[0,4,7,11], m7b5:[0,3,6,10], dim7:[0,3,6,9],
  sus2:[0,2,7], sus4:[0,5,7], add9:[0,4,7,14%12],
  dom9:[0,4,7,10,2], min9:[0,3,7,10,2], maj9:[0,4,7,11,2],
};
export const QUALITY_LABEL = {
  maj:'大三',  min:'小三',  dim:'減三',  aug:'增三',
  dom7:'屬七', min7:'小七', maj7:'大七', m7b5:'半減七', dim7:'減七',
  sus2:'sus2', sus4:'sus4', add9:'add9',
  dom9:'屬九', min9:'小九', maj9:'大九',
};
export const CHORD_TIERS = {
  triad:  { label:'三和弦',   qualities:['maj','min','dim','aug'] },
  seventh:{ label:'七和弦',   qualities:['maj','min','dom7','min7','maj7','m7b5','dim7'] },
  ext:    { label:'掛留與延伸', qualities:['maj','min','sus2','sus4','add9','dom9','min9','maj9'] },
};

/**
 * 全部 12 個 key。
 * 原本只放 7 個吉他常用調 —— 但那是「和弦好按」的考量，
 * 聽力訓練與伴奏沒有這個限制，限制反而讓耳朵只熟悉幾個調。
 * 用降記號寫升號調的關係調，符合實際樂譜習慣（Eb 而不是 D#）。
 */
export const KEYS = ['C','Db','D','Eb','E','F','F#','G','Ab','A','Bb','B'];
const KEY_ROOT = { 'C':0,'Db':1,'D':2,'Eb':3,'E':4,'F':5,'F#':6,'G':7,'Ab':8,'A':9,'Bb':10,'B':11 };

const pc = n => ((n % 12) + 12) % 12;
export const noteName = n => NOTE_NAMES[pc(n)];

/** 級數 → 和弦名稱與組成音（給定 key） */
export function degreeToChord(roman, key) {
  const deg = DEGREES.find(d => d.roman === roman);
  if (!deg) throw new Error(`未知級數: ${roman}`);
  const root = pc(KEY_ROOT[key] + deg.offset);
  const notes = QUALITY_INTERVALS[deg.quality].map(i => pc(root + i));
  const suffix = deg.quality === 'min' ? 'm' : deg.quality === 'dim' ? 'dim' : '';
  return { roman, name: noteName(root) + suffix, root, notes, quality: deg.quality };
}

/** 可注入的亂數，讓測試可重現 */
export function makeRng(seed = 1) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
const pick = (arr, rnd) => arr[Math.floor(rnd() * arr.length) % arr.length];

/**
 * 音程題。
 * @param {'up'|'down'|'harmonic'|'any'} direction
 */
export function makeIntervalQuestion(rnd = Math.random, opts = {}) {
  const pool = opts.intervals ?? INTERVALS.filter(i => i.semis > 0 && i.semis <= 12);
  const iv = pick(pool, rnd);
  const dir = opts.direction && opts.direction !== 'any'
    ? opts.direction
    : pick(['up','down','harmonic'], rnd);

  const baseMidi = 55 + Math.floor(rnd() * 12);          // G3 附近，吉他好對照
  const other = dir === 'down' ? baseMidi - iv.semis : baseMidi + iv.semis;
  const midis = dir === 'harmonic' ? [baseMidi, other] : [baseMidi, other];

  // 選項：正確答案 + 3 個相鄰音程（相鄰的才有鑑別度，隨機選太好猜）
  const idx = INTERVALS.findIndex(x => x.semis === iv.semis);
  const near = INTERVALS.filter((_, i) => Math.abs(i - idx) <= 3 && i !== idx);
  const distractors = shuffle(near, rnd).slice(0, 3);
  const choices = shuffle([iv, ...distractors], rnd).map(x => x.name);

  return {
    type: 'interval',
    direction: dir,
    play: { midis, mode: dir === 'harmonic' ? 'together' : 'sequence' },
    answer: iv.name,
    choices,
    explain: `${noteName(baseMidi)} → ${noteName(other)}，相距 ${iv.semis} 個半音`,
    notation: { midis, clef: 'treble' },
  };
}

/** 和弦進行級數題 */
export function makeProgressionQuestion(rnd = Math.random, opts = {}) {
  const key = opts.key ?? pick(KEYS, rnd);
  const prog = pick(opts.progressions ?? PROGRESSIONS, rnd);
  const chords = prog.degrees.map(d => degreeToChord(d, key));

  const others = PROGRESSIONS.filter(p => p.id !== prog.id);
  const choices = shuffle([prog, ...shuffle(others, rnd).slice(0, 3)], rnd).map(p => p.label);

  return {
    type: 'progression',
    key,
    play: { chords: chords.map(c => c.notes.map(n => 48 + n)), mode: 'chords' },
    answer: prog.label,
    choices,
    explain: `${key} 大調：${chords.map(c => `${c.roman}=${c.name}`).join('　')}`
             + (prog.note ? `（${prog.note}）` : ''),
    notation: { chords: chords.map(c => c.notes.map(n => 48 + n)), clef: 'treble' },
    guitarAnswer: chords.map(c => c.name),   // 用吉他作答時要彈的和弦序列
  };
}

/** 和弦組成題：聽一個和弦，答出組成音 */
export function makeChordToneQuestion(rnd = Math.random, opts = {}) {
  const key = opts.key ?? pick(KEYS, rnd);
  const quals = opts.qualities ?? CHORD_TIERS.triad.qualities;
  const quality = pick(quals, rnd);
  const root = pc(KEY_ROOT[key] + pick(DEGREES, rnd).offset);
  const notes = [...new Set(QUALITY_INTERVALS[quality].map(i => pc(root + i)))];
  const ch = { name: noteName(root) + qualitySuffix(quality), root, notes, quality,
               roman: QUALITY_LABEL[quality] };
  const correct = ch.notes.map(noteName).join(' · ');

  // 干擾項：換掉其中一個音，做出「聽起來很像但不對」的選項
  const wrongs = new Set();
  let guard = 0;
  while (wrongs.size < 3 && guard++ < 40) {
    const alt = ch.notes.slice();
    alt[Math.floor(rnd() * alt.length)] = pc(alt[0] + 1 + Math.floor(rnd() * 10));
    const s = [...new Set(alt)].map(noteName).join(' · ');
    if (s !== correct && alt.length === ch.notes.length) wrongs.add(s);
  }
  const choices = shuffle([correct, ...wrongs], rnd);

  return {
    type: 'chordtone',
    key, quality,
    play: { chords: [ch.notes.map(n => 48 + n)], mode: 'chords' },
    answer: correct,
    choices,
    explain: `${ch.name}（${QUALITY_LABEL[quality]}）＝ ${correct}`,
    notation: { chords: [ch.notes.map(n => 48 + n)], clef: 'treble' },
    guitarAnswer: [ch.name],
  };
}

function qualitySuffix(q){
  return { maj:'', min:'m', dim:'dim', aug:'aug', dom7:'7', min7:'m7', maj7:'maj7',
           m7b5:'m7b5', dim7:'dim7', sus2:'sus2', sus4:'sus4', add9:'add9',
           dom9:'9', min9:'m9', maj9:'maj9' }[q] ?? '';
}

function shuffle(arr, rnd) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** 和弦品質題：聽一個和弦，答出它是什麼類型（大三/小三/屬七…） */
export function makeChordQualityQuestion(rnd = Math.random, opts = {}) {
  const quals = opts.qualities ?? CHORD_TIERS.triad.qualities;
  const quality = pick(quals, rnd);
  const root = Math.floor(rnd() * 12);
  const notes = [...new Set(QUALITY_INTERVALS[quality].map(i => pc(root + i)))];
  const correct = QUALITY_LABEL[quality];
  const others = quals.filter(q => q !== quality);
  const choices = shuffle([correct, ...shuffle(others, rnd).slice(0,3).map(q=>QUALITY_LABEL[q])], rnd);
  return {
    type: 'chordquality', quality,
    play: { chords: [notes.map(n => 48 + n)], mode: 'chords' },
    answer: correct,
    choices: [...new Set(choices)],
    explain: `${noteName(root)}${qualitySuffix(quality)} ＝ ${notes.map(noteName).join(' · ')}`,
    notation: { chords: [notes.map(n => 48 + n)], clef: 'treble' },
    guitarAnswer: [noteName(root) + qualitySuffix(quality)],
  };
}

export const QUESTION_TYPES = {
  interval:    { label: '音程',       make: makeIntervalQuestion,
                 note: '聽兩個音，答出相距多少。可選上行 / 下行 / 同時發聲。' },
  progression: { label: '和弦進行級數', make: makeProgressionQuestion,
                 note: '聽一段和弦進行，答出級數（如 I–V–vi–IV）。跟 key 無關。' },
  chordtone:   { label: '和弦組成',   make: makeChordToneQuestion,
                 note: '聽一個和弦，答出它由哪些音組成。' },
  chordquality:{ label: '和弦種類',   make: makeChordQualityQuestion,
                 note: '聽一個和弦，答出它是大三／小三／屬七…哪一種。' },
};

/** 產生一題 */
export function makeQuestion(type, rnd = Math.random, opts = {}) {
  const t = QUESTION_TYPES[type];
  if (!t) throw new Error(`未知題型: ${type}`);
  return t.make(rnd, opts);
}

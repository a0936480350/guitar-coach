// ─────────────────────────────────────────────────────────────────────────────
// backing.js · 全編制伴奏帶產生器（純資料 + 純函式，不碰 Web Audio、不碰 DOM）
//
// 跟 rhythm.js / eartraining.js 同一個理由：這裡只回答「什麼時候該響什麼音」，
// 真正發聲交給 index.html。所以沒有喇叭也能驗證整首伴奏的樂理與時間軸是否正確。
//
// 和弦與級數一律走 eartraining.js 的 degreeToChord / KEYS，鼓組一律走
// rhythm.js 的 drumGrid —— 複製一份會讓兩邊的樂理慢慢長歪，寧可 import。
// ─────────────────────────────────────────────────────────────────────────────

import { degreeToChord, KEYS, noteName, makeRng } from './eartraining.js';
import { drumGrid, DRUM_STYLES } from './rhythm.js';

export { KEYS, makeRng };

// ─────────────────────────────────────────────────────────────────────────────
// 曲風定義
//
// progression 用級數而非和弦名，所以同一份定義可以套用任何 key。
// bars 是「這個和弦佔幾小節」—— 藍調的 I 一次佔 4 小節，不能用一格一和弦硬塞。
// bass / comp 決定伴奏的個性，比 bpm 更能決定聽起來像不像那個曲風。
// ─────────────────────────────────────────────────────────────────────────────
export const BACKING_STYLES = {
  blues12: {
    label: '藍調 12 小節',
    bpm: 88, beats: 4, drumStyle: 'blues',
    bass: 'shuffle', comp: 'shuffle', bassPrefer: 40,
    note: '最標準的 12 小節藍調。I–IV–V 的位置是固定的，不能亂改。',
    progression: [
      { roman: 'I', bars: 4 }, { roman: 'IV', bars: 2 }, { roman: 'I', bars: 2 },
      { roman: 'V', bars: 1 }, { roman: 'IV', bars: 1 }, { roman: 'I', bars: 1 },
      { roman: 'V', bars: 1 },
    ],
  },
  pop: {
    label: '流行 I–V–vi–IV',
    bpm: 100, beats: 4, drumStyle: 'rock',
    bass: 'rootfifth', comp: 'straight', bassPrefer: 40,
    note: '流行歌最常見的四和弦循環。貝斯走根音＋五度。',
    progression: [
      { roman: 'I', bars: 1 }, { roman: 'V', bars: 1 },
      { roman: 'vi', bars: 1 }, { roman: 'IV', bars: 1 },
    ],
  },
  jazz: {
    label: '爵士 ii–V–I',
    bpm: 132, beats: 4, drumStyle: 'jazz',
    bass: 'walking', comp: 'charleston', bassPrefer: 40,
    note: '爵士核心進行。貝斯走 walking，最後一拍用半音趨近下一個根音。',
    progression: [
      { roman: 'ii', bars: 1 }, { roman: 'V', bars: 1 }, { roman: 'I', bars: 2 },
    ],
  },
  bossa: {
    label: 'Bossa Nova',
    bpm: 128, beats: 4, drumStyle: 'bossa',
    bass: 'bossa', comp: 'bossa', bassPrefer: 40,
    note: '和弦襯底刻意切分（1、2&、3&），這個「錯開拍點」就是 Bossa 的味道。',
    progression: [
      { roman: 'I', bars: 1 }, { roman: 'vi', bars: 1 },
      { roman: 'ii', bars: 1 }, { roman: 'V', bars: 1 },
    ],
  },
  funk: {
    label: 'Funk',
    bpm: 104, beats: 4, drumStyle: 'funk',
    // 貝斯改用較低的 prefer，八度跳躍才不會被音域上限壓回原音
    bass: 'funk', comp: 'stabs', bassPrefer: 36,
    note: '貝斯十六分切分＋八度跳，和弦一律短促斷奏，留白比音符重要。',
    progression: [
      { roman: 'I', bars: 2 }, { roman: 'IV', bars: 1 }, { roman: 'V', bars: 1 },
    ],
  },
  ballad: {
    label: '抒情民謠',
    bpm: 68, beats: 4, drumStyle: 'ballad',
    bass: 'ballad', comp: 'sustain', bassPrefer: 40,
    note: '每個和弦鋪滿兩小節，和弦拉長音，讓旋律有空間。',
    progression: [
      { roman: 'I', bars: 2 }, { roman: 'vi', bars: 2 },
      { roman: 'IV', bars: 2 }, { roman: 'V', bars: 2 },
    ],
  },
};

/** 貝斯合理音域（MIDI）。E1–G3，涵蓋四弦貝斯與吉他低音弦。 */
export const BASS_RANGE = { lo: 28, hi: 55 };
/** 和弦襯底合理音域（MIDI）。C3–C6，刻意壓在貝斯之上避免糊在一起。 */
export const CHORD_RANGE = { lo: 48, hi: 84 };

const pc = n => ((n % 12) + 12) % 12;

/**
 * 把一個音級放到「離 prefer 最近」的那個八度，再夾進音域。
 * 用最近八度而不是固定八度，是為了讓連續的貝斯音自然接續，不會突然跳一個八度。
 */
function nearestMidi(pitchClass, prefer, lo, hi) {
  let m = prefer + pc(pitchClass - prefer);
  if (m - prefer > 6) m -= 12;          // 往下比往上近就往下
  while (m < lo) m += 12;
  while (m > hi) m -= 12;
  return m;
}

/** 和弦組成音疊成上行排列（root 之上依序往上堆），避免音程翻轉聽起來散掉。 */
function voiceChord(notes, prefer = 60) {
  const out = [];
  let cur = nearestMidi(notes[0], prefer, CHORD_RANGE.lo, CHORD_RANGE.hi);
  out.push(cur);
  for (let i = 1; i < notes.length; i++) {
    let m = cur + pc(notes[i] - cur);
    if (m === cur) m += 12;             // 同音級要往上疊，不能重疊在同一個 midi
    if (m > CHORD_RANGE.hi) m -= 12;
    out.push(m);
    cur = m;
  }
  return out;
}

const pick = (arr, rnd) => arr[Math.floor(rnd() * arr.length) % arr.length];

// ─────────────────────────────────────────────────────────────────────────────
// 貝斯型
//
// 每個型吃「這一小節的和弦 / 下一小節的和弦 / 上一個貝斯音」，回傳
// {beat, midi, dur}。回傳相對小節起點的拍數，串接由 generateBacking 負責。
// ─────────────────────────────────────────────────────────────────────────────
const BASS_PATTERNS = {
  // 藍調 shuffle：R–5–6–5 的經典走法，每拍再補一個 swing 的後半拍
  shuffle(ctx) {
    const steps = [0, 7, 9, 7];
    const out = [];
    for (let b = 0; b < ctx.beats; b++) {
      const midi = nearestMidi(ctx.chord.root + steps[b % steps.length], ctx.prefer,
                               BASS_RANGE.lo, BASS_RANGE.hi);
      out.push({ beat: b, midi, dur: 2 / 3 });
      out.push({ beat: b + 2 / 3, midi, dur: 1 / 3 });
    }
    return out;
  },

  // 流行：根音在 1、3 拍，五度在 2、4 拍
  rootfifth(ctx) {
    const out = [];
    for (let b = 0; b < ctx.beats; b++) {
      const off = b % 2 === 0 ? 0 : 7;
      out.push({
        beat: b,
        midi: nearestMidi(ctx.chord.root + off, ctx.prefer, BASS_RANGE.lo, BASS_RANGE.hi),
        dur: 1,
      });
    }
    return out;
  },

  // 爵士 walking：根–三–五，最後一拍用半音趨近下一個和弦的根音
  walking(ctx) {
    const out = [];
    const tones = ctx.chord.notes;      // [root, 3rd, 5th]
    let prev = ctx.prevMidi ?? ctx.prefer;
    for (let b = 0; b < ctx.beats; b++) {
      let target;
      if (b === ctx.beats - 1) {
        // 從上方或下方半音進入下一個根音 —— 選離目前位置近的那邊，線條才平順
        const nextRoot = ctx.nextChord.root;
        const below = nearestMidi(nextRoot - 1, prev, BASS_RANGE.lo, BASS_RANGE.hi);
        const above = nearestMidi(nextRoot + 1, prev, BASS_RANGE.lo, BASS_RANGE.hi);
        target = Math.abs(below - prev) <= Math.abs(above - prev) ? below : above;
      } else {
        target = nearestMidi(tones[b % tones.length], prev, BASS_RANGE.lo, BASS_RANGE.hi);
      }
      out.push({ beat: b, midi: target, dur: 1 });
      prev = target;
    }
    return out;
  },

  // Bossa：根音在 1、3 拍拉長，五度墊在 2&、4& —— 這個「晚半拍」是 Bossa 的骨架
  bossa(ctx) {
    const R = nearestMidi(ctx.chord.root, ctx.prefer, BASS_RANGE.lo, BASS_RANGE.hi);
    const F = nearestMidi(ctx.chord.root + 7, ctx.prefer, BASS_RANGE.lo, BASS_RANGE.hi);
    return [
      { beat: 0,   midi: R, dur: 1.5 },
      { beat: 1.5, midi: F, dur: 0.5 },
      { beat: 2,   midi: R, dur: 1.5 },
      { beat: 3.5, midi: F, dur: 0.5 },
    ].filter(e => e.beat < ctx.beats);
  },

  // Funk：十六分切分，根音與高八度交替。斷得短、留白多才是 funk
  funk(ctx) {
    const R = nearestMidi(ctx.chord.root, ctx.prefer, BASS_RANGE.lo, BASS_RANGE.hi);
    const O = nearestMidi(ctx.chord.root, R + 12, BASS_RANGE.lo, BASS_RANGE.hi);
    const F = nearestMidi(ctx.chord.root + 7, R, BASS_RANGE.lo, BASS_RANGE.hi);
    return [
      { beat: 0,    midi: R, dur: 0.25 },
      { beat: 0.75, midi: R, dur: 0.25 },
      { beat: 1.5,  midi: O, dur: 0.25 },
      { beat: 2,    midi: R, dur: 0.25 },
      { beat: 2.75, midi: F, dur: 0.25 },
      { beat: 3.5,  midi: O, dur: 0.5 },
    ].filter(e => e.beat < ctx.beats);
  },

  // 抒情：根音鋪滿整個小節，第 3 拍補一個五度做支撐
  ballad(ctx) {
    const R = nearestMidi(ctx.chord.root, ctx.prefer, BASS_RANGE.lo, BASS_RANGE.hi);
    const F = nearestMidi(ctx.chord.root + 7, ctx.prefer, BASS_RANGE.lo, BASS_RANGE.hi);
    const out = [{ beat: 0, midi: R, dur: Math.min(2, ctx.beats) }];
    if (ctx.beats > 2) out.push({ beat: 2, midi: F, dur: ctx.beats - 2 });
    return out;
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// 和弦襯底節奏型
//
// 只回傳 {beat, dur}，實際要按下哪幾個 midi 由 voiceChord 決定 ——
// 節奏與音高分開，換 voicing 不必動節奏。
// ─────────────────────────────────────────────────────────────────────────────
const COMP_PATTERNS = {
  straight: b => Array.from({ length: b }, (_, i) => ({ beat: i, dur: 0.9 })),
  // 藍調刷在 swing 的後半拍上，跟 shuffle 貝斯錯開
  shuffle:  b => Array.from({ length: b }, (_, i) => ({ beat: i + 2 / 3, dur: 1 / 3 })),
  // Charleston：1 拍與 2&，爵士最基本的 comping
  charleston: b => [{ beat: 0, dur: 1 }, { beat: 2.5, dur: 1 }].filter(e => e.beat < b),
  bossa: b => [
    { beat: 0, dur: 1.5 }, { beat: 1.5, dur: 0.5 },
    { beat: 2.5, dur: 1 }, { beat: 3.5, dur: 0.5 },
  ].filter(e => e.beat < b),
  // Funk 的和弦是「刮」出來的，長度短到幾乎只有攻擊感
  stabs: b => [
    { beat: 0.5, dur: 0.25 }, { beat: 1.5, dur: 0.25 },
    { beat: 2.25, dur: 0.25 }, { beat: 3.5, dur: 0.25 },
  ].filter(e => e.beat < b),
  sustain: b => [{ beat: 0, dur: b }],
};

/** 把 progression 展開成「一小節一個和弦」的清單（處理 bars > 1 的情況） */
function expandProgression(style, key) {
  const out = [];
  for (const seg of style.progression) {
    const chord = degreeToChord(seg.roman, key);
    for (let i = 0; i < seg.bars; i++) out.push(chord);
  }
  return out;
}

/** 一個循環有幾小節 */
export function cycleBars(styleKey) {
  const st = BACKING_STYLES[styleKey];
  if (!st) throw new Error(`未知的伴奏曲風: ${styleKey}`);
  return st.progression.reduce((n, s) => n + s.bars, 0);
}

/**
 * 產生一段 full band 伴奏的「事件資料」（不發聲）。
 *
 * @param {string} styleKey BACKING_STYLES 的 key
 * @param {{key?:string, bars?:number, rng?:()=>number}} [opts]
 *        key  指定調性，不給就從 KEYS 隨機挑
 *        bars 總小節數，預設一個完整循環；超過時進行會循環接續
 *        rng  可注入的亂數，讓同 seed 可重現
 * @returns {{key:string, style:object, bars:object[], events:object[],
 *            beatsPerBar:number, bpm:number, totalBars:number, totalBeats:number}}
 */
export function generateBacking(styleKey, opts = {}) {
  const style = BACKING_STYLES[styleKey];
  if (!style) throw new Error(`未知的伴奏曲風: ${styleKey}`);

  const rnd = opts.rng ?? Math.random;
  const key = opts.key ?? pick(KEYS, rnd);
  if (!KEYS.includes(key)) throw new Error(`未知的 key: ${key}`);

  const beats = style.beats;
  const cycle = expandProgression(style, key);
  const totalBars = opts.bars ?? cycle.length;
  if (!(totalBars > 0)) throw new Error(`小節數必須大於 0: ${totalBars}`);

  // 每小節一個和弦（超過一個循環就從頭接）
  const bars = [];
  for (let i = 0; i < totalBars; i++) {
    const ch = cycle[i % cycle.length];
    bars.push({
      bar: i,
      startBeat: i * beats,
      beats,
      roman: ch.roman,
      chordName: ch.name,
      root: ch.root,
      notes: ch.notes.slice(),
      quality: ch.quality,
    });
  }

  const bassFn = BASS_PATTERNS[style.bass];
  const compFn = COMP_PATTERNS[style.comp];
  if (!bassFn || !compFn) throw new Error(`曲風 ${styleKey} 的伴奏型未定義`);

  // 鼓：整段都用同一個節奏型，每小節重複一次。拍號必須一致，
  // 否則鼓會跟和弦錯開 —— 寧可直接爆錯也不要默默走音。
  const drumStyle = DRUM_STYLES[style.drumStyle];
  if (!drumStyle) throw new Error(`未知的鼓組風格: ${style.drumStyle}`);
  if (drumStyle.beats !== beats) {
    throw new Error(`${styleKey} 拍號 ${beats} 與鼓組 ${style.drumStyle} 的 ${drumStyle.beats} 不符`);
  }
  const drumBar = drumGrid(style.drumStyle);

  const events = [];
  let prevBassMidi = null;

  for (let i = 0; i < totalBars; i++) {
    const t0 = i * beats;
    const chord = cycle[i % cycle.length];
    const nextChord = cycle[(i + 1) % cycle.length];

    // 貝斯
    const bassEvents = bassFn({
      chord, nextChord, beats,
      prefer: style.bassPrefer ?? 40,
      prevMidi: prevBassMidi,
    });
    for (const e of bassEvents) {
      events.push({ time: t0 + e.beat, type: 'bass', midi: e.midi, dur: e.dur, bar: i });
      prevBassMidi = e.midi;
    }

    // 和弦襯底：一個節奏點展開成數個同時發聲的音
    const voicing = voiceChord(chord.notes);
    for (const hit of compFn(beats)) {
      for (const midi of voicing) {
        events.push({ time: t0 + hit.beat, type: 'chord', midi, dur: hit.dur, bar: i });
      }
    }

    // 鼓
    for (const d of drumBar) {
      events.push({ time: t0 + d.beat, type: 'drum', drum: d.drum, dur: 0.25, bar: i });
    }
  }

  // 穩定排序：同一時間點的事件保持產生順序（貝斯→和弦→鼓），UI 排程比較好讀
  events.forEach((e, i) => { e._i = i; });
  events.sort((a, b) => (a.time - b.time) || (a._i - b._i));
  events.forEach(e => { delete e._i; });

  return {
    key,
    style: { id: styleKey, ...style },
    bars,
    events,
    beatsPerBar: beats,
    bpm: style.bpm,
    totalBars,
    totalBeats: totalBars * beats,
  };
}

/** 給 UI 顯示用：這段伴奏的和弦名序列（如 G · D · Em · C） */
export function chordSequence(backing) {
  return backing.bars.map(b => b.chordName);
}

/** 給 UI 顯示用：這段伴奏的音名（除錯／教學用） */
export const midiName = m => noteName(m) + (Math.floor(m / 12) - 1);

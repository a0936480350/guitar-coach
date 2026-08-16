// 驗證題目產生器 —— 不需要喇叭也不需要耳朵
import { makeQuestion, makeRng, degreeToChord, QUESTION_TYPES,
         INTERVALS, PROGRESSIONS, KEYS, noteName } from './eartraining.js';

let pass=0, fail=0;
const t=(n,c,e='')=>{ if(c){pass++;} else {fail++;console.log('  FAIL '+n+'  '+e);} };

console.log('聽力練習題目產生器測試\n');

// ── 樂理正確性：這是最重要的，出錯會教錯學生 ──────────────────────────────
console.log('樂理正確性：');
const cases = [
  ['I','C','C',[0,4,7]], ['V','C','G',[7,11,2]], ['vi','C','Am',[9,0,4]],
  ['IV','C','F',[5,9,0]], ['ii','C','Dm',[2,5,9]], ['iii','C','Em',[4,7,11]],
  ['I','G','G',[7,11,2]], ['V','G','D',[2,6,9]],  ['vi','G','Em',[4,7,11]],
  ['ii','G','Am',[9,0,4]],['V','F','C',[0,4,7]],  ['vi','F','Dm',[2,5,9]],
];
for(const [roman,key,name,notes] of cases){
  const c=degreeToChord(roman,key);
  t(`${key} 的 ${roman} = ${name}`, c.name===name, `得到 ${c.name}`);
  t(`${key} ${roman} 組成音`, JSON.stringify(c.notes.slice().sort((a,b)=>a-b))===JSON.stringify(notes.slice().sort((a,b)=>a-b)),
    `得到 ${c.notes.map(noteName)}`);
}
console.log(`  ${cases.length*2} 項級數/組成音檢查完成`);

// ── 每種題型大量產生，檢查結構完整 ────────────────────────────────────────
console.log('\n題目結構（每型各 300 題）：');
for(const type of Object.keys(QUESTION_TYPES)){
  const rnd=makeRng(42);
  let bad=0, ansMissing=0, dup=0, tooFew=0;
  for(let i=0;i<300;i++){
    const q=makeQuestion(type,rnd);
    if(!q.answer||!q.choices||!q.play||!q.explain) bad++;
    if(!q.choices.includes(q.answer)) ansMissing++;
    if(new Set(q.choices).size!==q.choices.length) dup++;
    if(q.choices.length<3) tooFew++;
  }
  t(`${type} 結構完整`, bad===0, `${bad} 題缺欄位`);
  t(`${type} 正解一定在選項裡`, ansMissing===0, `${ansMissing} 題找不到正解`);
  t(`${type} 選項無重複`, dup===0, `${dup} 題有重複選項`);
  t(`${type} 選項至少 3 個`, tooFew===0, `${tooFew} 題選項太少`);
  console.log(`  ${QUESTION_TYPES[type].label.padEnd(12)} 300 題：缺欄位 ${bad}  正解遺失 ${ansMissing}  重複 ${dup}  選項不足 ${tooFew}`);
}

// ── 音程題方向正確性 ──────────────────────────────────────────────────────
console.log('\n音程方向：');
const rnd2=makeRng(7);
let upBad=0, downBad=0, upN=0, downN=0;
for(let i=0;i<400;i++){
  const q=makeQuestion('interval',rnd2);
  const [a,b]=q.play.midis;
  if(q.direction==='up'){ upN++; if(b<=a) upBad++; }
  if(q.direction==='down'){ downN++; if(b>=a) downBad++; }
  const iv=INTERVALS.find(x=>x.name===q.answer);
  if(iv && Math.abs(b-a)!==iv.semis) upBad++;
}
t('上行題第二音確實較高', upBad===0, `${upBad} 題不符`);
t('下行題第二音確實較低', downBad===0, `${downBad} 題不符`);
console.log(`  上行 ${upN} 題、下行 ${downN} 題，半音數與答案全部相符`);

// ── 和弦進行：級數與 key 的對應 ───────────────────────────────────────────
console.log('\n和弦進行：');
const rnd3=makeRng(99);
let progBad=0;
for(let i=0;i<300;i++){
  const q=makeQuestion('progression',rnd3);
  const prog=PROGRESSIONS.find(p=>p.label===q.answer);
  if(!prog){progBad++;continue;}
  if(q.play.chords.length!==prog.degrees.length) progBad++;
  if(!KEYS.includes(q.key)) progBad++;
  if(q.guitarAnswer.length!==prog.degrees.length) progBad++;
}
t('進行題和弦數與級數數相符', progBad===0, `${progBad} 題不符`);
console.log('  300 題的和弦數、key、吉他作答序列都對得上');

// ── 干擾項不能等於正解 ────────────────────────────────────────────────────
console.log('\n干擾項品質：');
const rnd4=makeRng(555);
let sameAsAnswer=0;
for(let i=0;i<300;i++){
  const q=makeQuestion('chordtone',rnd4);
  if(q.choices.filter(c=>c===q.answer).length!==1) sameAsAnswer++;
}
t('和弦組成題正解只出現一次', sameAsAnswer===0, `${sameAsAnswer} 題重複`);

// ── 可重現性 ──────────────────────────────────────────────────────────────
console.log('\n可重現性：');
const A=makeQuestion('interval',makeRng(2026));
const B=makeQuestion('interval',makeRng(2026));
t('同 seed 產生同一題', JSON.stringify(A)===JSON.stringify(B));

console.log(`\n通過 ${pass}，失敗 ${fail}`);
process.exit(fail?1:0);

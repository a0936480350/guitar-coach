import { degreeLabel, progressionLabel, slashLabel, MAJOR_DEGREES, NOTATION_STYLES,
         SCALES, scaleVector, detectKey, inScale, scaleDegreeOf, scaleNotes,
         NOTE_NAMES } from './theory.js';
let pass=0,fail=0;
const t=(n,c,e='')=>{ if(c)pass++;else{fail++;console.log('  FAIL '+n+'  '+e);} };

console.log('樂理模組測試\n');

console.log('兩套級數記法：');
console.log('  級數  古典羅馬     Nashville');
const cases=[[1,'maj','I','1'],[2,'min','ii','2m'],[3,'min','iii','3m'],[4,'maj','IV','4'],
             [5,'maj','V','5'],[6,'min','vi','6m'],[7,'dim','vii°','7dim'],
             [1,'maj7','Imaj7','1M7'],[2,'min7','ii7','2m7'],[5,'dom7','V7','57']];
for(const [n,q,rom,nash] of cases){
  const r=degreeLabel(n,q,'roman'), s=degreeLabel(n,q,'nashville');
  console.log(`  ${n}${q.padEnd(6)} ${rom.padEnd(10)} ${nash}`);
  t(`${n}/${q} 羅馬=${rom}`, r===rom, `得到 ${r}`);
  t(`${n}/${q} Nashville=${nash}`, s===nash, `得到 ${s}`);
}

console.log('\n大小寫規則（羅馬數字的核心）：');
t('大三和弦用大寫', degreeLabel(1,'maj','roman')==='I');
t('小三和弦用小寫', degreeLabel(2,'min','roman')==='ii');
t('減三和弦小寫加°', degreeLabel(7,'dim','roman')==='vii°');
t('Nashville 不分大小寫', degreeLabel(2,'min','nashville')==='2m' && degreeLabel(2,'maj','nashville')==='2');

console.log('\n斜線的意思不同（這是關鍵陷阱）：');
const rSlash=slashLabel(5,'maj',2,'roman'), nSlash=slashLabel(5,'maj',2,'nashville');
console.log(`  羅馬 ${rSlash}（V 的 II 級 = 次屬）　Nashville ${nSlash}（5 級和弦低音放 2 音 = 分割和弦）`);
t('兩套的斜線寫法不同', rSlash!==nSlash, `${rSlash} vs ${nSlash}`);

console.log('\n整條進行：');
const prog=[{num:2,quality:'min7'},{num:5,quality:'dom7'},{num:1,quality:'maj7'}];
const pr=progressionLabel(prog,'roman'), pn=progressionLabel(prog,'nashville');
console.log(`  羅馬      ${pr}`);
console.log(`  Nashville ${pn}`);
t('251 羅馬', pr==='ii7 – V7 – Imaj7', pr);
t('251 Nashville', pn==='2m7 57 1M7', pn);

console.log('\n音階：');
for(const [k,v] of Object.entries(SCALES)){
  const vec=scaleVector(0,k);
  t(`${v.label} 音數正確`, vec.filter(x=>x).length===v.steps.length);
  t(`${v.label} 含主音`, vec[0]===1);
}
console.log(`  ${Object.keys(SCALES).length} 個音階全部檢查完成`);
t('C 大調音名', scaleNotes(0,'major').join('')==='CDEFGAB', scaleNotes(0,'major').join(''));
t('A 小調五聲', scaleNotes(9,'minpent').join(' ')==='A C D E G', scaleNotes(9,'minpent').join(' '));
t('C 藍調含降五', scaleNotes(0,'blues').includes('F#'));
t('第 3 音是 E（C大調）', scaleDegreeOf(4,0,'major')===3);
t('F# 不在 C 大調', scaleDegreeOf(6,0,'major')===null);
t('inScale 正確', inScale(4,0,'major') && !inScale(6,0,'major'));

console.log('\n調性判斷（Krumhansl-Schmuckler）：');
// 用純音階向量測：C大調 vs A小調 用的是同樣七個音，0/1 向量分不出，
// KS 權重才分得出 —— 這正是用它的理由
function chromaFor(root, scale, emphasis){
  const v=scaleVector(root,scale).map(x=>x*1.0);
  emphasis.forEach(([pcv,w])=>v[(pcv%12+12)%12]+=w);
  return v;
}
const tests=[
  ['C 大調', chromaFor(0,'major',[[0,2.2],[7,1.2],[4,0.9]]), 'C','major'],
  ['G 大調', chromaFor(7,'major',[[7,2.2],[2,1.2],[11,0.9]]), 'G','major'],
  ['A 小調', chromaFor(9,'natminor',[[9,2.2],[4,1.2],[0,0.9]]), 'A','minor'],
  ['E 小調', chromaFor(4,'natminor',[[4,2.2],[11,1.2],[7,0.9]]), 'E','minor'],
  ['F 大調', chromaFor(5,'major',[[5,2.2],[0,1.2],[9,0.9]]), 'F','major'],
];
for(const [label,ch,ek,em] of tests){
  const r=detectKey(ch);
  console.log(`  ${label.padEnd(7)} → ${r.label.padEnd(9)} 相關 ${r.score.toFixed(3)} 領先 ${r.margin.toFixed(3)}`);
  t(label, r.key===ek&&r.mode===em, `得到 ${r.label}`);
}
t('回傳前四名', detectKey(chromaFor(0,'major',[[0,2]])).ranked.length===4);

console.log(`\n通過 ${pass}，失敗 ${fail}`);
process.exit(fail?1:0);

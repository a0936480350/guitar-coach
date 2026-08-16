import { SUBDIVISIONS, clickGrid, DRUM_STYLES, drumGrid, barBeats } from './rhythm.js';
let pass=0,fail=0;
const t=(n,c,e='')=>{ if(c)pass++;else{fail++;console.log('  FAIL '+n+'  '+e);} };

console.log('節拍與鼓機測試\n');

console.log('細分：');
for(const [k,v] of Object.entries(SUBDIVISIONS)){
  const g=clickGrid(4,k);
  t(`${v.label} 一小節 ${4*v.n} 個點`, g.length===4*v.n, String(g.length));
  t(`${v.label} 第一個是小節重音`, g[0].accent==='bar');
  t(`${v.label} 每拍第一個是拍點`, g.filter(x=>x.accent!=='sub').length===4);
  // 時間點必須均勻遞增
  const gaps=[]; for(let i=1;i<g.length;i++) gaps.push(+(g[i].beat-g[i-1].beat).toFixed(6));
  t(`${v.label} 間隔均勻`, new Set(gaps).size===1, JSON.stringify([...new Set(gaps)]));
  console.log(`  ${v.label.padEnd(7)} ${String(4*v.n).padStart(2)} 點/小節   ${v.sound}`);
}

console.log('\n鼓機風格：');
for(const [k,st] of Object.entries(DRUM_STYLES)){
  const g=drumGrid(k);
  const maxBeat=Math.max(...g.map(x=>x.beat));
  t(`${st.label} 有事件`, g.length>0);
  t(`${st.label} 不超出小節`, maxBeat < st.beats, `最大=${maxBeat}`);
  t(`${st.label} 時間遞增`, g.every((x,i)=>i===0||x.beat>=g[i-1].beat));
  t(`${st.label} 大鼓小鼓筒鼓都有定義`, ['kick','snare','hat'].every(d=>Array.isArray(st[d])));
  t(`${st.label} pattern 長度=拍數×4`, ['kick','snare','hat'].every(d=>st[d].length===st.beats*4),
    `beats=${st.beats}`);
  const kicks=g.filter(x=>x.drum==='kick').length, snares=g.filter(x=>x.drum==='snare').length;
  console.log(`  ${st.label.padEnd(14)} ${st.bpm} BPM  ${st.beats}/4  大鼓${kicks} 小鼓${snares} ${st.swing?'swing':''}`);
}

console.log('\nSwing 位移：');
const jazz=drumGrid('jazz');
const swung=jazz.filter(x=>Math.abs(x.beat%1 - 2/3)<0.001);
t('swing 風格有落在三連音第 3 點的音', swung.length>0, `${swung.length} 個`);
const rock=drumGrid('rock');
t('非 swing 風格全部落在 1/4 格線上', rock.every(x=>Math.abs(x.beat*4-Math.round(x.beat*4))<1e-9));

console.log('\n拍數：');
t('華爾滋是 3 拍', barBeats('waltz')===3);
t('搖滾是 4 拍', barBeats('rock')===4);

console.log(`\n通過 ${pass}，失敗 ${fail}`);
process.exit(fail?1:0);

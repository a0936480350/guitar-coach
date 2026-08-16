import { midiToFret, STRING_MIDI, STRING_LABEL, staffSVG, tabSVG, renderNotation } from './notation.js';
let pass=0,fail=0;
const t=(n,c,e='')=>{ if(c)pass++;else{fail++;console.log('  FAIL '+n+'  '+e);} };

console.log('樂譜產生測試\n');

console.log('弦序（吉他教材最常見的致命錯誤）：');
t('第 1 弦（陣列 index 0）是最高音 E4', STRING_MIDI[0]===64, String(STRING_MIDI[0]));
t('第 6 弦（陣列 index 5）是最低音 E2', STRING_MIDI[5]===40, String(STRING_MIDI[5]));
t('MIDI 由上到下遞減（畫面上方=高音弦）',
  STRING_MIDI.every((m,i)=>i===0||m<STRING_MIDI[i-1]), JSON.stringify(STRING_MIDI));

console.log('\n音 → 弦格換算：');
const cases=[[64,0,0],[59,1,0],[55,2,0],[50,3,0],[45,4,0],[40,5,0],[41,5,1],[65,0,1]];
for(const [midi,st,fr] of cases){
  const p=midiToFret(midi);
  t(`MIDI ${midi} → 第${st+1}弦第${fr}格`, p&&p.string===st&&p.fret===fr,
    p?`得到 第${p.string+1}弦第${p.fret}格`:'找不到');
}
t('超出範圍回傳 null', midiToFret(20)===null);

console.log('\nSVG 產生：');
const g=[[60,64,67]];
const st=staffSVG(g), tb=tabSVG(g);
t('五線譜是合法 SVG', st.startsWith('<svg')&&st.endsWith('</svg>'));
t('TAB 是合法 SVG', tb.startsWith('<svg')&&tb.endsWith('</svg>'));
t('五線譜有 5 條線', (st.match(/<line/g)||[]).length>=5);
t('TAB 有 6 條線', (tb.match(/<line/g)||[]).length>=6);
t('和弦三個音都畫出來', (st.match(/<ellipse/g)||[]).length===3, String((st.match(/<ellipse/g)||[]).length));
t('renderNotation 支援 midis 格式', renderNotation({midis:[60,64]},'staff').startsWith('<svg'));
t('renderNotation 支援 chords 格式', renderNotation({chords:[[60,64,67]]},'tab').startsWith('<svg'));
t('空輸入回傳空字串', renderNotation(null)==='' && renderNotation({})==='');

console.log('\nTAB 內容正確性：');
// C 大三和弦 C4 E4 G4 → 應該出現在對應弦上
const tabC = tabSVG([[60,64,67]]);
t('TAB 有三個格數標記', (tabC.match(/text-anchor="middle"/g)||[]).length===3);

console.log(`\n通過 ${pass}，失敗 ${fail}`);
process.exit(fail?1:0);

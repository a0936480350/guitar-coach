import { computeHomography, applyHomography, xToFret, fretToX, yToString,
         locate, validateCalibration, TARGET_RECT, STRING_MIDI } from './fretboard.js';
let pass=0,fail=0;
const t=(n,c,e='')=>{ if(c)pass++;else{fail++;console.log('  FAIL '+n+'  '+e);} };

console.log('指板座標對應測試\n');

console.log('琴衍間距（非線性 — 用線性算會全錯）：');
console.log('  格   實際比例   線性會算成   差距');
for(const n of [1,3,5,7,12]){
  const real=fretToX(n), lin=n/12;
  console.log(`  ${String(n).padStart(2)}   ${real.toFixed(4)}     ${lin.toFixed(4)}      ${(real-lin).toFixed(4)}`);
}
t('第 12 格在 x=1.0', Math.abs(fretToX(12)-1)<1e-9, String(fretToX(12)));
t('第 0 格（上弦枕）在 x=0', Math.abs(fretToX(0))<1e-12);
t('第 5 格明顯不等於線性值', Math.abs(fretToX(5)-5/12)>0.08, `實際${fretToX(5).toFixed(3)} 線性${(5/12).toFixed(3)}`);
// 往返一致
let rt=0;
for(let n=0;n<=15;n++) rt=Math.max(rt,Math.abs(xToFret(fretToX(n))-n));
t('fretToX 與 xToFret 互為反函數', rt<1e-9, `最大誤差 ${rt}`);

console.log('\n單應性變換：');
// 恆等
const I=computeHomography(TARGET_RECT,TARGET_RECT);
t('相同四點得到恆等變換', I && Math.abs(applyHomography(I,{x:0.3,y:0.7}).x-0.3)<1e-9);
// 已知的縮放平移
const src=[{x:10,y:20},{x:10,y:60},{x:90,y:20},{x:90,y:60}];
const H=computeHomography(src,TARGET_RECT);
t('四角正確對應', H && TARGET_RECT.every((d,i)=>{
  const p=applyHomography(H,src[i]); return Math.abs(p.x-d.x)<1e-9&&Math.abs(p.y-d.y)<1e-9;
}));
const mid=applyHomography(H,{x:50,y:40});
t('中點映射到中點', Math.abs(mid.x-0.5)<1e-9&&Math.abs(mid.y-0.5)<1e-9,
  JSON.stringify(mid));
// 透視（梯形，模擬相機斜看）
const persp=[{x:20,y:30},{x:16,y:74},{x:120,y:38},{x:124,y:66}];
const Hp=computeHomography(persp,TARGET_RECT);
t('梯形（斜視角）也能求解', Hp!==null);
t('梯形四角仍精確對應', Hp && TARGET_RECT.every((d,i)=>{
  const p=applyHomography(Hp,persp[i]); return Math.abs(p.x-d.x)<1e-8&&Math.abs(p.y-d.y)<1e-8;
}));
t('共線四點回傳 null',
  computeHomography([{x:0,y:0},{x:1,y:1},{x:2,y:2},{x:3,y:3}],TARGET_RECT)===null);

console.log('\n定位（用理想的正方形校準）：');
const sq=[{x:0,y:0},{x:0,y:1},{x:1,y:0},{x:1,y:1}];
const Hs=computeHomography(sq,TARGET_RECT);
const cases=[
  // [畫面點, 期望弦(0起), 期望格, 說明]
  [{x:fretToX(1)/2,y:0}, 0,1,"第1弦第1格（上弦枕與第1格之間）"],
  [{x:(fretToX(4)+fretToX(5))/2,y:0}, 0,5,'第1弦第5格'],
  [{x:(fretToX(2)+fretToX(3))/2,y:1}, 5,3,'第6弦第3格'],
  [{x:(fretToX(6)+fretToX(7))/2,y:0.4},2,7,'第3弦第7格'],
  [{x:(fretToX(11)+fretToX(12))/2,y:0.8},4,12,'第5弦第12格'],
];
for(const [pt,st,fr,desc] of cases){
  const r=locate(Hs,pt);
  t(desc, r.ok&&r.string===st&&r.fret===fr,
    r.ok?`得到 第${r.string+1}弦第${r.fret}格`:r.why);
}

console.log('\n音高換算：');
const r1=locate(Hs,{x:(fretToX(4)+fretToX(5))/2,y:0});
t('第1弦第5格 = A4 (MIDI 69)', r1.midi===69&&r1.note==='A', `${r1.note}${r1.octave} midi=${r1.midi}`);
const r2=locate(Hs,{x:(fretToX(2)+fretToX(3))/2,y:1});
t('第6弦第3格 = G2 (MIDI 43)', r2.midi===43&&r2.note==='G', `${r2.note}${r2.octave} midi=${r2.midi}`);
t('空弦 MIDI 由細到粗遞減', STRING_MIDI.every((m,i)=>i===0||m<STRING_MIDI[i-1]));

console.log('\n範圍外拒絕：');
t('指板外（太上面）被拒', !locate(Hs,{x:0.5,y:-2}).ok);
t('指板外（太右邊）被拒', !locate(Hs,{x:1.9,y:0.5}).ok);

console.log('\n校準檢查：');
t('正常四點通過', validateCalibration(sq).ok);
t('點數不對被擋', !validateCalibration([{x:0,y:0}]).ok);
t('四點擠成一團被擋', !validateCalibration(
  [{x:0.5,y:0.5},{x:0.51,y:0.5},{x:0.5,y:0.51},{x:0.51,y:0.51}]).ok);
t('共線被擋', !validateCalibration(
  [{x:0,y:0},{x:0.3,y:0.3},{x:0.6,y:0.6},{x:0.9,y:0.9}]).ok);

console.log(`\n通過 ${pass}，失敗 ${fail}`);
process.exit(fail?1:0);

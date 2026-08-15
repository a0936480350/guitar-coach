// 用合成的手部關鍵點驗證幾何運算 —— 不需要鏡頭
import { angleAt, fingerCurls, thumbOverNeck, palmSpread, analyse, LM } from './posture.js';

let pass=0, fail=0;
const t=(name,cond,extra='')=>{ if(cond){pass++;console.log(`  OK   ${name}`);}
  else{fail++;console.log(`  FAIL ${name} ${extra}`);} };

console.log('姿勢幾何自我測試\n');

// 1. 直角
console.log('angleAt：');
t('90 度', Math.abs(angleAt({x:1,y:0,z:0},{x:0,y:0,z:0},{x:0,y:1,z:0}) - 90) < 0.01);
t('180 度（打直）', Math.abs(angleAt({x:-1,y:0,z:0},{x:0,y:0,z:0},{x:1,y:0,z:0}) - 180) < 0.01);
t('0 度（折回）', Math.abs(angleAt({x:1,y:0,z:0},{x:0,y:0,z:0},{x:1,y:0,z:0})) < 0.01);

// 2. 造一隻「手指全打直」的手
const P = (x,y,z=0)=>({x,y,z});
const straight = new Array(21).fill(null).map(()=>P(0,0));
straight[LM.WRIST]=P(0.5,0.9);
[[LM.INDEX_MCP,0.42],[LM.MIDDLE_MCP,0.48],[LM.RING_MCP,0.54],[LM.PINKY_MCP,0.60]]
  .forEach(([mcp,x])=>straight[mcp]=P(x,0.65));
// 每根手指沿 y 往上直直排列 → PIP 角度應該接近 180
[[LM.INDEX_MCP,LM.INDEX_PIP,LM.INDEX_DIP,LM.INDEX_TIP,0.42],
 [LM.MIDDLE_MCP,LM.MIDDLE_PIP,LM.MIDDLE_DIP,LM.MIDDLE_TIP,0.48],
 [LM.RING_MCP,LM.RING_PIP,LM.RING_DIP,LM.RING_TIP,0.54],
 [LM.PINKY_MCP,LM.PINKY_PIP,LM.PINKY_DIP,LM.PINKY_TIP,0.60]]
 .forEach(([mcp,pip,dip,tip,x])=>{
   straight[pip]=P(x,0.55); straight[dip]=P(x,0.48); straight[tip]=P(x,0.42);
 });
straight[LM.THUMB_CMC]=P(0.40,0.80); straight[LM.THUMB_MCP]=P(0.36,0.74);
straight[LM.THUMB_IP]=P(0.33,0.70);  straight[LM.THUMB_TIP]=P(0.30,0.66);

console.log('\n打直的手：');
const cs = fingerCurls(straight);
t('四指 PIP 都接近 180', cs.every(c=>c.pip>178), JSON.stringify(cs.map(c=>c.pip.toFixed(1))));
t('palmSpread 為有限值', Number.isFinite(palmSpread(straight)));
const aStraight = analyse(straight);
t('打直 → 觸發「手指太平」', aStraight.issues.some(i=>i.code==='finger-flat'),
  JSON.stringify(aStraight.issues.map(i=>i.code)));

// 3. 造一隻「手指彎曲」的手：把指尖折回靠近掌心
const curled = straight.map(p=>({...p}));
[[LM.INDEX_PIP,LM.INDEX_DIP,LM.INDEX_TIP,0.42],
 [LM.MIDDLE_PIP,LM.MIDDLE_DIP,LM.MIDDLE_TIP,0.48],
 [LM.RING_PIP,LM.RING_DIP,LM.RING_TIP,0.54],
 [LM.PINKY_PIP,LM.PINKY_DIP,LM.PINKY_TIP,0.60]]
 .forEach(([pip,dip,tip,x])=>{
   curled[pip]=P(x,0.55); curled[dip]=P(x+0.02,0.60); curled[tip]=P(x+0.03,0.65);
 });
console.log('\n彎曲的手：');
const cc = fingerCurls(curled);
t('四指 PIP 明顯小於 180', cc.every(c=>c.pip<120), JSON.stringify(cc.map(c=>c.pip.toFixed(1))));
const aCurl = analyse(curled);
t('彎曲 → 不觸發「手指太平」', !aCurl.issues.some(i=>i.code==='finger-flat'));

// 4. 拇指越頸
console.log('\n拇指越頸：');
const over = straight.map(p=>({...p}));
over[LM.THUMB_TIP]=P(0.50,0.45);   // 拇指翻到掌背側
const r1=thumbOverNeck(straight), r2=thumbOverNeck(over);
t('正常拇指 side 與越頸 side 方向相反', Math.sign(r1.side)!==Math.sign(r2.side),
  `正常=${r1.side.toFixed(3)} 越頸=${r2.side.toFixed(3)}`);

// 5. 防呆
console.log('\n防呆：');
t('關鍵點不足回傳 ok:false', analyse([]).ok===false);
t('null 不會爆', analyse(null).ok===false);

console.log(`\n通過 ${pass}，失敗 ${fail}`);
process.exit(fail?1:0);

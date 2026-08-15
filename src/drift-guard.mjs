// ─────────────────────────────────────────────────────────────────────────────
// drift-guard.mjs · 防止 standalone.html 跟 src/chroma.js 走鐘
//
// 為什麼會有兩份：
//   · src/chroma.js  —— 給 index.html 用 ES module 載入，也給 node 跑測試
//   · standalone.html —— 給 Artifact 用。CSP 禁止載入外部檔案，只能把邏輯內嵌
//
// 兩份手改遲早會不一致，而且不一致時「測試通過」會變成假的保證 ——
// 因為測試測的是 chroma.js，Mike 手機上跑的卻是 standalone.html。
// 這支就是把兩邊的和弦定義比對一次，不同就讓 npm test 失敗。
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync } from 'node:fs';
import { CHORD_TEMPLATES } from './chroma.js';

const html = readFileSync(new URL('../standalone.html', import.meta.url), 'utf8');

// 從 standalone.html 抓出內嵌的 SPEC 物件
const m = /const SPEC = \{([\s\S]*?)\};/.exec(html);
if (!m) {
  console.error('✗ 走鐘檢查：在 standalone.html 裡找不到 SPEC 定義');
  process.exit(1);
}

const inlineSpec = {};
for (const line of m[1].split('\n')) {
  const re = /'([A-G][#b]?m?)'\s*:\s*\[([0-9,\s]+)\]/g;
  let hit;
  while ((hit = re.exec(line))) {
    inlineSpec[hit[1]] = hit[2].split(',').map(s => parseInt(s.trim(), 10)).sort((a, b) => a - b);
  }
}

// chroma.js 的範本是 12 維向量，轉回音級陣列才能比
const coreSpec = {};
for (const [name, vec] of Object.entries(CHORD_TEMPLATES)) {
  coreSpec[name] = vec.map((v, i) => (v ? i : -1)).filter(i => i >= 0).sort((a, b) => a - b);
}

const problems = [];
const allNames = new Set([...Object.keys(coreSpec), ...Object.keys(inlineSpec)]);

for (const name of allNames) {
  const a = coreSpec[name];
  const b = inlineSpec[name];
  if (!a) { problems.push(`standalone.html 有 ${name}，但 chroma.js 沒有`); continue; }
  if (!b) { problems.push(`chroma.js 有 ${name}，但 standalone.html 沒有`); continue; }
  if (a.join(',') !== b.join(',')) {
    problems.push(`${name} 音級不一致：chroma.js=[${a}]  standalone.html=[${b}]`);
  }
}

if (problems.length) {
  console.error('\n✗ 走鐘檢查失敗 —— standalone.html 跟 src/chroma.js 不一致：');
  problems.forEach(p => console.error('    ' + p));
  console.error('\n  改了其中一邊，另一邊要一起改。\n');
  process.exit(1);
}

console.log(`✓ 走鐘檢查：standalone.html 與 chroma.js 的 ${allNames.size} 個和弦定義一致`);

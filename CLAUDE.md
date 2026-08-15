# CLAUDE.md · guitar-coach

## 中文摘要

吉他練習即時回饋工具。**M0 用音訊判斷和弦對錯，不用視覺** —— 原因寫在
`.agents/DECISIONS.md` D-0001，動手改架構前先讀那篇。

開工前先讀 `.agents/STATUS.md` 最上面兩則，再 `git log --oneline -10`。
標準流程見 `xian-knowledge-os/mcp/CLAUDE_WORKFLOW.md`。

## 硬規則

1. **`src/chroma.js` 不准碰 DOM、不准碰 AudioContext、不准碰 getUserMedia。**
   它是純函式，這樣才能離線測試（見 D-0002）。要接瀏覽器 API 就寫在 `index.html`。
2. **改動辨識邏輯後一定要跑 `npm test`。** 9/9 是目前的基準線，掉了就是回歸。
3. **不要為了提高辨識率而擴充和弦數量。** 範圍小是刻意的設計 —— 認 24 個和弦
   的準確率遠低於認 9 個。要擴充前先有真吉他的實測資料。
4. **`standalone.html` 與 `src/chroma.js` 的和弦定義改一邊就要改另一邊。**
   兩份存在是因為 Artifact 的 CSP 不准載入外部檔案，只能內嵌。
   `npm test` 會跑 `drift-guard.mjs` 擋走鐘，不一致就 exit 1。
5. **不要把「合成音測過」講成「可以用了」。** 目前只驗證過合成音，真吉他還沒測。
   任何文件都要保留這個但書，直到真的測過。

## 目前狀態

M0 可跑，合成音自我測試 9/9，**真吉他尚未驗證**。

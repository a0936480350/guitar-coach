# HOW-I-WORK.md · Mike's Working Style · Mike 的工作哲學

> **Read this BEFORE writing any code.** This file describes how I think and decide.
> 寫 code 前先讀這份。我怎麼想、怎麼決定。
>
> Based on 30 days of dense AI collaboration on LeadFlow.SaaS.
> 基於 LeadFlow.SaaS 30 天密集 AI 合作觀察。

---

## TL;DR · 三句話總結

1. **Ship fast, fix what users hit.** 快 ship 真用戶踩到的 bug 才修。
2. **Reject "best practice" without ROI.** 沒實際 ROI 的 best practice 拒絕。
3. **AI does 80%, I review + decide.** AI 做 80%、我 review + 決策。

---

## What I Value · 我重視什麼

### 1. Speed > Perfection · 速度勝過完美
- First version can be ugly · 第一版可以醜
- Polish only after a real user complained · polish 等真人抱怨再做
- "It works, ship it" beats "it's elegant, but..."

### 2. Direct Communication · 直接溝通
- Tell me the problem in 1 sentence · 一句話說清楚
- Don't soften with "可能..."、"或許..." · 不要 hedge
- If you don't know, say so · 不會就說不會

### 3. Concrete > Abstract · 具體勝於抽象
- Tables, code, file paths, exact commands · 表格、code、路徑、確切指令
- Show me 3 options, not philosophical discussion · 列 3 選項給我挑
- Mock data + test cases > "this would work in theory"

### 4. Self-Reliance · 自己解決
- Try the simple fix first · 先試最簡單的修
- Read the actual error before asking · 看真錯誤訊息再問
- Search existing code for patterns · 先看現有程式碼怎麼做

### 5. Honesty Over Politeness · 誠實勝過禮貌
- Don't praise me for obvious things · 不要稱讚顯而易見的事
- Tell me when I'm wrong · 我錯了就指出
- Disagree if you have data · 有數據就反駁

---

## What I Reject · 我拒絕什麼

### "Best Practice" · 沒理由的 best practice
**Example · 範例：** "We should split build/deploy into separate jobs because best practice says so."
**My reaction · 我的反應：** "What's the actual benefit for our scale? Show me numbers."

最近真實案例：CI 把 build/deploy 拆 job → 每次 push 上傳 60MB artifact →
GitHub free 2GB 配額月底爆 → CI 全紅。Best practice 變成 anti-pattern。
**Lesson · 教訓：** 任何「應該這樣做」都要問「ROI 多少？我們的規模需要嗎？」

### Over-Engineering · 過度設計
- Building for 100k users when I have 1
- Abstract base classes for one implementation
- Generic frameworks for specific use cases
- Comments explaining what code does (write clearer code instead)

### Yak-Shaving · 偏題
- "While I was fixing X, I noticed Y could be improved..."
- → No. Fix X. Note Y in `inbox`. Move on.
- 修 X 順便動 Y → 不可以。Y 寫進 inbox。

### Asking Permission · 過度請示
- For trivial changes (typo, tiny bug fix, doc update)
- → Just do it. If wrong, I'll revert.
- 小東西自己決定，做錯我會 revert。

### Long Explanations · 冗長解釋
- 5 paragraphs to say "I added a button"
- → 1 sentence: "已加按鈕 commit `abc123`. Build 0/0."

---

## How I Make Decisions · 我怎麼決策

### Process · 流程
1. **What's the user impact?** 真實用戶有沒有受影響？
2. **What's the cost?** 做這個花我 / AI 多少時間 + 錢？
3. **What's the reversibility?** 做錯能不能輕鬆 rollback？
4. **Pick the option with best ratio of impact / cost / reversibility.**

### Examples · 真實案例

**Booking 系統要不要自助預約？**
- Impact: 高（家長不用 LINE 來來回回）
- Cost: 中（5 個 tick）
- Reversibility: 中（feature flag 可關）
- → Yes, build it.

**EnrollmentReminder 要 per-tenant opt-in 嗎？**
- Impact: 低（一開始所有 tenant 預設 off 就好）
- Cost: 中（要加 schema + UI）
- → No, use single env var. 之後真有需求再做。

**Nihon-Dev → LeadFlow Lead intake 整合？**
- Impact: 低（Mike 一人公司，量小手動 5 分鐘可處理）
- Cost: 高（多兩個系統、auth、retry、監控）
- → No. 手動加。

---

## My Workflow · 我的工作流

### Daily · 日常
- Check `STATUS.md` · 看昨天 ship 了什麼
- Pick task from `inbox/` or backlog · 挑事做
- AI 做 80%，我 review、給 feedback、merge
- Self-test 5 scenarios · 5 情境自測
- Commit + push to main (no PR review for solo)

### Weekly · 每週
- Sunday morning: read all `hourly-reports/` from past week
- Decide priority for next week (3 things max)

### Monthly · 每月
- Review `DECISIONS.md` — any decisions to revisit?
- Check Azure cost dashboard
- 1-on-1 with each paying customer (if any)

---

## Communication Pattern · 溝通模式

### When AI gives me options · AI 給選項
**Format I like:**
```
A. 描述 · cost: 1hr · risk: low
B. 描述 · cost: 4hr · risk: medium
C. 描述 · cost: 0.5hr · risk: high

我建議 A，因為 ...
```

### When I push back · 我反對時
**Don't:**
- Defensively re-explain why you suggested it
- Apologize 3 times

**Do:**
- "OK, B it is. What about edge case X?"
- Move on, no ego

### When something breaks · 出錯時
**My ideal incident response:**
1. **What's broken** · 一句話說清楚
2. **Root cause** · 真正原因（不是表面）
3. **Fix** · 怎麼修
4. **Prevention** · 怎麼防止再發生

Bad: "Sorry, 我會更小心..."
Good: "Root cause: GitHub Actions 配額 14 天 retention 累積爆。改成 if: failure() + 1 day retention 永久解決。"

---

## What I'm Building · 我在做什麼

> **Update this section per project.** 這段每專案改。

**Long-term goal · 長期目標：**
One-person company, leveraged by AI. Multiple SaaS products / digital businesses,
all running with minimal human intervention except strategic decisions.

**Current focus · 目前專案：**
- LeadFlow.SaaS — multi-tenant 教務 SaaS（first paying customer 2026-04）
- Nihon-Dev — 日本 IT 求職培訓平台（pre-launch）
- DevLearn / LifeQuest / etc. — side projects

**My constraint · 我的限制：**
- Time: ~6 hours/day on coding
- Budget: bootstrapped, < NT$ 5k/month infrastructure
- No team (yet)

**My superpowers · 我的優勢：**
- 10 years music teacher background → understand SMB pain points
- 5 years Japan IT work experience → 日文 + 跨國視角
- Pragmatic engineer → ship fast, dogfood, iterate

**My weaknesses · 我的弱點：**
- Hate marketing / sales (need AI to do it)
- Hate writing long docs (which is why this template exists)
- Will rabbit-hole on tech if not held accountable

---

## When to Wake Me Up · 什麼時候找我

**AI should immediately ping me:**
- Production is down
- Real customer reported issue
- About to break Hard Rules (§1 in AGENTS.md)
- Cost spike (> NT$ 1k unexpected)

**AI should NOT ping me:**
- Routine commits / small UI fixes
- Build / test passing as expected
- Cleanup / refactor that doesn't change behavior
- Documentation updates

---

## Trust Levels · 信任層級

| Action · 動作 | AI Authority · AI 權限 |
|---|---|
| Fix typo / minor UI | Just do it · 直接做 |
| Add new endpoint / feature | Do it + STATUS.md note |
| Refactor existing code | Do it if no behavior change |
| Modify schema | RFC first · 必須先寫 RFC |
| Change auth / tenant logic | RFC + Mike's explicit OK |
| Touch prod secrets | NEVER unless Mike asks · 絕不 |
| Spend money (Azure / API) | NEVER unless Mike asks · 絕不 |

---

## Final Note · 最後

This document is alive. As I work with AI more, I'll add observations.
這份文件會一直更新，每次跟 AI 合作學到新東西就加進來。

If this doesn't match your experience working with me, **tell me** — I'll fix the doc.
如果你跟我合作的感受跟這份不一樣，跟我講，我會更新這份。

---

**Last updated · 最後更新：** Template v1.0 · 2026-05

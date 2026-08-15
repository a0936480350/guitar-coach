# plans/ · One-off Task Plans · 一次性任務計畫

## When to write a plan · 何時寫 plan

When a task spans **multiple sessions** or **multiple AI agents** AND
needs coordination beyond a single commit.

跨多 session、需要協調的任務（不是單一 commit 能完成的）。

## 中文摘要

`plans/` 放的是跨多個 session 或多個 AI agent、需要協調的一次性任務計畫
（例如模組重構、多階段 feature、客訴處理 SOP、第三方審核流程），單一 commit
能搞定的事不用寫 plan。格式固定：狀態/建立時間/背景/目標/步驟/過程決策/
卡點/驗收標準。生命週期：開工時建立、每完成一步就更新、完成後標記 Done 並
移到資料夾底部、除非還有參考價值否則 3 個月後刪除。

## What goes here · 應該放什麼

- **Migration cleanup** · 重構某模組
- **Multi-step feature rollout** · 多階段 feature
- **Customer support handle** · 處理客訴的 SOP
- **Vendor approval process** · 第三方審核流程（綠界 / Apple Developer 等）

## Format · 格式

File name: `<short-slug>.md` (lowercase, dash-separated)

```markdown
# <Plan title>

- **Status · 狀態：** in progress / blocked / done / cancelled
- **Created · 建立：** YYYY-MM-DD
- **Last updated · 最後更新：** YYYY-MM-DD

## Context · 背景
<Why this plan exists, 1-2 paragraphs>

## Goals · 目標
- [ ] specific item 1
- [ ] specific item 2

## Steps · 步驟
1. ...
2. ...

## Decisions made · 過程中的決策
- YYYY-MM-DD: <decision> → see DECISIONS.md

## Blockers · 卡住的事
- <waiting for X / Mike to decide Y>

## Verification · 驗收
- [ ] <how we know it's done>
```

## Lifecycle · 生命週期

1. **Create** when work starts
2. **Update** as steps complete
3. **Mark Done** + move to bottom of folder when finished
4. **Delete** after 3 months unless still useful as reference

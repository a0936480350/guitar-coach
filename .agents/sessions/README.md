# sessions/ · Past AI Session Summaries · 過去 AI Session 摘要

## Why · 為什麼

When an AI session is about to be **compacted** (long conversation getting truncated),
or when handing off between AI agents, write a session summary here.

長對話即將被壓縮、或 AI 之間交接時，把摘要寫到這。

## 中文摘要

`sessions/` 放的是 AI session 即將被壓縮（長對話快被截斷）或 AI 之間交接時
寫的摘要，內容固定：這個 session 的 agent/時長/結果、進來時已知的脈絡、
做了什麼（commit 清單）、做了什麼決策、還有什麼遺留事項、下次接手要知道什麼。
什麼時候該寫：context 快被壓縮前、換另一個 AI 接手前、要暫停超過 3 天前；
短而專注的 session 不用麻煩寫這個，commit + STATUS.md 就夠了。

## Format · 格式

File name: `YYYY-MM-DD-HHMM-<topic>.md`

```markdown
# Session: YYYY-MM-DD <topic>

- **Agent · AI：** Claude / Codex
- **Duration · 時長：** ~N hours
- **Outcome · 結果：** what shipped

## Context entering this session · 進入時的脈絡
<What I knew at start>

## What was done · 做了什麼
- commit 1: ...
- commit 2: ...

## Decisions made · 決策
- ...

## Loose ends · 遺留事項
- <unresolved>

## For next session · 下次接手時要知道
- <important context>
```

## When to write · 何時寫

- ✅ Before context compaction (Claude warns about it)
- ✅ Before switching to other AI
- ✅ Before long pause (> 3 days)
- ❌ Don't bother for short focused sessions (just commit + STATUS.md is enough)

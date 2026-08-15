# hourly-reports/ · Cron-based Hourly Snapshots · 每小時自動報告

## Purpose · 用途

When AI runs autopilot for hours, send Mike an hourly summary email + commit
to this folder.

AI 自動跑時，每小時寄信 + commit 到這資料夾，讓 Mike 不在電腦前也能掌握。

## File naming · 檔名

`YYYY-MM-DD-HHMM.md` — UTC timestamp.

## Content template · 內容模板

```markdown
# Hourly report · YYYY-MM-DD HH:MM

## Time window · 時段
HH-1:00 — HH:00

## Commits this hour · 本小時 commits
- `<sha>` <author> · <subject>

## Main status · main 狀態
HEAD: `<sha>` · sync with origin: yes/no · Azure deploy: green/red

## What I'm doing · 正在做什麼
<one paragraph>

## Blockers · 卡住
<none / waiting for X>

## Need decision from Mike · 需要 Mike 決策
<none / Mike 看到時請看 X 並回覆 Y>
```

## Implementation · 實作

See `prompts/hourly-report.md` for the full automated prompt template.
完整 cron prompt 模板見 `prompts/hourly-report.md`。

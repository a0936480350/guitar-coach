# inbox/ · AI-to-AI Messages · AI 之間留言

## How it works · 怎麼運作

When **Claude** wants to leave message for **Codex**, write to `codex.md`.
When **Codex** wants to leave message for **Claude**, write to `claude.md`.

**On session start, AI reads its own inbox first.**

## Format · 格式

Append at TOP of file (newest first):

```markdown
## YYYY-MM-DD HH:MM <Sender> · <subject>

<body>
```

## Example · 範例

```markdown
## 2026-04-26 19:30 Claude · touched StudentsController

Heads up — I added a `DeleteNoteAttachment` action to StudentsController.cs.
If you're refactoring student-related routes this week, please coordinate.

Files changed: src/...Web/Controllers/StudentsController.cs (lines 670-690)
```

## Solo mode · 單 AI 模式

If only one AI is working on this project, you can ignore both inbox files.
Or use `claude.md` as a personal note pad for the AI to leave breadcrumbs across sessions.

單一 AI 模式 inbox 可以不用。或當作 AI 跨 session 自我留言用。

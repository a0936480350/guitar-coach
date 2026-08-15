# rfc/ · Design Proposals · 重大設計提案

## When to write an RFC · 何時寫 RFC

When the change is **big** or **irreversible**, write an RFC BEFORE coding.

**中文摘要**：改動「大」或「不可逆」時，動手寫 code 之前要先寫 RFC——例如
新增 entity、動到正式環境的 schema migration、跨領域的共用邏輯、API 破壞性
變更、大改 UX、加新的外部依賴。單純 bug fix、只加欄位、加新 endpoint（不動
既有的）、行為不變的 UI 微調則不需要。格式固定：狀態/作者/建立時間/背景/
決策/後果/替代方案/未決問題。生命週期是 Draft → 審核 → Accepted →
實作……→（有需要時）被新 RFC 取代；一旦 Accepted 就要當作綁定規範，之後要
改就開新 RFC 取代舊的，不要偷偷改舊的。

| Trigger · 觸發條件 | Example · 範例 |
|---|---|
| New entity / table | Adding `Booking` model |
| Schema migration touching production | New column with NOT NULL |
| Cross-cutting concerns | Multi-tenant access pattern |
| API breaking change | Removing endpoint, changing JSON shape |
| Major UX redesign | New nav structure |
| New external dependency | Add Stripe / Twilio integration |

## When NOT to write RFC · 何時不需要 RFC

Skip RFC for:

- Bug fixes
- Adding fields to existing entities (additive only)
- New endpoints that don't break existing
- UI polish / refactor with same behavior

不寫 RFC 的：純 bug fix / 加新欄位 / 加新 endpoint / UI 微調。

---

## Format · 格式

File name: `NNNN-short-name.md` (4-digit number, increment each)

```markdown
# RFC NNNN · <Title>

- **Status · 狀態：** Draft / Accepted / Rejected / Superseded by RFC-XXXX
- **Author · 作者：** Claude / Codex / Mike
- **Created · 建立：** YYYY-MM-DD

## Context · 背景
<Why this RFC, 2-3 paragraphs>

## Decision · 決策
<What we're choosing>

## Consequences · 後果
- For users: ...
- For data: ...
- For team: ...

## Alternatives considered · 考慮過的替代方案
- A: ... (rejected because ...)
- B: ... (rejected because ...)

## Open Questions · 未決問題
- Q1: ...
- Q2: ...
```

---

## Status Lifecycle · 生命週期

```
Draft → (review) → Accepted → (implementation) → ... → (eventually) Superseded
```

Once Accepted, treat it as binding — code MUST follow it. If circumstance changes,
**create a new RFC** that supersedes the old, don't silently change the old.

接受後即綁定，要改 → 新 RFC supersedes 舊的，**不要靜默修改舊 RFC**。

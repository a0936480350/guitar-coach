# GLOSSARY.md · Vocabulary Reference · 名詞表

> **Why this file · 為什麼：**
> Avoid AI synonym drift. 避免 AI 換詞造成意義漂移。
> If "tenant" sometimes becomes "customer" in code/docs, search/replace breaks.
> 同一個概念換不同詞 = bug 溫床。
>
> **Rule · 規則：** Once a term is here, ALL of code + docs use exactly this term.
> 詞一旦定在這 · 所有 code + docs 必須用一樣的字。

---

## How to use · 怎麼用

When AI introduces a new term, it MUST add it here BEFORE using in code.
AI 引進新名詞前，必須先寫進這份表才能用在 code 裡。

When you see two synonyms for same concept in code, it's a bug — pick one and refactor.
看到同個概念有兩個說法 = bug，選一個 refactor。

---

## Format · 格式

```markdown
### `<TermInCode>` · 中文名 · alternative names

- **Definition · 定義：** <one sentence>
- **Where it appears · 出現在哪：** entity / table / UI label / etc.
- **Common confusion · 易混淆：** <what people might mistake it for>
```

---

## Example · 範例

### `Tenant` · 教室 · studio / organization / org

- **Definition · 定義：** 一家獨立教室，是 multi-tenant 隔離的最頂層單位
- **Where it appears · 出現在哪：** Entity `Tenant`, FK `TenantId`, ITenantContext, AuditLog.TenantId
- **Common confusion · 易混淆：**
  - ❌ "studio" — UI 顯示用 studio 但 code / DB 一律 Tenant
  - ❌ "organization" — 不要用，太抽象
  - ❌ "company" — 不要用，跟商業實體混淆

### `Enrollment` · 套餐 · package / subscription / membership

- **Definition · 定義：** 學生買的課程點數包，含起訖日 + 總/剩堂數 + Status
- **Where it appears · 出現在哪：** `Enrollment` entity, `EnrollmentHistoryEntry` audit
- **Common confusion · 易混淆：**
  - ❌ "Subscription" — `Subscription` 是付費訂閱（金流，月費），跟 Enrollment 不同
  - ❌ "Plan" — `Plan` 是 SaaS 方案層級（free/pro/enterprise）

### `ClassSession` · 一堂課 · class / session / lesson

- **Definition · 定義：** 單一上課實例，有起迄時間、老師、學生（或 group）
- **Where it appears · 出現在哪：** `ClassSession` entity, `Attendance` 對應
- **Common confusion · 易混淆：**
  - ❌ "Class" — 太籠統，可指「班級」也可指「一堂課」
  - ❌ "Lesson" — 不要用，跟 LearningNote 容易混

---

## Project-specific terms · 此專案專有名詞

> Add yours here. Delete the LeadFlow examples above when you bring your own.

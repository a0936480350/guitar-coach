# AGENTS.md · AI Collaboration Rules · AI 協作規則

> **PROJECT: `<PROJECT_NAME>`** — replace this placeholder.
>
> **Read this file every session.** It governs how Claude / Codex / Mike
> collaborate on this repository. 每次 session 必讀這份。

---

## 0. Roles · 三方角色

| Agent | Role · 角色 | Authority · 權限 |
|---|---|---|
| **Mike** | Human owner · Product owner | Sole merge authority · 唯一 merge 決策者 |
| **Claude** | AI · 主開發 architect + UX | Write code/docs, ship to main · NOT merge other AI's PR |
| **Codex** | AI · 副開發 reviewer + narrative | Same as Claude · 相同權限 |

**Cross-boundary rule · 越界規則：**
Before touching the other AI's primary domain, leave a message in
`inbox/<other-ai>.md`. 越界前必須在對方 inbox 留言。

---

## 1. Hard Rules · 絕對鐵律（違反 = revert）

**Any change touching the following MUST go through `DECISIONS.md`
or `rfc/` first — NEVER write code blindly:**

- DB schema · EF migration · entity 結構
- `ITenantContext` / cross-service 共用 interface
- Names defined in `GLOSSARY.md`
- Tenant isolation logic (Query Filter, middleware)
- Authentication / authorization logic
- Production env vars / secrets
- `LeadFlow:PlatformAdminEmails` whitelist 等 access control config

**任何上述改動必須先在 `DECISIONS.md` 或 `rfc/` 立案，不得直接 commit。**

---

## 2. Self-Test 5 Scenarios · 5 情境自測（每個 commit 必過）

Before claiming "done", verify the change passes ALL of:

1. **Mobile · 手機**
   Open `/your-page` in Chrome DevTools mobile preview (375px width).
   No horizontal scroll. No content cut off. Buttons reachable with thumb.

2. **Empty state · 空資料**
   Test with zero rows in the relevant table.
   No NPE. No "undefined" text. Helpful empty message.

3. **Extreme · 極限**
   Long names (200 chars). Many rows (1000+). Special chars (中文 / emoji 🎵 / `<script>`).
   No SQL/HTML injection. Pagination works.

4. **Flash message · Flash 訊息**
   Trigger TempData["FlashMessage"] from POST.
   Banner shows after redirect. Disappears on next request.

5. **Error path · 錯誤路徑**
   Forced exception. Network timeout. Concurrent edit.
   Returns user-friendly message (NOT 500 page).
   Logs proper context for debug.

**Commit message MUST include:** `已自測：<scenarios>` line listing which 5 you ran.

---

## 3. Session Lifecycle · Session 標準流程

### On start · 開工時（按順序執行）
1. `git pull origin main` — sync first
2. `git log --oneline -10` — see what changed since last session
3. Read `.agents/STATUS.md` (top section · most recent)
4. Read `.agents/inbox/<your-name>.md` — messages waiting for you
5. Pick task: (a) reply to inbox, (b) continue WIP, (c) pull from STATUS backlog

### During work · 工作中
- Small commits (< 200 LOC each)
- Conventional commit format (see §5)
- Run build + test BEFORE commit (`dotnet build` + `dotnet test`)
- If touching Hard Rules (§1) → STOP, write RFC first

### On finish · 收工時
1. Push to `origin main` (or PR if branch policy)
2. Update `.agents/STATUS.md` — add new section at TOP
3. If you blocked on something the other AI knows, leave message in `inbox/<other-ai>.md`
4. (Optional) Hourly report: `python autopilot-hourly-report.py` if cron exists

---

## 4. Communication Channels · 溝通管道

| Channel | Purpose · 用途 | Example |
|---|---|---|
| `inbox/claude.md` | Codex → Claude messages | "I touched X, please review" |
| `inbox/codex.md` | Claude → Codex messages | "Avoid Y, conflicts with Z" |
| `STATUS.md` | Both AIs + Mike timeline | What shipped today |
| `DECISIONS.md` | Long-term decisions | Why we chose A over B |
| `rfc/` | Major design proposals | Multi-tenant approach |
| `plans/` | One-off task plans | Migration cleanup |
| `sessions/` | AI session summaries | Pre-compaction recap |
| `hourly-reports/` | Cron output to Mike | What ran in last hour |

---

## 5. Commit Format · Commit 格式

**Conventional commits + 自測標記：**

```
feat(scope): 一句話 summary

詳細描述（可選 · 多行）
- 改了什麼
- 為什麼

已自測：mobile / empty / extreme / flash / error
```

**Common scopes:** `feat` / `fix` / `chore` / `docs` / `test` / `refactor` / `style` / `perf`

**Hard rules · 鐵律：**
- ❌ Never `--no-verify` (skip pre-commit hooks)
- ❌ Never `--amend` after push
- ❌ Never `git reset --hard origin/main` to throw work away — always `git stash` first
- ❌ Never `git push --force` to main without Mike's explicit OK
- ✅ Small commits beat one big commit
- ✅ commit message 寫中文 OK，但 conventional 前綴 + scope 用英文

---

## 6. Git Workflow · Git 工作流

**Branch model · 分支模型：** **Trunk-based** (everything to `main`).

Rationale · 為什麼：solo 一人公司沒人 review，feature branch 只是延後 merge 的痛苦。
Small commits + good test coverage > long-lived feature branches.

**Exception · 例外：** Big risky migration / breaking schema change → branch first, ship in one PR.

---

## 7. Test Coverage · 測試要求

**Required · 必測：**
- Multi-tenant isolation (cross-tenant leak test)
- Auth / authorization paths
- Money flow (subscription, refund, plan change)
- Audit log writes
- Background workers (idempotency, error recovery)

**Nice to have · 加分：**
- E2E happy path for major user flows
- Integration tests for new features

**測試永遠不能 skip 跑。Build + test 都綠才能 push。**

---

## 8. What you should NEVER do · 千萬別做

- ❌ Touch production env vars / secrets without explicit ask
- ❌ Auto-create new accounts on user's behalf
- ❌ Run `Remove-Item` / `rm -rf` on anything outside this repo
- ❌ Push to other repos without Mike asking
- ❌ Modify other AI's plans (`.agents/inbox/<other>.md`) silently
- ❌ Skip self-test scenarios because "I'm sure"
- ❌ Leave WIP without updating STATUS.md
- ❌ Use "best practice" as sole reason for adding complexity (Mike rejects this)

---

## 9. Communication Style with Mike · 跟 Mike 溝通方式

Mike speaks Mandarin (繁體中文 · Taiwan). Match his style:

- **Direct, no fluff** · 直接、不要客套
- **Specific over abstract** · 具體勝於抽象
- **Show options, not opinions only** · 列選項給他挑，不要單方面決定
- **Acknowledge limits honestly** · 不會就說不會，不要假裝
- **Use tables, bullets, code blocks** · 結構化表達

He hates:
- 場面話 / 客套話
- "Best practice" without justification
- Asking for permission too often (just do it if low risk)
- Long-winded explanations when one sentence suffices

He loves:
- Speed
- "已 ship + Build 0/0 + tests 綠"
- Honest failure reports with root cause
- Pragmatic shortcuts that save time

---

## 10. Project-Specific Rules · 此專案特殊規則

> Add project-specific rules here. Examples below. Delete what doesn't apply.

- [ ] Tech stack: .NET 8 / Node 18 / Python 3.12 / etc.
- [ ] Database: PostgreSQL / MSSQL / MongoDB / etc.
- [ ] Hosting: Azure App Service / Vercel / Cloudflare Workers
- [ ] CI/CD: GitHub Actions (see `.github/workflows/`)
- [ ] Multi-tenant: Yes / No (if yes, see Hard Rule 1)
- [ ] Plan tier: Free / Pro / Enterprise (if SaaS)
- [ ] Payment: ECPay / Stripe / N/A
- [ ] Region: Asia/Taipei (UTC+8)

---

**Last updated · 最後更新：** Template v1.0 · 2026-05

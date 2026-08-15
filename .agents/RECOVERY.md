# RECOVERY.md · Disaster Recovery Manual · 災難復原手冊

> **核心命題：所有真實記憶在 GitHub repo 裡。**
> Core invariant: All real memory lives in the GitHub repo.
> Laptop dies → new laptop → `git clone` → continue.

## 中文摘要

這是災難復原手冊範本，列出 10 種常見的「出事」情境跟對應的處理步驟：
筆電硬碟壞掉（重灌+clone+讀 `.agents/` 記憶）、build 環境壞掉、AI session
失憶（照順序讀 AGENTS/HOW-I-WORK/STATUS/inbox + git log 就能恢復）、正式
環境掛掉（確認範圍→快速 rollback→通知→事後檢討）、GitHub 帳號遺失、資料庫
損毀、其中一個 AI 掛掉換另一個接手、雲端帳單爆炸。最後附上救命指令速查
（git stash、reset --hard、reflog 救回刪掉的 commit 等）跟最後一道保險
（本機 clone + GitHub repo + 雲端備份 + 密碼實體備份，建議每季演練一次）。
每個專案要自己填第 0 節的「關鍵資產位置」表。

---

## 0. Critical Asset Locations · 關鍵資產位置

> **Update this per-project · 每專案改這段**

| Asset · 資產 | Location · 位置 | Loss impact · 遺失後果 |
|---|---|---|
| **Source repo · 程式碼** | https://github.com/<user>/<project> | 🔥 Project death |
| **Local clone · 本機 clone** | `C:\Users\<user>\Documents\<project>` | Unpushed work lost |
| **Secrets · 密碼 / API keys** | Bitwarden / 1Password vault | Re-issue required |
| **Database backups · DB 備份** | Azure auto-backup (7 days) + manual `pg_dump` weekly | Data loss > backup window |
| **Cloud backup · 雲端備份** | Email to self + Google Drive (3rd line) | Last resort |
| **AI conversation logs · AI 對話紀錄** | None — assume lost | Re-build from .agents/ docs |

---

## 1. Scenario · Laptop hard drive dies · 電腦硬碟壞掉

### New machine setup · 新電腦設置（30-60 min）

```powershell
# Windows
winget install Microsoft.DotNet.SDK.8       # if .NET project
winget install OpenJS.NodeJS                # if Node project
winget install Docker.DockerDesktop         # if using Docker
winget install Git.Git
winget install Microsoft.VisualStudioCode
winget install GitHub.cli

# Login
gh auth login

# Clone
cd C:\Users\<user>\Documents
git clone https://github.com/<user>/<project>.git
cd <project>

# Read AI memory
cat .agents/AGENTS.md
cat .agents/HOW-I-WORK.md
cat .agents/STATUS.md       # Look at top — what was last shipped
```

### Restore secrets · 還原 secrets

1. Open Bitwarden / 1Password
2. Search project name
3. Copy connection strings, API keys
4. Paste into:
   - Local: `dotnet user-secrets set ...` or `.env.local`
   - GitHub: Settings → Secrets and variables → Actions
   - Azure: App Service → Configuration → Application settings

---

## 2. Scenario · Build environment broken · 環境壞了

### .NET project

```powershell
# Clean
git clean -fdx
dotnet restore
dotnet build

# If migration error
dotnet ef database update --project src/<Infra> --startup-project src/<Web>
```

### Node project

```bash
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Generic

```bash
# Try the most aggressive reset
git clean -fdx           # remove all untracked
git reset --hard origin/main   # reset to remote
# Then rebuild
```

---

## 3. Scenario · AI session "forgot" everything · AI 失憶

This happens when context window is exhausted or a new session starts.

**Recovery procedure for AI:**
1. Read `.agents/AGENTS.md` (rules)
2. Read `.agents/HOW-I-WORK.md` (style)
3. Read `.agents/STATUS.md` top 3 sections (recent work)
4. Read `.agents/inbox/<your-name>.md` (waiting messages)
5. `git log --oneline -10` (recent commits)

After 5 min, AI should be back to full operating context.

---

## 4. Scenario · Production is down · 線上掛了

### Incident response · 處理流程

1. **Confirm scope · 確認範圍**
   - All users? · Specific feature?
   - When did it start? · `git log` since last successful deploy

2. **Quick rollback · 快速 rollback**
   ```bash
   # Find last good commit
   git log --oneline | head -20

   # Revert
   git revert <bad-sha> --no-edit
   git push origin main
   # Auto-deploy re-runs and pushes good version
   ```

3. **Or roll back specific tag · 或回特定 tag**
   ```bash
   git checkout <last-good-tag> -- src/  # restore specific files
   git commit -m "fix: emergency rollback to <tag>"
   git push origin main
   ```

4. **Communicate · 告知**
   - Status page / banner if has one
   - LINE / Email customers if appropriate
   - Update `.agents/STATUS.md` with incident note

5. **Post-mortem · 事後分析**
   - Root cause in `.agents/DECISIONS.md`
   - Prevention added to `.agents/AGENTS.md` if rule needed

---

## 5. Scenario · Lost GitHub access · GitHub 帳號丟

1. Account recovery: https://github.com/account_recovery
2. If 2FA backup codes lost: support@github.com (3-7 days response)
3. **Worst case:** create new account, restore from local clones (work continues)

**Prevention:**
- 2FA enabled with backup codes printed/stored offline
- SSH keys backed up encrypted in cloud
- Project ownership: solo dev = no shared admin (single point of failure)

---

## 6. Scenario · Database corrupted · DB 損毀

### Azure Database for PostgreSQL Flexible

1. Portal → Database → Backups → Restore to point-in-time
2. Choose timestamp before corruption
3. Test new instance → swap connection string → done

### Manual `pg_dump` recovery

```bash
# If you have a recent pg_dump
psql -h <host> -U <user> -d <new_db> < backup.dump
```

---

## 7. Scenario · One AI session fails / hangs · AI 服務掛點

If working with multiple AIs (Claude + Codex):

1. Switch to other AI
2. Tell them: "Other AI is offline, please pick up from `.agents/STATUS.md`"
3. They take over. Mark commits with `(on-behalf-of-claude)` or similar.
4. Original AI back: read `sessions/` to catch up.

---

## 8. Scenario · Cost explosion · 雲端帳單爆炸

### Quick check · 快速檢查

```bash
# Azure
az consumption usage list --start-date 2026-04-01 --end-date 2026-04-30 \
  --query "[].{Service:meterCategory, Cost:pretaxCost}" -o table

# Or web: portal.azure.com → Cost Management → Cost analysis
```

### Common causes · 常見原因

- App Service auto-scale ran wild (set max instances)
- DB tier auto-upgrade (set firmly to specific tier)
- Storage / egress unexpected (CDN cache miss storm)
- API key leaked → bots calling OpenAI / Gemini

### Mitigation · 緩解

1. Identify spike service
2. Cap: set Cost Management Budget Alert immediately
3. Rotate any leaked secrets
4. Move to free / cheaper tier if possible

---

## 9. Quick Commands Reference · 救命指令速查

```bash
# Backup local untracked work
git stash push -u -m "emergency backup $(date +%Y%m%d)"

# Force clean to known good state
git fetch origin
git reset --hard origin/main
git clean -fdx

# Recover deleted commit
git reflog                              # find sha
git checkout <sha>                      # back to that point
git checkout -b recovery/<topic>        # branch from there

# Check last successful deploy
git log --oneline --grep="release\|deploy"

# Find what changed since last good
git diff <last-good-sha>..HEAD -- src/
```

---

## 10. Final Backups · 最後一道保險

If everything fails, there should still be:

1. **Local clones** on your laptops · 各台筆電的 clone
2. **GitHub repo** (private but persistent) · GitHub repo
3. **Cloud copy** of `.agents/` folder zipped to Drive monthly · `.agents/` 月備份雲端
4. **Printed copy of Bitwarden master password** in a safe place ·  printed 主密碼

Test recovery quarterly. 每季演練一次。

---

**Last updated · 最後更新：** Template v1.0 · 2026-05

---
name: commit
description: Commit and push changes to GitHub. Use whenever the user says "commit", "push", "save progress", "checkpoint", "lock this in", or asks to commit their work. Also use after completing a feature when the user wants to preserve their progress.
---

# Commit & Push

Commit completed work to Git and optionally push to GitHub. This skill groups changes into logical commits by feature area, writes clear commit messages, and ensures nothing sensitive gets committed.

## Step 1: Assess the situation

Run these in parallel:

```bash
git status
git diff --stat
git diff --cached --stat
git log --oneline -5
```

Understand what's changed, what's staged, and the recent commit message style.

## Step 2: Group changes

Look at the modified/untracked files and group them by feature area. Common groupings for this project:

- **Auth** — `src/lib/auth/`, `src/app/[locale]/auth/`, `src/contexts/AuthContext.tsx`
- **Listings** — `src/lib/listings/`, `src/app/[locale]/sell/`, `src/lib/bgg/`
- **Browse** — `src/components/layout/`, `src/components/listings/`, `src/app/[locale]/browse/`, `src/app/[locale]/listings/`
- **Checkout & Payments** — `src/lib/services/everypay/`, `src/lib/services/unisend/`, `src/lib/services/orders.ts`, `src/app/[locale]/checkout/`, `src/app/[locale]/orders/`, `src/app/api/payments/`
- **Config** — `.claude/`, `memory/`, `tailwind.config.ts`, `src/lib/env.ts`
- **Database** — `supabase/migrations/`

If all changes belong to a single feature, make one commit. If they span multiple features, make separate commits in dependency order (e.g., database before the code that uses it).

## Step 3: Safety checks

Before staging, verify:

1. `.env.local` is NOT being committed (check `.gitignore`)
2. No files with credentials, API keys, or tokens are staged
3. No `node_modules/`, `.next/`, or other build artifacts are included

If any sensitive files appear in `git status`, warn the user and skip them.

## Step 4: Commit

Stage files by name (never `git add -A` or `git add .`) and commit with a conventional commit message:

```
<type>: <short description of what changed and why>
```

Types: `feat` (new feature), `fix` (bug fix), `chore` (config, deps, tooling), `refactor`, `test`, `docs`

Keep the message to one line when possible. If the change is substantial, add a blank line and a brief body.

Example messages for this project:
- `feat: auth system — signup, signin, OAuth, forgot password, route protection`
- `feat: listing creation — BGG game search, multi-step sell flow, photo upload`
- `fix: validate photo URLs against storage origin in createListing`
- `chore: claude config — permissions, PostToolUse hooks, stg standards check`

## Step 5: Push

After committing, push to the remote:

```bash
git push origin main
```

If the remote isn't set up yet or push fails:
- Check `git remote -v` to verify the remote exists
- If no remote, tell the user to add one
- If push is rejected (diverged history), tell the user — never force push

## Step 6: Confirm

Show the user what was committed and pushed:

```bash
git log --oneline -5
```

Report: how many commits, which feature areas, and whether the push succeeded.

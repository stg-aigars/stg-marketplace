---
name: deploy
description: Deploy STG marketplace to Hetzner via Coolify with pre-flight checks. Use when the user says "deploy", "ship it", "push to production", or "go live". This skill assumes code is already committed — use /commit first if there are uncommitted changes.
---

# Deploy to Production

This skill handles the deploy gate and verification. It assumes code is already committed to main via `/commit`. If there are uncommitted changes, tell the user to run `/commit` first.

Coolify auto-deploys from `main` via GitHub webhook. The deploy flow is: push to main → Coolify detects → Docker build → container swap.

## Step 1: Pre-flight checks

Run in parallel:

```bash
git status
pnpm build
```

- If there are uncommitted changes, stop and tell the user to `/commit` first
- If build fails, fix all errors before proceeding (ESLint, TypeScript, missing deps)
- Build passing is the deploy gate — nothing ships without it

## Step 2: Verify remote is up to date

```bash
git log origin/main..HEAD --oneline
```

If there are local commits not yet pushed, push them:

```bash
git push origin main
```

## Step 3: Verify deployment

Coolify auto-deploys on push to `main`. After pushing:

1. Tell the user to check the Coolify dashboard for build status
   - Build takes ~3-5 minutes on the Hetzner VPS
   - Look for green "Running" status in Coolify
2. Verify the health endpoint:
```bash
curl -s https://secondturn.games/api/health
```
3. Tell the user to verify core flows at the production URL

## Rollback

If something goes wrong after deploy:

```bash
git revert HEAD
git push origin main
```

This creates a new commit that undoes the last change. Coolify will auto-deploy the revert (requires a fresh build, ~3-5 min).

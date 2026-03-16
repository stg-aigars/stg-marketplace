---
name: Deployment
description: Hetzner VPS + Coolify deployment, staging→main branch model, pre-deploy gate, rollback
type: project
---

## Branch Model

- **Develop on `staging`** — all day-to-day work happens here
- **Production from `main`** — Coolify auto-deploys when main is pushed (GitHub webhook)
- Merge: `git checkout main && git merge staging --ff-only && git push origin main`
- Always switch back to staging after deploying

## Pre-Deploy Gate

`pnpm build` is the real gate — catches ESLint errors, TypeScript errors, and missing translations. `pnpm type-check` alone is NOT sufficient (misses ESLint and build-time issues).

## Deploy Sequence

1. `pnpm build` — fix any errors
2. `git add <specific-files>` — never `git add -A` (risks committing .env, credentials)
3. `git commit` + `git push origin staging`
4. `git checkout main && git merge staging --ff-only && git push origin main`
5. `git checkout staging`
6. Coolify auto-builds and deploys (~3-5 min)
7. Verify at https://secondturn.games

## Infrastructure

- **Server:** Hetzner CX23 (2 vCPU, 4 GB RAM) in Helsinki
- **PaaS:** Coolify (self-hosted, Docker-based)
- **SSL:** Let's Encrypt via Coolify/Traefik
- **Health check:** `/api/health`

## Rollback

```bash
git checkout main
git revert HEAD
git push origin main
git checkout staging
```
Coolify triggers a new build from the reverted state.

## NEXT_PUBLIC_ vars require redeploy

`NEXT_PUBLIC_APP_URL` and other `NEXT_PUBLIC_` vars are baked into the client JS bundle at build time. Changing them requires a full redeploy (not just restart).

## External Integrations

| Service | Purpose | Key Files |
|---------|---------|-----------|
| Supabase | DB, Auth, Storage | `lib/supabase/` |
| EveryPay | Card + bank payments | `lib/services/everypay/` |
| Resend | Transactional emails | `lib/email/` |
| Unisend | Parcel locker shipping | `lib/services/unisend/` |
| BGG API | Game metadata + images | `lib/bgg/` |

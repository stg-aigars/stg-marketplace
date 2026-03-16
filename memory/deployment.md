---
name: Deployment
description: Vercel deployment workflow, staging→main branch model, pre-deploy gate, rollback procedure
type: project
---

## Branch Model

- **Develop on `staging`** — all day-to-day work happens here
- **Production from `main`** — Vercel deploys when main is pushed
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
6. Verify at production URL

## Rollback

```bash
git checkout main
git revert HEAD
git push origin main
git checkout staging
```

## External Integrations

| Service | Purpose | Key Files |
|---------|---------|-----------|
| Supabase | DB, Auth, Storage | `lib/supabase/` |
| EveryPay | Card + bank payments | `lib/everypay/` |
| Resend | Transactional emails | `lib/email/` |
| Unisend | Parcel locker shipping | `lib/unisend/` |
| BGG API | Game metadata + images | `lib/bgg/` |
| Maplibre | Terminal selector maps | `components/ui/map/` |
| Turnstile | Bot protection | `lib/security/` |
| Sentry | Error monitoring | `instrumentation-client.ts` |

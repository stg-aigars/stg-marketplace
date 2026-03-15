---
name: deploy
description: Deploy STG marketplace to Vercel with pre-flight checks
---

# Deploy to Production

## Pre-flight Checks

1. Run the production build (the real gate):
```bash
pnpm build
```

2. If build fails, fix all errors before proceeding. Common issues:
   - ESLint errors (unused imports, missing deps)
   - TypeScript errors
   - Missing translations

3. Check git status — ensure no unwanted files:
```bash
git status
```

## Deploy Sequence

1. Stage and commit changes:
```bash
# Stage specific files — NEVER use `git add -A` (risks committing .env, credentials, binaries)
git add <specific-files>
git commit -m "your commit message"
git push origin staging
```

2. Merge staging into main (fast-forward):
```bash
git checkout main
git merge staging --ff-only
git push origin main
```

3. Switch back to staging:
```bash
git checkout staging
```

4. Verify deployment at Vercel dashboard or production URL.

## Rollback

If something goes wrong after deploy:
```bash
# Revert the merge on main
git checkout main
git revert HEAD
git push origin main
git checkout staging
```

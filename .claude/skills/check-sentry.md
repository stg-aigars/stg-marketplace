---
name: check-sentry
description: Fetch and triage Sentry errors for the STG marketplace. Use when the user says "check sentry", "any sentry issues", "check errors", "check production errors", or "what's breaking".
---

# Check Sentry Issues

Fetch unresolved issues from Sentry, analyze them, and either fix or filter them.

## Step 1: Fetch the auth token

Read the `SENTRY_AUTH_TOKEN` from `.env.local`:

```bash
grep SENTRY_AUTH_TOKEN .env.local
```

## Step 2: Fetch unresolved issues

```bash
curl -s -H "Authorization: Bearer <token>" \
  "https://sentry.io/api/0/projects/second-turn-games/stg-marketplace/issues/?query=is:unresolved&sort=date" \
  | python3 -m json.tool
```

Note the issue count, titles, culprits, and event counts. If there are no unresolved issues, report that and stop.

## Step 3: Fetch event details for each issue

For each unresolved issue, fetch the latest event:

```bash
curl -s -H "Authorization: Bearer <token>" \
  "https://sentry.io/api/0/organizations/second-turn-games/issues/<issue_id>/events/latest/" \
  | python3 -m json.tool
```

Extract from the response:
- Exception type and message
- Stack trace frames (focus on `inApp: true` frames)
- Tags: browser, OS, URL where it happened
- User context if available

## Step 4: Classify each issue

For each issue, classify as one of:

| Classification | Criteria | Action |
|---|---|---|
| **App bug** | Stack trace has `inApp: true` frames in our code | Fix the code |
| **Browser extension noise** | All frames are `inApp: false`, DOM manipulation errors like `removeChild`/`insertBefore` | Add to `ignoreErrors` in `sentry.client.config.ts` |
| **Infrastructure** | Network errors, timeouts, 5xx from external APIs | Note for monitoring, may need retry logic |
| **Known Next.js issue** | Hydration mismatches, `NEXT_NOT_FOUND`, chunk load errors | Add to `ignoreErrors` or `beforeSend` filter |

## Step 5: Take action

For **app bugs**:
1. Read the relevant source files from the stack trace
2. Identify the root cause
3. Propose a fix
4. After fixing, run `pnpm build` and `pnpm test` to verify

For **noise/known issues**:
1. Add the error message pattern to `ignoreErrors` in `sentry.client.config.ts`
2. Or add a `beforeSend` filter if the pattern needs type-level matching

For **infrastructure issues**:
1. Report to the user with context
2. Suggest retry/fallback logic if appropriate

## Step 6: Report

Present a summary table:

```
| # | Issue | Events | Classification | Action |
|---|-------|--------|---------------|--------|
| 1 | ...   | ...    | ...           | ...    |
```

## Reference

- Sentry project: `second-turn-games/stg-marketplace`
- Client config: `sentry.client.config.ts`
- Server config: `sentry.server.config.ts`
- Error boundaries: `src/components/errors/ErrorFallback.tsx`

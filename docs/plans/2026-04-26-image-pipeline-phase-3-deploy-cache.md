# Image Pipeline Phase 3 — Stop Discarding Image-Optimization Cache on Every Deploy

> **For Claude:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task.

**Goal:** Stop nuking `/_next/image` cache on every deploy — both at the Cloudflare edge AND at the container origin. The current setup forces 100% cache-miss rate on the first wave of post-deploy traffic, spiking CPU on Hetzner CX23's 2 vCPUs and degrading p95 response time across all routes that share the runtime.

**Architecture:** Two halves, both surgical. (1) Mount a Coolify persistent volume at `/app/.next/cache/images` so container restarts preserve the on-VPS image-transform cache. (2) Stop the post-deploy Cloudflare purge entirely — content-hashed `/_next/static/*` filenames make invalidation unnecessary, and dropping the purge lets `/_next/image` keep its 1-day edge TTL through deploys.

**Tech Stack:** Coolify dashboard config (no repo file), `scripts/purge-cloudflare-cache.sh` (delete), `docs/cloudflare-cache-purge-setup.md` (rewrite). No new packages, no code changes to the app itself.

---

## Why this matters (read before coding)

The audit at [docs/audits/image-pipeline-audit-2026-04-25.md](../audits/image-pipeline-audit-2026-04-25.md) §2.2 documents two findings that compound:

- **F-6** [scripts/purge-cloudflare-cache.sh](../../scripts/purge-cloudflare-cache.sh) calls `purge_everything: true` on every deploy. Cloudflare's `/_next/image` cache rule is Edge TTL 1 day — but every deploy resets it.
- **F-7** [Dockerfile](../../Dockerfile) declares no persistent volume for `.next/cache/images`. **Verified 2026-04-26** by inspecting the production Coolify Persistent Storage panel: `No storage found.` Container restart wipes the cache.

Combined effect: every deploy → 100% cache-miss rate → Hetzner re-transforms every visible image from scratch on the first wave of traffic.

## Why drop the purge entirely (not narrow it)

[docs/cloudflare-cache-purge-setup.md](../../docs/cloudflare-cache-purge-setup.md) and the Cloudflare Cache Rules dashboard (verified 2026-04-26) confirm only two patterns are cache-eligible at the edge:

| Priority | Match | Action |
|---:|---|---|
| 1 | `/_next/static/` | Eligible, Edge TTL 1y |
| 2 | `/_next/image` | Eligible, Edge TTL 1d |
| 3 | All incoming requests | Bypass cache |

The post-deploy purge exists to clear stale `/_next/static/*`. But Next.js content-hashes those filenames (`abc123.js` etc.). After a deploy:
- Old hashes are no longer referenced by any HTML (HTML bypasses cache, always fresh).
- Old cached chunks become unreachable; they sit in Cloudflare's cache until 1y TTL expires or LRU evicts them. No correctness impact.
- New hashes are fetched fresh on first request and cached normally.

Conclusion: the purge is solving a non-problem for `/_next/static/*` while actively harming `/_next/image/*`. Dropping it entirely is the right call.

A conservative alternative — narrowing the purge to `/_next/static/*` via `purge_files` with explicit URL enumeration from the build manifest — was considered and rejected. It preserves intent that doesn't actually need preserving and adds operational complexity (build-manifest parsing, URL list generation) for zero functional benefit.

## What this plan deliberately does NOT do

- Doesn't touch any Next.js / app code.
- Doesn't modify Cloudflare Cache Rules — the existing 3 rules stay as-is.
- Doesn't address F-9 (AVIF in Next defaults), F-10 (OG images), F-12 (`deviceSizes`) — separate findings, separate phases.
- Doesn't address audit Phase 4 (format normalization) or Phase 5 (avatar polish).
- Doesn't add monitoring / alerting on cache hit rate.

---

## Implementation tasks

### Task 0: Create the feature branch
```bash
git checkout main
git pull --ff-only
git checkout -b feature/image-pipeline-phase-3-deploy-cache
```

### Task 1: User adds the Coolify persistent volume

**Manual user action — Claude cannot do this (it's a Coolify dashboard change, outside the repo).**

In the Coolify dashboard:
1. Open: Projects → stg-marketplace → production → the Next.js application
2. Sidebar: **Persistent Storage**
3. Click **+ Add**
4. Mount type: **Volume** (not Bind Mount)
5. Source / Name: `nextjs-image-cache` (any unique name; this is the named volume Docker manages)
6. Destination Path: `/app/.next/cache/images`
7. Save

Do NOT redeploy yet — the next task removes the post-deploy purge command, and we want both changes live in the same deploy cycle.

After saving, confirm by inspecting: the Storages list should show one entry with destination `/app/.next/cache/images`.

### Task 2: User removes the Coolify post-deploy command

**Manual user action — Claude cannot do this.**

In the same Coolify application's Configuration:
1. Sidebar: Look for **General** or **Build / Deploy** section
2. Find **Post Deployment Command** (per `docs/cloudflare-cache-purge-setup.md` step 3, this is set to `bash scripts/purge-cloudflare-cache.sh`)
3. Clear the field — leave it empty

This stops Coolify from invoking the purge script on future deploys. The script file in the repo will be deleted in Task 3 below; clearing the Coolify command first means no broken command between this PR landing and the next deploy.

### Task 3: Delete the purge script

```bash
git rm scripts/purge-cloudflare-cache.sh
```

Verify only this file is removed: `git status --short` should show 1 D entry (no others).

### Task 4: Rewrite the Cloudflare doc

The existing [docs/cloudflare-cache-purge-setup.md](../../docs/cloudflare-cache-purge-setup.md) describes a setup that's about to no longer be true. Rewrite it to reflect the new state:

- Document the 3 active Cache Rules (unchanged from current).
- Explain WHY no post-deploy purge runs: content-hashed `/_next/static/*` doesn't need invalidation; `/_next/image` benefits from preserving its 1-day TTL across deploys.
- Document the persistent-volume requirement at `/app/.next/cache/images` so it survives any future Coolify migration / re-provision.
- Remove the "Post Deployment Command" section (now empty).
- Remove the `CLOUDFLARE_*` env-var section (no longer used).

Suggested section structure:

```markdown
# Cloudflare Cache + Image Optimization Setup

## Cache Rules (Cloudflare dashboard)

[3-row table, unchanged from current]

**Critical:** Never add SSR page paths to cache-eligible rules. (Existing warning, keep.)

## Why no post-deploy purge

[2-paragraph explanation: content-hashing means /_next/static doesn't need invalidation;
 image cache survives = no Hetzner CPU spike post-deploy.]

## Persistent volume requirement

[Coolify-side: `nextjs-image-cache` volume mounted at /app/.next/cache/images.
 Why: container restarts otherwise wipe the image transform cache, defeating the
 point of the 30-day minimumCacheTTL set in next.config.mjs.]
```

Keep the doc tight — full content sketched in Task 4 should fit in ~40 lines.

### Task 5: Build/lint/type-check gate

```bash
pnpm verify
```

Should be a no-op (we only deleted a shell script and rewrote markdown — neither affects type-check / lint / test / build). Run it anyway. If anything fails, the failure is unrelated to this PR; investigate before continuing.

### Task 6: Commit

```bash
git add scripts/purge-cloudflare-cache.sh docs/cloudflare-cache-purge-setup.md
git status --short
# Expect: 1 D (purge script), 1 M (cloudflare doc). No others.
git commit -m "$(cat <<'EOF'
perf(deploy): stop nuking /_next/image cache on every deploy

Phase 3 of the image-pipeline audit. Two coordinated changes:

1. Coolify: persistent volume at /app/.next/cache/images so container
   restarts preserve the image-transform cache across deploys.
2. Repo: delete scripts/purge-cloudflare-cache.sh and clear Coolify's
   Post Deployment Command. The purge existed to invalidate stale
   /_next/static/* after deploys, but those filenames are
   content-hashed by Next.js and don't need invalidation. Dropping it
   lets /_next/image keep its 1-day edge TTL through deploys.

Combined effect: post-deploy traffic no longer triggers full
re-transform on Hetzner CX23's 2 vCPUs. Browse-page p95 should stop
spiking after every deploy.

Audit: docs/audits/image-pipeline-audit-2026-04-25.md §2.2 F-6 + F-7.

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

### Task 7: Push and open PR

```bash
git push -u origin feature/image-pipeline-phase-3-deploy-cache
gh pr create --title "perf(deploy): stop nuking /_next/image cache on every deploy" --body "..."
```

PR body must surface:
- The Coolify-side changes (volume + cleared Post Deployment Command) that landed BEFORE the PR was opened
- Why dropping the purge entirely is correct (content-hashing argument)
- The conservative alternative (narrow to `/_next/static/*` via `purge_files`) and why it was rejected
- Test plan: deploy, verify cache hit rate, verify volume persists across container restarts

### Task 8: Post-merge verification

After merge → Coolify auto-deploys → verify the change worked. Steps:

1. **Confirm volume mounted on running container.** SSH to the Hetzner box, find the marketplace container ID, run `docker inspect <id> --format '{{json .Mounts}}' | jq` and look for an entry with `Destination: "/app/.next/cache/images"`.
2. **Confirm purge stopped firing.** Tail the deploy log in Coolify; "Purging Cloudflare cache..." line should be absent.
3. **Confirm Cloudflare image cache survives a deploy.** Visit a listing detail page (loads `/_next/image?url=https%3A%2F%2Ftfxqbtcdkzdwfgsivvet.supabase.co%2F...`) on production. In a private/incognito window, hit it again immediately and check Cloudflare DevTools `cf-cache-status` response header — should be `HIT` (or `MISS` then `HIT` on second request). Trigger a small unrelated deploy. Re-visit the same listing detail. `cf-cache-status` should still be `HIT` (no `EXPIRED` or `MISS` from the deploy).
4. **Confirm container cache persists across restart.** From Coolify dashboard, "Restart" the application. After restart, visit a listing detail. Check the response time — should be fast (cached transform from the volume), not the slow re-transform you'd see if the volume were ephemeral.

If verification (3) fails — Cloudflare image cache shows `MISS` after the unrelated deploy — that means Cloudflare wasn't actually keeping the cache through deploys (something other than `purge_everything` is invalidating it). Investigate before celebrating.

If verification (4) fails — container cache empty after restart — the volume mount isn't actually persisting. Check Coolify's Persistent Storage panel for the volume entry; SSH and `docker volume ls | grep nextjs-image-cache`.

---

## Verification checklist before marking complete

- [ ] User confirmed Coolify Persistent Storage shows the new volume entry (Task 1)
- [ ] User confirmed Coolify Post Deployment Command is empty (Task 2)
- [ ] `pnpm verify` passes (Task 5) — no new errors
- [ ] PR opened and URL surfaced
- [ ] Post-merge: docker inspect shows volume mounted (Task 8.1)
- [ ] Post-merge: deploy log no longer mentions Cloudflare purge (Task 8.2)
- [ ] Post-merge: `cf-cache-status: HIT` survives a deploy (Task 8.3)
- [ ] Post-merge: container cache survives a restart (Task 8.4)

## Follow-ups this PR explicitly does not handle

- **`CLOUDFLARE_ZONE_ID` / `CLOUDFLARE_API_TOKEN` env vars** in Coolify: now unused. Can be deleted from Coolify env config, or left in place (cheap insurance if we ever want manual purge ability via the Cloudflare API). User's call; not a blocker either way.
- **Bitwarden entry for the Cloudflare API token**: same. Can rotate/revoke since it's no longer auto-used, or leave for manual emergency use.
- **Monitoring on `cf-cache-status` hit rate**: would be useful for confirming the change continues to deliver value over time. Out of Phase 3's scope. Worth a separate small ticket if we ever instrument PostHog or similar with edge metrics.
- **Audit Phase 4** (format normalization on upload) — independent, can be next.
- **Audit Phase 5** (avatar pipeline + perceived-load polish) — independent, lowest priority.

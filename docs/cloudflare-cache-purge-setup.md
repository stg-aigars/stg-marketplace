# Cloudflare Cache + Image Optimization Setup

The site is on Cloudflare's free plan with the orange cloud (proxy) enabled. Edge caching is restricted to Next.js's hashed-filename outputs; everything else bypasses the edge entirely.

## Cache Rules (Cloudflare dashboard)

These rules live in the Cloudflare dashboard under Caching → Cache Rules. They are not managed in code.

| Priority | Name | Match | Action |
|---:|---|---|---|
| 1 | Cache Next.js static assets | URI Path starts with `/_next/static/` | Eligible, Edge TTL 1 year |
| 2 | Cache Next.js images | URI Path starts with `/_next/image` | Eligible, Edge TTL 1 day |
| 3 | Bypass everything else | All incoming requests | Bypass cache |

**Critical:** Never add SSR page paths (e.g. `/browse`, `/listings/`, `/`, locale-prefixed `/en/...`) to cache-eligible rules. We hit this regression once where a cached `/browse` page served stale listings to users while the homepage showed the same listing as removed — the two pages were cached at different points in time.

**Rule 3 is load-bearing.** [next.config.mjs](../next.config.mjs) emits `Cache-Control: public, s-maxage=60, stale-while-revalidate=300` on `/browse`, `/listings`, `/sellers`, `/wanted`, and the homepage — these origin headers advertise those routes as edge-cacheable. Rule 3 ("Bypass everything else") is the active guard that overrides them and prevents Cloudflare from actually caching SSR responses. Removing or reordering Rule 3 (e.g. thinking it's redundant now that the rules above it cover what we want cached) silently re-introduces the regression described in the warning above.

## Why no post-deploy cache purge runs

Coolify's Post Deployment Command for the production application is intentionally empty. Both cache-eligible patterns above handle invalidation correctly without an explicit purge:

- **`/_next/static/*`** filenames are content-hashed by Next.js (e.g. `chunks/abc123.js`). After a deploy, fresh HTML references new hashes which are fetched on first request; old cached chunks become unreachable and eventually expire (1y TTL) or get evicted by Cloudflare's LRU. No correctness issue, no manual intervention needed.
- **`/_next/image*`** transforms are stable for the lifetime of the source asset. A deploy doesn't change what `/_next/image?url=...&w=2048&q=75` should resolve to. Letting the 1-day edge TTL run undisturbed across deploys saves a CPU spike on the Hetzner CX23 origin (image transforms are CPU-heavy; the previous full-purge setup forced 100% cache-miss rate on the first wave of post-deploy traffic).

Earlier setups invoked `purge_everything: true` after every deploy — first via a `scripts/purge-cloudflare-cache.sh` repo script (later removed), then via an inline Coolify Post Deployment Command (cleared 2026-04-26 as part of the Phase 3 image-pipeline work). See [docs/audits/image-pipeline-audit-2026-04-25.md](audits/image-pipeline-audit-2026-04-25.md) §2.2 F-6.

## Persistent volume requirement

The production container mounts a Coolify-managed Docker volume named `nextjs-image-cache` at `/app/.next/cache/images` so the Next.js image-optimization cache survives container restarts and redeploys. Without this volume, every container restart wipes the on-VPS transform cache, defeating the 30-day `minimumCacheTTL` set in [next.config.mjs](../next.config.mjs).

Configured in Coolify dashboard: Projects → stg-marketplace → production → the Next.js app → Persistent Storage → one entry, name `nextjs-image-cache`, destination `/app/.next/cache/images`.

## Verifying the setup is intact

Run these checks periodically (or after any Cloudflare dashboard / Coolify change) to confirm the layered behavior holds:

```bash
# 1. SSR routes must bypass the edge cache (otherwise the stale-listing regression returns).
curl -sI https://secondturn.games/browse | grep -i cf-cache-status
# Expect: cf-cache-status: BYPASS  (or "DYNAMIC" — both indicate not-cached)

# 2. /_next/image* must be cacheable (this is what Phase 3's volume + no-purge protects).
curl -sI 'https://secondturn.games/_next/image?url=%2Ficons%2Ficon-192.png&w=256&q=75' | grep -i cf-cache-status
# Expect: cf-cache-status: HIT (warm cache) or MISS (first cold request) — never BYPASS.

# 3. Persistent volume actually mounted on the container (run on the Hetzner box).
docker volume ls | grep nextjs-image-cache
# Expect: one line of output naming the volume.
```

If (1) returns `HIT`/`MISS` instead of `BYPASS`/`DYNAMIC`, Cache Rule 3 has been removed or reordered — restore it before the next deploy. If (2) returns `BYPASS`, Cache Rule 2 has been removed — restore it. If (3) returns nothing, the persistent volume has been deleted — re-create it via the Coolify dashboard before the next container restart.

## Optional: emergency manual purge

The Cloudflare API token + zone ID are configured as runtime env vars in Coolify (`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ZONE_ID`, set 2026-03-31 — values stored in Bitwarden under "Cloudflare"). They're no longer used by the deploy pipeline but remain available for ad-hoc emergency purges.

**Prefer the narrow prefix-based purge** — preserves cache for everything outside the offending path:

```bash
# Cloudflare's free plan supports prefix-based purge. Format: hostname/path (no scheme).
curl -sf -X POST "https://api.cloudflare.com/client/v4/zones/${CLOUDFLARE_ZONE_ID}/purge_cache" \
  -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
  -H "Content-Type: application/json" \
  --data '{"prefixes":["secondturn.games/_next/image"]}'
```

**Nuclear option** — only if a prefix purge isn't sufficient. Re-triggers the post-deploy CPU spike Phase 3 was designed to eliminate:

```bash
curl -sf -X POST "https://api.cloudflare.com/client/v4/zones/${CLOUDFLARE_ZONE_ID}/purge_cache" \
  -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
  -H "Content-Type: application/json" \
  --data '{"purge_everything":true}'
```

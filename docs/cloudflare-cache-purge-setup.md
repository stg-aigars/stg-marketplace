# Cloudflare Cache + Image Optimization Setup

The site is on Cloudflare's free plan with the orange cloud (proxy) enabled. Edge caching is restricted to Next.js's hashed-filename outputs; everything else bypasses the edge entirely.

## Cache Rules (Cloudflare dashboard)

These rules live in the Cloudflare dashboard under Caching → Cache Rules. They are not managed in code.

| Priority | Name | Match | Action |
|---:|---|---|---|
| 1 | Cache Next.js static assets | URI Path starts with `/_next/static/` | Eligible, Edge TTL 1 year |
| 2 | Cache Next.js images | URI Path starts with `/_next/image` | Eligible, Edge TTL 1 day |
| 3 | Bypass everything else | All incoming requests | Bypass cache |

**Critical:** Never add SSR page paths (e.g. `/browse`, `/listings/`, `/`) to cache-eligible rules. We hit this regression once where a cached `/browse` page served stale listings to users while the homepage showed the same listing as removed — the two pages were cached at different points in time.

## Why no post-deploy cache purge runs

Coolify's Post Deployment Command for the production application is intentionally empty. Both cache-eligible patterns above handle invalidation correctly without an explicit purge:

- **`/_next/static/*`** filenames are content-hashed by Next.js (e.g. `chunks/abc123.js`). After a deploy, fresh HTML references new hashes which are fetched on first request; old cached chunks become unreachable and eventually expire (1y TTL) or get evicted by Cloudflare's LRU. No correctness issue, no manual intervention needed.
- **`/_next/image*`** transforms are stable for the lifetime of the source asset. A deploy doesn't change what `/_next/image?url=...&w=2048&q=75` should resolve to. Letting the 1-day edge TTL run undisturbed across deploys saves a CPU spike on the Hetzner CX23 origin (image transforms are CPU-heavy; the previous full-purge setup forced 100% cache-miss rate on the first wave of post-deploy traffic).

Earlier setups invoked `purge_everything: true` after every deploy — first via a `scripts/purge-cloudflare-cache.sh` repo script (later removed), then via an inline Coolify Post Deployment Command (cleared 2026-04-26 as part of the Phase 3 image-pipeline work). See [docs/audits/image-pipeline-audit-2026-04-25.md](audits/image-pipeline-audit-2026-04-25.md) §2.2 F-6.

## Persistent volume requirement

The production container must mount a Coolify-managed Docker volume at `/app/.next/cache/images` so the Next.js image-optimization cache survives container restarts and redeploys. Without this volume, every container restart wipes the on-VPS transform cache, defeating the 30-day `minimumCacheTTL` set in [next.config.mjs](../next.config.mjs).

Configured in Coolify dashboard: Projects → stg-marketplace → production → the Next.js app → Persistent Storage → one entry with destination `/app/.next/cache/images`.

## Optional: emergency manual purge

If a stale-cache emergency ever needs a manual purge, the Cloudflare API token + zone ID can be set as runtime env vars in Coolify (`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ZONE_ID`) and the purge fired ad-hoc via:

```bash
curl -sf -X POST "https://api.cloudflare.com/client/v4/zones/${CLOUDFLARE_ZONE_ID}/purge_cache" \
  -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
  -H "Content-Type: application/json" \
  --data '{"purge_everything":true}'
```

Use sparingly — purging `/_next/image*` triggers the cache-miss CPU spike Phase 3 was meant to eliminate.

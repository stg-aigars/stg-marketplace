# Cloudflare Cache + Image Optimization Setup

Edge caching is restricted to Next.js's hashed-filename outputs; everything else bypasses the edge entirely. The site is on Cloudflare's Free plan, which constrains the available cache-purge mechanisms (see Emergency manual purge below).

## Cache Rules (Cloudflare dashboard)

These rules live in the Cloudflare dashboard under Caching → Cache Rules. They are not managed in code.

| Priority | Name | Match | Action |
|---:|---|---|---|
| 1 | Cache Next.js static assets | URI Path starts with `/_next/static/` | Eligible, Edge TTL 1 year |
| 2 | Cache Next.js images | URI Path starts with `/_next/image` | Eligible, Edge TTL 1 day |
| 3 | Bypass everything else | NOT (URI Path starts with `/_next/static/` OR `/_next/image`) | Bypass cache |

**Critical:** Never add SSR page paths (e.g. `/browse`, `/listings/`, `/`, locale-prefixed `/en/...`) to cache-eligible rules. We hit this regression once where a cached `/browse` page served stale listings to users while the homepage showed the same listing as removed — the two pages were cached at different points in time.

**Rule 3's match expression must NEGATE the cacheable patterns above.** Cloudflare's Cache Rules engine does NOT use first-match-wins semantics. Multiple rules can match the same request, and each rule's `set_cache_settings` action mutates the request's cache configuration in evaluation order — **later mutations override earlier ones**. If Rule 3 matched "All incoming requests" (Global), it would fire AFTER Rules 1 and 2 for `/_next/static/*` and `/_next/image*` requests, and its `bypass cache` action would silently override their `eligible for cache` settings. Net result: 0% cache hit rate on the assets we want cached, with no error or warning — `cf-cache-status: DYNAMIC` instead of `HIT`. The rule's expression must therefore exclude what Rules 1 and 2 already cover:

```
not (starts_with(http.request.uri.path, "/_next/static/") or starts_with(http.request.uri.path, "/_next/image"))
```

**Rule 3 is also load-bearing for SSR routes.** [next.config.mjs](../next.config.mjs) emits `Cache-Control: public, s-maxage=60, stale-while-revalidate=300` on `/browse`, `/listings`, `/sellers`, `/wanted`, and the homepage — these origin headers advertise those routes as edge-cacheable. Rule 3 (now scoped to "everything except cacheable Next.js assets") is the active guard that overrides them and prevents Cloudflare from caching SSR responses. Removing it would re-introduce the stale-listing regression described above for the SSR routes.

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
#    Use a locale-prefixed path — next.config.mjs only emits the public s-maxage header
#    on /:locale(en|lv)/... routes; bare /browse hits a redirect first and would false-green.
curl -sI https://secondturn.games/en/browse | grep -i cf-cache-status
# Expect: cf-cache-status: DYNAMIC  (Rule 3 bypasses; SSR responses are not edge-cached)

# 2. /_next/image* must be cacheable (this is what Phase 3's volume + no-purge protects).
curl -sI 'https://secondturn.games/_next/image?url=%2Ficons%2Ficon-192.png&w=256&q=75' | grep -i cf-cache-status
# Expect: cf-cache-status: MISS on first request, then HIT on subsequent requests within the
# 1-day edge TTL. If you see DYNAMIC instead, Rule 2 isn't being applied — most likely Rule 3
# is matching too broadly (its expression must NEGATE /_next/static/ and /_next/image).

# 3. Persistent volume actually mounted on the container (run on the Hetzner box).
docker volume ls | grep nextjs-image-cache
# Expect: one line of output naming the volume.
```

If (1) returns `HIT`/`MISS` instead of `DYNAMIC`, Cache Rule 3 has been removed — restore it (with the negated expression). If (2) returns `DYNAMIC` after multiple requests, Cache Rule 2 either isn't matching OR Rule 3's expression is too broad and overriding it (see "Rule 3's match expression must NEGATE the cacheable patterns" above). If (3) returns nothing, the persistent volume has been deleted — re-create it via the Coolify dashboard before the next container restart.

## Optional: emergency manual purge

The Cloudflare API token + zone ID are configured as runtime env vars in Coolify (`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ZONE_ID`, set 2026-03-31 — values stored in Bitwarden under "Cloudflare"). They're no longer used by the deploy pipeline but remain available for ad-hoc emergency purges.

Free-plan zones only support two purge modes: by exact URL list, or `purge_everything`. Prefix / hostname / tag-based purges require Enterprise. So the operational ladder is:

**Prefer URL-list purge** when you know the specific stale URLs (up to 30 per request on Free):

```bash
curl -sf -X POST "https://api.cloudflare.com/client/v4/zones/${CLOUDFLARE_ZONE_ID}/purge_cache" \
  -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
  -H "Content-Type: application/json" \
  --data '{"files":["https://secondturn.games/_next/image?url=%2Fpath%2Fto%2Fimage&w=2048&q=75"]}'
```

This is most useful when a specific image got cached wrong (e.g., a listing photo was replaced and the transform URL is serving the old bytes). Construct the exact `/_next/image?...` URL that needs purging.

**Nuclear option** — when scope is too broad to enumerate. Re-triggers the post-deploy CPU spike Phase 3 was designed to eliminate:

```bash
curl -sf -X POST "https://api.cloudflare.com/client/v4/zones/${CLOUDFLARE_ZONE_ID}/purge_cache" \
  -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
  -H "Content-Type: application/json" \
  --data '{"purge_everything":true}'
```

# Cloudflare Cache Purge Setup

After enabling Cloudflare proxy (orange cloud), SSR pages and HTML can get cached at the edge. This causes stale content after deploys. The setup below ensures the cache is purged on every deploy.

## 1. Create a Cloudflare API Token

1. Go to Cloudflare dashboard > My Profile > API Tokens
2. Click "Create Token"
3. Use "Custom token" template
4. Permissions: **Zone > Cache Purge > Purge**
5. Zone Resources: **Include > Specific zone > secondturn.games**
6. Create and copy the token

## 2. Add Environment Variables in Coolify

Add these as **runtime** environment variables (not build-time):

| Variable | Value | Notes |
|----------|-------|-------|
| `CLOUDFLARE_ZONE_ID` | Zone ID from Cloudflare dashboard overview page | 32-char hex string |
| `CLOUDFLARE_API_TOKEN` | Token created in step 1 | Starts with a random string |

## 3. Configure Post Deployment Command

In Coolify, set the **Post Deployment Command** to:

```
bash scripts/purge-cloudflare-cache.sh
```

The script exits gracefully (exit 0) if the env vars are not set, so it won't break deploys in environments without Cloudflare.

## Cloudflare Cache Rules (Dashboard)

These rules are configured manually in the Cloudflare dashboard under Caching > Cache Rules. They are not managed in code.

| Priority | Name | Match | Action |
|----------|------|-------|--------|
| 1 | Cache Next.js static assets | URI Path starts with `/_next/static/` | Eligible for cache, Edge TTL 1 year |
| 2 | Cache Next.js images | URI Path starts with `/_next/image` | Eligible for cache, Edge TTL 1 day |
| 3 | Bypass everything else | All incoming requests | Bypass cache |

**Warning:** Never add SSR page paths (like `/browse`, `/game/`, `/en/`) to cache-eligible rules. This caused stale listings being served to users where one auction listing was completely missing from the browse page but visible on the homepage because the two pages were cached at different times.

## How It Works Together

1. **Cache-Control headers** (in `next.config.mjs`): Origin tells Cloudflare not to cache HTML/API responses (`no-cache, no-store, must-revalidate`), while static assets get `immutable` with a 1-year max-age.
2. **Cache Rules** (in Cloudflare dashboard): Explicitly bypass caching for everything except `/_next/static/` and `/_next/image`.
3. **Post-deploy purge** (this script): Purges the entire edge cache after each deploy so any stale static assets referencing old chunk hashes are cleared.

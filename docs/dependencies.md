# STG Dependencies & Services

> Single source of truth for all external services, tools, and accounts powering Second Turn Games.
> Store credentials in Bitwarden. Each entry below notes what to save.

---

## Infrastructure

| Service | Purpose | Tier | Credentials to store |
|---------|---------|------|---------------------|
| **Hetzner** | VPS hosting (CX23, Helsinki HEL1) | €3.49/mo | Account login, server IP (37.27.24.207), SSH key |
| **Coolify** | Docker-based deployment platform (self-hosted on Hetzner) | Self-hosted (free) | Admin login, `.env` backup, `docker-compose.yml` backup |
| **Supabase** | Database (Postgres), auth, file storage, RLS | Free tier | Project URL, anon key, service role key, dashboard login |

## Payments

| Service | Purpose | Tier | Credentials to store |
|---------|---------|------|---------------------|
| **EveryPay** (Swedbank) | Payment processing — hosted payment page, callbacks | — | API username, API secret, account name, gateway URL, dashboard login |

## Shipping

| Service | Purpose | Tier | Credentials to store |
|---------|---------|------|---------------------|
| **Unisend** | Terminal-to-terminal parcel shipping (LV/LT/EE cross-border) | — | Username, password, API base URL, dashboard login |

## Email

| Service | Purpose | Tier | Credentials to store |
|---------|---------|------|---------------------|
| **Resend** | Transactional emails (order confirmation, shipping, seller notifications) | Free tier | API key, sending domain, from email, dashboard login |

## External APIs

| Service | Purpose | Tier | Credentials to store |
|---------|---------|------|---------------------|
| **BoardGameGeek** (BGG) | Game search, metadata, images, player counts — XML API v2 | Free | API token |

## Domain & DNS

| Service | Purpose | Tier | Credentials to store |
|---------|---------|------|---------------------|
| **Cloudflare** | DNS + proxy for secondturn.games (full proxy / orange cloud since 2026-03-31 — edge bot management sets `cf_clearance` on user browsers; cache rules configured in dashboard, post-deploy purge script `scripts/purge-cloudflare-cache.sh`) | Free | Account login, domain config |

## Auth

| Service | Purpose | Tier | Credentials to store |
|---------|---------|------|---------------------|
| **Google Cloud** | OAuth provider for "Continue with Google" sign-in | Free | Client ID, client secret, project name, console login |

## Monitoring

| Service | Purpose | Tier | Credentials to store |
|---------|---------|------|---------------------|
| **Sentry** | Error tracking (live — used by `global-error.tsx`, EveryPay client, dispute service; PII scrubbing in `src/lib/sentry/strip-pii.ts`) | — | DSN, auth token, dashboard login |
| **Cloudflare Turnstile** | Bot protection, invisible mode (live — wraps signup, password reset, newsletter, comments, checkout, bids, listing create/edit/remove via `TurnstileWidget` in `src/components/ui`) | Free | Site key, secret key |

## Analytics

| Service | Purpose | Tier | Credentials to store |
|---------|---------|------|---------------------|
| **PostHog** (Cloud EU) | Product analytics: funnels, pageviews, custom events. Frankfurt region. | Free up to 1M events/month | Project API key (`phc_*`), project ID, dashboard login, region = EU |

## Dev Tools

| Service | Purpose | Credentials to store |
|---------|---------|---------------------|
| **GitHub** | Source code (stg-aigars/stg-marketplace) | Account login, Coolify GitHub App |
| **Bitwarden** | Password manager for all credentials | Master password (store offline) |

---

## Environment Variables Checklist

All env vars live in Coolify (all marked "Available at Buildtime") and are defined in `src/lib/env.ts`. If the server dies, you need these to redeploy:

**Supabase**
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

**EveryPay**
- `EVERYPAY_API_URL`
- `EVERYPAY_API_USERNAME`
- `EVERYPAY_API_SECRET`
- `EVERYPAY_ACCOUNT_NAME`

**Unisend**
- `UNISEND_API_URL`
- `UNISEND_USERNAME`
- `UNISEND_PASSWORD`

**Email**
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`

**App**
- `NEXT_PUBLIC_APP_URL`
- `CRON_SECRET`

**BGG**
- `BGG_API_TOKEN`

**PostHog** (Analytics, optional — feature no-ops if unset)
- `NEXT_PUBLIC_POSTHOG_KEY`
- `POSTHOG_HOST` (server-only, defaults to `https://eu.i.posthog.com`)

---

## Disaster Recovery Notes

If the Hetzner VPS dies completely:

1. Spin up new CX23 VPS on Hetzner (Helsinki HEL1 region)
2. Add swap, install Coolify
3. Connect GitHub repo via GitHub App
4. Restore all env vars from Bitwarden
5. Deploy — app is live on new IP
6. Update DNS A records in Cloudflare to point to new IP
7. Coolify auto-provisions SSL via Let's Encrypt

Full recovery time: ~1 hour. See `docs/operations-guide.md` for detailed steps.

**What lives only on the server:** Coolify config, Docker state, build cache. None critical — a fresh deploy from GitHub + env vars restores everything.

**What survives independently:** Supabase (database + auth + storage), EveryPay (payment history), Unisend (shipping records), Resend (email logs), GitHub (all code).

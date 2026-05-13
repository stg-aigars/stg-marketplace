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
| **Swedbank AS** (LV, reg. 40003074764) with EveryPay AS (EE, reg. 12280690) as technical provider | Payment processing — hosted payment page, callbacks | — | API username, API secret, account name, gateway URL, dashboard login |

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
| **Cloudflare** | DNS + proxy for secondturn.games (full proxy / orange cloud since 2026-03-31 — edge bot management sets `cf_clearance` on user browsers; cache rules configured in dashboard, no post-deploy purge — content-hashed `/_next/static` and 1-day-TTL `/_next/image` handle invalidation naturally; see [docs/cloudflare-cache-purge-setup.md](cloudflare-cache-purge-setup.md)) | Free | Account login, domain config; API token + zone ID (Bitwarden "Cloudflare"; Coolify env `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ZONE_ID`) |

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

## Build Pipeline

GitHub Actions builds production Docker images and pushes them to GHCR; Coolify pulls the image and runs it. The VPS never builds — eliminates the OOM risk that surfaced during PR C deploy (2026-05-13, see `docs/operations/deployment-state-audit-2026-05-12.md` §8).

**Flow (push to main → site live, fully automated):**

1. Push to main → `.github/workflows/build-and-push.yml` fires automatically
2. GHA builds `Dockerfile` (~3 min on `ubuntu-latest` with layer cache)
3. Image pushed to `ghcr.io/stg-aigars/stg-marketplace:<commit-sha>` AND `:latest`
4. GHA's final step calls Coolify deploy API (`GET /api/v1/deploy?uuid=<app-uuid>`) → Coolify pulls the new image, swaps containers (rolling restart, no downtime)
5. Total time from merge: ~4–5 min, **no human-in-the-loop required for routine deploys**

| Layer | Service | Notes |
|---|---|---|
| Source | GitHub repo `stg-aigars/stg-marketplace` | Push to main auto-triggers GHA |
| Build | GitHub Actions (`ubuntu-latest`, ~7 GB RAM) | Workflow: `.github/workflows/build-and-push.yml` |
| Registry | GHCR (`ghcr.io/stg-aigars/stg-marketplace`) | Tags: per-commit `<sha>` (immutable) + `:latest` (rolling) |
| Deploy trigger | Coolify deploy API call (GHA workflow's final step) | Bearer-authenticated; queues a Coolify deployment |
| Deploy | Coolify "Docker Image" type application (UUID `h5craypnckp5yt8v1cwcvi3r`) | Pulls + runs; no build step on VPS |

**Credentials inventory:**

| Credential | Owner / location | Used by | Rotation |
|---|---|---|---|
| GHCR PAT (`coolify-ghcr-pull`) | User's personal GitHub account, scope `read:packages`, stored in Bitwarden | Coolify (via `docker login ghcr.io -u stg-aigars` cached at `/root/.docker/config.json` on the VPS) | **Expires 2027-05-13**; rotate annually |
| Coolify API token (`claude-automation`) | Coolify dashboard → Keys & Tokens → API tokens, scope `root`, stored in Bitwarden | Two consumers: (1) Claude Code (Bearer auth for operational work against `http://37.27.24.207:8000/api/v1`), (2) `build-and-push.yml` workflow's "Trigger Coolify deploy" step (auto-deploy on push to main) | No UI-side expiry; rotate annually (created 2026-05-13). **IP allowlist open (`0.0.0.0/0`)** since 2026-05-13 — required for GHA's rotating runner IPs to reach the API. Bearer token is the sole auth layer. |
| GitHub Actions secrets (22 total) | GitHub repo Settings → Secrets → Actions | `build-and-push.yml` workflow | 19 are build-arg env values passed via `--build-arg` to `docker build` (match Coolify env-var values; rotate alongside). 3 are Coolify deploy-trigger values: `COOLIFY_HOST`, `COOLIFY_TOKEN`, `COOLIFY_APP_UUID` |

**Rollback (manual; Coolify dashboard access remains required):** routine deploys are fully automated, but **rollback is intentionally a manual operation** — the rare-and-important class of action where human deliberation is the feature, not the bug. Every image is tagged with its commit SHA in GHCR. To roll back, log into the Coolify dashboard, navigate to the marketplace app, change the image tag from `:latest` to a previous SHA (e.g., `b2cc71ff4ec1352d3030f719f7a25338a963a3f6`), then click Redeploy. Old image is cached locally on the VPS so rollback completes in ~10 seconds. The Coolify dashboard access remains the **rollback safety net** — don't lose your Coolify password just because routine deploys no longer use it.

**Coolify API empirical notes:** see [docs/operations/coolify-api-notes.md](operations/coolify-api-notes.md). Endpoints used today (scheduled-task management) are functional but undocumented in Coolify's public OpenAPI spec; capture file records the working request/response shapes.

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

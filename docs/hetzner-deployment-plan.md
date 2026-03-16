## Task: Prepare STG codebase for Hetzner + Coolify deployment

We are preparing to deploy Second Turn Games to a Hetzner VPS (CX23, Helsinki) running Coolify. This is a fresh deployment — STG has never been deployed to production before. The deployment will happen later when MVP is ready. Right now we only make non-breaking codebase changes that prepare the project for Docker-based hosting.

### What to do NOW (non-breaking prep work)

**1. Add `output: 'standalone'` to `next.config.mjs`**

Add `output: 'standalone'` to the nextConfig object. This tells Next.js to produce a self-contained build that includes only the dependencies each page needs. It does NOT affect local dev (`pnpm dev` doesn't use it). The rest of the file stays as-is (the next-intl plugin wrapper etc).

**2. Create a production Dockerfile at the project root**

Create `Dockerfile` based on the official Next.js with Docker example, adapted for our stack:
- Use `node:20-alpine` base (Node 20 LTS, supported until April 2026)
- Use pnpm (our package manager) with `corepack enable pnpm`
- Multi-stage build: deps → builder → runner
- Copy standalone output + static files + public folder
- Install `sharp` for Next.js image optimization in the runner stage: `RUN npm install --os=linux --cpu=x64 sharp`
- Run as non-root user (nextjs:nodejs)
- Expose port 3000
- Set `HOSTNAME="0.0.0.0"` (required for Docker networking)
- Set `NEXT_TELEMETRY_DISABLED=1`

**3. Create `.dockerignore` file**

Create `.dockerignore` to keep Docker build context small:
```
node_modules
.next
.git
.env
.env.local
.env.*.local
README.md
docs/
.claude/
coverage/
.vercel/
supabase/.temp/
boardgames_ranks.csv
```

**4. Create a health check endpoint**

Add `src/app/api/health/route.ts` returning `{ status: "ok" }`. Used by Coolify/Traefik for zero-downtime deploys and health monitoring.

**5. Update deployment references**

- Update CLAUDE.md tech stack to reflect Hetzner + Coolify
- Update `.claude/skills/deploy.md` to reference Coolify workflow instead of Vercel

**6. Add a `memory/hetzner-deployment.md` file**

Create a new memory file with the deployment plan below. Do NOT modify `memory/deployment.md` — that file currently documents a Vercel workflow that does not apply to STG (it was written generically and will be replaced entirely when we deploy).

**7. Do NOT change anything else**

- Do NOT add Docker-specific env vars
- Do NOT change `pnpm build` or any scripts

### After making changes, verify:
- `pnpm build` still passes (the real deploy gate)
- `pnpm test` still passes
- No new lint errors

---

### Content for `memory/hetzner-deployment.md`

```markdown
---
name: Hetzner + Coolify Deployment
description: Production deployment plan for STG on Hetzner VPS (Helsinki) with Coolify
type: project
---

## Overview

STG will be deployed to a self-hosted Hetzner VPS running Coolify (open-source PaaS).
This is a fresh first production deployment — no migration from another host.

The domain `secondturn.games` currently points to an unrelated old project on Vercel.
When ready, we disconnect that and point DNS to Hetzner.

## Infrastructure

- **Server:** Hetzner CX23 (2 vCPU, 4 GB RAM, 40 GB SSD) in Helsinki (HEL1)
- **Cost:** €4.22/month fixed (no usage-based charges)
- **PaaS:** Coolify (self-hosted, open-source Vercel alternative)
- **SSL:** Automatic via Let's Encrypt (managed by Coolify)
- **Reverse proxy:** Traefik (managed by Coolify)

## Why Helsinki

Baltic latency from HEL1:
- Tallinn: ~3ms
- Riga: ~7ms
- Vilnius: ~12ms

All Next.js features work identically to local dev (standard Node.js `next start`).
No OpenNext adapter, no compatibility layer, no platform-specific gotchas.

## Codebase preparation (already done)

- [x] `output: 'standalone'` in next.config.mjs
- [x] Dockerfile in project root (multi-stage, pnpm, sharp, node:20-alpine)
- [x] .dockerignore configured
- [x] Health check endpoint at /api/health

## Deployment steps (when MVP is ready)

### Phase 1: Provision server (~45 min)

1. Create Hetzner Cloud account at hetzner.com/cloud
   - Requires credit card/PayPal, €20 verification hold (becomes account credit)
2. Create server:
   - Location: Helsinki (HEL1)
   - Image: Ubuntu 24.04
   - Type: Shared Cost-Optimized → CX23
   - Add SSH key
   - Primary IPv4: enabled
   - Name: `stg-production`
3. Note the public IP address
4. SSH in: `ssh root@<IP>`
5. Add 2GB swap (critical — CX23 has only 4GB RAM, builds can spike to 2-3GB):
   ```bash
   fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
   echo '/swapfile none swap sw 0 0' >> /etc/fstab
   ```
6. Install Coolify: `curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash`
7. Open `http://<IP>:8000`, create admin account

### Phase 2: Configure Coolify + deploy STG (~20 min)

1. In Coolify Settings: set instance FQDN (use IP for now, domain comes later)
2. Sources → Create GitHub App (Coolify wizard walks through this)
3. Create Project "STG" → Add Resource → Private Repository (GitHub App)
4. Select the STG repo, branch: `main`
5. Set Build Pack: **Dockerfile**
6. Set Ports Exposes: **3000**
7. Configure health check: path `/api/health`, interval 30s
8. Add all environment variables:
   - NEXT_PUBLIC_SUPABASE_URL
   - NEXT_PUBLIC_SUPABASE_ANON_KEY
   - SUPABASE_SERVICE_ROLE_KEY
   - EVERYPAY_API_USERNAME, EVERYPAY_API_SECRET, EVERYPAY_API_URL, EVERYPAY_ACCOUNT_NAME
   - RESEND_API_KEY, RESEND_FROM_EMAIL
   - UNISEND_API_URL, UNISEND_USERNAME, UNISEND_PASSWORD
   - NEXT_PUBLIC_APP_URL=https://secondturn.games
   - CRON_SECRET
   - NEXT_PUBLIC_TURNSTILE_SITE_KEY, TURNSTILE_SECRET_KEY (if ready)
9. Deploy — verify app loads at the Coolify-provided URL (IP-based or auto-generated)

### Phase 3: Test on VPS before DNS switch

1. Access the deployed app via Coolify's generated URL or `http://<IP>:3000`
2. Test core flows: browse, listing creation, auth, checkout
3. Verify Supabase auth callbacks work (may need temporary NEXT_PUBLIC_APP_URL adjustment)
4. Fix any Docker-specific issues (sharp, env vars, etc.)

### Phase 4: Go live — DNS cutover (~5 min)

1. In your DNS provider (wherever secondturn.games is registered):
   - Delete/update existing records that point to Vercel
   - Add A record: `secondturn.games` → Hetzner VPS IP
   - Add A record: `www.secondturn.games` → Hetzner VPS IP
   - Add wildcard A record: `*.secondturn.games` → Hetzner VPS IP (for preview deploys)
2. In Coolify: set app domain to `secondturn.games`
3. Coolify auto-provisions Let's Encrypt SSL certificate
4. Wait for DNS propagation (minutes to hours)
5. Verify HTTPS works on production domain
6. Update Supabase Auth redirect URLs to use `secondturn.games`
7. Update EveryPay callback URL if hardcoded
8. Disconnect/delete the old unrelated project from Vercel (optional, it's just dead once DNS moves)

## Daily workflow after deployment

Same as current development:
- Develop locally with `pnpm dev`
- Push to `staging` branch for work-in-progress
- Merge `staging → main` to deploy
- Coolify auto-deploys on push to `main` (GitHub webhook)
- Build takes ~3-5 min on VPS (vs ~1-2 min on Vercel-class build servers)

## Maintenance

- **Weekly:** essentially nothing
- **Monthly:** check disk space in Coolify dashboard, run `apt update && apt upgrade` via SSH
- **Set once:** Docker image retention count to 3 in Coolify (prevents disk fill)
- **Recommended:** Coolify notifications (Discord/email) for deploy failures
- **Monitoring:** Sentry for app errors (planned Week 2)

## Backup strategy

The VPS itself is stateless — nothing irreplaceable lives on the server:
- **Code:** in GitHub
- **Data:** in Supabase (which has its own automated backups)
- **Env vars:** store in a password manager (1Password, Bitwarden, etc.)
- **Optional:** Hetzner snapshots (~€0.48/month) for faster recovery vs full reinstall
- **Recovery:** if VPS dies, recreate from scratch in ~1 hour using Phase 1-2 steps above

## What's different from Vercel-style hosting

| Aspect | Vercel | Coolify + Hetzner |
|--------|--------|-------------------|
| Deploy trigger | git push | git push (identical) |
| Build time | ~1-2 min | ~3-5 min |
| Preview deploys | automatic | needs GitHub App + wildcard DNS |
| SSL | automatic | automatic (Let's Encrypt) |
| Logs | dashboard | Coolify dashboard + SSH |
| Analytics | built-in | Sentry / Plausible (self-hosted) |
| Rollback | instant redeploy | git revert + push (new build) |
| Cost model | usage-based | fixed €4.22/month |
| Baltic latency | ~30-50ms | ~3-12ms |
| Next.js compat | 100% | 100% (same Node.js runtime) |

## If something goes wrong

Recovery options:
1. Fix forward: debug via Coolify logs + SSH, push a fix, auto-redeploy
2. Git revert: `git revert HEAD && git push` triggers clean redeploy
3. Nuclear option: destroy VPS, create new one, reinstall Coolify, redeploy from GitHub (1 hour)
```

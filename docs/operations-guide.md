# STG Operations Guide

Everything you need to know about running Second Turn Games on Hetzner + Coolify.

---

## Your infrastructure at a glance

| Component | Where | Purpose |
|-----------|-------|---------|
| **Hetzner VPS** | Helsinki (37.27.24.207) | Runs the app (CX23: 2 vCPU, 4GB RAM, €3.49/mo) |
| **Coolify** | On the VPS (port 8000) | Manages deploys, SSL, reverse proxy |
| **Traefik** | On the VPS (ports 80/443) | Routes traffic, handles HTTPS |
| **Supabase** | Cloud (supabase.co) | Database, auth, file storage |
| **Cloudflare** | DNS only (grey cloud) | DNS records for secondturn.games |
| **GitHub** | stg-aigars/stg-marketplace | Source code, triggers auto-deploy |
| **EveryPay** | External API | Payment processing |
| **Unisend** | External API | Parcel locker shipping |
| **Resend** | External API | Transactional emails |

**Key insight:** Your VPS is stateless. Nothing irreplaceable lives on the server. Code is in GitHub, data is in Supabase, secrets are in your password manager. If the server dies, you can rebuild from scratch in about an hour.

---

## Daily development workflow

### Normal flow
1. Develop locally with `pnpm dev`
2. Test with `pnpm build` (the real deploy gate)
3. Commit and push to `main`
4. Coolify auto-deploys via GitHub webhook (~2 min build)
5. Site updates at secondturn.games

### Checking a deploy
- Coolify dashboard: `http://37.27.24.207:8000` → Projects → STG → Deployments
- Each deploy shows build logs and success/failure status
- The healthcheck (`/api/health`) must pass before the new version goes live

### Rolling back a bad deploy
If you push something that breaks the site:
```bash
git revert HEAD
git push origin main
```
This creates a new commit that undoes the last change, triggering a clean redeploy. The site will be back to the previous state in ~2 minutes.

---

## Regular maintenance

### Weekly (takes 2 minutes)
**Nothing required.** Docker cleanup runs automatically at midnight daily. The cron job cleans up stale checkout sessions every 10 minutes.

### Monthly (takes 5 minutes)
SSH into the server and update system packages:
```bash
ssh root@37.27.24.207
apt update && apt upgrade -y
```
This keeps Ubuntu security patches current. It won't affect your app (Docker containers are isolated).

### When you think of it
- Check disk space in Coolify dashboard (Servers → localhost → Metrics)
- If disk is above 80%, run manual Docker cleanup: Servers → localhost → Docker Cleanup → Trigger Manual Cleanup

---

## Monitoring: how to know if something is wrong

### Quick health check
Visit `https://secondturn.games/api/health` — should return `{"status":"ok"}`.

### Signs something is wrong
- Site doesn't load → check if the server is up (can you reach Coolify at port 8000?)
- Deploy failed → check Coolify deploy logs
- Auth not working → check Supabase dashboard for errors
- Payments failing → check EveryPay dashboard / app logs in Coolify

### Viewing app logs
In Coolify: Projects → STG app → **Logs** tab. This shows real-time `console.log` and `console.error` output from your Next.js app.

---

## Common issues and fixes

### Deploy fails
**Symptom:** Coolify shows deploy failed in red.
**Fix:**
1. Click the failed deployment to see build logs
2. Look for the error message — usually a TypeScript error, missing env var, or build failure
3. Fix the code locally, `pnpm build` to verify, push again
4. The previous working version stays live until the new one passes healthcheck

### Site is down / not loading
**Step-by-step diagnosis:**

1. **Can you reach Coolify?** → `http://37.27.24.207:8000`
   - **No:** The server itself is down. Check Hetzner console — might need a reboot
   - **Yes:** Continue to step 2

2. **Is the app container running?** → SSH in and run `docker ps`
   - Look for a container with your app image
   - **Not running:** Redeploy from Coolify dashboard
   - **Running:** Continue to step 3

3. **Is Traefik running?** → Look for `coolify-proxy` in `docker ps`
   - **Not running:** In Coolify → Servers → localhost → click Start Proxy
   - **Running:** Check Traefik logs for routing errors

4. **Is DNS correct?** → `dig secondturn.games` should show `37.27.24.207`
   - **Wrong IP:** Fix in Cloudflare DNS settings

### SSL certificate not working
**Symptom:** Browser shows "Not Secure" or certificate error on HTTPS.
**Fix:**
1. Make sure Cloudflare proxy is **off** (grey cloud, DNS only) for both A records
2. In Coolify, ensure the domain is set to `https://secondturn.games`
3. Coolify → Servers → localhost → Restart Proxy
4. Wait a few minutes — Let's Encrypt needs to issue the certificate

### Environment variable issues
**Symptom:** App crashes on startup, or features don't work (auth, payments, emails).
**Fix:**
1. Coolify → Projects → STG app → Environment Variables
2. Check all required vars are present and have correct values
3. Remember: `NEXT_PUBLIC_*` vars need "Available at Buildtime" checked
4. After changing env vars, you need to **redeploy** for changes to take effect

### Healthcheck failing
**Symptom:** Deploy succeeds building but container shows "unhealthy".
**Fix:**
1. Check app logs in Coolify — the app might be crashing on startup
2. Common cause: missing or wrong environment variable
3. The healthcheck hits `http://localhost:3000/api/health` inside the container

### Out of disk space
**Symptom:** Deploys fail, docker errors about space.
**Fix:**
```bash
ssh root@37.27.24.207
docker system prune -a -f
```
This removes all unused images, containers, and build cache. Safe to run — only active containers are kept.

### Out of memory during build
**Symptom:** Build killed with exit code 137 (OOM).
**Fix:** Swap should already be configured (2GB). Verify:
```bash
ssh root@37.27.24.207
free -h
```
You should see ~2GB swap. If not:
```bash
fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

---

## Recovery: if everything breaks

### Scenario 1: App is broken but server is fine
1. `git revert HEAD && git push origin main` to roll back
2. Or redeploy a previous commit from Coolify's Deployments tab

### Scenario 2: Server is unresponsive
1. Go to Hetzner console → Power → Reboot
2. Wait 2-3 minutes, everything (Coolify, Traefik, your app) starts automatically
3. Verify at `https://secondturn.games`

### Scenario 3: Server is completely dead (nuclear option)
Total recovery time: ~1 hour. Nothing is lost because the server is stateless.

1. **Create new Hetzner server** (same settings: CX23, Helsinki, Ubuntu 24.04)
2. **SSH in and set up:**
   ```bash
   fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
   echo '/swapfile none swap sw 0 0' >> /etc/fstab
   curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
   ```
3. **Configure Coolify:** Same steps as initial setup — connect GitHub, add env vars, deploy
4. **Update DNS:** Point `secondturn.games` A records to the new server IP in Cloudflare
5. **Wait for SSL:** Let's Encrypt auto-provisions in a few minutes

---

## Security basics

### What's already in place
- SSH key authentication (no password login)
- App runs as non-root user inside Docker container
- Supabase RLS policies control database access
- HTTPS via Let's Encrypt (auto-renewed by Traefik)
- Environment secrets never committed to git

### Things to keep secure
- **Coolify dashboard** (`http://37.27.24.207:8000`) — uses a password you set during setup. Consider restricting access by IP if needed
- **SSH access** — only your MacBook's SSH key can connect
- **Environment variables** — store a backup in a password manager (1Password, Bitwarden)
- **Supabase service role key** — never expose in client-side code

### If you suspect a security issue
1. Rotate the compromised credential immediately (Supabase dashboard, EveryPay dashboard, etc.)
2. Update the env var in Coolify
3. Redeploy

---

## Access reference

| Service | URL | Login |
|---------|-----|-------|
| Coolify dashboard | `http://37.27.24.207:8000` | Email/password (set during setup) |
| Server SSH | `ssh root@37.27.24.207` | SSH key (automatic) |
| Hetzner console | `console.hetzner.com` | Your Hetzner account |
| Supabase | `supabase.com/dashboard` | Your Supabase account |
| Cloudflare DNS | `dash.cloudflare.com` | Your Cloudflare account |
| GitHub repo | `github.com/stg-aigars/stg-marketplace` | Your GitHub account |
| Google Cloud (OAuth) | `console.cloud.google.com` | Your Google account |

---

## Key commands cheat sheet

```bash
# SSH into server
ssh root@37.27.24.207

# Check running containers
docker ps

# View app logs (last 100 lines)
docker logs --tail 100 $(docker ps -q --filter "name=dr6kcc91")

# Check disk space
df -h

# Check memory and swap
free -h

# Manual Docker cleanup
docker system prune -a -f

# Restart Traefik proxy
cd /data/coolify/proxy && docker compose restart

# Restart all Coolify services
cd /data/coolify/source && docker compose up -d

# Check if site is up
curl -s https://secondturn.games/api/health
```

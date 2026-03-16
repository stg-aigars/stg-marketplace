# Second Turn Games

Peer-to-peer board game marketplace for the Baltic region (Latvia, Lithuania, Estonia).

## Getting Started

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Commands

- `pnpm dev` — start dev server
- `pnpm build` — production build (the pre-deploy gate)
- `pnpm test` — run Vitest test suite
- `pnpm lint` — run ESLint

## Tech Stack

Next.js 14 (App Router), TypeScript, Supabase, EveryPay, Resend, Unisend, Tailwind CSS. Deployed on Hetzner VPS (Helsinki) with Coolify.

## Deployment

Push to `main` triggers auto-deploy via Coolify. See `docs/hetzner-deployment-plan.md` for full setup instructions.

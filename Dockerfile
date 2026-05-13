# Production Dockerfile for STG marketplace (Hetzner + Coolify)

# Stage 1: Install dependencies
FROM node:22-alpine AS deps
RUN corepack enable pnpm
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Stage 2: Build the application
FROM node:22-alpine AS builder
RUN corepack enable pnpm
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1

# Build-time env vars. Mirror the set src/lib/env.ts:validateEnv() requires.
# NEXT_PUBLIC_* values + NEXT_SERVER_ACTIONS_ENCRYPTION_KEY get baked into the
# bundle at this step and CANNOT be overridden at runtime; pass real production
# values. Server-only vars are forwarded so env.ts validation passes during
# build, but the deployed container still reads them from runtime env at start
# (Coolify provides those), so their values here only need to be present, not
# necessarily "real" — passing real values keeps build/runtime in lockstep.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG SUPABASE_SERVICE_ROLE_KEY
ARG EVERYPAY_API_USERNAME
ARG EVERYPAY_API_SECRET
ARG EVERYPAY_API_URL
ARG EVERYPAY_ACCOUNT_NAME
ARG RESEND_API_KEY
ARG RESEND_FROM_EMAIL
ARG UNISEND_API_URL
ARG UNISEND_USERNAME
ARG UNISEND_PASSWORD
ARG NEXT_PUBLIC_APP_URL
ARG CRON_SECRET
ARG NEXT_PUBLIC_TURNSTILE_SITE_KEY
ARG NEXT_PUBLIC_SENTRY_DSN
ARG NEXT_PUBLIC_POSTHOG_KEY
ARG NEXT_PUBLIC_FACEBOOK_LOGIN_ENABLED
ARG NEXT_SERVER_ACTIONS_ENCRYPTION_KEY

ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
    SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY \
    EVERYPAY_API_USERNAME=$EVERYPAY_API_USERNAME \
    EVERYPAY_API_SECRET=$EVERYPAY_API_SECRET \
    EVERYPAY_API_URL=$EVERYPAY_API_URL \
    EVERYPAY_ACCOUNT_NAME=$EVERYPAY_ACCOUNT_NAME \
    RESEND_API_KEY=$RESEND_API_KEY \
    RESEND_FROM_EMAIL=$RESEND_FROM_EMAIL \
    UNISEND_API_URL=$UNISEND_API_URL \
    UNISEND_USERNAME=$UNISEND_USERNAME \
    UNISEND_PASSWORD=$UNISEND_PASSWORD \
    NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL \
    CRON_SECRET=$CRON_SECRET \
    NEXT_PUBLIC_TURNSTILE_SITE_KEY=$NEXT_PUBLIC_TURNSTILE_SITE_KEY \
    NEXT_PUBLIC_SENTRY_DSN=$NEXT_PUBLIC_SENTRY_DSN \
    NEXT_PUBLIC_POSTHOG_KEY=$NEXT_PUBLIC_POSTHOG_KEY \
    NEXT_PUBLIC_FACEBOOK_LOGIN_ENABLED=$NEXT_PUBLIC_FACEBOOK_LOGIN_ENABLED \
    NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=$NEXT_SERVER_ACTIONS_ENCRYPTION_KEY

RUN pnpm build

# Stage 3: Install platform-specific sharp in isolation (avoids npm resolution
# issues with standalone's complex node_modules tree)
FROM node:22-alpine AS sharp
WORKDIR /sharp
RUN npm init -y && npm install --os=linux --libc=musl sharp@0.34.5

# Stage 4: Production runner
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME="0.0.0.0"
ENV PORT=3000

RUN apk add --no-cache curl
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Remove standalone's sharp entry (pnpm creates it as a file/symlink) before overlaying
RUN rm -rf ./node_modules/sharp
# Overlay sharp with correct musl native bindings (sharp, @img, @emnapi, detect-libc, semver)
COPY --from=sharp --chown=nextjs:nodejs /sharp/node_modules ./node_modules

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

CMD ["node", "server.js"]

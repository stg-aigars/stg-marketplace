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

# Build-time env vars.
#
# Two channels, deliberately split:
#
#   1. NEXT_PUBLIC_* values are baked into the client JS bundle by Next.js and
#      are public by design (browser-visible at runtime). They come in as ARG
#      + ENV — visible in `docker history`, which is fine because the values
#      themselves are not secret.
#
#   2. Server-only secrets (service-role key, EveryPay/Resend/Unisend creds,
#      CRON_SECRET, NEXT_SERVER_ACTIONS_ENCRYPTION_KEY) MUST NOT land in any
#      image layer or in the BuildKit cache. They come in as BuildKit secret
#      mounts and are exported into the environment of the single `pnpm build`
#      RUN step only — never persisted. See:
#      https://docs.docker.com/build/building/secrets/
#
# Most server-only vars only need to be *present* at build time (env.ts:validateEnv
# checks presence, not correctness); the deployed container reads real values
# from runtime env (Coolify provides those). NEXT_SERVER_ACTIONS_ENCRYPTION_KEY
# is the exception: Next.js uses it to encrypt Server Action IDs at build time
# and they must decrypt at runtime, so the build value MUST match runtime.

ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_TURNSTILE_SITE_KEY
ARG NEXT_PUBLIC_SENTRY_DSN
ARG NEXT_PUBLIC_POSTHOG_KEY
ARG NEXT_PUBLIC_FACEBOOK_LOGIN_ENABLED
# Sentry release metadata — not secret (commit SHA and org/project slugs)
ARG SENTRY_RELEASE
ARG SENTRY_ORG
ARG SENTRY_PROJECT

ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
    NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL \
    NEXT_PUBLIC_TURNSTILE_SITE_KEY=$NEXT_PUBLIC_TURNSTILE_SITE_KEY \
    NEXT_PUBLIC_SENTRY_DSN=$NEXT_PUBLIC_SENTRY_DSN \
    NEXT_PUBLIC_POSTHOG_KEY=$NEXT_PUBLIC_POSTHOG_KEY \
    NEXT_PUBLIC_FACEBOOK_LOGIN_ENABLED=$NEXT_PUBLIC_FACEBOOK_LOGIN_ENABLED \
    SENTRY_RELEASE=$SENTRY_RELEASE \
    SENTRY_ORG=$SENTRY_ORG \
    SENTRY_PROJECT=$SENTRY_PROJECT

RUN --mount=type=secret,id=supabase_service_role_key \
    --mount=type=secret,id=everypay_api_username \
    --mount=type=secret,id=everypay_api_secret \
    --mount=type=secret,id=everypay_api_url \
    --mount=type=secret,id=everypay_account_name \
    --mount=type=secret,id=resend_api_key \
    --mount=type=secret,id=resend_from_email \
    --mount=type=secret,id=unisend_api_url \
    --mount=type=secret,id=unisend_username \
    --mount=type=secret,id=unisend_password \
    --mount=type=secret,id=cron_secret \
    --mount=type=secret,id=next_server_actions_encryption_key \
    --mount=type=secret,id=sentry_auth_token \
    export SUPABASE_SERVICE_ROLE_KEY="$(cat /run/secrets/supabase_service_role_key)" && \
    export EVERYPAY_API_USERNAME="$(cat /run/secrets/everypay_api_username)" && \
    export EVERYPAY_API_SECRET="$(cat /run/secrets/everypay_api_secret)" && \
    export EVERYPAY_API_URL="$(cat /run/secrets/everypay_api_url)" && \
    export EVERYPAY_ACCOUNT_NAME="$(cat /run/secrets/everypay_account_name)" && \
    export RESEND_API_KEY="$(cat /run/secrets/resend_api_key)" && \
    export RESEND_FROM_EMAIL="$(cat /run/secrets/resend_from_email)" && \
    export UNISEND_API_URL="$(cat /run/secrets/unisend_api_url)" && \
    export UNISEND_USERNAME="$(cat /run/secrets/unisend_username)" && \
    export UNISEND_PASSWORD="$(cat /run/secrets/unisend_password)" && \
    export CRON_SECRET="$(cat /run/secrets/cron_secret)" && \
    export NEXT_SERVER_ACTIONS_ENCRYPTION_KEY="$(cat /run/secrets/next_server_actions_encryption_key)" && \
    export SENTRY_AUTH_TOKEN="$(cat /run/secrets/sentry_auth_token)" && \
    pnpm build

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

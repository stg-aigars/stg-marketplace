# Production Dockerfile for STG marketplace (Hetzner + Coolify)

# Stage 1: Install dependencies
FROM node:20-alpine AS deps
RUN corepack enable pnpm
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Stage 2: Build the application
FROM node:20-alpine AS builder
RUN corepack enable pnpm
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

# Stage 3: Install platform-specific sharp in isolation (avoids npm resolution
# issues with standalone's complex node_modules tree)
FROM node:20-alpine AS sharp
WORKDIR /sharp
RUN npm init -y && npm install --os=linux --libc=musl sharp@0.34.5

# Stage 4: Production runner
FROM node:20-alpine AS runner
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

CMD ["node", "server.js"]

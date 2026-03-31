#!/usr/bin/env bash
# Purge entire Cloudflare cache after deploy
# Required env vars: CLOUDFLARE_ZONE_ID, CLOUDFLARE_API_TOKEN

set -euo pipefail

if [ -z "${CLOUDFLARE_ZONE_ID:-}" ] || [ -z "${CLOUDFLARE_API_TOKEN:-}" ]; then
  echo "⚠️  CLOUDFLARE_ZONE_ID or CLOUDFLARE_API_TOKEN not set, skipping cache purge"
  exit 0
fi

echo "Purging Cloudflare cache..."

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
  "https://api.cloudflare.com/client/v4/zones/${CLOUDFLARE_ZONE_ID}/purge_cache" \
  -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
  -H "Content-Type: application/json" \
  --data '{"purge_everything":true}')

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
  echo "✓ Cloudflare cache purged successfully"
else
  echo "✗ Cache purge failed (HTTP $HTTP_CODE): $BODY"
  exit 1
fi

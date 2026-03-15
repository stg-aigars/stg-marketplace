/**
 * BGG API Configuration
 * Server-side only — never expose BGG_API_TOKEN to the browser.
 */

export function createBGGHeaders(): HeadersInit {
  const domain = process.env.NEXT_PUBLIC_VERCEL_URL
    ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
    : 'https://secondturn.games';

  const headers: HeadersInit = {
    'User-Agent': `SecondTurnGames/1.0 (${domain}; aigars@secondturn.games)`,
  };

  const token = process.env.BGG_API_TOKEN;
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return headers;
}

export const BGG_CONFIG = {
  RATE_LIMIT_MS: parseInt(process.env.BGG_API_RATE_LIMIT_MS || '1000'),
  API_BASE_URL: 'https://boardgamegeek.com/xmlapi2',
} as const;

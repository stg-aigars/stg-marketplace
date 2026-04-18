const BOT_PATTERNS = /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|headlesschrome|googlebot|applebot|gptbot|ccbot|claudebot/i;

export function isBotUserAgent(userAgent: string | null | undefined): boolean {
  if (!userAgent) return false;
  return BOT_PATTERNS.test(userAgent);
}

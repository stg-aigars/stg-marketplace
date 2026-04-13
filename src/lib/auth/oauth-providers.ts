export const OAUTH_PROVIDERS = ['google', 'facebook'] as const;
export type OAuthProvider = (typeof OAUTH_PROVIDERS)[number];

export function isOAuthUser(appMetadata: { provider?: string; providers?: string[] }): boolean {
  const { provider, providers } = appMetadata;
  return OAUTH_PROVIDERS.includes(provider as (typeof OAUTH_PROVIDERS)[number]) ||
    (Array.isArray(providers) && providers.some(p => OAUTH_PROVIDERS.includes(p as (typeof OAUTH_PROVIDERS)[number])));
}

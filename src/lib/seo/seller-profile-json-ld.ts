import type { WithContext, ProfilePage } from 'schema-dts';

/**
 * Build a ProfilePage / Person JSON-LD block for a seller's public profile.
 *
 * mainEntity is hardcoded to `Person`. When trader verification ships and
 * sellers are explicitly classified as commercial, this is the branch point:
 * commercial sellers should emit `@type: 'Organization'` instead. Both are
 * valid `ProfilePage.mainEntity` types.
 *
 * `avatarUrl` is expected to be an ABSOLUTE URL. Supabase storage URLs are
 * absolute by default. If a relative path ever lands here, Schema.org
 * validation will fail (Google Search Console flags it) — fix by prefixing
 * with `env.app.url` inside this helper.
 */
export function buildSellerProfileJsonLd(input: {
  sellerId: string;
  name: string;
  avatarUrl: string | null;
  country: string | null;
}, baseUrl: string): WithContext<ProfilePage> {
  return {
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    url: `${baseUrl}/sellers/${input.sellerId}`,
    mainEntity: {
      '@type': 'Person',
      name: input.name,
      ...(input.avatarUrl ? { image: input.avatarUrl } : {}),
      ...(input.country ? { address: { '@type': 'PostalAddress', addressCountry: input.country } } : {}),
    },
  };
}

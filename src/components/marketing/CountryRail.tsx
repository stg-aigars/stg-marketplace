import Link from 'next/link';
import { unstable_cache } from 'next/cache';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { Card, CardBody } from '@/components/ui';
import { COUNTRIES, getCountryFlag, type CountryCode } from '@/lib/country-utils';
import { env } from '@/lib/env';
import { SECTION_HEADING_CLASS } from '@/lib/heading-classes';

const STATIC_BYLINES: Record<CountryCode, string> = {
  LV: 'Listings from Latvia.',
  LT: 'Listings from Lithuania.',
  EE: 'Listings from Estonia.',
};

const fetchCountryListingCounts = unstable_cache(
  async (): Promise<Record<CountryCode, number | null>> => {
    // Raw @supabase/supabase-js client (not @/lib/supabase/server) because
    // unstable_cache callbacks run outside the request scope — cookies() from
    // next/headers throws there. Anon key is sufficient: the query is a public,
    // RLS-permitted count of active/reserved listings.
    const client = createSupabaseClient(env.supabase.url, env.supabase.anonKey);

    const results = await Promise.all(
      COUNTRIES.map(async ({ code }) => {
        const { count, error } = await client
          .from('listings')
          .select('id', { count: 'exact', head: true })
          .in('status', ['active', 'reserved'])
          .eq('country', code);

        if (error) {
          console.error(`[CountryRail] count query failed for ${code}`, error);
          return [code, null] as const;
        }
        return [code, count ?? 0] as const;
      }),
    );

    return Object.fromEntries(results) as Record<CountryCode, number | null>;
  },
  ['country-listing-counts-v1'],
  { revalidate: 300, tags: ['country-listing-counts'] },
);

function bylineFor(code: CountryCode, name: string, count: number | null): string {
  if (count === 0) return `Be the first to list from ${name} →`;
  if (count === null) return STATIC_BYLINES[code];
  return count === 1 ? '1 listing' : `${count} listings`;
}

function destinationFor(code: CountryCode, count: number | null): string {
  if (count === 0) return '/sell';
  return `/browse?country=${code}`;
}

async function CountryRail() {
  const counts = await fetchCountryListingCounts();

  return (
    <section className="py-8 sm:py-10 lg:py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="mb-6 max-w-2xl">
          <p className="text-xs font-medium uppercase tracking-wider text-semantic-text-secondary mb-3">
            Available across the Baltics
          </p>
          <h2 className={SECTION_HEADING_CLASS}>
            Browse by country
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {COUNTRIES.map((country) => (
            <Link
              key={country.code}
              href={destinationFor(country.code, counts[country.code])}
              className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-semantic-border-focus focus-visible:ring-offset-2"
            >
              <Card hoverable className="p-6 text-center">
                <CardBody className="p-0">
                  <span
                    aria-hidden="true"
                    className={`${getCountryFlag(country.code)} text-5xl ring-1 ring-semantic-border-subtle rounded-sm`}
                  />
                  <h3 className="text-base font-semibold mt-3 text-semantic-text-heading">
                    {country.name}
                  </h3>
                  <p className="text-sm text-semantic-text-muted mt-1">
                    {bylineFor(country.code, country.name, counts[country.code])}
                  </p>
                </CardBody>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

export { CountryRail };

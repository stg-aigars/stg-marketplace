import { unstable_cache } from 'next/cache';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { COUNTRIES, getCountryFlag } from '@/lib/country-utils';
import { InlineArrowLink } from '@/components/ui';
import { env } from '@/lib/env';

const fetchTotalListingCount = unstable_cache(
  async (): Promise<number | null> => {
    // Raw @supabase/supabase-js client (not @/lib/supabase/server) because
    // unstable_cache callbacks run outside the request scope — cookies() from
    // next/headers throws there. Anon key is sufficient: count of public listings.
    const client = createSupabaseClient(env.supabase.url, env.supabase.anonKey);

    const { count, error } = await client
      .from('listings')
      .select('id', { count: 'exact', head: true })
      .in('status', ['active', 'reserved']);

    if (error) {
      console.error('[BalticReachStrip] count query failed', error);
      return null;
    }
    return count ?? 0;
  },
  ['baltic-reach-total-count-v1'],
  { revalidate: 300, tags: ['baltic-reach-total-count'] },
);

async function BalticReachStrip() {
  const total = await fetchTotalListingCount();
  const linkText =
    total === null || total === 0
      ? 'Browse all listings'
      : total === 1
        ? 'Browse all (1 listing)'
        : `Browse all (${total} listings)`;

  return (
    <section className="bg-semantic-bg-primary py-4 sm:py-5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-center sm:gap-x-5 text-sm">
          <span className="text-semantic-text-secondary font-medium text-center sm:text-left">
            Buy from anywhere across the Baltics
          </span>

          <ul className="flex items-center justify-center gap-x-4 flex-wrap">
            {COUNTRIES.map((country) => (
              <li key={country.code} className="flex items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className={`${getCountryFlag(country.code)} text-base ring-1 ring-semantic-border-subtle rounded-sm`}
                />
                <span className="text-semantic-text-primary font-medium">
                  {country.name}
                </span>
              </li>
            ))}
          </ul>

          <span
            aria-hidden="true"
            className="hidden sm:inline text-semantic-text-muted"
          >
            ·
          </span>

          <div className="flex justify-center">
            <InlineArrowLink href="/browse">{linkText}</InlineArrowLink>
          </div>
        </div>
      </div>
    </section>
  );
}

export { BalticReachStrip };

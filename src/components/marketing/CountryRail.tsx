import Link from 'next/link';
import { Card, CardBody } from '@/components/ui';
import { getCountryFlag } from '@/lib/country-utils';

const COUNTRY_TILES = [
  { code: 'LV', name: 'Latvia', byline: 'Listings from Latvia.' },
  { code: 'LT', name: 'Lithuania', byline: 'Listings from Lithuania.' },
  { code: 'EE', name: 'Estonia', byline: 'Listings from Estonia.' },
] as const;

function CountryRail() {
  return (
    <section className="py-8 sm:py-10 lg:py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="mb-6 max-w-2xl">
          <p className="text-xs font-medium uppercase tracking-wider text-semantic-text-secondary mb-3">
            Available across the Baltics
          </p>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-semantic-text-heading">
            Browse by country
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {COUNTRY_TILES.map((country) => (
            <Link
              key={country.code}
              href={`/browse?country=${country.code}`}
              className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-semantic-border-focus focus-visible:ring-offset-2"
            >
              <Card hoverable className="p-6 text-center">
                <CardBody className="p-0">
                  <span
                    aria-hidden="true"
                    className={`${getCountryFlag(country.code)} text-5xl`}
                  />
                  <h3 className="text-base font-semibold mt-3 text-semantic-text-heading">
                    {country.name}
                  </h3>
                  <p className="text-sm text-semantic-text-muted mt-1">
                    {country.byline}
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

import Link from 'next/link';
import { Card, CardBody } from '@/components/ui';
import { COUNTRIES, getCountryFlag, type CountryCode } from '@/lib/country-utils';

const BYLINES: Record<CountryCode, string> = {
  LV: 'Listings from Latvia.',
  LT: 'Listings from Lithuania.',
  EE: 'Listings from Estonia.',
};

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
          {COUNTRIES.map((country) => (
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
                    {BYLINES[country.code]}
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

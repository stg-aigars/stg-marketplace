// TODO: Evolve this band into a counter-strip once we cross the launch
// thresholds: 50 listings / 25 sellers / 10 delivered parcels. Until then it
// stays as a static partner-trust strip — counters before they're earned read
// as theatre.
import { BookOpen, CreditCard, Package, Tag } from '@phosphor-icons/react/ssr';
import { cn } from '@/lib/cn';

interface TrustBandProps {
  /** Renders an additional BoardGamePrices slot between BGG and Swedbank.
   * Off by default because BGP's role isn't explained on the homepage; only /about
   * surrounds the strip with the prose that gives the slot context.
   * When true, the band switches to a 2x2 grid at sm+ so four slots wrap cleanly
   * to two rows instead of overflowing a single row. */
  includeBgp?: boolean;
}

function TrustBand({ includeBgp = false }: TrustBandProps = {}) {
  return (
    <section className="border-y border-semantic-border-subtle bg-semantic-bg-secondary py-3 sm:py-4">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <ul
          className={cn(
            'flex flex-col gap-2',
            includeBgp
              ? 'sm:grid sm:grid-cols-2 sm:place-items-center sm:gap-x-8 sm:gap-y-3 sm:max-w-3xl sm:mx-auto'
              : 'sm:flex-row sm:items-center sm:justify-center sm:gap-x-6',
          )}
        >
          <li className="flex items-center gap-2 text-xs sm:text-sm text-semantic-text-secondary font-medium">
            <BookOpen size={16} weight="duotone" aria-hidden="true" />
            <span>Game data</span>
            {/* eslint-disable-next-line @next/next/no-img-element -- SVG partner logo, next/image adds no value for vectors */}
            <img
              src="/images/powered-by-bgg.svg"
              alt="BoardGameGeek"
              width={120}
              height={27}
              className="h-6 w-auto"
            />
          </li>

          {includeBgp && (
            <li className="flex items-center gap-2 text-xs sm:text-sm text-semantic-text-secondary font-medium">
              <Tag size={16} weight="duotone" aria-hidden="true" />
              <span>Price suggestions by BoardGamePrices</span>
              {/* eslint-disable-next-line @next/next/no-img-element -- partner logo kept consistent with the other img tags in this strip */}
              <img
                src="/images/bgp-icon.png"
                alt="BoardGamePrices"
                width={40}
                height={40}
                className="h-10 w-auto"
              />
            </li>
          )}

          <li
            aria-hidden="true"
            className={cn(
              'hidden text-semantic-text-muted',
              includeBgp ? 'sm:hidden' : 'sm:inline-block',
            )}
          >
            ·
          </li>

          <li className="flex items-center gap-2 text-xs sm:text-sm text-semantic-text-secondary font-medium">
            <CreditCard size={16} weight="duotone" aria-hidden="true" />
            <span>Secure payments via</span>
            {/* eslint-disable-next-line @next/next/no-img-element -- SVG partner logo, next/image adds no value for vectors */}
            <img
              src="/swedbank.svg"
              alt="Swedbank"
              width={216}
              height={48}
              className="h-7 w-auto"
            />
          </li>

          <li
            aria-hidden="true"
            className={cn(
              'hidden text-semantic-text-muted',
              includeBgp ? 'sm:hidden' : 'sm:inline-block',
            )}
          >
            ·
          </li>

          <li className="flex items-center gap-2 text-xs sm:text-sm text-semantic-text-secondary font-medium">
            <Package size={16} weight="duotone" aria-hidden="true" />
            <span>Parcel-locker delivery via</span>
            {/* eslint-disable-next-line @next/next/no-img-element -- SVG partner logo, next/image adds no value for vectors */}
            <img
              src="/unisend_logo.svg"
              alt="Unisend"
              width={100}
              height={20}
              className="h-4 w-auto"
            />
          </li>
        </ul>
      </div>
    </section>
  );
}

export { TrustBand };

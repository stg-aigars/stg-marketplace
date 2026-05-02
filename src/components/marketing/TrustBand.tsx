// TODO: Evolve this band into a counter-strip once we cross the launch
// thresholds: 50 listings / 25 sellers / 10 delivered parcels. Until then it
// stays as a static partner-trust strip — counters before they're earned read
// as theatre.
import { BookOpen, CreditCard, Package } from '@phosphor-icons/react/ssr';

function TrustBand() {
  return (
    <section className="border-y border-semantic-border-subtle bg-semantic-bg-secondary py-3 sm:py-4">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <ul className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-center sm:gap-x-6">
          <li className="flex items-center gap-2 text-xs sm:text-sm text-semantic-text-secondary font-medium">
            <BookOpen size={16} weight="duotone" aria-hidden="true" />
            <span>Listings powered by</span>
            {/* eslint-disable-next-line @next/next/no-img-element -- SVG partner logo, next/image adds no value for vectors */}
            <img
              src="/images/powered-by-bgg.svg"
              alt="BoardGameGeek"
              width={120}
              height={27}
              className="h-6 w-auto"
            />
          </li>

          <li
            aria-hidden="true"
            className="hidden sm:inline-block text-semantic-text-muted"
          >
            ·
          </li>

          <li className="flex items-center gap-2 text-xs sm:text-sm text-semantic-text-secondary font-medium">
            <CreditCard size={16} weight="duotone" aria-hidden="true" />
            <span>Payments by Swedbank via</span>
            {/* eslint-disable-next-line @next/next/no-img-element -- SVG partner logo, next/image adds no value for vectors */}
            <img
              src="/everypay_logo.svg"
              alt="EveryPay"
              width={180}
              height={52}
              className="h-9 w-auto"
            />
          </li>

          <li
            aria-hidden="true"
            className="hidden sm:inline-block text-semantic-text-muted"
          >
            ·
          </li>

          <li className="flex items-center gap-2 text-xs sm:text-sm text-semantic-text-secondary font-medium">
            <Package size={16} weight="duotone" aria-hidden="true" />
            <span>Shipping via</span>
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

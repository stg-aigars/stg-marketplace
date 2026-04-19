import Link from 'next/link';
import { LEGAL_ENTITY_EMAIL, LEGAL_ENTITY_NAME } from '@/lib/constants';

const LINK_CLASS =
  'sm:hover:text-semantic-brand transition-colors duration-250 ease-out-custom';

const MARKETPLACE_LINKS = [
  { href: '/browse', label: 'Browse Games' },
  { href: '/sell', label: 'Sell a Game' },
] as const;

const SUPPORT_LINKS = [
  { href: '/help', label: 'Help' },
  { href: '/contact', label: 'Contact' },
  { href: '/terms', label: 'Terms of Service' },
  { href: '/privacy', label: 'Privacy Policy' },
  { href: '/seller-terms', label: 'Seller Terms' },
  { href: '/accessibility', label: 'Accessibility' },
] as const;

const BALTIC_COUNTRIES = [
  { flag: 'fi fi-ee', name: 'Estonia' },
  { flag: 'fi fi-lv', name: 'Latvia' },
  { flag: 'fi fi-lt', name: 'Lithuania' },
] as const;

function SiteFooter() {
  return (
    <footer>
      {/* Top row — light */}
      <div className="bg-semantic-bg-secondary border-t border-semantic-border-subtle">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            {/* Branding & countries */}
            <div className="flex flex-col gap-4">
              <Link href="/" className="inline-flex items-center gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element -- SVG logo, next/image adds no value for vectors */}
                <img src="/favicon.svg" alt="" width={32} height={32} className="w-7 h-7 sm:w-8 sm:h-8" />
                <span className="flex flex-col leading-none">
                  <span className="text-[10px] sm:text-[11px] font-bold tracking-wide text-semantic-brand">
                    Every game deserves a
                  </span>
                  <span className="text-lg sm:text-xl font-display font-bold text-semantic-primary tracking-wide">
                    Second Turn
                  </span>
                </span>
              </Link>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-semantic-text-muted mb-2">
                  Available in
                </p>
                <div className="flex flex-col gap-1.5 text-sm text-semantic-text-muted">
                  {BALTIC_COUNTRIES.map((country) => (
                    <span key={country.name} className="flex items-center gap-1.5">
                      <span className={country.flag} />
                      {country.name}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Partners */}
            <div className="flex flex-col gap-4 sm:items-center">
              <p className="text-xs font-semibold uppercase tracking-wider text-semantic-text-muted sm:text-center">
                Our partners
              </p>
              <div className="flex flex-col gap-3 items-start sm:items-center">
                {/* eslint-disable-next-line @next/next/no-img-element -- SVG partner logo, next/image adds no value for vectors */}
                <img
                  src="/images/powered-by-bgg.svg"
                  alt="BoardGameGeek"
                  width={120}
                  height={27}
                  className="h-6 w-auto"
                />
                {/* eslint-disable-next-line @next/next/no-img-element -- SVG partner logo, next/image adds no value for vectors */}
                <img
                  src="/everypay_logo.svg"
                  alt="EveryPay"
                  width={180}
                  height={52}
                  className="h-9 w-auto"
                />
                {/* eslint-disable-next-line @next/next/no-img-element -- SVG partner logo, next/image adds no value for vectors */}
                <img
                  src="/unisend_logo.svg"
                  alt="Unisend"
                  width={100}
                  height={20}
                  className="h-4 w-auto text-semantic-text-secondary"
                />
              </div>
            </div>

            {/* Navigation links */}
            <nav className="grid grid-cols-2 gap-8 sm:justify-end">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-semantic-text-muted mb-3">
                  Marketplace
                </h3>
                <ul className="space-y-2 text-sm text-semantic-text-muted">
                  {MARKETPLACE_LINKS.map((link) => (
                    <li key={link.href}>
                      <Link href={link.href} className={LINK_CLASS}>
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-semantic-text-muted mb-3">
                  Support & Legal
                </h3>
                <ul className="space-y-2 text-sm text-semantic-text-muted">
                  {SUPPORT_LINKS.map((link) => (
                    <li key={link.href}>
                      <Link href={link.href} className={LINK_CLASS}>
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </nav>
          </div>
        </div>
      </div>

      {/* Bottom row — dark */}
      <div className="bg-[#363e4b]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 space-y-2 text-xs text-white/50">
          <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
            <p>
              &copy; 2025&ndash;{new Date().getFullYear()} {LEGAL_ENTITY_NAME}
            </p>
            <p>
              Contact:{' '}
            <a
              href={`mailto:${LEGAL_ENTITY_EMAIL}`}
              className="hover:text-white transition-colors duration-250 ease-out-custom"
            >
              {LEGAL_ENTITY_EMAIL}
            </a>
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}

export { SiteFooter };

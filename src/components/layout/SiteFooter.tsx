import Link from 'next/link';
import { LEGAL_ENTITY_EMAIL, LEGAL_ENTITY_NAME } from '@/lib/constants';

const LINK_CLASS =
  'sm:hover:text-semantic-brand transition-colors duration-250 ease-out-custom';

const CREDIT_LINK_CLASS =
  'underline hover:text-white transition-colors duration-250 ease-out-custom';

const SECTION_HEADING_CLASS =
  'text-sm font-semibold text-semantic-text-secondary mb-3';

const EXPLORE_LINKS = [
  { href: '/browse', label: 'Browse Games' },
  { href: '/sell', label: 'Sell a Game' },
  { href: '/wanted/new', label: 'Request a Game' },
  { href: '/help', label: 'Help' },
  { href: '/condition-guide', label: 'Condition Guide' },
  { href: '/contact', label: 'Contact' },
  { href: '/about', label: 'About' },
] as const;

const LEGAL_LINKS = [
  { href: '/terms', label: 'Terms of Service' },
  { href: '/seller-terms', label: 'Seller Agreement' },
  { href: '/privacy', label: 'Privacy Policy' },
  { href: '/cookies', label: 'Cookie Policy' },
  { href: '/imprint', label: 'Imprint' },
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
      <div className="bg-semantic-bg-secondary border-t border-semantic-border-subtle">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr] lg:grid-cols-[1.2fr_1fr] gap-8">
            <div className="flex flex-col gap-4">
              <Link href="/" className="group inline-flex items-center gap-2 self-start">
                {/* eslint-disable-next-line @next/next/no-img-element -- SVG logo, next/image adds no value for vectors */}
                <img
                  src="/favicon.svg"
                  alt=""
                  width={32}
                  height={32}
                  className="w-7 h-7 sm:w-8 sm:h-8 border-2 border-polar-night rounded-md shadow-pop transition-[transform,box-shadow] duration-[80ms] ease-out sm:group-hover:-translate-x-px sm:group-hover:-translate-y-px sm:group-hover:shadow-pop-lg group-active:translate-x-[2px] group-active:translate-y-[2px] group-active:shadow-pop-sm"
                />
                <span className="text-xl sm:text-2xl font-extrabold text-semantic-primary leading-none tracking-wide">
                  Second Turn<span className="hidden sm:inline"> Games</span>
                </span>
              </Link>
              <p className="text-base font-medium text-semantic-text-muted">
                Every game deserves a second turn.
              </p>
              <div>
                <p className={SECTION_HEADING_CLASS}>Available in</p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-semantic-text-muted">
                  {BALTIC_COUNTRIES.map((country) => (
                    <span key={country.name} className="flex items-center gap-1.5">
                      <span className={country.flag} />
                      {country.name}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <nav className="grid grid-cols-2 gap-8 sm:justify-end">
              <div>
                <h3 className={SECTION_HEADING_CLASS}>Explore</h3>
                <ul className="space-y-2 text-sm text-semantic-text-muted">
                  {EXPLORE_LINKS.map((link) => (
                    <li key={link.href}>
                      <Link href={link.href} className={LINK_CLASS}>
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className={SECTION_HEADING_CLASS}>Legal</h3>
                <ul className="space-y-2 text-sm text-semantic-text-muted">
                  {LEGAL_LINKS.map((link) => (
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

      <div className="bg-polar-night">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 space-y-2 text-xs text-white/60">
          <p>Made in Riga for the Baltic board game community.</p>
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
          <p>
            Hero photo:{' '}
            <a
              href="https://unsplash.com/@zoshuacolah?utm_source=second_turn_games&utm_medium=referral"
              target="_blank"
              rel="noopener noreferrer"
              className={CREDIT_LINK_CLASS}
            >
              Zoshua Colah
            </a>
            {' '}on{' '}
            <a
              href="https://unsplash.com/?utm_source=second_turn_games&utm_medium=referral"
              target="_blank"
              rel="noopener noreferrer"
              className={CREDIT_LINK_CLASS}
            >
              Unsplash
            </a>
            .
          </p>
        </div>
      </div>
    </footer>
  );
}

export { SiteFooter };

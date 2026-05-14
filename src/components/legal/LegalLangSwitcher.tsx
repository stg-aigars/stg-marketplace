import Link from 'next/link';
import { cn } from '@/lib/cn';
import {
  LEGAL_LANG_LABELS,
  type LegalDocId,
  type LegalDocLang,
} from '@/lib/legal/constants';

interface LegalLangSwitcherProps {
  doc: LegalDocId;
  activeLang: LegalDocLang;
}

/**
 * Four-pill language switcher shown above the H1 on legal document pages.
 * The active pill is non-clickable. Other pills link to the same document
 * in the chosen language: English at `/{doc}`, others at `/{doc}/{lang}`.
 *
 * Page-scoped: only rendered by `<LegalDocument>` on the three legal
 * document trees. Not part of the site-wide chrome.
 *
 * Tokens chosen to match the `NavTabs` `pill` variant at
 * `src/components/ui/nav-tabs.tsx` — the design-system precedent for this
 * affordance. The plan's `semantic-brand-soft` doesn't exist; the active
 * state uses the solid `bg-semantic-brand` shape NavTabs uses.
 */
export function LegalLangSwitcher({ doc, activeLang }: LegalLangSwitcherProps) {
  const langs: LegalDocLang[] = ['en', 'lv', 'lt', 'et'];

  return (
    <nav aria-label="Document language" className="flex flex-wrap gap-2 mb-6">
      {langs.map((lang) => {
        const isActive = lang === activeLang;
        const href = lang === 'en' ? `/${doc}` : `/${doc}/${lang}`;
        const baseClasses =
          'inline-flex items-center px-3 py-1.5 rounded-lg border text-sm transition-colors duration-250 ease-out-custom';

        if (isActive) {
          return (
            <span
              key={lang}
              aria-current="true"
              className={cn(
                baseClasses,
                'bg-semantic-brand text-semantic-text-inverse border-semantic-brand font-semibold cursor-default',
              )}
            >
              {LEGAL_LANG_LABELS[lang]}
            </span>
          );
        }

        return (
          <Link
            key={lang}
            href={href}
            className={cn(
              baseClasses,
              'border-semantic-border-subtle text-semantic-text-secondary sm:hover:bg-semantic-bg-subtle sm:hover:text-semantic-brand',
            )}
          >
            {LEGAL_LANG_LABELS[lang]}
          </Link>
        );
      })}
    </nav>
  );
}

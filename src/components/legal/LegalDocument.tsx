import type { ReactNode } from 'react';
import { LegalLangSwitcher } from './LegalLangSwitcher';
import { TranslationDisclaimerNotice } from './TranslationDisclaimerNotice';
import type { LegalDocId, LegalDocLang } from '@/lib/legal/constants';

interface LegalDocumentProps {
  doc: LegalDocId;
  lang: LegalDocLang;
  children: ReactNode;
}

/**
 * Shared shell for all twelve legal document routes (3 docs × 4 langs).
 * Renders the outer layout container, the four-pill language switcher
 * above the H1, and — for translated copies only — a per-doc-per-lang
 * disclaimer banner above the switcher.
 *
 * The H1, prose container, "Last updated" line, all numbered sections,
 * the Language clause, and the "See also" footer live inside `children`
 * (the per-language content module). The shell owns only the outer
 * layout wrapper; the prose container stays inside each content module
 * because the H1 sits as a sibling of (not child of) the prose container
 * in the EN pages, and we preserve that structure for zero visual diff.
 */
export function LegalDocument({ doc, lang, children }: LegalDocumentProps) {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
      {lang !== 'en' && <TranslationDisclaimerNotice doc={doc} lang={lang} />}
      <LegalLangSwitcher doc={doc} activeLang={lang} />
      {children}
    </div>
  );
}

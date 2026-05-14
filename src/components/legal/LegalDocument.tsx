import type { ReactNode } from 'react';
import type { LegalDocId, LegalDocLang } from '@/lib/legal/constants';

interface LegalDocumentProps {
  doc: LegalDocId;
  lang: LegalDocLang;
  children: ReactNode;
}

/**
 * Commit 1: passthrough stub. Renders only the outer `max-w-4xl` layout
 * wrapper. The H1 and the prose container live inside each `_content/{lang}.tsx`
 * module because the EN pages place the H1 as a sibling of the prose container
 * (not inside it); keeping both inside the content module preserves zero
 * visual diff during the no-op refactor.
 *
 * Commit 2 upgrades this to render the language switcher and (on translated
 * copies) the disclaimer banner between this outer wrapper and `{children}`,
 * which sits above the H1.
 */
export function LegalDocument({ children }: LegalDocumentProps) {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
      {children}
    </div>
  );
}

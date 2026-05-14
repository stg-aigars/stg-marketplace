import type { Metadata } from 'next';
import { LegalDocument } from '@/components/legal/LegalDocument';
import { LEGAL_DOC_TITLES } from '@/lib/legal/constants';
import TermsEn from './_content/en';

export const metadata: Metadata = {
  title: LEGAL_DOC_TITLES.terms.en,
  alternates: {
    canonical: '/terms',
    languages: {
      en: '/terms',
      lv: '/terms/lv',
      lt: '/terms/lt',
      et: '/terms/et',
      'x-default': '/terms',
    },
  },
};

export default function TermsPage() {
  return (
    <LegalDocument doc="terms" lang="en">
      <TermsEn />
    </LegalDocument>
  );
}

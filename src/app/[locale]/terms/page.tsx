import type { Metadata } from 'next';
import { LegalDocument } from '@/components/legal/LegalDocument';
import TermsEn from './_content/en';

export const metadata: Metadata = {
  title: 'Terms of Service',
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

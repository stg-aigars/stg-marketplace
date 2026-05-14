import type { Metadata } from 'next';
import { LegalDocument } from '@/components/legal/LegalDocument';
import { LEGAL_DOC_TITLES } from '@/lib/legal/constants';
import SellerTermsEn from './_content/en';

export const metadata: Metadata = {
  title: LEGAL_DOC_TITLES['seller-terms'].en,
  alternates: {
    canonical: '/seller-terms',
    languages: {
      en: '/seller-terms',
      lv: '/seller-terms/lv',
      lt: '/seller-terms/lt',
      et: '/seller-terms/et',
      'x-default': '/seller-terms',
    },
  },
};

export default function SellerTermsPage() {
  return (
    <LegalDocument doc="seller-terms" lang="en">
      <SellerTermsEn />
    </LegalDocument>
  );
}

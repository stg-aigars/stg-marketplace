import type { Metadata } from 'next';
import { LegalDocument } from '@/components/legal/LegalDocument';
import SellerTermsEn from './_content/en';

export const metadata: Metadata = {
  title: 'Seller Agreement',
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

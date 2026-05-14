import type { Metadata } from 'next';
import { LegalDocument } from '@/components/legal/LegalDocument';
import SellerTermsEn from './_content/en';

export const metadata: Metadata = {
  title: 'Seller Agreement',
};

export default function SellerTermsPage() {
  return (
    <LegalDocument doc="seller-terms" lang="en">
      <SellerTermsEn />
    </LegalDocument>
  );
}

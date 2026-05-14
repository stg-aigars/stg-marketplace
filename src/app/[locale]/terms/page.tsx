import type { Metadata } from 'next';
import { LegalDocument } from '@/components/legal/LegalDocument';
import TermsEn from './_content/en';

export const metadata: Metadata = {
  title: 'Terms of Service',
};

export default function TermsPage() {
  return (
    <LegalDocument doc="terms" lang="en">
      <TermsEn />
    </LegalDocument>
  );
}

import type { Metadata } from 'next';
import { LegalDocument } from '@/components/legal/LegalDocument';
import PrivacyEn from './_content/en';

export const metadata: Metadata = {
  title: 'Privacy Policy',
};

export default function PrivacyPage() {
  return (
    <LegalDocument doc="privacy" lang="en">
      <PrivacyEn />
    </LegalDocument>
  );
}

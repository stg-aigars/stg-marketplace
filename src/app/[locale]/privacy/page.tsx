import type { Metadata } from 'next';
import { LegalDocument } from '@/components/legal/LegalDocument';
import { LEGAL_DOC_TITLES } from '@/lib/legal/constants';
import PrivacyEn from './_content/en';

export const metadata: Metadata = {
  title: LEGAL_DOC_TITLES.privacy.en,
  alternates: {
    canonical: '/privacy',
    languages: {
      en: '/privacy',
      lv: '/privacy/lv',
      lt: '/privacy/lt',
      et: '/privacy/et',
      'x-default': '/privacy',
    },
  },
};

export default function PrivacyPage() {
  return (
    <LegalDocument doc="privacy" lang="en">
      <PrivacyEn />
    </LegalDocument>
  );
}

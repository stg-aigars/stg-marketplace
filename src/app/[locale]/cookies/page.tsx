import type { Metadata } from 'next';
import { LegalDocument } from '@/components/legal/LegalDocument';
import { LEGAL_DOC_TITLES } from '@/lib/legal/constants';
import CookiesEn from './_content/en';

export const metadata: Metadata = {
  title: LEGAL_DOC_TITLES.cookies.en,
  alternates: {
    canonical: '/cookies',
    languages: {
      en: '/cookies',
      lv: '/cookies/lv',
      lt: '/cookies/lt',
      et: '/cookies/et',
      'x-default': '/cookies',
    },
  },
};

export default function CookiesPage() {
  return (
    <LegalDocument doc="cookies" lang="en">
      <CookiesEn />
    </LegalDocument>
  );
}

import type { Metadata } from 'next';
import { LegalDocument } from '@/components/legal/LegalDocument';
import { LEGAL_DOC_TITLES } from '@/lib/legal/constants';
import CookiesEn from './_content/en';

export const metadata: Metadata = {
  title: LEGAL_DOC_TITLES.cookies.en,
};

export default function CookiesPage() {
  return (
    <LegalDocument doc="cookies" lang="en">
      <CookiesEn />
    </LegalDocument>
  );
}

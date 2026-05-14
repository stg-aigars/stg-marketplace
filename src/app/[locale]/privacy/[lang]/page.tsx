import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { LegalDocument } from '@/components/legal/LegalDocument';
import {
  LEGAL_DOC_TITLES,
  type LegalDocLang,
} from '@/lib/legal/constants';
import PrivacyLv from '../_content/lv';
import PrivacyLt from '../_content/lt';
import PrivacyEt from '../_content/et';

const contentModules = {
  lv: PrivacyLv,
  lt: PrivacyLt,
  et: PrivacyEt,
} as const;

/** See `app/[locale]/terms/[lang]/page.tsx` for the rationale on `force-dynamic`. */
export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const titles = LEGAL_DOC_TITLES.privacy;

  return {
    title: titles[lang as LegalDocLang] ?? titles.en,
    alternates: {
      canonical: `/privacy/${lang}`,
      languages: {
        en: '/privacy',
        lv: '/privacy/lv',
        lt: '/privacy/lt',
        et: '/privacy/et',
        'x-default': '/privacy',
      },
    },
  };
}

export default async function PrivacyLangPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const Content = contentModules[lang as keyof typeof contentModules];
  if (!Content) {
    notFound();
  }

  return (
    <LegalDocument doc="privacy" lang={lang as Exclude<LegalDocLang, 'en'>}>
      <Content />
    </LegalDocument>
  );
}

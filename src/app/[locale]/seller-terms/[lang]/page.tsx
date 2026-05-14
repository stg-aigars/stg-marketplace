import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { LegalDocument } from '@/components/legal/LegalDocument';
import {
  LEGAL_DOC_TITLES,
  type LegalDocLang,
} from '@/lib/legal/constants';
import SellerLv from '../_content/lv';
import SellerLt from '../_content/lt';
import SellerEt from '../_content/et';

const contentModules = {
  lv: SellerLv,
  lt: SellerLt,
  et: SellerEt,
} as const;

/** See `app/[locale]/terms/[lang]/page.tsx` for the rationale on `force-dynamic`. */
export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const titles = LEGAL_DOC_TITLES['seller-terms'];

  return {
    title: titles[lang as LegalDocLang] ?? titles.en,
    alternates: {
      canonical: `/seller-terms/${lang}`,
      languages: {
        en: '/seller-terms',
        lv: '/seller-terms/lv',
        lt: '/seller-terms/lt',
        et: '/seller-terms/et',
        'x-default': '/seller-terms',
      },
    },
  };
}

export default async function SellerTermsLangPage({
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
    <LegalDocument doc="seller-terms" lang={lang as Exclude<LegalDocLang, 'en'>}>
      <Content />
    </LegalDocument>
  );
}

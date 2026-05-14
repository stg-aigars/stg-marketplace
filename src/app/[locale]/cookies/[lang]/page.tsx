import type { Metadata } from 'next';
import type { JSX } from 'react';
import { notFound } from 'next/navigation';
import { LegalDocument } from '@/components/legal/LegalDocument';
import {
  LEGAL_DOC_TITLES,
  type LegalDocLang,
} from '@/lib/legal/constants';

/**
 * Commit 2: contentModules is empty so LV/LT/ET routes 404 cleanly.
 * Commit 3 imports the three translation modules and wires them up.
 */
const contentModules: Partial<
  Record<Exclude<LegalDocLang, 'en'>, () => JSX.Element>
> = {};

/** See `app/[locale]/terms/[lang]/page.tsx` for the rationale on `force-dynamic`. */
export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const titles = LEGAL_DOC_TITLES.cookies;

  return {
    title: titles[lang as LegalDocLang] ?? titles.en,
    alternates: {
      canonical: `/cookies/${lang}`,
      languages: {
        en: '/cookies',
        lv: '/cookies/lv',
        lt: '/cookies/lt',
        et: '/cookies/et',
        'x-default': '/cookies',
      },
    },
  };
}

export default async function CookiesLangPage({
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
    <LegalDocument doc="cookies" lang={lang as Exclude<LegalDocLang, 'en'>}>
      <Content />
    </LegalDocument>
  );
}

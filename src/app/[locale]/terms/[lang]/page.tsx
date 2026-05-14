import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { LegalDocument } from '@/components/legal/LegalDocument';
import {
  LEGAL_DOC_TITLES,
  type LegalDocLang,
} from '@/lib/legal/constants';
import TermsLv from '../_content/lv';
import TermsLt from '../_content/lt';
import TermsEt from '../_content/et';

const contentModules = {
  lv: TermsLv,
  lt: TermsLt,
  et: TermsEt,
} as const;

/**
 * Render dynamically. The parent `app/[locale]/layout.tsx` calls
 * `getMessages()` and renders `<AuthProvider>` / `<SiteHeader>` /
 * `<PostHogProvider>`, all of which consume cookies/headers. Declaring
 * `generateStaticParams` here marks the route SSG, which forces static-
 * rendering semantics through the layout chain and triggers
 * `DYNAMIC_SERVER_USAGE` at runtime when those cookie/header calls fire.
 * The parent EN `/terms` route is already dynamic — match that.
 *
 * Invalid `:lang` values still 404 via the `if (!Content) notFound()`
 * guard inside the page handler.
 */
export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const titles = LEGAL_DOC_TITLES.terms;

  return {
    title: titles[lang as LegalDocLang] ?? titles.en,
    alternates: {
      canonical: `/terms/${lang}`,
      languages: {
        en: '/terms',
        lv: '/terms/lv',
        lt: '/terms/lt',
        et: '/terms/et',
        'x-default': '/terms',
      },
    },
  };
}

export default async function TermsLangPage({
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
    <LegalDocument doc="terms" lang={lang as Exclude<LegalDocLang, 'en'>}>
      <Content />
    </LegalDocument>
  );
}

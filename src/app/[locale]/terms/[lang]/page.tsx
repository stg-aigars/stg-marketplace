import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { LegalDocument } from '@/components/legal/LegalDocument';
import type { LegalDocLang } from '@/lib/legal/constants';

// Commit 2: empty so LV/LT/ET routes 404 cleanly.
// Commit 3: switches to TRANSLATED_LANGS.map(...) and imports the
// content modules.
export function generateStaticParams(): Array<{ lang: string }> {
  return [];
}

// Commit 2: empty. Commit 3 adds:
//   import TermsLv from '../_content/lv';
//   import TermsLt from '../_content/lt';
//   import TermsEt from '../_content/et';
//   const contentModules = { lv: TermsLv, lt: TermsLt, et: TermsEt } as const;
const contentModules: Partial<Record<Exclude<LegalDocLang, 'en'>, () => React.JSX.Element>> = {};

const titles: Record<string, string> = {
  lv: 'Lietošanas noteikumi',
  lt: 'Paslaugų teikimo sąlygos',
  et: 'Kasutustingimused',
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;

  return {
    title: titles[lang] ?? 'Terms of Service',
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

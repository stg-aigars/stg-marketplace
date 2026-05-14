import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { LegalDocument } from '@/components/legal/LegalDocument';
import type { LegalDocLang } from '@/lib/legal/constants';

export function generateStaticParams(): Array<{ lang: string }> {
  return [];
}

const contentModules: Partial<Record<Exclude<LegalDocLang, 'en'>, () => React.JSX.Element>> = {};

const titles: Record<string, string> = {
  lv: 'Pārdevēja līgums',
  lt: 'Pardavėjo sutartis',
  et: 'Müügileping',
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;

  return {
    title: titles[lang] ?? 'Seller Agreement',
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

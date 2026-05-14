import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { LegalDocument } from '@/components/legal/LegalDocument';
import type { LegalDocLang } from '@/lib/legal/constants';

export function generateStaticParams(): Array<{ lang: string }> {
  return [];
}

const contentModules: Partial<Record<Exclude<LegalDocLang, 'en'>, () => React.JSX.Element>> = {};

const titles: Record<string, string> = {
  lv: 'Privātuma politika',
  lt: 'Privatumo politika',
  et: 'Privaatsuspoliitika',
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;

  return {
    title: titles[lang] ?? 'Privacy Policy',
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

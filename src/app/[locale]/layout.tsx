import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { AuthProvider } from '@/contexts/AuthContext';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { SiteFooter } from '@/components/layout/SiteFooter';
import '../globals.css';

const inter = Inter({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-inter',
});

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://secondturn.games';

export const metadata: Metadata = {
  title: {
    default: 'Second Turn Games',
    template: '%s | Second Turn Games',
  },
  description: 'Every game deserves a second turn. Pre-loved board games for the Baltic region.',
  openGraph: {
    type: 'website',
    siteName: 'Second Turn Games',
    title: 'Second Turn Games',
    description: 'Every game deserves a second turn. Pre-loved board games for the Baltic region.',
    url: baseUrl,
  },
  twitter: {
    card: 'summary',
    title: 'Second Turn Games',
    description: 'Every game deserves a second turn. Pre-loved board games for the Baltic region.',
  },
  metadataBase: new URL(baseUrl),
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default async function LocaleLayout({
  children,
  params: { locale },
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
    notFound();
  }

  const messages = await getMessages();

  return (
    <html lang={locale}>
      <body className={`${inter.variable} font-sans min-h-screen antialiased`}>
        <NextIntlClientProvider messages={messages}>
          <AuthProvider>
            <SiteHeader />
            <main className="min-h-[calc(100vh-theme(spacing.16))]">
              {children}
            </main>
            <SiteFooter />
          </AuthProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

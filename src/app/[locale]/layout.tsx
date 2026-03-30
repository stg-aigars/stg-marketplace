import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans, Fraunces } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { AuthProvider } from '@/contexts/AuthContext';
import { CartProvider } from '@/contexts/CartContext';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { Toaster } from '@/components/ui/toaster';
import '../globals.css';

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-sans',
  display: 'swap',
});

const fraunces = Fraunces({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-display',
  display: 'swap',
  axes: ['opsz'],
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

export default async function LocaleLayout(
  props: {
    children: React.ReactNode;
    params: Promise<{ locale: string }>;
  }
) {
  const params = await props.params;

  const {
    locale
  } = params;

  const {
    children
  } = props;

  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
    notFound();
  }

  const messages = await getMessages();

  return (
    <html lang={locale}>
      <body className={`${plusJakartaSans.variable} ${fraunces.variable} font-sans min-h-screen antialiased`}>
        <NextIntlClientProvider messages={messages}>
          <AuthProvider>
            <CartProvider>
              <SiteHeader />
              <main className="min-h-[calc(100vh-theme(spacing.16))]">
                {children}
              </main>
              <SiteFooter />
              <Toaster />
            </CartProvider>
          </AuthProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

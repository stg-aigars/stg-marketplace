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
import { StaleActionGuard } from '@/components/StaleActionGuard';
import { JsonLd } from '@/lib/seo/json-ld';
import type { SearchAction } from 'schema-dts';
import { ServiceWorkerRegistration } from '@/components/ServiceWorkerRegistration';
import NextTopLoader from 'nextjs-toploader';
import '../globals.css';

// Cookie consent: not required. Only browser cookies are Supabase auth session
// cookies (strictly necessary, exempt under GDPR/ePrivacy). Sentry is server-side
// only. Revisit if client-side analytics or tracking is added.

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
  manifest: '/manifest.webmanifest',
  icons: {
    icon: '/favicon.svg',
    apple: '/apple-touch-icon.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#6BA3B5', // semantic.brand — keep in sync with tokens.ts
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
        <NextTopLoader color="#5E9CA0" showSpinner={false} height={3} shadow={false} />
        <JsonLd data={[
          {
            '@context': 'https://schema.org',
            '@type': 'Organization',
            name: 'Second Turn Games',
            url: baseUrl,
            description: 'Pre-loved board games for the Baltic region',
            areaServed: [
              { '@type': 'Country', name: 'Latvia' },
              { '@type': 'Country', name: 'Lithuania' },
              { '@type': 'Country', name: 'Estonia' },
            ],
          },
          {
            '@context': 'https://schema.org',
            '@type': 'WebSite',
            name: 'Second Turn Games',
            url: baseUrl,
            potentialAction: {
              '@type': 'SearchAction',
              target: {
                '@type': 'EntryPoint',
                urlTemplate: `${baseUrl}/browse?q={search_term_string}`,
              },
              // Google-specific extension — not in Schema.org spec, requires type escape
              'query-input': 'required name=search_term_string',
            } as unknown as SearchAction,
          },
        ]} />
        <NextIntlClientProvider messages={messages}>
          <AuthProvider>
            <CartProvider>
              <SiteHeader />
              <main className="min-h-[calc(100vh-theme(spacing.16))]">
                {children}
              </main>
              <SiteFooter />
              <Toaster />
              <StaleActionGuard />
              <ServiceWorkerRegistration />
            </CartProvider>
          </AuthProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

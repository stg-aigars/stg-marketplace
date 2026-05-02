import Link from 'next/link';
import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import { Button } from '@/components/ui';
import { IS_PRELAUNCH } from '@/lib/constants';
import { colors } from '@/styles/tokens';

async function HomeHero() {
  const t = await getTranslations('home.hero');

  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10"
        style={{
          backgroundImage: `radial-gradient(circle, ${colors.semantic.borderStrong} 1px, transparent 1px)`,
          backgroundSize: '32px 32px',
          WebkitMaskImage:
            'radial-gradient(ellipse 60% 50% at center, black 40%, transparent 75%)',
          maskImage:
            'radial-gradient(ellipse 60% 50% at center, black 40%, transparent 75%)',
        }}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 sm:py-20 lg:py-24">
        <div className="grid lg:grid-cols-[1.2fr_1fr] gap-12 items-center">
          <div className="flex flex-col items-start gap-6">
            {IS_PRELAUNCH ? (
              <Link
                href="#sell-cta"
                className="inline-flex bg-semantic-brand text-semantic-text-inverse rounded-full px-3 py-1 text-xs font-medium max-w-full transition-colors duration-250 ease-out-custom hover:bg-semantic-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-semantic-border-focus focus-visible:ring-offset-2"
              >
                {t('statusPill')}
              </Link>
            ) : null}

            <h1 className="font-extrabold text-5xl sm:text-6xl tracking-tight leading-[1.05] text-semantic-text-heading">
              {t('headlineLeading')}
              <span className="text-semantic-primary">{t('headlineEmphasis')}</span>
              {t('headlineTrailing')}
            </h1>

            <p className="text-lg sm:text-xl text-semantic-text-secondary max-w-xl">
              {t('lede')}
            </p>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Button variant="secondary" size="lg" asChild>
                <Link href="/browse">{t('browseCta')}</Link>
              </Button>
              <Button variant="brand" size="lg" asChild>
                <Link href="/sell">{t('sellCta')}</Link>
              </Button>
            </div>
          </div>

          <div className="relative hidden lg:block aspect-[16/9] w-full rounded-lg border-2 border-polar-night shadow-pop overflow-hidden">
            <Image
              src="/images/hero-shelves.webp"
              alt={t('imageAlt')}
              fill
              priority
              sizes="(min-width: 1024px) 540px, 0px"
              className="object-cover"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

export { HomeHero };

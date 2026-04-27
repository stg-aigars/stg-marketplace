import Link from 'next/link';
import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import { Button } from '@/components/ui';

const STAT_KEYS = ['catalog', 'lockers'] as const;

async function HomeHero() {
  const t = await getTranslations('home.hero');

  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10"
        style={{
          backgroundImage:
            'radial-gradient(circle, #C0BAB0 1px, transparent 1px)',
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
            <h1 className="font-display font-medium text-5xl sm:text-6xl tracking-tight leading-[1.05] text-semantic-text-heading">
              {t('headlineLeading')}
              <span className="italic text-semantic-primary">{t('headlineEmphasis')}</span>
              {t('headlineTrailing')}
            </h1>

            <p className="text-lg sm:text-xl text-semantic-text-secondary max-w-xl">
              {t('lede')}
            </p>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Button variant="primary" size="lg" asChild>
                <Link href="/browse">{t('browseCta')}</Link>
              </Button>
              <Button variant="secondary" size="lg" asChild>
                <Link href="/sell">{t('sellCta')}</Link>
              </Button>
            </div>

            <dl className="grid grid-cols-2 divide-x divide-semantic-border-strong pt-6 w-full max-w-md">
              {STAT_KEYS.map((key) => (
                <div key={key} className="px-6 first:pl-0 last:pr-0">
                  <dt className="text-2xl sm:text-3xl font-display font-medium text-semantic-text-heading">
                    {t(`stats.${key}.value`)}
                  </dt>
                  <dd className="mt-1 text-xs uppercase tracking-wider text-semantic-text-secondary">
                    {t(`stats.${key}.label`)}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="hidden lg:block relative aspect-[4/3] w-full rounded-lg border-2 border-polar-night shadow-pop overflow-hidden">
            <Image
              src="/images/hero.webp"
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

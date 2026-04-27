import Link from 'next/link';
import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import { Button } from '@/components/ui';

const HEX_FLAT_TOP =
  'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)';

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
        <div className="grid lg:grid-cols-[1.1fr_1fr] gap-12 items-center">
          <div className="flex flex-col items-start gap-6">
            <span className="inline-flex items-center gap-2 rounded-full bg-semantic-bg-elevated border border-semantic-border-strong px-3 py-1 text-sm font-medium text-semantic-text-secondary">
              <span className="w-1.5 h-1.5 rounded-full bg-semantic-success" aria-hidden="true" />
              {t('statusPill')}
            </span>

            <h1 className="font-display font-medium text-5xl sm:text-6xl lg:text-7xl tracking-tight leading-[1.02] text-semantic-text-heading max-w-[14ch]">
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
              <Button variant="ghost" size="lg" asChild>
                <Link href="/sell">{t('sellCta')}</Link>
              </Button>
            </div>
          </div>

          <div className="relative aspect-square mx-auto w-full max-w-md lg:max-w-none">
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-polar-night scale-[1.04]"
              style={{ clipPath: HEX_FLAT_TOP, WebkitClipPath: HEX_FLAT_TOP }}
            />
            <div
              className="relative w-full h-full overflow-hidden"
              style={{ clipPath: HEX_FLAT_TOP, WebkitClipPath: HEX_FLAT_TOP }}
            >
              <Image
                src="/images/hero-hex.webp"
                alt={t('imageAlt')}
                fill
                priority
                sizes="(min-width: 1024px) 560px, (min-width: 640px) 448px, 90vw"
                className="object-cover"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export { HomeHero };

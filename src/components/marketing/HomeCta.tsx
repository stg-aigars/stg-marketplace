import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Button } from '@/components/ui';
import { colors } from '@/styles/tokens';

const RING_SPECS: Array<{ size: number; color: string }> = [
  { size: 280, color: colors.frost.ice },
  { size: 360, color: colors.semantic.primary },
  { size: 440, color: colors.semantic.success },
];

async function HomeCta() {
  const t = await getTranslations('home.cta');

  return (
    <section className="py-16 sm:py-20 lg:py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="relative overflow-hidden rounded-2xl bg-polar-night text-snow-storm-light p-10 sm:p-14 lg:p-18">
          {RING_SPECS.map(({ size, color }) => (
            <div
              key={size}
              aria-hidden="true"
              className="absolute top-0 right-0 rounded-full border-2 border-dashed pointer-events-none opacity-20 hidden lg:block"
              style={{
                width: size,
                height: size,
                transform: 'translate(50%, -33%)',
                borderColor: color,
              }}
            />
          ))}

          <div className="relative max-w-2xl">
            <p className="text-xs font-medium uppercase tracking-wider text-snow-storm/70 mb-3">
              {t('eyebrow')}
            </p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-semibold font-platform tracking-tight mb-4">
              {t('heading')}
            </h2>
            <p className="text-lg text-snow-storm/85 mb-8 max-w-xl">
              {t('body')}
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                variant="brand"
                size="lg"
                asChild
                className="border-snow-storm-light shadow-pop-inverse sm:hover:shadow-pop-inverse-lg active:shadow-pop-inverse-sm"
              >
                <Link href="/sell">{t('primaryCta')}</Link>
              </Button>
              <Button
                variant="secondary"
                size="lg"
                asChild
                className="border-snow-storm-light shadow-pop-inverse sm:hover:shadow-pop-inverse-lg active:shadow-pop-inverse-sm"
              >
                <Link href="/browse">{t('secondaryCta')}</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export { HomeCta };

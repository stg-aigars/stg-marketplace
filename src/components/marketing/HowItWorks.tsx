import { getTranslations } from 'next-intl/server';
import { Card } from '@/components/ui';

type StepKey = '1' | '2' | '3';

const STEP_ACCENT: Record<StepKey, string> = {
  '1': 'bg-semantic-primary text-semantic-text-primary-ink',
  '2': 'bg-semantic-brand text-semantic-text-inverse',
  '3': 'bg-semantic-success text-polar-night',
};

async function HowItWorks() {
  const t = await getTranslations('home.howItWorks');
  const stepKeys: StepKey[] = ['1', '2', '3'];

  return (
    <section className="py-16 sm:py-20 lg:py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="mb-12 max-w-2xl">
          <p className="text-xs font-medium uppercase tracking-wider text-semantic-text-secondary mb-3">
            {t('eyebrow')}
          </p>
          <h2 className="text-xl sm:text-2xl font-semibold font-display tracking-tight text-semantic-text-heading">
            {t('heading')}
          </h2>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {stepKeys.map((key) => (
            <Card
              key={key}
              className="relative border-2 border-semantic-border-strong rounded-lg p-8 pt-10 shadow-none"
            >
              <span
                className={
                  'absolute -top-4 left-6 inline-flex items-center justify-center px-3 py-1 rounded-md text-sm font-semibold tracking-wider border-2 border-polar-night ' +
                  STEP_ACCENT[key]
                }
              >
                {t(`steps.${key}.tag`)}
              </span>
              <h3 className="text-base font-semibold text-semantic-text-heading mb-2">
                {t(`steps.${key}.title`)}
              </h3>
              <p className="text-semantic-text-secondary leading-relaxed">
                {t(`steps.${key}.body`)}
              </p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

export { HowItWorks };

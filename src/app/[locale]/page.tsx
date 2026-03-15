import { useTranslations } from 'next-intl';

export default function HomePage() {
  const t = useTranslations();

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      <section className="py-8 sm:py-10 lg:py-12 text-center">
        <h1 className="text-2xl sm:text-3xl font-bold text-semantic-text-heading">
          {t('home.hero')}
        </h1>
        <p className="mt-3 text-base sm:text-lg text-semantic-text-secondary max-w-2xl mx-auto">
          {t('home.heroSub')}
        </p>
        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <a
            href="/browse"
            className="inline-flex items-center justify-center min-h-[48px] px-6 py-3 rounded-lg bg-semantic-primary text-semantic-text-inverse font-medium text-base active:scale-[0.98] transition-transform sm:hover:bg-semantic-primary-hover"
          >
            {t('home.browseCta')}
          </a>
          <a
            href="/sell"
            className="inline-flex items-center justify-center min-h-[48px] px-6 py-3 rounded-lg bg-semantic-bg-elevated text-semantic-text-primary border border-semantic-border-default font-medium text-base active:scale-[0.98] transition-transform sm:hover:shadow-md"
          >
            {t('home.sellCta')}
          </a>
        </div>
      </section>
    </main>
  );
}

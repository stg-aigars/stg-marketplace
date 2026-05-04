import type { Metadata } from 'next';
import Link from 'next/link';
import { Card, CardBody, ConditionBadge } from '@/components/ui';
import { conditionConfig, conditionGuide } from '@/lib/condition-config';
import { conditionToBadgeKey, LISTING_CONDITIONS } from '@/lib/listings/types';

export const metadata: Metadata = {
  title: 'Condition guide',
  description:
    'How sellers grade pre-loved board games on Second Turn Games — what each of the five tiers means and what to expect at each.',
};

export default function ConditionGuidePage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
      <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-semantic-text-heading mb-4">
        Condition guide
      </h1>

      <p className="text-semantic-text-secondary mb-8 leading-relaxed">
        Every listing on Second Turn Games is graded on the same five-tier scale. The bar
        shifts gradually — from a copy that looks new to one sold for parts — and sellers
        are asked to grade honestly so what arrives matches what was promised. If a copy
        does not fit cleanly into a tier, sellers drop one tier down.
      </p>

      <div className="space-y-4">
        {LISTING_CONDITIONS.map((condition) => {
          const key = conditionToBadgeKey[condition];
          const config = conditionConfig[key];
          const guide = conditionGuide[key];
          return (
            <Card key={condition}>
              <CardBody className="space-y-3">
                <div className="flex items-center gap-3">
                  <ConditionBadge condition={condition} />
                  <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-semantic-text-heading">
                    {config.label}
                  </h2>
                </div>
                <p className="text-semantic-text-primary leading-relaxed">{guide.detail}</p>
                <p className="text-sm italic text-semantic-text-muted">
                  Example: {guide.example}
                </p>
                <div className="pt-3 border-t border-semantic-border-subtle">
                  <p className="text-sm text-semantic-text-secondary">
                    <span className="font-semibold text-semantic-text-heading">Selling? </span>
                    {guide.sellerHint}
                  </p>
                </div>
              </CardBody>
            </Card>
          );
        })}
      </div>

      <p className="mt-12 text-sm text-semantic-text-secondary">
        Ready to list a game?{' '}
        <Link href="/sell" className="link-brand">
          List a game
        </Link>
        .
      </p>
    </div>
  );
}

// TODO: This component is no longer used by ListingCreationFlow (replaced by ReviewPriceStep).
// Keep for now — verify no other consumers before removing.
'use client';

import Image from 'next/image';
import { CalendarBlank, Buildings, Translate } from '@phosphor-icons/react/ssr';
import { Card, CardBody, Badge, Button } from '@/components/ui';
import { conditionConfig } from '@/lib/condition-config';
import { conditionToBadgeKey } from '@/lib/listings/types';
import { calculateSellerEarnings, formatCentsToCurrency } from '@/lib/services/pricing';
import type { FormData } from './ListingCreationFlow';

interface ReviewStepProps {
  formData: FormData;
  onPublish: () => void;
  publishing: boolean;
  error: string | null;
}

export function ReviewStep({
  formData,
  onPublish,
  publishing,
  error,
}: ReviewStepProps) {
  const isAuction = formData.starting_price_cents > 0 && formData.auction_duration_days > 0;
  const effectivePrice = isAuction ? formData.starting_price_cents : formData.price_cents;
  const earnings = calculateSellerEarnings(effectivePrice);
  const badgeKey = formData.condition ? conditionToBadgeKey[formData.condition] : null;
  const conditionLabel = badgeKey ? conditionConfig[badgeKey].label : '';

  const hasEdition =
    formData.version_name || formData.publisher || formData.language || formData.edition_year;

  return (
    <div className="space-y-6">
      <h2 className="text-xl sm:text-2xl font-semibold font-display tracking-tight text-semantic-text-heading">
        Review your listing
      </h2>

      <Card>
        <CardBody>
          <div className="space-y-5">
            {/* Game + Edition */}
            <div className="flex items-start gap-4">
              {(formData.version_thumbnail || formData.game_image || formData.game_thumbnail) && (
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-lg overflow-hidden shrink-0 relative bg-semantic-bg-secondary">
                  <Image
                    src={formData.version_thumbnail ?? formData.game_image ?? formData.game_thumbnail ?? ''}
                    alt={formData.game_name}
                    fill
                    className="object-contain"
                    sizes="96px"
                    unoptimized
                  />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-semantic-text-heading text-lg">
                  {formData.game_name}
                </h3>
                {hasEdition ? (
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-semantic-text-muted mt-0.5">
                    {formData.version_name && <span>{formData.version_name}</span>}
                    {formData.publisher && (
                      <span className="flex items-center gap-1">
                        <Buildings size={14} className="shrink-0" />
                        {formData.publisher}
                      </span>
                    )}
                    {formData.language && (
                      <span className="flex items-center gap-1">
                        <Translate size={14} className="shrink-0" />
                        {formData.language}
                      </span>
                    )}
                    {formData.edition_year && (
                      <span className="flex items-center gap-1">
                        <CalendarBlank size={14} className="shrink-0" />
                        {formData.edition_year}
                      </span>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-semantic-text-muted mt-0.5">
                    No edition specified
                  </p>
                )}
              </div>
            </div>

            <hr className="border-semantic-border-subtle" />

            {/* Condition */}
            <div>
              <p className="text-sm font-medium text-semantic-text-primary mb-1">
                Condition
              </p>
              {badgeKey && (
                <Badge condition={badgeKey}>{conditionLabel}</Badge>
              )}
            </div>

            <hr className="border-semantic-border-subtle" />

            {/* Price */}
            <div>
              <p className="text-sm font-medium text-semantic-text-primary mb-1">
                {isAuction ? 'Starting price' : 'Price'}
              </p>
              <p className="text-lg font-semibold text-semantic-text-heading">
                {formatCentsToCurrency(effectivePrice)}
              </p>
              {isAuction ? (
                <p className="text-sm text-semantic-text-muted">
                  {formData.auction_duration_days}-day auction. 10% commission on winning bid.
                </p>
              ) : (
                <p className="text-sm text-semantic-text-muted">
                  You&apos;ll receive {formatCentsToCurrency(earnings.walletCreditCents)} after 10% platform fee
                </p>
              )}
            </div>

            <hr className="border-semantic-border-subtle" />

            {/* Photos */}
            <div>
              <p className="text-sm font-medium text-semantic-text-primary mb-2">
                Photos ({formData.photos.length})
              </p>
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                {formData.photos.map((url, index) => (
                  <div key={url} className="aspect-square relative rounded-lg overflow-hidden border border-semantic-border-subtle">
                    <Image
                      src={url}
                      alt={`Photo ${index + 1}`}
                      fill
                      className="object-cover"
                      sizes="(max-width: 640px) 25vw, 16vw"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Description */}
            {formData.description && (
              <>
                <hr className="border-semantic-border-subtle" />
                <div>
                  <p className="text-sm font-medium text-semantic-text-primary mb-1">
                    Description
                  </p>
                  <p className="text-sm text-semantic-text-secondary whitespace-pre-line">
                    {formData.description}
                  </p>
                </div>
              </>
            )}
          </div>
        </CardBody>
      </Card>

      {/* Error */}
      {error && (
        <div className="bg-semantic-error/10 border border-semantic-error/20 rounded-lg px-4 py-3">
          <p className="text-sm text-semantic-error">{error}</p>
        </div>
      )}

      {/* Publish button */}
      <Button
        variant="primary"
        size="lg"
        onClick={onPublish}
        loading={publishing}
        className="w-full"
      >
        Publish listing
      </Button>

      <p className="text-xs text-semantic-text-muted text-center">
        Your listing will be visible to buyers across Latvia, Lithuania, and Estonia
      </p>
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { CalendarBlank, Buildings, Translate, PencilSimple } from '@phosphor-icons/react/ssr';
import { Card, CardBody, Badge, Button, Input, Select } from '@/components/ui';
import { conditionConfig } from '@/lib/condition-config';
import { conditionToBadgeKey, MIN_PRICE_CENTS } from '@/lib/listings/types';
import { calculateSellerEarnings, formatCentsToCurrency } from '@/lib/services/pricing';
import { normalizeDecimalInput } from '@/lib/utils/decimal-input';
import { toBggFullSize, isBggImage } from '@/lib/bgg/utils';
import { AUCTION_DURATION_OPTIONS } from '@/lib/auctions/types';
import { PricingAssistant } from './PricingAssistant';
import type { FormData } from './ListingCreationFlow';

interface ReviewPriceStepProps {
  formData: FormData;
  gameImageUrl: string | null;
  onPriceChange: (cents: number) => void;
  onPublish: () => void;
  publishing: boolean;
  error: string | null;
  onEditStep: (step: number) => void;
  lockedPrice?: number;
  isAuction?: boolean;
  auctionDurationDays?: number;
  onDurationChange?: (days: number) => void;
}

// --- Price input sub-component (co-located to manage complexity) ---

interface PriceInputSectionProps {
  priceCents: number;
  onPriceChange: (cents: number) => void;
  lockedPrice?: number;
  isAuction: boolean;
  auctionDurationDays?: number;
  onDurationChange?: (days: number) => void;
  bggGameId: number | null;
  condition: FormData['condition'];
}

function PriceInputSection({
  priceCents,
  onPriceChange,
  lockedPrice,
  isAuction,
  auctionDurationDays,
  onDurationChange,
  bggGameId,
  condition,
}: PriceInputSectionProps) {
  const [displayPrice, setDisplayPrice] = useState(() =>
    priceCents > 0 ? (priceCents / 100).toFixed(2) : ''
  );

  // Sync display when priceCents changes externally (e.g. PricingAssistant fill)
  useEffect(() => {
    if (priceCents === 0 && displayPrice === '') return;
    const displayCents = Math.round(parseFloat(displayPrice || '0') * 100);
    if (displayCents !== priceCents) {
      setDisplayPrice(priceCents > 0 ? (priceCents / 100).toFixed(2) : '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [priceCents]);

  const handlePriceChange = (value: string) => {
    const cleaned = normalizeDecimalInput(value);
    setDisplayPrice(cleaned);

    const parsed = parseFloat(cleaned);
    if (!isNaN(parsed) && parsed >= 0) {
      onPriceChange(Math.round(parsed * 100));
    } else if (cleaned === '' || cleaned === '.') {
      onPriceChange(0);
    }
  };

  const earnings = priceCents > 0 ? calculateSellerEarnings(priceCents) : null;
  const showMinError = priceCents > 0 && priceCents < MIN_PRICE_CENTS;

  if (lockedPrice !== undefined) {
    return (
      <div className="bg-semantic-bg-surface rounded-lg px-4 py-3 space-y-1">
        <p className="text-sm text-semantic-text-muted">Agreed price</p>
        <p className="text-lg font-semibold text-semantic-text-primary">
          {formatCentsToCurrency(lockedPrice)}
        </p>
        {earnings && (
          <p className="text-sm text-semantic-text-secondary">
            You&apos;ll receive{' '}
            <span className="font-medium text-semantic-text-primary">
              {formatCentsToCurrency(earnings.walletCreditCents)}
            </span>{' '}
            after 10% platform fee
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PricingAssistant
        bggGameId={bggGameId}
        condition={condition ?? null}
        isAuction={isAuction}
        onFillPrice={onPriceChange}
      />

      <Input
        label={isAuction ? 'Starting price' : 'Price'}
        type="text"
        inputMode="decimal"
        prefix="€"
        value={displayPrice}
        onChange={(e) => handlePriceChange(e.target.value)}
        placeholder="0.00"
        error={showMinError ? `Minimum price is ${formatCentsToCurrency(MIN_PRICE_CENTS)}` : undefined}
      />

      {isAuction && onDurationChange && (
        <Select
          label="Auction duration"
          options={AUCTION_DURATION_OPTIONS}
          value={String(auctionDurationDays ?? 3)}
          onChange={(e) => onDurationChange(parseInt(e.target.value, 10))}
        />
      )}

      {isAuction && priceCents >= MIN_PRICE_CENTS && (
        <div className="bg-semantic-bg-surface rounded-lg px-4 py-3 space-y-1">
          <p className="text-sm text-semantic-text-secondary">
            Bids start at{' '}
            <span className="font-medium text-semantic-text-primary">
              {formatCentsToCurrency(priceCents)}
            </span>
            . Minimum increment: €1.00
          </p>
          <p className="text-xs text-semantic-text-muted">
            Bids are final and cannot be withdrawn. 10% commission applies to the winning bid.
          </p>
        </div>
      )}

      {!isAuction && earnings && priceCents >= MIN_PRICE_CENTS && (
        <div className="bg-semantic-bg-surface rounded-lg px-4 py-3">
          <p className="text-sm text-semantic-text-secondary">
            You&apos;ll receive{' '}
            <span className="font-bold text-semantic-text-primary">
              {formatCentsToCurrency(earnings.walletCreditCents)}
            </span>{' '}
            after 10% platform fee
          </p>
        </div>
      )}
    </div>
  );
}

// --- Main ReviewPriceStep ---

export function ReviewPriceStep({
  formData,
  gameImageUrl,
  onPriceChange,
  onPublish,
  publishing,
  error,
  onEditStep,
  lockedPrice,
  isAuction = false,
  auctionDurationDays,
  onDurationChange,
}: ReviewPriceStepProps) {
  const effectivePrice = isAuction ? formData.starting_price_cents : formData.price_cents;
  const earnings = effectivePrice > 0 ? calculateSellerEarnings(effectivePrice) : null;
  const badgeKey = formData.condition ? conditionToBadgeKey[formData.condition] : null;
  const conditionLabel = badgeKey ? conditionConfig[badgeKey].label : '';

  const hasEdition =
    formData.version_name || formData.publisher || formData.language || formData.edition_year;

  const fullSizeImageUrl = toBggFullSize(gameImageUrl);
  const summaryImageUrl = toBggFullSize(formData.version_thumbnail) ?? toBggFullSize(formData.game_image) ?? toBggFullSize(formData.game_thumbnail) ?? '';

  return (
    <div className="space-y-6">
      <h2 className="text-xl sm:text-2xl font-semibold font-display tracking-tight text-semantic-text-heading">
        Review and publish
      </h2>

      {/* Price input */}
      <PriceInputSection
        priceCents={effectivePrice}
        onPriceChange={onPriceChange}
        lockedPrice={lockedPrice}
        isAuction={isAuction}
        auctionDurationDays={auctionDurationDays}
        onDurationChange={onDurationChange}
        bggGameId={formData.bgg_game_id}
        condition={formData.condition}
      />

      {/* Listing summary */}
      <Card>
        <CardBody>
          <div className="space-y-5">
            {/* Game + Edition */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-4 min-w-0">
                {summaryImageUrl && (
                  <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-lg overflow-hidden shrink-0 relative bg-semantic-bg-secondary">
                    <Image
                      src={summaryImageUrl}
                      alt={formData.game_name}
                      fill
                      className="object-contain"
                      sizes="96px"
                      unoptimized={isBggImage(summaryImageUrl)}
                    />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-semantic-text-heading text-lg">
                    {formData.game_name}
                  </h3>
                  {formData.game_year && (
                    <p className="text-sm text-semantic-text-muted mt-0.5">
                      {formData.game_year}
                    </p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => onEditStep(1)}
                className="text-semantic-brand shrink-0 p-1"
                aria-label="Edit game"
              >
                <PencilSimple size={16} />
              </button>
            </div>

            <hr className="border-semantic-border-subtle" />

            {/* Edition */}
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-semantic-text-primary mb-1">
                  Edition
                </p>
                {hasEdition ? (
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-semantic-text-muted">
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
                  <p className="text-sm text-semantic-text-muted">
                    No edition specified
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => onEditStep(2)}
                className="text-semantic-brand shrink-0 p-1"
                aria-label="Edit edition"
              >
                <PencilSimple size={16} />
              </button>
            </div>

            <hr className="border-semantic-border-subtle" />

            {/* Condition + notes */}
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-semantic-text-primary mb-1">
                  Condition
                </p>
                {badgeKey && (
                  <Badge condition={badgeKey}>{conditionLabel}</Badge>
                )}
                {formData.description && (
                  <p className="text-sm text-semantic-text-secondary whitespace-pre-line mt-2">
                    {formData.description}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => onEditStep(3)}
                className="text-semantic-brand shrink-0 p-1"
                aria-label="Edit condition and photos"
              >
                <PencilSimple size={16} />
              </button>
            </div>

            <hr className="border-semantic-border-subtle" />

            {/* Photos */}
            <div>
              <p className="text-sm font-medium text-semantic-text-primary mb-2">
                Photos {formData.photos.length > 0 && `(${formData.photos.length})`}
              </p>
              {formData.photos.length > 0 ? (
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
              ) : fullSizeImageUrl ? (
                <div className="flex items-center gap-3">
                  <div className="w-16 h-16 rounded-lg overflow-hidden shrink-0 relative bg-semantic-bg-secondary">
                    <Image
                      src={fullSizeImageUrl}
                      alt="Game cover"
                      fill
                      className="object-contain"
                      sizes="64px"
                      unoptimized={isBggImage(fullSizeImageUrl)}
                    />
                  </div>
                  <p className="text-sm text-semantic-text-muted">
                    Using game cover image
                  </p>
                </div>
              ) : null}
            </div>

            <hr className="border-semantic-border-subtle" />

            {/* Price summary */}
            <div>
              <p className="text-sm font-medium text-semantic-text-primary mb-1">
                {isAuction ? 'Starting price' : 'Price'}
              </p>
              {effectivePrice >= MIN_PRICE_CENTS ? (
                <>
                  <p className="text-lg font-semibold text-semantic-text-heading">
                    {formatCentsToCurrency(effectivePrice)}
                  </p>
                  {isAuction ? (
                    <p className="text-sm text-semantic-text-muted">
                      {formData.auction_duration_days}-day auction. 10% commission on winning bid.
                    </p>
                  ) : earnings ? (
                    <p className="text-sm text-semantic-text-muted">
                      You&apos;ll receive {formatCentsToCurrency(earnings.walletCreditCents)} after 10% platform fee
                    </p>
                  ) : null}
                </>
              ) : (
                <p className="text-sm text-semantic-text-muted">
                  Enter a price above
                </p>
              )}
            </div>
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
        disabled={effectivePrice < MIN_PRICE_CENTS}
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

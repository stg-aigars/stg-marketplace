'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { PencilSimple, Eye } from '@phosphor-icons/react/ssr';
import { ConditionBadge, Button, Input, Select } from '@/components/ui';
import { ListingPreviewCard } from '@/components/listings/ListingPreviewCard';
import { MIN_PRICE_CENTS } from '@/lib/listings/types';
import { calculateSellerEarnings, formatCentsToCurrency } from '@/lib/services/pricing';
import { normalizeDecimalInput } from '@/lib/utils/decimal-input';
import { AUCTION_DURATION_OPTIONS } from '@/lib/auctions/types';
import { PricingAssistant } from './PricingAssistant';
import { SellStepHeader } from './SellStepHeader';
import type { FormData } from './ListingCreationFlow';

interface ReviewPriceStepProps {
  formData: FormData;
  onPriceChange: (cents: number) => void;
  onPublish: () => void;
  publishing: boolean;
  // Falsy when the Turnstile widget hasn't yet produced a token (or has just been
  // reset after an error). The Publish button stays disabled in that window so we
  // don't send an empty/stale token and surface a "Verification failed" toast.
  turnstileReady: boolean;
  error: string | null;
  onEditStep: (step: number) => void;
  lockedPrice?: number;
  isAuction?: boolean;
  auctionDurationDays?: number;
  onDurationChange?: (days: number) => void;
  expansions?: Array<{ id: number; name: string }>;
  /** ISO country code for the seller's flag in the preview card. */
  userCountry: string | null;
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
  gameName?: string;
  condition: FormData['condition'];
  expansionIds?: number[];
  expansionNames?: Record<number, string>;
}

function PriceInputSection({
  priceCents,
  onPriceChange,
  lockedPrice,
  isAuction,
  auctionDurationDays,
  onDurationChange,
  bggGameId,
  gameName,
  condition,
  expansionIds = [],
  expansionNames = {},
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
        gameName={gameName}
        condition={condition ?? null}
        isAuction={isAuction}
        onFillPrice={onPriceChange}
        expansionIds={expansionIds}
        expansionNames={expansionNames}
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
  onPriceChange,
  onPublish,
  publishing,
  turnstileReady,
  error,
  onEditStep,
  lockedPrice,
  isAuction = false,
  auctionDurationDays,
  onDurationChange,
  expansions = [],
  userCountry,
}: ReviewPriceStepProps) {
  const effectivePrice = isAuction ? formData.starting_price_cents : formData.price_cents;

  const expansionNames = useMemo(
    () => expansions.reduce((acc, e) => ({ ...acc, [e.id]: e.name }), {} as Record<number, string>),
    [expansions],
  );

  const gameSummary = [formData.game_name, formData.game_year].filter(Boolean).join(' · ');
  const editionSummary = [
    formData.version_name,
    formData.language,
    formData.publisher,
    formData.edition_year,
  ]
    .filter(Boolean)
    .join(' · ');
  const photoCountLabel = formData.photos.length === 1 ? '1 photo' : `${formData.photos.length} photos`;

  return (
    <div className="space-y-8">
      <SellStepHeader
        variant="icon"
        title="How buyers will see it"
        helper="This is exactly what shows up on browse."
        icon={<Eye size={24} weight="duotone" />}
      />

      {/* Browse-card preview */}
      <div className="max-w-xs mx-auto sm:mx-0">
        <ListingPreviewCard
          gameTitle={formData.game_name}
          gameThumbnail={formData.version_thumbnail ?? formData.game_image ?? formData.game_thumbnail}
          firstPhoto={formData.photos[0] ?? null}
          photoCount={formData.photos.length}
          priceCents={effectivePrice}
          sellerCountry={userCountry ?? ''}
          expansionCount={expansions.length}
          isExpansion={formData.is_expansion}
          isAuction={isAuction}
          bidCount={0}
        />
        {isAuction && auctionDurationDays !== undefined && (
          <p className="mt-2 text-sm text-semantic-text-muted text-center sm:text-left">
            {auctionDurationDays}-day auction. 10% commission on winning bid.
          </p>
        )}
      </div>

      <hr className="border-semantic-border-subtle" />

      {/* Game edit row */}
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-semibold text-semantic-text-secondary uppercase tracking-wide">
            Game
          </p>
          <button
            type="button"
            onClick={() => onEditStep(1)}
            className="text-semantic-brand shrink-0 p-1"
            aria-label="Edit game"
          >
            <PencilSimple size={16} />
          </button>
        </div>
        <p className="text-sm text-semantic-text-primary">{gameSummary}</p>
        {expansions.length > 0 && (
          <p className="text-sm text-semantic-text-muted">
            +{expansions.length} {expansions.length === 1 ? 'expansion' : 'expansions'}:{' '}
            {expansions.map((e) => e.name).join(', ')}
          </p>
        )}
      </div>

      <hr className="border-semantic-border-subtle" />

      {/* Edition edit row */}
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-semibold text-semantic-text-secondary uppercase tracking-wide">
            Edition
          </p>
          <button
            type="button"
            onClick={() => onEditStep(2)}
            className="text-semantic-brand shrink-0 p-1"
            aria-label="Edit edition"
          >
            <PencilSimple size={16} />
          </button>
        </div>
        <p className="text-sm text-semantic-text-primary">
          {editionSummary || <span className="text-semantic-text-muted">No edition selected</span>}
        </p>
      </div>

      <hr className="border-semantic-border-subtle" />

      {/* Condition + Photos edit row */}
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-semibold text-semantic-text-secondary uppercase tracking-wide">
            Condition &amp; photos
          </p>
          <button
            type="button"
            onClick={() => onEditStep(3)}
            className="text-semantic-brand shrink-0 p-1"
            aria-label="Edit condition and photos"
          >
            <PencilSimple size={16} />
          </button>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {formData.condition && <ConditionBadge condition={formData.condition} />}
          {formData.photos.length > 0 && (
            <span className="text-sm text-semantic-text-muted">{photoCountLabel}</span>
          )}
        </div>
        {formData.description && (
          <p className="text-sm text-semantic-text-secondary whitespace-pre-line">
            {formData.description}
          </p>
        )}
      </div>

      <hr className="border-semantic-border-subtle" />

      {/* Price input + price guide */}
      <PriceInputSection
        priceCents={effectivePrice}
        onPriceChange={onPriceChange}
        lockedPrice={lockedPrice}
        isAuction={isAuction}
        auctionDurationDays={auctionDurationDays}
        onDurationChange={onDurationChange}
        bggGameId={formData.bgg_game_id}
        gameName={formData.game_name}
        condition={formData.condition}
        expansionIds={formData.selected_expansion_ids}
        expansionNames={expansionNames}
      />

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
        disabled={effectivePrice < MIN_PRICE_CENTS || !turnstileReady}
        className="w-full"
      >
        Publish listing
      </Button>

      <p className="text-xs text-semantic-text-muted text-center">
        By publishing, you confirm you are at least 18 and agree to our{' '}
        <Link
          href="/seller-terms"
          className="link-brand"
        >
          Seller Agreement
        </Link>
      </p>
    </div>
  );
}

'use client';

import { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { PencilSimple, Eye } from '@phosphor-icons/react/ssr';
import { GameIdentityRow } from '@/components/listings/atoms';
import { ConditionBadge, Button, Input } from '@/components/ui';
import { MIN_PRICE_CENTS } from '@/lib/listings/types';
import { calculateSellerEarnings, formatCentsToCurrency } from '@/lib/services/pricing';
import { normalizeDecimalInput } from '@/lib/utils/decimal-input';
import { toBggFullSize } from '@/lib/bgg/utils';
import { AUCTION_DURATION_OPTIONS } from '@/lib/auctions/types';
import { cn } from '@/lib/cn';
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
        <div className="space-y-3">
          {/* Visual separator from the pricing block above */}
          <hr className="border-semantic-border-subtle" />

          <p className="text-sm font-semibold text-semantic-text-secondary uppercase tracking-wide">
            Auction settings
          </p>

          <div>
            <label className="block text-sm font-medium text-semantic-text-secondary mb-2">
              Auction duration
            </label>
            <div role="radiogroup" aria-label="Auction duration" className="grid grid-cols-2 gap-2">
              {AUCTION_DURATION_OPTIONS.map((opt) => {
                const selected = String(auctionDurationDays ?? 7) === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => onDurationChange(parseInt(opt.value, 10))}
                    className={cn(
                      'rounded-lg px-4 py-3 text-sm font-medium transition-colors duration-250 ease-out-custom',
                      selected
                        ? 'border-2 border-semantic-brand bg-semantic-brand/10 text-semantic-text-primary'
                        : 'border border-semantic-border-default text-semantic-text-secondary hover:border-semantic-border-strong',
                    )}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Soft-close info row */}
          <div className="bg-semantic-bg-surface rounded-lg px-4 py-3">
            <p className="text-sm text-semantic-text-secondary">
              If someone bids in the final 24 hours, the auction extends by 24 hours. It ends when 24 hours pass with no new bid.
            </p>
          </div>
        </div>
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
}: ReviewPriceStepProps) {
  const effectivePrice = isAuction ? formData.starting_price_cents : formData.price_cents;

  const summaryImageUrl = toBggFullSize(formData.version_thumbnail) ?? toBggFullSize(formData.game_image) ?? toBggFullSize(formData.game_thumbnail) ?? null;

  const expansionNames = useMemo(
    () => expansions.reduce((acc, e) => ({ ...acc, [e.id]: e.name }), {} as Record<number, string>),
    [expansions],
  );

  return (
    <div className="space-y-8">
      <SellStepHeader
        variant="icon"
        title="Review and publish"
        helper="Last look before it goes live."
        icon={<Eye size={24} weight="duotone" />}
      />

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

      <hr className="border-semantic-border-subtle" />

      {/* Game + Edition */}
      <div className="space-y-3">
        <p className="text-sm font-semibold text-semantic-text-secondary uppercase tracking-wide">
          Game &amp; edition
        </p>
        <GameIdentityRow
          thumbnail={summaryImageUrl}
          name={formData.game_name}
          versionName={formData.version_name}
          language={formData.language}
          publisher={formData.publisher}
          year={formData.edition_year}
          size="xl"
          action={
            <button
              type="button"
              onClick={() => onEditStep(1)}
              className="text-semantic-brand shrink-0 p-1"
              aria-label="Edit game and edition"
            >
              <PencilSimple size={16} />
            </button>
          }
        />
        {expansions.length > 0 && (
          <p className="text-sm text-semantic-text-muted">
            +{expansions.length} {expansions.length === 1 ? 'expansion' : 'expansions'}:{' '}
            {expansions.map((e) => e.name).join(', ')}
          </p>
        )}
      </div>

      <hr className="border-semantic-border-subtle" />

      {/* Condition + notes */}
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-semibold text-semantic-text-secondary uppercase tracking-wide">
            Condition
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
        {formData.condition && <ConditionBadge condition={formData.condition} />}
        {formData.description && (
          <p className="text-sm text-semantic-text-secondary whitespace-pre-line">
            {formData.description}
          </p>
        )}
      </div>

      {formData.photos.length > 0 && (
        <>
          <hr className="border-semantic-border-subtle" />

          {/* Photos */}
          <div className="space-y-3">
            <p className="text-sm font-semibold text-semantic-text-secondary uppercase tracking-wide">
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
        </>
      )}

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

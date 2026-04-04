'use client';

import { useState, useEffect } from 'react';
import { Input, Select, Textarea } from '@/components/ui';
import { calculateSellerEarnings, formatCentsToCurrency } from '@/lib/services/pricing';
import { MIN_PRICE_CENTS, MAX_DESCRIPTION_LENGTH, conditionRequiresDescription } from '@/lib/listings/types';
import type { ListingCondition } from '@/lib/listings/types';
import { normalizeDecimalInput } from '@/lib/utils/decimal-input';
import { AUCTION_DURATION_OPTIONS } from '@/lib/auctions/types';
import { PricingAssistant } from './PricingAssistant';

interface PriceStepProps {
  priceCents: number;
  description: string;
  onPriceChange: (cents: number) => void;
  onDescriptionChange: (desc: string) => void;
  compact?: boolean;
  lockedPrice?: number;
  isAuction?: boolean;
  auctionDurationDays?: number;
  onDurationChange?: (days: number) => void;
  bggGameId?: number | null;
  condition?: ListingCondition | null;
}

export function PriceStep({
  priceCents,
  description,
  onPriceChange,
  onDescriptionChange,
  compact,
  lockedPrice,
  isAuction,
  auctionDurationDays,
  onDurationChange,
  bggGameId,
  condition,
}: PriceStepProps) {
  const [displayPrice, setDisplayPrice] = useState(() =>
    priceCents > 0 ? (priceCents / 100).toFixed(2) : ''
  );

  // Sync display when priceCents changes externally
  useEffect(() => {
    if (priceCents === 0 && displayPrice === '') return;
    const displayCents = Math.round(parseFloat(displayPrice || '0') * 100);
    if (displayCents !== priceCents) {
      setDisplayPrice(priceCents > 0 ? (priceCents / 100).toFixed(2) : '');
    }
    // Only sync on external priceCents changes
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

  return (
    <div className="space-y-6">
      {compact ? (
        <h2 className="text-base font-semibold text-semantic-text-heading">Price and description</h2>
      ) : (
        <div>
          <h2 className="text-xl sm:text-2xl font-semibold font-display tracking-tight text-semantic-text-heading">
            {isAuction ? 'Set your auction' : 'Set your price'}
          </h2>
          <p className="text-sm text-semantic-text-secondary mt-1">
            {isAuction
              ? 'Set a starting price and duration. Bidders compete — the highest bid wins.'
              : 'Choose a fair price for your pre-loved game. Buyers pay this plus shipping.'}
          </p>
        </div>
      )}

      {lockedPrice === undefined && (
        <PricingAssistant
          bggGameId={bggGameId ?? null}
          condition={condition ?? null}
          isAuction={!!isAuction}
          onFillPrice={onPriceChange}
        />
      )}

      {lockedPrice !== undefined ? (
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
      ) : (
        <>
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
        </>
      )}

      <div>
        <label
          htmlFor="listing-description"
          className="block text-sm font-medium text-semantic-text-primary mb-1.5"
        >
          Description{' '}
          {condition && conditionRequiresDescription(condition) ? (
            <span className="text-semantic-error">*</span>
          ) : (
            <span className="font-normal text-semantic-text-muted">(optional)</span>
          )}
        </label>
        <Textarea
          id="listing-description"
          value={description}
          onChange={(e) => {
            if (e.target.value.length <= MAX_DESCRIPTION_LENGTH) {
              onDescriptionChange(e.target.value);
            }
          }}
          placeholder="Describe your copy — missing components, notable wear, or anything a buyer should know"
          rows={4}
        />
        <p className="mt-1 text-xs text-semantic-text-muted text-right">
          {description.length}/{MAX_DESCRIPTION_LENGTH}
        </p>
      </div>
    </div>
  );
}

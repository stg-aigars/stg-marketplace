'use client';

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui';
import { calculateSellerEarnings, formatCentsToCurrency } from '@/lib/services/pricing';
import { MIN_PRICE_CENTS } from '@/lib/listings/types';
import { normalizeDecimalInput } from '@/lib/utils/decimal-input';

interface PriceStepProps {
  priceCents: number;
  description: string;
  onPriceChange: (cents: number) => void;
  onDescriptionChange: (desc: string) => void;
  compact?: boolean;
  lockedPrice?: number;
}

const MAX_DESCRIPTION_LENGTH = 1000;

export function PriceStep({
  priceCents,
  description,
  onPriceChange,
  onDescriptionChange,
  compact,
  lockedPrice,
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
          <h2 className="text-xl sm:text-2xl font-semibold text-semantic-text-heading">
            Set your price
          </h2>
          <p className="text-sm text-semantic-text-secondary mt-1">
            Choose a fair price for your pre-loved game. Buyers pay this plus shipping.
          </p>
        </div>
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
            label="Price"
            type="text"
            inputMode="decimal"
            prefix="€"
            value={displayPrice}
            onChange={(e) => handlePriceChange(e.target.value)}
            placeholder="0.00"
            error={showMinError ? `Minimum price is ${formatCentsToCurrency(MIN_PRICE_CENTS)}` : undefined}
          />

          {earnings && priceCents >= MIN_PRICE_CENTS && (
            <div className="bg-semantic-bg-surface rounded-lg px-4 py-3">
              <p className="text-sm text-semantic-text-secondary">
                You&apos;ll receive{' '}
                <span className="font-medium text-semantic-text-primary">
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
          Description <span className="font-normal text-semantic-text-muted">(optional)</span>
        </label>
        <textarea
          id="listing-description"
          value={description}
          onChange={(e) => {
            if (e.target.value.length <= MAX_DESCRIPTION_LENGTH) {
              onDescriptionChange(e.target.value);
            }
          }}
          placeholder="Describe your copy — missing components, notable wear, or anything a buyer should know"
          rows={4}
          className="block w-full rounded-lg border border-semantic-border-default px-3 py-2.5 text-base sm:text-sm text-semantic-text-primary bg-semantic-bg-elevated placeholder:text-semantic-text-muted focus:outline-none focus:ring-2 focus:ring-semantic-border-focus focus:border-transparent resize-none"
        />
        <p className="mt-1 text-xs text-semantic-text-muted text-right">
          {description.length}/{MAX_DESCRIPTION_LENGTH}
        </p>
      </div>
    </div>
  );
}

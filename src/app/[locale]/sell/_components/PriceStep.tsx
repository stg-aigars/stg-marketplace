'use client';

import { useState, useEffect } from 'react';
import { calculateSellerEarnings, formatCentsToCurrency } from '@/lib/services/pricing';
import { MIN_PRICE_CENTS } from '@/lib/listings/types';

interface PriceStepProps {
  priceCents: number;
  description: string;
  onPriceChange: (cents: number) => void;
  onDescriptionChange: (desc: string) => void;
}

const MAX_DESCRIPTION_LENGTH = 1000;

export function PriceStep({
  priceCents,
  description,
  onPriceChange,
  onDescriptionChange,
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
    // Strip non-numeric except decimal point
    let cleaned = value.replace(/[^0-9.]/g, '');

    // Allow only one decimal point
    const parts = cleaned.split('.');
    if (parts.length > 2) {
      cleaned = parts[0] + '.' + parts.slice(1).join('');
    }

    // Max 2 decimal places
    if (parts.length === 2 && parts[1].length > 2) {
      cleaned = parts[0] + '.' + parts[1].slice(0, 2);
    }

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
      <div>
        <h2 className="text-xl sm:text-2xl font-semibold text-semantic-text-heading">
          Set your price
        </h2>
        <p className="text-sm text-semantic-text-secondary mt-1">
          Choose a fair price for your pre-loved game. Buyers pay this plus shipping.
        </p>
      </div>

      {/* Price input */}
      <div>
        <label className="block text-sm font-medium text-semantic-text-primary mb-1.5">
          Price
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-semantic-text-muted text-base sm:text-sm pointer-events-none">
            &euro;
          </span>
          {/* Custom input needed for currency prefix — Input component doesn't support prefix/suffix slots */}
          <input
            type="text"
            inputMode="decimal"
            value={displayPrice}
            onChange={(e) => handlePriceChange(e.target.value)}
            placeholder="0.00"
            className={`block w-full min-h-[44px] rounded-lg border px-3 py-2.5 pl-8 text-base sm:text-sm text-semantic-text-primary bg-semantic-bg-elevated placeholder:text-semantic-text-muted focus:outline-none focus:ring-2 focus:ring-semantic-border-focus focus:border-transparent ${
              showMinError ? 'border-semantic-error' : 'border-semantic-border-default'
            }`}
          />
        </div>
        {showMinError && (
          <p className="mt-1 text-sm text-semantic-error">
            Minimum price is {formatCentsToCurrency(MIN_PRICE_CENTS)}
          </p>
        )}
      </div>

      {/* Earnings preview */}
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

      {/* Description */}
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

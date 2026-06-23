'use client';

import { useState, useEffect } from 'react';
import { Input, Select } from '@/components/ui';
import { MIN_PRICE_CENTS } from '@/lib/listings/types';
import {
  DROP_INTERVAL_OPTIONS,
  buildDecliningPriceSchedulePreview,
  validateDecliningSchedule,
} from '@/lib/listings/declining-price';
import { formatCentsToCurrency } from '@/lib/services/pricing';
import { formatDate } from '@/lib/date-utils';
import { normalizeDecimalInput } from '@/lib/utils/decimal-input';

export interface DecliningScheduleSectionProps {
  startingPriceCents: number;
  floorPriceCents: number;
  decrementCents: number;
  dropIntervalDays: number;
  onFloorPriceChange: (cents: number) => void;
  onDecrementChange: (cents: number) => void;
  onDropIntervalChange: (days: number) => void;
}

export function DecliningScheduleSection({
  startingPriceCents,
  floorPriceCents,
  decrementCents,
  dropIntervalDays,
  onFloorPriceChange,
  onDecrementChange,
  onDropIntervalChange,
}: DecliningScheduleSectionProps) {
  const [displayFloor, setDisplayFloor] = useState(() =>
    floorPriceCents > 0 ? (floorPriceCents / 100).toFixed(2) : ''
  );
  const [displayDecrement, setDisplayDecrement] = useState(() =>
    decrementCents > 0 ? (decrementCents / 100).toFixed(2) : ''
  );

  useEffect(() => {
    if (floorPriceCents === 0 && displayFloor === '') return;
    const displayCents = Math.round(parseFloat(displayFloor || '0') * 100);
    if (displayCents !== floorPriceCents) {
      setDisplayFloor(floorPriceCents > 0 ? (floorPriceCents / 100).toFixed(2) : '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [floorPriceCents]);

  useEffect(() => {
    if (decrementCents === 0 && displayDecrement === '') return;
    const displayCents = Math.round(parseFloat(displayDecrement || '0') * 100);
    if (displayCents !== decrementCents) {
      setDisplayDecrement(decrementCents > 0 ? (decrementCents / 100).toFixed(2) : '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [decrementCents]);

  const handleFloorChange = (value: string) => {
    const cleaned = normalizeDecimalInput(value);
    setDisplayFloor(cleaned);
    const parsed = parseFloat(cleaned);
    if (!isNaN(parsed) && parsed >= 0) {
      onFloorPriceChange(Math.round(parsed * 100));
    } else if (cleaned === '' || cleaned === '.') {
      onFloorPriceChange(0);
    }
  };

  const handleDecrementChange = (value: string) => {
    const cleaned = normalizeDecimalInput(value);
    setDisplayDecrement(cleaned);
    const parsed = parseFloat(cleaned);
    if (!isNaN(parsed) && parsed >= 0) {
      onDecrementChange(Math.round(parsed * 100));
    } else if (cleaned === '' || cleaned === '.') {
      onDecrementChange(0);
    }
  };

  const { error: scheduleError } = validateDecliningSchedule({
    startingPriceCents,
    floorPriceCents,
    decrementCents,
    dropIntervalDays,
  });

  const preview =
    !scheduleError && startingPriceCents >= MIN_PRICE_CENTS && floorPriceCents > 0 && decrementCents > 0
      ? buildDecliningPriceSchedulePreview({
          startingPriceCents,
          floorPriceCents,
          decrementCents,
          dropIntervalDays,
          scheduleStartAt: new Date(),
        })
      : null;

  const previewTokens = preview
    ? preview.truncated
      ? [preview.steps[0], preview.steps[1], null, preview.steps[2]]
      : preview.steps
    : [];

  return (
    <div className="space-y-3">
      <hr className="border-semantic-border-subtle" />

      <p className="text-sm font-semibold text-semantic-text-secondary uppercase tracking-wide">
        Declining schedule
      </p>

      <Input
        label="Floor price"
        type="text"
        inputMode="decimal"
        prefix="€"
        value={displayFloor}
        onChange={(e) => handleFloorChange(e.target.value)}
        placeholder="0.00"
      />

      <Input
        label="Price drop"
        type="text"
        inputMode="decimal"
        prefix="€"
        value={displayDecrement}
        onChange={(e) => handleDecrementChange(e.target.value)}
        placeholder="0.00"
      />

      <Select
        label="Drop every"
        options={DROP_INTERVAL_OPTIONS}
        value={String(dropIntervalDays)}
        onChange={(e) => onDropIntervalChange(parseInt(e.target.value, 10))}
      />

      {scheduleError && <p className="text-sm text-semantic-error">{scheduleError}</p>}

      {previewTokens.length > 0 && (
        <div className="bg-semantic-bg-surface rounded-lg px-4 py-3">
          <p className="text-sm text-semantic-text-secondary flex flex-wrap items-center gap-1.5">
            {previewTokens.map((step, idx) => (
              <span key={idx} className="inline-flex items-center gap-1.5">
                {idx > 0 && <span className="text-semantic-text-muted">→</span>}
                {step === null ? (
                  <span className="text-semantic-text-muted">…</span>
                ) : (
                  <span className={step.isFloor ? 'font-medium text-semantic-text-primary' : undefined}>
                    {formatCentsToCurrency(step.priceCents)}{' '}
                    {step.dropAt === null
                      ? 'today'
                      : step.isFloor
                        ? `(floor) from ${formatDate(step.dropAt)}`
                        : `on ${formatDate(step.dropAt)}`}
                  </span>
                )}
              </span>
            ))}
          </p>
        </div>
      )}

      <div className="bg-semantic-bg-surface rounded-lg px-4 py-3">
        <p className="text-sm text-semantic-text-secondary">
          The price drops automatically until it reaches the floor. It stops the moment someone buys.
        </p>
      </div>
    </div>
  );
}

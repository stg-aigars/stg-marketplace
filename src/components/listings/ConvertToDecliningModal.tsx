'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Button, Modal } from '@/components/ui';
import { DEFAULT_DROP_INTERVAL_DAYS, validateDecliningSchedule } from '@/lib/listings/declining-price';
import { formatCentsToCurrency } from '@/lib/services/pricing';
import { convertListingToDeclining } from '@/lib/listings/actions';
import { DecliningScheduleSection } from '@/app/[locale]/sell/_components/DecliningScheduleSection';

interface ConvertToDecliningModalProps {
  listingId: string;
  startingPriceCents: number;
  open: boolean;
  onClose: () => void;
}

export function ConvertToDecliningModal({
  listingId,
  startingPriceCents,
  open,
  onClose,
}: ConvertToDecliningModalProps) {
  const router = useRouter();
  const [floorPriceCents, setFloorPriceCents] = useState(0);
  const [decrementCents, setDecrementCents] = useState(0);
  const [dropIntervalDays, setDropIntervalDays] = useState(DEFAULT_DROP_INTERVAL_DAYS);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- resetting state when modal opens
      setFloorPriceCents(0);
      setDecrementCents(0);
      setDropIntervalDays(DEFAULT_DROP_INTERVAL_DAYS);
      setError(null);
      setSubmitting(false);
    }
  }, [open]);

  const { valid } = validateDecliningSchedule({
    startingPriceCents,
    floorPriceCents,
    decrementCents,
    dropIntervalDays,
  });

  const handleConfirm = async () => {
    setSubmitting(true);
    setError(null);

    const result = await convertListingToDeclining(listingId, {
      floor_price_cents: floorPriceCents,
      decrement_cents: decrementCents,
      drop_interval_days: dropIntervalDays,
    });

    if ('error' in result) {
      setError(result.error);
      setSubmitting(false);
      return;
    }

    onClose();
    router.refresh();
  };

  return (
    <Modal open={open} onClose={onClose} title="Switch to declining price">
      <div className="space-y-4">
        <p className="text-semantic-text-secondary">
          Your current price of{' '}
          <span className="font-medium text-semantic-text-primary">
            {formatCentsToCurrency(startingPriceCents)}
          </span>{' '}
          becomes the starting price. From there it drops automatically on the schedule below until
          it reaches the floor — and stops the moment someone buys. This cannot be undone.
        </p>

        <DecliningScheduleSection
          startingPriceCents={startingPriceCents}
          floorPriceCents={floorPriceCents}
          decrementCents={decrementCents}
          dropIntervalDays={dropIntervalDays}
          onFloorPriceChange={setFloorPriceCents}
          onDecrementChange={setDecrementCents}
          onDropIntervalChange={setDropIntervalDays}
        />

        {error && <Alert variant="error">{error}</Alert>}

        <div className="flex gap-3 justify-end">
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="brand" onClick={handleConfirm} disabled={!valid || submitting}>
            {submitting ? 'Switching...' : 'Switch to declining price'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

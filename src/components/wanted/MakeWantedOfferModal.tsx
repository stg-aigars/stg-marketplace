'use client';

import { useState, useRef, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Modal, Button, Input, Select, Alert, Textarea, TurnstileWidget } from '@/components/ui';
import type { TurnstileWidgetRef } from '@/components/ui';
import { LISTING_CONDITIONS, type ListingCondition } from '@/lib/listings/types';
import { conditionToBadgeKey } from '@/lib/listings/types';
import { conditionConfig } from '@/lib/condition-config';
import { meetsConditionThreshold } from '@/lib/wanted/types';
import { makeWantedOffer } from '@/lib/wanted/offer-actions';

interface MakeWantedOfferModalProps {
  wantedListingId: string;
  gameName: string;
  minCondition: ListingCondition;
  maxPriceCents: number | null;
  open: boolean;
  onClose: () => void;
}

const CONDITION_OPTIONS = LISTING_CONDITIONS.map((c) => ({
  value: c,
  label: conditionConfig[conditionToBadgeKey[c]].label,
}));

export function MakeWantedOfferModal({
  wantedListingId,
  gameName,
  minCondition,
  maxPriceCents,
  open,
  onClose,
}: MakeWantedOfferModalProps) {
  const [condition, setCondition] = useState<ListingCondition>('good');
  const [priceEur, setPriceEur] = useState(maxPriceCents ? (maxPriceCents / 100).toFixed(2) : '');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileWidgetRef>(null);
  const router = useRouter();

  const validConditions = CONDITION_OPTIONS.filter((opt) =>
    meetsConditionThreshold(opt.value, minCondition)
  );

  function handleSubmit() {
    setError(null);
    const priceCents = Math.round(parseFloat(priceEur) * 100);

    if (isNaN(priceCents) || priceCents < 50) {
      setError('Price must be at least 0.50');
      return;
    }

    if (!meetsConditionThreshold(condition, minCondition)) {
      setError(`Condition must be ${conditionConfig[conditionToBadgeKey[minCondition]].label} or better`);
      return;
    }

    startTransition(async () => {
      const result = await makeWantedOffer(
        wantedListingId,
        condition,
        priceCents,
        note.trim() || undefined,
        turnstileToken ?? undefined
      );

      if ('error' in result) {
        setError(result.error);
        turnstileRef.current?.reset();
      } else {
        router.refresh();
        onClose();
      }
    });
  }

  return (
    <Modal open={open} onClose={onClose} title={`Make an offer for ${gameName}`}>
      <div className="space-y-4">
        {error && <Alert variant="error">{error}</Alert>}

        <Select
          label="Condition"
          options={validConditions}
          value={condition}
          onChange={(e) => setCondition(e.target.value as ListingCondition)}
        />

        <Input
          label="Price (EUR)"
          type="number"
          min="0.50"
          step="0.01"
          value={priceEur}
          onChange={(e) => setPriceEur(e.target.value)}
          placeholder={maxPriceCents ? `Budget: up to ${(maxPriceCents / 100).toFixed(2)}` : 'Your price'}
        />

        <Textarea
          label="Note (optional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={500}
          rows={3}
          placeholder="Edition details, shipping preferences, etc."
        />

        <TurnstileWidget ref={turnstileRef} onVerify={setTurnstileToken} />

        <div className="flex gap-3 pt-2">
          <Button variant="secondary" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={isPending} className="flex-1">
            Send offer
          </Button>
        </div>
      </div>
    </Modal>
  );
}

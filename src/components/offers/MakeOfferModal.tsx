'use client';

import { useState, useEffect, useTransition } from 'react';
import { GameThumb } from '@/components/listings/atoms';
import { Modal, Button, Input } from '@/components/ui';
import type { ShelfItemWithGame } from '@/lib/shelves/types';
import { MAX_NOTE_LENGTH, MIN_OFFER_CENTS, MAX_OFFER_CENTS } from '@/lib/shelves/types';
import { normalizeDecimalInput } from '@/lib/utils/decimal-input';
import { makeOffer } from '@/lib/offers/actions';

interface MakeOfferModalProps {
  open: boolean;
  onClose: () => void;
  item: ShelfItemWithGame;
}

export function MakeOfferModal({ open, onClose, item }: MakeOfferModalProps) {
  const [priceStr, setPriceStr] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Reset state when item changes (modal reopened for a different game)
  useEffect(() => {
    setPriceStr('');
    setNote('');
    setError(null);
  }, [item.id]);

  function handlePriceChange(e: React.ChangeEvent<HTMLInputElement>) {
    setPriceStr(e.target.value);
  }

  function handlePriceBlur(e: React.FocusEvent<HTMLInputElement>) {
    setPriceStr(normalizeDecimalInput(e.target.value));
  }

  function handleSubmit() {
    setError(null);

    const normalized = normalizeDecimalInput(priceStr);
    const parsed = parseFloat(normalized);

    if (isNaN(parsed) || normalized === '') {
      setError('Please enter an offer amount');
      return;
    }

    const amountCents = Math.round(parsed * 100);

    if (amountCents < MIN_OFFER_CENTS) {
      setError(`Minimum offer is €${(MIN_OFFER_CENTS / 100).toFixed(2)}`);
      return;
    }

    if (amountCents > MAX_OFFER_CENTS) {
      setError(`Maximum offer is €${(MAX_OFFER_CENTS / 100).toFixed(2)}`);
      return;
    }

    startTransition(async () => {
      try {
        const result = await makeOffer(item.id, amountCents, note.trim() || undefined);

        if ('error' in result) {
          setError(result.error);
          return;
        }

        setPriceStr('');
        setNote('');
        setError(null);
        onClose();
      } catch {
        setError('Something went wrong. Please try again.');
      }
    });
  }

  return (
    <Modal open={open} onClose={onClose} title="Make an offer">
      <div className="space-y-4">
        {/* Game info */}
        <div className="flex items-center gap-3">
          <GameThumb src={item.thumbnail} alt={item.game_name} size="md" />
          <div className="min-w-0">
            <p className="font-medium text-semantic-text-primary line-clamp-1">
              {item.game_name}
            </p>
            {item.game_year && (
              <p className="text-sm text-semantic-text-muted">{item.game_year}</p>
            )}
          </div>
        </div>

        {/* Price input */}
        <Input
          label="Your offer"
          prefix="€"
          type="text"
          inputMode="decimal"
          placeholder="0.00"
          value={priceStr}
          onChange={handlePriceChange}
          onBlur={handlePriceBlur}
        />

        {/* Note textarea */}
        <div>
          <label className="block text-sm font-medium text-semantic-text-primary mb-1.5">
            Note to seller (optional)
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={MAX_NOTE_LENGTH}
            rows={3}
            placeholder="Interested in this game, would you consider..."
            className="block w-full rounded-lg border border-semantic-border-default px-3 py-2.5 text-base sm:text-sm text-semantic-text-primary bg-semantic-bg-elevated focus:outline-none focus:ring-2 focus:ring-semantic-brand/20 focus:border-semantic-brand resize-none"
          />
          <p className="mt-1 text-xs text-semantic-text-muted text-right">
            {note.length}/{MAX_NOTE_LENGTH}
          </p>
        </div>

        {error && (
          <p className="text-sm text-semantic-error">{error}</p>
        )}
      </div>

      <div className="flex justify-end gap-3 mt-6">
        <Button variant="secondary" onClick={onClose} disabled={isPending}>
          Cancel
        </Button>
        <Button variant="primary" onClick={handleSubmit} disabled={isPending} loading={isPending}>
          Send offer
        </Button>
      </div>
    </Modal>
  );
}

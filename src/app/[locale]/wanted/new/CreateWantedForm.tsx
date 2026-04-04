'use client';

import { useState, useRef, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardBody, Button, Input, Select, Alert, Textarea, TurnstileWidget } from '@/components/ui';
import type { TurnstileWidgetRef } from '@/components/ui';
import { GameSearchStep, type EnrichedGame } from '@/app/[locale]/sell/_components/GameSearchStep';
import { LISTING_CONDITIONS, conditionToBadgeKey, type ListingCondition } from '@/lib/listings/types';
import { conditionConfig } from '@/lib/condition-config';
import { createWantedListing } from '@/lib/wanted/actions';

const CONDITION_OPTIONS = LISTING_CONDITIONS.map((c) => ({
  value: c,
  label: conditionConfig[conditionToBadgeKey[c]].label,
}));

export function CreateWantedForm() {
  const [game, setGame] = useState<EnrichedGame | null>(null);
  const [minCondition, setMinCondition] = useState<ListingCondition>('acceptable');
  const [budgetEur, setBudgetEur] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileWidgetRef>(null);
  const router = useRouter();

  function handleSubmit() {
    if (!game) {
      setError('Please select a game');
      return;
    }

    setError(null);
    const budgetCents = budgetEur.trim() ? Math.round(parseFloat(budgetEur) * 100) : null;

    if (budgetCents !== null && (isNaN(budgetCents) || budgetCents < 50)) {
      setError('Budget must be at least 0.50 or left empty');
      return;
    }

    startTransition(async () => {
      const result = await createWantedListing(
        game.id,
        game.name,
        game.yearpublished,
        minCondition,
        budgetCents,
        notes.trim() || undefined,
        turnstileToken ?? undefined
      );

      if ('error' in result) {
        setError(result.error);
        turnstileRef.current?.reset();
      } else {
        router.push('/account/wanted');
      }
    });
  }

  return (
    <div className="space-y-6">
      {error && <Alert variant="error">{error}</Alert>}

      {/* Step 1: Game search */}
      <Card>
        <CardBody>
          <h2 className="text-base font-semibold text-semantic-text-heading mb-3">
            Which game are you looking for?
          </h2>
          <GameSearchStep
            selectedGameId={game?.id ?? null}
            selectedGame={game}
            onSelect={setGame}
          />
        </CardBody>
      </Card>

      {/* Step 2: Preferences */}
      {game && (
        <Card>
          <CardBody className="space-y-4">
            <h2 className="text-base font-semibold text-semantic-text-heading">
              Your preferences
            </h2>

            <Select
              label="Minimum acceptable condition"
              options={CONDITION_OPTIONS}
              value={minCondition}
              onChange={(e) => setMinCondition(e.target.value as ListingCondition)}
            />

            <Input
              label="Maximum budget (EUR) — optional"
              type="number"
              min="0.50"
              step="0.01"
              value={budgetEur}
              onChange={(e) => setBudgetEur(e.target.value)}
              placeholder="Leave empty for any price"
            />

            <div>
              <Textarea
                label="Notes (optional)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={500}
                rows={3}
                placeholder="Preferred language, edition, or anything else sellers should know"
              />
              <p className="text-xs text-semantic-text-muted mt-1">
                {notes.length}/500
              </p>
            </div>

            <TurnstileWidget ref={turnstileRef} onVerify={setTurnstileToken} />

            <Button
              onClick={handleSubmit}
              loading={isPending}
              size="lg"
            >
              Post wanted listing
            </Button>
          </CardBody>
        </Card>
      )}
    </div>
  );
}

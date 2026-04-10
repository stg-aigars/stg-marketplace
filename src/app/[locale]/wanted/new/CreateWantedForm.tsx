'use client';

import { useState, useRef, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardBody, Button, Alert, Textarea, TurnstileWidget } from '@/components/ui';
import type { TurnstileWidgetRef } from '@/components/ui';
import { GameSearchStep, type EnrichedGame } from '@/app/[locale]/sell/_components/GameSearchStep';
import { VersionStep } from '@/app/[locale]/sell/_components/VersionStep';
import { createWantedListing } from '@/lib/wanted/actions';
import { useAuth } from '@/contexts/AuthContext';
import type { VersionData } from '@/lib/listings/types';

export function CreateWantedForm() {
  const [game, setGame] = useState<EnrichedGame | null>(null);
  const [gameName, setGameName] = useState<string>('');
  const [editionAnswer, setEditionAnswer] = useState<'yes' | 'no' | null>(null);
  const [edition, setEdition] = useState<VersionData | null>(null);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileWidgetRef>(null);
  const router = useRouter();
  const { profile } = useAuth();
  const userCountry = profile?.country ?? null;

  function handleGameSelect(selected: EnrichedGame) {
    const defaultName = selected.matchedAlternateName ?? selected.name;
    setGame(selected);
    setGameName(defaultName);
    // Reset edition state when game changes
    if (game && game.id !== selected.id) {
      setEditionAnswer(null);
      setEdition(null);
    }
  }

  function handleSubmit() {
    if (!game) {
      setError('Please select a game');
      return;
    }

    setError(null);

    startTransition(async () => {
      const result = await createWantedListing(
        game.id,
        gameName,
        game.yearpublished,
        edition ? {
          versionSource: edition.version_source,
          bggVersionId: edition.bgg_version_id,
          versionName: edition.version_name,
          publisher: edition.publisher,
          language: edition.language,
          editionYear: edition.edition_year,
        } : null,
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

  const showEditionGate = game && editionAnswer === null;
  const showVersionStep = game && editionAnswer === 'yes';
  const showSubmitSection = game && (editionAnswer === 'no' || (editionAnswer === 'yes' && edition));

  return (
    <div className="space-y-6">
      {error && <Alert variant="error">{error}</Alert>}

      {/* Step 1: Game search */}
      <GameSearchStep
        heading="Which game are you looking for?"
        selectedGameId={game?.id ?? null}
        selectedGame={game}
        onSelect={handleGameSelect}
      />

      {/* Edition gate */}
      {showEditionGate && (
        <Card>
          <CardBody>
            <p className="text-sm font-medium text-semantic-text-primary mb-3">
              Do you have a preferred edition?
            </p>
            <div className="flex gap-3">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setEditionAnswer('no')}
              >
                Any edition is fine
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setEditionAnswer('yes')}
              >
                Yes, select edition
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Edition selection */}
      {showVersionStep && (
        <VersionStep
          gameId={game.id}
          gameName={gameName}
          selectedGame={game}
          onGameNameChange={setGameName}
          selectedVersionId={edition?.bgg_version_id ?? null}
          selectedVersionSource={edition?.version_source ?? null}
          selectedPublisher={edition?.publisher}
          selectedLanguage={edition?.language}
          selectedEditionYear={edition?.edition_year}
          onSelect={setEdition}
          userCountry={userCountry}
        />
      )}

      {/* Notes + submit */}
      {showSubmitSection && (
        <Card>
          <CardBody className="space-y-4">
            <div>
              <Textarea
                label="Notes (optional)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={500}
                rows={3}
                placeholder="Preferred language, condition, or anything else sellers should know"
              />
              <p className="text-xs text-semantic-text-muted mt-1 text-right">
                {notes.length}/500
              </p>
            </div>

            <TurnstileWidget ref={turnstileRef} onVerify={setTurnstileToken} />

            <Button
              onClick={handleSubmit}
              loading={isPending}
              size="lg"
              className="w-full"
            >
              Post wanted listing
            </Button>
          </CardBody>
        </Card>
      )}
    </div>
  );
}

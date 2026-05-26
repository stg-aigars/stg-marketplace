'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardBody, Button, Alert, Textarea } from '@/components/ui';
import { GameIdentityRow } from '@/components/listings/atoms';
import { VersionStep } from '@/app/[locale]/sell/_components/VersionStep';
import { buildEnrichedGame } from '@/app/[locale]/sell/_components/GameSearchStep';
import { updateWantedListing } from '@/lib/wanted/actions';
import { useAuth } from '@/contexts/AuthContext';
import { CARD_SUBSECTION_HEADING_CLASS } from '@/lib/heading-classes';
import { cn } from '@/lib/cn';
import { toEditionPayload, type EditWantedListing } from '@/lib/wanted/types';
import type { VersionData } from '@/lib/listings/types';

interface Props {
  listing: EditWantedListing;
}

export function EditWantedForm({ listing }: Props) {
  const router = useRouter();
  const { profile } = useAuth();
  const userCountry = profile?.country ?? null;

  const initialEdition: VersionData | null = listing.version_source
    ? {
        version_source: listing.version_source,
        bgg_version_id: listing.bgg_version_id,
        version_name: listing.version_name,
        publisher: listing.publisher,
        language: listing.language,
        edition_year: listing.edition_year,
        version_thumbnail: listing.version_thumbnail,
      }
    : null;

  const [editionAnswer, setEditionAnswer] = useState<'yes' | 'no'>(initialEdition ? 'yes' : 'no');
  const [edition, setEdition] = useState<VersionData | null>(initialEdition);
  const [notes, setNotes] = useState(listing.notes ?? '');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const enrichedGame = useMemo(
    () => buildEnrichedGame(listing.bgg_game_id, listing.game_name, listing.game_year, listing.games),
    [listing.bgg_game_id, listing.game_name, listing.game_year, listing.games],
  );

  function handleSubmit() {
    setError(null);

    const submitEdition = editionAnswer === 'yes' && edition ? edition : null;

    startTransition(async () => {
      const result = await updateWantedListing(
        listing.id,
        submitEdition ? toEditionPayload(submitEdition) : null,
        notes.trim() || undefined,
      );

      if ('error' in result) {
        setError(result.error);
        return;
      }
      router.push('/account/wanted');
    });
  }

  const canSubmit = editionAnswer === 'no' || (editionAnswer === 'yes' && edition);

  return (
    <div className="space-y-6">
      {error && <Alert variant="error">{error}</Alert>}

      <Card>
        <CardBody className="space-y-2">
          <GameIdentityRow
            thumbnail={listing.games?.thumbnail}
            name={listing.game_name}
            year={listing.game_year}
            size="md"
          />
          <p className="text-xs text-semantic-text-muted">
            To change the game, remove this listing and post a new one.
          </p>
        </CardBody>
      </Card>

      {/* Edition gate */}
      <Card>
        <CardBody>
          <h2 className={cn(CARD_SUBSECTION_HEADING_CLASS, 'mb-3')}>
            Edition preference
          </h2>
          <div className="flex gap-3">
            <Button
              variant={editionAnswer === 'no' ? 'brand' : 'secondary'}
              size="sm"
              onClick={() => {
                setEditionAnswer('no');
                setEdition(null);
              }}
              aria-pressed={editionAnswer === 'no'}
            >
              Any edition
            </Button>
            <Button
              variant={editionAnswer === 'yes' ? 'brand' : 'secondary'}
              size="sm"
              onClick={() => setEditionAnswer('yes')}
              aria-pressed={editionAnswer === 'yes'}
            >
              Pin a specific edition
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Edition selection */}
      {editionAnswer === 'yes' && (
        <VersionStep
          gameId={listing.bgg_game_id}
          gameName={listing.game_name}
          selectedGame={enrichedGame}
          selectedVersionId={edition?.bgg_version_id ?? null}
          selectedVersionSource={edition?.version_source ?? null}
          selectedVersionName={edition?.version_name}
          selectedPublisher={edition?.publisher}
          selectedLanguage={edition?.language}
          selectedEditionYear={edition?.edition_year}
          onSelect={setEdition}
          userCountry={userCountry}
        />
      )}

      {/* Notes */}
      <Card>
        <CardBody className="space-y-4">
          <div>
            <Textarea
              label="Notes (optional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder="Preferred edition, language, condition, or anything sellers should know before reaching out"
            />
            <p className="text-xs text-semantic-text-muted mt-1 text-right">
              {notes.length}/500
            </p>
          </div>

          <div className="flex gap-3">
            <Button
              onClick={handleSubmit}
              disabled={isPending || !canSubmit}
              loading={isPending}
              size="lg"
              className="flex-1"
            >
              Save changes
            </Button>
            <Button
              variant="ghost"
              size="lg"
              onClick={() => router.push('/account/wanted')}
              disabled={isPending}
            >
              Cancel
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { ImageSquare } from '@phosphor-icons/react/ssr';
import { Card, CardBody, Button, Alert, Textarea } from '@/components/ui';
import { VersionStep } from '@/app/[locale]/sell/_components/VersionStep';
import { buildEnrichedGame } from '@/app/[locale]/sell/_components/GameSearchStep';
import { updateWantedListing } from '@/lib/wanted/actions';
import { useAuth } from '@/contexts/AuthContext';
import { CARD_SUBSECTION_HEADING_CLASS } from '@/lib/heading-classes';
import { cn } from '@/lib/cn';
import type { VersionData, VersionSource } from '@/lib/listings/types';

export interface EditWantedListing {
  id: string;
  buyer_id: string;
  status: string;
  bgg_game_id: number;
  game_name: string;
  game_year: number | null;
  notes: string | null;
  version_source: VersionSource | null;
  bgg_version_id: number | null;
  version_name: string | null;
  publisher: string | null;
  language: string | null;
  edition_year: number | null;
  version_thumbnail: string | null;
  games: {
    thumbnail: string | null;
    image: string | null;
    player_count: string | null;
    alternate_names: string[] | null;
    min_age: number | null;
    playing_time: string | null;
    weight: number | null;
  } | null;
}

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

  const enrichedGame = buildEnrichedGame(
    listing.bgg_game_id,
    listing.game_name,
    listing.game_year,
    listing.games,
  );

  const thumbnail = listing.games?.thumbnail ?? null;

  function handleSubmit() {
    setError(null);

    const submitEdition = editionAnswer === 'yes' && edition ? edition : null;

    startTransition(async () => {
      const result = await updateWantedListing(
        listing.id,
        submitEdition
          ? {
              versionSource: submitEdition.version_source,
              bggVersionId: submitEdition.bgg_version_id,
              versionName: submitEdition.version_name,
              publisher: submitEdition.publisher,
              language: submitEdition.language,
              editionYear: submitEdition.edition_year,
              versionThumbnail: submitEdition.version_thumbnail,
            }
          : null,
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

      {/* Game header (read-only — game identity is fixed) */}
      <Card>
        <CardBody>
          <div className="flex items-center gap-3">
            <div className="relative w-16 h-16 shrink-0 bg-semantic-bg-surface rounded overflow-hidden flex items-center justify-center">
              {thumbnail ? (
                <Image
                  src={thumbnail}
                  alt={listing.game_name}
                  fill
                  className="object-contain p-1"
                  sizes="64px"
                />
              ) : (
                <ImageSquare size={28} className="text-semantic-text-muted" />
              )}
            </div>
            <div className="min-w-0">
              <p className="font-medium text-semantic-text-heading truncate">
                {listing.game_name}
                {listing.game_year ? ` (${listing.game_year})` : ''}
              </p>
              <p className="text-xs text-semantic-text-muted mt-0.5">
                To change the game, remove this listing and post a new one.
              </p>
            </div>
          </div>
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

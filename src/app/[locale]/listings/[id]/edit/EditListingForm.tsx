'use client';

import { useState, useRef, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Alert, Breadcrumb, Button, Card, CardBody, Spinner } from '@/components/ui';
import { TurnstileWidget } from '@/components/ui/TurnstileWidget';
import { ConditionStep } from '@/app/[locale]/sell/_components/ConditionStep';
import { PhotoUploadStep } from '@/app/[locale]/sell/_components/PhotoUploadStep';
import { PriceStep } from '@/app/[locale]/sell/_components/PriceStep';
import { VersionStep } from '@/app/[locale]/sell/_components/VersionStep';
import { ExpansionStep } from '@/app/[locale]/sell/_components/ExpansionStep';
import { buildEnrichedGame, type EnrichedGame } from '@/app/[locale]/sell/_components/GameSearchStep';
import { updateListing } from '@/lib/listings/actions';
import { useAuth } from '@/contexts/AuthContext';
import { apiFetch } from '@/lib/api-fetch';
import { MIN_PRICE_CENTS, conditionRequiresPhotos, conditionRequiresDescription } from '@/lib/listings/types';
import type { ListingCondition, VersionData, ListingExpansion } from '@/lib/listings/types';

interface EditListingFormProps {
  listing: {
    id: string;
    bgg_game_id: number;
    game_name: string;
    game_year: number | null;
    condition: ListingCondition;
    price_cents: number;
    description: string | null;
    photos: string[];
    version_source: VersionData['version_source'];
    bgg_version_id: VersionData['bgg_version_id'];
    version_name: VersionData['version_name'];
    publisher: VersionData['publisher'];
    language: VersionData['language'];
    edition_year: VersionData['edition_year'];
    version_thumbnail: string | null;
    games: {
      name: string | null;
      thumbnail: string | null;
      image: string | null;
      player_count: string | null;
    };
  };
  alternateNames: string[];
  locale: string;
  existingExpansions: Array<{
    bgg_game_id: number;
    game_name: string;
    version_source: string | null;
    bgg_version_id: number | null;
    version_name: string | null;
    publisher: string | null;
    language: string | null;
    edition_year: number | null;
    version_thumbnail: string | null;
  }>;
}

function initialVersion(listing: EditListingFormProps['listing']): VersionData {
  return {
    version_source: listing.version_source,
    bgg_version_id: listing.bgg_version_id,
    version_name: listing.version_name,
    publisher: listing.publisher,
    language: listing.language,
    edition_year: listing.edition_year,
    version_thumbnail: listing.version_thumbnail ?? null,
  };
}

export function EditListingForm({ listing, alternateNames, locale, existingExpansions }: EditListingFormProps) {
  const router = useRouter();
  const { profile } = useAuth();
  const userCountry = profile?.country ?? null;

  // Snapshot initial values for dirty detection
  const initial = useRef({
    game_name: listing.game_name,
    condition: listing.condition,
    price_cents: listing.price_cents,
    description: listing.description ?? '',
    photos: JSON.stringify(listing.photos),
    version: JSON.stringify(initialVersion(listing)),
    expansionIds: JSON.stringify(existingExpansions.map((e) => e.bgg_game_id).sort()),
  });

  // Editable state
  const [gameName, setGameName] = useState(listing.game_name);
  const [condition, setCondition] = useState<ListingCondition | null>(listing.condition);
  const [priceCents, setPriceCents] = useState(listing.price_cents);
  const [description, setDescription] = useState(listing.description ?? '');
  const [photos, setPhotos] = useState<string[]>(listing.photos);
  const [version, setVersion] = useState<VersionData>(initialVersion(listing));

  // Expansion state
  const [availableExpansions, setAvailableExpansions] = useState<Array<{ id: number; name: string; year?: number; thumbnail?: string | null }>>([]);
  const [selectedExpansionIds, setSelectedExpansionIds] = useState<number[]>(
    existingExpansions.map((e) => e.bgg_game_id)
  );
  const [expansionVersions, setExpansionVersions] = useState<Record<number, VersionData>>(() => {
    const versions: Record<number, VersionData> = {};
    for (const e of existingExpansions) {
      if (e.version_source) {
        versions[e.bgg_game_id] = {
          version_source: e.version_source as VersionData['version_source'],
          bgg_version_id: e.bgg_version_id,
          version_name: e.version_name,
          publisher: e.publisher,
          language: e.language,
          edition_year: e.edition_year,
          version_thumbnail: e.version_thumbnail,
        };
      }
    }
    return versions;
  });
  const [loadingExpansions, setLoadingExpansions] = useState(false);
  const [enrichedExpansions, setEnrichedExpansions] = useState<Record<number, EnrichedGame>>({});

  // Fetch available expansions for this base game
  useEffect(() => {
    setLoadingExpansions(true);
    apiFetch(`/api/games/${listing.bgg_game_id}/expansions`)
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (data?.expansions) setAvailableExpansions(data.expansions);
      })
      .catch(() => {})
      .finally(() => setLoadingExpansions(false));
  }, [listing.bgg_game_id]);

  // Enrich expansion metadata (alternate names) via batch call
  const enrichedExpansionIdsRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    const missing = availableExpansions.filter(
      (e) => !enrichedExpansionIdsRef.current.has(e.id)
    );
    if (missing.length === 0) return;

    let cancelled = false;
    const ids = missing.map((e) => e.id).slice(0, 20);
    for (const id of ids) enrichedExpansionIdsRef.current.add(id);

    apiFetch('/api/games/enrich-batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    })
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (cancelled || !data?.games) return;
        const games: Record<number, { thumbnail: string | null; image: string | null; alternate_names: string[] | null }> = data.games;

        setAvailableExpansions((prev) =>
          prev.map((exp) => {
            const enriched = games[exp.id];
            if (enriched?.thumbnail && !exp.thumbnail) {
              return { ...exp, thumbnail: enriched.thumbnail };
            }
            return exp;
          })
        );

        const newEnriched: Record<number, EnrichedGame> = {};
        for (const exp of missing) {
          const g = games[exp.id];
          if (g) {
            newEnriched[exp.id] = buildEnrichedGame(
              exp.id, exp.name, exp.year ?? null,
              { thumbnail: g.thumbnail, image: g.image, player_count: null, alternate_names: g.alternate_names },
            );
          }
        }
        if (Object.keys(newEnriched).length > 0) {
          setEnrichedExpansions((prev) => ({ ...prev, ...newEnriched }));
        }
      })
      .catch(() => {});

    return () => { cancelled = true; };
  }, [availableExpansions]);

  // Stable reference for VersionStep — listing/alternateNames never change during edit
  const enrichedGame = useMemo<EnrichedGame>(
    () => buildEnrichedGame(listing.bgg_game_id, listing.games?.name ?? listing.game_name, listing.game_year, { ...listing.games, alternate_names: alternateNames }),
    [listing, alternateNames],
  );

  // Form state
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

  // Dirty detection
  const isDirty =
    gameName !== initial.current.game_name ||
    condition !== initial.current.condition ||
    priceCents !== initial.current.price_cents ||
    description !== initial.current.description ||
    JSON.stringify(photos) !== initial.current.photos ||
    JSON.stringify(version) !== initial.current.version ||
    JSON.stringify([...selectedExpansionIds].sort()) !== initial.current.expansionIds;

  // Validation
  const isValid = condition !== null &&
    priceCents >= MIN_PRICE_CENTS &&
    (!conditionRequiresPhotos(condition) || photos.length >= 1) &&
    (!conditionRequiresDescription(condition) || description.trim().length > 0);

  const canSubmit = isDirty && isValid && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit || !condition) return;

    setSubmitting(true);
    setError(null);

    // Build expansion data for submit
    const expansions: ListingExpansion[] = selectedExpansionIds.map((id) => {
      const exp = availableExpansions.find((e) => e.id === id);
      const ver = expansionVersions[id];
      return {
        bgg_game_id: id,
        game_name: exp?.name ?? existingExpansions.find((e) => e.bgg_game_id === id)?.game_name ?? `Game ${id}`,
        ...(ver ? {
          version_source: ver.version_source,
          bgg_version_id: ver.bgg_version_id,
          version_name: ver.version_name,
          publisher: ver.publisher,
          language: ver.language,
          edition_year: ver.edition_year,
          version_thumbnail: ver.version_thumbnail,
        } : {}),
      };
    });

    const result = await updateListing(
      {
        id: listing.id,
        game_name: gameName,
        ...version,
        condition,
        price_cents: priceCents,
        description: description || null,
        photos,
        expansions,
      },
      turnstileToken ?? undefined
    );

    if ('error' in result) {
      setError(result.error);
      setSubmitting(false);
      return;
    }

    router.push(`/${locale}/listings/${listing.id}`);
  };

  const thumbnail = listing.games?.thumbnail ?? listing.photos[0] ?? null;

  return (
    <div className="space-y-8">
      <Breadcrumb
        items={[
          { label: 'Browse', href: `/${locale}` },
          { label: listing.game_name, href: `/${locale}/listings/${listing.id}` },
          { label: 'Edit' },
        ]}
      />

      <h1 className="text-2xl sm:text-3xl font-bold font-display tracking-tight text-semantic-text-heading">
        Edit listing
      </h1>

      {/* Game info — read-only */}
      <Card>
        <CardBody>
          <div className="flex gap-4 items-center">
            {thumbnail && (
              <Image
                src={thumbnail}
                alt={listing.game_name}
                width={64}
                height={64}
                className="rounded-lg object-contain bg-semantic-bg-secondary w-16 h-16 flex-shrink-0"
              />
            )}
            <div className="min-w-0">
              <p className="font-semibold text-semantic-text-heading truncate">
                {listing.game_name}
              </p>
              <p className="text-sm text-semantic-text-muted">
                {[listing.game_year, listing.games?.player_count && `${listing.games.player_count} players`].filter(Boolean).join(' · ')}
              </p>
              <p className="text-xs text-semantic-text-muted mt-1">
                Game cannot be changed after listing
              </p>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Edition / Version */}
      <VersionStep
        userCountry={userCountry}
        gameId={listing.bgg_game_id}
        gameName={gameName}
        selectedGame={enrichedGame}
        onGameNameChange={setGameName}
        selectedVersionId={version.bgg_version_id}
        selectedVersionSource={version.version_source}
        selectedPublisher={version.publisher}
        selectedLanguage={version.language}
        selectedEditionYear={version.edition_year}
        onSelect={setVersion}
        compact
      />

      {/* Expansions — shown if available */}
      {!loadingExpansions && availableExpansions.length > 0 && (
        <div className="space-y-4">
          <ExpansionStep
            expansions={availableExpansions.map((e) => ({
              ...e,
              alternate_names: enrichedExpansions[e.id]?.alternateNames ?? null,
            }))}
            selectedExpansionIds={selectedExpansionIds}
            onSelectionChange={setSelectedExpansionIds}
          />
          {/* Expansion version selectors */}
          {selectedExpansionIds.map((expId) => {
            const expansion = availableExpansions.find((e) => e.id === expId);
            if (!expansion) return null;
            const expVersion = expansionVersions[expId];
            return (
              <div key={expId}>
                <p className="text-sm font-medium text-semantic-text-muted mb-2">
                  {expansion.name} edition
                  <span className="text-semantic-text-muted font-normal ml-1">(optional)</span>
                </p>
                <VersionStep
                  userCountry={userCountry}
                  gameId={expId}
                  gameName={expansion.name}
                  selectedVersionId={expVersion?.bgg_version_id ?? null}
                  selectedVersionSource={expVersion?.version_source ?? null}
                  selectedPublisher={expVersion?.publisher ?? null}
                  selectedLanguage={expVersion?.language ?? null}
                  selectedEditionYear={expVersion?.edition_year ?? null}
                  onSelect={(ver: VersionData) => {
                    setExpansionVersions((prev) => ({ ...prev, [expId]: ver }));
                  }}
                  compact
                />
              </div>
            );
          })}
        </div>
      )}

      {/* Photos */}
      <PhotoUploadStep photos={photos} onPhotosChange={setPhotos} compact />

      {/* Condition */}
      <ConditionStep selectedCondition={condition} onSelect={setCondition} compact />

      {/* Price & Description */}
      <PriceStep
        priceCents={priceCents}
        description={description}
        onPriceChange={setPriceCents}
        onDescriptionChange={setDescription}
        compact
      />

      {/* Error alert */}
      {error && (
        <Alert variant="error" dismissible onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Sticky bottom bar */}
      <div className="sticky bottom-0 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 bg-semantic-bg-elevated border-t border-semantic-border-subtle z-10">
        <div className="flex gap-3 justify-end">
          <Button variant="ghost" asChild>
            <Link href={`/${locale}/listings/${listing.id}`}>Cancel</Link>
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
          >
            {submitting ? (
              <>
                <Spinner size="sm" />
                Saving...
              </>
            ) : (
              'Save changes'
            )}
          </Button>
        </div>
        <TurnstileWidget onVerify={setTurnstileToken} />
      </div>
    </div>
  );
}

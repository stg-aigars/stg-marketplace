'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Alert, Breadcrumb, Button, Card, CardBody, Spinner } from '@/components/ui';
import { TurnstileWidget } from '@/components/ui/TurnstileWidget';
import { ConditionStep } from '@/app/[locale]/sell/_components/ConditionStep';
import { PhotoUploadStep } from '@/app/[locale]/sell/_components/PhotoUploadStep';
import { PriceStep } from '@/app/[locale]/sell/_components/PriceStep';
import { VersionStep } from '@/app/[locale]/sell/_components/VersionStep';
import { updateListing } from '@/lib/listings/actions';
import { MIN_PRICE_CENTS } from '@/lib/listings/types';
import type { ListingCondition, VersionSource } from '@/lib/listings/types';

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
    version_source: VersionSource;
    bgg_version_id: number | null;
    version_name: string | null;
    publisher: string | null;
    language: string | null;
    edition_year: number | null;
    games: {
      name: string | null;
      thumbnail: string | null;
      image: string | null;
      year_published: number | null;
      min_players: number | null;
      max_players: number | null;
    };
  };
  locale: string;
}

interface VersionData {
  version_source: VersionSource;
  bgg_version_id: number | null;
  version_name: string | null;
  publisher: string | null;
  language: string | null;
  edition_year: number | null;
}

export function EditListingForm({ listing, locale }: EditListingFormProps) {
  const router = useRouter();

  // Snapshot initial values for dirty detection
  const initial = useRef({
    condition: listing.condition,
    price_cents: listing.price_cents,
    description: listing.description ?? '',
    photos: JSON.stringify(listing.photos),
    version_source: listing.version_source,
    bgg_version_id: listing.bgg_version_id,
    publisher: listing.publisher,
    language: listing.language,
    edition_year: listing.edition_year,
    version_name: listing.version_name,
  });

  // Editable state
  const [condition, setCondition] = useState<ListingCondition | null>(listing.condition);
  const [priceCents, setPriceCents] = useState(listing.price_cents);
  const [description, setDescription] = useState(listing.description ?? '');
  const [photos, setPhotos] = useState<string[]>(listing.photos);
  const [versionSource, setVersionSource] = useState<VersionSource>(listing.version_source);
  const [bggVersionId, setBggVersionId] = useState<number | null>(listing.bgg_version_id);
  const [versionName, setVersionName] = useState<string | null>(listing.version_name);
  const [publisher, setPublisher] = useState<string | null>(listing.publisher);
  const [language, setLanguage] = useState<string | null>(listing.language);
  const [editionYear, setEditionYear] = useState<number | null>(listing.edition_year);

  // Form state
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

  const handleVersionSelect = (v: VersionData) => {
    setVersionSource(v.version_source);
    setBggVersionId(v.bgg_version_id);
    setVersionName(v.version_name);
    setPublisher(v.publisher);
    setLanguage(v.language);
    setEditionYear(v.edition_year);
  };

  // Dirty detection
  const isDirty =
    condition !== initial.current.condition ||
    priceCents !== initial.current.price_cents ||
    description !== initial.current.description ||
    JSON.stringify(photos) !== initial.current.photos ||
    versionSource !== initial.current.version_source ||
    bggVersionId !== initial.current.bgg_version_id ||
    publisher !== initial.current.publisher ||
    language !== initial.current.language ||
    editionYear !== initial.current.edition_year ||
    versionName !== initial.current.version_name;

  // Validation
  const isValid = condition !== null && priceCents >= MIN_PRICE_CENTS && photos.length >= 1;

  const canSubmit = isDirty && isValid && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit || !condition) return;

    setSubmitting(true);
    setError(null);

    const result = await updateListing(
      {
        id: listing.id,
        version_source: versionSource,
        bgg_version_id: bggVersionId,
        version_name: versionName,
        publisher,
        language,
        edition_year: editionYear,
        condition,
        price_cents: priceCents,
        description: description || null,
        photos,
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
  const playerCount =
    listing.games?.min_players && listing.games?.max_players
      ? listing.games.min_players === listing.games.max_players
        ? `${listing.games.min_players} players`
        : `${listing.games.min_players}–${listing.games.max_players} players`
      : null;

  return (
    <div className="space-y-8">
      <Breadcrumb
        items={[
          { label: 'Browse', href: `/${locale}` },
          { label: listing.game_name, href: `/${locale}/listings/${listing.id}` },
          { label: 'Edit' },
        ]}
      />

      <h1 className="text-2xl sm:text-3xl font-bold text-semantic-text-heading">
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
                className="rounded-lg object-cover w-16 h-16 flex-shrink-0"
              />
            )}
            <div className="min-w-0">
              <p className="font-semibold text-semantic-text-heading truncate">
                {listing.game_name}
              </p>
              <p className="text-sm text-semantic-text-muted">
                {[listing.game_year, playerCount].filter(Boolean).join(' · ')}
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
        gameId={listing.bgg_game_id}
        gameName={listing.game_name}
        selectedVersionId={bggVersionId}
        selectedVersionSource={versionSource}
        onSelect={handleVersionSelect}
        compact
      />

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
          <Link href={`/${locale}/listings/${listing.id}`}>
            <Button variant="ghost">Cancel</Button>
          </Link>
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

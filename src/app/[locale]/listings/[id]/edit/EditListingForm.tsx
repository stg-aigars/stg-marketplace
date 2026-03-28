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
import type { ListingCondition, VersionData } from '@/lib/listings/types';

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
    games: {
      name: string | null;
      thumbnail: string | null;
      image: string | null;
      player_count: string | null;
    };
  };
  locale: string;
}

function initialVersion(listing: EditListingFormProps['listing']): VersionData {
  return {
    version_source: listing.version_source,
    bgg_version_id: listing.bgg_version_id,
    version_name: listing.version_name,
    publisher: listing.publisher,
    language: listing.language,
    edition_year: listing.edition_year,
  };
}

export function EditListingForm({ listing, locale }: EditListingFormProps) {
  const router = useRouter();

  // Snapshot initial values for dirty detection
  const initial = useRef({
    condition: listing.condition,
    price_cents: listing.price_cents,
    description: listing.description ?? '',
    photos: JSON.stringify(listing.photos),
    version: JSON.stringify(initialVersion(listing)),
  });

  // Editable state
  const [condition, setCondition] = useState<ListingCondition | null>(listing.condition);
  const [priceCents, setPriceCents] = useState(listing.price_cents);
  const [description, setDescription] = useState(listing.description ?? '');
  const [photos, setPhotos] = useState<string[]>(listing.photos);
  const [version, setVersion] = useState<VersionData>(initialVersion(listing));

  // Form state
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

  // Dirty detection
  const isDirty =
    condition !== initial.current.condition ||
    priceCents !== initial.current.price_cents ||
    description !== initial.current.description ||
    JSON.stringify(photos) !== initial.current.photos ||
    JSON.stringify(version) !== initial.current.version;

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
        ...version,
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
                className="rounded-lg object-cover w-16 h-16 flex-shrink-0"
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
        gameId={listing.bgg_game_id}
        gameName={listing.game_name}
        selectedVersionId={version.bgg_version_id}
        selectedVersionSource={version.version_source}
        onSelect={setVersion}
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

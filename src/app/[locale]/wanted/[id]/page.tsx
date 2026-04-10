import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { ImageSquare } from '@phosphor-icons/react/ssr';
import { Card, CardBody, ShareButtons, BackLink } from '@/components/ui';
import { getCountryFlag, getCountryName } from '@/lib/country-utils';
import { getWantedListingById } from '@/lib/wanted/actions';

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const params = await props.params;
  const listing = await getWantedListingById(params.id);
  if (!listing) return { title: 'Not found' };

  const description = listing.language
    ? `Looking for ${listing.game_name} (${listing.language} edition)`
    : `Looking for ${listing.game_name}`;

  return {
    title: `Wanted: ${listing.game_name}`,
    description,
    openGraph: {
      title: `Wanted: ${listing.game_name} | Second Turn Games`,
      description,
      ...(listing.image ? { images: [{ url: listing.image }] } : {}),
    },
  };
}

export default async function WantedDetailPage(props: Props) {
  const params = await props.params;
  const listing = await getWantedListingById(params.id);

  if (!listing) notFound();

  const hasEdition = listing.version_source !== null;
  const editionParts = [listing.language, listing.publisher, listing.edition_year].filter(Boolean);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
      <BackLink href="/wanted" label="Back to wanted games" />

      <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] gap-6">
        {/* Game image */}
        <div className="relative aspect-square bg-semantic-bg-surface rounded-lg overflow-hidden flex items-center justify-center">
          {listing.image || listing.thumbnail ? (
            <Image
              src={listing.image || listing.thumbnail!}
              alt={listing.game_name}
              fill
              className="object-contain p-2"
              sizes="200px"
            />
          ) : (
            <ImageSquare size={64} className="text-semantic-text-muted" />
          )}
        </div>

        {/* Details */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold font-display tracking-tight text-semantic-text-heading">
            {listing.game_name}
          </h1>
          {listing.game_year && (
            <p className="text-sm text-semantic-text-muted mt-0.5">
              ({listing.game_year})
            </p>
          )}

          <div className="mt-4 space-y-3">
            <div>
              <p className="text-sm text-semantic-text-muted">Preferred edition</p>
              {hasEdition ? (
                <div className="mt-0.5">
                  {listing.version_name && (
                    <p className="text-sm font-medium text-semantic-text-heading">
                      {listing.version_name}
                    </p>
                  )}
                  {editionParts.length > 0 && (
                    <p className="text-sm text-semantic-text-primary">
                      {editionParts.join(' · ')}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-semantic-text-primary">Any edition</p>
              )}
            </div>

            <div>
              <p className="text-sm text-semantic-text-muted">Buyer</p>
              <p className="text-sm text-semantic-text-primary">
                <span className={`${getCountryFlag(listing.country)} mr-1.5`} />
                {listing.buyer_name || 'Anonymous'}
                {' in '}
                {getCountryName(listing.country)}
              </p>
            </div>

            <ShareButtons
              url={`${process.env.NEXT_PUBLIC_APP_URL ?? ''}/wanted/${listing.id}`}
              title={`Wanted: ${listing.game_name}`}
            />
          </div>
        </div>
      </div>

      {listing.notes && (
        <Card className="mt-6">
          <CardBody>
            <p className="text-sm text-semantic-text-muted mb-1">Notes from buyer</p>
            <p className="text-sm text-semantic-text-primary whitespace-pre-line">
              {listing.notes}
            </p>
          </CardBody>
        </Card>
      )}
    </div>
  );
}

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Card, CardBody, ShareButtons, BackLink } from '@/components/ui';
import { GameIdentityRow } from '@/components/listings/atoms';
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
  const displayImage = listing.version_thumbnail ?? listing.image ?? listing.thumbnail;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
      <BackLink href="/wanted" label="Back to wanted games" />

      <div className="space-y-6">
        {/* Game identity */}
        <GameIdentityRow
          thumbnail={displayImage}
          name={listing.game_name}
          versionName={hasEdition ? listing.version_name : null}
          language={hasEdition ? listing.language : null}
          publisher={hasEdition ? listing.publisher : null}
          year={hasEdition ? listing.edition_year : null}
          size="xl"
        />

        {!hasEdition && (
          <p className="text-sm text-semantic-text-muted">Any edition</p>
        )}

        <div className="space-y-3">
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

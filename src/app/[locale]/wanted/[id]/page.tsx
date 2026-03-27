import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ImageSquare, ArrowLeft } from '@phosphor-icons/react/ssr';
import { createClient } from '@/lib/supabase/server';
import { Card, CardBody, Badge, ShareButtons } from '@/components/ui';
import { conditionToBadgeKey } from '@/lib/listings/types';
import { conditionConfig } from '@/lib/condition-config';
import { formatCentsToCurrency } from '@/lib/services/pricing';
import { getCountryFlag, getCountryName } from '@/lib/country-utils';
import { getWantedListingById } from '@/lib/wanted/actions';
import { WantedDetailActions } from './WantedDetailActions';

interface Props {
  params: { id: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const listing = await getWantedListingById(params.id);
  if (!listing) return { title: 'Not found' };

  const condition = conditionConfig[conditionToBadgeKey[listing.min_condition]].label;
  const description = `Looking for ${listing.game_name} in ${condition} condition or better`;

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

export default async function WantedDetailPage({ params }: Props) {
  const listing = await getWantedListingById(params.id);

  if (!listing) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
        <p className="text-semantic-text-muted">Wanted listing not found.</p>
      </div>
    );
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const isOwner = user?.id === listing.buyer_id;
  const isAuthenticated = !!user;

  const conditionKey = conditionToBadgeKey[listing.min_condition];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
      <Link
        href="/wanted"
        className="inline-flex items-center gap-1.5 text-sm text-semantic-text-muted active:text-semantic-primary sm:hover:text-semantic-primary mb-4"
      >
        <ArrowLeft size={16} />
        Back to wanted games
      </Link>

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
          <h1 className="text-2xl sm:text-3xl font-bold text-semantic-text-heading">
            {listing.game_name}
          </h1>
          {listing.game_year && (
            <p className="text-sm text-semantic-text-muted mt-0.5">
              ({listing.game_year})
            </p>
          )}

          <div className="mt-4 space-y-3">
            <div>
              <p className="text-sm text-semantic-text-muted">Minimum condition</p>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge condition={conditionKey} />
                <span className="text-sm text-semantic-text-muted">or better</span>
              </div>
            </div>

            <div>
              <p className="text-sm text-semantic-text-muted">Budget</p>
              <p className="text-lg font-semibold text-semantic-text-heading">
                {listing.max_price_cents
                  ? `Up to ${formatCentsToCurrency(listing.max_price_cents)}`
                  : 'Any price'}
              </p>
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
              url={`${process.env.NEXT_PUBLIC_BASE_URL ?? ''}/wanted/${listing.id}`}
              title={`Wanted: ${listing.game_name}`}
            />

            {listing.offer_count > 0 && (
              <p className="text-xs text-semantic-text-muted">
                {listing.offer_count} {listing.offer_count === 1 ? 'offer' : 'offers'} received
              </p>
            )}
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

      {/* Action area */}
      {!isOwner && isAuthenticated && listing.status === 'active' && (
        <WantedDetailActions
          wantedListingId={listing.id}
          gameName={listing.game_name}
          minCondition={listing.min_condition}
          maxPriceCents={listing.max_price_cents}
        />
      )}

      {!isAuthenticated && listing.status === 'active' && (
        <Card className="mt-6">
          <CardBody className="text-center">
            <p className="text-sm text-semantic-text-muted">
              <Link href="/auth/signin" className="text-semantic-primary font-medium">
                Sign in
              </Link>
              {' '}to make an offer on this wanted game.
            </p>
          </CardBody>
        </Card>
      )}
    </div>
  );
}

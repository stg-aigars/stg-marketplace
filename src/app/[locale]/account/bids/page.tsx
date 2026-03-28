import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { ImageSquare, Gavel } from '@phosphor-icons/react/ssr';
import { requireServerAuth } from '@/lib/auth/helpers';
import { getMyBids } from '@/lib/auctions/actions';
import { Card, CardBody, Badge, Button, EmptyState } from '@/components/ui';
import { formatCentsToCurrency } from '@/lib/services/pricing';
import { formatDate } from '@/lib/date-utils';
import { AuctionCountdown } from '@/components/auctions/AuctionCountdown';

export const metadata: Metadata = { title: 'My bids' };

export default async function MyBidsPage() {
  const { user } = await requireServerAuth();
  const bids = await getMyBids();

  const activeBids = bids.filter((b) => b.listing_status === 'active');
  const wonBids = bids.filter((b) =>
    (b.listing_status === 'auction_ended' || b.listing_status === 'sold') &&
    b.highest_bidder_id === user.id
  );
  const lostBids = bids.filter((b) =>
    (b.listing_status === 'auction_ended' || b.listing_status === 'sold' || b.listing_status === 'cancelled') &&
    b.highest_bidder_id !== user.id
  );

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
      <h1 className="text-2xl sm:text-3xl font-bold text-semantic-text-heading mb-6">
        My bids
      </h1>

      {bids.length === 0 ? (
        <EmptyState
          icon={Gavel}
          title="No bids yet"
          description="Browse auctions and place your first bid."
          action={{ label: 'Browse games', href: '/browse', variant: 'primary' }}
        />
      ) : (
        <div className="space-y-8">
          {activeBids.length > 0 && (
            <BidSection title="Active auctions" bids={activeBids} userId={user.id} />
          )}
          {wonBids.length > 0 && (
            <BidSection title="Won" bids={wonBids} userId={user.id} />
          )}
          {lostBids.length > 0 && (
            <BidSection title="Lost" bids={lostBids} userId={user.id} />
          )}
        </div>
      )}
    </div>
  );
}

function BidSection({ title, bids, userId }: {
  title: string;
  bids: Awaited<ReturnType<typeof getMyBids>>;
  userId: string;
}) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-semantic-text-heading mb-3">{title}</h2>
      <div className="space-y-3">
        {bids.map((bid) => {
          const isWinner = bid.highest_bidder_id === userId;
          const isActive = bid.listing_status === 'active';
          const needsPayment = bid.listing_status === 'auction_ended' && isWinner;

          return (
            <Card key={bid.id}>
              <CardBody>
                <div className="flex gap-3">
                  <div className="relative w-14 h-14 shrink-0 bg-semantic-bg-surface rounded overflow-hidden flex items-center justify-center">
                    {bid.thumbnail ? (
                      <Image src={bid.thumbnail} alt={bid.game_name} fill className="object-contain p-1" sizes="56px" />
                    ) : (
                      <ImageSquare size={24} className="text-semantic-text-muted" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <Link href={`/listings/${bid.listing_id}`} className="text-sm font-medium text-semantic-text-heading truncate block active:text-semantic-primary sm:hover:text-semantic-primary">
                      {bid.game_name}
                      {bid.game_year ? ` (${bid.game_year})` : ''}
                    </Link>
                    <div className="flex items-center gap-2 mt-1 text-xs text-semantic-text-muted">
                      <span>Your bid: {formatCentsToCurrency(bid.amount_cents)}</span>
                      {bid.current_bid_cents && (
                        <span>· Current: {formatCentsToCurrency(bid.current_bid_cents)}</span>
                      )}
                    </div>
                    {isActive && bid.auction_end_at && (
                      <AuctionCountdown endAt={bid.auction_end_at} className="text-xs mt-1" />
                    )}
                    <p className="text-xs text-semantic-text-muted mt-1">
                      Bid placed {formatDate(bid.created_at)}
                    </p>
                  </div>

                  <div className="flex flex-col items-end gap-2 shrink-0">
                    {isActive && isWinner && (
                      <Badge variant="success">Highest</Badge>
                    )}
                    {isActive && !isWinner && (
                      <Badge variant="warning">Outbid</Badge>
                    )}
                    {needsPayment && (
                      <Link href={`/checkout/auction/${bid.listing_id}`}>
                        <Button size="sm">Pay now</Button>
                      </Link>
                    )}
                    {!isActive && isWinner && bid.listing_status === 'sold' && (
                      <Badge variant="success">Won</Badge>
                    )}
                    {!isActive && !isWinner && (
                      <Badge variant="default">Lost</Badge>
                    )}
                  </div>
                </div>
              </CardBody>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

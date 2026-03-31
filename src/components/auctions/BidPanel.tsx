'use client';

import { useState, useEffect, useRef, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Gavel, Lightning } from '@phosphor-icons/react/ssr';
import { Button, Input, Alert, TurnstileWidget } from '@/components/ui';
import type { TurnstileWidgetRef } from '@/components/ui';
import { formatCentsToCurrency } from '@/lib/services/pricing';
import { normalizeDecimalInput } from '@/lib/utils/decimal-input';
import { placeBid } from '@/lib/auctions/bid-actions';
import { getMinimumBid } from '@/lib/auctions/types';
import type { AuctionState, BidWithBidder } from '@/lib/auctions/types';
import { AuctionCountdown } from './AuctionCountdown';

// TODO: revisit thresholds after launch — may need more granular tiers
// (e.g., +€10/+€25 above €100)
function getQuickBidIncrements(minBidCents: number): [number, number] {
  if (minBidCents < 5000) return [200, 400];   // +€2, +€4 under €50
  return [500, 1000];                            // +€5, +€10 above €50
}

interface BidPanelProps {
  listingId: string;
  initialState: AuctionState;
  bids: BidWithBidder[];
  currentUserId: string | null;
  sellerId: string;
}

export function BidPanel({
  listingId,
  initialState,
  bids: initialBids,
  currentUserId,
  sellerId,
}: BidPanelProps) {
  const [state, setState] = useState(initialState);
  const [bids, setBids] = useState(initialBids);
  const [bidEur, setBidEur] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [quickBidLoading, setQuickBidLoading] = useState<number | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileWidgetRef>(null);
  const router = useRouter();

  const isOwner = currentUserId != null && currentUserId === sellerId;
  const isHighestBidder = currentUserId != null && currentUserId === state.highestBidderId;
  const isEnded = state.status !== 'active';
  const hasBid = currentUserId ? bids.some((b) => b.bidder_id === currentUserId) : false;
  const minBid = getMinimumBid(state.currentBidCents, state.startingPriceCents);

  const [inc1, inc2] = getQuickBidIncrements(minBid);
  const quickBids = [
    { cents: minBid },
    { cents: minBid + inc1 },
    { cents: minBid + inc2 },
  ];

  // Poll for auction state + bid history every 10 seconds
  useEffect(() => {
    if (isEnded) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/auctions/${listingId}/state?bids=1`);
        if (res.ok) {
          const fresh = await res.json();
          setState({
            currentBidCents: fresh.currentBidCents,
            startingPriceCents: fresh.startingPriceCents,
            bidCount: fresh.bidCount,
            highestBidderId: fresh.highestBidderId,
            auctionEndAt: fresh.auctionEndAt,
            status: fresh.status,
          });
          if (fresh.bids) setBids(fresh.bids);
        }
      } catch { /* silent — will retry next interval */ }
    }, 10000);

    return () => clearInterval(interval);
  }, [listingId, isEnded]);

  // Proactively warn when custom input value becomes stale
  useEffect(() => {
    if (bidEur) {
      const amountCents = Math.round(parseFloat(bidEur) * 100);
      if (!isNaN(amountCents) && amountCents < minBid) {
        setError(`New bid received — minimum is now ${formatCentsToCurrency(minBid)}`);
      } else {
        setError(null);
      }
    } else {
      setError(null);
    }
  }, [minBid]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleQuickBid(amountCents: number, index: number) {
    setError(null);
    setSuccess(null);
    setQuickBidLoading(index);

    startTransition(async () => {
      const result = await placeBid(listingId, amountCents, turnstileToken ?? undefined);

      if ('error' in result) {
        setError(result.error);
        turnstileRef.current?.reset();
      } else {
        setSuccess(`Bid of ${formatCentsToCurrency(amountCents)} placed`);
        setBidEur('');
        setState((prev) => ({
          ...prev,
          currentBidCents: amountCents,
          bidCount: result.bidCount,
          highestBidderId: currentUserId,
          auctionEndAt: result.newEndAt,
        }));
        turnstileRef.current?.reset();
        router.refresh();
      }
      setQuickBidLoading(null);
    });
  }

  function handleCustomSubmit() {
    setError(null);
    setSuccess(null);

    const amountCents = Math.round(parseFloat(bidEur) * 100);
    if (isNaN(amountCents) || amountCents < minBid) {
      setError(`Minimum bid is ${formatCentsToCurrency(minBid)}`);
      return;
    }

    startTransition(async () => {
      const result = await placeBid(listingId, amountCents, turnstileToken ?? undefined);

      if ('error' in result) {
        setError(result.error);
        turnstileRef.current?.reset();
      } else {
        setSuccess(`Bid of ${formatCentsToCurrency(amountCents)} placed`);
        setBidEur('');
        setState((prev) => ({
          ...prev,
          currentBidCents: amountCents,
          bidCount: result.bidCount,
          highestBidderId: currentUserId,
          auctionEndAt: result.newEndAt,
        }));
        turnstileRef.current?.reset();
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* Time remaining — urgency first */}
      <div>
        <p className="text-sm text-semantic-text-muted mb-0.5">Time remaining</p>
        <AuctionCountdown endAt={state.auctionEndAt} size="lg" />
      </div>

      {/* Current bid / starting price */}
      <div>
        <p className="text-sm text-semantic-text-muted">
          {state.currentBidCents ? 'Current bid' : 'Starting price'}
        </p>
        <p className="text-3xl font-bold font-sans tracking-tight text-semantic-text-heading">
          {formatCentsToCurrency(state.currentBidCents ?? state.startingPriceCents)}
        </p>
        <p className="text-xs text-semantic-text-muted mt-0.5">
          {state.bidCount} {state.bidCount === 1 ? 'bid' : 'bids'}
        </p>
      </div>

      {/* Status banners */}
      {isHighestBidder && !isEnded && (
        <Alert variant="success">You are the highest bidder</Alert>
      )}
      {hasBid && !isHighestBidder && !isEnded && (
        <Alert variant="warning">You have been outbid</Alert>
      )}

      {/* Bid form (quick-bid + custom) */}
      {!isOwner && !isEnded && currentUserId && !isHighestBidder && (
        <div className="space-y-3 pt-2 border-t border-semantic-border-subtle">
          {error && <Alert variant="error">{error}</Alert>}
          {success && <Alert variant="success">{success}</Alert>}

          <TurnstileWidget ref={turnstileRef} onVerify={setTurnstileToken} />

          {/* Quick-bid buttons — stacked on mobile, 3-col on sm+ */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {quickBids.map((qb, i) => (
              <Button
                key={qb.cents}
                variant={i === 0 ? 'primary' : 'secondary'}
                size="lg"
                onClick={() => handleQuickBid(qb.cents, i)}
                loading={quickBidLoading === i}
                disabled={isPending}
              >
                <Lightning size={16} weight="bold" className="mr-1" />
                Bid {formatCentsToCurrency(qb.cents)}
              </Button>
            ))}
          </div>

          {/* Custom bid input */}
          <div className="space-y-2">
            <p className="text-xs text-semantic-text-muted">Or enter a custom amount</p>
            <Input
              type="text"
              inputMode="decimal"
              prefix="€"
              value={bidEur}
              onChange={(e) => setBidEur(normalizeDecimalInput(e.target.value))}
              placeholder={(minBid / 100).toFixed(2)}
            />
            <Button
              variant="secondary"
              onClick={handleCustomSubmit}
              loading={isPending && quickBidLoading === null}
              disabled={isPending}
            >
              <Gavel size={18} weight="bold" className="mr-1.5" />
              Place bid
            </Button>
          </div>

          <p className="text-xs text-semantic-text-muted">
            Bids are final and cannot be withdrawn.
          </p>
        </div>
      )}

      {isOwner && !isEnded && (
        <p className="text-sm text-semantic-text-muted">
          You cannot bid on your own auction.
        </p>
      )}

      {!currentUserId && !isEnded && (
        <p className="text-sm text-semantic-text-muted">
          <Link href="/auth/signin" className="text-semantic-brand font-medium">Sign in</Link> to place a bid.
        </p>
      )}

      {/* Bid history */}
      {bids.length > 0 && (
        <div className="pt-3 border-t border-semantic-border-subtle">
          <p className="text-sm font-medium text-semantic-text-heading mb-2">Bid history</p>
          <ul className="space-y-1.5">
            {bids.slice(0, 10).map((bid) => (
              <li key={bid.id} className="flex items-center justify-between text-xs">
                <span className="text-semantic-text-muted">
                  {bid.bidder_name}
                  {bid.bidder_id === currentUserId && ' (you)'}
                </span>
                <span className="font-medium text-semantic-text-primary">
                  {formatCentsToCurrency(bid.amount_cents)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

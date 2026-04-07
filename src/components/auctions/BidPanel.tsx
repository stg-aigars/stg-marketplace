'use client';

import { useState, useEffect, useRef, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Gavel, Lightning } from '@phosphor-icons/react/ssr';
import { Button, Input, Alert, TurnstileWidget, UserIdentity } from '@/components/ui';
import type { TurnstileWidgetRef } from '@/components/ui';
import { formatCentsToCurrency } from '@/lib/services/pricing';
import { formatMessageTime } from '@/lib/date-utils';
import { normalizeDecimalInput } from '@/lib/utils/decimal-input';
import { placeBid } from '@/lib/auctions/bid-actions';
import { getMinimumBid, getQuickBidIncrements } from '@/lib/auctions/types';
import type { AuctionState, BidWithBidder } from '@/lib/auctions/types';
import { AuctionCountdown } from './AuctionCountdown';

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
  const [showAllBids, setShowAllBids] = useState(false);
  const turnstileRef = useRef<TurnstileWidgetRef>(null);
  const bidEurRef = useRef(bidEur);
  bidEurRef.current = bidEur;
  const stateRef = useRef(state);
  stateRef.current = state;
  const router = useRouter();

  const isOwner = currentUserId != null && currentUserId === sellerId;
  const isHighestBidder = currentUserId != null && currentUserId === state.highestBidderId;
  const isEnded = state.status !== 'active';
  const hasBid = currentUserId ? bids.some((b) => b.bidder_id === currentUserId) : false;
  const minBid = getMinimumBid(state.currentBidCents, state.startingPriceCents);
  const msRemaining = new Date(state.auctionEndAt).getTime() - Date.now();
  const isWithinOneHour = !isEnded && msRemaining > 0 && msRemaining <= 3600000;

  const [inc1, inc2] = getQuickBidIncrements(minBid);
  const quickBids = [
    { cents: minBid },
    { cents: minBid + inc1 },
    { cents: minBid + inc2 },
  ];

  async function pollState() {
    try {
      const res = await fetch(`/api/auctions/${listingId}/state?bids=1`);
      if (res.ok) {
        const fresh = await res.json();
        const cur = stateRef.current;
        if (fresh.bidCount !== cur.bidCount || fresh.status !== cur.status || fresh.auctionEndAt !== cur.auctionEndAt) {
          setState({
            currentBidCents: fresh.currentBidCents,
            startingPriceCents: fresh.startingPriceCents,
            bidCount: fresh.bidCount,
            highestBidderId: fresh.highestBidderId,
            auctionEndAt: fresh.auctionEndAt,
            status: fresh.status,
          });
          if (fresh.bids) setBids(fresh.bids);
          // Clear stale success message when state changes (e.g. outbid)
          setSuccess(null);
        }
      }
    } catch { /* silent — will retry next interval */ }
  }

  useEffect(() => {
    if (isEnded) return;
    const interval = setInterval(pollState, 10000);
    return () => clearInterval(interval);
  }, [listingId, isEnded]);

  // Proactively warn when custom input value becomes stale.
  // Uses ref for bidEur to avoid re-running on every keystroke, and only
  // sets/clears the stale-bid-specific error — never clears server errors.
  useEffect(() => {
    const msg = `New bid received — minimum is now ${formatCentsToCurrency(minBid)}`;
    const currentInput = bidEurRef.current;
    if (currentInput) {
      const amountCents = Math.round(parseFloat(currentInput) * 100);
      if (!isNaN(amountCents) && amountCents < minBid) {
        setError(msg);
      } else {
        setError((prev) => prev?.startsWith('New bid received') ? null : prev);
      }
    } else {
      setError((prev) => prev?.startsWith('New bid received') ? null : prev);
    }
  }, [minBid]);

  async function submitBid(amountCents: number) {
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
      void pollState();
    }
  }

  function handleQuickBid(amountCents: number, index: number) {
    setError(null);
    setSuccess(null);
    setQuickBidLoading(index);
    startTransition(async () => {
      await submitBid(amountCents);
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
    startTransition(() => submitBid(amountCents));
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-semantic-text-muted mb-0.5">Time remaining</p>
        <AuctionCountdown endAt={state.auctionEndAt} size="lg" />
      </div>

      {isWithinOneHour && (
        <Alert variant="info">
          Bids in the last 5 minutes extend the auction by 5 minutes.
        </Alert>
      )}

      <div>
        <p className="text-sm text-semantic-text-muted">
          {state.currentBidCents ? 'Current bid' : 'Starting price'}
        </p>
        <p className="text-3xl font-bold font-sans tracking-tight text-semantic-text-heading">
          {formatCentsToCurrency(state.currentBidCents ?? state.startingPriceCents)}
        </p>
        <p className="text-xs text-semantic-text-muted mt-0.5">
          {state.bidCount} {state.bidCount === 1 ? 'bid' : 'bids'}
          {state.currentBidCents && (
            <span className="ml-2">
              &middot; started at {formatCentsToCurrency(state.startingPriceCents)}
            </span>
          )}
        </p>
      </div>

      {isHighestBidder && !isEnded && (
        <Alert variant="success">You are the highest bidder</Alert>
      )}
      {hasBid && !isHighestBidder && !isEnded && (
        <Alert variant="warning">You have been outbid</Alert>
      )}

      {isEnded && isHighestBidder && state.status === 'auction_ended' && (
        <div className="space-y-3">
          <Alert variant="success">You won this auction</Alert>
          <Button asChild>
            <Link href={`/checkout/auction/${listingId}`}>Pay now</Link>
          </Button>
        </div>
      )}

      {!isOwner && !isEnded && currentUserId && !isHighestBidder && (
        <div className="space-y-3 pt-2 border-t border-semantic-border-subtle">
          {error && <Alert variant="error">{error}</Alert>}
          {success && <Alert variant="success">{success}</Alert>}

          <TurnstileWidget ref={turnstileRef} onVerify={setTurnstileToken} />

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

          <div className="space-y-2">
            <Input
              label={`Custom bid (min ${formatCentsToCurrency(minBid)})`}
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

      {bids.length > 0 && (
        <div className="pt-3 border-t border-semantic-border-subtle">
          <p className="text-sm font-medium text-semantic-text-heading mb-2">Bid history</p>
          <ul className="space-y-2">
            {(showAllBids ? bids : bids.slice(0, 5)).map((bid) => (
              <li key={bid.id} className="flex items-center justify-between text-xs gap-2">
                <UserIdentity
                  name={bid.bidder_name}
                  avatarUrl={bid.bidder_avatar_url}
                  country={bid.bidder_country}
                  size="xs"
                >
                  {bid.bidder_id === currentUserId && <span className="text-semantic-text-muted">(you)</span>}
                </UserIdentity>
                <span className="flex items-center gap-2 shrink-0">
                  <span className="text-semantic-text-muted">{formatMessageTime(bid.created_at)}</span>
                  <span className="font-medium text-semantic-text-primary">
                    {formatCentsToCurrency(bid.amount_cents)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
          {bids.length > 5 && !showAllBids && (
            <button
              type="button"
              onClick={() => setShowAllBids(true)}
              className="text-xs text-semantic-brand font-medium mt-2 active:opacity-70 sm:hover:underline"
            >
              Show all {bids.length} bids
            </button>
          )}
        </div>
      )}
    </div>
  );
}

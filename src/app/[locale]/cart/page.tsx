'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ShoppingCart, Trash } from '@phosphor-icons/react/ssr';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { Alert, Button, Card, CardBody, EmptyState, UserIdentity } from '@/components/ui';
import { ListingIdentity, Price } from '@/components/listings/atoms';
import { formatCentsToCurrency } from '@/lib/services/pricing';
import {
  getShippingPriceCents,
  type TerminalCountry,
} from '@/lib/services/unisend/types';
import type { CartItem, CartValidationResult, CartSellerProfile } from '@/lib/checkout/cart-types';

interface SellerGroup {
  sellerId: string;
  sellerCountry: string;
  sellerName: string;
  sellerAvatarUrl: string | null;
  items: CartItem[];
  shippingCents: number | null;
}

export default function CartPage() {
  const { items, removeItem, clearCart, count } = useCart();
  const { user, profile } = useAuth();
  const [unavailableMap, setUnavailableMap] = useState<Map<string, 'reserved' | 'sold' | 'cancelled'>>(new Map());
  const [sellerProfiles, setSellerProfiles] = useState<Record<string, CartSellerProfile>>({});
  const [validating, setValidating] = useState(false);

  // Validate cart items on mount only
  const validatedRef = useRef(false);
  useEffect(() => {
    if (validatedRef.current || items.length === 0) return;
    validatedRef.current = true;

    const listingIds = items.map((i) => i.listingId);

    // eslint-disable-next-line react-hooks/set-state-in-effect -- async validation on mount
    setValidating(true);
    fetch('/api/cart/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listingIds }),
    })
      .then((res) => res.json())
      .then((data: CartValidationResult) => {
        const map = new Map<string, 'reserved' | 'sold' | 'cancelled'>();
        for (const item of data.unavailable) {
          map.set(item.id, item.reason);
        }
        setUnavailableMap(map);
        if (data.sellers) setSellerProfiles(data.sellers);
      })
      .catch(() => {})
      .finally(() => setValidating(false));
  }, [items]);

  const buyerCountry = profile?.country ?? null;

  // Group items by seller — use fetched profiles for display, localStorage as fallback
  const sellerGroups = useMemo(() => {
    const groupMap = new Map<string, SellerGroup>();

    for (const item of items) {
      if (!groupMap.has(item.sellerId)) {
        let shippingCents: number | null = null;
        if (buyerCountry) {
          shippingCents = getShippingPriceCents(
            item.sellerCountry as TerminalCountry,
            buyerCountry as TerminalCountry,
          );
        }
        const fetched = sellerProfiles[item.sellerId];
        groupMap.set(item.sellerId, {
          sellerId: item.sellerId,
          sellerCountry: fetched?.country ?? item.sellerCountry,
          sellerName: fetched?.name ?? item.sellerName,
          sellerAvatarUrl: fetched?.avatarUrl ?? item.sellerAvatarUrl ?? null,
          items: [],
          shippingCents,
        });
      }
      groupMap.get(item.sellerId)!.items.push(item);
    }

    return Array.from(groupMap.values());
  }, [items, buyerCountry, sellerProfiles]);

  // Totals (informational)
  const availableItems = useMemo(
    () => items.filter((i) => !unavailableMap.has(i.listingId)),
    [items, unavailableMap],
  );
  const itemsTotal = availableItems.reduce((sum, i) => sum + i.priceCents, 0);

  const shippingTotal = useMemo(() => {
    if (!buyerCountry) return null;
    let total = 0;
    const seenSellers = new Set<string>();
    for (const item of availableItems) {
      if (seenSellers.has(item.sellerId)) continue;
      seenSellers.add(item.sellerId);
      const sellerCountry = sellerProfiles[item.sellerId]?.country ?? item.sellerCountry;
      const cost = getShippingPriceCents(
        sellerCountry as TerminalCountry,
        buyerCountry as TerminalCountry,
      );
      if (cost === null) return null;
      total += cost;
    }
    return total;
  }, [availableItems, buyerCountry, sellerProfiles]);

  const grandTotal =
    shippingTotal !== null ? itemsTotal + shippingTotal : null;

  // Empty state
  if (count === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
        <EmptyState
          icon={ShoppingCart}
          title="Nothing in your cart yet"
          description="Browse around — there's probably a pre-loved game with your name on it."
          action={{ label: 'Browse games', href: '/browse' }}
        />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold font-display tracking-tight text-semantic-text-heading">
          Cart
        </h1>
        {count > 1 && (
          <Button variant="ghost" size="sm" onClick={clearCart}>
            Clear cart
          </Button>
        )}
      </div>

      {unavailableMap.size > 0 && (
        <Alert variant="warning" className="mb-4">
          Some items in your cart are no longer available. Please remove them before checking out.
        </Alert>
      )}

      <div className="space-y-6">
        {sellerGroups.map((group) => {
          const groupAvailableItems = group.items.filter((i) => !unavailableMap.has(i.listingId));
          const groupHasUnavailable = group.items.some((i) => unavailableMap.has(i.listingId));
          const groupItemsTotal = groupAvailableItems.reduce((sum, i) => sum + i.priceCents, 0);
          const groupSubtotal = group.shippingCents !== null
            ? groupItemsTotal + group.shippingCents
            : groupItemsTotal;

          return (
            <Card key={group.sellerId}>
              <CardBody>
                {/* Seller header */}
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-semantic-border">
                  <UserIdentity
                    name={group.sellerName}
                    avatarUrl={group.sellerAvatarUrl}
                    country={group.sellerCountry}
                    href={`/sellers/${group.sellerId}`}
                    size="sm"
                  />
                  {buyerCountry && group.shippingCents !== null ? (
                    <span className="text-sm text-semantic-text-secondary shrink-0">
                      Shipping: {formatCentsToCurrency(group.shippingCents)}
                    </span>
                  ) : !buyerCountry ? (
                    <span className="text-xs text-semantic-text-muted shrink-0">
                      Sign in to see shipping
                    </span>
                  ) : null}
                </div>

                {/* Items */}
                <div className="space-y-3">
                  {group.items.map((item) => {
                    const unavailableReason = unavailableMap.get(item.listingId);
                    return (
                      <div key={item.listingId}>
                        <ListingIdentity
                          listingId={item.listingId}
                          image={item.gameThumbnail}
                          title={item.gameTitle}
                          expansionCount={item.expansionCount ?? undefined}
                          disabled={!!unavailableReason}
                          price={<Price cents={item.priceCents} size="sm" />}
                          action={
                            <button
                              onClick={() => removeItem(item.listingId)}
                              className="p-1.5 rounded-md text-semantic-text-muted hover:text-semantic-error hover:bg-semantic-error-bg transition-colors duration-250 ease-out-custom"
                              aria-label={`Remove ${item.gameTitle} from cart`}
                            >
                              <Trash size={18} />
                            </button>
                          }
                        />
                        {unavailableReason && (
                          <p className="text-xs font-medium mt-1 ml-[60px]">
                            {unavailableReason === 'reserved' && (
                              <span className="text-semantic-warning">Reserved</span>
                            )}
                            {unavailableReason === 'sold' && (
                              <span className="text-semantic-error">Sold</span>
                            )}
                            {unavailableReason === 'cancelled' && (
                              <span className="text-semantic-error">No longer available</span>
                            )}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Group footer: subtotal + checkout */}
                <div className="mt-4 pt-3 border-t border-semantic-border">
                  <div className="flex items-center justify-between">
                    <div className="text-sm">
                      <span className="text-semantic-text-secondary">Subtotal: </span>
                      <span className="font-semibold text-semantic-text-primary">
                        {formatCentsToCurrency(groupSubtotal)}
                      </span>
                      {buyerCountry && group.shippingCents !== null && (
                        <span className="text-semantic-text-muted text-xs ml-1">
                          (incl. shipping)
                        </span>
                      )}
                    </div>

                    {user ? (
                      groupHasUnavailable || validating ? (
                        <Button variant="primary" size="sm" disabled>
                          {validating ? 'Validating...' : 'Remove unavailable items first'}
                        </Button>
                      ) : (
                        <Button variant="primary" size="sm" asChild>
                          <Link href={`/checkout?seller=${group.sellerId}`}>
                            Checkout
                          </Link>
                        </Button>
                      )
                    ) : (
                      <Button variant="primary" size="sm" asChild>
                        <Link href="/auth/signin">
                          Sign in to checkout
                        </Link>
                      </Button>
                    )}
                  </div>
                </div>
              </CardBody>
            </Card>
          );
        })}

        {/* Combined total (informational) */}
        {sellerGroups.length > 1 && (
          <div className="flex justify-between items-center px-1 text-sm text-semantic-text-secondary">
            <span>Combined total ({availableItems.length} {availableItems.length === 1 ? 'item' : 'items'})</span>
            <span className="font-semibold text-semantic-text-primary">
              {grandTotal !== null
                ? formatCentsToCurrency(grandTotal)
                : formatCentsToCurrency(itemsTotal)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

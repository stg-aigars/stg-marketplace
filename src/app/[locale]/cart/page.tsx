'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ShoppingCart, Trash } from '@phosphor-icons/react/ssr';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { Alert, Badge, Button, Card, CardBody, EmptyState, UserIdentity } from '@/components/ui';
import { GameThumb } from '@/components/listings/atoms';
import { Price } from '@/components/listings/atoms';
import { formatCentsToCurrency } from '@/lib/services/pricing';
import { formatExpansionCount } from '@/lib/listings/types';
import { conditionToBadgeKey } from '@/lib/listings/types';
import {
  getShippingPriceCents,
  type TerminalCountry,
} from '@/lib/services/unisend/types';
import type { CartItem, CartValidationResult } from '@/lib/checkout/cart-types';

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
  const [validating, setValidating] = useState(false);

  // Validate cart items on mount only
  const validatedRef = useRef(false);
  useEffect(() => {
    if (validatedRef.current || items.length === 0) return;
    validatedRef.current = true;

    const listingIds = items.map((i) => i.listingId);

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
      })
      .catch(() => {})
      .finally(() => setValidating(false));
  }, [items]);

  const buyerCountry = profile?.country ?? null;

  // Group items by seller — use most recently added item for seller identity
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
        groupMap.set(item.sellerId, {
          sellerId: item.sellerId,
          sellerCountry: item.sellerCountry,
          sellerName: item.sellerName,
          sellerAvatarUrl: item.sellerAvatarUrl ?? null,
          items: [],
          shippingCents,
        });
      }
      const group = groupMap.get(item.sellerId)!;
      group.items.push(item);
      // Use most recently added item's seller data (freshest)
      if (item.addedAt > (group.items[group.items.length - 2]?.addedAt ?? '')) {
        group.sellerName = item.sellerName;
        group.sellerAvatarUrl = item.sellerAvatarUrl ?? null;
      }
    }

    return Array.from(groupMap.values());
  }, [items, buyerCountry]);

  // Totals (informational)
  const availableItems = items.filter((i) => !unavailableMap.has(i.listingId));
  const itemsTotal = availableItems.reduce((sum, i) => sum + i.priceCents, 0);

  const shippingTotal = useMemo(() => {
    if (!buyerCountry) return null;
    let total = 0;
    const seenSellers = new Set<string>();
    for (const item of availableItems) {
      if (seenSellers.has(item.sellerId)) continue;
      seenSellers.add(item.sellerId);
      const cost = getShippingPriceCents(
        item.sellerCountry as TerminalCountry,
        buyerCountry as TerminalCountry,
      );
      if (cost === null) return null;
      total += cost;
    }
    return total;
  }, [availableItems, buyerCountry]);

  const grandTotal =
    shippingTotal !== null ? itemsTotal + shippingTotal : null;

  // Empty state
  if (count === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
        <EmptyState
          icon={ShoppingCart}
          title="Your cart is empty"
          description="Browse the marketplace and add some pre-loved games to your cart."
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
                    const isUnavailable = !!unavailableReason;
                    return (
                      <div
                        key={item.listingId}
                        className={`flex items-center gap-3 ${isUnavailable ? 'opacity-50' : ''}`}
                      >
                        {/* Linked thumbnail + details */}
                        <Link
                          href={`/listings/${item.listingId}`}
                          className="flex items-center gap-3 flex-1 min-w-0 group"
                        >
                          <GameThumb
                            src={item.gameThumbnail}
                            alt={item.gameTitle}
                            size="md"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-semantic-text-heading truncate group-hover:text-semantic-brand transition-colors duration-250 ease-out-custom">
                              {item.gameTitle}
                            </p>
                            {item.expansionCount != null && item.expansionCount > 0 && (
                              <p className="text-xs text-semantic-text-muted">
                                {formatExpansionCount(item.expansionCount)}
                              </p>
                            )}
                            <div className="flex items-center gap-2 mt-0.5">
                              <Badge condition={conditionToBadgeKey[item.condition]} />
                              {unavailableReason === 'reserved' && (
                                <span className="text-xs font-medium text-semantic-warning">Reserved</span>
                              )}
                              {unavailableReason === 'sold' && (
                                <span className="text-xs font-medium text-semantic-error">Sold</span>
                              )}
                              {unavailableReason === 'cancelled' && (
                                <span className="text-xs font-medium text-semantic-error">No longer available</span>
                              )}
                            </div>
                          </div>
                        </Link>

                        {/* Price + remove */}
                        <div className="flex items-center gap-3 shrink-0">
                          <Price cents={item.priceCents} size="sm" />
                          <button
                            onClick={() => removeItem(item.listingId)}
                            className="p-1.5 rounded-md text-semantic-text-muted hover:text-semantic-error hover:bg-semantic-error-bg transition-colors duration-250 ease-out-custom"
                            aria-label={`Remove ${item.gameTitle} from cart`}
                          >
                            <Trash size={18} />
                          </button>
                        </div>
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
                          <Link href={`/cart/checkout?seller=${group.sellerId}`}>
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

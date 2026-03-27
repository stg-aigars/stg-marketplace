'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ShoppingCart, Trash, WarningCircle } from '@phosphor-icons/react/ssr';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { Badge, Button, Card, CardBody, EmptyState } from '@/components/ui';
import { formatCentsToCurrency } from '@/lib/services/pricing';
import { getCountryFlag, getCountryName } from '@/lib/country-utils';
import { conditionToBadgeKey, type ListingCondition } from '@/lib/listings/types';
import {
  getShippingPriceCents,
  type TerminalCountry,
} from '@/lib/services/unisend/types';
import type { CartItem, CartValidationResult } from '@/lib/checkout/cart-types';
import { MAX_CART_ITEMS } from '@/lib/checkout/cart-types';

interface SellerGroup {
  sellerId: string;
  sellerCountry: string;
  items: CartItem[];
  shippingCents: number | null;
}

export default function CartPage() {
  const { items, removeItem, clearCart, count } = useCart();
  const { user, profile } = useAuth();
  const [unavailableIds, setUnavailableIds] = useState<Set<string>>(new Set());
  const [validating, setValidating] = useState(false);

  // Validate cart items on mount
  useEffect(() => {
    if (items.length === 0) return;

    const listingIds = items.map((i) => i.listingId);

    setValidating(true);
    fetch('/api/cart/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listingIds }),
    })
      .then((res) => res.json())
      .then((data: CartValidationResult) => {
        setUnavailableIds(new Set(data.unavailable));
      })
      .catch(() => {
        // Silently fail — items will be validated again at checkout
      })
      .finally(() => setValidating(false));
  }, [items]);

  const buyerCountry = profile?.country ?? null;

  // Group items by seller
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
          items: [],
          shippingCents,
        });
      }
      groupMap.get(item.sellerId)!.items.push(item);
    }

    return Array.from(groupMap.values());
  }, [items, buyerCountry]);

  // Totals
  const availableItems = items.filter((i) => !unavailableIds.has(i.listingId));
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

  const hasUnavailable = unavailableIds.size > 0;
  const canCheckout = availableItems.length > 0 && !hasUnavailable;

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
        <h1 className="text-2xl sm:text-3xl font-bold text-semantic-text-heading">
          Cart ({count}/{MAX_CART_ITEMS})
        </h1>
        {count > 1 && (
          <Button variant="ghost" size="sm" onClick={clearCart}>
            Clear cart
          </Button>
        )}
      </div>

      {hasUnavailable && (
        <div className="mb-4 flex items-start gap-2 rounded-lg bg-semantic-warning-bg p-3 text-sm text-semantic-warning-text">
          <WarningCircle size={20} weight="fill" className="mt-0.5 shrink-0" />
          <p>
            Some items in your cart are no longer available. Please remove them
            before checking out.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Items column */}
        <div className="lg:col-span-2 space-y-4">
          {sellerGroups.map((group) => (
            <Card key={group.sellerId}>
              <CardBody>
                {/* Seller header */}
                <div className="flex items-center gap-2 mb-4 pb-3 border-b border-semantic-border">
                  <span className={getCountryFlag(group.sellerCountry)} />
                  <span className="text-sm font-medium text-semantic-text-secondary">
                    Shipping from {getCountryName(group.sellerCountry)}
                  </span>
                  {buyerCountry && group.shippingCents !== null && (
                    <span className="ml-auto text-sm text-semantic-text-secondary">
                      Shipping: {formatCentsToCurrency(group.shippingCents)}
                    </span>
                  )}
                  {!buyerCountry && (
                    <span className="ml-auto text-xs text-semantic-text-tertiary">
                      Sign in to see shipping
                    </span>
                  )}
                </div>

                {/* Items */}
                <div className="space-y-3">
                  {group.items.map((item) => {
                    const isUnavailable = unavailableIds.has(item.listingId);
                    return (
                      <div
                        key={item.listingId}
                        className={`flex items-center gap-3 ${
                          isUnavailable ? 'opacity-50' : ''
                        }`}
                      >
                        {/* Thumbnail */}
                        <div className="relative w-16 h-16 shrink-0 rounded-md overflow-hidden bg-semantic-bg-secondary">
                          {item.gameThumbnail ? (
                            <Image
                              src={item.gameThumbnail}
                              alt={item.gameTitle}
                              fill
                              className="object-cover"
                              sizes="64px"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <ShoppingCart
                                size={24}
                                className="text-semantic-text-tertiary"
                              />
                            </div>
                          )}
                        </div>

                        {/* Details */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-semantic-text-primary truncate">
                            {item.gameTitle}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge
                              condition={
                                conditionToBadgeKey[
                                  item.condition as ListingCondition
                                ]
                              }
                            />
                            {isUnavailable && (
                              <span className="text-xs font-medium text-semantic-error">
                                No longer available
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Price + remove */}
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-sm font-semibold text-semantic-text-primary">
                            {formatCentsToCurrency(item.priceCents)}
                          </span>
                          <button
                            onClick={() => removeItem(item.listingId)}
                            className="p-1.5 rounded-md text-semantic-text-tertiary hover:text-semantic-error hover:bg-semantic-error-bg transition-colors"
                            aria-label={`Remove ${item.gameTitle} from cart`}
                          >
                            <Trash size={18} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardBody>
            </Card>
          ))}
        </div>

        {/* Summary column */}
        <div className="lg:col-span-1">
          <Card>
            <CardBody>
              <h2 className="text-base font-semibold text-semantic-text-heading mb-4">
                Order summary
              </h2>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-semantic-text-secondary">
                    Items ({availableItems.length})
                  </span>
                  <span className="text-semantic-text-primary">
                    {formatCentsToCurrency(itemsTotal)}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-semantic-text-secondary">
                    Shipping
                  </span>
                  <span className="text-semantic-text-primary">
                    {!user
                      ? 'Sign in to see'
                      : shippingTotal !== null
                        ? formatCentsToCurrency(shippingTotal)
                        : 'Unavailable'}
                  </span>
                </div>

                <div className="border-t border-semantic-border pt-2 mt-2">
                  <div className="flex justify-between font-semibold">
                    <span className="text-semantic-text-primary">Total</span>
                    <span className="text-semantic-text-heading">
                      {grandTotal !== null
                        ? formatCentsToCurrency(grandTotal)
                        : formatCentsToCurrency(itemsTotal)}
                    </span>
                  </div>
                  {grandTotal === null && buyerCountry && (
                    <p className="text-xs text-semantic-text-tertiary mt-1">
                      Shipping will be calculated at checkout
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-6">
                {user ? (
                  <Link href={canCheckout ? '/cart/checkout' : '#'}>
                    <Button
                      variant="primary"
                      className="w-full"
                      disabled={!canCheckout || validating}
                    >
                      {validating
                        ? 'Validating...'
                        : hasUnavailable
                          ? 'Remove unavailable items first'
                          : 'Proceed to checkout'}
                    </Button>
                  </Link>
                ) : (
                  <Link href="/auth/signin">
                    <Button variant="primary" className="w-full">
                      Sign in to checkout
                    </Button>
                  </Link>
                )}
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}

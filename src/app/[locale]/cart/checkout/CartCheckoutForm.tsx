'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { ShoppingCart } from '@phosphor-icons/react/ssr';
import { Alert, Badge, Button, Card, CardBody, Input, TurnstileWidget } from '@/components/ui';
import type { TurnstileWidgetRef } from '@/components/ui';
import { TerminalPicker } from '@/components/checkout/TerminalPicker';
import { useCart } from '@/contexts/CartContext';
import { apiFetch } from '@/lib/api-fetch';
import { sanitizeApiError } from '@/lib/utils/error-messages';
import { formatCentsToCurrency } from '@/lib/services/pricing';
import { getCountryName } from '@/lib/country-utils';
import { conditionToBadgeKey } from '@/lib/listings/types';
import { getShippingPriceCents, PHONE_FORMATS, type TerminalCountry, type TerminalOption } from '@/lib/services/unisend/types';
import type { CartValidationResult } from '@/lib/checkout/cart-types';

interface CartCheckoutFormProps {
  buyerCountry: string;
  buyerPhone: string;
  terminals: TerminalOption[];
  terminalsFetchFailed?: boolean;
  walletBalanceCents?: number;
}

export function CartCheckoutForm({
  buyerCountry,
  buyerPhone: initialPhone,
  terminals,
  terminalsFetchFailed,
  walletBalanceCents = 0,
}: CartCheckoutFormProps) {
  const router = useRouter();
  const { items, clearCart } = useCart();
  const [phone, setPhone] = useState(initialPhone);
  const [selectedTerminalId, setSelectedTerminalId] = useState('');
  const [selectedTerminalName, setSelectedTerminalName] = useState('');
  const [selectedTerminalCountry, setSelectedTerminalCountry] = useState('');
  const [useWallet, setUseWallet] = useState(walletBalanceCents > 0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState('');
  const turnstileRef = useRef<TurnstileWidgetRef>(null);
  const [unavailableIds, setUnavailableIds] = useState<Set<string>>(new Set());

  // Validate items on mount only
  const validatedRef = useRef(false);
  useEffect(() => {
    if (validatedRef.current || items.length === 0) return;
    validatedRef.current = true;

    fetch('/api/cart/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listingIds: items.map((i) => i.listingId) }),
    })
      .then((r) => r.json())
      .then((data: CartValidationResult) => {
        if (data.unavailable?.length > 0) {
          setUnavailableIds(new Set(data.unavailable));
          setError('Some items are no longer available. Please return to your cart to remove them.');
        }
      })
      .catch(() => {});
  }, [items]);

  // Group items by seller
  const sellerGroups = useMemo(() => {
    const groups = new Map<string, { sellerCountry: string; items: typeof items; shippingCents: number }>();
    for (const item of items) {
      if (unavailableIds.has(item.listingId)) continue;
      if (!groups.has(item.sellerId)) {
        const shipping = getShippingPriceCents(
          item.sellerCountry as TerminalCountry,
          buyerCountry as TerminalCountry
        ) ?? 0;
        groups.set(item.sellerId, { sellerCountry: item.sellerCountry, items: [], shippingCents: shipping });
      }
      groups.get(item.sellerId)!.items.push(item);
    }
    return Array.from(groups.values());
  }, [items, buyerCountry, unavailableIds]);

  const availableItems = items.filter((i) => !unavailableIds.has(i.listingId));
  const itemsTotalCents = availableItems.reduce((sum, i) => sum + i.priceCents, 0);
  const shippingTotalCents = sellerGroups.reduce((sum, g) => sum + g.shippingCents, 0);
  const grandTotalCents = itemsTotalCents + shippingTotalCents;

  const walletDebitCents = useWallet ? Math.min(walletBalanceCents, grandTotalCents) : 0;
  const cardChargeCents = grandTotalCents - walletDebitCents;
  const walletCoversTotal = walletDebitCents >= grandTotalCents;

  const canSubmit = phone.trim() && selectedTerminalId && availableItems.length > 0 && unavailableIds.size === 0;

  async function handleCheckout() {
    if (!canSubmit) return;

    setLoading(true);
    setError(null);

    const commonBody = {
      listingIds: availableItems.map((i) => i.listingId),
      terminalId: selectedTerminalId,
      terminalName: selectedTerminalName,
      terminalCountry: selectedTerminalCountry || buyerCountry,
      buyerPhone: phone.trim(),
      turnstileToken,
    };

    try {
      if (walletCoversTotal) {
        const response = await apiFetch('/api/payments/cart-wallet-pay', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(commonBody),
        });

        const data = await response.json();

        if (!response.ok) {
          setError(sanitizeApiError(data.error));
          setLoading(false);
          turnstileRef.current?.reset();
          return;
        }

        clearCart();
        router.push(`/orders?from=cart&group=${data.groupId}`);
      } else {
        const response = await apiFetch('/api/payments/cart-create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...commonBody, useWallet }),
        });

        const data = await response.json();

        if (!response.ok) {
          setError(sanitizeApiError(data.error));
          setLoading(false);
          turnstileRef.current?.reset();
          return;
        }

        clearCart();
        window.location.href = data.paymentLink;
      }
    } catch {
      setError('Connection error. Please check your internet and try again.');
      setLoading(false);
      turnstileRef.current?.reset();
    }
  }

  if (items.length === 0) {
    return (
      <Alert variant="info">
        Your cart is empty. <a href="/browse" className="underline">Browse games</a> to add items.
      </Alert>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left: Form */}
      <div className="lg:col-span-2 space-y-6">
        {error && (
          <Alert variant="error" dismissible onDismiss={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Order summary */}
        <Card>
          <CardBody>
            <h2 className="text-base font-semibold text-semantic-text-heading mb-4">
              Order summary ({availableItems.length} {availableItems.length === 1 ? 'item' : 'items'})
            </h2>
            <div className="space-y-4">
              {sellerGroups.map((group, idx) => (
                <div key={idx}>
                  <p className="text-xs font-medium text-semantic-text-muted mb-2">
                    From {getCountryName(group.sellerCountry)} — Shipping: {formatCentsToCurrency(group.shippingCents)}
                  </p>
                  {group.items.map((item) => (
                    <div key={item.listingId} className="flex items-center gap-3 py-2">
                      <div className="relative w-10 h-10 shrink-0 rounded overflow-hidden bg-semantic-bg-secondary">
                        {item.gameThumbnail ? (
                          <Image src={item.gameThumbnail} alt={item.gameTitle} fill className="object-cover" sizes="40px" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <ShoppingCart size={16} className="text-semantic-text-tertiary" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-semantic-text-primary truncate">{item.gameTitle}</p>
                        <Badge condition={conditionToBadgeKey[item.condition]} />
                      </div>
                      <span className="text-sm font-medium text-semantic-text-primary">
                        {formatCentsToCurrency(item.priceCents)}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </CardBody>
        </Card>

        {/* Phone */}
        <div>
          <Input
            label="Phone number"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder={PHONE_FORMATS[buyerCountry as TerminalCountry]?.placeholder ?? '+3706XXXXXXX'}
          />
          <p className="mt-1 text-xs text-semantic-text-muted">
            Required for parcel pickup notifications
          </p>
        </div>

        {/* Terminal selection */}
        <TerminalPicker
          terminals={terminals}
          selectedId={selectedTerminalId}
          onSelect={(t) => {
            setSelectedTerminalId(t.id);
            setSelectedTerminalName(t.name);
            setSelectedTerminalCountry(t.countryCode);
          }}
          fetchFailed={terminalsFetchFailed}
        />

        <TurnstileWidget ref={turnstileRef} onVerify={setTurnstileToken} />
      </div>

      {/* Right: Price breakdown */}
      <div className="lg:col-span-1">
        <Card>
          <CardBody>
            <h2 className="text-base font-semibold text-semantic-text-heading mb-4">
              Payment
            </h2>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-semantic-text-secondary">Items</span>
                <span>{formatCentsToCurrency(itemsTotalCents)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-semantic-text-secondary">Shipping</span>
                <span>{formatCentsToCurrency(shippingTotalCents)}</span>
              </div>

              {walletBalanceCents > 0 && (
                <>
                  <div className="border-t border-semantic-border-subtle pt-2 mt-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={useWallet}
                        onChange={(e) => setUseWallet(e.target.checked)}
                        className="rounded border-semantic-border-default"
                      />
                      <span className="text-semantic-text-secondary">
                        Use wallet ({formatCentsToCurrency(walletBalanceCents)})
                      </span>
                    </label>
                  </div>
                  {useWallet && walletDebitCents > 0 && (
                    <div className="flex justify-between text-frost-arctic">
                      <span>Wallet</span>
                      <span>-{formatCentsToCurrency(walletDebitCents)}</span>
                    </div>
                  )}
                </>
              )}

              <div className="border-t border-semantic-border-subtle pt-2 mt-2">
                <div className="flex justify-between font-semibold text-base">
                  <span>
                    {walletCoversTotal ? 'Wallet charge' : 'Card charge'}
                  </span>
                  <span className="text-semantic-text-heading">
                    {formatCentsToCurrency(walletCoversTotal ? walletDebitCents : cardChargeCents)}
                  </span>
                </div>
              </div>
            </div>

            <Button
              className="w-full mt-6"
              onClick={handleCheckout}
              disabled={!canSubmit || loading}
              loading={loading}
            >
              {walletCoversTotal ? 'Pay with wallet' : `Pay ${formatCentsToCurrency(cardChargeCents)}`}
            </Button>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

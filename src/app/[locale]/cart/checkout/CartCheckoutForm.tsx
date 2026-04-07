'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Alert, Button, Card, CardBody, Skeleton, PhoneInput, TurnstileWidget } from '@/components/ui';
import type { TurnstileWidgetRef } from '@/components/ui';
import { ListingIdentity, Price } from '@/components/listings/atoms';
import { useCart } from '@/contexts/CartContext';
import { apiFetch } from '@/lib/api-fetch';
import { sanitizeApiError } from '@/lib/utils/error-messages';
import { formatCentsToCurrency } from '@/lib/services/pricing';
import { getCountryName } from '@/lib/country-utils';
import { getShippingPriceCents, type TerminalCountry, type TerminalOption } from '@/lib/services/unisend/types';
import type { CountryCode } from '@/lib/country-utils';
import type { CartValidationResult } from '@/lib/checkout/cart-types';

const TerminalSelectorWithMap = dynamic(
  () => import('@/components/checkout/TerminalSelectorWithMap'),
  { ssr: false, loading: () => <Skeleton className="h-[420px] rounded-lg" /> }
);

interface CartCheckoutFormProps {
  buyerCountry: string;
  buyerPhone: string;
  terminals: TerminalOption[];
  terminalsFetchFailed?: boolean;
  walletBalanceCents?: number;
  sellerFilter: string;
}

export function CartCheckoutForm({
  buyerCountry,
  buyerPhone: initialPhone,
  terminals,
  terminalsFetchFailed,
  walletBalanceCents = 0,
  sellerFilter,
}: CartCheckoutFormProps) {
  const router = useRouter();
  const { items, removeItems } = useCart();
  const [phone, setPhone] = useState(initialPhone);
  const [selectedTerminal, setSelectedTerminal] = useState<TerminalOption | null>(null);
  const [useWallet, setUseWallet] = useState(walletBalanceCents > 0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState('');
  const turnstileRef = useRef<TurnstileWidgetRef>(null);
  const [unavailableIds, setUnavailableIds] = useState<Set<string>>(new Set());

  // Filter items to only those matching the seller
  const sellerItems = useMemo(
    () => items.filter((i) => i.sellerId === sellerFilter),
    [items, sellerFilter]
  );

  // Validate items on mount only
  const validatedRef = useRef(false);
  useEffect(() => {
    if (validatedRef.current || sellerItems.length === 0) return;
    validatedRef.current = true;

    fetch('/api/cart/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listingIds: sellerItems.map((i) => i.listingId) }),
    })
      .then((r) => r.json())
      .then((data: CartValidationResult) => {
        if (data.unavailable?.length > 0) {
          setUnavailableIds(new Set(data.unavailable.map((u) => u.id)));
          setError('Some items are no longer available. Please return to your cart to remove them.');
        }
      })
      .catch(() => {});
  }, [sellerItems]);

  const availableItems = sellerItems.filter((i) => !unavailableIds.has(i.listingId));
  const sellerCountry = sellerItems[0]?.sellerCountry;
  const shippingCents = sellerCountry
    ? (getShippingPriceCents(sellerCountry as TerminalCountry, buyerCountry as TerminalCountry) ?? 0)
    : 0;
  const itemsTotalCents = availableItems.reduce((sum, i) => sum + i.priceCents, 0);
  const grandTotalCents = itemsTotalCents + shippingCents;

  const walletDebitCents = useWallet ? Math.min(walletBalanceCents, grandTotalCents) : 0;
  const cardChargeCents = grandTotalCents - walletDebitCents;
  const walletCoversTotal = walletDebitCents >= grandTotalCents;

  const canSubmit = phone.trim() && selectedTerminal && availableItems.length > 0 && unavailableIds.size === 0;

  async function handleCheckout() {
    if (!canSubmit) return;

    setLoading(true);
    setError(null);

    if (!selectedTerminal) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function handlePaymentError(data: any) {
      if (Array.isArray(data.unavailable) && data.unavailable.length > 0) {
        const ids = new Set<string>(data.unavailable);
        setUnavailableIds(ids);
        const names = sellerItems
          .filter((i) => ids.has(i.listingId))
          .map((i) => i.gameTitle);
        const nameList = names.length > 0 ? names.join(', ') : 'some items';
        setError(`Some items are no longer available: ${nameList}. Please return to your cart to remove them.`);
      } else {
        setError(sanitizeApiError(data.error));
      }
      setLoading(false);
      turnstileRef.current?.reset();
    }

    const commonBody = {
      listingIds: availableItems.map((i) => i.listingId),
      terminalId: selectedTerminal.id,
      terminalName: selectedTerminal.name,
      terminalAddress: selectedTerminal.address,
      terminalCity: selectedTerminal.city,
      terminalPostalCode: selectedTerminal.postalCode ?? undefined,
      terminalCountry: selectedTerminal.countryCode || buyerCountry,
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
          handlePaymentError(data);
          return;
        }

        removeItems(availableItems.map(i => i.listingId));
        router.push(`/account/orders?from=cart&group=${data.groupId}`);
      } else {
        const response = await apiFetch('/api/payments/cart-create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...commonBody, useWallet }),
        });

        const data = await response.json();

        if (!response.ok) {
          handlePaymentError(data);
          return;
        }

        removeItems(availableItems.map(i => i.listingId));
        window.location.href = data.paymentLink;
      }
    } catch {
      setError('Connection error. Please check your internet and try again.');
      setLoading(false);
      turnstileRef.current?.reset();
    }
  }

  if (sellerItems.length === 0) {
    return (
      <Alert variant="info">
        No items found for this seller. <Link href="/cart" className="underline">Return to cart</Link>.
      </Alert>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left: Form */}
      <div className="lg:col-span-2 space-y-6">
        {error && (
          <Alert variant="error" dismissible={unavailableIds.size === 0} onDismiss={() => setError(null)}>
            {error}
            {unavailableIds.size > 0 && (
              <div className="mt-2">
                <Link href="/cart" className="text-sm font-medium underline">
                  Back to cart
                </Link>
              </div>
            )}
          </Alert>
        )}

        {/* Order summary */}
        <Card>
          <CardBody>
            <h2 className="text-base font-semibold text-semantic-text-heading mb-4">
              Order summary ({availableItems.length} {availableItems.length === 1 ? 'item' : 'items'})
            </h2>
            <div className="space-y-4">
              <p className="text-xs font-medium text-semantic-text-muted mb-2">
                From {getCountryName(sellerCountry)} — Shipping: {formatCentsToCurrency(shippingCents)}
              </p>
              {sellerItems.map((item) => (
                <ListingIdentity
                  key={item.listingId}
                  listingId={item.listingId}
                  image={item.gameThumbnail}
                  title={item.gameTitle}
                  expansionCount={item.expansionCount ?? undefined}
                  disabled={unavailableIds.has(item.listingId)}
                  price={<Price cents={item.priceCents} size="sm" />}
                />
              ))}
            </div>
          </CardBody>
        </Card>

        {/* Phone */}
        <div>
          <PhoneInput
            label="Phone number"
            value={phone}
            onChange={setPhone}
            defaultCountry={buyerCountry as CountryCode}
          />
          <p className="mt-1 text-xs text-semantic-text-muted">
            Required for parcel pickup notifications
          </p>
        </div>

        {/* Terminal selection */}
        <TerminalSelectorWithMap
          terminals={terminals}
          defaultCountry={buyerCountry as TerminalCountry}
          selectedTerminal={selectedTerminal}
          onSelect={setSelectedTerminal}
          error={terminalsFetchFailed ? 'Failed to load terminals. Please refresh the page.' : undefined}
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
                <span>{formatCentsToCurrency(shippingCents)}</span>
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
                    <div className="flex justify-between text-semantic-brand-active">
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

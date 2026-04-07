'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Alert, Button, Card, CardBody, Skeleton, PhoneInput, TurnstileWidget, UserIdentity } from '@/components/ui';
import type { TurnstileWidgetRef } from '@/components/ui';
import { ListingIdentity, Price } from '@/components/listings/atoms';
import { PaymentMethodLogos } from '@/components/checkout/PaymentMethodLogos';
import { useCart } from '@/contexts/CartContext';
import { apiFetch } from '@/lib/api-fetch';
import { sanitizeApiError } from '@/lib/utils/error-messages';
import { formatCentsToCurrency } from '@/lib/services/pricing';
import { getCountryName } from '@/lib/country-utils';
import { getShippingPriceCents, type TerminalCountry, type TerminalOption } from '@/lib/services/unisend/types';
import type { CountryCode } from '@/lib/country-utils';
import type { CartValidationResult } from '@/lib/checkout/cart-types';
import { LEGAL_ENTITY_NAME, LEGAL_ENTITY_ADDRESS } from '@/lib/constants';

const TerminalSelectorWithMap = dynamic(
  () => import('@/components/checkout/TerminalSelectorWithMap'),
  { ssr: false, loading: () => <Skeleton className="h-[420px] rounded-lg" /> }
);

interface SellerProfile {
  id: string;
  name: string;
  avatarUrl: string | null;
  country: string | null;
}

interface CheckoutFormProps {
  buyerCountry: string;
  buyerPhone: string;
  terminals: TerminalOption[];
  terminalsFetchFailed?: boolean;
  walletBalanceCents?: number;
  sellerFilter: string;
  sellerProfile?: SellerProfile | null;
}

export function CheckoutForm({
  buyerCountry,
  buyerPhone: initialPhone,
  terminals,
  terminalsFetchFailed,
  walletBalanceCents = 0,
  sellerFilter,
  sellerProfile,
}: CheckoutFormProps) {
  const router = useRouter();
  const { items, removeItem, removeItems } = useCart();
  const [phone, setPhone] = useState(initialPhone);
  const [selectedTerminal, setSelectedTerminal] = useState<TerminalOption | null>(null);
  const [useWallet, setUseWallet] = useState(walletBalanceCents > 0);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
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

  // Check for auction items with deadlines
  const auctionItems = useMemo(
    () => sellerItems.filter((i) => i.isAuction && i.auctionDeadlineAt),
    [sellerItems]
  );
  const [expiredAuctionIds, setExpiredAuctionIds] = useState<Set<string>>(new Set());

  // Auction deadline countdown — track expired items
  useEffect(() => {
    if (auctionItems.length === 0) return;

    function checkDeadlines() {
      const now = Date.now();
      const newExpired = new Set<string>();
      for (const item of auctionItems) {
        if (item.auctionDeadlineAt && new Date(item.auctionDeadlineAt).getTime() <= now) {
          newExpired.add(item.listingId);
        }
      }
      setExpiredAuctionIds((prev) => {
        if (newExpired.size === prev.size && [...newExpired].every((id) => prev.has(id))) return prev;
        return newExpired;
      });
    }

    checkDeadlines();
    const interval = setInterval(checkDeadlines, 1000);
    return () => clearInterval(interval);
  }, [auctionItems]);

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

  const availableItems = sellerItems.filter(
    (i) => !unavailableIds.has(i.listingId) && !expiredAuctionIds.has(i.listingId)
  );
  const sellerCountry = sellerItems[0]?.sellerCountry;
  const shippingCents = sellerCountry
    ? (getShippingPriceCents(sellerCountry as TerminalCountry, buyerCountry as TerminalCountry) ?? 0)
    : 0;
  const itemsTotalCents = availableItems.reduce((sum, i) => sum + i.priceCents, 0);
  const grandTotalCents = itemsTotalCents + shippingCents;

  const walletDebitCents = useWallet ? Math.min(walletBalanceCents, grandTotalCents) : 0;
  const cardChargeCents = grandTotalCents - walletDebitCents;
  const walletCoversTotal = walletDebitCents >= grandTotalCents;

  const allExpired = availableItems.length === 0 && expiredAuctionIds.size > 0;
  const canSubmit = phone.trim() && selectedTerminal && availableItems.length > 0 && unavailableIds.size === 0 && acceptedTerms;

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
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
      {/* Left column: Shipping + Payment (appears second on mobile) */}
      <div className="lg:col-span-7 order-2 lg:order-1 space-y-6">
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

        {/* Expired auction warning with remove action */}
        {expiredAuctionIds.size > 0 && !allExpired && (
          <Alert variant="warning">
            {sellerItems
              .filter((i) => expiredAuctionIds.has(i.listingId))
              .map((i) => (
                <div key={i.listingId} className="flex items-center justify-between gap-2">
                  <span>Payment deadline passed for &ldquo;{i.gameTitle}&rdquo;</span>
                  <button
                    type="button"
                    onClick={() => removeItem(i.listingId)}
                    className="text-sm font-medium underline shrink-0"
                  >
                    Remove
                  </button>
                </div>
              ))}
          </Alert>
        )}

        {allExpired && (
          <Alert variant="error">
            All auction items have expired. <Link href="/cart" className="underline">Return to cart</Link>.
          </Alert>
        )}

        {/* Card 1: Shipping */}
        <Card>
          <CardBody className="sm:p-6">
            <h2 className="text-base font-semibold text-semantic-text-heading mb-4">
              Shipping
            </h2>

            <div className="space-y-4">
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

              <TerminalSelectorWithMap
                terminals={terminals}
                defaultCountry={buyerCountry as TerminalCountry}
                selectedTerminal={selectedTerminal}
                onSelect={setSelectedTerminal}
                error={terminalsFetchFailed ? 'Failed to load terminals. Please refresh the page.' : undefined}
              />
            </div>
          </CardBody>
        </Card>

        {/* Card 2: Payment */}
        <Card>
          <CardBody className="sm:p-6">
            <h2 className="text-base font-semibold text-semantic-text-heading mb-4">
              Payment
            </h2>

            {/* Terms & refund consent */}
            <div className="mb-4">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-semantic-border-default text-semantic-brand focus:ring-semantic-brand"
                />
                <span className="text-sm text-semantic-text-secondary">
                  I agree to the{' '}
                  <Link href="/terms" target="_blank" className="text-semantic-brand underline">
                    Terms &amp; Conditions
                  </Link>
                  {' '}and acknowledge the refund policy
                </span>
              </label>
              <p className="mt-2 ml-7 text-xs text-semantic-text-muted leading-relaxed">
                All sellers are private persons — EU consumer protection rights do not apply.
                Disputes may be raised within 2 days of delivery.
                &ldquo;Changed mind&rdquo; refunds are not available.
              </p>
            </div>

            <TurnstileWidget ref={turnstileRef} onVerify={setTurnstileToken} />

            <Button
              variant="primary"
              size="lg"
              className="w-full mt-4"
              onClick={handleCheckout}
              disabled={!canSubmit || loading}
              loading={loading}
            >
              {walletCoversTotal ? 'Pay with wallet' : `Pay ${formatCentsToCurrency(cardChargeCents)}`}
            </Button>

            {walletCoversTotal ? (
              <p className="mt-3 text-xs text-semantic-text-muted text-center">
                Payment will be deducted from your wallet balance
              </p>
            ) : (
              <div className="mt-4 pt-4 border-t border-semantic-border-subtle text-center space-y-3">
                <p className="text-xs text-semantic-text-muted">
                  You will be redirected to a secure payment page. We accept:
                </p>
                <PaymentMethodLogos country={buyerCountry} />
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Right column: Order summary (appears first on mobile) */}
      <div className="lg:col-span-5 order-1 lg:order-2">
        <Card className="lg:sticky lg:top-[4.5rem]">
          <CardBody className="sm:p-6">
            <h2 className="text-base font-semibold text-semantic-text-heading mb-4">
              Order summary
            </h2>

            {/* Item rows */}
            <div className="space-y-3 mb-4">
              {sellerItems.map((item) => {
                const isExpired = expiredAuctionIds.has(item.listingId);
                const isUnavailable = unavailableIds.has(item.listingId);
                return (
                  <ListingIdentity
                    key={item.listingId}
                    listingId={item.listingId}
                    image={item.gameThumbnail}
                    title={item.gameTitle}
                    expansionCount={item.expansionCount ?? undefined}
                    disabled={isUnavailable || isExpired}
                    size="sm"
                    price={
                      <div className="text-right">
                        <Price cents={item.priceCents} size="sm" />
                        {item.isAuction && (
                          <p className="text-xs text-semantic-text-muted">winning bid</p>
                        )}
                      </div>
                    }
                  />
                );
              })}
            </div>

            {/* Price breakdown */}
            <div className="space-y-2 text-sm border-t border-semantic-border-subtle pt-3">
              <div>
                <div className="flex justify-between">
                  <span className="text-semantic-text-secondary">Shipping</span>
                  <span>{formatCentsToCurrency(shippingCents)}</span>
                </div>
                {sellerCountry && (
                  <p className="text-xs text-semantic-text-muted mt-0.5">
                    Parcel locker: {getCountryName(sellerCountry)} → {getCountryName(buyerCountry)}
                  </p>
                )}
              </div>

              <div className="border-t border-semantic-border-subtle pt-2 mt-2">
                <div className="flex justify-between font-semibold">
                  <span className="text-semantic-text-heading">Total</span>
                  <span className="text-semantic-text-heading">
                    {formatCentsToCurrency(grandTotalCents)}
                  </span>
                </div>
              </div>

              {walletBalanceCents > 0 && (
                <>
                  <div className="border-t border-semantic-border-subtle pt-2 mt-2">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={useWallet}
                        onClick={() => setUseWallet(!useWallet)}
                        className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors duration-250 ease-out-custom ${
                          useWallet ? 'bg-semantic-brand' : 'bg-semantic-border-default'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-250 ease-out-custom ${
                            useWallet ? 'translate-x-4' : 'translate-x-0'
                          }`}
                        />
                      </button>
                      <span className="text-sm text-semantic-text-secondary">
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
                  {useWallet && (
                    <div className="border-t border-semantic-border-subtle pt-2 mt-2">
                      <div className="flex justify-between font-semibold text-base">
                        <span className="text-semantic-text-heading">
                          {walletCoversTotal ? 'Wallet charge' : 'Card charge'}
                        </span>
                        <span className="text-semantic-text-heading">
                          {formatCentsToCurrency(walletCoversTotal ? walletDebitCents : cardChargeCents)}
                        </span>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Seller info */}
            {sellerProfile && (
              <div className="mt-4 pt-4 border-t border-semantic-border-subtle">
                <p className="text-xs text-semantic-text-muted mb-2">Seller</p>
                <UserIdentity
                  name={sellerProfile.name}
                  avatarUrl={sellerProfile.avatarUrl}
                  country={sellerProfile.country ?? undefined}
                  href={`/sellers/${sellerProfile.id}`}
                  size="sm"
                />
                <p className="mt-1 text-xs text-semantic-text-muted">
                  Private seller — EU consumer rights do not apply
                </p>
              </div>
            )}

            {/* Platform operator */}
            <div className="mt-4 pt-4 border-t border-semantic-border-subtle">
              <p className="text-xs text-semantic-text-muted mb-2">Platform operator</p>
              <p className="text-sm text-semantic-text-secondary">{LEGAL_ENTITY_NAME}</p>
              <p className="text-xs text-semantic-text-muted mt-0.5">{LEGAL_ENTITY_ADDRESS}</p>
            </div>

          </CardBody>
        </Card>
      </div>
    </div>
  );
}

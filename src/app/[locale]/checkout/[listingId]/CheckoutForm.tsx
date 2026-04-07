'use client';

import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { Button, Alert, Skeleton, PhoneInput, TurnstileWidget } from '@/components/ui';
import type { TurnstileWidgetRef } from '@/components/ui';
import { apiFetch } from '@/lib/api-fetch';
import { sanitizeApiError } from '@/lib/utils/error-messages';
import type { TerminalOption, TerminalCountry } from '@/lib/services/unisend/types';
import type { CountryCode } from '@/lib/country-utils';

const TerminalSelectorWithMap = dynamic(
  () => import('@/components/checkout/TerminalSelectorWithMap'),
  { ssr: false, loading: () => <Skeleton className="h-[420px] rounded-lg" /> }
);

interface CheckoutFormProps {
  listingId: string;
  buyerCountry: string;
  buyerPhone: string;
  terminals: TerminalOption[];
  terminalsFetchFailed?: boolean;
  walletBalanceCents?: number;
  walletCoversTotal?: boolean;
  isAuction?: boolean;
  paymentDeadlineAt?: string | null;
}

export function CheckoutForm({
  listingId,
  buyerCountry,
  buyerPhone: initialPhone,
  terminals,
  terminalsFetchFailed,
  walletBalanceCents = 0,
  walletCoversTotal = false,
  isAuction = false,
  paymentDeadlineAt,
}: CheckoutFormProps) {
  const [phone, setPhone] = useState(initialPhone);
  const [selectedTerminal, setSelectedTerminal] = useState<TerminalOption | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState('');
  const [deadlineExpired, setDeadlineExpired] = useState(false);
  const turnstileRef = useRef<TurnstileWidgetRef>(null);

  // Auction deadline countdown — disable form when deadline passes
  useEffect(() => {
    if (!isAuction || !paymentDeadlineAt) return;

    const deadlineMs = new Date(paymentDeadlineAt).getTime();
    if (Date.now() >= deadlineMs) {
      setDeadlineExpired(true);
      return;
    }

    const timeout = setTimeout(() => {
      setDeadlineExpired(true);
    }, deadlineMs - Date.now());

    return () => clearTimeout(timeout);
  }, [isAuction, paymentDeadlineAt]);

  const canSubmit = phone.trim() && selectedTerminal && !deadlineExpired;

  const useWallet = walletBalanceCents > 0;

  async function handleCheckout() {
    if (!canSubmit || !selectedTerminal) return;

    setLoading(true);
    setError(null);

    const commonBody = {
      listingId,
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
        // Full wallet payment — no EveryPay needed
        const response = await apiFetch('/api/payments/wallet-pay', {
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

        window.location.href = `/orders/${data.orderId}`;
      } else {
        // Card payment (with optional wallet partial debit)
        const response = await apiFetch('/api/payments/create', {
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

        window.location.href = data.paymentLink;
      }
    } catch {
      setError('Connection error. Please check your internet and try again.');
      setLoading(false);
      turnstileRef.current?.reset();
    }
  }

  return (
    <div className="space-y-4">
      {deadlineExpired && (
        <Alert variant="error">
          Payment deadline has passed. This auction is no longer available.
        </Alert>
      )}

      {/* Phone number */}
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

      <TurnstileWidget ref={turnstileRef} onVerify={setTurnstileToken} />

      {/* Pay button */}
      <Button
        variant="primary"
        size="lg"
        loading={loading}
        onClick={handleCheckout}
        disabled={!canSubmit || terminalsFetchFailed}
        className="w-full"
      >
        {walletCoversTotal ? 'Pay with wallet' : 'Pay now'}
      </Button>

      {error && (
        <p className="text-sm text-semantic-error">{error}</p>
      )}

      <p className="text-xs text-semantic-text-muted text-center">
        {walletCoversTotal
          ? 'Payment will be deducted from your wallet balance'
          : 'You will be redirected to a secure payment page'}
      </p>
    </div>
  );
}

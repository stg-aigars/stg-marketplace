'use client';

import { useState, useRef } from 'react';
import { Button, PhoneInput, TurnstileWidget } from '@/components/ui';
import type { TurnstileWidgetRef } from '@/components/ui';
import { TerminalPicker } from '@/components/checkout/TerminalPicker';
import { apiFetch } from '@/lib/api-fetch';
import { sanitizeApiError } from '@/lib/utils/error-messages';
import type { TerminalOption } from '@/lib/services/unisend/types';
import type { CountryCode } from '@/lib/country-utils';

interface CheckoutFormProps {
  listingId: string;
  buyerCountry: string;
  buyerPhone: string;
  terminals: TerminalOption[];
  terminalsFetchFailed?: boolean;
  walletBalanceCents?: number;
  walletCoversTotal?: boolean;
}

export function CheckoutForm({
  listingId,
  buyerCountry,
  buyerPhone: initialPhone,
  terminals,
  terminalsFetchFailed,
  walletBalanceCents = 0,
  walletCoversTotal = false,
}: CheckoutFormProps) {
  const [phone, setPhone] = useState(initialPhone);
  const [selectedTerminalId, setSelectedTerminalId] = useState('');
  const [selectedTerminalName, setSelectedTerminalName] = useState('');
  const [selectedTerminalAddress, setSelectedTerminalAddress] = useState('');
  const [selectedTerminalCity, setSelectedTerminalCity] = useState('');
  const [selectedTerminalPostalCode, setSelectedTerminalPostalCode] = useState('');
  const [selectedTerminalCountry, setSelectedTerminalCountry] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState('');
  const turnstileRef = useRef<TurnstileWidgetRef>(null);

  const canSubmit = phone.trim() && selectedTerminalId;

  const useWallet = walletBalanceCents > 0;

  async function handleCheckout() {
    if (!canSubmit) return;

    setLoading(true);
    setError(null);

    const commonBody = {
      listingId,
      terminalId: selectedTerminalId,
      terminalName: selectedTerminalName,
      terminalAddress: selectedTerminalAddress,
      terminalCity: selectedTerminalCity,
      terminalPostalCode: selectedTerminalPostalCode,
      terminalCountry: selectedTerminalCountry || buyerCountry,
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

      <TerminalPicker
        terminals={terminals}
        selectedId={selectedTerminalId}
        onSelect={(t) => {
          setSelectedTerminalId(t.id);
          setSelectedTerminalName(t.name);
          setSelectedTerminalAddress(t.address);
          setSelectedTerminalCity(t.city);
          setSelectedTerminalPostalCode(t.postalCode ?? '');
          setSelectedTerminalCountry(t.countryCode);
        }}
        fetchFailed={terminalsFetchFailed}
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

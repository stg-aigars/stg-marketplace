'use client';

import { useState, useRef } from 'react';
import { Button, Input, Alert, Card, CardBody, TurnstileWidget } from '@/components/ui';
import type { TurnstileWidgetRef } from '@/components/ui';
import { formatCentsToCurrency } from '@/lib/services/pricing';
import { TerminalPicker } from '@/components/checkout/TerminalPicker';
import { PHONE_FORMATS, type TerminalCountry, type TerminalOption } from '@/lib/services/unisend/types';
import { apiFetch } from '@/lib/api-fetch';

interface AuctionCheckoutFormProps {
  listingId: string;
  winningBidCents: number;
  shippingCents: number;
  totalCents: number;
  buyerCountry: TerminalCountry;
  terminals: TerminalOption[];
  terminalsFetchFailed?: boolean;
}

export function AuctionCheckoutForm({
  listingId,
  winningBidCents,
  shippingCents,
  totalCents,
  buyerCountry,
  terminals,
  terminalsFetchFailed,
}: AuctionCheckoutFormProps) {
  const [selectedTerminal, setSelectedTerminal] = useState<TerminalOption | null>(null);
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileWidgetRef>(null);

  const phoneFormat = PHONE_FORMATS[buyerCountry];

  async function handleSubmit() {
    if (!selectedTerminal || !phone.trim()) {
      setError('Please select a terminal and enter your phone number');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const res = await apiFetch('/api/payments/create', {
        method: 'POST',
        body: JSON.stringify({
          listingId,
          terminalId: selectedTerminal.id,
          terminalName: selectedTerminal.name,
          terminalCountry: selectedTerminal.countryCode,
          buyerPhone: phone.trim(),
          useWallet: false,
          turnstileToken,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? 'Payment failed');
        setLoading(false);
        turnstileRef.current?.reset();
        return;
      }

      if (data.paymentLink) {
        window.location.href = data.paymentLink;
      }
    } catch {
      setError('Something went wrong. Please try again.');
      setLoading(false);
      turnstileRef.current?.reset();
    }
  }

  return (
    <div className="space-y-6">
      {error && <Alert variant="error">{error}</Alert>}

      <Card>
        <CardBody className="space-y-4">
          <h2 className="text-base font-semibold text-semantic-text-heading">
            Pickup terminal
          </h2>
          {terminalsFetchFailed ? (
            <Alert variant="error">
              Failed to load terminals. Please refresh the page.
            </Alert>
          ) : (
            <TerminalPicker
              terminals={terminals}
              selectedId={selectedTerminal?.id ?? ''}
              onSelect={setSelectedTerminal}
            />
          )}

          <Input
            label="Phone number (for delivery notifications)"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder={phoneFormat?.placeholder ?? '+371 20000000'}
          />
        </CardBody>
      </Card>

      <Card>
        <CardBody className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-semantic-text-muted">Winning bid</span>
            <span className="text-semantic-text-primary">{formatCentsToCurrency(winningBidCents)}</span>
          </div>
          {shippingCents > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-semantic-text-muted">Shipping</span>
              <span className="text-semantic-text-primary">{formatCentsToCurrency(shippingCents)}</span>
            </div>
          )}
          <div className="flex justify-between text-base font-semibold border-t border-semantic-border-subtle pt-2">
            <span className="text-semantic-text-heading">Total</span>
            <span className="text-semantic-text-heading">{formatCentsToCurrency(totalCents)}</span>
          </div>
        </CardBody>
      </Card>

      <TurnstileWidget ref={turnstileRef} onVerify={setTurnstileToken} />

      <Button
        onClick={handleSubmit}
        loading={loading}
        disabled={!selectedTerminal || !phone.trim() || terminalsFetchFailed}
        size="lg"
      >
        Pay {formatCentsToCurrency(totalCents)}
      </Button>
    </div>
  );
}

'use client';

import { useState, useMemo } from 'react';
import { Button, Input } from '@/components/ui';
import { sanitizeApiError } from '@/lib/utils/error-messages';
import { PHONE_FORMATS, type TerminalCountry } from '@/lib/services/unisend/types';

interface TerminalOption {
  id: string;
  name: string;
  city: string;
  address: string;
  countryCode: string;
}

interface CheckoutFormProps {
  listingId: string;
  buyerCountry: string;
  buyerPhone: string;
  terminals: TerminalOption[];
  terminalsFetchFailed?: boolean;
}

export function CheckoutForm({
  listingId,
  buyerCountry,
  buyerPhone: initialPhone,
  terminals,
  terminalsFetchFailed,
}: CheckoutFormProps) {
  const [phone, setPhone] = useState(initialPhone);
  const [selectedTerminalId, setSelectedTerminalId] = useState('');
  const [terminalSearch, setTerminalSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Group and filter terminals by search
  const filteredTerminals = useMemo(() => {
    const query = terminalSearch.toLowerCase();
    const filtered = query
      ? terminals.filter(
          (t) =>
            t.name.toLowerCase().includes(query) ||
            t.city.toLowerCase().includes(query) ||
            t.address.toLowerCase().includes(query)
        )
      : terminals;

    // Group by city
    const grouped: Record<string, TerminalOption[]> = {};
    for (const t of filtered) {
      if (!grouped[t.city]) grouped[t.city] = [];
      grouped[t.city].push(t);
    }
    return grouped;
  }, [terminals, terminalSearch]);

  const selectedTerminal = terminals.find((t) => t.id === selectedTerminalId);
  const canSubmit = phone.trim() && selectedTerminalId;

  async function handleCheckout() {
    if (!canSubmit) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/payments/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        body: JSON.stringify({
          listingId,
          terminalId: selectedTerminalId,
          terminalName: selectedTerminal?.name ?? '',
          terminalCountry: selectedTerminal?.countryCode ?? buyerCountry,
          buyerPhone: phone.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(sanitizeApiError(data.error));
        setLoading(false);
        return;
      }

      window.location.href = data.paymentLink;
    } catch {
      setError('Connection error. Please check your internet and try again.');
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Phone number */}
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
      <div>
        <label className="block text-sm font-medium text-semantic-text-secondary mb-1.5">
          Pickup terminal
        </label>
        {terminalsFetchFailed && (
          <div className="mb-2 p-4 rounded-lg bg-aurora-yellow/10 border border-aurora-yellow/30 text-sm text-semantic-text-secondary">
            Pickup terminals could not be loaded. Please try refreshing the page. If the problem persists, try again in a few minutes.
          </div>
        )}
        <Input
          type="text"
          value={terminalSearch}
          onChange={(e) => setTerminalSearch(e.target.value)}
          placeholder="Search by city or terminal name..."
        />
        <div className="mt-2 max-h-64 sm:max-h-48 overflow-y-auto rounded-lg border border-semantic-border-subtle">
          {Object.keys(filteredTerminals).length === 0 ? (
            <p className="p-3 text-sm text-semantic-text-muted">
              No terminals found
            </p>
          ) : (
            Object.entries(filteredTerminals).map(([city, cityTerminals]) => (
              <div key={city}>
                <div className="px-3 py-1.5 bg-semantic-bg-subtle text-xs font-medium text-semantic-text-muted uppercase tracking-wide sticky top-0">
                  {city}
                </div>
                {cityTerminals.map((terminal) => (
                  <button
                    key={terminal.id}
                    type="button"
                    onClick={() => setSelectedTerminalId(terminal.id)}
                    className={`w-full text-left px-3 py-2.5 text-sm transition-colors min-h-[44px] ${
                      selectedTerminalId === terminal.id
                        ? 'bg-semantic-primary/10 text-semantic-primary'
                        : 'text-semantic-text-primary sm:hover:bg-semantic-bg-subtle'
                    }`}
                  >
                    <span className="font-medium">{terminal.name}</span>
                    <span className="block text-xs text-semantic-text-muted mt-0.5">
                      {terminal.address}
                    </span>
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
        {selectedTerminal && (
          <p className="mt-2 text-sm text-semantic-text-secondary">
            Selected: {selectedTerminal.name}, {selectedTerminal.city}
          </p>
        )}
      </div>

      {/* Pay button */}
      <Button
        variant="primary"
        size="lg"
        loading={loading}
        onClick={handleCheckout}
        disabled={!canSubmit || terminalsFetchFailed}
        className="w-full"
      >
        Pay now
      </Button>

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      <p className="text-xs text-semantic-text-muted text-center">
        You will be redirected to a secure payment page
      </p>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { Alert, Button, Input, Modal } from '@/components/ui';
import { apiFetch } from '@/lib/api-fetch';
import { formatCentsToCurrency } from '@/lib/services/pricing';
import { sanitizeApiError } from '@/lib/utils/error-messages';

interface WithdrawalFormProps {
  balanceCents: number;
}

export function WithdrawalForm({ balanceCents }: WithdrawalFormProps) {
  const [open, setOpen] = useState(false);
  const [amountEuros, setAmountEuros] = useState('');
  const [holder, setHolder] = useState('');
  const [iban, setIban] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const amountCents = Math.round(parseFloat(amountEuros || '0') * 100);
  const canSubmit = amountCents > 0 && amountCents <= balanceCents && holder.trim() && iban.trim();

  async function handleSubmit() {
    if (!canSubmit) return;

    setLoading(true);
    setError(null);

    try {
      const res = await apiFetch('/api/wallet/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amountCents,
          bankAccountHolder: holder.trim(),
          bankIban: iban.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(sanitizeApiError(data.error));
        return;
      }

      setSuccess(true);
      setTimeout(() => window.location.reload(), 1500);
    } catch {
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button variant="primary" size="sm" onClick={() => setOpen(true)}>
        Request withdrawal
      </Button>

      <Modal open={open} onClose={() => setOpen(false)} title="Request withdrawal">
        <div className="space-y-4">
          {success ? (
            <div className="text-center py-4">
              <p className="text-semantic-text-heading font-medium">Withdrawal request submitted</p>
              <p className="text-sm text-semantic-text-muted mt-1">
                We will process your request and transfer the funds to your bank account.
              </p>
            </div>
          ) : (
            <>
              <p className="text-sm text-semantic-text-muted">
                Available balance: {formatCentsToCurrency(balanceCents)}
              </p>

              <Input
                label="Amount (EUR)"
                type="number"
                min="0.01"
                step="0.01"
                max={(balanceCents / 100).toFixed(2)}
                value={amountEuros}
                onChange={(e) => setAmountEuros(e.target.value)}
                placeholder="0.00"
              />

              <Input
                label="Account holder name"
                value={holder}
                onChange={(e) => setHolder(e.target.value)}
                placeholder="As it appears on your bank account"
              />

              <Input
                label="IBAN"
                value={iban}
                onChange={(e) => setIban(e.target.value)}
                placeholder="LV00XXXX0000000000000"
              />

              {error && <Alert variant="error">{error}</Alert>}

              <div className="flex gap-3 pt-2">
                <Button variant="secondary" onClick={() => setOpen(false)} className="flex-1">
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  loading={loading}
                  disabled={!canSubmit}
                  onClick={handleSubmit}
                  className="flex-1"
                >
                  Submit request
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </>
  );
}

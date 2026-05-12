'use client';

import { useState } from 'react';
import { Alert, Button, Input } from '@/components/ui';
import { apiFetch } from '@/lib/api-fetch';
import { sanitizeApiError } from '@/lib/utils/error-messages';
import type { WithdrawalStatus } from '@/lib/wallet/types';

interface WithdrawalActionsProps {
  withdrawalId: string;
  currentStatus: WithdrawalStatus;
}

export function WithdrawalActions({ withdrawalId, currentStatus }: WithdrawalActionsProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Optional bank-side confirmation reference for the outbound SEPA wire.
  // Captured at completion time; lands in the C.4 GL entry's posting_context
  // for audit / dispute / fraud forensics. Empty string = not provided
  // (handler treats as undefined; field absent from posting_context).
  const [bankConfirmationRef, setBankConfirmationRef] = useState('');

  async function handleAction(action: 'approve' | 'reject' | 'complete') {
    setLoading(action);
    setError(null);

    try {
      const body: Record<string, unknown> = { action };
      if (action === 'complete' && bankConfirmationRef.trim().length > 0) {
        body.bankConfirmationRef = bankConfirmationRef.trim();
      }
      const res = await apiFetch(`/api/staff/withdrawals/${withdrawalId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(sanitizeApiError(data.error));
        return;
      }

      window.location.reload();
    } catch {
      setError('Connection error');
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-2">
      {currentStatus === 'approved' && (
        <Input
          label="Bank confirmation reference (optional)"
          value={bankConfirmationRef}
          onChange={(e) => setBankConfirmationRef(e.target.value)}
          placeholder="e.g. Swedbank transaction ID"
          disabled={loading !== null}
        />
      )}
      <div className="flex gap-2">
        {currentStatus === 'pending' && (
          <>
            <Button
              variant="primary"
              size="sm"
              loading={loading === 'approve'}
              disabled={loading !== null}
              onClick={() => handleAction('approve')}
            >
              Approve
            </Button>
            <Button
              variant="danger"
              size="sm"
              loading={loading === 'reject'}
              disabled={loading !== null}
              onClick={() => handleAction('reject')}
            >
              Reject
            </Button>
          </>
        )}
        {currentStatus === 'approved' && (
          <Button
            variant="primary"
            size="sm"
            loading={loading === 'complete'}
            disabled={loading !== null}
            onClick={() => handleAction('complete')}
          >
            Mark completed
          </Button>
        )}
      </div>
      {error && <Alert variant="error">{error}</Alert>}
    </div>
  );
}

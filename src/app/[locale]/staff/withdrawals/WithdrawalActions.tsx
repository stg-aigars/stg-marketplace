'use client';

import { useState } from 'react';
import { Button } from '@/components/ui';
import { sanitizeApiError } from '@/lib/utils/error-messages';

interface WithdrawalActionsProps {
  withdrawalId: string;
  currentStatus: string;
}

export function WithdrawalActions({ withdrawalId, currentStatus }: WithdrawalActionsProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleAction(action: 'approve' | 'reject' | 'complete') {
    setLoading(action);
    setError(null);

    try {
      const res = await fetch(`/api/staff/withdrawals/${withdrawalId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        body: JSON.stringify({ action }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(sanitizeApiError(data.error));
        setLoading(null);
        return;
      }

      window.location.reload();
    } catch {
      setError('Connection error');
      setLoading(null);
    }
  }

  return (
    <div className="space-y-2">
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
      {error && <p className="text-xs text-semantic-error">{error}</p>}
    </div>
  );
}

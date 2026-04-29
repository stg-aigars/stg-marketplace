'use client';

import { useState, useTransition } from 'react';
import { Alert, Button, Input } from '@/components/ui';
import { formatCentsToCurrency } from '@/lib/services/pricing';
import { OSS_MEMBER_STATES, type OssDeclaredAmounts } from '@/lib/oss/types';
import { recordOssSubmission } from './actions';

interface Props {
  /** ISO date — the quarter being filed. The server recomputes per-MS amounts
   *  from orders rather than trusting whatever the client sends; the
   *  `declaredAmounts` prop is for UI preview only. */
  quarterStart: string;
  declaredAmounts: OssDeclaredAmounts;
}

export function OssSubmissionForm({ quarterStart, declaredAmounts }: Props) {
  const [isPending, startTransition] = useTransition();
  const [paymentReference, setPaymentReference] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const submit = () => {
    setError(null);
    setSuccess(false);
    startTransition(async () => {
      const result = await recordOssSubmission({
        quarterStart,
        paymentReference: paymentReference.trim() || undefined,
      });
      if ('error' in result) {
        setError(result.error);
      } else {
        setSuccess(true);
        setPaymentReference('');
      }
    });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1 text-sm">
        <p className="font-medium text-semantic-text-heading">Recording these declared amounts:</p>
        <ul className="space-y-0.5 text-semantic-text-secondary">
          {OSS_MEMBER_STATES.map((ms) => {
            const row = declaredAmounts[ms];
            if (!row || row.vat_cents === 0) return null;
            return (
              <li key={ms}>
                {ms}: {formatCentsToCurrency(row.vat_cents)} VAT on {formatCentsToCurrency(row.net_cents)} net ({row.order_count} order{row.order_count === 1 ? '' : 's'})
              </li>
            );
          })}
        </ul>
      </div>

      <Input
        label="Payment reference (optional — can be added later)"
        value={paymentReference}
        onChange={(e) => setPaymentReference(e.target.value)}
        placeholder="e.g. OSS-2026-Q1-12345"
      />

      {error && <Alert variant="error">{error}</Alert>}
      {success && <Alert variant="success">Submission recorded. Audit event logged.</Alert>}

      <div className="flex justify-end">
        <Button variant="primary" onClick={submit} disabled={isPending} loading={isPending}>
          Mark filed
        </Button>
      </div>
    </div>
  );
}

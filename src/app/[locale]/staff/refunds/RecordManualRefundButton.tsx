'use client';

import { useState, useTransition } from 'react';
import { Alert, Button, Input, Modal } from '@/components/ui';
import { recordManualRefund } from './actions';

interface Props {
  orderId: string;
  orderNumber: string;
  amountLabel: string;
}

/**
 * Confirms the SEPA transfer was sent, then writes status + timestamp + audit
 * event in one action. The date field exists because the transfer often goes
 * out before anyone gets back to the queue, and a `refunded_at` that quietly
 * means "when staff remembered" is worse than one that can be corrected here.
 */
export function RecordManualRefundButton({ orderId, orderNumber, amountLabel }: Props) {
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transferredAt, setTransferredAt] = useState('');

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const result = await recordManualRefund(orderId, {
        transferredAt: transferredAt || null,
      });
      if ('error' in result) {
        setError(result.error);
        return;
      }
      setOpen(false);
    });
  };

  return (
    <>
      <Button size="sm" variant="primary" onClick={() => setOpen(true)}>
        Mark refund sent
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`Record refund for ${orderNumber}`}
      >
        <div className="space-y-4">
          <p className="text-sm text-semantic-text-secondary">
            Confirm you have sent {amountLabel} by bank transfer to the account
            the buyer paid from. The IBAN is on the Swedbank statement and on
            the EveryPay dashboard entry for this payment.
          </p>

          <div>
            <Input
              type="date"
              label="Transfer date"
              value={transferredAt}
              onChange={(e) => setTransferredAt(e.target.value)}
            />
            <p className="text-xs text-semantic-text-muted mt-1">
              Leave empty to record today.
            </p>
          </div>

          {error && <Alert variant="error">{error}</Alert>}

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button variant="primary" onClick={submit} disabled={isPending}>
              {isPending ? 'Recording…' : 'Record refund'}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

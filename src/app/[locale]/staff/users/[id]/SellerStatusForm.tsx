'use client';

import { useState, useTransition } from 'react';
import { Alert, Button, Select, Textarea } from '@/components/ui';
import type { SelectOption } from '@/components/ui';
import { updateSellerStatus, type SellerStatus } from './actions';

interface Props {
  userId: string;
  currentStatus: SellerStatus;
  reservedCount: number;
  auctionEndedCount: number;
  activeCount: number;
}

const STATUS_OPTIONS: SelectOption[] = [
  { value: 'active', label: 'Active (default)' },
  { value: 'warned', label: 'Warned (advisory only — no functional gate)' },
  { value: 'suspended', label: 'Suspended (blocks new listings, pauses active ones)' },
];

export function SellerStatusForm({
  userId,
  currentStatus,
  reservedCount,
  auctionEndedCount,
  activeCount,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [toStatus, setToStatus] = useState<SellerStatus>(currentStatus);
  const [reason, setReason] = useState('');

  const inFlightTotal = reservedCount + auctionEndedCount;
  const willSuspend = toStatus === 'suspended' && currentStatus !== 'suspended';

  const submit = () => {
    setError(null);
    setSuccess(false);
    startTransition(async () => {
      const result = await updateSellerStatus(userId, toStatus, reason);
      if ('error' in result) {
        setError(result.error);
      } else {
        setSuccess(true);
        setReason('');
      }
    });
  };

  return (
    <div className="space-y-4">
      {willSuspend && inFlightTotal > 0 && (
        <Alert variant="warning" title="In-flight transactions">
          This seller has {inFlightTotal} in-flight transaction(s) (
          {reservedCount > 0 && <>{reservedCount} reserved</>}
          {reservedCount > 0 && auctionEndedCount > 0 && <>, </>}
          {auctionEndedCount > 0 && <>{auctionEndedCount} auction-ended</>}
          ). Suspension will <strong>not</strong> pause those listings — buyers will still
          complete those orders. Active listings ({activeCount}) will be paused immediately.
        </Alert>
      )}

      <Select
        label="New status"
        value={toStatus}
        onChange={(e) => setToStatus(e.target.value as SellerStatus)}
        options={STATUS_OPTIONS}
      />

      <Textarea
        label="Reason (≥20 chars — recorded in audit log)"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={4}
        placeholder="e.g. Repeated complaints about misrepresented condition; verification request unanswered for 14 days."
      />

      {error && <Alert variant="error">{error}</Alert>}
      {success && <Alert variant="success">Status updated. Audit event logged.</Alert>}

      <div className="flex justify-end">
        <Button
          variant={willSuspend ? 'danger' : 'primary'}
          onClick={submit}
          disabled={isPending || toStatus === currentStatus}
          loading={isPending}
        >
          {willSuspend ? 'Suspend seller' : 'Update status'}
        </Button>
      </div>
    </div>
  );
}

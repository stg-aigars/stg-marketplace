'use client';

import { useState, useTransition } from 'react';
import { Alert, Button, Modal, Select, Textarea, Input } from '@/components/ui';
import type { SelectOption } from '@/components/ui';
import {
  sendVerificationRequest,
  dismissTraderSignal,
  type DismissRationaleCategory,
} from './trader-signal-actions';

interface Props {
  userId: string;
  signalCrossedAt: string | null;
  verificationRequestedAt: string | null;
  verificationResponse: 'collector' | 'trader' | 'unresponsive' | null;
}

const RATIONALE_OPTIONS: SelectOption[] = [
  { value: '', label: 'Select a category' },
  { value: 'verified_collector', label: 'Verified collector (response or evidence supports private use)' },
  { value: 'low_engagement_pattern', label: 'Low-engagement pattern (sales spike was one-off, not commercial)' },
  { value: 'marketplace_norm', label: 'Marketplace norm (volume is consistent with active collectors)' },
  { value: 'other', label: 'Other (explain in justification)' },
];

export function TraderSignalActions({
  userId,
  signalCrossedAt,
  verificationRequestedAt,
  verificationResponse,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showDismiss, setShowDismiss] = useState(false);

  const [rationaleCategory, setRationaleCategory] = useState<DismissRationaleCategory | ''>('');
  const [justification, setJustification] = useState('');
  const [evidenceUrl, setEvidenceUrl] = useState('');

  const canSendVerification =
    !!signalCrossedAt && !verificationRequestedAt;
  const canDismissOrSuspend =
    !!signalCrossedAt && (verificationResponse !== null);

  const runSendVerification = () => {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const result = await sendVerificationRequest(userId);
      if ('error' in result) setError(result.error);
      else setSuccess('Verification request sent. The seller has 14 days to respond.');
    });
  };

  const runDismiss = () => {
    setError(null);
    setSuccess(null);
    if (!rationaleCategory) {
      setError('Pick a rationale category.');
      return;
    }
    startTransition(async () => {
      const result = await dismissTraderSignal(
        userId,
        rationaleCategory as DismissRationaleCategory,
        justification,
        evidenceUrl || undefined,
      );
      if ('error' in result) {
        setError(result.error);
      } else {
        setShowDismiss(false);
        setRationaleCategory('');
        setJustification('');
        setEvidenceUrl('');
        setSuccess('Signal dismissed and audit-logged.');
      }
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {canSendVerification && (
          <Button variant="primary" size="sm" onClick={runSendVerification} disabled={isPending} loading={isPending}>
            Send verification request
          </Button>
        )}
        {canDismissOrSuspend && (
          <Button variant="secondary" size="sm" onClick={() => setShowDismiss(true)} disabled={isPending}>
            Dismiss signal
          </Button>
        )}
      </div>

      {error && <Alert variant="error">{error}</Alert>}
      {success && <Alert variant="success">{success}</Alert>}

      <Modal open={showDismiss} onClose={() => setShowDismiss(false)} title="Dismiss trader signal">
        <div className="space-y-3">
          <p className="text-sm text-semantic-text-secondary">
            Mandatory per the lawyer&apos;s 2026-04-28 framework. The structured metadata makes
            this dismissal queryable if the question &quot;why didn&apos;t you act on this
            seller?&quot; is ever asked.
          </p>
          <Select
            label="Rationale category"
            value={rationaleCategory}
            onChange={(e) => setRationaleCategory(e.target.value as DismissRationaleCategory | '')}
            options={RATIONALE_OPTIONS}
          />
          <Textarea
            label="Justification (≥50 chars)"
            value={justification}
            onChange={(e) => setJustification(e.target.value)}
            rows={4}
            placeholder="e.g. Seller's verification response was 'collector', plus their listing pattern shows mostly board games from 2010-2018 — consistent with a long-time collector culling shelves rather than commercial reseller."
          />
          <Input
            label="Evidence URL (optional)"
            value={evidenceUrl}
            onChange={(e) => setEvidenceUrl(e.target.value)}
            placeholder="https://..."
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setShowDismiss(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button variant="primary" onClick={runDismiss} disabled={isPending} loading={isPending}>
              Dismiss + log
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

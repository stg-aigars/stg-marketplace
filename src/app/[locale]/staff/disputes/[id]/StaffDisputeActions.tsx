'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Button, Modal, Select, Textarea } from '@/components/ui';
import { apiFetch } from '@/lib/api-fetch';
import { sanitizeErrorMessage } from '@/lib/utils/error-messages';

interface StaffDisputeActionsProps {
  orderId: string;
}

type ConfirmAction = 'refund' | 'no_refund' | null;

// Canned staff-notes templates. Surfaced as a Select that prefills the
// textarea — staff can edit before submitting. The discipline of using
// canned-then-edited reasoning keeps the audit trail consistent across
// resolutions, which improves legal defensibility (similar to the
// notice-and-action templates in /staff/notices).
const NOTE_TEMPLATES: Array<{ key: string; label: string; body: string }> = [
  { key: 'custom', label: 'Custom (start blank)', body: '' },
  {
    key: 'favor_buyer_damage',
    label: 'Favor buyer — proof of damage',
    body: 'Buyer provided photo evidence of damage consistent with the dispute reason. Refunding to buyer wallet.',
  },
  {
    key: 'favor_buyer_not_received',
    label: 'Favor buyer — item not received',
    body: 'Tracking confirms shipment was not delivered (or seller never shipped within deadline). Refunding to buyer wallet.',
  },
  {
    key: 'favor_seller_unresponsive',
    label: 'Favor seller — buyer unresponsive',
    body: 'Buyer did not provide requested evidence within the dispute window. Resolving in seller\'s favor.',
  },
  {
    key: 'favor_seller_insufficient',
    label: 'Favor seller — claim unsubstantiated',
    body: 'Buyer\'s claim is not supported by the evidence provided. Resolving in seller\'s favor.',
  },
  {
    key: 'favor_seller_buyer_misuse',
    label: 'Favor seller — buyer caused damage',
    body: 'Damage appears consistent with buyer mishandling rather than condition at sale. Resolving in seller\'s favor.',
  },
];

export function StaffDisputeActions({ orderId }: StaffDisputeActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [templateKey, setTemplateKey] = useState('custom');
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);

  function handleTemplateChange(key: string) {
    setTemplateKey(key);
    const template = NOTE_TEMPLATES.find((t) => t.key === key);
    if (template) setNotes(template.body);
  }

  async function handleResolve(decision: 'refund' | 'no_refund') {
    setLoading(true);
    setError(null);

    try {
      const res = await apiFetch(`/api/staff/orders/${orderId}/dispute/resolve`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, notes: notes.trim() || undefined }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(sanitizeErrorMessage(data.error));
        setConfirmAction(null);
        return;
      }

      router.refresh();
    } catch {
      setError('Connection error');
      setConfirmAction(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <Select
        label="Reasoning template (optional)"
        value={templateKey}
        onChange={(e) => handleTemplateChange(e.target.value)}
        options={NOTE_TEMPLATES.map((t) => ({ value: t.key, label: t.label }))}
      />

      <Textarea
        id="staff-notes"
        label="Staff notes"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={4}
        placeholder="Internal notes about the resolution decision — pick a template above to prefill, or write from scratch."
      />

      <div className="flex gap-3">
        <Button
          variant="danger"
          onClick={() => setConfirmAction('refund')}
          disabled={loading}
        >
          Refund buyer
        </Button>
        <Button
          variant="primary"
          onClick={() => setConfirmAction('no_refund')}
          disabled={loading}
        >
          Resolve for seller
        </Button>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {/* Confirmation modal */}
      <Modal
        open={confirmAction !== null}
        onClose={() => setConfirmAction(null)}
        title={confirmAction === 'refund' ? 'Confirm refund' : 'Confirm resolution'}
      >
        <div className="space-y-4">
          <p className="text-sm text-semantic-text-secondary">
            {confirmAction === 'refund'
              ? 'This will refund the full order amount to the buyer\'s wallet and close the dispute. This action cannot be undone.'
              : 'This will resolve the dispute in the seller\'s favor. The seller will receive their earnings and the dispute will be closed. This action cannot be undone.'}
          </p>
          {notes.trim() && (
            <div className="p-3 rounded-lg bg-semantic-bg-subtle">
              <p className="text-xs text-semantic-text-muted mb-1">Staff notes</p>
              <p className="text-sm text-semantic-text-secondary">{notes.trim()}</p>
            </div>
          )}
          <div className="flex gap-3 justify-end">
            <Button
              variant="ghost"
              onClick={() => setConfirmAction(null)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              variant={confirmAction === 'refund' ? 'danger' : 'primary'}
              loading={loading}
              onClick={() => confirmAction && handleResolve(confirmAction)}
            >
              {confirmAction === 'refund' ? 'Confirm refund' : 'Confirm resolution'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

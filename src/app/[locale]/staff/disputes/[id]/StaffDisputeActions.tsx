'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Button, Modal, Select, Textarea } from '@/components/ui';
import { apiFetch } from '@/lib/api-fetch';
import { sanitizeErrorMessage } from '@/lib/utils/error-messages';
import { DISPUTE_RESOLUTION_TEMPLATES } from '@/lib/staff-templates';

interface StaffDisputeActionsProps {
  orderId: string;
}

type ConfirmAction = 'refund' | 'no_refund' | null;

export function StaffDisputeActions({ orderId }: StaffDisputeActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [templateKey, setTemplateKey] = useState('custom');
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);

  function handleTemplateChange(key: string) {
    setTemplateKey(key);
    const template = DISPUTE_RESOLUTION_TEMPLATES.find((t) => t.key === key);
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
        options={DISPUTE_RESOLUTION_TEMPLATES.map((t) => ({ value: t.key, label: t.label }))}
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

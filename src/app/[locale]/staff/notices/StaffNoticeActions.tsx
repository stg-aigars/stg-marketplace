'use client';

import { useState, useTransition } from 'react';
import { Button, Modal, Textarea, Select } from '@/components/ui';
import type { SelectOption } from '@/components/ui';
import {
  markNoticeReviewing,
  dismissNotice,
  actionListingFromNotice,
} from './actions';

interface Props {
  noticeId: string;
  hasListing: boolean;
  status: string;
}

const REASON_CATEGORIES: SelectOption[] = [
  { value: '', label: 'Select a reason category' },
  { value: 'tos_violation', label: 'Terms of Service violation' },
  { value: 'illegal', label: 'Illegal goods' },
  { value: 'misleading', label: 'Misleading listing' },
  { value: 'ip_infringement', label: 'Intellectual property infringement' },
  { value: 'other', label: 'Other' },
];

export function StaffNoticeActions({ noticeId, hasListing, status }: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [openModal, setOpenModal] = useState<null | 'dismiss' | 'action'>(null);

  // Dismiss-modal state
  const [dismissNote, setDismissNote] = useState('');

  // Action-modal state
  const [reasonCategory, setReasonCategory] = useState('');
  const [reasonText, setReasonText] = useState('');

  const isResolved = status === 'actioned' || status === 'dismissed';

  const runReviewing = () => {
    setError(null);
    startTransition(async () => {
      const result = await markNoticeReviewing(noticeId);
      if ('error' in result) setError(result.error);
    });
  };

  const runDismiss = () => {
    setError(null);
    startTransition(async () => {
      const result = await dismissNotice(noticeId, dismissNote);
      if ('error' in result) {
        setError(result.error);
      } else {
        setOpenModal(null);
        setDismissNote('');
      }
    });
  };

  const runAction = () => {
    setError(null);
    if (!reasonCategory) {
      setError('Pick a reason category.');
      return;
    }
    startTransition(async () => {
      const result = await actionListingFromNotice(
        noticeId,
        reasonCategory as 'tos_violation' | 'illegal' | 'misleading' | 'ip_infringement' | 'other',
        reasonText,
      );
      if ('error' in result) {
        setError(result.error);
      } else {
        setOpenModal(null);
        setReasonCategory('');
        setReasonText('');
      }
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {!isResolved && status === 'open' && (
        <Button size="sm" variant="secondary" onClick={runReviewing} disabled={isPending}>
          Mark reviewing
        </Button>
      )}
      {!isResolved && hasListing && (
        <Button size="sm" variant="primary" onClick={() => setOpenModal('action')} disabled={isPending}>
          Action listing
        </Button>
      )}
      {!isResolved && (
        <Button size="sm" variant="ghost" onClick={() => setOpenModal('dismiss')} disabled={isPending}>
          Dismiss
        </Button>
      )}
      {error && <span className="text-xs text-semantic-error">{error}</span>}

      {/* Dismiss modal */}
      <Modal open={openModal === 'dismiss'} onClose={() => setOpenModal(null)} title="Dismiss notice">
        <div className="space-y-3">
          <p className="text-sm text-semantic-text-secondary">
            Add a short staff note (≥20 chars) explaining why this notice was dismissed.
            This is internal-only and does not get sent to the notifier.
          </p>
          <Textarea
            value={dismissNote}
            onChange={(e) => setDismissNote(e.target.value)}
            rows={4}
            placeholder="e.g. Notifier's claim could not be substantiated; listing description matches BGG metadata."
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpenModal(null)} disabled={isPending}>
              Cancel
            </Button>
            <Button variant="primary" onClick={runDismiss} disabled={isPending} loading={isPending}>
              Dismiss notice
            </Button>
          </div>
        </div>
      </Modal>

      {/* Action modal */}
      <Modal open={openModal === 'action'} onClose={() => setOpenModal(null)} title="Action listing">
        <div className="space-y-3">
          <p className="text-sm text-semantic-text-secondary">
            This will (a) cancel the bound listing, (b) send a DSA Art. 17 statement-of-reasons
            email + in-app notification to the seller, and (c) record the staff decision in the
            audit log. The seller will see the reason text below.
          </p>
          <Select
            label="Reason category"
            value={reasonCategory}
            onChange={(e) => setReasonCategory(e.target.value)}
            options={REASON_CATEGORIES}
          />
          <Textarea
            label="Reason for the seller (≥20 chars)"
            value={reasonText}
            onChange={(e) => setReasonText(e.target.value)}
            rows={4}
            placeholder="e.g. Listing description claims a 1st edition; photos show 2nd edition. We cancelled the listing — please re-list with accurate edition info."
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpenModal(null)} disabled={isPending}>
              Cancel
            </Button>
            <Button variant="danger" onClick={runAction} disabled={isPending} loading={isPending}>
              Action listing
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

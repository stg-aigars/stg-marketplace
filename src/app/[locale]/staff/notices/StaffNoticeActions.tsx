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

// DSA Article 17 statement-of-reasons templates. Selecting a template
// prefills the reason textarea — staff edits before submitting. Surfacing
// canned reasoning improves the legal-defensibility of takedowns: every
// statement of reasons follows a consistent shape that maps to a known
// category, and a regulator looking at a sample can verify the platform
// applied the rule the notice cited.
const REASON_TEMPLATES: SelectOption[] = [
  { value: 'custom', label: 'Custom (start blank)' },
  { value: 'misleading_condition', label: 'Misleading — condition mismatch' },
  { value: 'misleading_edition', label: 'Misleading — edition / version mismatch' },
  { value: 'misleading_photos', label: 'Misleading — photos do not match item' },
  { value: 'prohibited_item', label: 'Prohibited item' },
  { value: 'ip_counterfeit', label: 'IP — counterfeit or unauthorized reproduction' },
  { value: 'tos_violation_generic', label: 'ToS violation (generic)' },
];

const TEMPLATE_BODIES: Record<string, string> = {
  custom: '',
  misleading_condition:
    'Listing condition does not match the item shown in the photos. The cancellation is required because misleading condition descriptions undermine buyer trust on the platform. You can re-list with the correct condition selected.',
  misleading_edition:
    'Listing description claims an edition or version that the photos / BGG metadata do not support. The cancellation is required because edition matters for buyer expectations (especially across language editions in the Baltic region). Re-list with accurate edition + language fields.',
  misleading_photos:
    'Listing photos do not show the actual item being sold (stock images or photos of a different copy). Buyers need to see the specific copy they are buying. Re-list with photos of your actual copy, including any wear, missing components, or sleeves.',
  prohibited_item:
    'This item falls into a prohibited category under our Terms of Service (Section on Prohibited Items). The listing has been cancelled and the item cannot be re-listed on the platform.',
  ip_counterfeit:
    'Listing was identified as a counterfeit or unauthorized reproduction following a notice from the rights holder. Listings of counterfeit goods are prohibited under our Terms of Service and EU intellectual-property rules.',
  tos_violation_generic:
    'This listing violates our Terms of Service. [Add specific clause + factual basis]. The listing has been cancelled. Please review the Terms before re-listing.',
};

export function StaffNoticeActions({ noticeId, hasListing, status }: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [openModal, setOpenModal] = useState<null | 'dismiss' | 'action'>(null);

  // Dismiss-modal state
  const [dismissNote, setDismissNote] = useState('');

  // Action-modal state
  const [reasonCategory, setReasonCategory] = useState('');
  const [reasonText, setReasonText] = useState('');
  const [templateKey, setTemplateKey] = useState('custom');

  function handleTemplateChange(key: string) {
    setTemplateKey(key);
    setReasonText(TEMPLATE_BODIES[key] ?? '');
  }

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
        setTemplateKey('custom');
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
          <Select
            label="Statement-of-reasons template (optional)"
            value={templateKey}
            onChange={(e) => handleTemplateChange(e.target.value)}
            options={REASON_TEMPLATES}
          />
          <Textarea
            label="Reason for the seller (≥20 chars)"
            value={reasonText}
            onChange={(e) => setReasonText(e.target.value)}
            rows={5}
            placeholder="Pick a template above to prefill, or write from scratch. The seller will see this exact text."
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

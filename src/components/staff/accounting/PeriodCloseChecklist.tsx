'use client';

/**
 * Period-close checklist UI (PR #4, Task 11).
 *
 * Renders the 9-item read-side gate composed by `getPeriodCloseChecklist`
 * (`src/lib/accounting/checklist.ts`) and exposes the three state-machine
 * transitions wired to the server actions in `period-actions.ts`:
 *
 *   open         → soft_locked   (softLockPeriod)
 *   soft_locked  → hard_locked   (hardLockPeriod)
 *   soft_locked  → open          (unsoftLockPeriod, requires reason)
 *
 * Discipline: there is no manual-attestation checkbox (item 10 deferred to
 * PR #4b alongside bank-statement ingestion). Gate flags (`can_soft_lock`,
 * `can_hard_lock`, `can_unsoft_lock`) are sourced exclusively from the
 * server checklist — no client state mirrors gating logic. The server-side
 * actions re-validate every invariant before mutating periods.status.
 */

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowsClockwise,
  CheckCircle,
  Clock,
  LockKey,
  LockOpen,
  MinusCircle,
  XCircle,
} from '@phosphor-icons/react/ssr';

import { Alert, Button, Card, CardBody, Modal, Textarea } from '@/components/ui';
import {
  hardLockPeriod,
  softLockPeriod,
  unsoftLockPeriod,
} from '@/lib/accounting/period-actions';
import type {
  ChecklistItem,
  ChecklistStatus,
  PeriodCloseChecklist as PeriodCloseChecklistData,
} from '@/lib/accounting/checklist';

import { PeriodStatusBadge } from './PeriodStatusBadge';

type Pending = 'soft' | 'hard' | 'unsoft' | null;

interface Props {
  checklist: PeriodCloseChecklistData;
}

// Status-icon rendering. Phosphor `/ssr` runtime values are imported above
// per CLAUDE.md (the base path defeats tree-shaking).
function StatusIcon({ status }: { status: ChecklistStatus }) {
  if (status === 'pass') {
    return (
      <CheckCircle
        size={20}
        weight="fill"
        className="text-semantic-success"
        aria-label="Pass"
      />
    );
  }
  if (status === 'fail') {
    return (
      <XCircle
        size={20}
        weight="fill"
        className="text-semantic-error"
        aria-label="Fail"
      />
    );
  }
  if (status === 'manual_pending') {
    return (
      <Clock
        size={20}
        weight="fill"
        className="text-semantic-warning"
        aria-label="Manual pending"
      />
    );
  }
  return (
    <MinusCircle
      size={20}
      weight="fill"
      className="text-semantic-text-muted"
      aria-label="Not applicable"
    />
  );
}

function ChecklistRow({ item }: { item: ChecklistItem }) {
  return (
    <li className="flex items-start gap-3 py-3 border-b border-semantic-border-subtle last:border-b-0">
      <div className="shrink-0 pt-0.5">
        <StatusIcon status={item.status} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-semantic-text-primary">
          <span className="text-semantic-text-muted mr-2">{item.id}.</span>
          {item.label}
        </p>
        <p className="mt-0.5 text-xs text-semantic-text-secondary">{item.detail}</p>
      </div>
      {item.drillDownHref && (
        <div className="shrink-0">
          <Link
            href={item.drillDownHref}
            className="text-xs font-medium text-semantic-brand sm:hover:underline transition-colors duration-250 ease-out-custom"
          >
            Drill down
          </Link>
        </div>
      )}
    </li>
  );
}

export function PeriodCloseChecklist({ checklist }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pending, setPending] = useState<Pending>(null);
  const [unsoftReason, setUnsoftReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const closeModal = () => {
    if (isPending) return; // don't close mid-flight
    setPending(null);
    setUnsoftReason('');
    setError(null);
  };

  const handleRefresh = () => {
    setError(null);
    router.refresh();
  };

  const runSoftLock = () => {
    setError(null);
    startTransition(async () => {
      const result = await softLockPeriod(checklist.period_key);
      if ('error' in result) {
        setError(result.error);
      } else {
        setPending(null);
        router.refresh();
      }
    });
  };

  const runHardLock = () => {
    setError(null);
    startTransition(async () => {
      const result = await hardLockPeriod(checklist.period_key);
      if ('error' in result) {
        setError(result.error);
      } else {
        setPending(null);
        router.refresh();
      }
    });
  };

  const runUnsoftLock = () => {
    setError(null);
    const trimmed = unsoftReason.trim();
    if (trimmed.length === 0) {
      setError('Reason is required to unsoft-lock a period.');
      return;
    }
    startTransition(async () => {
      const result = await unsoftLockPeriod(checklist.period_key, trimmed);
      if ('error' in result) {
        setError(result.error);
      } else {
        setPending(null);
        setUnsoftReason('');
        router.refresh();
      }
    });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardBody>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-semantic-text-heading">
              {checklist.period_key}
            </h2>
            <PeriodStatusBadge status={checklist.period_status} />
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRefresh}
                disabled={isPending}
                aria-label="Refresh checklist"
              >
                <ArrowsClockwise size={16} className="mr-1.5" />
                Refresh
              </Button>
              <Button
                variant="brand"
                size="sm"
                onClick={() => setPending('soft')}
                disabled={!checklist.can_soft_lock || isPending}
              >
                <LockKey size={16} className="mr-1.5" />
                Soft-lock period
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => setPending('hard')}
                disabled={!checklist.can_hard_lock || isPending}
              >
                <LockKey size={16} weight="fill" className="mr-1.5" />
                Hard-lock period
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPending('unsoft')}
                disabled={!checklist.can_unsoft_lock || isPending}
              >
                <LockOpen size={16} className="mr-1.5" />
                Unsoft-lock (admin)
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <h3 className="text-base font-semibold text-semantic-text-heading mb-2">
            Close checklist (9 items)
          </h3>
          <p className="text-xs text-semantic-text-secondary mb-3">
            All items must be <span className="font-medium">pass</span> or{' '}
            <span className="font-medium">not applicable</span> for soft-lock to
            unlock. Items 8–9 may be not-applicable depending on period
            activity.
          </p>
          <ul className="border-t border-semantic-border-subtle">
            {checklist.items.map((item) => (
              <ChecklistRow key={item.id} item={item} />
            ))}
          </ul>
        </CardBody>
      </Card>

      {/* Soft-lock confirmation */}
      <Modal
        open={pending === 'soft'}
        onClose={closeModal}
        title={`Soft-lock period ${checklist.period_key}?`}
      >
        <div className="space-y-4 pb-4">
          <p className="text-sm text-semantic-text-secondary">
            Soft-locking blocks new entries to this period unless they are
            tagged <span className="font-mono">period_close_adjustment=true</span>{' '}
            (used by the posting engine for VAT consolidation and similar
            close-time adjustments). Soft-lock is reversible via the admin
            unsoft-lock action.
          </p>
          {error && (
            <Alert variant="error">
              <span className="text-semantic-text-primary">{error}</span>
            </Alert>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" onClick={closeModal} disabled={isPending}>
              Cancel
            </Button>
            <Button
              variant="brand"
              onClick={runSoftLock}
              disabled={isPending}
              loading={isPending}
            >
              Confirm soft-lock
            </Button>
          </div>
        </div>
      </Modal>

      {/* Hard-lock confirmation */}
      <Modal
        open={pending === 'hard'}
        onClose={closeModal}
        title={`Hard-lock period ${checklist.period_key}?`}
      >
        <div className="space-y-4 pb-4">
          <Alert variant="warning" title="This action is permanent.">
            <span className="text-semantic-text-primary">
              Hard-lock cannot be reversed. There is no symmetric un-hard-lock
              action — corrections must post as reversal entries to a different
              open period. Confirm only when the period is fully reconciled and
              you intend to freeze it for compliance and accountant retention.
            </span>
          </Alert>
          {error && (
            <Alert variant="error">
              <span className="text-semantic-text-primary">{error}</span>
            </Alert>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" onClick={closeModal} disabled={isPending}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={runHardLock}
              disabled={isPending}
              loading={isPending}
            >
              Confirm hard-lock
            </Button>
          </div>
        </div>
      </Modal>

      {/* Unsoft-lock reason modal */}
      <Modal
        open={pending === 'unsoft'}
        onClose={closeModal}
        title={`Unsoft-lock period ${checklist.period_key} — admin escape hatch`}
      >
        <div className="space-y-4 pb-4">
          <Alert variant="warning" title="Admin escape hatch.">
            <span className="text-semantic-text-primary">
              Unsoft-locking returns the period to <span className="font-medium">open</span>
              {' '}status and clears <span className="font-mono">locked_at</span> /{' '}
              <span className="font-mono">locked_by</span>. Use only when an
              after-the-fact correction requires reposting. The reason below is
              recorded in the regulatory audit trail.
            </span>
          </Alert>
          <Textarea
            label="Reason (required)"
            value={unsoftReason}
            onChange={(e) => setUnsoftReason(e.target.value)}
            rows={4}
            placeholder="e.g. Discovered missing P.6 entry for Vercel invoice received late; reopening to post and re-soft-lock."
            disabled={isPending}
          />
          {error && (
            <Alert variant="error">
              <span className="text-semantic-text-primary">{error}</span>
            </Alert>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" onClick={closeModal} disabled={isPending}>
              Cancel
            </Button>
            <Button
              variant="secondary"
              onClick={runUnsoftLock}
              disabled={isPending || unsoftReason.trim().length === 0}
              loading={isPending}
            >
              Confirm unsoft-lock
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

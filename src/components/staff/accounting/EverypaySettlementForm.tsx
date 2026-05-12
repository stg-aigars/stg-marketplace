'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { Alert, Button, Card, CardBody, Input } from '@/components/ui';
import { recordEverypaySettlement } from '@/lib/accounting/everypay-settlement-actions';
import { parseIncludedTxnRefs } from '@/lib/accounting/everypay-settlement-parse';

/**
 * Form for the EveryPay settlement staff page (PR C commit 11a). Submits via
 * the `recordEverypaySettlement` server action. Optional fields normalized at
 * the form boundary per the commit-10 §6 convention (`posting_context_notes`,
 * messy-paste `included_txn_refs`).
 *
 * On success — redirects to `/staff/accounting/account-ledger/2630` so staff
 * sees the cleared balance immediately. On `idempotent_skip` — same redirect
 * with a success message explaining the duplicate was caught.
 */
export function EverypaySettlementForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [bankRef, setBankRef] = useState('');
  const [amountEuros, setAmountEuros] = useState('');
  const [batchDate, setBatchDate] = useState('');
  const [valueDate, setValueDate] = useState('');
  const [txnRefsRaw, setTxnRefsRaw] = useState('');
  const [notes, setNotes] = useState('');

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    // Parse the EUR amount as cents at the form boundary. Math.round handles
    // typical float artifacts (e.g. 12.5 → 1250 cents). Reject NaN / negative
    // before sending to the server action — server-side validation is the
    // canonical authority but rejecting client-side avoids a roundtrip.
    const parsedAmount = parseFloat(amountEuros);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError('Settlement amount must be a positive number');
      return;
    }
    const settlement_cents = Math.round(parsedAmount * 100);
    if (!Number.isInteger(settlement_cents) || settlement_cents <= 0) {
      setError('Settlement amount must be a positive integer (cents)');
      return;
    }

    // Optional-text-input normalization at the FORM body construction (commit-10 §6).
    // Server action re-normalizes — defense in depth on both layers.
    const posting_context_notes = notes.trim().length > 0 ? notes.trim() : undefined;
    const included_txn_refs = parseIncludedTxnRefs(txnRefsRaw);

    startTransition(async () => {
      const result = await recordEverypaySettlement({
        bank_statement_reference: bankRef,
        settlement_cents,
        batch_date: batchDate,
        settlement_value_date: valueDate,
        included_txn_refs,
        posting_context_notes,
      });

      if ('error' in result) {
        setError(result.error);
        return;
      }

      // Both 'created' and 'idempotent_skip' redirect to the 2630 ledger so
      // staff sees the post-settlement balance. The Account ledger page will
      // show the new C.3 entry (created) or the prior one (idempotent_skip);
      // either way the staff lands on a state-consistent view.
      router.push('/staff/accounting/account-ledger/2630');
    });
  }

  return (
    <Card>
      <CardBody>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Bank statement reference"
            value={bankRef}
            onChange={(e) => setBankRef(e.target.value)}
            placeholder="e.g. SWB-2026-05-15-001"
            required
            disabled={isPending}
          />

          <Input
            label="Settlement amount (EUR)"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0.01"
            value={amountEuros}
            onChange={(e) => setAmountEuros(e.target.value)}
            placeholder="e.g. 125.00"
            required
            disabled={isPending}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Batch date"
              type="date"
              value={batchDate}
              onChange={(e) => setBatchDate(e.target.value)}
              required
              disabled={isPending}
            />

            <Input
              label="Settlement value date"
              type="date"
              value={valueDate}
              onChange={(e) => setValueDate(e.target.value)}
              required
              disabled={isPending}
            />
          </div>

          <div>
            <label
              htmlFor="txn-refs"
              className="block text-sm font-medium text-semantic-text-primary mb-1.5"
            >
              Included transaction references (optional)
            </label>
            <textarea
              id="txn-refs"
              value={txnRefsRaw}
              onChange={(e) => setTxnRefsRaw(e.target.value)}
              placeholder="Paste cart payment references — comma or newline separated"
              rows={4}
              disabled={isPending}
              className="w-full px-3 py-2 rounded-md border border-semantic-border-default bg-semantic-bg-default text-semantic-text-primary placeholder:text-semantic-text-muted focus:outline-none focus:ring-2 focus:ring-semantic-brand/50 focus:border-semantic-brand disabled:opacity-50 disabled:cursor-not-allowed text-sm font-mono"
            />
            <p className="text-xs text-semantic-text-muted mt-1">
              Separator-tolerant — accepts commas, newlines, tabs, or
              whitespace. Empty list is acceptable.
            </p>
          </div>

          <Input
            label="Notes (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Reconciled against Swedbank statement #4521"
            disabled={isPending}
          />

          {error && <Alert variant="error">{error}</Alert>}

          <div className="flex justify-end">
            <Button type="submit" variant="brand" loading={isPending} disabled={isPending}>
              Record settlement
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}

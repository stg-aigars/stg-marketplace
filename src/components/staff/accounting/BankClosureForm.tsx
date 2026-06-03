'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { Alert, Button, Card, CardBody, Input } from '@/components/ui';
import { formatCentsToCurrency } from '@/lib/services/pricing';
import { recordBankStatementClosing } from '@/lib/accounting/bank-closure-actions';
import type { BankClosureReconRow } from '@/lib/accounting/queries';

/**
 * Inline staff form for period-close checklist item 2 (PR #4b). Renders the
 * bank accounts that still need a Swedbank statement closing recorded (or whose
 * recorded value disagrees with the GL) so staff can enter the figure straight
 * off the statement. Calls `recordBankStatementClosing`; refreshes the page so
 * item 2 re-evaluates. Only shown for `open` periods.
 */
export function BankClosureForm({
  period,
  rows
}: {
  period: string;
  rows: BankClosureReconRow[];
}) {
  if (rows.length === 0) return null;

  return (
    <Card>
      <CardBody className="space-y-4">
        <div>
          <h2 className="text-base font-semibold text-semantic-text-heading">
            Record bank-statement closing
          </h2>
          <p className="mt-1 text-sm text-semantic-text-secondary">
            Enter the closing balance from the Swedbank statement for each account below. It must
            match the GL closing for item 2 to pass.
          </p>
        </div>
        <div className="space-y-3">
          {rows.map((row) => (
            <BankClosureRow key={row.account_code} period={period} row={row} />
          ))}
        </div>
      </CardBody>
    </Card>
  );
}

function BankClosureRow({ period, row }: { period: string; row: BankClosureReconRow }) {
  const router = useRouter();
  const [amount, setAmount] = useState('');
  const [statementRef, setStatementRef] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setError(null);
    const trimmed = amount.trim();
    if (!/^-?\d+(\.\d{1,2})?$/.test(trimmed)) {
      setError('Enter an amount in euros, e.g. 149.20');
      return;
    }
    const cents = Math.round(parseFloat(trimmed) * 100);
    setSubmitting(true);
    const result = await recordBankStatementClosing({
      account_code: row.account_code,
      period_key: period,
      closing_balance_cents: cents,
      statement_ref: statementRef.trim() || undefined
    });
    setSubmitting(false);
    if ('error' in result) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="rounded-lg border border-semantic-border-default p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-mono text-sm font-semibold text-semantic-text-primary">
          {row.account_code}
        </span>
        <span className="text-sm text-semantic-text-secondary">
          GL closing <span className="font-medium text-semantic-text-primary">{formatCentsToCurrency(row.gl_closing_cents)}</span>
          {row.recorded_closing_cents !== null && row.status === 'fail' ? (
            <> · recorded <span className="text-semantic-error">{formatCentsToCurrency(row.recorded_closing_cents)}</span></>
          ) : (
            <> · not yet recorded</>
          )}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <Input
          label="Statement closing (€)"
          inputMode="decimal"
          placeholder={(row.gl_closing_cents / 100).toFixed(2)}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <Input
          label="Statement reference"
          placeholder="e.g. Swedbank 31.05.2026"
          value={statementRef}
          onChange={(e) => setStatementRef(e.target.value)}
        />
        <Button type="button" variant="primary" onClick={handleSubmit} disabled={submitting}>
          {submitting ? 'Recording…' : 'Record'}
        </Button>
      </div>
      {error ? (
        <Alert variant="error" className="mt-3">
          {error}
        </Alert>
      ) : null}
    </div>
  );
}

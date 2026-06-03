/**
 * Staff server action — record a Swedbank statement closing balance for a bank
 * account in a period (PR #4b). Backs period-close checklist item 2's data-
 * driven, multi-account bank reconciliation (`getBankClosureReconciliation`).
 *
 * Upserts on (account_code, period_key): re-recording a corrected figure
 * overwrites while the period is `open`. Writes are blocked once the period is
 * soft/hard-locked — corrections then go through the unsoft-lock admin path,
 * same discipline as the rest of the close. Fires a regulatory
 * `bank_closure.recorded` audit event.
 *
 * Plain TS validation (no Zod), consistent with period-actions.ts /
 * everypay-settlement-actions.ts. Writes via the service-role client; the
 * is_staff check is enforced here (bank_statement_closures RLS is staff-SELECT
 * only — service role bypasses for the write).
 */

'use server';

import { revalidatePath } from 'next/cache';

import { requireServerAuth } from '@/lib/auth/helpers';
import { logAuditEvent } from '@/lib/services/audit';

import { getPeriodRow } from './queries';

const PERIOD_KEY_RE = /^\d{4}-\d{2}$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export interface RecordBankStatementClosingInput {
  account_code: string;
  /** YYYY-MM. */
  period_key: string;
  /** Signed net-debit cents (matches getAccountClosingBalance / the GL closing). */
  closing_balance_cents: number;
  statement_ref?: string;
  /** YYYY-MM-DD statement period-end (optional). */
  statement_date?: string;
  notes?: string;
}

export type RecordBankStatementClosingResult = { success: true } | { error: string };

export async function recordBankStatementClosing(
  input: RecordBankStatementClosingInput
): Promise<RecordBankStatementClosingResult> {
  const { isStaff, user, serviceClient } = await requireServerAuth();
  if (!isStaff || !user) return { error: 'Not authorized' };

  if (typeof input.period_key !== 'string' || !PERIOD_KEY_RE.test(input.period_key)) {
    return { error: 'Period must be in YYYY-MM format' };
  }
  if (typeof input.account_code !== 'string' || !input.account_code.trim()) {
    return { error: 'Account code is required' };
  }
  if (!Number.isInteger(input.closing_balance_cents)) {
    return { error: 'Closing balance must be an integer number of cents' };
  }
  if (
    input.statement_date !== undefined &&
    input.statement_date !== '' &&
    !ISO_DATE_RE.test(input.statement_date)
  ) {
    return { error: 'Statement date must be in YYYY-MM-DD format' };
  }

  // Account must exist and be flagged bank-reconcilable.
  const { data: acct, error: acctErr } = await serviceClient
    .from('accounts')
    .select('code, is_bank_reconcilable')
    .eq('code', input.account_code)
    .maybeSingle();
  if (acctErr) {
    console.error('[accounting] recordBankStatementClosing account read failed:', acctErr.message);
    return { error: 'Could not verify account. Please try again.' };
  }
  if (!acct) return { error: `Account ${input.account_code} not found.` };
  if (!(acct as { is_bank_reconcilable: boolean }).is_bank_reconcilable) {
    return { error: `Account ${input.account_code} is not a bank-reconcilable account.` };
  }

  // Period must be open (closings freeze at soft/hard-lock).
  let period;
  try {
    period = await getPeriodRow(serviceClient, input.period_key, 'month');
  } catch (err) {
    console.error('[accounting] recordBankStatementClosing period read failed:', err);
    return { error: 'Could not load period. Please try again.' };
  }
  if (!period) return { error: `Period ${input.period_key} not found.` };
  if (period.status !== 'open') {
    return {
      error: `Period ${input.period_key} is ${period.status}; statement closings can only be recorded while the period is open.`
    };
  }

  const statement_ref = input.statement_ref?.trim() || null;
  const statement_date = input.statement_date?.trim() || null;
  const notes = input.notes?.trim() || null;

  const { error: upsertErr } = await serviceClient.from('bank_statement_closures').upsert(
    {
      account_code: input.account_code,
      period_key: input.period_key,
      closing_balance_cents: input.closing_balance_cents,
      statement_ref,
      statement_date,
      recorded_by: user.id,
      recorded_at: new Date().toISOString(),
      notes
    },
    { onConflict: 'account_code,period_key' }
  );
  if (upsertErr) {
    console.error('[accounting] recordBankStatementClosing upsert failed:', upsertErr.message);
    return { error: 'Could not record statement closing. Please try again.' };
  }

  void logAuditEvent(serviceClient, {
    actorType: 'user',
    actorId: user.id,
    action: 'bank_closure.recorded',
    resourceType: 'bank_statement_closure',
    resourceId: `${input.account_code}:${input.period_key}`,
    metadata: {
      account_code: input.account_code,
      period_key: input.period_key,
      closing_balance_cents: input.closing_balance_cents,
      statement_ref
    },
    retentionClass: 'regulatory'
  });

  revalidatePath('/staff/accounting/period-close');
  revalidatePath('/staff/accounting');
  return { success: true };
}

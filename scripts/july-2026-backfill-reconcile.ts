/**
 * July 2026 backfill — reconciliation harness (PARTIAL — first pass).
 *
 * Only checks what this partial pass actually claims: the two completions'
 * seller_net credits to 5351, and global Σdr=Σcr. Does NOT attempt bank
 * checkpoints or a full trial balance — there's no July statement yet, and
 * most of July hasn't been backfilled. A full reconcile harness (mirroring
 * june-2026-backfill-reconcile.ts) belongs with the full July close.
 *
 * Tolerance: zero.
 */

import './_load-env';

import type { SupabaseClient } from '@supabase/supabase-js';

export const SELLER_NET_CHECKPOINTS: ReadonlyArray<{
  source_doc_id: string;
  expected_cents: number;
  label: string;
}> = [
  { source_doc_id: 'july_2026_entry_1', expected_cents: 1800, label: 'XK5D — Kārlis seller_net €18.00' },
  { source_doc_id: 'july_2026_entry_2', expected_cents: 2700, label: 'E93F — Silvos seller_net €27.00' }
];

export class JulyReconciliationError extends Error {
  readonly checkpoint: string;
  readonly expected_cents: number;
  readonly observed_cents: number;

  constructor(args: { checkpoint: string; expected_cents: number; observed_cents: number }) {
    super(
      `JulyReconciliationError at ${args.checkpoint}: expected ${args.expected_cents}¢, observed ${args.observed_cents}¢`
    );
    this.name = 'JulyReconciliationError';
    this.checkpoint = args.checkpoint;
    this.expected_cents = args.expected_cents;
    this.observed_cents = args.observed_cents;
  }
}

interface GLLine {
  account_code: string;
  debit_cents: number;
  credit_cents: number;
  source_doc_id: string;
}

export async function assertMatchesExpectedClosingState(supabase: SupabaseClient): Promise<void> {
  const { data, error } = await supabase
    .from('journal_lines')
    .select(`
      account_code,
      debit_cents,
      credit_cents,
      journal_entries!inner(source_doc_id, posting_date)
    `)
    .in('journal_entries.source_doc_id', SELLER_NET_CHECKPOINTS.map((c) => c.source_doc_id));

  if (error) {
    throw new Error(`reconcile: failed to load journal_lines: ${error.message}`);
  }

  const lines: GLLine[] = (data ?? []).map((row) => ({
    account_code: row.account_code as string,
    debit_cents: Number(row.debit_cents ?? 0),
    credit_cents: Number(row.credit_cents ?? 0),
    source_doc_id: (row.journal_entries as unknown as { source_doc_id: string }).source_doc_id
  }));

  if (lines.length === 0) {
    throw new JulyReconciliationError({ checkpoint: 'preflight', expected_cents: -1, observed_cents: 0 });
  }

  for (const chk of SELLER_NET_CHECKPOINTS) {
    const sellerLine = lines.find((l) => l.source_doc_id === chk.source_doc_id && l.account_code === '5351');
    const observed = sellerLine?.credit_cents ?? 0;
    if (observed !== chk.expected_cents) {
      throw new JulyReconciliationError({
        checkpoint: `${chk.source_doc_id} 5351 seller credit (${chk.label})`,
        expected_cents: chk.expected_cents,
        observed_cents: observed
      });
    }
  }

  const totalDr = lines.reduce((s, l) => s + l.debit_cents, 0);
  const totalCr = lines.reduce((s, l) => s + l.credit_cents, 0);
  if (totalDr !== totalCr) {
    throw new JulyReconciliationError({
      checkpoint: 'Σdr = Σcr across these 2 entries',
      expected_cents: 0,
      observed_cents: totalDr - totalCr
    });
  }
}

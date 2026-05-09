import Link from 'next/link';
import { EmptyState } from '@/components/ui';
import { FileMagnifyingGlass } from '@phosphor-icons/react/ssr';
import { formatCentsToCurrency } from '@/lib/services/pricing';
import type { AccountType } from '@/lib/accounting/types';
import type { TrialBalance, TrialBalanceRow } from '@/lib/accounting/queries';

/**
 * Server component. Renders a `TrialBalance` shape grouped by account_type
 * with grand totals and a balanced indicator. Each account_code is a link to
 * the per-account ledger page.
 *
 * Sign convention: positive net_debit_cents = debit normal (assets, expenses).
 * Negative net_debit_cents on liability/equity/revenue rows = the credit-normal
 * balance you'd expect; the UI surfaces it as-is so staff sees the underlying
 * arithmetic. The Phase 0 closing snapshot in
 * docs/audits/phase0-backfill-closing-tb-2026-03-31.md is the regression
 * baseline at ?asOf=2026-03-31.
 */

const TYPE_GROUP_ORDER: AccountType[] = [
  'asset',
  'contra_asset',
  'liability',
  'equity',
  'revenue',
  'expense',
];

const TYPE_GROUP_LABELS: Record<AccountType, string> = {
  asset: 'Assets',
  contra_asset: 'Contra-assets',
  liability: 'Liabilities',
  equity: 'Equity',
  revenue: 'Revenue',
  expense: 'Expenses',
};

interface TrialBalanceTableProps {
  data: TrialBalance;
}

export function TrialBalanceTable({ data }: TrialBalanceTableProps) {
  if (data.rows.length === 0) {
    return (
      <EmptyState
        icon={FileMagnifyingGlass}
        title="No journal entries"
        description={`No entries posted through ${data.as_of}.`}
      />
    );
  }

  // Group rows by account_type. queries.ts already sorts by account_code; we
  // preserve that order within each group.
  const groups = new Map<AccountType, TrialBalanceRow[]>();
  for (const row of data.rows) {
    const list = groups.get(row.account_type) ?? [];
    list.push(row);
    groups.set(row.account_type, list);
  }

  return (
    <div className="space-y-4">
      {!data.is_balanced && (
        <div className="p-4 rounded-lg border border-semantic-error/30 bg-semantic-error/10 text-sm text-semantic-error">
          <strong className="font-semibold">Trial balance is unbalanced.</strong>{' '}
          Σ debits ({formatCentsToCurrency(data.total_debit_cents)}) ≠
          Σ credits ({formatCentsToCurrency(data.total_credit_cents)}).
          Investigate immediately — the deferred Σ-balance trigger from migration 094
          should make this impossible against a healthy GL.
        </div>
      )}

      <div className="rounded-lg border border-semantic-border-subtle bg-semantic-bg-elevated shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm tabular-nums">
            <thead className="bg-semantic-bg-subtle border-b border-semantic-border-subtle">
              <tr className="text-left text-xs uppercase tracking-wider text-semantic-text-muted">
                <th className="px-3 py-2 font-medium">Account</th>
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium text-right">Debit</th>
                <th className="px-3 py-2 font-medium text-right">Credit</th>
                <th className="px-3 py-2 font-medium text-right">Net debit</th>
              </tr>
            </thead>
            <tbody>
              {TYPE_GROUP_ORDER.flatMap((type) => {
                const rows = groups.get(type);
                if (!rows || rows.length === 0) return [];
                const groupDebit = rows.reduce((acc, r) => acc + r.debit_cents, 0);
                const groupCredit = rows.reduce((acc, r) => acc + r.credit_cents, 0);
                const groupNet = groupDebit - groupCredit;
                return [
                  <tr
                    key={`group-${type}`}
                    className="bg-semantic-bg-subtle/60 border-t border-semantic-border-subtle"
                  >
                    <th
                      colSpan={5}
                      className="px-3 py-2 text-left text-xs uppercase tracking-wider font-semibold text-semantic-text-secondary"
                    >
                      {TYPE_GROUP_LABELS[type]}
                    </th>
                  </tr>,
                  ...rows.map((row) => (
                    <tr
                      key={row.account_code}
                      className="border-t border-semantic-border-subtle sm:hover:bg-semantic-bg-subtle transition-colors duration-250 ease-out-custom"
                    >
                      <td className="px-3 py-2 align-top">
                        <Link
                          href={`/staff/accounting/account-ledger/${encodeURIComponent(row.account_code)}/`}
                          className="font-mono text-sm text-semantic-brand sm:hover:underline"
                        >
                          {row.account_code}
                        </Link>
                      </td>
                      <td className="px-3 py-2 align-top text-semantic-text-primary">
                        {row.account_name_en || row.account_name_lv || '—'}
                      </td>
                      <td className="px-3 py-2 align-top text-right text-semantic-text-primary">
                        {formatCentsToCurrency(row.debit_cents)}
                      </td>
                      <td className="px-3 py-2 align-top text-right text-semantic-text-primary">
                        {formatCentsToCurrency(row.credit_cents)}
                      </td>
                      <td className="px-3 py-2 align-top text-right font-medium text-semantic-text-heading">
                        {formatCentsToCurrency(row.net_debit_cents)}
                      </td>
                    </tr>
                  )),
                  <tr
                    key={`subtotal-${type}`}
                    className="border-t border-semantic-border-subtle bg-semantic-bg-subtle/30"
                  >
                    <td
                      colSpan={2}
                      className="px-3 py-2 text-xs uppercase tracking-wider text-semantic-text-muted font-medium"
                    >
                      {TYPE_GROUP_LABELS[type]} subtotal
                    </td>
                    <td className="px-3 py-2 text-right font-medium text-semantic-text-secondary">
                      {formatCentsToCurrency(groupDebit)}
                    </td>
                    <td className="px-3 py-2 text-right font-medium text-semantic-text-secondary">
                      {formatCentsToCurrency(groupCredit)}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold text-semantic-text-heading">
                      {formatCentsToCurrency(groupNet)}
                    </td>
                  </tr>,
                ];
              })}
            </tbody>
            <tfoot className="bg-semantic-bg-subtle border-t-2 border-semantic-border-default">
              <tr>
                <td
                  colSpan={2}
                  className="px-3 py-3 text-sm font-semibold text-semantic-text-heading"
                >
                  Grand totals
                </td>
                <td className="px-3 py-3 text-right text-sm font-semibold text-semantic-text-heading">
                  {formatCentsToCurrency(data.total_debit_cents)}
                </td>
                <td className="px-3 py-3 text-right text-sm font-semibold text-semantic-text-heading">
                  {formatCentsToCurrency(data.total_credit_cents)}
                </td>
                <td className="px-3 py-3 text-right text-sm font-semibold text-semantic-text-heading">
                  {data.is_balanced ? (
                    <span className="text-semantic-success">Balanced</span>
                  ) : (
                    <span className="text-semantic-error">Unbalanced</span>
                  )}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

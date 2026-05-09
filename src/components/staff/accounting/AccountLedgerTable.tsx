import Link from 'next/link';
import { EmptyState } from '@/components/ui';
import { FileMagnifyingGlass } from '@phosphor-icons/react/ssr';
import { formatCentsToCurrency } from '@/lib/services/pricing';
import type { AccountLedger } from '@/lib/accounting/queries';

/**
 * Server component. Renders an `AccountLedger` shape: opening balance row,
 * per-line tape (date + entry id + narrative + dr/cr + running balance),
 * closing balance row. Each entry id links to the journal entry detail page.
 *
 * Sign convention: positive running_balance_cents = debit normal. For
 * credit-normal accounts (liabilities, equity, revenue) the balance reads
 * negative; staff understands this from the trial balance view's grouping.
 */

interface AccountLedgerTableProps {
  data: AccountLedger;
}

export function AccountLedgerTable({ data }: AccountLedgerTableProps) {
  if (data.lines.length === 0) {
    return (
      <div className="space-y-4">
        <BalancesSummary
          openingDate={data.range.from}
          openingCents={data.opening_balance_cents}
          closingDate={data.range.to}
          closingCents={data.closing_balance_cents}
        />
        <EmptyState
          icon={FileMagnifyingGlass}
          title="No activity in the range"
          description={`No journal lines for ${data.account.code} between ${data.range.from} and ${data.range.to}.`}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <BalancesSummary
        openingDate={data.range.from}
        openingCents={data.opening_balance_cents}
        closingDate={data.range.to}
        closingCents={data.closing_balance_cents}
      />

      <div className="rounded-lg border border-semantic-border-subtle bg-semantic-bg-elevated shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm tabular-nums">
            <thead className="bg-semantic-bg-subtle border-b border-semantic-border-subtle">
              <tr className="text-left text-xs uppercase tracking-wider text-semantic-text-muted">
                <th className="px-3 py-2 font-medium">Date</th>
                <th className="px-3 py-2 font-medium">Entry</th>
                <th className="px-3 py-2 font-medium">Narrative</th>
                <th className="px-3 py-2 font-medium text-right">Debit</th>
                <th className="px-3 py-2 font-medium text-right">Credit</th>
                <th className="px-3 py-2 font-medium text-right">Running balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-semantic-border-subtle">
              <tr className="bg-semantic-bg-subtle/40">
                <td className="px-3 py-2 font-mono text-xs text-semantic-text-muted">
                  {data.range.from}
                </td>
                <td colSpan={2} className="px-3 py-2 text-xs uppercase tracking-wider text-semantic-text-muted font-medium">
                  Opening balance
                </td>
                <td className="px-3 py-2" />
                <td className="px-3 py-2" />
                <td className="px-3 py-2 text-right font-medium text-semantic-text-heading">
                  {formatCentsToCurrency(data.opening_balance_cents)}
                </td>
              </tr>
              {data.lines.map(({ line, entry, running_balance_cents }) => {
                const narrative = line.narrative ?? entry.narrative ?? '—';
                return (
                  <tr
                    key={line.id}
                    className="sm:hover:bg-semantic-bg-subtle transition-colors duration-250 ease-out-custom"
                  >
                    <td className="px-3 py-2 font-mono text-xs text-semantic-text-muted whitespace-nowrap align-top">
                      {entry.posting_date}
                    </td>
                    <td className="px-3 py-2 align-top">
                      <Link
                        href={`/staff/accounting/journal-entry/${entry.id}/`}
                        className="font-mono text-xs text-semantic-brand sm:hover:underline"
                      >
                        {entry.id.slice(0, 8)}…
                      </Link>
                      <div className="text-xs text-semantic-text-muted">
                        {entry.type_id}
                      </div>
                    </td>
                    <td className="px-3 py-2 align-top text-semantic-text-primary max-w-md">
                      {narrative}
                    </td>
                    <td className="px-3 py-2 align-top text-right text-semantic-text-primary">
                      {line.debit_cents > 0 ? formatCentsToCurrency(line.debit_cents) : ''}
                    </td>
                    <td className="px-3 py-2 align-top text-right text-semantic-text-primary">
                      {line.credit_cents > 0 ? formatCentsToCurrency(line.credit_cents) : ''}
                    </td>
                    <td className="px-3 py-2 align-top text-right font-medium text-semantic-text-heading">
                      {formatCentsToCurrency(running_balance_cents)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-semantic-bg-subtle border-t-2 border-semantic-border-default">
              <tr>
                <td className="px-3 py-3 font-mono text-xs text-semantic-text-muted">
                  {data.range.to}
                </td>
                <td colSpan={4} className="px-3 py-3 text-sm font-semibold text-semantic-text-heading">
                  Closing balance
                </td>
                <td className="px-3 py-3 text-right text-sm font-semibold text-semantic-text-heading">
                  {formatCentsToCurrency(data.closing_balance_cents)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

interface BalancesSummaryProps {
  openingDate: string;
  openingCents: number;
  closingDate: string;
  closingCents: number;
}

function BalancesSummary({ openingDate, openingCents, closingDate, closingCents }: BalancesSummaryProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div className="rounded-lg border border-semantic-border-subtle bg-semantic-bg-elevated px-4 py-3">
        <p className="text-xs uppercase tracking-wider text-semantic-text-muted">
          Opening balance
        </p>
        <p className="text-lg font-semibold text-semantic-text-heading tabular-nums">
          {formatCentsToCurrency(openingCents)}
        </p>
        <p className="text-xs text-semantic-text-muted font-mono">as of {openingDate}</p>
      </div>
      <div className="rounded-lg border border-semantic-border-subtle bg-semantic-bg-elevated px-4 py-3">
        <p className="text-xs uppercase tracking-wider text-semantic-text-muted">
          Closing balance
        </p>
        <p className="text-lg font-semibold text-semantic-text-heading tabular-nums">
          {formatCentsToCurrency(closingCents)}
        </p>
        <p className="text-xs text-semantic-text-muted font-mono">as of {closingDate}</p>
      </div>
    </div>
  );
}

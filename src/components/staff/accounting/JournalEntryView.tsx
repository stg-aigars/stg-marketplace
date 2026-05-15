import Link from 'next/link';
import { Card, CardBody, Badge } from '@/components/ui';
import { formatCentsToCurrency } from '@/lib/services/pricing';
import type { JournalEntryDetail } from '@/lib/accounting/queries';
import { CARD_SUBSECTION_HEADING_CLASS } from '@/lib/heading-classes';
import { cn } from '@/lib/cn';

/**
 * Server component. Renders a single `JournalEntryDetail` shape: header card
 * with all entry-level fields, line tape with joined account names, totals
 * footer with balanced indicator. The full posting_context JSON is rendered
 * in a <pre> for staff inspection.
 *
 * The Σ debit = Σ credit invariant is enforced by the deferred constraint
 * trigger from migration 094 — this view surfaces is_balanced anyway so a
 * corrupted row would be caught visually.
 */

interface JournalEntryViewProps {
  data: JournalEntryDetail;
}

export function JournalEntryView({ data }: JournalEntryViewProps) {
  const { entry, lines } = data;
  const isBackfill = entry.posting_context?.backfill === true;
  const isTestArtifact = entry.posting_context?.test_artifact === true;

  return (
    <div className="space-y-6">
      <Card>
        <CardBody className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="trust">{entry.type_id}</Badge>
            <Badge variant="default">{entry.entry_type}</Badge>
            {isBackfill && <Badge variant="default">Backfill</Badge>}
            {isTestArtifact && <Badge variant="warning">Test artifact</Badge>}
            {entry.period_close_adjustment && (
              <Badge variant="warning">Period-close adjustment</Badge>
            )}
            {entry.reverses_entry_id && (
              <Badge variant="warning">Reversal</Badge>
            )}
          </div>

          <div className="space-y-2">
            <h2 className={CARD_SUBSECTION_HEADING_CLASS}>
              {entry.narrative}
            </h2>
            <p className="font-mono text-xs text-semantic-text-muted">
              {entry.id}
            </p>
          </div>

          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <Field label="Posting date">
              <span className="font-mono text-semantic-text-primary">
                {entry.posting_date}
              </span>
            </Field>
            <Field label="Created at">
              <span className="font-mono text-xs text-semantic-text-primary">
                {entry.created_at}
              </span>
            </Field>
            <Field label="Accounting period">
              <span className="font-mono text-semantic-text-primary">
                {entry.accounting_period}
              </span>
            </Field>
            <Field label="Tax period">
              <span className="font-mono text-semantic-text-primary">
                {entry.tax_period}
              </span>
            </Field>
            <Field label="Source document">
              <span className="text-semantic-text-primary">
                {entry.source_doc_type ?? '—'}
                {entry.source_doc_id && (
                  <>
                    {' / '}
                    <span className="font-mono text-xs">{entry.source_doc_id}</span>
                  </>
                )}
              </span>
            </Field>
            <Field label="Created by">
              <span className="font-mono text-xs text-semantic-text-primary">
                {entry.created_by}
              </span>
            </Field>
            {entry.reverses_entry_id && (
              <Field label="Reverses entry">
                <Link
                  href={`/staff/accounting/journal-entry/${entry.reverses_entry_id}/`}
                  className="font-mono text-xs text-semantic-brand sm:hover:underline"
                >
                  {entry.reverses_entry_id}
                </Link>
              </Field>
            )}
            {entry.correction_reason && (
              <Field label="Correction reason">
                <span className="text-semantic-text-primary">{entry.correction_reason}</span>
              </Field>
            )}
          </dl>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="p-0">
          <div className="px-4 py-3 border-b border-semantic-border-subtle">
            <h2 className={CARD_SUBSECTION_HEADING_CLASS}>
              Lines ({lines.length})
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm tabular-nums">
              <thead className="bg-semantic-bg-subtle border-b border-semantic-border-subtle">
                <tr className="text-left text-xs uppercase tracking-wider text-semantic-text-muted">
                  <th className="px-3 py-2 font-medium">#</th>
                  <th className="px-3 py-2 font-medium">Account</th>
                  <th className="px-3 py-2 font-medium">Narrative</th>
                  <th className="px-3 py-2 font-medium text-right">Debit</th>
                  <th className="px-3 py-2 font-medium text-right">Credit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-semantic-border-subtle">
                {lines.map((line) => (
                  <tr
                    key={line.id}
                    className="sm:hover:bg-semantic-bg-subtle transition-colors duration-250 ease-out-custom"
                  >
                    <td className="px-3 py-2 align-top text-xs text-semantic-text-muted">
                      {line.line_number}
                    </td>
                    <td className="px-3 py-2 align-top">
                      <Link
                        href={`/staff/accounting/account-ledger/${encodeURIComponent(line.account_code)}/`}
                        className="font-mono text-xs text-semantic-brand sm:hover:underline"
                      >
                        {line.account_code}
                      </Link>
                      <div className="text-xs text-semantic-text-muted">
                        {line.account_name_en || line.account_name_lv || '—'}
                      </div>
                      {(line.vat_country || line.vat_rate_snapshot !== null) && (
                        <div className="text-xs text-semantic-text-muted font-mono">
                          {line.vat_country ?? ''}
                          {line.vat_rate_snapshot !== null
                            ? ` · ${(line.vat_rate_snapshot * 100).toFixed(2).replace(/\.00$/, '')}%`
                            : ''}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 align-top text-semantic-text-primary max-w-md">
                      {line.narrative ?? '—'}
                    </td>
                    <td className="px-3 py-2 align-top text-right text-semantic-text-primary">
                      {line.debit_cents > 0 ? formatCentsToCurrency(line.debit_cents) : ''}
                    </td>
                    <td className="px-3 py-2 align-top text-right text-semantic-text-primary">
                      {line.credit_cents > 0 ? formatCentsToCurrency(line.credit_cents) : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-semantic-bg-subtle border-t-2 border-semantic-border-default">
                <tr>
                  <td colSpan={3} className="px-3 py-3 text-sm font-semibold text-semantic-text-heading">
                    Totals
                  </td>
                  <td className="px-3 py-3 text-right text-sm font-semibold text-semantic-text-heading">
                    {formatCentsToCurrency(data.total_debit_cents)}
                  </td>
                  <td className="px-3 py-3 text-right text-sm font-semibold text-semantic-text-heading">
                    {formatCentsToCurrency(data.total_credit_cents)}
                  </td>
                </tr>
                {!data.is_balanced && (
                  <tr>
                    <td colSpan={5} className="px-3 py-3">
                      <div className="rounded-md border border-semantic-error/30 bg-semantic-error/10 px-3 py-2 text-sm text-semantic-error">
                        <strong className="font-semibold">Entry is unbalanced.</strong>{' '}
                        Σ debit ≠ Σ credit. The deferred constraint trigger from
                        migration 094 should have prevented this — flag for
                        immediate investigation.
                      </div>
                    </td>
                  </tr>
                )}
                {data.is_balanced && (
                  <tr>
                    <td colSpan={5} className="px-3 py-2 text-right text-xs text-semantic-success">
                      Balanced
                    </td>
                  </tr>
                )}
              </tfoot>
            </table>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <h2 className={cn(CARD_SUBSECTION_HEADING_CLASS, 'mb-2')}>
            Posting context
          </h2>
          <pre className="text-xs font-mono whitespace-pre-wrap break-words p-3 rounded bg-semantic-bg-subtle text-semantic-text-secondary overflow-x-auto">
{JSON.stringify(entry.posting_context ?? {}, null, 2)}
          </pre>
        </CardBody>
      </Card>
    </div>
  );
}

interface FieldProps {
  label: string;
  children: React.ReactNode;
}

function Field({ label, children }: FieldProps) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-semantic-text-muted">{label}</dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  );
}

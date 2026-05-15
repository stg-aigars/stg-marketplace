import { Card, CardBody, EmptyState } from '@/components/ui';
import { CheckCircle, Warning, WarningCircle } from '@phosphor-icons/react/ssr';
import { formatCentsToCurrency } from '@/lib/services/pricing';
import type { WalletIntegrityCheck as WalletIntegrityCheckShape } from '@/lib/accounting/queries';
import { CARD_SUBSECTION_HEADING_CLASS } from '@/lib/heading-classes';

/**
 * Server component. Renders a `WalletIntegrityCheck` shape: four summary
 * numbers (Σ GL 5351 credit-normal, Σ wallets, in-flight withdrawals,
 * delta), a reconciliation indicator, an optional unattributed-GL callout
 * (lines on 5351 whose counterparty cannot be resolved to a user_id —
 * typically system counterparties like VID / STG_INTERNAL), an optional
 * stale-in-flight warning card (withdrawals approved but uncompleted for
 * ≥ STALE_IN_FLIGHT_DAYS), and a per-seller delta table for any user with
 * a non-zero diff between GL and wallet balance.
 *
 * Phase 0 case (no live wallets, no 5351 activity, no in-flight): all sums
 * are 0, delta is 0, in-flight is 0, unattributed is 0, stale list empty,
 * status reads "Reconciled".
 *
 * **Reconciliation contract (post-PR-C-commit-11b):** the global delta is
 * reported as reconciled iff `delta_cents === in_flight_withdrawals_cents`
 * AND `unattributed_gl_cents === 0`. Pre-11b the gate was `delta === 0`;
 * 11b extends the invariant to account for Shape-2 lazy timing in
 * withdrawal completion (commit 10) — wallet table is debited at request
 * but GL 5351 lags until completion, so GL legitimately leads wallet by
 * the in-flight amount during normal operations.
 */

interface WalletIntegrityCheckProps {
  data: WalletIntegrityCheckShape;
}

export function WalletIntegrityCheck({ data }: WalletIntegrityCheckProps) {
  const fullyReconciled = data.is_reconciled && data.unattributed_gl_cents === 0;

  return (
    <div className="space-y-6">
      <ReconciliationStatus
        fullyReconciled={fullyReconciled}
        deltaCents={data.delta_cents}
        inFlightCents={data.in_flight_withdrawals_cents}
        unattributedCents={data.unattributed_gl_cents}
      />

      {/*
        4-column grid. Mobile: single column stack. Tablet (sm): 2x2 wrap.
        Desktop (lg): single row. Q11b-3 sign-off — in-flight is a peer
        to GL/wallets/delta, not a footnote.
      */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          label="GL 5351 (credit − debit)"
          value={data.gl_5351_sum_cents}
          accent="primary"
        />
        <SummaryCard
          label="Σ wallets.balance_cents"
          value={data.wallet_table_sum_cents}
          accent="primary"
        />
        <SummaryCard
          label="Σ in-flight withdrawals"
          value={data.in_flight_withdrawals_cents}
          accent="primary"
        />
        <SummaryCard
          label="Delta (GL − wallets)"
          value={data.delta_cents}
          // Reconciled when delta equals expected in-flight (Shape-2 contract).
          accent={data.delta_cents === data.in_flight_withdrawals_cents ? 'success' : 'error'}
        />
      </div>

      {data.unattributed_gl_cents !== 0 && (
        <Card>
          <CardBody className="space-y-2">
            <div className="flex items-center gap-2">
              <Warning size={20} className="text-semantic-warning" />
              <h2 className={CARD_SUBSECTION_HEADING_CLASS}>
                Unattributed GL balance
              </h2>
            </div>
            <p className="text-sm text-semantic-text-secondary">
              5351 lines whose counterparty cannot be resolved to a{' '}
              <code className="font-mono text-xs">user_id</code> (null
              counterparty, missing row, or system counterparty such as VID /
              STG_INTERNAL). These contribute to the global delta but cannot
              be attributed to a seller below.
            </p>
            <p className="text-right font-mono tabular-nums text-base font-semibold text-semantic-warning">
              {formatCentsToCurrency(data.unattributed_gl_cents)}
            </p>
          </CardBody>
        </Card>
      )}

      <StaleInFlightTable rows={data.stale_in_flight_withdrawals} />

      <PerSellerTable rows={data.per_seller_deltas} />

      <p className="text-xs text-semantic-text-muted font-mono">
        Last checked at {data.as_of}
      </p>
    </div>
  );
}

interface ReconciliationStatusProps {
  fullyReconciled: boolean;
  deltaCents: number;
  inFlightCents: number;
  unattributedCents: number;
}

function ReconciliationStatus({
  fullyReconciled,
  deltaCents,
  inFlightCents,
  unattributedCents,
}: ReconciliationStatusProps) {
  if (fullyReconciled) {
    return (
      <div className="rounded-lg border border-semantic-success/30 bg-semantic-success/10 p-4 flex items-start gap-3">
        <CheckCircle size={24} className="text-semantic-success flex-shrink-0" weight="fill" />
        <div className="space-y-1">
          <p className="text-sm font-semibold text-semantic-success">
            Reconciled
          </p>
          <p className="text-sm text-semantic-text-secondary">
            {inFlightCents === 0 ? (
              <>
                GL account 5351 matches the canonical{' '}
                <code className="font-mono text-xs">wallets.balance_cents</code>{' '}
                totals with no unattributed lines.
              </>
            ) : (
              <>
                GL/wallet delta of{' '}
                <span className="font-mono tabular-nums">
                  {formatCentsToCurrency(deltaCents)}
                </span>{' '}
                matches expected in-flight withdrawals (Shape-2 lazy timing:
                wallet table debits at request; GL 5351 debits at staff-marked
                completion). No unattributed lines.
              </>
            )}
          </p>
        </div>
      </div>
    );
  }

  // Discrepancy = (delta does not match in-flight) OR (unattributed GL exists).
  // Surface BOTH the actual delta AND the in-flight amount so staff can see
  // whether the issue is in-flight-related drift, an orphan in counterparty
  // resolution, or a true reconciliation gap.
  const unexpectedDelta = deltaCents - inFlightCents;
  return (
    <div className="rounded-lg border border-semantic-error/30 bg-semantic-error/10 p-4 flex items-start gap-3">
      <WarningCircle size={24} className="text-semantic-error flex-shrink-0" weight="fill" />
      <div className="space-y-1">
        <p className="text-sm font-semibold text-semantic-error">
          Discrepancy detected
        </p>
        <p className="text-sm text-semantic-text-secondary">
          {unexpectedDelta !== 0 && (
            <>
              GL/wallet delta{' '}
              <span className="font-mono tabular-nums font-semibold text-semantic-error">
                {formatCentsToCurrency(deltaCents)}
              </span>{' '}
              differs from expected in-flight withdrawals{' '}
              <span className="font-mono tabular-nums">
                {formatCentsToCurrency(inFlightCents)}
              </span>{' '}
              by{' '}
              <span className="font-mono tabular-nums font-semibold text-semantic-error">
                {formatCentsToCurrency(unexpectedDelta)}
              </span>
              .{' '}
            </>
          )}
          {unattributedCents !== 0 && (
            <>
              Unattributed GL balance:{' '}
              <span className="font-mono tabular-nums font-semibold text-semantic-warning">
                {formatCentsToCurrency(unattributedCents)}
              </span>
              .{' '}
            </>
          )}
          Investigate the per-seller table below and any unresolved
          counterparty rows in the GL.
        </p>
      </div>
    </div>
  );
}

interface StaleInFlightTableProps {
  rows: WalletIntegrityCheckShape['stale_in_flight_withdrawals'];
}

function StaleInFlightTable({ rows }: StaleInFlightTableProps) {
  if (rows.length === 0) return null;

  return (
    <Card>
      <CardBody className="space-y-3">
        <div className="flex items-center gap-2">
          <Warning size={20} className="text-semantic-warning" />
          <h2 className={CARD_SUBSECTION_HEADING_CLASS}>
            Stale in-flight withdrawals ({rows.length})
          </h2>
        </div>
        <p className="text-sm text-semantic-text-secondary">
          Withdrawals approved ≥ 7 days ago but not yet marked completed. SEPA
          outbound SLA is typically 1-2 business days; older approvals likely
          indicate either a forgotten &ldquo;Mark completed&rdquo; action after
          the wire was sent, or a stalled approval where the wire never went
          out. Investigate each row.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm tabular-nums">
            <thead className="bg-semantic-bg-subtle border-y border-semantic-border-subtle">
              <tr className="text-left text-xs uppercase tracking-wider text-semantic-text-muted">
                <th className="px-3 py-2 font-medium">Withdrawal ID</th>
                <th className="px-3 py-2 font-medium">User ID</th>
                <th className="px-3 py-2 font-medium text-right">Amount</th>
                <th className="px-3 py-2 font-medium text-right">Approved</th>
                <th className="px-3 py-2 font-medium text-right">Days in-flight</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-semantic-border-subtle">
              {rows.map((row) => (
                <tr key={row.withdrawal_request_id}>
                  <td className="px-3 py-2 align-top font-mono text-xs text-semantic-text-primary">
                    {row.withdrawal_request_id}
                  </td>
                  <td className="px-3 py-2 align-top font-mono text-xs text-semantic-text-muted">
                    {row.user_id}
                  </td>
                  <td className="px-3 py-2 align-top text-right text-semantic-text-primary">
                    {formatCentsToCurrency(row.amount_cents)}
                  </td>
                  <td className="px-3 py-2 align-top text-right font-mono text-xs text-semantic-text-muted">
                    {row.reviewed_at.slice(0, 10)}
                  </td>
                  <td className="px-3 py-2 align-top text-right font-semibold text-semantic-warning">
                    {row.days_in_flight}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardBody>
    </Card>
  );
}

interface SummaryCardProps {
  label: string;
  value: number;
  accent: 'primary' | 'success' | 'error';
}

function SummaryCard({ label, value, accent }: SummaryCardProps) {
  const valueClass =
    accent === 'success'
      ? 'text-semantic-success'
      : accent === 'error'
        ? 'text-semantic-error'
        : 'text-semantic-text-heading';

  return (
    <Card>
      <CardBody className="space-y-1">
        <p className="text-xs uppercase tracking-wider text-semantic-text-muted">
          {label}
        </p>
        <p
          className={`text-2xl font-semibold font-mono tabular-nums text-right ${valueClass}`}
        >
          {formatCentsToCurrency(value)}
        </p>
      </CardBody>
    </Card>
  );
}

interface PerSellerTableProps {
  rows: WalletIntegrityCheckShape['per_seller_deltas'];
}

function PerSellerTable({ rows }: PerSellerTableProps) {
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={CheckCircle}
        title="No wallet discrepancies"
        description="Every seller's GL 5351 sub-balance matches their wallets.balance_cents."
      />
    );
  }

  return (
    <div className="rounded-lg border border-semantic-border-subtle bg-semantic-bg-elevated shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-semantic-border-subtle">
        <h2 className={CARD_SUBSECTION_HEADING_CLASS}>
          Per-seller deltas ({rows.length})
        </h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm tabular-nums">
          <thead className="bg-semantic-bg-subtle border-b border-semantic-border-subtle">
            <tr className="text-left text-xs uppercase tracking-wider text-semantic-text-muted">
              <th className="px-3 py-2 font-medium">Seller</th>
              <th className="px-3 py-2 font-medium">User ID</th>
              <th className="px-3 py-2 font-medium text-right">GL 5351</th>
              <th className="px-3 py-2 font-medium text-right">Wallet</th>
              <th className="px-3 py-2 font-medium text-right">Delta</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-semantic-border-subtle">
            {rows.map((row) => (
              <tr
                key={row.seller_user_id}
                className="sm:hover:bg-semantic-bg-subtle transition-colors duration-250 ease-out-custom"
              >
                <td className="px-3 py-2 align-top text-semantic-text-primary">
                  {row.seller_handle ?? (
                    <span className="text-semantic-text-muted">
                      [no handle]
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 align-top">
                  <span className="font-mono text-xs text-semantic-text-muted">
                    {row.seller_user_id}
                  </span>
                </td>
                <td className="px-3 py-2 align-top text-right text-semantic-text-primary">
                  {formatCentsToCurrency(row.gl_balance_cents)}
                </td>
                <td className="px-3 py-2 align-top text-right text-semantic-text-primary">
                  {formatCentsToCurrency(row.wallet_balance_cents)}
                </td>
                <td className="px-3 py-2 align-top text-right font-semibold text-semantic-error">
                  {formatCentsToCurrency(row.delta_cents)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

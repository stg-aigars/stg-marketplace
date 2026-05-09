import { Card, CardBody, EmptyState } from '@/components/ui';
import { CheckCircle, Warning, WarningCircle } from '@phosphor-icons/react/ssr';
import { formatCentsToCurrency } from '@/lib/services/pricing';
import type { WalletIntegrityCheck as WalletIntegrityCheckShape } from '@/lib/accounting/queries';

/**
 * Server component. Renders a `WalletIntegrityCheck` shape: three summary
 * numbers (Σ GL 5351 credit-normal, Σ wallets, delta), a reconciliation
 * indicator, an optional unattributed-GL callout (lines on 5351 whose
 * counterparty cannot be resolved to a user_id — typically system
 * counterparties like VID / STG_INTERNAL), and a per-seller delta table for
 * any user with a non-zero diff between GL and wallet balance.
 *
 * Phase 0 case (no live wallets, no 5351 activity): all sums are 0,
 * delta is 0, unattributed is 0, table is empty, status reads "Reconciled".
 *
 * Reconciliation contract: the global delta is reported as reconciled only
 * when delta_cents === 0 AND unattributed_gl_cents === 0. A non-zero
 * unattributed amount means the global Σ might balance arithmetically while
 * masking unresolved counterparty rows — surfacing it explicitly keeps the
 * arithmetic explainable per the queries.ts contract.
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
        unattributedCents={data.unattributed_gl_cents}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
          label="Delta (GL − wallets)"
          value={data.delta_cents}
          accent={data.delta_cents === 0 ? 'success' : 'error'}
        />
      </div>

      {data.unattributed_gl_cents !== 0 && (
        <Card>
          <CardBody className="space-y-2">
            <div className="flex items-center gap-2">
              <Warning size={20} className="text-semantic-warning" />
              <h2 className="text-base font-semibold text-semantic-text-heading">
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
  unattributedCents: number;
}

function ReconciliationStatus({
  fullyReconciled,
  deltaCents,
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
            GL account 5351 matches the canonical{' '}
            <code className="font-mono text-xs">wallets.balance_cents</code> totals
            with no unattributed lines.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-semantic-error/30 bg-semantic-error/10 p-4 flex items-start gap-3">
      <WarningCircle size={24} className="text-semantic-error flex-shrink-0" weight="fill" />
      <div className="space-y-1">
        <p className="text-sm font-semibold text-semantic-error">
          Discrepancy detected
        </p>
        <p className="text-sm text-semantic-text-secondary">
          {deltaCents !== 0 && (
            <>
              GL 5351 vs wallet table delta:{' '}
              <span className="font-mono tabular-nums font-semibold text-semantic-error">
                {formatCentsToCurrency(deltaCents)}
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
        <h2 className="text-base font-semibold text-semantic-text-heading">
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
                    <span className="text-semantic-text-muted italic">
                      (no handle)
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

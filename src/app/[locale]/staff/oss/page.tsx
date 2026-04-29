import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireServerAuth } from '@/lib/auth/helpers';
import { Card, CardBody, Badge, Alert } from '@/components/ui';
import { formatCentsToCurrency } from '@/lib/services/pricing';
import { formatDate, formatDateTime } from '@/lib/date-utils';
import { aggregateVatByMS, type OrderFinancialData } from '@/lib/vat-aggregation';
import {
  HOME_COUNTRY,
  OSS_MEMBER_STATES,
  quarterContaining,
  projectToDeclared,
  type OssSubmissionRow,
  type OssMemberState,
  type OssDeclaredAmounts,
} from '@/lib/oss/types';
import {
  aggregatePriorPeriodRefunds,
  type PriorRefundRow,
} from '@/lib/oss/prior-period-refunds';
import { OssSubmissionForm } from './OssSubmissionForm';

export const metadata: Metadata = {
  title: 'OSS — Staff',
};

interface PageProps {
  searchParams: Promise<{ quarter?: string }>;
}

export default async function StaffOssPage(props: PageProps) {
  const { isStaff, serviceClient } = await requireServerAuth();
  if (!isStaff) {
    redirect('/');
  }

  const searchParams = await props.searchParams;
  // Server Component: capture request time once for deadline math + quarter resolution.
  const now = new Date();

  // Resolve quarter from `?quarter=YYYY-Q[1-4]` or default to the current open quarter.
  const targetQuarter = parseQuarterParam(searchParams.quarter, now) ?? quarterContaining(now);

  // Fetch orders within the quarter window + prior submissions in parallel.
  const quarterStartIso = `${targetQuarter.quarterStart}T00:00:00Z`;
  const quarterEndExclusive = nextDayIso(targetQuarter.quarterEnd);

  const [ordersResult, submissionsResult, priorRefundsResult] = await Promise.all([
    serviceClient
      .from('orders')
      .select('status, seller_country, items_total_cents, shipping_cost_cents, platform_commission_cents, total_amount_cents, commission_net_cents, commission_vat_cents, shipping_net_cents, shipping_vat_cents')
      .gte('created_at', quarterStartIso)
      .lt('created_at', quarterEndExclusive),
    serviceClient
      .from('oss_submissions')
      .select('*')
      .order('quarter_start', { ascending: false })
      .order('filed_at', { ascending: false })
      .limit(20),
    // Prior-period refund adjustments: orders created BEFORE this quarter
    // whose refund settled INSIDE this quarter, on a non-LV (OSS-scope) seller.
    // OSS allows current-period reduction for prior-period reversals; the audit
    // trail must show which refunds were treated this way (Article 369k/369i).
    //
    // Only `refund_status='completed'` rows count — `partial` and `failed`
    // are manual-reconciliation states that haven't fully reversed the
    // original supply, so declaring them as OSS reversals would risk a
    // restatement once the operational fix lands.
    serviceClient
      .from('orders')
      .select('seller_country, total_amount_cents, refund_amount_cents, commission_vat_cents, shipping_vat_cents')
      .lt('created_at', quarterStartIso)
      .gte('refunded_at', quarterStartIso)
      .lt('refunded_at', quarterEndExclusive)
      .neq('seller_country', HOME_COUNTRY)
      .gt('refund_amount_cents', 0)
      .eq('refund_status', 'completed'),
  ]);

  const orders = (ordersResult.data ?? []) as unknown as OrderFinancialData[];
  const submissions = (submissionsResult.data ?? []) as OssSubmissionRow[];
  const priorRefunds = (priorRefundsResult.data ?? []) as PriorRefundRow[];

  // Aggregate non-LV (cross-border) VAT for the target quarter.
  const aggregates = aggregateVatByMS(orders, { excludeHomeCountry: HOME_COUNTRY });
  const declared: OssDeclaredAmounts = {};
  for (const row of aggregates) {
    if (OSS_MEMBER_STATES.includes(row.ms as OssMemberState)) {
      declared[row.ms as OssMemberState] = projectToDeclared(row);
    }
  }

  const priorAdjustments = aggregatePriorPeriodRefunds(priorRefunds);
  const adjustmentTotalNet = OSS_MEMBER_STATES.reduce((sum, ms) => sum + (priorAdjustments[ms]?.netReversalCents ?? 0), 0);
  const adjustmentTotalVat = OSS_MEMBER_STATES.reduce((sum, ms) => sum + (priorAdjustments[ms]?.vatReversalCents ?? 0), 0);
  const adjustmentTotalCount = OSS_MEMBER_STATES.reduce((sum, ms) => sum + (priorAdjustments[ms]?.orderCount ?? 0), 0);

  const totalNetCents = OSS_MEMBER_STATES.reduce((sum, ms) => sum + (declared[ms]?.net_cents ?? 0), 0);
  const totalVatCents = OSS_MEMBER_STATES.reduce((sum, ms) => sum + (declared[ms]?.vat_cents ?? 0), 0);
  const totalOrderCount = OSS_MEMBER_STATES.reduce((sum, ms) => sum + (declared[ms]?.order_count ?? 0), 0);

  // Find the latest non-superseded submission for this quarter, if any.
  const supersededIds = new Set(
    submissions.map((s) => s.supersedes_submission_id).filter((x): x is string => !!x),
  );
  const currentSubmission = submissions.find(
    (s) => s.quarter_start === targetQuarter.quarterStart && !supersededIds.has(s.id),
  ) ?? null;

  // Deadline banner state
  const deadlineDate = new Date(`${targetQuarter.deadline}T23:59:59Z`);
  const daysToDeadline = Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const deadlinePassed = daysToDeadline < 0;
  const deadlineImminent = daysToDeadline >= 0 && daysToDeadline <= 14;

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl sm:text-3xl font-bold font-display tracking-tight text-semantic-text-heading">
          VAT OSS — {targetQuarter.label}
        </h1>
        <QuarterPicker now={now} active={targetQuarter.label} />
      </div>

      {!currentSubmission && deadlinePassed && (
        <Alert variant="error" title="Deadline passed">
          The submission deadline for {targetQuarter.label} ({formatDate(targetQuarter.deadline)}) has passed and no filing has been recorded. File at the VID OSS portal and mark filed below.
        </Alert>
      )}
      {!currentSubmission && deadlineImminent && (
        <Alert variant="warning" title={`${daysToDeadline} day${daysToDeadline === 1 ? '' : 's'} until deadline`}>
          The submission deadline for {targetQuarter.label} is {formatDate(targetQuarter.deadline)}. File at the VID OSS portal and record it below.
        </Alert>
      )}
      {currentSubmission && (
        <Alert variant="success" title="Filed">
          Filed {formatDateTime(currentSubmission.filed_at)}
          {currentSubmission.payment_reference ? ` · Payment ref ${currentSubmission.payment_reference}` : ''}
          {currentSubmission.payment_cleared_at ? ` · Payment cleared ${formatDate(currentSubmission.payment_cleared_at)}` : ''}.
        </Alert>
      )}

      <Card>
        <CardBody>
          <h2 className="text-base font-semibold text-semantic-text-heading mb-3">
            Per-MS declaration
          </h2>
          <p className="text-xs text-semantic-text-muted mb-3">
            Cross-border B2C supplies to non-LV sellers, aggregated for the quarter. LV→LV transactions feed the regular LV VAT return and are excluded here.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-semantic-text-muted border-b border-semantic-border-subtle">
                  <th className="pb-2 font-medium">MS</th>
                  <th className="pb-2 font-medium">Rate</th>
                  <th className="pb-2 font-medium text-right">Orders</th>
                  <th className="pb-2 font-medium text-right">Taxable amount (net)</th>
                  <th className="pb-2 font-medium text-right">VAT due</th>
                </tr>
              </thead>
              <tbody>
                {OSS_MEMBER_STATES.map((ms) => {
                  const row = declared[ms];
                  const aggregateRow = aggregates.find((r) => r.ms === ms);
                  return (
                    <tr key={ms} className="border-b border-semantic-border-subtle last:border-0">
                      <td className="py-2 font-medium text-semantic-text-heading">{ms}</td>
                      <td className="py-2 text-semantic-text-secondary">
                        {aggregateRow ? `${(aggregateRow.rate * 100).toFixed(0)}%` : '—'}
                      </td>
                      <td className="py-2 text-right text-semantic-text-secondary">{row?.order_count ?? 0}</td>
                      <td className="py-2 text-right text-semantic-text-primary">{formatCentsToCurrency(row?.net_cents ?? 0)}</td>
                      <td className="py-2 text-right font-semibold text-semantic-text-heading">{formatCentsToCurrency(row?.vat_cents ?? 0)}</td>
                    </tr>
                  );
                })}
                <tr className="bg-semantic-bg-elevated">
                  <td className="py-2 font-semibold text-semantic-text-heading" colSpan={2}>Total</td>
                  <td className="py-2 text-right font-semibold text-semantic-text-heading">{totalOrderCount}</td>
                  <td className="py-2 text-right font-semibold text-semantic-text-heading">{formatCentsToCurrency(totalNetCents)}</td>
                  <td className="py-2 text-right font-semibold text-semantic-text-heading">{formatCentsToCurrency(totalVatCents)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-xs text-semantic-text-muted mt-3">
            10-year retention per Article 369k of Directive 2006/112/EC. Underlying audit events (oss.submission_recorded etc.) are persisted with retention_class=regulatory.
          </p>
        </CardBody>
      </Card>

      {adjustmentTotalCount > 0 && (
        <Card>
          <CardBody>
            <h2 className="text-base font-semibold text-semantic-text-heading mb-3">
              Prior-period refund adjustments
            </h2>
            <p className="text-xs text-semantic-text-muted mb-3">
              Refunds settled in {targetQuarter.label} on orders created in a
              prior quarter, by MS. OSS permits current-period reduction for
              prior-period reversals; the per-MS portal entry can be
              decreased by the VAT amounts below. Recorded in audit_log via
              the upstream order.refunded events.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-semantic-text-muted border-b border-semantic-border-subtle">
                    <th className="pb-2 font-medium">MS</th>
                    <th className="pb-2 font-medium text-right">Orders</th>
                    <th className="pb-2 font-medium text-right">Net reversal</th>
                    <th className="pb-2 font-medium text-right">VAT reversal</th>
                  </tr>
                </thead>
                <tbody>
                  {OSS_MEMBER_STATES.map((ms) => {
                    const row = priorAdjustments[ms];
                    if (!row || row.orderCount === 0) return null;
                    return (
                      <tr key={ms} className="border-b border-semantic-border-subtle last:border-0">
                        <td className="py-2 font-medium text-semantic-text-heading">{ms}</td>
                        <td className="py-2 text-right text-semantic-text-secondary">{row.orderCount}</td>
                        <td className="py-2 text-right text-semantic-text-primary">−{formatCentsToCurrency(row.netReversalCents)}</td>
                        <td className="py-2 text-right font-semibold text-semantic-error">−{formatCentsToCurrency(row.vatReversalCents)}</td>
                      </tr>
                    );
                  })}
                  <tr className="bg-semantic-bg-elevated">
                    <td className="py-2 font-semibold text-semantic-text-heading">Total</td>
                    <td className="py-2 text-right font-semibold text-semantic-text-heading">{adjustmentTotalCount}</td>
                    <td className="py-2 text-right font-semibold text-semantic-text-heading">−{formatCentsToCurrency(adjustmentTotalNet)}</td>
                    <td className="py-2 text-right font-semibold text-semantic-error">−{formatCentsToCurrency(adjustmentTotalVat)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      )}

      {!currentSubmission && totalVatCents > 0 && (
        <Card>
          <CardBody>
            <h2 className="text-base font-semibold text-semantic-text-heading mb-3">
              Mark filed
            </h2>
            <p className="text-sm text-semantic-text-secondary mb-4">
              File the OSS declaration at the VID portal first, then record it here. The recorded amounts and payment reference become the audit-defensible artefact for {targetQuarter.label}.
            </p>
            <OssSubmissionForm
              quarterStart={targetQuarter.quarterStart}
              declaredAmounts={declared}
            />
          </CardBody>
        </Card>
      )}

      <Card>
        <CardBody>
          <h2 className="text-base font-semibold text-semantic-text-heading mb-3">
            Submission history
          </h2>
          {submissions.length === 0 ? (
            <p className="text-sm text-semantic-text-muted">No submissions recorded yet.</p>
          ) : (
            <div className="space-y-2">
              {submissions.map((s) => {
                const label = quarterContaining(new Date(`${s.quarter_start}T12:00:00Z`)).label;
                const isSuperseded = supersededIds.has(s.id);
                const isAmendment = !!s.supersedes_submission_id;
                return (
                  <div key={s.id} className="flex flex-wrap items-center gap-2 text-sm py-1">
                    <span className="font-mono text-xs text-semantic-text-muted">{label}</span>
                    {isAmendment && <Badge variant="warning">Amendment</Badge>}
                    {isSuperseded && <Badge variant="default">Superseded</Badge>}
                    <span className="text-semantic-text-secondary">Filed {formatDate(s.filed_at)}</span>
                    {s.payment_reference && (
                      <span className="text-xs text-semantic-text-muted">· Ref {s.payment_reference}</span>
                    )}
                    {s.payment_cleared_at && (
                      <span className="text-xs text-semantic-text-muted">· Cleared {formatDate(s.payment_cleared_at)}</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

/** Build a `?quarter=YYYY-Q[1-4]` selector spanning current + previous 3 quarters. */
function QuarterPicker({ now, active }: { now: Date; active: string }) {
  const links: Array<{ key: string; label: string; href: string }> = [];
  for (let i = 0; i < 4; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i * 3, 15));
    const q = quarterContaining(d);
    const param = `${d.getUTCFullYear()}-Q${Math.floor(d.getUTCMonth() / 3) + 1}`;
    links.push({ key: param, label: q.label, href: `/staff/oss?quarter=${param}` });
  }
  return (
    <div className="flex items-center gap-2 text-xs">
      {links.map((link) => (
        <Link
          key={link.key}
          href={link.href}
          className={`px-2 py-1 rounded ${link.label === active ? 'bg-semantic-brand text-white' : 'text-semantic-text-muted hover:bg-semantic-surface-subtle'}`}
        >
          {link.label}
        </Link>
      ))}
    </div>
  );
}

function parseQuarterParam(
  param: string | undefined,
  now: Date,
): { quarterStart: string; quarterEnd: string; deadline: string; label: string } | null {
  if (!param) return null;
  const match = /^(\d{4})-Q([1-4])$/.exec(param);
  if (!match) return null;
  const year = Number(match[1]);
  const quarter = Number(match[2]);
  // Use a date inside the requested quarter — quarterContaining does the math.
  const date = new Date(Date.UTC(year, (quarter - 1) * 3 + 1, 15));
  const result = quarterContaining(date);
  // Also reject far-future quarters (more than current quarter). Allow current + past.
  const currentQuarterStart = quarterContaining(now).quarterStart;
  if (result.quarterStart > currentQuarterStart) return null;
  return result;
}

function nextDayIso(isoDate: string): string {
  // isoDate is YYYY-MM-DD. Return ISO timestamp for the next day at 00:00 UTC.
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString();
}

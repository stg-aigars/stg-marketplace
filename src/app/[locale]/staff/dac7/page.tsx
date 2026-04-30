import type { Metadata } from 'next';
import Link from 'next/link';
import { createServiceClient } from '@/lib/supabase';
import { formatCentsToCurrency } from '@/lib/services/pricing';
import { Card, CardBody, Badge, Alert } from '@/components/ui';
import { CalendarBlank, Warning } from '@phosphor-icons/react/ssr';
import { formatDate } from '@/lib/date-utils';
import {
  DAC7_REPORT_TRANSACTIONS,
  DAC7_REPORT_CONSIDERATION_CENTS,
} from '@/lib/dac7/constants';
import type { Dac7SellerStatus } from '@/lib/dac7/types';
import { Dac7StaffActions } from './Dac7StaffActions';

export const metadata: Metadata = {
  title: 'DAC7 Tax Reporting',
};

interface SellerWithStats {
  id: string;
  full_name: string | null;
  email: string | null;
  dac7_status: Dac7SellerStatus;
  dac7_status_updated_at: string | null;
  dac7_date_of_birth: string | null;
  dac7_tax_id: string | null;
  iban: string | null;
}

const STATUS_LABELS: Record<Dac7SellerStatus, string> = {
  not_applicable: 'N/A',
  approaching: 'Approaching',
  data_requested: 'Data requested',
  reminder_sent: 'Reminder sent',
  data_provided: 'Data provided',
  blocked: 'Blocked',
};

const STATUS_VARIANTS: Record<Dac7SellerStatus, 'default' | 'warning' | 'error' | 'success'> = {
  not_applicable: 'default',
  approaching: 'warning',
  data_requested: 'warning',
  reminder_sent: 'warning',
  data_provided: 'success',
  blocked: 'error',
};

export default async function Dac7StaffPage() {
  const supabase = createServiceClient();
  const now = new Date();
  const currentYear = now.getFullYear();

  // Parallel fetch: status counts, action sellers, approaching sellers
  const [
    { data: allProfiles },
    { data: actionSellers },
    { data: approachingSellers },
  ] = await Promise.all([
    supabase
      .from('user_profiles')
      .select('dac7_status')
      .neq('dac7_status', 'not_applicable'),
    supabase
      .from('user_profiles')
      .select('id, full_name, email, dac7_status, dac7_status_updated_at, dac7_date_of_birth, dac7_tax_id, iban')
      .in('dac7_status', ['data_requested', 'reminder_sent', 'blocked'])
      .order('dac7_status', { ascending: false }),
    supabase
      .from('user_profiles')
      .select('id, full_name, dac7_status')
      .eq('dac7_status', 'approaching'),
  ]);

  const statusCounts: Record<string, number> = {
    approaching: 0,
    data_requested: 0,
    reminder_sent: 0,
    data_provided: 0,
    blocked: 0,
  };
  for (const p of allProfiles ?? []) {
    if (p.dac7_status in statusCounts) {
      statusCounts[p.dac7_status]++;
    }
  }

  // Fetch stats for all sellers with any status
  const allSellerIds = [
    ...(actionSellers ?? []).map((s) => s.id),
    ...(approachingSellers ?? []).map((s) => s.id),
  ];

  const { data: allStats } = allSellerIds.length > 0
    ? await supabase
        .from('dac7_seller_annual_stats')
        .select('seller_id, completed_transaction_count, total_consideration_cents')
        .eq('calendar_year', currentYear)
        .in('seller_id', allSellerIds)
    : { data: [] };

  const statsMap = new Map(
    (allStats ?? []).map((s) => [s.seller_id, s])
  );

  // Fetch annual reports for current year
  const { data: reports } = await supabase
    .from('dac7_annual_reports')
    .select('id, seller_id, calendar_year, generated_at, seller_notified_at, submitted_to_vid_at')
    .eq('calendar_year', currentYear);

  // Submission deadline: DAC7 reports for calendar year N are filed by
  // 31 January of year N+1 (Article 25 of Council Directive 2011/16/EU
  // as amended by Council Directive (EU) 2021/514). The "current
  // reporting year" is whatever year's data is being collected today —
  // before 31 Jan that's the previous calendar year; after, it's the
  // current calendar year.
  const reportingYear = now.getMonth() === 0 ? currentYear - 1 : currentYear;
  const deadline = new Date(Date.UTC(reportingYear + 1, 0, 31, 23, 59, 59));
  const daysToDeadline = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const deadlinePassed = daysToDeadline < 0;
  const deadlineImminent = !deadlinePassed && daysToDeadline <= 30;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl sm:text-3xl font-bold font-display tracking-tight text-semantic-text-heading">
        DAC7 Tax Reporting
      </h1>

      {/* Submission-deadline banner */}
      {deadlinePassed ? (
        <Alert variant="error" icon={Warning} title="Filing deadline passed">
          The DAC7 filing deadline for {reportingYear} calendar-year activity
          ({formatDate(deadline.toISOString())}) has passed. Confirm submission
          status with VID and update the report records below.
        </Alert>
      ) : deadlineImminent ? (
        <Alert
          variant="warning"
          icon={Warning}
          title={`${daysToDeadline} day${daysToDeadline === 1 ? '' : 's'} until DAC7 deadline`}
        >
          The {reportingYear} report is due {formatDate(deadline.toISOString())}.
          Confirm seller data is complete and the XML report is generated for
          submission to the Latvian State Revenue Service (VID).
        </Alert>
      ) : (
        <Alert variant="info" icon={CalendarBlank} title="DAC7 reporting calendar">
          Next filing deadline: {formatDate(deadline.toISOString())} for {reportingYear}{' '}
          calendar-year activity ({daysToDeadline} day{daysToDeadline === 1 ? '' : 's'}{' '}
          remaining). Article 25 of Council Directive 2011/16/EU as amended by
          Council Directive (EU) 2021/514.
        </Alert>
      )}

      {/* Section A: Status Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {Object.entries(statusCounts).map(([status, count]) => (
          <Card key={status}>
            <CardBody className="text-center py-4">
              <p className="text-2xl font-bold text-semantic-text-heading">{count}</p>
              <p className="text-xs text-semantic-text-muted mt-1">{STATUS_LABELS[status as Dac7SellerStatus]}</p>
            </CardBody>
          </Card>
        ))}
      </div>

      {/* Section B: Action Required */}
      {(actionSellers?.length ?? 0) > 0 && (
        <Card>
          <CardBody>
            <h2 className="text-base font-semibold text-semantic-text-heading mb-3">
              Action required
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-semantic-text-muted border-b border-semantic-border-subtle">
                    <th className="pb-2 font-medium">Seller</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 font-medium">Transactions</th>
                    <th className="pb-2 font-medium">Consideration</th>
                    <th className="pb-2 font-medium">Data</th>
                  </tr>
                </thead>
                <tbody>
                  {(actionSellers as SellerWithStats[])?.map((seller) => {
                    const stats = statsMap.get(seller.id);
                    const hasData = !!(seller.dac7_date_of_birth && seller.dac7_tax_id && seller.iban);
                    return (
                      <tr key={seller.id} className="border-b border-semantic-border-subtle last:border-0">
                        <td className="py-2">
                          <Link href={`/staff/users/${seller.id}`} className="link-brand">
                            <p className="font-medium text-semantic-text-heading">{seller.full_name ?? 'Unknown'}</p>
                            <p className="text-xs text-semantic-text-muted">{seller.email}</p>
                          </Link>
                        </td>
                        <td className="py-2">
                          <Badge variant={STATUS_VARIANTS[seller.dac7_status]}>
                            {STATUS_LABELS[seller.dac7_status]}
                          </Badge>
                        </td>
                        <td className="py-2">{stats?.completed_transaction_count ?? 0}</td>
                        <td className="py-2">{formatCentsToCurrency(stats?.total_consideration_cents ?? 0)}</td>
                        <td className="py-2">
                          <span className={hasData ? 'text-semantic-success' : 'text-semantic-error'}>
                            {hasData ? 'Complete' : 'Missing'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Section C: Approaching */}
      {(approachingSellers?.length ?? 0) > 0 && (
        <Card>
          <CardBody>
            <h2 className="text-base font-semibold text-semantic-text-heading mb-3">
              Approaching threshold ({approachingSellers?.length})
            </h2>
            <div className="space-y-2">
              {approachingSellers?.map((seller) => {
                const stats = statsMap.get(seller.id);
                return (
                  <Link
                    key={seller.id}
                    href={`/staff/users/${seller.id}`}
                    className="flex items-center justify-between text-sm py-1 hover:bg-semantic-surface-subtle rounded px-2 -mx-2"
                  >
                    <span className="text-semantic-text-heading">{seller.full_name ?? 'Unknown'}</span>
                    <span className="text-semantic-text-muted">
                      {stats?.completed_transaction_count ?? 0}/{DAC7_REPORT_TRANSACTIONS} tx
                      {' · '}
                      {formatCentsToCurrency(stats?.total_consideration_cents ?? 0)}/{formatCentsToCurrency(DAC7_REPORT_CONSIDERATION_CENTS)}
                    </span>
                  </Link>
                );
              })}
            </div>
          </CardBody>
        </Card>
      )}

      {/* Section D: Annual Reports + Actions */}
      <Card>
        <CardBody>
          <h2 className="text-base font-semibold text-semantic-text-heading mb-3">
            Annual reports — {currentYear}
          </h2>
          {(reports?.length ?? 0) > 0 ? (
            <div className="space-y-2 mb-4">
              {reports?.map((r) => (
                <div key={r.id} className="flex items-center justify-between text-sm py-1 border-b border-semantic-border-subtle last:border-0">
                  <span className="text-semantic-text-heading">{r.seller_id.slice(0, 8)}...</span>
                  <div className="flex gap-2">
                    <Badge variant={r.seller_notified_at ? 'success' : 'default'}>
                      {r.seller_notified_at ? 'Notified' : 'Not notified'}
                    </Badge>
                    <Badge variant={r.submitted_to_vid_at ? 'success' : 'default'}>
                      {r.submitted_to_vid_at ? 'Submitted' : 'Pending'}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-semantic-text-muted mb-4">
              No reports generated for {currentYear} yet.
            </p>
          )}

          <Dac7StaffActions year={currentYear} hasReports={(reports?.length ?? 0) > 0} />
        </CardBody>
      </Card>
    </div>
  );
}

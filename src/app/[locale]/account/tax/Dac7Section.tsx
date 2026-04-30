'use client';

import { Alert, Card, CardBody } from '@/components/ui';
import { ShieldWarning, CheckCircle, Warning } from '@phosphor-icons/react/ssr';
import { formatCentsToCurrency } from '@/lib/services/pricing';
import { DAC7_REPORT_TRANSACTIONS, DAC7_REPORT_CONSIDERATION_CENTS } from '@/lib/dac7/constants';
import type { Dac7ProfileData, Dac7SellerAnnualStats } from '@/lib/dac7/types';
import { Dac7Form } from './Dac7Form';

interface Dac7SectionProps {
  dac7Profile: Dac7ProfileData | null;
  stats: Dac7SellerAnnualStats | null;
}

export function Dac7Section({ dac7Profile, stats }: Dac7SectionProps) {
  const status = dac7Profile?.dac7_status ?? 'not_applicable';
  const year = stats?.calendar_year ?? new Date().getFullYear();

  // State A: Below threshold, no action needed
  if (status === 'not_applicable') {
    return (
      <Card>
        <CardBody>
          <h2 className="text-base font-semibold text-semantic-text-heading mb-2">
            EU tax reporting (DAC7)
          </h2>
          <p className="text-sm text-semantic-text-muted">
            EU rules require marketplaces to report seller activity to tax
            authorities once certain thresholds are reached. This is about
            reporting, not additional taxes.
          </p>
          <p className="text-sm text-semantic-text-muted mt-2">
            The threshold is {DAC7_REPORT_TRANSACTIONS} completed
            sales or {formatCentsToCurrency(DAC7_REPORT_CONSIDERATION_CENTS)} in
            total sales per calendar year (whichever comes first).
          </p>
          {stats && (stats.completed_transaction_count > 0 || stats.total_consideration_cents > 0) && (
            <StatsDisplay stats={stats} year={year} />
          )}
        </CardBody>
      </Card>
    );
  }

  // State B: Approaching / Data requested / Reminder sent — show form
  if (status === 'approaching' || status === 'data_requested' || status === 'reminder_sent') {
    return (
      <div className="space-y-4">
        <Alert
          variant={status === 'approaching' ? 'info' : 'warning'}
          icon={<Warning size={20} />}
          title={status === 'approaching'
            ? 'Getting close to the threshold'
            : 'Tax details needed'}
        >
          <p className="text-sm">
            {status === 'approaching'
              ? "You're getting close to the reporting threshold. We'll ask for some extra details if you reach it."
              : "You've crossed the reporting threshold. Fill in your tax details below."}
          </p>
        </Alert>

        {stats && <StatsDisplay stats={stats} year={year} />}

        <Dac7Form dac7Profile={dac7Profile} />
      </div>
    );
  }

  // State C: Data provided — show read-only summary
  if (status === 'data_provided') {
    return (
      <div className="space-y-4">
        <Alert variant="success" icon={<CheckCircle size={20} />} title="Tax details saved">
          <p className="text-sm">
            We have your tax details on file. You can update them below if anything changes.
          </p>
        </Alert>

        {stats && <StatsDisplay stats={stats} year={year} />}

        <Dac7Form dac7Profile={dac7Profile} />
      </div>
    );
  }

  // State D: Blocked — urgent form
  if (status === 'blocked') {
    return (
      <div className="space-y-4">
        <Alert variant="error" icon={<ShieldWarning size={20} />} title="Account restricted">
          <p className="text-sm">
            New listings and withdrawals are paused because we don&apos;t have your
            tax details yet. Fill them in below to restore access.
          </p>
        </Alert>

        {stats && <StatsDisplay stats={stats} year={year} />}

        <Dac7Form dac7Profile={dac7Profile} />
      </div>
    );
  }

  return null;
}

function StatsDisplay({ stats, year }: { stats: Dac7SellerAnnualStats; year: number }) {
  return (
    <Card className="mt-4">
      <CardBody>
        <h3 className="text-base font-semibold text-semantic-text-heading mb-3">
          Your {year} activity
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-semantic-text-muted">Completed sales</p>
            <p className="text-lg font-semibold text-semantic-text-heading">
              {stats.completed_transaction_count}
              <span className="text-sm font-normal text-semantic-text-muted"> / {DAC7_REPORT_TRANSACTIONS}</span>
            </p>
          </div>
          <div>
            <p className="text-sm text-semantic-text-muted">Total sales amount</p>
            <p className="text-lg font-semibold text-semantic-text-heading">
              {formatCentsToCurrency(stats.total_consideration_cents)}
              <span className="text-sm font-normal text-semantic-text-muted"> / {formatCentsToCurrency(DAC7_REPORT_CONSIDERATION_CENTS)}</span>
            </p>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

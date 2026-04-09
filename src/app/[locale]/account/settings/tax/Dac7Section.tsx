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
  const year = new Date().getFullYear();

  // State A: Below threshold, no action needed
  if (status === 'not_applicable') {
    return (
      <Card>
        <CardBody>
          <h2 className="text-base font-semibold text-semantic-text-heading mb-2">
            EU tax reporting (DAC7)
          </h2>
          <p className="text-sm text-semantic-text-muted">
            As an EU marketplace, Second Turn Games is required to report seller
            activity to tax authorities when certain thresholds are reached. This
            does not create new tax obligations — it ensures transparency for
            income you may already need to declare.
          </p>
          <p className="text-sm text-semantic-text-muted mt-2">
            Reporting applies when a seller completes {DAC7_REPORT_TRANSACTIONS} or
            more transactions or earns {formatCentsToCurrency(DAC7_REPORT_CONSIDERATION_CENTS)} or
            more in a calendar year.
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
          icon={Warning}
          title={status === 'approaching'
            ? 'Approaching reporting threshold'
            : 'Additional information required'}
        >
          <p className="text-sm">
            {status === 'approaching'
              ? 'You are approaching the DAC7 reporting threshold. We may need some additional information from you soon.'
              : 'You have reached the EU tax reporting threshold. Please provide your tax information below.'}
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
        <Alert variant="success" icon={CheckCircle} title="Information on file">
          <p className="text-sm">
            Your tax reporting information has been saved. You can update it below if anything changes.
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
        <Alert variant="error" icon={ShieldWarning} title="Account restricted — information required">
          <p className="text-sm">
            Your ability to create new listings and withdraw funds has been paused
            because we were unable to collect required tax reporting information.
            Please provide the required details below to restore full access.
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

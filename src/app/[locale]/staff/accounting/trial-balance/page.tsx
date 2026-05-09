import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireServerAuth } from '@/lib/auth/helpers';
import { Card, CardBody, Button } from '@/components/ui';
import { Scales } from '@phosphor-icons/react/ssr';
import { getTrialBalance } from '@/lib/accounting/queries';
import { TrialBalanceTable } from '@/components/staff/accounting/TrialBalanceTable';
import { BackfillFilterToggle } from '@/components/staff/accounting/BackfillFilterToggle';

export const metadata: Metadata = {
  title: 'Trial balance — Staff',
};

interface SearchParams {
  asOf?: string;
  includeBackfill?: string;
}

/** ISO YYYY-MM-DD for today (UTC). Staff UI uses ISO format throughout. */
function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export default async function TrialBalancePage(
  props: { searchParams: Promise<SearchParams> }
) {
  const { isStaff, serviceClient } = await requireServerAuth();
  if (!isStaff) {
    redirect('/');
  }

  const searchParams = await props.searchParams;

  // Defaults: asOf = today; includeBackfill = true. Validate asOf shape so
  // a malformed param falls back to today instead of failing the SQL query.
  const asOf = searchParams.asOf && ISO_DATE_RE.test(searchParams.asOf)
    ? searchParams.asOf
    : todayIso();
  const includeBackfill = searchParams.includeBackfill !== 'false';

  const data = await getTrialBalance(serviceClient, asOf, { includeBackfill });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Scales size={24} className="text-semantic-text-heading" />
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-semantic-text-heading">
          Trial balance
        </h1>
      </div>
      <p className="text-sm text-semantic-text-secondary max-w-2xl">
        All journal lines whose entry posting_date is on or before{' '}
        <span className="font-mono text-semantic-text-primary">{asOf}</span>,
        aggregated per account. Σ debit must equal Σ credit. Click any account
        code to drill into its ledger.
      </p>

      <Card>
        <CardBody>
          <form method="GET" className="flex flex-wrap items-end gap-4">
            <div className="flex flex-col">
              <label
                htmlFor="asOf"
                className="block text-sm font-medium text-semantic-text-primary mb-1.5"
              >
                As of
              </label>
              {/* Native date input — keeps the page server-rendered. The
                  BackfillFilterToggle is the one client island we need. */}
              <input
                id="asOf"
                name="asOf"
                type="date"
                defaultValue={asOf}
                className="block min-h-[44px] rounded-lg border border-semantic-border-default px-3 py-2.5 text-base sm:text-sm text-semantic-text-primary bg-semantic-bg-input transition-all duration-250 ease-out-custom focus:outline-none focus:ring-2 focus:ring-semantic-brand/20 focus:border-semantic-brand"
              />
            </div>
            {/* Preserve includeBackfill across the date submit — the toggle
                emits ?includeBackfill=false; the form must round-trip it. */}
            {!includeBackfill && (
              <input type="hidden" name="includeBackfill" value="false" />
            )}
            <Button type="submit" variant="primary">
              Apply
            </Button>
            <div className="ml-auto">
              <BackfillFilterToggle />
            </div>
          </form>
        </CardBody>
      </Card>

      <TrialBalanceTable data={data} />
    </div>
  );
}

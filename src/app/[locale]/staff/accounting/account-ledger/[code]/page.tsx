import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireServerAuth } from '@/lib/auth/helpers';
import { Card, CardBody, Button, BackLink } from '@/components/ui';
import { getAccountLedger } from '@/lib/accounting/queries';
import { AccountLedgerTable } from '@/components/staff/accounting/AccountLedgerTable';
import { BackfillFilterToggle } from '@/components/staff/accounting/BackfillFilterToggle';

export const metadata: Metadata = {
  title: 'Account ledger — Staff',
};

interface SearchParams {
  from?: string;
  to?: string;
  includeBackfill?: string;
}

interface RouteParams {
  code: string;
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Default `from`: 365 days ago. Sensible window for the staff scan view; the
 * underlying query always reads the full lifetime of the account so the
 * opening balance is correctly reconstructed regardless of `from`. Staff
 * can override via the date filters.
 */
function defaultFromIso(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 365);
  return d.toISOString().slice(0, 10);
}

export default async function AccountLedgerPage(
  props: { params: Promise<RouteParams>; searchParams: Promise<SearchParams> }
) {
  const { isStaff, serviceClient } = await requireServerAuth();
  if (!isStaff) {
    redirect('/');
  }

  const params = await props.params;
  const searchParams = await props.searchParams;

  // Next.js URL-decodes route segments automatically, so codes like
  // `5710-LV-OUT` arrive intact. We re-encode in any outgoing links.
  const accountCode = params.code;

  const from = searchParams.from && ISO_DATE_RE.test(searchParams.from)
    ? searchParams.from
    : defaultFromIso();
  const to = searchParams.to && ISO_DATE_RE.test(searchParams.to)
    ? searchParams.to
    : todayIso();
  const includeBackfill = searchParams.includeBackfill !== 'false';

  const data = await getAccountLedger(
    serviceClient,
    accountCode,
    { from, to },
    { includeBackfill },
  );

  return (
    <div className="space-y-6">
      <BackLink href="/staff/accounting/trial-balance/" label="Back to trial balance" />

      <div className="space-y-1">
        <p className="text-xs uppercase tracking-wider text-semantic-text-muted">
          Account ledger
        </p>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-semantic-text-heading">
          <span className="font-mono">{data.account.code}</span>
          <span className="text-semantic-text-muted"> — </span>
          {data.account.name_en || data.account.name_lv}
        </h1>
        <p className="text-sm text-semantic-text-muted">
          Type: <span className="capitalize">{data.account.type.replace('_', ' ')}</span>
          {data.account.is_vat ? ' · VAT account' : ''}
          {!data.account.is_active ? ' · Inactive' : ''}
        </p>
      </div>

      <Card>
        <CardBody>
          <form method="GET" className="flex flex-wrap items-end gap-4">
            <div className="flex flex-col">
              <label
                htmlFor="from"
                className="block text-sm font-medium text-semantic-text-primary mb-1.5"
              >
                From
              </label>
              <input
                id="from"
                name="from"
                type="date"
                defaultValue={from}
                className="block min-h-[44px] rounded-lg border border-semantic-border-default px-3 py-2.5 text-base sm:text-sm text-semantic-text-primary bg-semantic-bg-input transition-all duration-250 ease-out-custom focus:outline-none focus:ring-2 focus:ring-semantic-brand/20 focus:border-semantic-brand"
              />
            </div>
            <div className="flex flex-col">
              <label
                htmlFor="to"
                className="block text-sm font-medium text-semantic-text-primary mb-1.5"
              >
                To
              </label>
              <input
                id="to"
                name="to"
                type="date"
                defaultValue={to}
                className="block min-h-[44px] rounded-lg border border-semantic-border-default px-3 py-2.5 text-base sm:text-sm text-semantic-text-primary bg-semantic-bg-input transition-all duration-250 ease-out-custom focus:outline-none focus:ring-2 focus:ring-semantic-brand/20 focus:border-semantic-brand"
              />
            </div>
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

      <AccountLedgerTable data={data} />
    </div>
  );
}

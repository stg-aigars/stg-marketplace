import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { requireServerAuth } from '@/lib/auth/helpers';
import { BackLink } from '@/components/ui';
import { getJournalEntry } from '@/lib/accounting/queries';
import { JournalEntryView } from '@/components/staff/accounting/JournalEntryView';

export const metadata: Metadata = {
  title: 'Journal entry — Staff',
};

interface RouteParams {
  id: string;
}

/**
 * Strict UUIDv4-shape regex (8-4-4-4-12 hex). Mirrors the shape validation
 * pattern used by the trial-balance and account-ledger pages — a malformed
 * URL must render the framework's standard 404 instead of letting a raw
 * Postgres `invalid input syntax for type uuid` error bubble up.
 */
const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export default async function JournalEntryPage(
  props: { params: Promise<RouteParams> }
) {
  const { isStaff, serviceClient } = await requireServerAuth();
  if (!isStaff) {
    redirect('/');
  }

  const params = await props.params;

  // Reject malformed IDs at the route boundary so a stray /journal-entry/abc
  // URL renders the standard 404 instead of leaking a Postgres syntax error.
  if (!UUID_RE.test(params.id)) {
    notFound();
  }

  // getJournalEntry throws "entry <id> not found" when the row is missing
  // (see queries.ts:377). Translate that into the standard 404 surface so
  // staff browsing a deleted/non-existent entry sees a clean not-found page
  // rather than a 500.
  let data;
  try {
    data = await getJournalEntry(serviceClient, params.id);
  } catch (error) {
    if (error instanceof Error && /not found/.test(error.message)) {
      notFound();
    }
    throw error;
  }

  return (
    <div className="space-y-6">
      <BackLink href="/staff/accounting/trial-balance/" label="Back to trial balance" />

      <div className="space-y-1">
        <p className="text-xs uppercase tracking-wider text-semantic-text-muted">
          Journal entry
        </p>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-semantic-text-heading">
          <span className="font-mono">{data.entry.id.slice(0, 8)}…</span>
        </h1>
      </div>

      <JournalEntryView data={data} />
    </div>
  );
}

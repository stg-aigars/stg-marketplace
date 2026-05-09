import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
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

export default async function JournalEntryPage(
  props: { params: Promise<RouteParams> }
) {
  const { isStaff, serviceClient } = await requireServerAuth();
  if (!isStaff) {
    redirect('/');
  }

  const params = await props.params;
  const data = await getJournalEntry(serviceClient, params.id);

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

import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireServerAuth } from '@/lib/auth/helpers';
import { Card, CardBody, Badge, NavTabs, EmptyState } from '@/components/ui';
import { formatDateTime } from '@/lib/date-utils';
import { REPORT_CATEGORY_LABELS } from '@/app/[locale]/report-illegal-content/categories';
import type { ReportCategory } from '@/app/[locale]/report-illegal-content/categories';
import { StaffNoticeActions } from './StaffNoticeActions';

export const metadata: Metadata = {
  title: 'DSA notices — Staff',
};

type FilterTab = 'open' | 'reviewing' | 'resolved' | 'all';
type BindingTab = 'any' | 'bound' | 'unbound';

interface StaffNoticeRow {
  id: string;
  listing_id: string | null;
  reporter_id: string | null;
  reporter_email: string | null;
  notifier_name: string | null;
  category: ReportCategory;
  content_reference: string;
  explanation: string;
  status: 'open' | 'reviewing' | 'actioned' | 'dismissed';
  staff_note: string | null;
  created_at: string;
  resolved_at: string | null;
  listings: { game_name: string | null } | null;
}

const STATUS_BADGE: Record<StaffNoticeRow['status'], { label: string; variant: 'default' | 'warning' | 'success' | 'error' }> = {
  open: { label: 'Open', variant: 'warning' },
  reviewing: { label: 'Reviewing', variant: 'default' },
  actioned: { label: 'Actioned', variant: 'success' },
  dismissed: { label: 'Dismissed', variant: 'default' },
};

export default async function StaffNoticesPage(props: {
  searchParams: Promise<{ filter?: string; binding?: string }>;
}) {
  const searchParams = await props.searchParams;
  const { isStaff, serviceClient } = await requireServerAuth();
  if (!isStaff) {
    redirect('/');
  }

  const activeFilter = (searchParams.filter as FilterTab) || 'open';
  const activeBinding = (searchParams.binding as BindingTab) || 'any';

  let query = serviceClient
    .from('dsa_notices')
    .select('*, listings(game_name)')
    .order('status', { ascending: true }) // open < reviewing < actioned/dismissed alphabetically
    .order('created_at', { ascending: false })
    .limit(200);

  if (activeFilter === 'open') {
    query = query.eq('status', 'open');
  } else if (activeFilter === 'reviewing') {
    query = query.eq('status', 'reviewing');
  } else if (activeFilter === 'resolved') {
    query = query.in('status', ['actioned', 'dismissed']);
  }

  if (activeBinding === 'bound') {
    query = query.not('listing_id', 'is', null);
  } else if (activeBinding === 'unbound') {
    query = query.is('listing_id', null);
  }

  const { data: notices } = await query;
  const typed = (notices ?? []) as unknown as StaffNoticeRow[];

  const filters: { label: string; value: FilterTab }[] = [
    { label: 'Open', value: 'open' },
    { label: 'Reviewing', value: 'reviewing' },
    { label: 'Resolved', value: 'resolved' },
    { label: 'All', value: 'all' },
  ];

  const bindings: { label: string; value: BindingTab }[] = [
    { label: 'Any', value: 'any' },
    { label: 'Bound to listing', value: 'bound' },
    { label: 'Unbound', value: 'unbound' },
  ];

  const buildUrl = (next: { filter?: FilterTab; binding?: BindingTab }) => {
    const params = new URLSearchParams();
    const filter = next.filter ?? activeFilter;
    const binding = next.binding ?? activeBinding;
    if (filter !== 'open') params.set('filter', filter);
    if (binding !== 'any') params.set('binding', binding);
    const qs = params.toString();
    return qs ? `/staff/notices?${qs}` : '/staff/notices';
  };

  return (
    <div>
      <h1 className="text-2xl sm:text-3xl font-bold font-display tracking-tight text-semantic-text-heading mb-2">
        DSA notices
      </h1>
      <p className="text-sm text-semantic-text-muted mb-6">
        Notice-and-action queue under DSA Art. 16. Each row is an inbound notice from{' '}
        <code>/api/report-illegal-content</code> persisted via{' '}
        <code>dsa_notices</code>. Acting on a notice fires the seller-side Art. 17 statement-of-reasons.
      </p>

      <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
        <NavTabs
          tabs={filters.map((f) => ({
            key: f.value,
            label: f.label,
            href: buildUrl({ filter: f.value }),
          }))}
          activeTab={activeFilter}
          variant="pill"
        />
        <NavTabs
          tabs={bindings.map((b) => ({
            key: b.value,
            label: b.label,
            href: buildUrl({ binding: b.value }),
          }))}
          activeTab={activeBinding}
          variant="pill"
        />
      </div>

      {typed.length === 0 ? (
        <EmptyState title="No notices in this view" description="Try a different filter or binding." />
      ) : (
        <div className="space-y-3">
          {typed.map((notice) => (
            <Card key={notice.id}>
              <CardBody>
                <div className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={STATUS_BADGE[notice.status].variant}>
                      {STATUS_BADGE[notice.status].label}
                    </Badge>
                    <Badge variant="default">{REPORT_CATEGORY_LABELS[notice.category] ?? notice.category}</Badge>
                    {notice.listing_id ? (
                      <Link
                        href={`/listings/${notice.listing_id}`}
                        className="link-brand text-sm"
                        target="_blank"
                      >
                        Bound to listing: {notice.listings?.game_name ?? notice.listing_id.slice(0, 8)}
                      </Link>
                    ) : (
                      <span className="text-xs text-semantic-text-muted">Unbound notice</span>
                    )}
                    <span className="text-xs text-semantic-text-muted ml-auto">
                      {formatDateTime(notice.created_at)}
                    </span>
                  </div>

                  <div className="text-sm text-semantic-text-secondary whitespace-pre-wrap break-words">
                    {notice.explanation}
                  </div>

                  <div className="text-xs text-semantic-text-muted">
                    <span className="font-semibold">Reference:</span>{' '}
                    {notice.content_reference.length > 200
                      ? notice.content_reference.slice(0, 200) + '…'
                      : notice.content_reference}
                  </div>

                  <div className="text-xs text-semantic-text-muted">
                    <span className="font-semibold">Notifier:</span>{' '}
                    {notice.notifier_name || (notice.reporter_email ? notice.reporter_email : 'anonymous')}
                  </div>

                  {notice.staff_note && (
                    <div className="text-xs text-semantic-text-muted bg-semantic-bg-elevated rounded px-2 py-1">
                      <span className="font-semibold">Staff note:</span> {notice.staff_note}
                    </div>
                  )}

                  <StaffNoticeActions
                    noticeId={notice.id}
                    hasListing={!!notice.listing_id}
                    status={notice.status}
                  />
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

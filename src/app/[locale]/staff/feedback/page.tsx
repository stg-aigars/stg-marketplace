import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireServerAuth } from '@/lib/auth/helpers';
import {
  Card,
  CardBody,
  Badge,
  NavTabs,
  EmptyState,
  ShowMoreText,
} from '@/components/ui';
import { ChatTeardropDots } from '@phosphor-icons/react/ssr';
import { formatDateTime } from '@/lib/date-utils';
import { PAGE_HEADING_CLASS } from '@/lib/heading-classes';
import {
  FEEDBACK_CATEGORIES,
  type FeedbackCategory,
  type FeedbackStatus,
} from '@/lib/feedback/types';
import { FeedbackStatusControl } from './FeedbackStatusControl';

export const metadata: Metadata = {
  title: 'Site feedback — Staff',
};

type StatusTab = FeedbackStatus | 'all';
type CategoryTab = FeedbackCategory | 'all';

interface FeedbackRow {
  id: string;
  user_id: string | null;
  category: FeedbackCategory;
  message: string;
  contact_email: string | null;
  page_url: string | null;
  locale: string | null;
  status: FeedbackStatus;
  created_at: string;
}

const STATUS_BADGE: Record<FeedbackStatus, { label: string; variant: 'warning' | 'default' | 'success' }> = {
  new: { label: 'New', variant: 'warning' },
  triaged: { label: 'Triaged', variant: 'default' },
  resolved: { label: 'Resolved', variant: 'success' },
};

const CATEGORY_LABEL: Record<FeedbackCategory, string> = {
  idea: 'Idea',
  bug: 'Bug',
  other: 'Other',
};

export default async function StaffFeedbackPage(props: {
  searchParams: Promise<{ status?: string; category?: string }>;
}) {
  const searchParams = await props.searchParams;
  const { isStaff, serviceClient } = await requireServerAuth();
  if (!isStaff) {
    redirect('/');
  }

  const activeStatus = (searchParams.status as StatusTab) || 'new';
  const activeCategory = (searchParams.category as CategoryTab) || 'all';

  let query = serviceClient
    .from('site_feedback')
    .select('*')
    .order('status', { ascending: true })
    .order('created_at', { ascending: false })
    .limit(200);

  if (activeStatus !== 'all') {
    query = query.eq('status', activeStatus);
  }
  if (activeCategory !== 'all') {
    query = query.eq('category', activeCategory);
  }

  const { data: rows } = await query;
  const feedback = (rows ?? []) as unknown as FeedbackRow[];

  const statusFilters: { label: string; value: StatusTab }[] = [
    { label: 'New', value: 'new' },
    { label: 'Triaged', value: 'triaged' },
    { label: 'Resolved', value: 'resolved' },
    { label: 'All', value: 'all' },
  ];

  const categoryFilters: { label: string; value: CategoryTab }[] = [
    { label: 'All', value: 'all' },
    ...FEEDBACK_CATEGORIES.map((c) => ({ label: CATEGORY_LABEL[c], value: c as CategoryTab })),
  ];

  const buildUrl = (next: { status?: StatusTab; category?: CategoryTab }) => {
    const params = new URLSearchParams();
    const status = next.status ?? activeStatus;
    const category = next.category ?? activeCategory;
    if (status !== 'new') params.set('status', status);
    if (category !== 'all') params.set('category', category);
    const qs = params.toString();
    return qs ? `/staff/feedback?${qs}` : '/staff/feedback';
  };

  return (
    <div>
      <div className="mb-2">
        <h1 className={PAGE_HEADING_CLASS}>Site feedback</h1>
        <p className="text-sm text-semantic-text-secondary mt-1">
          Free-text submissions from the launch-window feedback channel. Triage manually;
          there&apos;s no submitter-visible state.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
        <NavTabs
          tabs={statusFilters.map((f) => ({
            key: f.value,
            label: f.label,
            href: buildUrl({ status: f.value }),
          }))}
          activeTab={activeStatus}
          variant="pill"
        />
        <NavTabs
          tabs={categoryFilters.map((f) => ({
            key: f.value,
            label: f.label,
            href: buildUrl({ category: f.value }),
          }))}
          activeTab={activeCategory}
          variant="pill"
        />
      </div>

      {feedback.length === 0 ? (
        <EmptyState
          icon={ChatTeardropDots}
          title="No feedback in this view"
          description="Try a different filter."
        />
      ) : (
        <div className="space-y-3">
          {feedback.map((row) => (
            <Card key={row.id}>
              <CardBody>
                <div className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={STATUS_BADGE[row.status].variant}>
                      {STATUS_BADGE[row.status].label}
                    </Badge>
                    <Badge variant="default">{CATEGORY_LABEL[row.category]}</Badge>
                    {!row.user_id && (
                      <Badge variant="default">Anonymous</Badge>
                    )}
                    <span className="text-xs text-semantic-text-muted ml-auto">
                      {formatDateTime(row.created_at)}
                    </span>
                  </div>

                  <ShowMoreText lines={6} className="text-sm text-semantic-text-secondary whitespace-pre-wrap break-words">
                    {row.message}
                  </ShowMoreText>

                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-semantic-text-muted">
                    {row.page_url && (
                      <span>
                        <span className="font-semibold">Page:</span> {row.page_url}
                      </span>
                    )}
                    {row.locale && (
                      <span>
                        <span className="font-semibold">Locale:</span> {row.locale}
                      </span>
                    )}
                    {row.contact_email && (
                      <span>
                        <span className="font-semibold">Reply-to:</span>{' '}
                        <a href={`mailto:${row.contact_email}`} className="link-brand">
                          {row.contact_email}
                        </a>
                      </span>
                    )}
                  </div>

                  <FeedbackStatusControl feedbackId={row.id} status={row.status} />
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

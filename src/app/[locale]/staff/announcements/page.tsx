import type { Metadata } from 'next';
import Link from 'next/link';
import { Plus } from '@phosphor-icons/react/ssr';
import { createServiceClient } from '@/lib/supabase';
import { Badge, Button, Card, CardBody, EmptyState } from '@/components/ui';
import { formatDateTime } from '@/lib/date-utils';
import { PAGE_HEADING_CLASS } from '@/lib/heading-classes';
import { cn } from '@/lib/cn';
import type { Announcement } from '@/lib/announcements/types';
import { Megaphone } from '@phosphor-icons/react/ssr';

export const metadata: Metadata = {
  title: 'Announcements — Staff',
};

function statusOf(a: Announcement): { label: string; variant: 'default' | 'success' | 'error' } {
  if (a.deleted_at) return { label: 'Deleted', variant: 'error' };
  if (!a.published_at) return { label: 'Draft', variant: 'default' };
  return { label: 'Published', variant: 'success' };
}

export default async function StaffAnnouncementsPage() {
  // Service-role bypasses RLS so staff can see drafts + deleted rows
  // (the anon-permissive SELECT policy on the table only allows
  //  published, non-deleted rows). Layout-level isStaff gate already
  // ran in /staff/layout.tsx.
  const supabase = createServiceClient();
  const { data: announcements } = await supabase
    .from('announcements')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);

  const rows = (announcements as Announcement[] | null) ?? [];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className={cn(PAGE_HEADING_CLASS)}>Announcements</h1>
        <Button variant="brand" size="sm" asChild>
          <Link href="/staff/announcements/new">
            <Plus size={16} className="mr-1.5" />
            New announcement
          </Link>
        </Button>
      </div>

      {rows.length === 0 ? (
        <Card>
          <CardBody>
            <EmptyState
              icon={Megaphone}
              title="No announcements yet"
              description="Publish the first one to ping every user's bell."
              action={{ label: 'New announcement', href: '/staff/announcements/new', variant: 'primary' }}
            />
          </CardBody>
        </Card>
      ) : (
        <Card>
          <CardBody className="p-0">
            <ul className="divide-y divide-semantic-border-default">
              {rows.map((a) => {
                const status = statusOf(a);
                return (
                  <li key={a.id}>
                    <Link
                      href={`/staff/announcements/${a.id}/edit`}
                      className="flex items-start justify-between gap-3 px-4 py-3 sm:hover:bg-semantic-bg-subtle transition-colors duration-250 ease-out-custom"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant={status.variant}>{status.label}</Badge>
                          <span className="text-xs text-semantic-text-muted truncate">
                            {a.slug}
                          </span>
                        </div>
                        <p className="text-sm font-medium text-semantic-text-primary truncate">
                          {a.title}
                        </p>
                        <p className="mt-1 text-xs text-semantic-text-muted">
                          {a.published_at
                            ? `Published ${formatDateTime(a.published_at)}`
                            : `Created ${formatDateTime(a.created_at)}`}
                        </p>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </CardBody>
        </Card>
      )}
    </div>
  );
}

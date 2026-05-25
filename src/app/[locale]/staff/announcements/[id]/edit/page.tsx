import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createServiceClient } from '@/lib/supabase';
import { Badge, BackLink } from '@/components/ui';
import { PAGE_HEADING_CLASS } from '@/lib/heading-classes';
import { cn } from '@/lib/cn';
import type { Announcement } from '@/lib/announcements/types';
import { AnnouncementForm } from '../../_components/AnnouncementForm';

export const metadata: Metadata = {
  title: 'Edit announcement — Staff',
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditAnnouncementPage({ params }: PageProps) {
  const { id } = await params;

  // Service-role bypasses RLS so staff can edit drafts + deleted rows.
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('announcements')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  const announcement = data as Announcement | null;
  if (!announcement) notFound();

  const isPublished = announcement.published_at !== null;
  const isDeleted = announcement.deleted_at !== null;
  const slugLocked = announcement.notified_at !== null;

  const statusBadge = isDeleted
    ? { label: 'Deleted', variant: 'error' as const }
    : isPublished
      ? { label: 'Published', variant: 'success' as const }
      : { label: 'Draft', variant: 'default' as const };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
      <BackLink href="/staff/announcements" label="All announcements" />
      <div className="mt-4 mb-6 flex items-center gap-3">
        <h1 className={cn(PAGE_HEADING_CLASS, 'truncate')}>Edit announcement</h1>
        <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
      </div>
      <AnnouncementForm
        mode="edit"
        id={announcement.id}
        initial={{
          title: announcement.title,
          slug: announcement.slug,
          bodyMarkdown: announcement.body_markdown,
        }}
        slugLocked={slugLocked}
        isPublished={isPublished}
        isDeleted={isDeleted}
      />
    </div>
  );
}

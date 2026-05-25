import type { Metadata } from 'next';
import { BackLink } from '@/components/ui';
import { PAGE_HEADING_CLASS } from '@/lib/heading-classes';
import { cn } from '@/lib/cn';
import { AnnouncementForm } from '../_components/AnnouncementForm';

export const metadata: Metadata = {
  title: 'New announcement — Staff',
};

export default function NewAnnouncementPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
      <BackLink href="/staff/announcements" label="All announcements" />
      <h1 className={cn(PAGE_HEADING_CLASS, 'mt-4 mb-6')}>New announcement</h1>
      <AnnouncementForm mode="new" />
    </div>
  );
}

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireServerAuth } from '@/lib/auth/helpers';
import { createClient } from '@/lib/supabase/server';
import { BackLink } from '@/components/ui';
import { PAGE_HEADING_CLASS } from '@/lib/heading-classes';
import { cn } from '@/lib/cn';
import { EditWantedForm } from './EditWantedForm';
import type { EditWantedListing } from '@/lib/wanted/types';

export const metadata: Metadata = {
  title: 'Edit wanted listing',
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditWantedPage(props: PageProps) {
  const { id } = await props.params;
  const { user } = await requireServerAuth();

  const supabase = await createClient();
  const { data } = await supabase
    .from('wanted_listings')
    .select(`
      id, buyer_id, status, bgg_game_id, game_name, game_year, notes,
      version_source, bgg_version_id, version_name, publisher, language, edition_year, version_thumbnail,
      games:bgg_game_id (thumbnail, image, player_count, alternate_names, min_age, playing_time, weight)
    `)
    .eq('id', id)
    .single<EditWantedListing>();

  if (!data) notFound();
  if (data.buyer_id !== user.id) notFound();
  if (data.status !== 'active') notFound();

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
      <div className="mb-4">
        <BackLink href="/account/wanted" label="My wanted games" />
      </div>
      <h1 className={cn(PAGE_HEADING_CLASS, 'mb-6')}>
        Edit wanted listing
      </h1>
      <EditWantedForm listing={data} />
    </div>
  );
}

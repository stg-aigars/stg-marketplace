import type { Metadata } from 'next';
import { requireServerAuth } from '@/lib/auth/helpers';
import { createClient } from '@/lib/supabase/server';
import { Card, CardBody, EmptyState } from '@/components/ui';
import { ChatCircle } from '@phosphor-icons/react/ssr';
import { InboxSettings } from '@/components/messaging/InboxSettings';
import { ThreadList } from './ThreadList';

export const metadata: Metadata = {
  title: 'Messages',
};

interface CounterpartyProfile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  country: string | null;
}

export interface ThreadRow {
  id: string;
  last_message_at: string;
  last_message_preview: string;
  viewer_last_read_at: string | null;
  counterparty: CounterpartyProfile | null;
}

export default async function MessagesInboxPage() {
  const { user, profile } = await requireServerAuth();
  const supabase = await createClient();

  const { data: threadsRaw } = await supabase
    .from('message_threads')
    .select(
      'id, user_a_id, user_b_id, last_message_at, last_message_preview, user_a_last_read_at, user_b_last_read_at',
    )
    .order('last_message_at', { ascending: false });

  const threads = threadsRaw ?? [];

  const counterpartyIds = Array.from(
    new Set(
      threads
        .map((t) => (t.user_a_id === user.id ? t.user_b_id : t.user_a_id))
        .filter((id): id is string => !!id),
    ),
  );

  const profileMap = new Map<string, CounterpartyProfile>();
  if (counterpartyIds.length > 0) {
    const { data: profiles } = await supabase
      .from('public_profiles')
      .select('id, full_name, avatar_url, country')
      .in('id', counterpartyIds);
    (profiles ?? []).forEach((p) => profileMap.set(p.id, p));
  }

  const rows: ThreadRow[] = threads.map((t) => {
    const isUserA = t.user_a_id === user.id;
    const counterpartyId = isUserA ? t.user_b_id : t.user_a_id;
    return {
      id: t.id,
      last_message_at: t.last_message_at,
      last_message_preview: t.last_message_preview,
      viewer_last_read_at: isUserA ? t.user_a_last_read_at : t.user_b_last_read_at,
      counterparty: counterpartyId ? (profileMap.get(counterpartyId) ?? null) : null,
    };
  });

  const unreadCount = rows.filter(
    (r) => !r.viewer_last_read_at || r.last_message_at > r.viewer_last_read_at,
  ).length;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
      <div className="mb-6 flex items-baseline gap-3">
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Messages</h1>
        {rows.length > 0 && (
          <span className="text-base font-normal text-semantic-text-muted">
            ({rows.length}
            {unreadCount > 0 && (
              <>
                <span aria-hidden="true"> · </span>
                <span className="text-semantic-brand-active font-medium">{unreadCount} unread</span>
              </>
            )}
            )
          </span>
        )}
      </div>

      <div className="space-y-4">
        <InboxSettings messagingEnabled={profile?.messaging_enabled ?? true} />

        {rows.length === 0 ? (
          <Card>
            <CardBody>
              <EmptyState
                icon={ChatCircle}
                title="No conversations yet"
                description="Find a game you want and reach out to the seller."
                action={{ label: 'Browse games', href: '/browse' }}
              />
            </CardBody>
          </Card>
        ) : (
          <Card>
            <CardBody className="p-0">
              <ThreadList threads={rows} />
            </CardBody>
          </Card>
        )}
      </div>
    </div>
  );
}

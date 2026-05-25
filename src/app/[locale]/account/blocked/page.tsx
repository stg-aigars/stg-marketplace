import type { Metadata } from 'next';
import { requireServerAuth } from '@/lib/auth/helpers';
import { createClient } from '@/lib/supabase/server';
import { BackLink, Card, CardBody, EmptyState, UserIdentity } from '@/components/ui';
import { Prohibit } from '@phosphor-icons/react/ssr';
import { UnblockButton } from './UnblockButton';

export const metadata: Metadata = {
  title: 'Blocked users',
};

export default async function BlockedUsersPage() {
  const { user } = await requireServerAuth();
  const supabase = await createClient();

  const { data: blocks } = await supabase
    .from('message_blocks')
    .select('blocked_id, created_at')
    .eq('blocker_id', user.id)
    .order('created_at', { ascending: false });

  const blockedIds = (blocks ?? []).map((b) => b.blocked_id);

  const profileMap = new Map<
    string,
    { id: string; full_name: string | null; avatar_url: string | null; country: string | null }
  >();
  if (blockedIds.length > 0) {
    const { data: profiles } = await supabase
      .from('public_profiles')
      .select('id, full_name, avatar_url, country')
      .in('id', blockedIds);
    (profiles ?? []).forEach((p) => profileMap.set(p.id, p));
  }

  const rows = (blocks ?? []).map((b) => ({
    id: b.blocked_id,
    profile: profileMap.get(b.blocked_id) ?? null,
  }));

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
      <BackLink href="/account/messages" label="Messages" />
      <h1 className="mt-4 mb-2 text-2xl sm:text-3xl font-extrabold tracking-tight">
        Blocked users
      </h1>
      <p className="mb-6 text-sm text-semantic-text-muted">
        Blocked users can&rsquo;t message you or start new conversations.
      </p>

      <Card>
        <CardBody className={rows.length === 0 ? undefined : 'p-0'}>
          {rows.length === 0 ? (
            <EmptyState
              icon={Prohibit}
              title="No one blocked"
              description="People you block from message threads will appear here."
            />
          ) : (
            <ul className="divide-y divide-semantic-border-default">
              {rows.map((row) => (
                <li key={row.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <UserIdentity
                    name={row.profile?.full_name ?? '[deleted user]'}
                    avatarUrl={row.profile?.avatar_url}
                    country={row.profile?.country}
                  />
                  <UnblockButton targetId={row.id} />
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

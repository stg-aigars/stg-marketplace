'use client';

import { useEffect, useState } from 'react';
import { BackLink, Card, CardBody, CardFooter, CardHeader, UserIdentity } from '@/components/ui';
import { markThreadRead } from '@/lib/messaging/actions';
import { MessageBubble } from './MessageBubble';
import { Composer } from './Composer';
import { ThreadMenu } from './ThreadMenu';

interface Counterparty {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  country: string | null;
}

interface ListingChip {
  id: string;
  game_name: string;
  price_cents: number;
  primary_photo_url: string | null;
}

interface ThreadMessage {
  id: string;
  sender_id: string | null;
  body: string;
  listing_ref_id: string | null;
  created_at: string;
}

interface ThreadViewProps {
  threadId: string;
  currentUserId: string;
  counterparty: Counterparty | null;
  composerDisabled: boolean;
  composerDisabledReason: string | null;
  messages: ThreadMessage[];
  listingMap: Record<string, ListingChip>;
}

export function ThreadView({
  threadId,
  currentUserId,
  counterparty,
  composerDisabled,
  composerDisabledReason,
  messages,
  listingMap,
}: ThreadViewProps) {
  const [pendingMessages, setPendingMessages] = useState<ThreadMessage[]>([]);

  // Bump last_read_at when the tab regains focus (covers long-open conversations).
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === 'visible') {
        void markThreadRead(threadId);
      }
    }
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [threadId]);

  const counterpartyName = counterparty?.full_name ?? '[deleted user]';

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
      <div className="mb-4">
        <BackLink href="/account/messages" label="All messages" />
      </div>

      <Card>
        <CardHeader className="flex items-center justify-between gap-3">
          <UserIdentity
            name={counterpartyName}
            avatarUrl={counterparty?.avatar_url}
            country={counterparty?.country}
            size="md"
            href={counterparty ? `/sellers/${counterparty.id}` : undefined}
          />
          {counterparty && (
            <ThreadMenu counterpartyId={counterparty.id} counterpartyName={counterpartyName} />
          )}
        </CardHeader>

        <CardBody className="min-h-[200px]">
          {messages.length === 0 && pendingMessages.length === 0 ? (
            <p className="text-sm text-semantic-text-muted text-center py-8">
              No messages in this conversation yet.
            </p>
          ) : (
            <ol className="flex flex-col gap-3">
              {[...messages, ...pendingMessages].map((m) => (
                <MessageBubble
                  key={m.id}
                  body={m.body}
                  createdAt={m.created_at}
                  isOwnMessage={m.sender_id === currentUserId}
                  listingChip={m.listing_ref_id ? (listingMap[m.listing_ref_id] ?? null) : null}
                />
              ))}
            </ol>
          )}
        </CardBody>

        <CardFooter>
          <Composer
            threadId={threadId}
            disabled={composerDisabled}
            disabledReason={composerDisabledReason}
            onOptimisticSend={(body) => {
              const now = new Date().toISOString();
              const id = `pending-${now}-${Math.random().toString(36).slice(2, 8)}`;
              setPendingMessages((prev) => [
                ...prev,
                {
                  id,
                  sender_id: currentUserId,
                  body,
                  listing_ref_id: null,
                  created_at: now,
                },
              ]);
              return id;
            }}
            onOptimisticRollback={(id) => {
              setPendingMessages((prev) => prev.filter((m) => m.id !== id));
            }}
          />
        </CardFooter>
      </Card>
    </div>
  );
}

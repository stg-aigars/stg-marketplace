import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireServerAuth } from '@/lib/auth/helpers';
import { getConversation, getMessages, markConversationRead } from '@/lib/messages/actions';
import { ConversationView } from '@/components/messages/ConversationView';

export const metadata: Metadata = {
  title: 'Conversation',
};

export default async function ConversationPage({
  params: { conversationId },
}: {
  params: { conversationId: string };
}) {
  const { user } = await requireServerAuth();

  const [conversation, messages] = await Promise.all([
    getConversation(conversationId),
    getMessages(conversationId),
  ]);

  if (!conversation) {
    notFound();
  }

  // Mark as read on load
  await markConversationRead(conversationId);

  return (
    <div className="max-w-4xl mx-auto px-0 sm:px-6 py-0 sm:py-6">
      {/* Back button — mobile only */}
      <div className="sm:hidden px-4 py-2 border-b border-semantic-border-subtle">
        <Link
          href="/messages"
          className="inline-flex items-center gap-1 text-sm text-semantic-text-secondary min-h-[44px]"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Messages
        </Link>
      </div>

      <div className="border-0 sm:border border-semantic-border-subtle sm:rounded-lg overflow-hidden bg-semantic-bg-elevated h-[calc(100vh-8rem)] sm:h-[calc(100vh-12rem)]">
        <ConversationView
          conversation={conversation}
          initialMessages={messages}
          currentUserId={user.id}
        />
      </div>
    </div>
  );
}

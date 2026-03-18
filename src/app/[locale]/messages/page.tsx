import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireServerAuth } from '@/lib/auth/helpers';
import { getConversations, findConversation } from '@/lib/messages/actions';
import { ConversationList } from '@/components/messages/ConversationList';

export const metadata: Metadata = {
  title: 'Messages',
  description: 'Your conversations about board game listings.',
};

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: { listing?: string };
}) {
  await requireServerAuth();

  // If opened via "Message seller" with ?listing=<id>, find or redirect to start conversation
  if (searchParams.listing) {
    const existingId = await findConversation(searchParams.listing);
    if (existingId) {
      redirect(`/messages/${existingId}`);
    }
    // No existing conversation — show the inbox with the listing param
    // The user will start a new conversation from the NewConversationPrompt
  }

  const conversations = await getConversations();

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
      <h1 className="text-2xl sm:text-3xl font-bold text-semantic-text-heading mb-6">
        Messages
      </h1>

      {searchParams.listing && (
        <NewConversationPrompt listingId={searchParams.listing} />
      )}

      <div className="border border-semantic-border-subtle rounded-lg overflow-hidden bg-semantic-bg-elevated">
        <ConversationList conversations={conversations} />
      </div>
    </div>
  );
}

// Client component for starting a new conversation
import { StartConversationForm } from './StartConversationForm';

function NewConversationPrompt({ listingId }: { listingId: string }) {
  return (
    <div className="mb-6 border border-semantic-border-subtle rounded-lg p-4 bg-semantic-bg-elevated">
      <p className="text-sm font-medium text-semantic-text-heading mb-3">
        Send a message to the seller
      </p>
      <StartConversationForm listingId={listingId} />
    </div>
  );
}

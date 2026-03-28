'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Package } from '@phosphor-icons/react/ssr';
import { sendMessage, getMessages, markConversationRead } from '@/lib/messages/actions';
import { formatCentsToCurrency } from '@/lib/services/pricing';
import { MessageBubble } from './MessageBubble';
import { MessageInput } from './MessageInput';
import type { Message, Conversation } from '@/lib/messages/types';

const POLL_INTERVAL = 30_000; // 30 seconds

interface ConversationViewProps {
  conversation: Conversation;
  initialMessages: Message[];
  currentUserId: string;
}

function ConversationView({ conversation, initialMessages, currentUserId }: ConversationViewProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom on new messages
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages.length, scrollToBottom]);

  // Mark messages as read on mount
  useEffect(() => {
    markConversationRead(conversation.id);
  }, [conversation.id]);

  // Poll for new messages
  useEffect(() => {
    const interval = setInterval(async () => {
      const lastMessage = messages[messages.length - 1];
      if (!lastMessage) return;

      const newMessages = await getMessages(conversation.id, lastMessage.created_at);
      if (newMessages.length > 0) {
        setMessages((prev) => {
          const existingIds = new Set(prev.map((m) => m.id));
          const unique = newMessages.filter((m) => !existingIds.has(m.id));
          return unique.length > 0 ? [...prev, ...unique] : prev;
        });
        markConversationRead(conversation.id);
      }
    }, POLL_INTERVAL);

    return () => clearInterval(interval);
  }, [conversation.id, messages]);

  const handleSend = useCallback(
    async (content: string) => {
      // Optimistic append
      const optimisticMsg: Message = {
        id: `temp-${Date.now()}`,
        conversation_id: conversation.id,
        sender_id: currentUserId,
        content,
        read_at: null,
        created_at: new Date().toISOString(),
        sender_name: 'You',
      };
      setMessages((prev) => [...prev, optimisticMsg]);

      const result = await sendMessage(conversation.id, content);
      if ('error' in result) {
        // Rollback
        setMessages((prev) => prev.filter((m) => m.id !== optimisticMsg.id));
      }
    },
    [conversation.id, currentUserId]
  );

  return (
    <div className="flex flex-col h-full">
      {/* Listing mini-card header */}
      <div className="shrink-0 px-4 py-3 border-b border-semantic-border-subtle bg-semantic-bg-elevated">
        <Link
          href={`/listings/${conversation.listing_id}`}
          className="flex items-center gap-3 hover:opacity-80 transition-opacity duration-250 ease-out-custom"
        >
          <div className="w-10 h-10 rounded-lg bg-semantic-bg-secondary flex items-center justify-center overflow-hidden shrink-0 relative">
            {conversation.listing_thumbnail ? (
              <Image
                src={conversation.listing_thumbnail}
                alt={conversation.listing_title ?? ''}
                fill
                className="object-cover"
                sizes="40px"
                unoptimized={conversation.listing_thumbnail?.includes('cf.geekdo-images.com')}
              />
            ) : (
              <Package size={20} className="text-semantic-text-muted" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-semantic-text-heading truncate">
              {conversation.listing_title}
            </p>
            <div className="flex items-center gap-2">
              {conversation.listing_price_cents && (
                <p className="text-xs font-bold text-semantic-text-secondary">
                  {formatCentsToCurrency(conversation.listing_price_cents)}
                </p>
              )}
              <p className="text-xs text-semantic-text-muted">
                with {conversation.other_user_name}
              </p>
            </div>
          </div>
        </Link>
      </div>

      {/* Messages */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-3"
      >
        {messages.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-semantic-text-muted">
              No messages yet. Start the conversation.
            </p>
          </div>
        ) : (
          messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              content={msg.content}
              senderName={msg.sender_name ?? 'Unknown'}
              createdAt={msg.created_at}
              isOwn={msg.sender_id === currentUserId}
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="shrink-0">
        <MessageInput onSend={handleSend} />
      </div>
    </div>
  );
}

export { ConversationView };

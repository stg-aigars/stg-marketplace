/**
 * Message Digest — Buyer/Seller
 * Bundled unread messages from a single conversation, sent every 5 min by cron
 * when at least one message in the thread has sat unread for 15+ minutes.
 * Subject set by the cron route, not the template.
 */

import { Link, Text } from '@react-email/components';
import * as React from 'react';
import { EmailLayout, theme, templateStyles } from './layout';

interface DigestMessage {
  body: string;
  listingGameName?: string;
  createdAt: string;
}

interface MessageDigestProps {
  recipientName: string;
  senderName: string;
  threadDeepLink: string;
  messages: DigestMessage[];
}

export function MessageDigest({
  recipientName,
  senderName,
  threadDeepLink,
  messages,
}: MessageDigestProps) {
  const count = messages.length;
  const preview =
    count === 1
      ? `${senderName} sent you a message`
      : `${senderName} sent you ${count} messages`;

  return (
    <EmailLayout preview={preview}>
      <Text style={templateStyles.greeting}>Hi {recipientName},</Text>

      <Text style={templateStyles.body}>
        {count === 1 ? (
          <>
            <strong>{senderName}</strong> sent you a message.
          </>
        ) : (
          <>
            <strong>{senderName}</strong> sent you {count} messages.
          </>
        )}
      </Text>

      <div style={styles.messageList}>
        {messages.map((m, idx) => (
          <div key={idx} style={styles.messageBlock}>
            {m.listingGameName && (
              <Text style={styles.listingRef}>About: {m.listingGameName}</Text>
            )}
            <Text style={styles.messageBody}>{truncate(m.body, 200)}</Text>
          </div>
        ))}
      </div>

      <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} border={0}>
        <tbody>
          <tr>
            <td style={templateStyles.ctaSection}>
              <Link href={threadDeepLink} style={templateStyles.ctaFrost}>
                {count === 1 ? 'View conversation' : 'View all messages'}
              </Link>
            </td>
          </tr>
        </tbody>
      </table>

      <Text style={templateStyles.note}>
        Reply in the app to continue the conversation with {senderName}.
      </Text>
    </EmailLayout>
  );
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trimEnd() + '…';
}

const styles = {
  messageList: {
    margin: '0 0 24px',
  },
  messageBlock: {
    backgroundColor: theme.bgElevated,
    borderRadius: '6px',
    padding: '12px 16px',
    margin: '0 0 8px',
  },
  listingRef: {
    color: theme.textMuted,
    fontSize: '12px',
    fontWeight: '500' as const,
    margin: '0 0 4px',
  },
  messageBody: {
    color: theme.textPrimary,
    fontSize: '14px',
    lineHeight: '22px',
    margin: '0',
    whiteSpace: 'pre-wrap' as const,
  },
} as const;

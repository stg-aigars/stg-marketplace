import { Link, Text } from '@react-email/components';
import * as React from 'react';
import { EmailLayout, theme, templateStyles } from './layout';

interface NewMessageProps {
  recipientName: string;
  senderName: string;
  gameTitle: string;
  messagePreview: string;
  conversationUrl: string;
}

export function NewMessage({
  recipientName,
  senderName,
  gameTitle,
  messagePreview,
  conversationUrl,
}: NewMessageProps) {
  return (
    <EmailLayout preview={`${senderName} sent you a message about ${gameTitle}`}>
      <Text style={templateStyles.greeting}>Hi {recipientName},</Text>

      <Text style={templateStyles.body}>
        <strong>{senderName}</strong> sent you a message about <strong>{gameTitle}</strong>:
      </Text>

      <table
        role="presentation"
        width="100%"
        cellPadding={0}
        cellSpacing={0}
        border={0}
        style={{ margin: '0 0 24px' }}
      >
        <tbody>
          <tr>
            <td style={styles.messageCard}>
              <Text style={styles.messageText}>
                &ldquo;{messagePreview}&rdquo;
              </Text>
            </td>
          </tr>
        </tbody>
      </table>

      <table
        role="presentation"
        width="100%"
        cellPadding={0}
        cellSpacing={0}
        border={0}
      >
        <tbody>
          <tr>
            <td style={templateStyles.ctaSection}>
              <Link href={conversationUrl} style={templateStyles.ctaFrost}>
                Reply to message
              </Link>
            </td>
          </tr>
        </tbody>
      </table>

      <Text style={templateStyles.note}>
        You can reply directly on the platform to keep your conversation in one place.
      </Text>
    </EmailLayout>
  );
}

const styles = {
  messageCard: {
    backgroundColor: theme.bgElevated,
    borderRadius: '8px',
    padding: '16px 20px',
    borderLeft: `3px solid ${theme.frost}`,
  },
  messageText: {
    color: theme.textSecondary,
    fontSize: '14px',
    lineHeight: '22px',
    fontStyle: 'italic' as const,
    margin: '0',
  },
} as const;

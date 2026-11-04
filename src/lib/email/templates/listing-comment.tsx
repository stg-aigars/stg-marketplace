/**
 * Listing comment emails
 * - CommentReceivedSeller: sent immediately when someone comments on a seller's listing.
 * - CommentReplyReceived: sent immediately to previous commenters when the seller replies.
 */

import { Link, Text } from '@react-email/components';
import * as React from 'react';
import { EmailLayout, theme, templateStyles } from './layout';

interface ListingCommentEmailProps {
  recipientName: string;
  authorName: string;
  gameName: string;
  listingId: string;
  commentBody: string;
  appUrl: string;
}

export function CommentReceivedSeller({
  recipientName,
  authorName,
  gameName,
  listingId,
  commentBody,
  appUrl,
}: ListingCommentEmailProps) {
  return (
    <ListingCommentEmail
      preview={`${authorName} commented on your ${gameName} listing`}
      recipientName={recipientName}
      intro={
        <>
          <strong>{authorName}</strong> left a comment on your listing for <strong>{gameName}</strong>.
        </>
      }
      commentBody={commentBody}
      listingUrl={`${appUrl}/listings/${listingId}#comments`}
      note="Reply on the listing page. Comments are public, so your answer helps other buyers too."
    />
  );
}

export function CommentReplyReceived({
  recipientName,
  authorName,
  gameName,
  listingId,
  commentBody,
  appUrl,
}: ListingCommentEmailProps) {
  return (
    <ListingCommentEmail
      preview={`${authorName} replied on ${gameName}`}
      recipientName={recipientName}
      intro={
        <>
          <strong>{authorName}</strong>, the seller of <strong>{gameName}</strong>, replied to the comments
          on their listing.
        </>
      }
      commentBody={commentBody}
      listingUrl={`${appUrl}/listings/${listingId}#comments`}
      note="You're getting this because you commented on this listing."
    />
  );
}

function ListingCommentEmail({
  preview,
  recipientName,
  intro,
  commentBody,
  listingUrl,
  note,
}: {
  preview: string;
  recipientName: string;
  intro: React.ReactNode;
  commentBody: string;
  listingUrl: string;
  note: string;
}) {
  return (
    <EmailLayout preview={preview}>
      <Text style={templateStyles.greeting}>Hi {recipientName},</Text>

      <Text style={templateStyles.body}>{intro}</Text>

      <div style={styles.commentBlock}>
        <Text style={styles.commentBody}>{truncate(commentBody, 200)}</Text>
      </div>

      <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} border={0}>
        <tbody>
          <tr>
            <td style={templateStyles.ctaSection}>
              <Link href={listingUrl} style={templateStyles.ctaFrost}>
                View listing
              </Link>
            </td>
          </tr>
        </tbody>
      </table>

      <Text style={templateStyles.note}>{note}</Text>
    </EmailLayout>
  );
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trimEnd() + '…';
}

const styles = {
  commentBlock: {
    backgroundColor: theme.bgElevated,
    borderRadius: '6px',
    padding: '12px 16px',
    margin: '0 0 24px',
  },
  commentBody: {
    color: theme.textPrimary,
    fontSize: '14px',
    lineHeight: '22px',
    margin: '0',
    whiteSpace: 'pre-wrap' as const,
  },
} as const;

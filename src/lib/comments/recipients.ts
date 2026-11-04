/**
 * Pure recipient selection for listing-comment notifications.
 * Kept free of I/O so the dedup rules are unit-testable.
 */

export interface CommentAuthorRow {
  user_id: string | null;
  created_at: string;
}

export interface NotificationRecipientRow {
  user_id: string | null;
  created_at: string;
}

/**
 * Who should hear about a seller's reply on their listing.
 *
 * Returns each previous commenter whose latest comment is newer than the
 * latest `comment.received` notification they got for this listing. This
 * collapses consecutive seller replies into one notification per "round"
 * of questions, and re-includes a commenter once they post again.
 *
 * Callers pass comments that already exclude the seller and deleted rows.
 * Input order doesn't matter; ISO-8601 timestamps compare lexically.
 */
export function selectReplyRecipients(
  previousComments: CommentAuthorRow[],
  existingNotifications: NotificationRecipientRow[],
): string[] {
  const lastCommentByUser = new Map<string, string>();
  for (const c of previousComments) {
    if (!c.user_id) continue;
    const prev = lastCommentByUser.get(c.user_id);
    if (!prev || c.created_at > prev) lastCommentByUser.set(c.user_id, c.created_at);
  }

  const lastNotifByUser = new Map<string, string>();
  for (const n of existingNotifications) {
    if (!n.user_id) continue;
    const prev = lastNotifByUser.get(n.user_id);
    if (!prev || n.created_at > prev) lastNotifByUser.set(n.user_id, n.created_at);
  }

  return [...lastCommentByUser.entries()]
    .filter(([uid, lastComment]) => {
      const lastNotif = lastNotifByUser.get(uid);
      return !lastNotif || lastComment > lastNotif;
    })
    .map(([uid]) => uid);
}

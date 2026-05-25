/**
 * Message digest cron endpoint.
 * Bundles unread+unsent messages per (recipient, thread) and sends an email
 * when at least one message in that thread has sat unread for 15+ minutes.
 *
 * Two-pass eligibility (per design doc §2):
 *   Pass 1: identify threads with at least one unread message ≥15min old
 *   Pass 2: bundle ALL unread+unsent messages in those threads, regardless of age
 *           (prevents the per-message-drip failure)
 *
 * Per-bundle commit semantics — UPDATE email_sent_at fires per group on success,
 * not at end of run, so a late-stage failure doesn't roll back successful bundles.
 *
 * Coolify cron (5-min cadence):
 *   curl -s -X POST -H "Authorization: Bearer ${CRON_SECRET}" http://localhost:3000/api/cron/message-digest
 */

import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { createServiceClient } from '@/lib/supabase';
import { env } from '@/lib/env';
import { sendEmail } from '@/lib/email/service';
import { MessageDigest } from '@/lib/email/templates/message-digest';

const ELIGIBILITY_WINDOW_MINUTES = 15;
const MAX_ATTEMPTS = 10;
const SENTRY_WARNING_THRESHOLD = 5;

interface MessageRow {
  id: string;
  thread_id: string;
  sender_id: string | null;
  body: string;
  listing_ref_id: string | null;
  created_at: string;
  email_send_attempts: number;
}

interface ThreadRow {
  id: string;
  user_a_id: string | null;
  user_b_id: string | null;
  user_a_last_read_at: string | null;
  user_b_last_read_at: string | null;
}

interface Bundle {
  recipientId: string;
  threadId: string;
  messages: MessageRow[];
}

export async function POST(request: Request) {
  if (request.headers.get('authorization') !== `Bearer ${env.cron.secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();
  const now = new Date();
  const eligibilityCutoff = new Date(now.getTime() - ELIGIBILITY_WINDOW_MINUTES * 60_000);

  // Pass 1: load all candidate messages with their thread context.
  // The JS-side filter applies: ghost-thread exclusion, recipient hasn't read,
  // and per-thread "≥1 message ≥15min old" eligibility.
  const { data: candidatesRaw, error: queryError } = await supabase
    .from('messages')
    .select(`
      id, thread_id, sender_id, body, listing_ref_id, created_at, email_send_attempts,
      message_threads!inner ( id, user_a_id, user_b_id, user_a_last_read_at, user_b_last_read_at )
    `)
    .is('email_sent_at', null)
    .lt('email_send_attempts', MAX_ATTEMPTS);

  if (queryError) {
    console.error('[Cron] message-digest query failed:', queryError);
    return NextResponse.json({ error: 'Query failed' }, { status: 500 });
  }

  type CandidateRow = MessageRow & { message_threads: ThreadRow | ThreadRow[] };
  const candidates = (candidatesRaw ?? []) as CandidateRow[];

  // Group by thread_id, capture thread context once per thread.
  const threadGroups = new Map<string, { thread: ThreadRow; messages: MessageRow[] }>();
  for (const row of candidates) {
    // PostgREST returns the joined row as an object when the relationship is 1:1
    // via FK; we coerce to single safely.
    const thread = Array.isArray(row.message_threads) ? row.message_threads[0] : row.message_threads;
    if (!thread) continue;
    // Ghost-thread exclusion (defense-in-depth alongside the RLS predicate).
    if (!thread.user_a_id || !thread.user_b_id) continue;

    // Recipient-unread predicate.
    const recipientLastRead =
      row.sender_id === thread.user_a_id
        ? thread.user_b_last_read_at
        : thread.user_a_last_read_at;
    const isUnread = !recipientLastRead || new Date(recipientLastRead) < new Date(row.created_at);
    if (!isUnread) continue;

    const existing = threadGroups.get(row.thread_id);
    if (existing) {
      existing.messages.push(row);
    } else {
      threadGroups.set(row.thread_id, { thread, messages: [row] });
    }
  }

  // Build bundles: for each thread, check that AT LEAST ONE message is ≥15min old
  // (drip-pause protection). Recipient is the participant who didn't send each message —
  // but inside a single thread group, all unread messages are from the same sender,
  // so the recipient is constant per thread.
  const bundles: Bundle[] = [];
  for (const [threadId, group] of threadGroups) {
    const hasEligibleMessage = group.messages.some(
      (m) => new Date(m.created_at) < eligibilityCutoff,
    );
    if (!hasEligibleMessage) continue;

    // Recipient = whichever participant isn't the sender of these messages.
    const senderId = group.messages[0].sender_id;
    if (!senderId) continue;
    const recipientId =
      senderId === group.thread.user_a_id ? group.thread.user_b_id : group.thread.user_a_id;
    if (!recipientId) continue;

    // Order messages by created_at for stable display.
    group.messages.sort((a, b) => a.created_at.localeCompare(b.created_at));

    bundles.push({ recipientId, threadId, messages: group.messages });
  }

  if (bundles.length === 0) {
    return NextResponse.json({ processed: 0, sent: 0, failed: 0 });
  }

  // Batch-resolve recipient profiles, sender names, listing names — one query per dimension.
  const recipientIds = Array.from(new Set(bundles.map((b) => b.recipientId)));
  const senderIds = Array.from(
    new Set(bundles.map((b) => b.messages[0].sender_id).filter((id): id is string => !!id)),
  );
  const listingIds = Array.from(
    new Set(
      bundles
        .flatMap((b) => b.messages.map((m) => m.listing_ref_id))
        .filter((id): id is string => !!id),
    ),
  );

  const [recipientsRes, sendersRes, listingsRes] = await Promise.all([
    supabase
      .from('user_profiles')
      .select('id, full_name, email')
      .in('id', recipientIds),
    supabase
      .from('user_profiles')
      .select('id, full_name')
      .in('id', senderIds),
    listingIds.length > 0
      ? supabase.from('listings').select('id, game_name').in('id', listingIds)
      : Promise.resolve({ data: [] as { id: string; game_name: string }[], error: null }),
  ]);

  const recipientMap = new Map<string, { full_name: string | null; email: string | null }>();
  (recipientsRes.data ?? []).forEach((r) =>
    recipientMap.set(r.id, { full_name: r.full_name, email: r.email }),
  );
  const senderMap = new Map<string, string>();
  (sendersRes.data ?? []).forEach((s) => senderMap.set(s.id, s.full_name ?? 'A buyer or seller'));
  const listingMap = new Map<string, string>();
  (listingsRes.data ?? []).forEach((l) => listingMap.set(l.id, l.game_name));

  let sent = 0;
  let failed = 0;
  let highestAttemptsSeen = 0;

  for (const bundle of bundles) {
    const recipient = recipientMap.get(bundle.recipientId);
    if (!recipient?.email) {
      // Skip silently — recipient profile gone or no email. Don't bump attempts
      // (this isn't a Resend failure; the digest just can't be addressed).
      continue;
    }
    const senderName = senderMap.get(bundle.messages[0].sender_id!) ?? 'A buyer or seller';
    const count = bundle.messages.length;

    const subject =
      count === 1
        ? `${senderName} sent you a message`
        : `${senderName} sent you ${count} messages`;

    const threadDeepLink = `${env.app.url}/account/messages/${bundle.threadId}`;

    const messageIds = bundle.messages.map((m) => m.id);

    try {
      const result = await sendEmail({
        to: recipient.email,
        subject,
        react: MessageDigest({
          recipientName: recipient.full_name ?? 'there',
          senderName,
          threadDeepLink,
          messages: bundle.messages.map((m) => ({
            body: m.body,
            listingGameName: m.listing_ref_id
              ? (listingMap.get(m.listing_ref_id) ?? undefined)
              : undefined,
            createdAt: m.created_at,
          })),
        }),
      });

      if (result) {
        await supabase
          .from('messages')
          .update({ email_sent_at: new Date().toISOString() })
          .in('id', messageIds);
        sent += 1;
      } else {
        // sendEmail returned null — either bounced recipient or Resend error.
        // Either way, bump attempts so we eventually give up rather than retrying forever.
        await supabase
          .from('messages')
          .update({ email_send_attempts: bundle.messages[0].email_send_attempts + 1 })
          .in('id', messageIds);
        failed += 1;
        highestAttemptsSeen = Math.max(
          highestAttemptsSeen,
          bundle.messages[0].email_send_attempts + 1,
        );
      }
    } catch (err) {
      console.error('[Cron] message-digest bundle send failed:', err);
      await supabase
        .from('messages')
        .update({ email_send_attempts: bundle.messages[0].email_send_attempts + 1 })
        .in('id', messageIds);
      failed += 1;
      highestAttemptsSeen = Math.max(
        highestAttemptsSeen,
        bundle.messages[0].email_send_attempts + 1,
      );
    }
  }

  // Mid-budget early warning: if any bundle has now reached ≥5 attempts, surface
  // it to Sentry so we can intervene before the 10-attempt ceiling drops the email.
  if (highestAttemptsSeen >= SENTRY_WARNING_THRESHOLD) {
    Sentry.captureMessage('Message digest delivery is failing — investigate Resend', {
      level: 'warning',
      tags: { cron: 'message-digest' },
      extra: { highestAttemptsSeen, failedBundles: failed, sentBundles: sent },
    });
  }

  return NextResponse.json({ processed: bundles.length, sent, failed });
}

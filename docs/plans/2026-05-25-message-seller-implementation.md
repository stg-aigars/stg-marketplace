# Message Seller Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ship private 1:1 buyer↔seller messaging (per [2026-05-25-message-seller-design.md](2026-05-25-message-seller-design.md)) as a single PR on branch `feature/message-seller`.

**Architecture:** Two new tables (`message_threads`, `messages`) + block list table + `user_profiles.messaging_enabled` flag. Atomic `send_first_message` PL/pgSQL RPC owns new-thread security predicates. `messages` INSERT trigger atomically updates thread metadata + sender's read-state. Full-page inbox UI at `/account/messages`. In-app notification immediate; email digest cron at 5-min cadence with thread-level bundling. No new audit events; analytics via existing `trackServer`. Consumes existing `Textarea` design-system component (verified at write time).

**Tech Stack:** Next.js 16 (App Router), Supabase Postgres + RLS, PL/pgSQL RPC, Vitest + RTL, Resend, PostHog, Tailwind tokens.

**Out of scope (deferred — see design doc §"Deferred"):** email-notification opt-out, ghost-thread cleanup cron, attempts-stuck triage, block-from-profile, locale resolution for digest, retrofit of comment/order-message composers, app-level staff thread viewer, block/opt-out/unblock analytics events, notification collapse-by-thread.

**Resolved open questions** (from design doc):
1. Migrations: **117** (tables/columns/indexes) + **118** (RLS/RPC/trigger).
2. Tests: unit tests under `pnpm verify`; three RLS scenarios via written manual verification checklist (no integration harness added).
3. Rollout: direct ship after `pnpm verify`; operator registers cron in Coolify 24-48h after merge (asymmetric-risk gate).
4. `Textarea` already exists — no foundational PR, consume directly. Retrofit of `order_messages` composer remains deferred.

---

## Phase 1 — Migration 117: tables, columns, indexes

### Task 1: Create migration file shell

**Files:**
- Create: `supabase/migrations/117_message_seller_schema.sql`

**Step 1:** Write file header.

```sql
-- 117_message_seller_schema.sql
-- Private 1:1 messaging: tables, columns, indexes.
-- RLS, RPC, and trigger ship in 118.
-- Design: docs/plans/2026-05-25-message-seller-design.md
```

**Step 2:** Commit.

```bash
git add supabase/migrations/117_message_seller_schema.sql
git commit -m "chore(messaging): scaffold migration 117"
```

### Task 2: message_threads table

**Files:**
- Modify: `supabase/migrations/117_message_seller_schema.sql`

**Step 1:** Append the table definition.

```sql
CREATE TABLE public.message_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  user_b_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  last_message_at timestamptz NOT NULL,
  last_message_preview varchar(200) NOT NULL DEFAULT '',
  user_a_last_read_at timestamptz,
  user_b_last_read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT message_threads_canonical_order
    CHECK (user_a_id IS NULL OR user_b_id IS NULL OR user_a_id < user_b_id),
  CONSTRAINT message_threads_pair_unique
    UNIQUE (user_a_id, user_b_id)
);

CREATE INDEX idx_message_threads_user_a ON public.message_threads (user_a_id, last_message_at DESC);
CREATE INDEX idx_message_threads_user_b ON public.message_threads (user_b_id, last_message_at DESC);
```

**Step 2:** Commit.

```bash
git add supabase/migrations/117_message_seller_schema.sql
git commit -m "feat(messaging): add message_threads table"
```

### Task 3: messages table

**Step 1:** Append.

```sql
CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.message_threads(id) ON DELETE CASCADE,
  sender_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  body text NOT NULL,
  listing_ref_id uuid REFERENCES public.listings(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  email_sent_at timestamptz,
  email_send_attempts int NOT NULL DEFAULT 0,
  CONSTRAINT messages_body_length CHECK (length(body) BETWEEN 1 AND 2000)
);

CREATE INDEX idx_messages_thread ON public.messages (thread_id, created_at);
CREATE INDEX idx_messages_undelivered
  ON public.messages (created_at)
  WHERE email_sent_at IS NULL;
```

**Step 2:** Commit.

```bash
git commit -am "feat(messaging): add messages table + indexes"
```

### Task 4: message_blocks table

**Step 1:** Append.

```sql
CREATE TABLE public.message_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT message_blocks_unique UNIQUE (blocker_id, blocked_id),
  CONSTRAINT message_blocks_not_self CHECK (blocker_id <> blocked_id)
);

CREATE INDEX idx_message_blocks_blocker ON public.message_blocks (blocker_id);
CREATE INDEX idx_message_blocks_blocked ON public.message_blocks (blocked_id);
```

**Step 2:** Commit.

```bash
git commit -am "feat(messaging): add message_blocks table"
```

### Task 5: messaging_enabled column on user_profiles

**Step 1:** Append.

```sql
ALTER TABLE public.user_profiles
  ADD COLUMN messaging_enabled boolean NOT NULL DEFAULT true;
```

**Step 2:** Commit.

```bash
git commit -am "feat(messaging): add user_profiles.messaging_enabled"
```

### Task 6 (user-executed): Apply migration 117 locally

**Operator action:** Apply migration to local Supabase. Verify table shapes:

```bash
supabase db reset  # or supabase migration up, depending on local workflow
psql "$LOCAL_SUPABASE_URL" -c "\d public.message_threads"
psql "$LOCAL_SUPABASE_URL" -c "\d public.messages"
psql "$LOCAL_SUPABASE_URL" -c "\d public.message_blocks"
psql "$LOCAL_SUPABASE_URL" -c "SELECT column_name FROM information_schema.columns WHERE table_name='user_profiles' AND column_name='messaging_enabled'"
```

Expected: all three tables present with constraints; `messaging_enabled` column present with default `true`.

If the schema looks wrong, fix the migration (do NOT amend committed migrations — write a corrective migration if 117 has been pushed; if local-only, edit and reset).

---

## Phase 2 — Migration 118: trigger, RLS, RPC

### Task 7: Migration file shell

**Files:**
- Create: `supabase/migrations/118_message_seller_policies_and_rpc.sql`

**Step 1:** Write header.

```sql
-- 118_message_seller_policies_and_rpc.sql
-- Private 1:1 messaging: INSERT trigger, RLS policies, send_first_message RPC.
-- Pairs with 117.
```

**Step 2:** Commit.

```bash
git add supabase/migrations/118_message_seller_policies_and_rpc.sql
git commit -m "chore(messaging): scaffold migration 118"
```

### Task 8: on_message_insert trigger

**Step 1:** Append.

```sql
CREATE OR REPLACE FUNCTION public.on_message_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.message_threads
  SET last_message_at = NEW.created_at,
      last_message_preview = LEFT(NEW.body, 200),
      user_a_last_read_at = CASE WHEN user_a_id = NEW.sender_id THEN NEW.created_at ELSE user_a_last_read_at END,
      user_b_last_read_at = CASE WHEN user_b_id = NEW.sender_id THEN NEW.created_at ELSE user_b_last_read_at END
  WHERE id = NEW.thread_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_on_message_insert
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.on_message_insert();
```

**Step 2:** Commit.

```bash
git commit -am "feat(messaging): on_message_insert trigger updates thread metadata + sender read-state"
```

### Task 9: Enable RLS on all three tables

**Step 1:** Append.

```sql
ALTER TABLE public.message_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_blocks ENABLE ROW LEVEL SECURITY;
```

**Step 2:** Commit.

```bash
git commit -am "feat(messaging): enable RLS on messaging tables"
```

### Task 10: message_threads SELECT policy + user-update for last_read

**Step 1:** Append.

```sql
CREATE POLICY "Users see their own threads"
  ON public.message_threads
  FOR SELECT
  USING (auth.uid() IN (user_a_id, user_b_id));

-- Allow each side to update only their own last_read_at via markThreadRead server action.
CREATE POLICY "Users update their own last_read_at"
  ON public.message_threads
  FOR UPDATE
  USING (auth.uid() IN (user_a_id, user_b_id))
  WITH CHECK (auth.uid() IN (user_a_id, user_b_id));
```

**Step 2:** Commit.

```bash
git commit -am "feat(messaging): message_threads SELECT + UPDATE policies"
```

### Task 11: messages SELECT + INSERT policies

**Step 1:** Append.

```sql
CREATE POLICY "Users see messages in their threads"
  ON public.messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.message_threads t
      WHERE t.id = messages.thread_id
        AND auth.uid() IN (t.user_a_id, t.user_b_id)
    )
  );

CREATE POLICY "Users send messages into live threads with no block"
  ON public.messages
  FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM public.message_threads t
      WHERE t.id = messages.thread_id
        AND t.user_a_id IS NOT NULL
        AND t.user_b_id IS NOT NULL
        AND auth.uid() IN (t.user_a_id, t.user_b_id)
        AND NOT EXISTS (
          SELECT 1 FROM public.message_blocks b
          WHERE (b.blocker_id = t.user_a_id AND b.blocked_id = t.user_b_id)
             OR (b.blocker_id = t.user_b_id AND b.blocked_id = t.user_a_id)
        )
    )
    AND (
      listing_ref_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.listings l
        WHERE l.id = messages.listing_ref_id
          AND l.seller_id = (
            SELECT CASE WHEN user_a_id = sender_id THEN user_b_id ELSE user_a_id END
            FROM public.message_threads WHERE id = messages.thread_id
          )
      )
    )
  );
```

**Step 2:** Commit.

```bash
git commit -am "feat(messaging): messages SELECT + INSERT RLS policies"
```

### Task 12: message_blocks policies

**Step 1:** Append.

```sql
CREATE POLICY "Users manage their own blocks"
  ON public.message_blocks
  FOR ALL
  USING (auth.uid() = blocker_id)
  WITH CHECK (auth.uid() = blocker_id);
```

**Step 2:** Commit.

```bash
git commit -am "feat(messaging): message_blocks policy"
```

### Task 13: send_first_message RPC

**Step 1:** Append.

```sql
CREATE OR REPLACE FUNCTION public.send_first_message(
  p_other_user_id uuid,
  p_body text,
  p_listing_ref_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_sender uuid := auth.uid();
  v_user_a uuid;
  v_user_b uuid;
  v_thread_id uuid;
  v_message_id uuid;
  v_target_messaging_enabled boolean;
  v_blocked boolean;
  v_listing_seller uuid;
BEGIN
  IF v_sender IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthenticated');
  END IF;

  IF p_other_user_id = v_sender THEN
    RETURN jsonb_build_object('ok', false, 'error', 'self_target');
  END IF;

  IF p_body IS NULL OR length(p_body) < 1 OR length(p_body) > 2000 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_body');
  END IF;

  -- Validate other user exists
  PERFORM 1 FROM public.user_profiles WHERE id = p_other_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unknown_user');
  END IF;

  -- Validate listing_ref ownership if provided
  IF p_listing_ref_id IS NOT NULL THEN
    SELECT seller_id INTO v_listing_seller
    FROM public.listings WHERE id = p_listing_ref_id;
    IF v_listing_seller IS NULL OR v_listing_seller <> p_other_user_id THEN
      RETURN jsonb_build_object('ok', false, 'error', 'invalid_listing_ref');
    END IF;
  END IF;

  -- Canonical ordering
  IF v_sender < p_other_user_id THEN
    v_user_a := v_sender;
    v_user_b := p_other_user_id;
  ELSE
    v_user_a := p_other_user_id;
    v_user_b := v_sender;
  END IF;

  -- Block check (either direction)
  SELECT EXISTS (
    SELECT 1 FROM public.message_blocks
    WHERE (blocker_id = v_user_a AND blocked_id = v_user_b)
       OR (blocker_id = v_user_b AND blocked_id = v_user_a)
  ) INTO v_blocked;

  IF v_blocked THEN
    RETURN jsonb_build_object('ok', false, 'error', 'cannot_message_user');
  END IF;

  -- Try to create thread; on conflict, fetch existing
  INSERT INTO public.message_threads (user_a_id, user_b_id, last_message_at)
  VALUES (v_user_a, v_user_b, now())
  ON CONFLICT (user_a_id, user_b_id) DO NOTHING
  RETURNING id INTO v_thread_id;

  IF v_thread_id IS NULL THEN
    -- Race winner created the thread first; opt-out gate skipped (past it by definition)
    SELECT id INTO v_thread_id FROM public.message_threads
    WHERE user_a_id = v_user_a AND user_b_id = v_user_b;
  ELSE
    -- New thread path: check target's messaging_enabled
    SELECT messaging_enabled INTO v_target_messaging_enabled
    FROM public.user_profiles WHERE id = p_other_user_id;

    IF v_target_messaging_enabled = false THEN
      -- Roll back the thread insert
      DELETE FROM public.message_threads WHERE id = v_thread_id;
      RETURN jsonb_build_object('ok', false, 'error', 'cannot_message_user');
    END IF;
  END IF;

  -- Insert the message; trigger handles thread metadata
  INSERT INTO public.messages (thread_id, sender_id, body, listing_ref_id)
  VALUES (v_thread_id, v_sender, p_body, p_listing_ref_id)
  RETURNING id INTO v_message_id;

  RETURN jsonb_build_object(
    'ok', true,
    'thread_id', v_thread_id,
    'message_id', v_message_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.send_first_message TO authenticated;
```

**Step 2:** Commit.

```bash
git commit -am "feat(messaging): send_first_message RPC"
```

### Task 14 (user-executed): Apply migration 118 locally + smoke verify

**Operator action:**
```bash
supabase migration up   # or db reset
```

Smoke: in `psql` as an authenticated test user, try `SELECT public.send_first_message('<other_uuid>', 'hi', NULL)` and confirm it returns `{ok: true, thread_id, message_id}`. Confirm `SELECT * FROM message_threads WHERE id = '<returned_thread_id>'` shows `last_message_at` updated.

---

## Phase 3 — Module types + server actions

### Task 15: Types module

**Files:**
- Create: `src/lib/messaging/types.ts`

**Step 1:** Write.

```ts
export interface MessageThread {
  id: string;
  user_a_id: string | null;
  user_b_id: string | null;
  last_message_at: string;
  last_message_preview: string;
  user_a_last_read_at: string | null;
  user_b_last_read_at: string | null;
  created_at: string;
}

export interface Message {
  id: string;
  thread_id: string;
  sender_id: string | null;
  body: string;
  listing_ref_id: string | null;
  created_at: string;
}

export type MessagingError =
  | 'unauthenticated'
  | 'self_target'
  | 'invalid_body'
  | 'invalid_listing_ref'
  | 'cannot_message_user'
  | 'unknown_user';

export type SendFirstMessageResult =
  | { ok: true; thread_id: string; message_id: string }
  | { ok: false; error: MessagingError };

export const MESSAGE_MAX_LENGTH = 2000;
```

**Step 2:** Commit.

```bash
git add src/lib/messaging/types.ts
git commit -m "feat(messaging): types module"
```

### Task 16: findExistingThread server action

**Files:**
- Create: `src/lib/messaging/actions.ts`

**Step 1:** Write the action.

```ts
'use server';

import { createServerClient } from '@/lib/supabase/server';
import { requireServerAuth } from '@/lib/auth/require-server-auth';

export async function findExistingThread(otherUserId: string): Promise<{ threadId: string | null }> {
  const { user } = await requireServerAuth();
  const supabase = await createServerClient();
  const [a, b] = user.id < otherUserId ? [user.id, otherUserId] : [otherUserId, user.id];

  const { data } = await supabase
    .from('message_threads')
    .select('id')
    .eq('user_a_id', a)
    .eq('user_b_id', b)
    .maybeSingle();

  return { threadId: data?.id ?? null };
}
```

**Step 2:** Commit.

```bash
git add src/lib/messaging/actions.ts
git commit -m "feat(messaging): findExistingThread server action"
```

### Task 17: sendFirstMessage server-action wrapper around RPC

**Step 1:** Append to `src/lib/messaging/actions.ts`.

```ts
import type { SendFirstMessageResult } from './types';
import { notify } from '@/lib/notifications';
import { trackServer } from '@/lib/analytics/track-server';

export async function sendFirstMessage(args: {
  otherUserId: string;
  body: string;
  listingRefId?: string;
  entryPoint: 'listing_detail' | 'seller_profile';
}): Promise<SendFirstMessageResult> {
  await requireServerAuth();
  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc('send_first_message', {
    p_other_user_id: args.otherUserId,
    p_body: args.body,
    p_listing_ref_id: args.listingRefId ?? null,
  });

  if (error) {
    console.error('send_first_message RPC error', error);
    return { ok: false, error: 'cannot_message_user' };
  }

  const result = data as SendFirstMessageResult;
  if (!result.ok) return result;

  // Side effects (fire-and-forget per CLAUDE.md pattern)
  void notify(args.otherUserId, 'message.received', {
    threadId: result.thread_id,
    listingId: args.listingRefId,
  });
  void trackServer('message_thread_started', {
    thread_id: result.thread_id,
    entry_point: args.entryPoint,
    has_listing_ref: !!args.listingRefId,
  });
  void trackServer('message_sent', {
    thread_id: result.thread_id,
    is_first_message: true,
    has_listing_ref: !!args.listingRefId,
  });

  return result;
}
```

**Step 2:** Commit.

```bash
git commit -am "feat(messaging): sendFirstMessage wrapper with notify + analytics"
```

### Task 18: sendMessage (in-thread reply) server action

**Step 1:** Append.

```ts
export async function sendMessage(args: {
  threadId: string;
  body: string;
  listingRefId?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { user } = await requireServerAuth();
  const supabase = await createServerClient();

  if (args.body.length < 1 || args.body.length > 2000) {
    return { ok: false, error: 'invalid_body' };
  }

  const { data: thread } = await supabase
    .from('message_threads')
    .select('id, user_a_id, user_b_id')
    .eq('id', args.threadId)
    .maybeSingle();

  if (!thread) return { ok: false, error: 'thread_not_found' };
  const recipientId = thread.user_a_id === user.id ? thread.user_b_id : thread.user_a_id;
  if (!recipientId) return { ok: false, error: 'ghost_thread' };

  const { error } = await supabase
    .from('messages')
    .insert({ thread_id: args.threadId, sender_id: user.id, body: args.body, listing_ref_id: args.listingRefId ?? null });

  if (error) return { ok: false, error: 'send_failed' };

  void notify(recipientId, 'message.received', { threadId: args.threadId, listingId: args.listingRefId });
  void trackServer('message_sent', {
    thread_id: args.threadId,
    is_first_message: false,
    has_listing_ref: !!args.listingRefId,
  });

  return { ok: true };
}
```

**Step 2:** Commit.

```bash
git commit -am "feat(messaging): sendMessage in-thread reply"
```

### Task 19: markThreadRead, toggleMessagingEnabled, blockUser, unblockUser

**Step 1:** Append.

```ts
export async function markThreadRead(threadId: string) {
  const { user } = await requireServerAuth();
  const supabase = await createServerClient();
  const { data: thread } = await supabase
    .from('message_threads')
    .select('user_a_id, user_b_id')
    .eq('id', threadId).maybeSingle();
  if (!thread) return;
  const column = thread.user_a_id === user.id ? 'user_a_last_read_at' : 'user_b_last_read_at';
  await supabase.from('message_threads').update({ [column]: new Date().toISOString() }).eq('id', threadId);
}

export async function toggleMessagingEnabled(newValue: boolean) {
  const { user } = await requireServerAuth();
  const supabase = await createServerClient();
  await supabase.from('user_profiles').update({ messaging_enabled: newValue }).eq('id', user.id);
}

export async function blockUser(targetId: string) {
  const { user } = await requireServerAuth();
  const supabase = await createServerClient();
  await supabase.from('message_blocks').upsert({ blocker_id: user.id, blocked_id: targetId });
}

export async function unblockUser(targetId: string) {
  const { user } = await requireServerAuth();
  const supabase = await createServerClient();
  await supabase.from('message_blocks').delete()
    .eq('blocker_id', user.id).eq('blocked_id', targetId);
}
```

**Step 2:** Commit.

```bash
git commit -am "feat(messaging): markThreadRead + settings + block actions"
```

### Task 20: Unit tests for sendFirstMessage wrapper

**Files:**
- Create: `src/lib/messaging/actions.test.ts`

**Step 1:** Write failing tests covering: invalid_body short-circuit (must short-circuit BEFORE RPC call if we add client-side check; otherwise test the RPC error surfacing path), discriminator pass-through, notify + analytics fire on success.

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
// Mock createServerClient, requireServerAuth, notify, trackServer
// ... (full mock setup)

describe('sendFirstMessage', () => {
  beforeEach(() => vi.clearAllMocks());
  it('surfaces RPC self_target discriminator', async () => { /* ... */ });
  it('fires notify and analytics on success', async () => { /* ... */ });
  it('returns cannot_message_user on RPC supabase error', async () => { /* ... */ });
});
```

**Step 2:** Run: `pnpm test src/lib/messaging/actions.test.ts -- --run`
Expected: FAIL.

**Step 3:** Adjust action code as needed to make tests pass (mocks must match real call shapes).

**Step 4:** Run again. Expected: PASS.

**Step 5:** Commit.

```bash
git commit -am "test(messaging): unit tests for sendFirstMessage"
```

---

## Phase 4 — Notifications

### Task 21: Extend NotificationType + context

**Files:**
- Modify: `src/lib/notifications/types.ts`

**Step 1:** Add `'message.received'` to the `NotificationType` union. Ensure `NotificationContext` already carries `threadId?` and `listingId?` (likely needs `threadId?: string` added).

**Step 2:** Commit.

```bash
git commit -am "feat(messaging): NotificationType extends to message.received"
```

### Task 22: Add template entry

**Files:**
- Modify: `src/lib/notifications/templates.ts`

**Step 1:** Add entry to `NOTIFICATION_TEMPLATES`:

```ts
'message.received': {
  title: () => 'New message',
  body: (ctx) => ctx.gameName
    ? `About ${ctx.gameName}: ${ctx.senderName ?? 'Someone'} sent you a message.`
    : `${ctx.senderName ?? 'Someone'} sent you a message.`,
  link: (ctx) => ctx.threadId ? `/account/messages/${ctx.threadId}` : null,
},
```

**Step 2:** Verify `notify()` resolves `senderName` + `gameName` from context — if not, the caller in `sendMessage`/`sendFirstMessage` must pass them through. Confirm at call site by reading `src/lib/notifications/index.ts` and updating call signatures accordingly.

**Step 3:** Commit.

```bash
git commit -am "feat(messaging): notification template for message.received"
```

---

## Phase 5 — Analytics

### Task 23: Extend AnalyticsEventMap

**Files:**
- Modify: `src/lib/analytics/types.ts`

**Step 1:** Add to the map. **Comment** above the new entries documents the `is_first_message` semantics (both RPC branches → `true`; in-thread → `false`).

```ts
// Messaging — see docs/plans/2026-05-25-message-seller-design.md
// is_first_message semantics: send_first_message RPC fires `true` on BOTH create
// and on-conflict-existing branches (user intended a first message either way);
// sendMessage in-thread fires `false`.
message_thread_started: {
  thread_id: string;
  entry_point: 'listing_detail' | 'seller_profile';
  has_listing_ref: boolean;
};
message_sent: {
  thread_id: string;
  is_first_message: boolean;
  has_listing_ref: boolean;
};
```

**Step 2:** Commit.

```bash
git commit -am "feat(messaging): analytics event types"
```

---

## Phase 6 — UI surfaces

### Task 24: Inbox page route

**Files:**
- Create: `src/app/[locale]/account/messages/page.tsx`
- Create: `src/app/[locale]/account/messages/ThreadList.tsx`

**Step 1:** Server component loads threads via `select('id, user_a_id, user_b_id, last_message_at, last_message_preview, user_a_last_read_at, user_b_last_read_at')` from `message_threads`, ordered `last_message_at DESC`. For each row resolve counterparty user_profile (avatar_url, full_name, country) in a single follow-up query keyed by the union of counterparty ids.

**Step 2:** Render via `ThreadList` client component: rows show `Avatar`, `UserIdentity`, truncated `last_message_preview`, `formatMessageTime(last_message_at)`, `Badge dot` if unread.

**Step 3:** Empty state via existing `EmptyState`.

**Step 4:** Commit.

```bash
git commit -am "feat(messaging): inbox page"
```

### Task 25: Thread detail page

**Files:**
- Create: `src/app/[locale]/account/messages/[threadId]/page.tsx`
- Create: `src/app/[locale]/account/messages/[threadId]/ThreadView.tsx`
- Create: `src/app/[locale]/account/messages/[threadId]/MessageBubble.tsx`
- Create: `src/app/[locale]/account/messages/[threadId]/Composer.tsx`
- Create: `src/app/[locale]/account/messages/[threadId]/ListingChipInline.tsx`

**Step 1:** Server component checks viewer is a thread participant (`auth.uid() IN (user_a, user_b)`; RLS already enforces, but a 404 fallback if `data` is empty is cleaner). Loads messages (`select * from messages where thread_id = $1 order by created_at`). Calls `markThreadRead(threadId)` (fire-and-forget).

**Step 2:** Renders `ThreadView` (header: counterparty `UserIdentity` + three-dot menu) + `MessageBubble` list + `Composer` at bottom.

**Step 3:** `MessageBubble` renders bubble with sender-side alignment (right = current user, left = counterparty), `formatMessageTime` below. If `listing_ref_id` present, render `ListingChipInline` (compact `ListingIdentity` row) or "[removed listing]" if FK null.

**Step 4:** `Composer` is a client component: `Textarea` + optional listing-chip preview (removable X) + Send `Button variant="brand"`. Submits via `sendMessage` server action. Composer disables (replaces with neutral one-liner) when block exists OR ghost thread.

**Step 5:** Commit.

```bash
git commit -am "feat(messaging): thread detail page + composer"
```

### Task 26: First-message composer route (no existing thread)

**Files:**
- Create: `src/app/[locale]/account/messages/new/page.tsx`

**Step 1:** Server component reads `to` and `seedListingId` and `from` from search params. Loads counterparty profile + (if `seedListingId` present) the listing for chip preview. If a thread already exists between viewer and `to`, redirect to `/account/messages/[threadId]`.

**Step 2:** Renders composer (similar to in-thread but submits via `sendFirstMessage`). On success → redirect to `/account/messages/[returnedThreadId]`. On error → render the discriminator copy (i18n keys; generic for `cannot_message_user`).

**Step 3:** Commit.

```bash
git commit -am "feat(messaging): new-thread composer route"
```

### Task 27: Settings — messaging toggle

**Files:**
- Create: `src/app/[locale]/account/settings/messaging/page.tsx`

**Step 1:** Server component loads `user_profiles.messaging_enabled` for `auth.uid()`. Renders a `Card` with `Checkbox` "Allow people to send me messages." Help text per design doc. Submits via `toggleMessagingEnabled` server action.

**Step 2:** Commit.

```bash
git commit -am "feat(messaging): settings toggle page"
```

### Task 28: /account/blocked page

**Files:**
- Create: `src/app/[locale]/account/blocked/page.tsx`

**Step 1:** Server component loads `message_blocks WHERE blocker_id = auth.uid()` with profile join. Renders list of `UserIdentity` rows + Unblock `Button variant="ghost"` with `Modal` confirm. Empty state if no blocks.

**Step 2:** Commit.

```bash
git commit -am "feat(messaging): blocked users page"
```

---

## Phase 7 — Entry-point CTAs

### Task 29: SSR loader helper for CTA gating

**Files:**
- Create: `src/lib/messaging/cta-loader.ts`

**Step 1:** Export `canMessageSeller(viewerId: string | null, sellerId: string)` server helper:
- Returns `{ visible: false, reason: 'self' }` if viewer === seller
- Returns `{ visible: false, reason: 'unauthenticated' }` if viewer null (UI renders "Sign in to message" link)
- Loads `user_profiles.messaging_enabled` for sellerId and checks `message_blocks` in either direction in a single query
- Returns `{ visible: false, reason: 'unavailable' }` if either fails (covers opt-out + block; privacy)
- Returns `{ visible: true }` otherwise

**Step 2:** Commit.

```bash
git commit -am "feat(messaging): canMessageSeller CTA loader"
```

### Task 30: Listing detail CTA

**Files:**
- Modify: existing listing detail page (locate via `grep -rln "listing.game_name" src/app/`).

**Step 1:** Import `canMessageSeller`. Place CTA next to/after the existing buy CTA — `Button variant="secondary"` "Message seller", `asChild` wrapping a Link to `/account/messages/new?to={sellerId}&seedListingId={listingId}&from=listing_detail`. Render hidden-state one-liner otherwise.

**Step 2:** Inline comment near the new SSR query: "TODO: fold into seller-data SSR loader on this route — two extra queries per render; pre-launch volume acceptable."

**Step 3:** Manually verify in browser:
- Opted-in seller → CTA visible, click → composer page.
- Self-seller → CTA hidden.
- Set `messaging_enabled = false` via psql for seller → CTA hidden, one-liner shown.
- Insert block row in either direction → CTA hidden, one-liner shown.

**Step 4:** Commit.

```bash
git commit -am "feat(messaging): listing detail CTA"
```

### Task 31: Seller profile CTA

**Files:**
- Modify: seller profile page (locate via `find src/app -name "*.tsx" -path "*seller*"`).

**Step 1:** Same pattern as listing detail, no `seedListingId`. Link: `/account/messages/new?to={sellerId}&from=seller_profile`.

**Step 2:** Manual verify same scenarios.

**Step 3:** Commit.

```bash
git commit -am "feat(messaging): seller profile CTA"
```

---

## Phase 8 — Cron + email digest

### Task 32: Resend digest template

**Files:**
- Create: `src/lib/email/templates/message-digest.tsx`

**Step 1:** React-email template. Props: `{ recipientName, senderName, threadDeepLink, messages: { body: string; listingGameName?: string; createdAt: string }[] }`. Subject set via the cron route, not the template.

**Step 2:** Footer: standard SIA block (mirror existing transactional templates). No unsubscribe link in v1.

**Step 3:** Commit.

```bash
git add src/lib/email/templates/message-digest.tsx
git commit -m "feat(messaging): email digest template"
```

### Task 33: Cron route handler

**Files:**
- Create: `src/app/api/cron/message-digest/route.ts`

**Step 1:** POST handler with `Authorization: Bearer ${CRON_SECRET}` check (mirror an existing cron route).

**Step 2:** Pass 1: build `eligible_threads` CTE query. Pass 2: fetch all unread+unsent messages in those threads. Group by `(recipient_id, thread_id)`. For each group:
- Resolve recipient `email`, `full_name`, sender `full_name`, listing `gameName` (single join).
- Render template via `@react-email/render`.
- Send via shared Resend client (`@/lib/email/client`).
- On success: `UPDATE messages SET email_sent_at = NOW() WHERE id = ANY($bundle_ids)`.
- On failure: `UPDATE messages SET email_send_attempts = email_send_attempts + 1 WHERE id = ANY($bundle_ids)` + `Sentry.captureMessage(...)` at `attempts >= 5` warning level (mid-budget early warning).

**Step 3:** Return `{ processed: N, sent: M, failed: K }` JSON.

**Step 4:** Commit.

```bash
git commit -am "feat(messaging): message-digest cron route"
```

### Task 34: Unit test for cron route's grouping + per-bundle commit logic

**Files:**
- Create: `src/app/api/cron/message-digest/route.test.ts`

**Step 1:** Test the burst case (msg1@T=0, msg2@T=8, msg3@T=14, cron@T=15) via mocked Supabase query results — expect one Resend call with three messages bundled, not three.

**Step 2:** Test per-bundle commit: first bundle Resend success, second bundle Resend failure → first bundle's `email_sent_at` UPDATE fired before the failure; second bundle's `email_send_attempts` UPDATE fired.

**Step 3:** Run: `pnpm test src/app/api/cron/message-digest/route.test.ts -- --run`. Fix until PASS.

**Step 4:** Commit.

```bash
git commit -am "test(messaging): cron bundling + per-bundle commit"
```

---

## Phase 9 — Verify + ship

### Task 35: Brand-voice + humanizer pass on all copy

**Step 1:** Collect every user-facing string introduced in this PR (CTA text, hidden-state one-liner, empty inbox copy, settings help text, blocked-page copy, error discriminator copy, email subject/body, notification title/body). Run through `humanizer` skill.

**Step 2:** Verify friction-rule compliance (no wit on blocked/error paths). Reference `feedback_voice_board_gamey.md`.

**Step 3:** Commit any copy refinements.

```bash
git commit -am "docs(messaging): copy pass"
```

### Task 36: Email-compliance review pass

**Step 1:** Per `feedback_email_review_scope.md`: review digest email footer SIA block, GDPR posture (no PII beyond what recipient already sees), transactional purity (no marketing content), correct sender address.

**Step 2:** Fix anything that fails the review. Commit.

### Task 37: `pnpm verify` gate

**Step 1:** Run `pnpm verify`. Expected: PASS (type-check + lint + test + build).

**Step 2:** If any fail, fix root cause (do not bypass). Commit fixes.

### Task 38: Manual RLS verification checklist (run BEFORE pushing)

This is the pre-deploy gate per `verification-before-completion` discipline. Run against local Supabase with three test users (A, B, C).

**Scenario 1 — Block bidirectionality:**
1. A and B have an existing thread with messages.
2. A inserts a `message_blocks` row blocking B (via `/account/blocked` or psql).
3. Assert A's `sendMessage` into the thread → fails (RLS).
4. Assert B's `sendMessage` into the thread → fails (RLS).
5. Assert both A and B can still SELECT all messages in the transcript.
6. Assert A's `sendFirstMessage` to B (new thread attempt) → returns `cannot_message_user`.

**Scenario 2 — Ghost-thread INSERT denial:**
1. A and B have an existing thread.
2. Service-role SQL: `UPDATE message_threads SET user_a_id = NULL WHERE id = '<thread_id>'`.
3. Assert B's `sendMessage` into the thread → fails (RLS predicate `user_a_id IS NOT NULL AND user_b_id IS NOT NULL`).
4. Assert B can still SELECT the transcript.
5. Assert inbox UI for B renders the counterparty as "[deleted user]" with disabled composer.

**Scenario 3 — Opt-out scope:**
1. A and B have an existing thread.
2. B sets `messaging_enabled = false` via `/account/settings/messaging`.
3. Assert A's `sendMessage` into the existing thread → succeeds.
4. Assert B's `sendMessage` into the existing thread → succeeds (in-thread writes stay open both directions).
5. Assert C's `sendFirstMessage` to B (new thread) → returns `cannot_message_user`.
6. Assert listing-detail CTA on B's listing is hidden for C, with neutral one-liner shown.

Document outcomes in a brief markdown note (paste-and-commit or include in PR body).

**If any scenario fails:** stop, root-cause, fix, re-run all three scenarios from scratch. Do NOT proceed to push.

### Task 39 (user-executed): Push + open PR

**Operator action:**
```bash
git push -u origin feature/message-seller
gh pr create --title "feat(messaging): private 1:1 buyer↔seller messaging" --body "..."
```

PR body includes:
- Link to design doc
- The three RLS-checklist outcomes from Task 38
- Note: "Cron registration in Coolify deferred 24-48h post-merge per design doc §3."

### Task 40 (user-executed): Merge + register cron

**Operator action — after PR merges to main:**
1. Observe in-app messaging traffic for 24-48h via Supabase logs + PostHog dashboard. Confirm `message_thread_started` and `message_sent` fire as expected.
2. If clean: register cron in Coolify with command:
   ```
   curl -s -X POST -H "Authorization: Bearer ${CRON_SECRET}" http://localhost:3000/api/cron/message-digest
   ```
   Schedule: `*/5 * * * *` (every 5 minutes).
3. Update CLAUDE.md's "Existing cron routes" list to include `message-digest`.
4. Update CLAUDE.md notification-type count: 39 → 40.
5. Update CLAUDE.md Shared Components inventory if needed (Textarea already there).
6. Add deferred items 1-9 from design doc §"Deferred" to the appropriate memory note(s).

---

## Risks / things to watch during execution

1. **`canMessageSeller` query count on listing detail.** Two queries per render. If listing detail's existing seller-data loader can be folded, do it during code review pass — not as a blocker.
2. **`notify()` signature drift.** If the existing `notify()` doesn't resolve `senderName` / `gameName` at call time, the call sites must pass them through. Verify by reading `src/lib/notifications/index.ts` before Task 22.
3. **RLS UPDATE policy on `message_threads`.** The Task 10 UPDATE policy lets a viewer update any column on a thread they participate in. This is OK because the application code only writes `user_{a|b}_last_read_at`, but it's a wider grant than strictly needed. Acceptable v1; tighten with column-level grants if a later auditor flags it.
4. **Trigger `SECURITY DEFINER` posture.** The trigger updates the same table the message INSERT is on — combined with `SECURITY DEFINER` + `SET search_path = ''`, it bypasses RLS for the metadata update, which is intended (RLS on `message_threads` UPDATE would otherwise need to allow trigger-driven updates explicitly). Document in migration 118's header comment.
5. **Manual RLS checklist is the only RLS coverage.** No automated regression. Project memory's `Test Infrastructure Gaps` notes the broader gap; this PR doesn't fix it.

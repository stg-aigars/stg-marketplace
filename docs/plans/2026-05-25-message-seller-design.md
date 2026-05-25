# Message Seller — Design

**Date:** 2026-05-25
**Status:** Design validated through brainstorming + 4 review rounds. Ready for implementation plan.

## Goal

Private 1:1 messaging between any two STG users, parallel to but separate from the existing `order_messages` (which stays order-bound). Fills the gap between public listing comments and post-purchase order chat — covers negotiation, multi-listing coordination (combine shipping across a seller's listings), and general buyer↔seller dialogue.

## Brainstorm decisions (locked)

1. **Use cases:** negotiation, multi-listing coordination, general buyer↔seller chat. Pre-purchase private Q&A is out — public comments handle it.
2. **Threading:** per user pair, listing chips attachable per-message (not per-thread).
3. **System boundary:** new `messages` + `message_threads` tables, parallel to `order_messages`. No consolidation in v1.
4. **Anti-abuse:** per-user block list + seller opt-out. No rate limit. No per-message moderation tool — abuse response is block → opt-out → user suspension via existing `seller.status_changed` chain.
5. **Entry points:** listing detail page (auto-seeds listing as chip) + seller profile page (no seed). Not on cards, not on order detail.
6. **Notifications:** in-app bell instant on insert; email digest if unread after 15 min, cron-driven, bundled per (recipient, thread).
7. **UI surface:** full-page inbox at `/account/messages` + thread detail at `/account/messages/[threadId]`. No drawer/slide-over.
8. **Auth:** signed-in required (given).
9. **Mid-conversation semantics:**
   - `messaging_enabled = false` gates **new-thread creation only**; existing threads stay open both directions.
   - Block kills sending **bidirectionally** for new + existing threads; SELECT still permitted so both parties keep the transcript.

## Section 1 — Database schema

### Tables

**`message_threads`** — one row per user pair.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid pk` | |
| `user_a_id` | `uuid fk auth.users ON DELETE SET NULL` | nullable for GDPR-anonymize on account deletion |
| `user_b_id` | `uuid fk auth.users ON DELETE SET NULL` | nullable, same reason |
| `last_message_at` | `timestamptz not null` | updated by `messages` INSERT trigger |
| `last_message_preview` | `varchar(200) not null default ''` | denormalized, updated by trigger; powers inbox preview without N+1 |
| `user_a_last_read_at` | `timestamptz` | nullable until first view |
| `user_b_last_read_at` | `timestamptz` | nullable until first view |
| `created_at` | `timestamptz default now()` | |

**Constraints:**
- `CHECK (user_a_id IS NULL OR user_b_id IS NULL OR user_a_id < user_b_id)` — canonical ordering when both present; NULL allowed for ghost threads
- `UNIQUE (user_a_id, user_b_id)` — Postgres treats NULL as distinct, so each ghost thread remains its own row; acceptable

**Initiator role** is not stored on the thread row — recoverable from `messages.sender_id` of the earliest row when analytics need it.

**`messages`** — append-only per thread.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid pk` | |
| `thread_id` | `uuid fk message_threads ON DELETE CASCADE` | |
| `sender_id` | `uuid fk auth.users ON DELETE SET NULL` | anonymize on user deletion (matches `listing_comments.user_id`) |
| `body` | `text not null CHECK (length(body) BETWEEN 1 AND 2000)` | DB constraint as defense-in-depth; RPC also validates |
| `listing_ref_id` | `uuid fk listings ON DELETE SET NULL nullable` | optional listing chip; "[removed listing]" rendering if listing deleted |
| `created_at` | `timestamptz default now()` | |
| `email_sent_at` | `timestamptz nullable` | set by digest cron after Resend success |
| `email_send_attempts` | `int not null default 0` | incremented on cron failure; cap at 10 |

**`message_blocks`** — directional rows; bidirectional effect via the RLS predicate.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid pk` | |
| `blocker_id` | `uuid not null fk auth.users ON DELETE CASCADE` | |
| `blocked_id` | `uuid not null fk auth.users ON DELETE CASCADE` | |
| `created_at` | `timestamptz default now()` | |

**Constraints:** `UNIQUE (blocker_id, blocked_id)`, `CHECK (blocker_id <> blocked_id)`.

**`user_profiles.messaging_enabled boolean not null default true`** — new column on existing table.

### Indexes

- `(user_a_id, last_message_at DESC)` and `(user_b_id, last_message_at DESC)` — inbox sort
- `(thread_id, created_at)` on `messages` — thread scrollback
- `idx_messages_undelivered ON messages (created_at) WHERE email_sent_at IS NULL` — digest cron Pass 1

### Trigger: `on_message_insert`

Fires AFTER INSERT on `messages`. Single statement updating `message_threads` in one TX with the message insert. Atomic across three responsibilities:

```sql
UPDATE message_threads
SET last_message_at = NEW.created_at,
    last_message_preview = LEFT(NEW.body, 200),
    user_a_last_read_at = CASE WHEN user_a_id = NEW.sender_id THEN NEW.created_at ELSE user_a_last_read_at END,
    user_b_last_read_at = CASE WHEN user_b_id = NEW.sender_id THEN NEW.created_at ELSE user_b_last_read_at END
WHERE id = NEW.thread_id;
```

Sender's `last_read_at` bump in the same TX closes the cross-TX race where the sender briefly sees their own thread as unread. The recipient side is bumped via a separate server action (`markThreadRead`) on view + tab-refocus.

### RLS policies

- **`message_threads` SELECT:** `auth.uid() IN (user_a_id, user_b_id)`. No user-facing INSERT — only created via `send_first_message` RPC.
- **`messages` SELECT:** `auth.uid() IN ((SELECT user_a_id FROM message_threads WHERE id = thread_id), (SELECT user_b_id FROM message_threads WHERE id = thread_id))`. Transcript visible even after a block.
- **`messages` INSERT:** requires:
  - `auth.uid() = sender_id`
  - sender is one of the thread's participants
  - **both** `user_a_id IS NOT NULL AND user_b_id IS NOT NULL` (no inserts into ghost threads — defense-in-depth alongside UI gating)
  - no block row exists in either direction: `NOT EXISTS (SELECT 1 FROM message_blocks WHERE (blocker_id = sender AND blocked_id = recipient) OR (blocker_id = recipient AND blocked_id = sender))`
  - `messaging_enabled` is **NOT** in this predicate — opt-out gates new-thread creation only
- **`messages` UPDATE / DELETE:** no user-facing policy. `email_sent_at` + `email_send_attempts` mutation is service-role-only via the cron.
- **`message_blocks`:** `auth.uid() = blocker_id` for all operations.

### RPC: `send_first_message(other_user_id uuid, body text, listing_ref_id uuid)`

Atomic create-thread + first-message. Single roundtrip. Owns the new-thread security predicates.

**Validates:**
- `body` length 1–2000
- `other_user_id <> auth.uid()` → `self_target`
- `listing_ref_id IS NULL OR listings.seller_id = other_user_id` → `invalid_listing_ref` (off-context chips rejected)
- listing exists if non-null
- no block in either direction → `cannot_message_user`
- target's `messaging_enabled = true` → `cannot_message_user` (collapsed with block — privacy on block existence)

**Flow:**
1. Canonical-order the pair: `(user_a, user_b) = (LEAST, GREATEST)` over `(auth.uid(), other_user_id)`
2. `INSERT INTO message_threads (user_a_id, user_b_id, ...) VALUES (...) ON CONFLICT (user_a_id, user_b_id) DO NOTHING RETURNING id`
3. If conflict (race winner already created the thread): refetch existing `thread_id` (skip opt-out check — past that gate by definition)
4. `INSERT INTO messages (thread_id, sender_id, body, listing_ref_id) VALUES (...)` — block check via RLS predicate; defense-in-depth covers a mid-compose block
5. Trigger updates `last_message_at` + preview + sender read-state

**Return shape (discriminator only; UI does i18n):**

```ts
{ ok: true,  thread_id: uuid, message_id: uuid }
{ ok: false, error: 'self_target' }
{ ok: false, error: 'cannot_message_user' }   // opt-out + block collapsed for privacy
{ ok: false, error: 'invalid_body' }
{ ok: false, error: 'invalid_listing_ref' }
{ ok: false, error: 'unknown_user' }
```

### Server actions

- `findExistingThread(otherUserId): { threadId | null }` — pure lookup, no side effects.
- `sendMessage(threadId, body, listingRefId?)` — plain `INSERT INTO messages` for in-thread replies. Block check via RLS. Same `invalid_listing_ref` constraint.
- `markThreadRead(threadId)` — server action setting the viewer's `last_read_at = NOW()`. Idempotent. Called from Server-Component thread-page load + client tab-refocus.
- `toggleMessagingEnabled(newValue: boolean)` — settings page action.
- `blockUser(targetId)` / `unblockUser(targetId)` — list management.

### GDPR / account deletion

- User deletion sets `user_a_id` / `user_b_id` / `sender_id` to NULL via FKs.
- Surviving participant's transcript preserved. Inbox renders deleted counterparty as "[deleted user]" with disabled composer.
- Cron + RLS guard against inserts into ghost threads.
- **Deferred:** weekly maintenance to `DELETE FROM message_threads WHERE user_a_id IS NULL AND user_b_id IS NULL` (both-deleted edge case). Noted in CLAUDE.md deferred list.

## Section 2 — Cron + email digest

### Route

`/api/cron/message-digest`, POST + `Authorization: Bearer ${CRON_SECRET}`, schedule every 5 min via Coolify (matches existing cron pattern in CLAUDE.md).

### Query: two-pass thread-level eligibility

```sql
-- Pass 1: threads with at least one unread + unsent message ≥15min old (ghost threads excluded)
WITH eligible_threads AS (
  SELECT DISTINCT m.thread_id
  FROM messages m
  JOIN message_threads t ON t.id = m.thread_id
  WHERE m.email_sent_at IS NULL
    AND m.email_send_attempts < 10
    AND m.created_at < NOW() - INTERVAL '15 minutes'
    AND t.user_a_id IS NOT NULL
    AND t.user_b_id IS NOT NULL
    AND (
      (m.sender_id = t.user_a_id AND (t.user_b_last_read_at IS NULL OR t.user_b_last_read_at < m.created_at))
      OR
      (m.sender_id = t.user_b_id AND (t.user_a_last_read_at IS NULL OR t.user_a_last_read_at < m.created_at))
    )
)
-- Pass 2: fetch ALL unread + unsent messages in those threads, regardless of individual age
SELECT m.id, m.thread_id, m.sender_id, m.body, m.listing_ref_id, m.created_at,
       t.user_a_id, t.user_b_id, t.user_a_last_read_at, t.user_b_last_read_at
FROM messages m
JOIN message_threads t ON t.id = m.thread_id
WHERE m.thread_id IN (SELECT thread_id FROM eligible_threads)
  AND m.email_sent_at IS NULL
  AND m.email_send_attempts < 10
  AND (/* same unread predicate */)
ORDER BY m.thread_id, m.created_at;
```

Two-pass shape prevents the per-message-drip failure (msg1@T=0 / msg2@T=8 / msg3@T=14 / cron@T=15 — one email containing all three, not three sequential emails).

### Send + commit semantics

For each (recipient_id, thread_id) group:
1. Resolve recipient email via `user_profiles` lookup.
2. Render Resend template with bundled message previews + deep link.
3. On Resend success: `UPDATE messages SET email_sent_at = NOW() WHERE id = ANY($bundle_ids)` — **per-bundle commit**, not end-of-run, so a late-stage failure doesn't roll back successful earlier bundles.
4. On Resend failure: `UPDATE messages SET email_send_attempts = email_send_attempts + 1 WHERE id = ANY($bundle_ids)`. Sentry warning when **any message in the run reaches `attempts >= 5`** — mid-budget early warning leaves intervention room before the attempt-10 ceiling drops the email.

### Failure budget

- 10 retries × 5 min cadence = 50 minutes of Resend-outage tolerance.
- Messages stuck at `attempts >= 10` are skipped silently going forward.
- **Deferred:** weekly maintenance task to surface any `attempts >= 10` rows for manual triage.

### Deferred

- **Per-user email-notification opt-out:** v1 ships no "mute the digest" lever. Future shape is `user_profiles.email_notifications_messages boolean default true` checked at digest-query time. Settings page surfaces it at `/account/settings/notifications`.
- **i18n:** digest is EN-only. Latvian-launch PR resolves recipient locale and picks template `message-digest.{en|lv|lt|et}`.

## Section 3 — UI surfaces

### Routes

| Route | Purpose |
|---|---|
| `/account/messages` | Inbox |
| `/account/messages/[threadId]` | Thread detail |
| `/account/messages/new?to=sellerId&seedListingId=X&from=listing_detail\|seller_profile` | First-message composer (no existing thread) |
| `/account/settings/messaging` | `messaging_enabled` toggle |
| `/account/blocked` | Block list |

### Inbox (`/account/messages`)

- Desktop ≥md: two-column — left thread list, right empty-state panel ("Select a conversation").
- Mobile: thread list only; tap → navigate to thread page (CLAUDE.md mobile-first).
- Thread row: `Avatar` + `UserIdentity` (counterparty name + country flag), truncated `last_message_preview` from the thread row (no N+1), relative `formatMessageTime` of `last_message_at`, `Badge dot` when `last_message_at > viewer_last_read_at`.
- Ghost threads render counterparty as "[deleted user]" with disabled compose downstream.
- Empty state: `EmptyState` component, "No conversations yet — find a game you want and reach out to the seller" + link to browse.

### Thread page (`/account/messages/[threadId]`)

- Desktop: same two-column shell, active row highlighted.
- Mobile: full screen with `BackLink` to inbox.
- Header: counterparty `UserIdentity` + three-dot menu → Block (`Modal` confirm) / Report.
- Message bubbles: sender-aligned right (`semantic-brand` background, white text), counterparty-aligned left (`frost-100`-ish, default text). `formatMessageTime` below each.
- Listing chip embedded in message: compact `ListingIdentity` (linked thumb + title + price chip). Renders "[removed listing]" if FK is NULL.
- Composer at bottom: new `Textarea` + optional listing-chip preview (removable X) + `Button variant="brand"` Send.
- `markThreadRead(threadId)` fires from Server-Component view + tab-refocus client effect.
- Composer disabled (replaced with neutral one-liner) when: viewer blocked the counterparty / counterparty blocked the viewer / ghost thread. **Not** disabled by counterparty's `messaging_enabled = false` (per #4 decision).

### Composer / first-message flow

CTA on listing detail / seller profile:
1. Call `findExistingThread(sellerId)` server action.
2. If thread exists → navigate to `/account/messages/[threadId]?seedListingId=X` (composer pre-fills listing chip).
3. If null → navigate to `/account/messages/new?to=sellerId&seedListingId=X&from={listing_detail|seller_profile}`.

The composer page submits via `send_first_message` RPC. The `from` query-param threads through as `entry_point` for the `message_thread_started` analytics event. After send, redirect to `/account/messages/[threadId]`.

### Entry-point CTA gating (SSR)

Server component on listing detail + seller profile loads the seller's `messaging_enabled` flag and checks for a block row in either direction. CTA renders only when ALL of:
- Viewer is authenticated
- Viewer is not the seller
- `seller.messaging_enabled = true`
- No block in either direction

Hidden state renders a neutral one-liner: **"This seller isn't accepting new messages right now."** Covers both opt-out + block — privacy-equivalent, no post-click friction.

> Inline comment on the SSR loader: two extra queries per listing-detail render. Pre-launch volume fine; future optimization folds into the existing seller-data SSR loader on that route.

### Settings

- `/account/settings/messaging`: `Checkbox` "Allow people to send me messages" (defaults on). Help text: "Existing conversations will continue. You'll stop receiving new ones."
- `/account/blocked`: list of `UserIdentity` rows + `Button variant="ghost"` Unblock with `Modal` confirm. Block creation lives on the thread three-dot menu (not on this page).

### Components

**Reused** (CLAUDE.md inventory): `Avatar`, `UserIdentity`, `Card`, `Button`, `Badge`, `Modal`, `EmptyState`, `BackLink`, `Skeleton`, `Checkbox`, `Alert`, `formatMessageTime`, `cn()`.

**New design-system component:** `Textarea` (multi-line input, max-length counter, auto-resize, error slot mirroring `Input`'s API). Lands in `@/components/ui/index.ts`, added to CLAUDE.md Shared Components inventory, flagged in PR description. Retrofitting `listing_comments` + `order_messages` composers to use it is a follow-up — out of scope.

## Section 4 — Audit, notifications, analytics, email

### Audit events (none new)

Deliberate scope per the v1 "no per-message moderation tool" stance. The regulatory surface is already covered:
- DSA notices → `dsa_notice.received`
- Account suspensions → `seller.status_changed`

No audit on message send, thread creation, block creation, or `messaging_enabled` toggle. CLAUDE.md canonical-event register unchanged.

### In-app notifications

One new type: **`message.received`** (39 → 40 in project's notification type count).

- Fires from `sendMessage` server action AND `send_first_message` RPC wrapper via `void notify(recipientId, 'message.received', { threadId, senderName, listingRefId? })`.
- Fire-and-forget per CLAUDE.md pattern.
- Template in `src/lib/notifications/templates.ts` resolves `gameName` from `listingRefId` at template time (small JOIN — same shape email digest needs).
- Copy: `"About {gameName}: {senderName} sent you a message"` (with listing chip) / `"{senderName} sent you a message"` (without). Disambiguates same-counterparty multi-thread scenarios.
- Link: `/account/messages/[threadId]`.
- Bell picks up via existing poll-on-pathname-change.

### Analytics (PostHog)

Two new server-side events via `trackServer`. Extends `AnalyticsEventMap` in `src/lib/analytics/types.ts`.

| Event | Where | Properties |
|---|---|---|
| `message_thread_started` | `send_first_message` RPC wrapper, **create-thread branch only** (not on-conflict) | `{ thread_id, entry_point: 'listing_detail' \| 'seller_profile', has_listing_ref: boolean }` |
| `message_sent` | Both `send_first_message` (both branches) AND `sendMessage` server action | `{ thread_id, is_first_message: boolean, has_listing_ref: boolean }` |

**`is_first_message` semantics** (documented in `AnalyticsEventMap` comment):
- `send_first_message` RPC → `true` on BOTH branches (create AND on-conflict-existing — user intended a first message in either case).
- `sendMessage` server action → `false`.

`entry_point` plumbing: CTA buttons set `?from=listing_detail|seller_profile` on the `/account/messages/new` URL; composer threads it through to the RPC as an `entry_point` param; RPC writes it onto the event.

`distinctId = sender_id` (Supabase user.id). Fire-and-forget `void trackServer(...)`.

**Deferred analytics** per CLAUDE.md's `analytics_events_followups.md` guidance ("add based on real data gaps after ~2-4 weeks, not preemptively"): block / opt-out / unblock / thread-resumed events.

### Email digest template

New Resend template `message-digest.en` (EN-only v1):

- **Subject:** `"{senderName} sent you a message"` (single) / `"{senderName} sent you {N} messages"` (bundle).
- **Body:** counterparty header + bundled message previews (each truncated to ~200 chars, listing chip rendered as "About: {gameName}" line if present), deep link to `/account/messages/[threadId]`, standard SIA footer per `feedback_email_review_scope.md`.
- **No unsubscribe link in v1.** Transactional 1:1 notifications under GDPR don't require one. The future `email_notifications_messages` toggle (Section 2 deferred) will land in `/account/settings/notifications`.
- **Compliance:** transactional purity (no marketing content), SIA contact block, no PII beyond names recipient already sees. Compliance pass before merge per `feedback_email_review_scope.md`.
- **i18n:** per-recipient locale resolution deferred to Latvian-launch PR.

### Brand voice (`feedback_voice_board_gamey.md`)

Friction rule applies — blocked-path states (opt-out CTA, ghost thread, block one-liner, send failures) are warm-factual, no wit. Empty inbox copy ("No conversations yet — find a game you want and reach out to the seller") sits in warm-specific. Block confirm modal: warm-factual.

Final copy through humanizer + brand-voice pass before merge.

## Staff investigation surface

v1: staff investigation of abuse reports routes through the **Supabase dashboard** (service-role SELECT). No app-level staff thread viewer. Audit lives at the platform level (Supabase admin-query logs); no app-level event needed.

**Deferred:** app-level `/staff/threads/[id]` viewer with `thread.staff_accessed` operational audit event by analogy with `login_activity.staff_viewed`. Aligns with the ROPA balancing-test framing already used for `login_activity`.

## Deferred (for CLAUDE.md deferred list when shipped)

1. Per-user email-notification opt-out (`email_notifications_messages` column + `/account/settings/notifications`).
2. Weekly maintenance: delete fully-orphaned threads (`user_a_id IS NULL AND user_b_id IS NULL`).
3. Weekly maintenance: surface `email_send_attempts >= 10` messages for manual triage.
4. Block-from-profile entry point (currently only reachable via thread three-dot menu).
5. Latvian/Lithuanian/Estonian locale resolution for digest email.
6. Retrofit `listing_comments` + `order_messages` composers to use the new `Textarea` component.
7. Notification collapse-by-thread for `message.received` (if burst patterns prove noisy post-launch).
8. App-level `/staff/threads/[id]` viewer with `thread.staff_accessed` audit event.
9. Block / opt-out / unblock / thread-resumed PostHog analytics events.
10. New design-system component flag in PR description: `Textarea` added to inventory.

## Open questions for implementation plan

1. Migration number range (next sequence number in `supabase/migrations/`).
2. Test infrastructure: integration tests for the cron (eligibility predicate edge cases), RLS predicates (block bidirectionality, ghost-thread INSERT denial, in-thread writes unaffected by opt-out).
3. Feature-flag rollout? Or direct ship? Pre-launch + small marketplace suggests direct ship after `pnpm verify`.
4. New design-system component PR coupling: ship `Textarea` in this PR vs. extract to its own foundational PR first.

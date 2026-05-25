# Platform Announcements — Design

**Date:** 2026-05-25
**Status:** Design validated through brainstorming + 4 review rounds. Ready for implementation plan.

## Goal

Ship a public platform-announcements feature so STG staff can publish editorial weekly updates ("This week on STG") that surface as in-app notifications for signed-in users AND as an anon-readable public changelog at `/announcements`. Replaces the misuse of 1:1 messaging for platform-wide comms.

## Brainstorm decisions (locked)

1. **Surfaces:** in-app only (bell + dropdown unread dot + dedicated page). No email companion in v1 — newsletter is the right surface for email; weekly cadence in transactional email feels promotional and conflicts with transactional purity. Documented as deliberate "no," not oversight.
2. **Cadence:** editorial weekly post. One announcement = one cohesive update with title + markdown body. Not granular per-feature changelog; not auto-aggregating digest cron.
3. **Audience:** public. `/announcements` and `/announcements/[slug]` are anon-readable (gets SEO surface; supports public discovery of platform history). Bell ping is signed-in only.
4. **Content shape:** title + markdown body. No cover image in v1 (YAGNI; cheap `ALTER TABLE` later). No inline images (sanitize whitelist excludes `<img>`; staff link externally if needed). No GFM tables/task lists/strikethrough in v1 (launch posts are short prose; add `remark-gfm` if first launch post wants it).
5. **Read state:** lives in existing `notifications` table. No separate `announcement_views` second-source. New users see fresh bell from signup — no backfill of pre-signup announcements (matches `message.received` behavior).
6. **Retention:** announcement notifications inherit the 90-day `cleanup-notifications` cron. ~12 announcements visible in bell before pruning; vacation-tolerant. Announcement content itself never expires — page stays at its URL forever.

## Section 1 — Data model + RLS

### Tables

**`announcements`** — canonical content.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid pk` | |
| `slug` | `text not null unique` | URL component; auto-generated from title with staff override |
| `title` | `text not null` | Plain text, page H1 |
| `body_markdown` | `text not null` | Markdown source; rendered server-side |
| `published_at` | `timestamptz` | NULL = draft; flips freely on unpublish/republish |
| `notified_at` | `timestamptz` | Set once on first publish; load-bearing for slug-lock + fan-out guard |
| `deleted_at` | `timestamptz` | Soft delete; existing notifications survive |
| `created_by` | `uuid fk auth.users ON DELETE SET NULL` | Staff user |
| `created_at` | `timestamptz default now()` | |
| `updated_at` | `timestamptz default now()` | Bumped by `updateAnnouncement`; powers `dateModified` in Article JSON-LD |

**Partial index** for the hot-path query (list page + sitemap):
```sql
CREATE INDEX idx_announcements_published
  ON public.announcements (published_at DESC)
  WHERE published_at IS NOT NULL AND deleted_at IS NULL;
```

### RLS

- **SELECT (anon-permissive):** `USING (published_at IS NOT NULL AND deleted_at IS NULL)`. Direct anon SELECT on the table — every published column is genuinely public, no PII/payout/draft-leakage risk. Per CLAUDE.md's "RLS Policies and Anonymous Access," the view pattern is only for tables with sensitive columns to filter; nothing to filter here.
- **INSERT / UPDATE / DELETE (staff-only):** `USING (EXISTS (SELECT 1 FROM public.user_profiles WHERE id = (SELECT auth.uid()) AND is_staff = true))`. Matches migration 095's staff-gating pattern. The `(SELECT auth.uid())` wrap is the migration 113 initplan-perf pattern.

### Read state via existing notifications table

Every publish fans out an `announcement.posted` notification per signed-in user via `notifyMany()` (single batched INSERT). Bell badge + dropdown unread count + cleanup-cron retention all come for free. ~N rows per weekly publish; at 10K users × 52 weeks = 520K rows/year, but the 90-day `cleanup-notifications` cron caps live storage at ~12 announcements' worth of notification rows per user.

**Accepted trade-off:** notification context snapshots `title` + `slug` at publish time. Subsequent `updateAnnouncement` changes to title drift the bell preview from the page (cosmetic; matches messaging's `senderName` snapshot pattern). Slug edits are blocked once `notified_at IS NOT NULL` so click-throughs don't break.

## Section 2 — Publish flow + read state

### Server actions (`src/lib/announcements/actions.ts`)

- `createAnnouncement({ title, slug?, bodyMarkdown })` → draft row; no notification.
- `updateAnnouncement(id, fields)` — rejects `slug` change when `notified_at IS NOT NULL` (slug locked after first fan-out, so notification-snapshotted slugs stay resolvable). Title + body edits stay open. Does NOT re-fan-out. Doc note: substantive content rewrites should be unpublish → new announcement.
- `publishAnnouncement(id)`:
  1. `UPDATE announcements SET published_at = now() WHERE id = $1`
  2. If `notified_at IS NULL`: fan out via `notifyMany('announcement.posted', { announcementId, slug, title })` AND `UPDATE announcements SET notified_at = now()`. Else skip fan-out (guards against unpublish-as-edit double-spamming).
  3. `revalidatePath('/announcements')`. **Future coupling:** when the detail-page static-with-auth-revalidation work lands, add `revalidatePath('/announcements/${slug}')` here too.
- `unpublishAnnouncement(id)` — sets `published_at = NULL`; sweeps `UPDATE notifications SET read_at = now() WHERE type = 'announcement.posted' AND metadata->>'announcementId' = $1 AND read_at IS NULL` (clears bell dots); `revalidatePath('/announcements')`.
- `softDeleteAnnouncement(id)` — same sweep + sets `deleted_at = now()`; `revalidatePath('/announcements')`.
- `markAnnouncementRead(announcementId)` — server action fired from `/announcements/[slug]` server component when viewer is authenticated. Marks the matching `announcement.posted` notification(s) read for that user. Mirrors `markThreadRead` shape.

### Tombstone (not 404)

`/announcements/[slug]` server component checks `published_at IS NOT NULL AND deleted_at IS NULL`. If not, renders a "this announcement is no longer available" page with a `BackLink` to `/announcements`. Status 200. `metadata.robots = { index: false, follow: false }` to prevent dead announcements accumulating in search results.

The tombstone + notification sweep + slug lock (Section 1) together close all three vectors: bell click-throughs, shared URLs, search-engine indexed URLs.

### Recipient scope

`notifyMany` queries `user_profiles` for all rows; no exclusions in v1. Per memory `account_deletion_architecture.md`, deletion = anonymize + ban `auth.users` (not cascade), so deleted users keep their `user_profiles` row. Writing notifications to those rows is harmless (banned users can never read them). Audit metadata uses `recipientsIntended: N` (not `recipientsCount`) to make explicit it's fan-out time, not delivery time.

### Audit events (all `operational`-class, 30-day retention)

- `announcement.published` — `actorId` (staff), `resourceId` (announcement.id), `metadata: { slug, title, recipientsIntended }`.
- `announcement.unpublished` — same shape (no `recipientsIntended`).
- `announcement.deleted` — same shape.

**Not regulatory class.** Per CLAUDE.md's canonical register, regulatory hooks are DSA Art. 16, contract formation, financial entries, DAC7, OSS. "We shipped X" lacks that hook. If a specific announcement is regulatory in nature (material privacy / terms change), the regulatory anchor is the underlying event (`terms.accepted`, etc.), not the comms.

## Section 3 — Public surfaces

### Routes

| Route | Auth | Render |
|---|---|---|
| `/announcements` | Anon-readable | `force-static`; revalidated by the three mutation actions |
| `/announcements/[slug]` | Anon-readable; signed-in viewers fire `markAnnouncementRead` | Dynamic SSR (per-request auth required for mark-read side effect) |
| `/staff/announcements` | Staff-only | Dynamic SSR |
| `/staff/announcements/new` | Staff-only | Form |
| `/staff/announcements/[id]/edit` | Staff-only | Form (slug locked after `notified_at`) |

No separate `/account/announcements` route — URL canonicality wins. Signed-in users hit the same `/announcements/[slug]` as anon, with the mark-read side effect attached invisibly.

### Markdown rendering pipeline

Deps: `react-markdown` + `rehype-sanitize` + `rehype-shift-heading` (or 10-line custom plugin) + `strip-markdown` (remark, for plain-text excerpts).

**Sanitize whitelist:** headings (h1-h6, demoted to h2-h6 by the shift plugin), bold, italic, links (`rel="noopener noreferrer"` added to all), unordered + ordered lists, code blocks, inline code, blockquotes, horizontal rules. **Excluded:** `<img>`, `<style>`, `<script>`, raw HTML, GFM extensions.

**Heading shift:** rehype plugin demotes all headings by one level so page H1 is always `announcement.title`. Staff can write `# Big idea` naturally; it renders as h2.

**Helper text in staff form:** "Use plain links to external images; inline embeds aren't supported in v1."

### SEO surface

- **JSON-LD:** new `buildAnnouncementJsonLd` in `src/lib/seo/` emits `Article` schema: `headline` (title), `datePublished` (`published_at`), `dateModified` (`updated_at`), `author: { '@type': 'Organization', name: 'Second Turn Games' }`, `articleBody` (markdown stripped to plain text via `strip-markdown`).
- **Breadcrumbs:** visual `Breadcrumb` component (Home → Announcements → Title for detail; Home → Announcements for list) paired with `buildBreadcrumbJsonLd`.
- **Sitemap:** modify `src/app/sitemap.ts` to include `/announcements` + each published `/announcements/[slug]`.
- **OG:** title + description (markdown-stripped excerpt, truncated 160 chars). Default site OG image (per-announcement OG image deferred to when the cover-image column lands).
- **Tombstone branch:** `metadata.robots = { index: false, follow: false }`.

### Cached list, dynamic detail

`/announcements` is `force-static` with `revalidatePath('/announcements')` from the three mutation actions. Most-linked surface of the feature; CDN-friendly.

`/announcements/[slug]` stays dynamic SSR because the mark-read side effect requires per-request auth. Future-deferred work: split this into anon-static + auth-dynamic via a sub-component pattern. When that ships, the mutation actions add `revalidatePath('/announcements/${slug}')` as a coupled change.

## Section 4 — Notification wiring + nav surfaces

### Notification type

Standard wiring per the discipline established with `message.received`:

- `src/lib/notifications/types.ts` — `NotificationType` union gains `'announcement.posted'`. `NotificationContext` gains `announcementId?: string`, `slug?: string` (`title` already in the context interface).
- `src/lib/notifications/templates.ts`:
  ```ts
  'announcement.posted': {
    title: () => 'New announcement',
    body: (ctx) => ctx.title ?? 'Something new on Second Turn Games.',
    link: (ctx) => (ctx.slug ? `/announcements/${ctx.slug}` : '/announcements'),
  }
  ```
- `src/components/notifications/NotificationItem.tsx` — `TYPE_ICONS` adds `'announcement': Megaphone` (Phosphor).
- **Migration** adds `announcement` to `notifications_type_check` regex (paired with NotificationType change per the CLAUDE.md discipline).
- **CLAUDE.md** updated: count `43 → 44`; prefix list adds `announcement.`.

### Nav surfaces

1. **Footer link "What's new" → `/announcements`** (anon-visible). Essential for public discovery of the changelog. Location: site footer, beside existing entries. Coupling: locate footer component during implementation.

2. **User-dropdown link "Announcements" with optional unread dot.** Mirrors the Messages dropdown link. Reuses `DropdownLink` / `MobileLink`'s `unreadDot` prop. New hook `useHasUnreadAnnouncements` follows the exact shape of `useHasUnreadMessages` (server action filters notifications by `type LIKE 'announcement.%'`). ~30 LOC of identical pattern.

### Mark-read paths (three converge)

- Bell-dropdown row click → existing `markNotificationRead` behavior.
- Bell "Mark all as read" → existing behavior.
- Page-view via any path → `markAnnouncementRead(announcementId)` server action sweeps matching `announcement.posted` notifications for that user.

### Coalescing

None in v1. Each publish = separate bell entry. At weekly cadence with rare doubles, this is honest. If staff ever publishes 3 in one week and the bell gets noisy, the cleanup is one client-side group-by in `NotificationDropdown` — not a server-side merge.

## Out of scope / deferred (for CLAUDE.md deferred list when shipped)

1. **Email companion.** Newsletter is the email surface. If a specific announcement is high-value enough to email-blast, newsletter is the path.
2. **Cover image** (`cover_image_url` column + storage + per-announcement OG).
3. **`remark-gfm`** (tables, task lists, strikethrough).
4. **Inline image upload + sanitize allowlist for `<img>`.**
5. **Granular per-feature updates** (separate model from weekly editorial; would need a different content type).
6. **Auto-aggregating weekly digest** (cron that bundles granular items — depends on #5).
7. **Detail-page static-with-auth-revalidation split** (frees the CDN cache for anon visitors; requires sub-component pattern + `revalidatePath('/announcements/${slug}')` coupling in mutation actions).
8. **New-user backfill** ("you missed N announcements before joining" affordance). Currently no — new users start fresh. If we want it: `announcements_seen` table OR `last_seen_announcement_at` column on user_profiles.
9. **Partial functional index** for sweep query (`(type, (metadata->>'announcementId')) WHERE type = 'announcement.posted'`) — adds when notification volume grows.
10. **Coalesced bell entries** when multiple announcements fire close together (client-side group-by in `NotificationDropdown`).
11. **Per-user "stop pinging me about platform updates" toggle** (`announcement_notifications_enabled` on user_profiles). v1: no opt-out — bell mark-read is the implicit opt-out.

## Risks / things to watch during execution

1. **`notifyMany` recipient scope at scale.** Single batched INSERT for ~10K user_profiles rows is fine. At 100K+, audit the round-trip cost + INSERT batch size limit. Not a launch concern.
2. **Markdown sanitize false negatives.** `rehype-sanitize` defaults are robust, but staff content goes anon-readable — any XSS hole exposes every visitor. Manually QA the sanitize config against a curated payload before first publish.
3. **Tombstone discoverability via search engines.** `noindex` on the tombstone branch stops *future* indexing, but doesn't immediately remove already-indexed dead URLs. Acceptable; search engines re-crawl over time.
4. **CLAUDE.md prefix-list coupling.** When this PR adds `announcement.` to the notifications regex, the bumped count needs to match the actual NotificationType union. Verify before commit.
5. **Footer component location.** Footer entries are scattered across surfaces in some codebases; confirm there's a single source of truth before adding the "What's new" link.

## Open questions for implementation plan

1. Migration number range (next sequence number in `supabase/migrations/`).
2. Staff form validation: how restrictive on `slug` (kebab-case only, length limit, reserved words like `new`/`edit`)?
3. Pagination on `/announcements` — page size? Cursor or offset? At weekly cadence + 1-year horizon, ~52 items total — could ship without pagination for v1 if the design tolerates a long page.
4. Test infrastructure: unit tests for sanitize config (XSS attempts), publish flow, slug-lock-on-notified guard, tombstone branch. RLS scenarios verified manually per messaging precedent.
5. Footer component location — direct edit or shared `<SiteFooter>` component to extend.
6. Rollout: direct ship post `pnpm verify`; first publish is the smoke test.

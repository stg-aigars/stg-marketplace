# Platform Announcements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ship platform announcements (per [2026-05-25-announcements-design.md](2026-05-25-announcements-design.md)) as a single PR on branch `feature/announcements-design` — anon-readable public changelog at `/announcements`, staff CRUD under `/staff/announcements`, in-app bell ping for signed-in users via the existing `notify()` pipeline.

**Architecture:** Single `announcements` table (canonical content) + fan-out to existing `notifications` table on publish. Staff actions under `is_staff` RLS; public SELECT directly on the table (anon-permissive). Markdown pipeline via `react-markdown` + `rehype-sanitize` + heading-shift + plain-text excerpts. List page `force-static` with `revalidatePath`; detail page dynamic SSR for mark-read side effect.

**Tech Stack:** Next.js 16 (App Router), Supabase Postgres + RLS, `react-markdown` + `rehype-sanitize` + `rehype-shift-heading` + `strip-markdown` (new deps), Vitest + RTL, Tailwind tokens.

**Out of scope (deferred — see design doc §"Out of scope"):** email companion (newsletter is the path), cover image + per-announcement OG, `remark-gfm`, inline image upload, granular per-feature updates + auto-aggregating digest, new-user backfill, partial functional index for sweep, per-user opt-out toggle, coalesced bell entries, detail-page static-with-auth-revalidation split.

**Resolved decisions from design:**
1. Migration **120** (single migration — table + indexes + RLS + notifications regex update all together; the regex update is one ALTER paired with the new prefix).
2. No analytics events. PostHog `$pageview` captures engagement for free. Audit events (`announcement.published`, `unpublished`, `deleted`) cover staff actions.
3. No cron. The asymmetric-risk gate from messaging doesn't apply — no email blast, no automated fan-out beyond the synchronous publish action.
4. First publish IS the smoke test.

---

## Phase 1 — Migration 120: schema + RLS + notifications regex

### Task 1: Migration file shell

**Files:**
- Create: `supabase/migrations/120_announcements_schema.sql`

**Step 1:** Write file header.

```sql
-- 120_announcements_schema.sql
-- Platform announcements: table, indexes, RLS, plus paired update of
-- notifications_type_check regex to include the new `announcement` prefix.
-- Design: docs/plans/2026-05-25-announcements-design.md
```

**Step 2:** Commit.

```bash
git add supabase/migrations/120_announcements_schema.sql
git commit -m "chore(announcements): scaffold migration 120"
```

### Task 2: announcements table

**Step 1:** Append.

```sql
CREATE TABLE public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
  body_markdown text NOT NULL CHECK (length(body_markdown) BETWEEN 1 AND 20000),
  published_at timestamptz,
  notified_at timestamptz,
  deleted_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_announcements_published
  ON public.announcements (published_at DESC)
  WHERE published_at IS NOT NULL AND deleted_at IS NULL;
```

**Step 2:** Commit.

```bash
git commit -am "feat(announcements): add announcements table + partial index"
```

### Task 3: updated_at trigger

**Step 1:** Append (mirrors any existing updated_at trigger pattern in the codebase — grep for `BEFORE UPDATE` on similar tables to confirm shape).

```sql
CREATE OR REPLACE FUNCTION public.touch_announcements_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_touch_announcements_updated_at
  BEFORE UPDATE ON public.announcements
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_announcements_updated_at();
```

**Step 2:** Commit.

```bash
git commit -am "feat(announcements): updated_at trigger"
```

### Task 4: Enable RLS + policies

**Step 1:** Append.

```sql
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- Anon-permissive SELECT for published, non-deleted rows.
-- Per CLAUDE.md "RLS Policies and Anonymous Access": every column is
-- genuinely public when published; no view needed.
CREATE POLICY "Public reads published announcements"
  ON public.announcements
  FOR SELECT
  USING (published_at IS NOT NULL AND deleted_at IS NULL);

-- Staff INSERT/UPDATE/DELETE. Matches the migration 095 staff-gating pattern
-- (EXISTS subquery against user_profiles, (SELECT auth.uid()) initplan wrap).
CREATE POLICY "Staff create announcements"
  ON public.announcements
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = (SELECT auth.uid()) AND is_staff = true
    )
  );

CREATE POLICY "Staff update announcements"
  ON public.announcements
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = (SELECT auth.uid()) AND is_staff = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = (SELECT auth.uid()) AND is_staff = true
    )
  );

CREATE POLICY "Staff delete announcements"
  ON public.announcements
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = (SELECT auth.uid()) AND is_staff = true
    )
  );
```

**Step 2:** Commit.

```bash
git commit -am "feat(announcements): RLS policies (anon SELECT + staff write)"
```

### Task 5: Paired notifications regex update

**Step 1:** Append. This is the discipline I documented in CLAUDE.md after migration 119 — every new `NotificationType` prefix ships a paired regex update in the same migration that introduces it at the schema layer.

```sql
ALTER TABLE notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type ~ '^(order|comment|dispute|shipping|auction|wanted|dac7|moderation|listing|feedback|message|announcement)\.');
```

**Step 2:** Commit.

```bash
git commit -am "feat(announcements): paired notifications_type_check regex for announcement prefix"
```

### Task 6 (user-executed): Apply migration 120 on prod

**Operator action:** apply migration 120 on prod (same flow as 117/118/119). Verify schema:

```sql
\d public.announcements
SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'notifications_type_check';
```

Expected:
- `announcements` table present with 11 columns and the partial index
- `notifications_type_check` regex now includes `announcement`

I'll wait for confirmation before continuing.

---

## Phase 2 — Markdown rendering infrastructure

### Task 7: Install deps

**Step 1:** Add to `package.json` via pnpm.

```bash
pnpm add react-markdown rehype-sanitize rehype-shift-heading strip-markdown
```

**Step 2:** Commit.

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore(announcements): add markdown rendering deps"
```

### Task 8: Markdown renderer component

**Files:**
- Create: `src/components/announcements/AnnouncementMarkdown.tsx`

**Step 1:** Write the component. Server-renderable (no `'use client'`). Sanitize config explicitly excludes `<img>`, `<style>`, `<script>`, raw HTML. Heading-shift demotes h1→h2 etc. so page H1 stays as `announcement.title`.

```tsx
import ReactMarkdown from 'react-markdown';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import rehypeShiftHeading from 'rehype-shift-heading';

const sanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    a: [...(defaultSchema.attributes?.a ?? []), ['rel', 'noopener', 'noreferrer'], ['target', '_blank']],
  },
  // Exclude img, style, script — staff content goes anon-readable.
  tagNames: (defaultSchema.tagNames ?? []).filter((t) => !['img', 'style', 'script'].includes(t)),
};

interface AnnouncementMarkdownProps {
  body: string;
}

export function AnnouncementMarkdown({ body }: AnnouncementMarkdownProps) {
  return (
    <div className="prose prose-sm sm:prose-base max-w-none">
      <ReactMarkdown
        rehypePlugins={[
          [rehypeShiftHeading, { shift: 1 }],
          [rehypeSanitize, sanitizeSchema],
        ]}
      >
        {body}
      </ReactMarkdown>
    </div>
  );
}
```

**Step 2:** Commit.

```bash
git add src/components/announcements/AnnouncementMarkdown.tsx
git commit -m "feat(announcements): markdown renderer with sanitize + heading-shift"
```

### Task 9: Sanitize XSS regression tests

**Files:**
- Create: `src/components/announcements/AnnouncementMarkdown.test.tsx`

**Step 1:** Write failing tests for the sanitize behaviors. Render with RTL, assert sanitized output. Test payloads MUST include: `<script>`, `<img>`, `<style>`, `javascript:` URL on a link, raw HTML.

```tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { AnnouncementMarkdown } from './AnnouncementMarkdown';

describe('AnnouncementMarkdown sanitize config', () => {
  it('strips <script> tags', () => {
    const { container } = render(<AnnouncementMarkdown body={'<script>alert(1)</script>'} />);
    expect(container.querySelector('script')).toBeNull();
  });

  it('strips <img> tags', () => {
    const { container } = render(<AnnouncementMarkdown body={'![alt](https://example.com/foo.png)'} />);
    expect(container.querySelector('img')).toBeNull();
  });

  it('strips javascript: URLs on links', () => {
    const { container } = render(<AnnouncementMarkdown body={'[click](javascript:alert(1))'} />);
    const link = container.querySelector('a');
    expect(link?.getAttribute('href')).not.toMatch(/^javascript:/i);
  });

  it('demotes h1 → h2 so page H1 stays as announcement title', () => {
    const { container } = render(<AnnouncementMarkdown body={'# Big idea\n\n## Sub'} />);
    expect(container.querySelector('h1')).toBeNull();
    expect(container.querySelectorAll('h2').length).toBe(1);
    expect(container.querySelectorAll('h3').length).toBe(1);
  });

  it('allows lists, bold, italic, links, code', () => {
    const body = '**bold** and *italic*, with [a link](https://example.com) and `code`\n\n- item\n- item';
    const { container } = render(<AnnouncementMarkdown body={body} />);
    expect(container.querySelector('strong')).not.toBeNull();
    expect(container.querySelector('em')).not.toBeNull();
    expect(container.querySelector('a')?.getAttribute('href')).toBe('https://example.com');
    expect(container.querySelector('code')).not.toBeNull();
    expect(container.querySelectorAll('li').length).toBe(2);
  });
});
```

**Step 2:** Run: `pnpm test src/components/announcements/AnnouncementMarkdown.test.tsx -- --run`
Expected: PASS (component already exists from Task 8).

**Step 3:** Commit.

```bash
git add src/components/announcements/AnnouncementMarkdown.test.tsx
git commit -m "test(announcements): sanitize config XSS regression suite"
```

### Task 10: Plain-text excerpt helper

**Files:**
- Create: `src/lib/announcements/excerpt.ts`
- Create: `src/lib/announcements/excerpt.test.ts`

**Step 1:** Write helper + tests. Used for OG description + Article JSON-LD `articleBody`. Uses `strip-markdown` remark plugin to convert markdown to plain text, then truncates.

```ts
import { remark } from 'remark';
import strip from 'strip-markdown';

export function markdownExcerpt(body: string, maxLength = 160): string {
  const plain = remark().use(strip).processSync(body).toString().trim();
  if (plain.length <= maxLength) return plain;
  return plain.slice(0, maxLength).trimEnd() + '…';
}
```

```ts
import { describe, it, expect } from 'vitest';
import { markdownExcerpt } from './excerpt';

describe('markdownExcerpt', () => {
  it('strips markdown syntax', () => {
    expect(markdownExcerpt('**bold** and [link](https://x)')).toBe('bold and link');
  });
  it('truncates at maxLength', () => {
    expect(markdownExcerpt('a'.repeat(200), 50)).toMatch(/^a{50}…$/);
  });
  it('returns plain text under maxLength unchanged', () => {
    expect(markdownExcerpt('Short', 160)).toBe('Short');
  });
});
```

**Step 2:** Add `remark` + `strip-markdown` to package.json:

```bash
pnpm add remark strip-markdown
```

**Step 3:** Run: `pnpm test src/lib/announcements/excerpt.test.ts -- --run`
Expected: PASS.

**Step 4:** Commit.

```bash
git add src/lib/announcements/ package.json pnpm-lock.yaml
git commit -m "feat(announcements): markdown excerpt helper for OG/JSON-LD"
```

---

## Phase 3 — Types + server actions

### Task 11: Types module

**Files:**
- Create: `src/lib/announcements/types.ts`

**Step 1:** Write.

```ts
export interface Announcement {
  id: string;
  slug: string;
  title: string;
  body_markdown: string;
  published_at: string | null;
  notified_at: string | null;
  deleted_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type AnnouncementsActionResult = { success: true } | { error: string };

export const ANNOUNCEMENT_TITLE_MAX = 200;
export const ANNOUNCEMENT_BODY_MAX = 20000;
export const ANNOUNCEMENT_SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const ANNOUNCEMENT_SLUG_RESERVED = ['new', 'edit', 'index'];
```

**Step 2:** Commit.

```bash
git add src/lib/announcements/types.ts
git commit -m "feat(announcements): types module"
```

### Task 12: Slug helper

**Files:**
- Create: `src/lib/announcements/slug.ts`
- Create: `src/lib/announcements/slug.test.ts`

**Step 1:** Write helper that generates kebab-case slug from title + validates.

```ts
import { ANNOUNCEMENT_SLUG_REGEX, ANNOUNCEMENT_SLUG_RESERVED } from './types';

export function slugifyTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 80);
}

export function validateSlug(slug: string): { ok: true } | { ok: false; reason: string } {
  if (!slug) return { ok: false, reason: 'slug_empty' };
  if (slug.length > 80) return { ok: false, reason: 'slug_too_long' };
  if (!ANNOUNCEMENT_SLUG_REGEX.test(slug)) return { ok: false, reason: 'slug_invalid_chars' };
  if (ANNOUNCEMENT_SLUG_RESERVED.includes(slug)) return { ok: false, reason: 'slug_reserved' };
  return { ok: true };
}
```

**Step 2:** Tests.

```ts
import { describe, it, expect } from 'vitest';
import { slugifyTitle, validateSlug } from './slug';

describe('slugifyTitle', () => {
  it('kebab-cases', () => expect(slugifyTitle('Hello World')).toBe('hello-world'));
  it('strips diacritics', () => expect(slugifyTitle('Café Münchën')).toBe('cafe-munchen'));
  it('collapses whitespace + punctuation', () => expect(slugifyTitle("What's new?!")).toBe('what-s-new'));
});

describe('validateSlug', () => {
  it.each(['hello-world', 'v1', 'abc-123'])('accepts %s', (s) => expect(validateSlug(s)).toEqual({ ok: true }));
  it.each(['HELLO', 'with space', '-leading', 'trailing-', 'new', 'edit'])('rejects %s', (s) =>
    expect(validateSlug(s).ok).toBe(false),
  );
});
```

**Step 3:** Run: `pnpm test src/lib/announcements/slug.test.ts -- --run`
Expected: PASS.

**Step 4:** Commit.

```bash
git add src/lib/announcements/slug.ts src/lib/announcements/slug.test.ts
git commit -m "feat(announcements): slug helper + validation"
```

### Task 13: `createAnnouncement` action

**Files:**
- Create: `src/lib/announcements/actions.ts`

**Step 1:** Write the file with `'use server'` directive + `createAnnouncement`. Stub the others — they'll come in subsequent tasks.

```ts
'use server';

import { createClient } from '@/lib/supabase/server';
import { requireStaffAuth } from '@/lib/auth/helpers';
// Note: requireStaffAuth's API may differ — read src/lib/auth/helpers.ts before
// using. If it returns NextResponse (API-only), use requireServerAuth + manual
// is_staff check from profile instead.
import { validateSlug, slugifyTitle } from './slug';
import { ANNOUNCEMENT_TITLE_MAX, ANNOUNCEMENT_BODY_MAX, type AnnouncementsActionResult } from './types';

export async function createAnnouncement(args: {
  title: string;
  slug?: string;
  bodyMarkdown: string;
}): Promise<AnnouncementsActionResult & { id?: string }> {
  // Auth: must be staff. Read helpers.ts first to pick the right helper for
  // server-action context (requireServerAuth returns profile with is_staff).
  // ... (implementation per discovered helper shape)

  if (args.title.length < 1 || args.title.length > ANNOUNCEMENT_TITLE_MAX) {
    return { error: 'invalid_title' };
  }
  if (args.bodyMarkdown.length < 1 || args.bodyMarkdown.length > ANNOUNCEMENT_BODY_MAX) {
    return { error: 'invalid_body' };
  }
  const slug = args.slug ?? slugifyTitle(args.title);
  const slugCheck = validateSlug(slug);
  if (!slugCheck.ok) return { error: slugCheck.reason };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('announcements')
    .insert({ slug, title: args.title, body_markdown: args.bodyMarkdown })
    .select('id')
    .single();

  if (error) {
    if (error.code === '23505') return { error: 'slug_taken' }; // unique violation
    return { error: 'create_failed' };
  }
  return { success: true, id: data.id };
}
```

**Step 2:** Commit.

```bash
git add src/lib/announcements/actions.ts
git commit -m "feat(announcements): createAnnouncement server action"
```

### Task 14: `updateAnnouncement` action (with slug-lock on notified_at)

**Step 1:** Append to actions.ts.

```ts
export async function updateAnnouncement(
  id: string,
  fields: { title?: string; slug?: string; bodyMarkdown?: string },
): Promise<AnnouncementsActionResult> {
  const supabase = await createClient();

  // Fetch current state to enforce slug-lock invariant.
  const { data: current } = await supabase
    .from('announcements')
    .select('notified_at')
    .eq('id', id)
    .maybeSingle();
  if (!current) return { error: 'not_found' };

  if (fields.slug !== undefined && current.notified_at !== null) {
    return { error: 'slug_locked_after_notify' };
  }

  const payload: Record<string, unknown> = {};
  if (fields.title !== undefined) {
    if (fields.title.length < 1 || fields.title.length > ANNOUNCEMENT_TITLE_MAX) {
      return { error: 'invalid_title' };
    }
    payload.title = fields.title;
  }
  if (fields.slug !== undefined) {
    const check = validateSlug(fields.slug);
    if (!check.ok) return { error: check.reason };
    payload.slug = fields.slug;
  }
  if (fields.bodyMarkdown !== undefined) {
    if (fields.bodyMarkdown.length < 1 || fields.bodyMarkdown.length > ANNOUNCEMENT_BODY_MAX) {
      return { error: 'invalid_body' };
    }
    payload.body_markdown = fields.bodyMarkdown;
  }

  if (Object.keys(payload).length === 0) return { success: true };

  const { error } = await supabase.from('announcements').update(payload).eq('id', id);
  if (error) return { error: 'update_failed' };
  return { success: true };
}
```

**Step 2:** Commit.

```bash
git commit -am "feat(announcements): updateAnnouncement with slug-lock on notified_at"
```

### Task 15: `publishAnnouncement` with notified_at fan-out guard

**Step 1:** Append.

```ts
import { notifyMany } from '@/lib/notifications';
import { logAuditEvent } from '@/lib/services/audit';
import { revalidatePath } from 'next/cache';

export async function publishAnnouncement(id: string): Promise<AnnouncementsActionResult> {
  const supabase = await createClient();

  // Read current state — need notified_at + slug + title for fan-out and audit
  const { data: announcement } = await supabase
    .from('announcements')
    .select('id, slug, title, notified_at')
    .eq('id', id)
    .maybeSingle();
  if (!announcement) return { error: 'not_found' };

  const now = new Date().toISOString();
  const isFirstPublish = announcement.notified_at === null;

  const { error: publishErr } = await supabase
    .from('announcements')
    .update({
      published_at: now,
      ...(isFirstPublish ? { notified_at: now } : {}),
    })
    .eq('id', id);
  if (publishErr) return { error: 'publish_failed' };

  if (isFirstPublish) {
    // Fan out to all user_profiles. notifyMany batches into single INSERT.
    const { data: profiles } = await supabase.from('user_profiles').select('id');
    const recipientCount = profiles?.length ?? 0;
    if (recipientCount > 0 && profiles) {
      void notifyMany(
        profiles.map((p) => ({
          userId: p.id,
          type: 'announcement.posted',
          context: { announcementId: id, slug: announcement.slug, title: announcement.title },
        })),
      );
    }

    void logAuditEvent(supabase, {
      actorType: 'user',
      action: 'announcement.published',
      resourceType: 'announcement',
      resourceId: id,
      metadata: { slug: announcement.slug, title: announcement.title, recipientsIntended: recipientCount },
      retentionClass: 'operational',
    });
  }

  revalidatePath('/announcements');
  return { success: true };
}
```

**Step 2:** Commit.

```bash
git commit -am "feat(announcements): publishAnnouncement with notified_at guard + fan-out + audit"
```

### Task 16: `unpublishAnnouncement` + `softDeleteAnnouncement` + sweep

**Step 1:** Append.

```ts
async function sweepAnnouncementNotifications(
  supabase: Awaited<ReturnType<typeof createClient>>,
  announcementId: string,
): Promise<void> {
  await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('type', 'announcement.posted')
    .is('read_at', null)
    .eq('metadata->>announcementId', announcementId);
}

export async function unpublishAnnouncement(id: string): Promise<AnnouncementsActionResult> {
  const supabase = await createClient();
  const { data: announcement } = await supabase
    .from('announcements')
    .select('id, slug, title')
    .eq('id', id)
    .maybeSingle();
  if (!announcement) return { error: 'not_found' };

  const { error } = await supabase
    .from('announcements')
    .update({ published_at: null })
    .eq('id', id);
  if (error) return { error: 'unpublish_failed' };

  await sweepAnnouncementNotifications(supabase, id);

  void logAuditEvent(supabase, {
    actorType: 'user',
    action: 'announcement.unpublished',
    resourceType: 'announcement',
    resourceId: id,
    metadata: { slug: announcement.slug, title: announcement.title },
    retentionClass: 'operational',
  });

  revalidatePath('/announcements');
  return { success: true };
}

export async function softDeleteAnnouncement(id: string): Promise<AnnouncementsActionResult> {
  const supabase = await createClient();
  const { data: announcement } = await supabase
    .from('announcements')
    .select('id, slug, title')
    .eq('id', id)
    .maybeSingle();
  if (!announcement) return { error: 'not_found' };

  const { error } = await supabase
    .from('announcements')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);
  if (error) return { error: 'delete_failed' };

  await sweepAnnouncementNotifications(supabase, id);

  void logAuditEvent(supabase, {
    actorType: 'user',
    action: 'announcement.deleted',
    resourceType: 'announcement',
    resourceId: id,
    metadata: { slug: announcement.slug, title: announcement.title },
    retentionClass: 'operational',
  });

  revalidatePath('/announcements');
  return { success: true };
}
```

**Step 2:** Commit.

```bash
git commit -am "feat(announcements): unpublish + softDelete + notification sweep + audit"
```

### Task 17: `markAnnouncementRead` action

**Step 1:** Append. Mirrors `markThreadRead` from messaging.

```ts
export async function markAnnouncementRead(announcementId: string): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .eq('type', 'announcement.posted')
    .is('read_at', null)
    .eq('metadata->>announcementId', announcementId);
}
```

**Step 2:** Commit.

```bash
git commit -am "feat(announcements): markAnnouncementRead server action"
```

### Task 18: Unit tests for slug-lock invariant

**Files:**
- Create: `src/lib/announcements/actions.test.ts`

**Step 1:** Write tests covering the load-bearing slug-lock invariant: `updateAnnouncement` rejects slug change when `notified_at IS NOT NULL`, accepts when NULL.

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCreateClient = vi.fn();
vi.mock('@/lib/supabase/server', () => ({ createClient: mockCreateClient }));

describe('updateAnnouncement slug-lock invariant', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects slug change when notified_at IS NOT NULL', async () => {
    // Build chainable mock: from('announcements').select('notified_at').eq('id',x).maybeSingle()
    //   resolves to { data: { notified_at: '2026-05-25T00:00:00Z' } }
    // ... mock setup ...
    const { updateAnnouncement } = await import('./actions');
    const result = await updateAnnouncement('abc', { slug: 'new-slug' });
    expect(result).toEqual({ error: 'slug_locked_after_notify' });
  });

  it('allows slug change when notified_at IS NULL', async () => {
    // mock notified_at: null + successful update
    const { updateAnnouncement } = await import('./actions');
    const result = await updateAnnouncement('abc', { slug: 'new-slug' });
    expect(result).toEqual({ success: true });
  });
});
```

**Step 2:** Run + iterate until PASS.

**Step 3:** Commit.

```bash
git commit -am "test(announcements): slug-lock invariant tests"
```

---

## Phase 4 — Notification template + icon + context

### Task 19: Extend NotificationType + NotificationContext

**Files:**
- Modify: `src/lib/notifications/types.ts`

**Step 1:** Add `'announcement.posted'` to `NotificationType` union. Add `announcementId?: string` to `NotificationContext` (slug + title already exist).

**Step 2:** Commit.

```bash
git commit -am "feat(announcements): NotificationType + context extension"
```

### Task 20: Notification template entry

**Files:**
- Modify: `src/lib/notifications/templates.ts`

**Step 1:** Append the `announcement.posted` entry alongside the existing entries (after `message.received`).

```ts
'announcement.posted': {
  title: () => 'New announcement',
  body: (ctx) => ctx.title ?? 'Something new on Second Turn Games.',
  link: (ctx) => (ctx.slug ? `/announcements/${ctx.slug}` : '/announcements'),
},
```

**Step 2:** Commit.

```bash
git commit -am "feat(announcements): notification template for announcement.posted"
```

### Task 21: Bell-dropdown icon mapping

**Files:**
- Modify: `src/components/notifications/NotificationItem.tsx`

**Step 1:** Add `Megaphone` import from `@phosphor-icons/react/ssr`; add `announcement: Megaphone` to `TYPE_ICONS`.

**Step 2:** Commit.

```bash
git commit -am "feat(announcements): Megaphone icon for announcement bell entries"
```

### Task 22: Update CLAUDE.md notification count + prefix list

**Files:**
- Modify: `CLAUDE.md` line 292

**Step 1:** Bump `43 → 44`. Add `announcement.` to the prefix list. Verify the prefix-coupling discipline reminder is still present.

**Step 2:** Commit.

```bash
git commit -am "docs: CLAUDE.md notification count 43→44 (add announcement prefix)"
```

---

## Phase 5 — Public UI

### Task 23: Announcement loader helpers

**Files:**
- Create: `src/lib/announcements/queries.ts`

**Step 1:** Write SSR query helpers used by both public pages.

```ts
import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { Announcement } from './types';

export async function listPublishedAnnouncements(limit = 52): Promise<Announcement[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('announcements')
    .select('*')
    .not('published_at', 'is', null)
    .is('deleted_at', null)
    .order('published_at', { ascending: false })
    .limit(limit);
  return (data as Announcement[]) ?? [];
}

export async function getPublishedAnnouncementBySlug(slug: string): Promise<Announcement | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('announcements')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();
  return (data as Announcement | null) ?? null;
}
```

**Step 2:** Commit.

```bash
git add src/lib/announcements/queries.ts
git commit -m "feat(announcements): SSR query helpers"
```

### Task 24: Public list page `/announcements`

**Files:**
- Create: `src/app/[locale]/announcements/page.tsx`

**Step 1:** `force-static` page. Heading + list of announcement cards (title + excerpt + date + read-more link). Empty state if none.

```tsx
import type { Metadata } from 'next';
import Link from 'next/link';
import { Card, CardBody, EmptyState } from '@/components/ui';
import { Megaphone } from '@phosphor-icons/react/ssr';
import { listPublishedAnnouncements } from '@/lib/announcements/queries';
import { markdownExcerpt } from '@/lib/announcements/excerpt';
import { formatDate } from '@/lib/date-utils';

export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: 'Announcements',
  description: "What's new on Second Turn Games — platform updates, feature launches, policy changes.",
};

export default async function AnnouncementsListPage() {
  const announcements = await listPublishedAnnouncements();

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
      <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-6">Announcements</h1>
      {announcements.length === 0 ? (
        <Card>
          <CardBody>
            <EmptyState icon={Megaphone} title="No announcements yet" description="Check back here for platform updates." />
          </CardBody>
        </Card>
      ) : (
        <ul className="space-y-3">
          {announcements.map((a) => (
            <li key={a.id}>
              <Link href={`/announcements/${a.slug}`} className="block">
                <Card hoverable>
                  <CardBody>
                    <h2 className="text-base font-semibold mb-1">{a.title}</h2>
                    <p className="text-sm text-semantic-text-muted mb-2">{markdownExcerpt(a.body_markdown, 200)}</p>
                    {a.published_at && <time className="text-xs text-semantic-text-muted" dateTime={a.published_at}>{formatDate(a.published_at)}</time>}
                  </CardBody>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

**Step 2:** Commit.

```bash
git add "src/app/[locale]/announcements/page.tsx"
git commit -m "feat(announcements): public list page (force-static)"
```

### Task 25: Public detail page `/announcements/[slug]` + tombstone branch

**Files:**
- Create: `src/app/[locale]/announcements/[slug]/page.tsx`

**Step 1:** Dynamic SSR. Renders detail OR tombstone. Tombstone has `metadata.robots = { index: false }`. Fires `markAnnouncementRead` fire-and-forget if viewer is signed in.

```tsx
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { BackLink, Breadcrumb, Card, CardBody, ShareButtons } from '@/components/ui';
import { AnnouncementMarkdown } from '@/components/announcements/AnnouncementMarkdown';
import { JsonLd } from '@/lib/seo/json-ld';
import { buildAnnouncementJsonLd } from '@/lib/seo/announcement-json-ld';
import { buildBreadcrumbJsonLd } from '@/lib/seo/breadcrumb-json-ld';
import { getPublishedAnnouncementBySlug } from '@/lib/announcements/queries';
import { markdownExcerpt } from '@/lib/announcements/excerpt';
import { markAnnouncementRead } from '@/lib/announcements/actions';
import { formatDate } from '@/lib/date-utils';
import { createClient } from '@/lib/supabase/server';
import { env } from '@/lib/env';

interface PageProps {
  params: Promise<{ slug: string; locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const a = await getPublishedAnnouncementBySlug(slug);
  if (!a || a.deleted_at || !a.published_at) {
    return { title: 'Announcement unavailable', robots: { index: false, follow: false } };
  }
  return {
    title: a.title,
    description: markdownExcerpt(a.body_markdown, 160),
    openGraph: { title: a.title, description: markdownExcerpt(a.body_markdown, 160), type: 'article' },
  };
}

export default async function AnnouncementDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const a = await getPublishedAnnouncementBySlug(slug);

  // Tombstone branch: row missing entirely → 404; row present but unpublished/deleted → tombstone (200)
  if (!a) notFound();
  if (a.deleted_at || !a.published_at) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
        <BackLink href="/announcements" label="All announcements" />
        <Card>
          <CardBody>
            <p className="text-sm text-semantic-text-muted">
              This announcement is no longer available.
            </p>
          </CardBody>
        </Card>
      </div>
    );
  }

  // Fire-and-forget mark-read for signed-in viewers
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) void markAnnouncementRead(a.id);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
      <JsonLd data={buildAnnouncementJsonLd(a, env.app.url)} />
      <JsonLd data={buildBreadcrumbJsonLd([
        { name: 'Home', url: env.app.url },
        { name: 'Announcements', url: `${env.app.url}/announcements` },
        { name: a.title, url: `${env.app.url}/announcements/${a.slug}` },
      ])} />
      <Breadcrumb items={[
        { label: 'Announcements', href: '/announcements' },
        { label: a.title },
      ]} />
      <article className="mt-4">
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-2">{a.title}</h1>
        {a.published_at && (
          <time className="text-sm text-semantic-text-muted block mb-6" dateTime={a.published_at}>
            {formatDate(a.published_at)}
          </time>
        )}
        <AnnouncementMarkdown body={a.body_markdown} />
        <div className="mt-6">
          <ShareButtons url={`${env.app.url}/announcements/${a.slug}`} title={a.title} />
        </div>
      </article>
    </div>
  );
}
```

**Step 2:** Commit.

```bash
git add "src/app/[locale]/announcements/[slug]/page.tsx"
git commit -m "feat(announcements): detail page + tombstone branch + mark-read"
```

### Task 26: Article JSON-LD helper

**Files:**
- Create: `src/lib/seo/announcement-json-ld.ts`

**Step 1:** Write the helper.

```ts
import { markdownExcerpt } from '@/lib/announcements/excerpt';
import type { Announcement } from '@/lib/announcements/types';

export function buildAnnouncementJsonLd(a: Announcement, baseUrl: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: a.title,
    datePublished: a.published_at,
    dateModified: a.updated_at,
    author: { '@type': 'Organization', name: 'Second Turn Games' },
    articleBody: markdownExcerpt(a.body_markdown, 5000),
    url: `${baseUrl}/announcements/${a.slug}`,
  };
}
```

**Step 2:** Commit.

```bash
git add src/lib/seo/announcement-json-ld.ts
git commit -m "feat(announcements): Article JSON-LD helper"
```

### Task 27: Sitemap inclusion

**Files:**
- Modify: `src/app/sitemap.ts`

**Step 1:** Locate the sitemap file. Add entries for `/announcements` + each published `/announcements/[slug]`. Use `listPublishedAnnouncements()` from `@/lib/announcements/queries`.

**Step 2:** Commit.

```bash
git commit -am "feat(announcements): sitemap entries for /announcements + each published slug"
```

---

## Phase 6 — Staff UI

### Task 28: Staff list page `/staff/announcements`

**Files:**
- Create: `src/app/[locale]/staff/announcements/page.tsx`

**Step 1:** Server component. Lists ALL announcements (drafts + published + deleted) with status badges. Each row links to `/staff/announcements/[id]/edit`. "+ New announcement" button → `/staff/announcements/new`. Use `requireStaffAuth` or equivalent.

(Skeleton — model after existing `/staff/*` pages.)

**Step 2:** Commit.

```bash
git commit -am "feat(announcements): staff list page"
```

### Task 29: Staff `new` form route

**Files:**
- Create: `src/app/[locale]/staff/announcements/new/page.tsx`
- Create: `src/app/[locale]/staff/announcements/_components/AnnouncementForm.tsx`

**Step 1:** Form component (client). Fields: title (Input), slug (Input with "auto from title" toggle), bodyMarkdown (Textarea, large). Action submits to `createAnnouncement`.

**Step 2:** New-page server component: just renders `<AnnouncementForm />`.

**Step 3:** Commit.

```bash
git commit -am "feat(announcements): staff new form"
```

### Task 30: Staff `edit` form route

**Files:**
- Create: `src/app/[locale]/staff/announcements/[id]/edit/page.tsx`

**Step 1:** Server component loads the announcement by id. Renders `<AnnouncementForm />` in edit mode (pre-filled, slug field disabled when `notified_at IS NOT NULL`). Action calls `updateAnnouncement`.

**Step 2:** Commit.

```bash
git commit -am "feat(announcements): staff edit form with slug-lock UI"
```

### Task 31: Publish / unpublish / delete action buttons in edit form

**Step 1:** Add three buttons to `AnnouncementForm`:
- "Publish" (variant=brand) — visible when `published_at IS NULL`; calls `publishAnnouncement`, redirects to list
- "Unpublish" (variant=ghost) — visible when `published_at IS NOT NULL`; calls `unpublishAnnouncement`, refreshes
- "Delete" (variant=danger) — Modal confirm; calls `softDeleteAnnouncement`, redirects to list

**Step 2:** Commit.

```bash
git commit -am "feat(announcements): publish/unpublish/delete actions in edit form"
```

### Task 32: Staff form preview-on-render of markdown

**Step 1:** Add a "Preview" panel in `AnnouncementForm` that renders the current `bodyMarkdown` via `<AnnouncementMarkdown body={body} />` live as the staff member types. Helps catch sanitize-stripped content before publish.

**Step 2:** Commit.

```bash
git commit -am "feat(announcements): live markdown preview in staff form"
```

---

## Phase 7 — Nav surfaces

### Task 33: Footer link "What's new"

**Files:**
- Modify: footer component (locate first; search for existing footer entries like "About" or "Help").

**Step 1:** Add a link to `/announcements` labeled "What's new" alongside existing footer entries.

**Step 2:** Commit.

```bash
git commit -am "feat(announcements): footer link to /announcements"
```

### Task 34: `useHasUnreadAnnouncements` hook

**Files:**
- Create: `src/hooks/useHasUnreadAnnouncements.ts`

**Step 1:** Mirror `useHasUnreadMessages` exactly. New server action `hasUnreadAnnouncements()` in `src/lib/notifications/actions.ts` queries notifications filtered by `type LIKE 'announcement.%'` + `read_at IS NULL`.

**Step 2:** Commit (split: action + hook).

```bash
git commit -am "feat(announcements): hasUnreadAnnouncements action + hook"
```

### Task 35: Dropdown link with unread dot

**Files:**
- Modify: `src/components/layout/SiteHeader.tsx`

**Step 1:** Import `useHasUnreadAnnouncements`. Add `DropdownLink` + `MobileLink` for "Announcements" → `/announcements` with the icon `Megaphone` and `unreadDot={hasUnreadAnnouncementsValue}`. Placement: after the "Messages" entry.

**Step 2:** Commit.

```bash
git commit -am "feat(announcements): user dropdown link with unread dot"
```

---

## Phase 8 — Verify + ship

### Task 36: Brand-voice + humanizer pass on all copy

**Step 1:** Collect every user-facing string introduced (page headings, empty state copy, form labels, error messages, dropdown/footer labels, notification template body). Run through the `humanizer` skill. Apply friction-rule (no wit on error paths) per `feedback_voice_board_gamey.md`.

**Step 2:** Commit any refinements.

### Task 37: `pnpm verify` gate

**Step 1:** Run `pnpm verify`. Expected: PASS.

**Step 2:** Fix any failures at root cause (no bypasses). Commit fixes.

### Task 38: Manual RLS verification checklist (run BEFORE pushing)

**Scenario 1 — Anon can read published announcements:**
1. As anon, GET `/announcements` → shows published rows
2. As anon, GET `/announcements/[slug]` of a published row → shows content
3. As anon, GET `/announcements/[slug]` of a draft (no `published_at`) → tombstone page (not 404, not content)

**Scenario 2 — Staff write gate:**
1. Sign in as non-staff user
2. Attempt INSERT via the staff form (should be 404 on `/staff/announcements/new` since `requireStaffAuth` blocks)
3. As staff, INSERT succeeds, edit succeeds, publish succeeds

**Scenario 3 — Slug-lock + tombstone integrity:**
1. Create + publish an announcement (notified_at gets set)
2. Try to edit slug → form rejects + server action returns `slug_locked_after_notify`
3. Unpublish → list page no longer shows it; direct URL shows tombstone; bell dot clears
4. Republish → list page shows it again; NO new bell ping (notified_at guard)

If any scenario fails: stop, root-cause, fix, re-run from scratch.

### Task 39 (user-executed): Push + open PR

**Operator action:**
```bash
git push -u origin feature/announcements-design
gh pr create --title "feat(announcements): platform announcements (public changelog + bell pings)" --body "..."
```

PR body includes:
- Link to design doc
- RLS-checklist outcomes
- Note about default OG image deferred to cover-image follow-up
- Migration 120 applied-to-prod status

### Task 40 (user-executed): Merge

**Operator action — after PR merges to main:**
1. Apply migration 120 on prod (if not already, pre-merge per the 117/118/119 cadence)
2. Sanity-check `/announcements` returns 200 for anon visitors
3. Sanity-check `/staff/announcements` returns 200 for staff
4. Publish a first announcement via the staff form — first publish IS the smoke test

---

## Risks / things to watch during execution

1. **`requireStaffAuth` API surface.** The plan calls it from server actions, but its current implementation (per messaging work) returns `{ response: NextResponse, user, supabase }` for API routes. For server actions, may need `requireServerAuth` + manual `profile?.is_staff` check. Verify before Task 13; adjust action signatures accordingly.
2. **`metadata->>announcementId` filter syntax.** PostgREST jsonb filtering syntax used in `sweepAnnouncementNotifications` and `markAnnouncementRead` — verified working in messaging's `markThreadRead`. Same pattern.
3. **`hoverable` prop on Card** — used in Task 24 list page. Verify the Card component supports it; if not, drop the prop (the Link wrapping the card already gives hover affordance).
4. **Footer location.** Search for existing footer first. May be in `src/components/layout/` or `src/app/[locale]/layout.tsx`.
5. **`Megaphone` Phosphor icon** — confirm it exists in `@phosphor-icons/react/ssr`. If not, swap to `Newspaper` or `Speakerphone`.
6. **Tailwind `prose` classes** for markdown rendering — verify the project has `@tailwindcss/typography` plugin installed; if not, install OR use custom CSS-in-typescript classes for headings/lists/etc.
7. **Manual RLS checklist is the only RLS coverage.** No automated regression (matches messaging precedent).

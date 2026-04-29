# PTAC Distance-Trading Compliance Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Close the genuine pre-contract / durable-medium / unfair-clause gaps PTAC's 27.09.2017 distance-trading guidance flags against STG, while preserving the adjudicated "private-sellers-only" legal posture from the 2026-04-26 lawyer memo.

**Architecture:** Strengthen the private-only framing rather than build B2C scaffolding. Add (a) explicit obligation-to-pay UX at the order moment, (b) inline Terms summary + Annex B withdrawal form template in the order-confirmation email, with `terms_version` stamped on each order for forensics, (c) inline consumer-rights carve-outs into liability/modification clauses, (d) listing-level pre-contract disclosure of seller status, (e) a `seller_status` enum + DSA Art. 16 notice persistence and staff queue (extending the **existing** `/api/report-illegal-content` route, not duplicating it) + rolling 12-month trader-volume counters that fire a verification trigger at 25 sales / €1,800 revenue, prompt staff to send a soft-touch verification email per the lawyer's 2026-04-28 framework, capture the seller's structured response, and require dismissal-with-rationale when staff decides not to act. No automated suspension at any threshold — suspension remains a human decision with verification response as evidence. No business-seller schema; no insolvency check pre-launch; no static PDF authoring pipeline; no historical-Terms convenience route.

**Tech Stack:** Next.js 16 App Router, Supabase (Postgres + RLS), Resend transactional email, next-intl, Tailwind. No new runtime deps.

**Live-test status (load-bearing for backfill framing).** The marketplace has no real users or orders yet — all current rows in `audit_log`, `orders`, `user_profiles`, etc. are live-test data. Backfill *patterns* (e.g. UPDATE existing rows on rename) still go in versioned migrations because that's what runs on prod when real data lands, but the *volume* is irrelevant in practice. Where this plan mentions "backfill any existing rows," read that as "the migration includes the UPDATE for correctness; the rows it touches today are test data."

---

## Context — what's already adjudicated

The lawyer's memo at `docs/legal_audit/lawyer-response.md` (and root copy `STG_Legal_Review_Response_2026-04-26.md`) settled three things this plan must respect:

1. **Item 10 — trader/consumer:** "Prohibit + enforce" stays. No business-seller architecture pre-launch. Detection thresholds + Art. 30 fallback for edge cases. CJEU Kamenova (C-105/17) explicitly noted: trader threshold is *below* DAC7's 30/€2,000.
2. **Item 5 — liability cap:** Restructure inline, do not raise the floor. Consumer-protection priority must be inside the cap sentence, not adjacent.
3. **§B-1 — ADR bodies:** PTAC / VVTAT / TTJA are confirmed; EU ODR sunset on 2025-07-20 is correctly reflected.

This plan deliberately does **not** revisit those decisions.

The lawyer's 2026-04-28 follow-up at `docs/legal_audit/trader-detection-deferral.md` adds two more items binding on Phase 7: mandatory dismissal logging with structured rationale, and a soft-touch verification workflow between "signal fires" and "consider suspension."

---

## Reality vs PTAC — gap audit summary

| # | Gap | Reality | Verdict | Action |
|---|---|---|---|---|
| 1 | Order button — obligation to pay (§5.3) | Hardcoded EN `'Place order' / 'Pay €X'` in `CheckoutForm.tsx`; no i18n; no obligation note adjacent | ⚠️ Non-binding contract risk | **Phase 1** |
| 2 | Unfair clauses (§3) | §14 cap separated from carve-out; §16 no notice/in-flight; Seller §6 AML "at our discretion w/o notice"; §14 blanket "as is" | ⚠️ 4 distinct flags | **Phase 4** |
| 3 | Durable medium (§5.1, §5.2 / ECJ C-49/11) | Confirmation email has no T&C body, no withdrawal form. `/terms` is merchant-editable Next.js page (which is what C-49/11 actually objected to — fix is to put the text in the email body, not link to the page) | ⚠️ Material gap | **Phase 8** |
| 4 | Withdrawal disclosure on listing page (§2.5) | ✅ checkout has per-seller + global disclaimer; ❌ listing page silent | ⚠️ Pre-contract gap | **Phase 3** |
| 5 | Seller identity (§2.2) | No business-seller schema by design; `public_profiles` exposes id/name/avatar/country/created_at only | ✅ Aligned with lawyer's "prohibit + enforce" — depends on Gap 7 enforcement | **No standalone action** |
| 6 | ODR pre-contract visibility (§2.4 / PTAL 19.¹) | ✅ all 3 bodies named in Terms §15; ⚠️ buried — not on checkout or listing | ⚠️ Visibility gap | **Phase 2** |
| 7 | Seller eligibility (§6.1) | `/api/report-illegal-content` exists with Turnstile + rate limit + audit + email forward, but lacks queue/UI; no `seller_status` flag; no trader-volume detection | ⚠️ Multi-part | **Phases 5–7** (Phase 5 *extends* the existing route + adds queue; Phase 7 ships counters + audit + staff dashboard signal; automated suspension deferred per lawyer memo) |
| 8 | Discount labeling (§2.3) | No struck-through / "was X / now Y" UI exists | ✅ N/A | **None** |
| 9 | 24-month conformity reminder (§2.6) | Not present; private-only posture excludes the underlying right | ✅ N/A under current posture | **Document only (Phase 9)** |

---

## Phase 0 — Branch + workspace setup

### Task 0.1: Create feature branch from main

```bash
git fetch origin main
git checkout -b feature/ptac-compliance main
```

Verify: `git status` shows clean tree (untracked files from prior sessions like `docs/legal_audit/lawyer-response.md` may be present and should travel with us — they are pre-existing context, not committed yet), `git branch --show-current` returns `feature/ptac-compliance`.

### Task 0.2: Capture today's version stamp

Per `feedback_version_stamps_real_date.md`, version constants use today's real date (2026-04-28). Read `src/lib/legal/constants.ts` and note the current `TERMS_VERSION` and `SELLER_TERMS_VERSION` values (currently `2026-04-19` plus the `_DISPLAY` variants `'19 April 2026'`). The Terms revision in Phase 4 will bump all four constants to `2026-04-28` / `'28 April 2026'`.

---

## Phase 1 — Order button: obligation to pay (Gap 1)

**Goal:** Make the final commit click satisfy Noteikumu Nr.255 13.punkts (button labelled "obligation to pay" or with an explicit obligation note adjacent). Move both English variants behind i18n keys so the upcoming `lv.json` work lands cleanly.

### Task 1.1: Add i18n keys to en.json

**File:** `src/messages/en.json`

Add under `checkout` (or matching existing scope — verify by reading the file's top-level structure first):

```json
"placeOrderButton": "Place order",
"payButton": "Pay {amount}",
"obligationNote": "By clicking, you confirm an order with an obligation to pay."
```

### Task 1.2: Wire keys into CheckoutForm

**File:** `src/app/[locale]/checkout/CheckoutForm.tsx`

**Anchor:** the `<Button variant="primary" size="lg" className="w-full mt-4">` whose label uses `{walletCoversTotal ? 'Place order' : \`Pay ${formatCentsToCurrency(cardChargeCents)}\`}`. Located at the bottom of the Payment card.

Replace the hardcoded ternary on the button label with `useTranslations('checkout')` lookups, and insert the obligation note as a `<p className="text-xs text-text-muted text-center mt-2">…</p>` directly below the button, above the existing wallet/redirect helper text.

```tsx
<Button variant="primary" size="lg" className="w-full mt-4"
        onClick={handleCheckout} disabled={!canSubmit || loading} loading={loading}>
  {walletCoversTotal
    ? t('placeOrderButton')
    : t('payButton', { amount: formatCentsToCurrency(cardChargeCents) })}
</Button>
<p className="mt-2 text-xs text-text-muted text-center">{t('obligationNote')}</p>
```

### Task 1.3: Verify

Run `pnpm dev`, walk a wallet-only checkout and a card checkout, confirm both button states render the new label and the obligation note appears immediately below.

### Task 1.4: Commit

```bash
git add src/messages/en.json src/app/[locale]/checkout/CheckoutForm.tsx
git commit -m "feat(checkout): obligation-to-pay note + i18n button keys (PTAC §5.3)"
```

---

## Phase 2 — ADR pre-contract visibility (Gap 6)

**Goal:** Surface the buyer's home-country consumer ADR body on the checkout review step (the legal pre-contract moment), keyed to the buyer's `country`.

### Task 2.1: Extract ADR constants

**Create:** `src/lib/legal/adr-bodies.ts`

```ts
import type { Country } from '@/lib/country-utils';

export type AdrBody = {
  name: string;
  url: string;
  country: Country;
};

export const ADR_BODIES: Record<Country, AdrBody> = {
  LV: { name: 'Patērētāju tiesību aizsardzības centrs (PTAC)', url: 'https://www.ptac.gov.lv/lv/content/stridu-risinasanas-process', country: 'LV' },
  LT: { name: 'Valstybinė vartotojų teisių apsaugos tarnyba (VVTAT)', url: 'https://vvtat.lrv.lt', country: 'LT' },
  EE: { name: 'Tarbijakaitse ja Tehnilise Järelevalve Amet (TTJA)', url: 'https://www.ttja.ee', country: 'EE' },
};

export function getAdrBodyForBuyer(country: Country | undefined | null): AdrBody {
  return ADR_BODIES[country ?? 'LV'] ?? ADR_BODIES.LV;
}
```

### Task 2.2: Render ADR notice on checkout review step

**File:** `src/app/[locale]/checkout/CheckoutForm.tsx`

**Anchor:** the `<Checkbox>` block whose label includes `'I agree to the Terms & Conditions, including the cancellation and refund policy'`.

**Pre-task verify:** confirm where buyer country is sourced (likely `user_profiles.country` via the auth/profile loader, independent of parcel-locker selection — but check before assuming). If country is not yet on the props, thread it through from the page-level loader. Default to LV if the field is null/unset, but log a warning to Sentry — a missing country at checkout is a data-quality bug worth knowing about.

Insert a one-line block above the Terms checkbox. Use the `chunks` callback pattern that Phase 3 also uses, for consistency:

```tsx
const adr = getAdrBodyForBuyer(buyerCountry);
// …
<p className="text-xs text-text-muted">
  {t.rich('adrNotice', {
    link: (chunks) => <a className="link-brand" href={adr.url} target="_blank" rel="noopener">{chunks}</a>,
  }, { body: adr.name })}
</p>
```

i18n key (`src/messages/en.json` → `checkout.adrNotice`):
`"adrNotice": "Out-of-court dispute resolution: <link>{body}</link>."`

### Task 2.3: Cross-link Terms §15 to the constant

**File:** `src/app/[locale]/terms/page.tsx`

**Anchor:** section starting `'15. Governing law and disputes'`, the `<ul>` listing PTAC / VVTAT / TTJA.

Refactor the body names + URLs in §15 to read from `ADR_BODIES`. Single source of truth — version drift between checkout and terms becomes structurally impossible.

### Task 2.4: Verify + commit

Walk LV / LT / EE buyer checkouts (use Supabase admin to set test profile's `country`); each should show the matching body. Then:

```bash
git add src/lib/legal/adr-bodies.ts src/app/[locale]/checkout/CheckoutForm.tsx src/app/[locale]/terms/page.tsx src/messages/en.json
git commit -m "feat(checkout): pre-contract ADR body disclosure (PTAL 19.¹)"
```

---

## Phase 3 — Listing-page withdrawal notice (Gap 4)

**Goal:** Reinforce the private-seller framing one click earlier in the funnel. Single line, single link, on the listing detail seller card.

### Task 3.1: Add notice line + i18n key

**File:** `src/app/[locale]/listings/[id]/page.tsx`

**Anchor:** the `{/* Seller info */}` comment + the `<h2>Seller</h2>` block within the right-column card stack. Insert below the seller's stat row (member-since / sales-count / rating, before the trust-badge block).

```tsx
<p className="mt-3 text-xs text-text-muted">
  {t.rich('listing.sellerStatusNotice', {
    link: (chunks) => <Link className="link-brand" href="/terms#cancellations-refunds">{chunks}</Link>,
  })}
</p>
```

i18n: `"listing.sellerStatusNotice": "Private seller — the EU 14-day withdrawal right does not apply. <link>How returns work</link>."`

### Task 3.2: Verify + commit

```bash
git add src/app/[locale]/listings/[id]/page.tsx src/messages/en.json
git commit -m "feat(listings): pre-contract private-seller notice on detail page (PTAC §2.5)"
```

---

## Phase 4 — Terms revisions: inline carve-outs + notice period (Gap 2)

**Goal:** Apply the lawyer's Item 5 recommendation (inline restructuring) plus the three other unfair-clause patterns the research identified.

This phase is copy work + a version bump. Per `feedback_legal_copy_mirrors_code.md`, route every factual claim past the code-review agent before the version bump commits.

### Task 4.1: Rewrite Terms §14 (liability cap)

**File:** `src/app/[locale]/terms/page.tsx`

**Anchor:** section starting `'14. Limitation of liability'`, paragraph beginning `'To the maximum extent permitted by applicable law, our total liability'`.

Replace the cap paragraph + standalone carve-out with:

> "**Limitation of liability.** Our total liability to you in connection with the platform or these Terms is limited to the greater of (a) €500 and (b) the fees and commissions paid by you in the twelve months preceding the event giving rise to the claim, **except where mandatory consumer-protection law of your country of habitual residence requires otherwise — in which case that law prevails over this cap.** The platform is provided as is, **except where mandatory consumer-protection or other applicable law requires otherwise.** STG connects buyers and sellers but is not a party to the sale itself; we do not separately warrant the condition, authenticity, or quality of items listed by sellers, **save for any warranties imposed on us by mandatory law.**"

### Task 4.2: Rewrite Terms §16 (term modifications)

**File:** `src/app/[locale]/terms/page.tsx`

**Anchor:** section starting `'16. Changes to these terms'`.

> "**Changes to these Terms.** We may update these Terms from time to time. **For material changes that affect your rights or obligations, we will email registered users at least 14 days before the changes take effect.** Continued use of the platform after the effective date constitutes acceptance of the updated Terms. **Changes do not apply retroactively to orders placed before the effective date — those orders remain governed by the Terms in force when you placed them.**"

### Task 4.3: Rewrite Seller Terms §6 (AML/sanctions)

**File:** `src/app/[locale]/seller-terms/page.tsx`

**Anchor:** the `<h3>` titled `'Anti-money-laundering, sanctions, and fraud'` and the paragraph beginning `'We reserve the right — at our discretion and without prior notice'`.

Replace "at our discretion and without prior notice" with:

> "**On reasonable grounds, with notice as soon as legally permitted (notice may be delayed where required by AML, sanctions, or law-enforcement obligations), we may** (a) screen … (b) suspend your account, freeze your wallet balance, or refuse a payout … (d) share information with competent authorities. **You may appeal any such action through the internal complaint process described in the Terms of Service §13** — a person who did not take the original decision will review the appeal within 14 days."

### Task 4.4: Bump version constants

**File:** `src/lib/legal/constants.ts`

Bump all four constants (the `_DISPLAY` variants drive the user-facing "Last updated" line on each page; missing one produces visible drift):

```ts
export const TERMS_VERSION = '2026-04-28';
export const TERMS_VERSION_DISPLAY = '28 April 2026';
export const SELLER_TERMS_VERSION = '2026-04-28';
export const SELLER_TERMS_VERSION_DISPLAY = '28 April 2026';
```

`PRIVACY_VERSION` does **not** need bumping unless Phase 4 also touches Privacy content.

### Task 4.5: Update changelog footer

**File:** `src/app/[locale]/terms/page.tsx` and `seller-terms/page.tsx` — at the bottom of each, add:

> "Version 2026-04-28 — restructured liability and modification clauses for consumer-protection priority; added 14-day material-change notice; clarified AML appeal route."

### Task 4.6: Code-review pass

Per `feedback_legal_copy_mirrors_code.md`, dispatch `code-review` agent with the full Phase 4 diff and the question "do these clauses still hold against PTAL 5/6 unfair-terms doctrine and the lawyer's Item 5 recommendation?" Apply review notes before commit.

### Task 4.7: Commit

```bash
git add src/app/[locale]/terms/page.tsx src/app/[locale]/seller-terms/page.tsx src/lib/legal/constants.ts
git commit -m "fix(legal): inline consumer-rights carve-outs + 14-day modification notice (PTAC §3)"
```

---

## Phase 5 — DSA Art. 16 notice persistence + staff queue (Gap 7 part 1)

**Goal:** Add the queue + review UI that the existing `/api/report-illegal-content` route was always intended to feed (per CLAUDE.md:264, the queue + review UI was explicitly deferred). Extend the existing route with optional listing binding; do not duplicate the entrypoint.

> **Architecture note.** The `/api/report-illegal-content` route at [src/app/api/report-illegal-content/route.ts](src/app/api/report-illegal-content/route.ts) (136 lines) already implements: POST handler, CSRF guard via `requireBrowserOrigin`, Turnstile via `verifyTurnstileToken` + `getClientIp`, rate limit via `applyRateLimit(reportIllegalContentLimiter, request)` (1h window, 3 max), `logAuditEvent({ action: 'illegal_content.reported' })`, and Resend forward to `LEGAL_ENTITY_EMAIL`. Phase 5 *extends* this route, renames the audit event to the broader `dsa_notice.received`, and adds the persistence layer + staff UI. Single entrypoint for all DSA Art. 16 notices going forward.

### Task 5.0: Relocate the operator-precedence-trap lesson to audit.ts

**File:** [src/lib/services/audit.ts](src/lib/services/audit.ts) — at the `actorType` type definition (currently line 10).

Add a single-line comment immediately above or beside the type:

```ts
// Operator-precedence trap: '||' binds tighter than '?:'. To derive actorType from a possibly-empty
// value, write '(authedUserId || email) ? "user" : "system"' — without the parens, the ternary
// always returns "user".
actorType: 'user' | 'system' | 'cron';
```

The lesson lives at the site where the next caller will see it. This is the only code touch outside the route extension + table + staff UI in Phase 5.

### Task 5.1: Schema for DSA notices + audit-event rename

**File:** `supabase/migrations/<next-number>_dsa_notices.sql`

Note on `reporter_id` / `reporter_email` both being nullable: DSA Art. 16 explicitly permits anonymous notices. The Art. 16(5) confirmation-of-receipt obligation is satisfied by the absence of a notice provider to confirm to (operational constraint, not regulatory exemption). Art. 17 statement-of-reasons obligation runs to the *affected seller*, handled separately at the listings.status mutation site (see seller-side `notify` + `listing.actioned_by_staff` audit event in Task 5.4).

```sql
create table public.dsa_notices (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid references public.listings(id) on delete set null,
  reporter_id uuid references auth.users(id) on delete set null,
  reporter_email text,
  notifier_name text,
  category text not null check (
    category in ('counterfeit','ip_infringement','illegal_goods','csam','hate_or_harassment','misleading_listing','other')
  ),
  content_reference text not null,
  explanation text not null,
  status text not null default 'open' check (status in ('open','reviewing','actioned','dismissed')),
  staff_note text,
  reporter_ip inet,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

comment on table public.dsa_notices is
  'DSA Art. 16 notice-and-action queue. listing_id is nullable — not every notice is bound to a listing (e.g. notices about forum content, profiles, or future entities). Staff dashboard treats metadata->>"listing_id" IS NULL as a valid "non-listing-bound" case, not a data bug. Anonymous reports allowed (reporter_id + reporter_email both null); the Art. 16(5) confirmation-of-receipt obligation is satisfied by the absence of a notice provider to confirm to.';

create index idx_dsa_notices_listing on public.dsa_notices(listing_id) where listing_id is not null;
create index idx_dsa_notices_status on public.dsa_notices(status) where status in ('open','reviewing');

alter table public.dsa_notices enable row level security;

-- Anyone can insert (DSA Art. 16). Per-IP rate limit is enforced upstream by applyRateLimit(reportIllegalContentLimiter, request) in the route.
create policy dsa_notices_insert on public.dsa_notices
  for insert to anon, authenticated with check (true);

-- Only staff can read / update
create policy dsa_notices_staff_read on public.dsa_notices
  for select to authenticated using (
    exists (select 1 from public.user_profiles where id = auth.uid() and is_staff = true)
  );
create policy dsa_notices_staff_update on public.dsa_notices
  for update to authenticated using (
    exists (select 1 from public.user_profiles where id = auth.uid() and is_staff = true)
  );

-- Audit-event rename: 'illegal_content.reported' → 'dsa_notice.received' (broader DSA Art. 16 scope).
-- Live-test status: rows touched are test data; UPDATE pattern is what runs on prod.
update public.audit_log
   set action = 'dsa_notice.received'
 where action = 'illegal_content.reported';
```

### Task 5.2: Extend the existing `REPORT_CATEGORY_VALUES` enum with `misleading_listing`

**File:** `src/app/[locale]/report-illegal-content/categories.ts`

Add a seventh value to `REPORT_CATEGORY_VALUES` and `REPORT_CATEGORY_LABELS`:

```ts
// Existing six: counterfeit, ip_infringement, illegal_goods, csam, hate_or_harassment, other
// New seventh: misleading_listing (PTAC §6.1's most common marketplace-specific harm)
'misleading_listing'
// Label: 'Misleading listing (condition, edition, completeness, pricing)'
```

The `dsa_notices.category` CHECK constraint in Task 5.1 already mirrors the extended set. Single source of truth preserved.

### Task 5.3: Extend the existing route to accept `listing_id` + persist the notice

**File:** `src/app/api/report-illegal-content/route.ts`

After the existing audit-log write and Resend email forward, insert into `dsa_notices`:

```ts
const supabase = createServiceRoleClient();
await supabase.from('dsa_notices').insert({
  listing_id: typeof body.listingId === 'string' ? body.listingId : null,
  reporter_id: authedUserId, // null for anon
  reporter_email: notifierEmail || null,
  notifier_name: notifierName || null,
  category,
  content_reference: contentReference,
  explanation,
  reporter_ip: getClientIp(request) || null,
});
```

Update the existing `logAuditEvent` call to use the new event name `dsa_notice.received` and include `listing_id` in metadata when present. Also add the `notifyStaff` fan-out (defined in Task 5.4 below).

### Task 5.4: Add `notifyStaff` helper

**File:** `src/lib/notifications/index.ts` — extend the existing module (already exports `notify` and `notifyMany`).

```ts
export async function notifyStaff(
  type: NotificationType,
  context: NotificationContext,
): Promise<void> {
  const supabase = createServiceRoleClient();
  const { data: staff } = await supabase
    .from('user_profiles')
    .select('id')
    .eq('is_staff', true);
  if (!staff?.length) return;
  await notifyMany(staff.map((s) => s.id), type, context);
}
```

The route from Task 5.3 calls `void notifyStaff('dsa_notice.received', { noticeId, listingId, category, anonymous })`.

### Task 5.5: Add the listing-detail "Report" button

**File:** `src/app/[locale]/listings/[id]/page.tsx`

Add a small "Report listing" link/button near the seller card that opens the existing report-illegal-content flow with `listingId` pre-filled. Reuse the existing form at `src/app/[locale]/report-illegal-content/` — pass the listing id as a query parameter or pre-fill the `contentReference` field with the listing URL.

UI detail: the existing form already has Turnstile + submit-button loading state; nothing new to wire.

### Task 5.6: Staff queue + review UI

**File:** `src/app/[locale]/staff/notices/page.tsx` (new — replaces the planned `staff/reports/`)

List + filter by status. Sort: status group ascending, then anonymous-flag ascending (named first), then `created_at` ascending. Filter dropdown for the listing-bound vs unbound tri-state (any | bound | unbound).

Action buttons: "Mark reviewing", "Action listing" (calls existing soft-delete on the bound listing if any), "Dismiss". Each action sets `status` + `staff_note` + `resolved_at`.

When "Action listing" is clicked on a listing-bound notice, fire two distinct things — the seller-facing Art. 17 communication AND the internal audit event for the staff decision:

1. `notify(sellerId, 'listing.actioned', { reason, restrictionType, redressMechanism: '/terms#dsa-appeal' })` — DSA Art. 17 statement of reasons to the affected seller (per-listing email + in-app notification).
2. `void logAuditEvent({ actorType: 'user', actorId: staffId, action: 'listing.actioned_by_staff', resourceType: 'listing', resourceId: listingId, metadata: { noticeId, action: 'soft_delete'|'edit'|'flag_only', reasonCategory, reasonText, statementOfReasonsSentAt: <timestamp> } })` — the staff decision itself, separate from `dsa_notice.received`. The pair (`dsa_notice.received` + `listing.actioned_by_staff`) is the defensible audit record of "received notice → made decision → reasons given."

### Task 5.7: Tests

`src/lib/listings/dsa-notices.test.ts` — Vitest unit tests for the route's input validation extension (listing_id is optional UUID, category accepts the extended enum including `misleading_listing`).

### Task 5.8: Update CLAUDE.md audit-event entry

**File:** `CLAUDE.md` — under the `## Audit Events` section's `Registered events:` bullet list. Update the existing `illegal_content.reported` entry to `dsa_notice.received` (broader name) and append `listing.actioned_by_staff` as a peer.

### Task 5.9: Commit

```bash
git add supabase/migrations/ src/app/api/report-illegal-content/ src/app/[locale]/report-illegal-content/categories.ts src/lib/notifications/ src/app/[locale]/listings/[id]/page.tsx src/app/[locale]/staff/notices/ src/lib/services/audit.ts src/lib/listings/dsa-notices.test.ts CLAUDE.md
git commit -m "feat(moderation): persist DSA Art. 16 notices + staff queue + audit-event rename (PTAC §6.1, DSA Arts. 16-17)"
```

---

## Phase 6 — Seller status flag + suspension (Gap 7 part 2)

**Goal:** Schema + admin action to mark sellers `warned` / `suspended`, gating new listings the same way `dac7_status='blocked'` already does.

### Task 6.1: Schema migration

**File:** `supabase/migrations/<next>_seller_status.sql`

```sql
alter table public.user_profiles
  add column seller_status text not null default 'active'
    check (seller_status in ('active','warned','suspended'));

create index idx_user_profiles_seller_status on public.user_profiles(seller_status)
  where seller_status <> 'active';

comment on column public.user_profiles.seller_status is
  'PTAC §6.1 reputation gating — active|warned|suspended. Suspension blocks new listings and pauses live ones.';
```

### Task 6.2: Block listing creation when suspended

**File:** `src/lib/listings/actions.ts`

**Anchor:** the `if (profile.dac7_status === 'blocked')` gate (immediately after the profile-load + `if (profileError || !profile?.country)` block).

Extend the existing DAC7 gate:

```ts
if (profile.dac7_status === 'blocked') return { error: 'DAC7 tax info required' };
if (profile.seller_status === 'suspended') return { error: 'Account suspended; contact support' };
```

### Task 6.3: Trigger to pause live listings on suspension

**File:** `supabase/migrations/<next>_seller_status_listings_trigger.sql`

**Pre-task verified:** `listings.status` constraint at [032_auctions.sql:28](../../supabase/migrations/032_auctions.sql#L28) is currently `('active','sold','cancelled','reserved','auction_ended')` — `'paused'` must be added in this migration.

```sql
-- Extend listings.status to include 'paused' (currently active|sold|cancelled|reserved|auction_ended per migration 032)
alter table public.listings drop constraint if exists listings_status_check;
alter table public.listings add constraint listings_status_check
  check (status in ('active','sold','cancelled','reserved','auction_ended','paused'));

create or replace function public.pause_listings_on_suspension()
returns trigger language plpgsql security definer as $$
begin
  -- DELIBERATE ASYMMETRY #1: we pause on suspend but DO NOT auto-unpause on un-suspend.
  -- Rationale: a re-activated seller should manually re-list each item as a re-confirmation
  -- that the listing still complies with our terms. Auto-unpausing would re-publish stale
  -- or mis-priced listings without seller review. Do not "fix" this asymmetry without
  -- explicit product decision.
  --
  -- DELIBERATE ASYMMETRY #2: the WHERE filter only catches status='active'. Listings in
  -- 'reserved' (mid-checkout) and 'auction_ended' (winner has 24h to pay) are intentionally
  -- left in their current state. Disrupting in-flight transactions when a seller is
  -- suspended creates worse problems than the suspension solves — the buyer has already
  -- paid into escrow or won an auction in good faith. The staff suspension UI surfaces
  -- a warning when a seller has reserved/auction_ended listings; suspension still proceeds,
  -- but those orders complete normally.
  if new.seller_status = 'suspended' and old.seller_status <> 'suspended' then
    update public.listings set status = 'paused'
      where seller_id = new.id and status = 'active';
  end if;
  return new;
end $$;

comment on function public.pause_listings_on_suspension() is
  'Pauses active listings when seller is suspended. Intentionally (a) does not reverse on un-suspend, (b) leaves reserved/auction_ended listings alone so in-flight transactions complete. See function body comment for rationale.';

create trigger trg_pause_listings_on_suspension
  after update of seller_status on public.user_profiles
  for each row execute function public.pause_listings_on_suspension();
```

Also update any UI that filters on `status = 'active'` for browse/search to ensure paused listings are excluded (most queries already do this, but grep `status.*active` in `src/lib/listings/` and `src/app/[locale]/browse/` to verify).

### Task 6.4: Staff suspension UI

**File:** `src/app/[locale]/staff/users/[id]/page.tsx` (new)

Add a status selector + reason text + submit. Server action calls `logAuditEvent({ action: 'seller.status_changed', resourceType: 'user', resourceId: userId, metadata: { from, to, reason, actorStaffId, inFlightReservedCount, inFlightAuctionEndedCount } })`.

**In-flight transaction warning.** Before the submit button, query the seller's listings: if any have `status IN ('reserved', 'auction_ended')`, render a warning Alert: "This seller has N in-flight transaction(s) (reserved or auction-ended). Suspension will not pause those listings — buyers will still complete those orders. Active listings (M) will be paused immediately." Suspension still proceeds; the warning is informational, not a gate. This makes the trigger's deliberate asymmetry visible to staff at decision time rather than discoverable later.

### Task 6.5: Tests + commit

`src/lib/listings/actions.test.ts` — extend existing tests with a "suspended seller blocked from createListing" case. Run `pnpm verify`.

```bash
git add supabase/migrations/ src/lib/listings/actions.ts src/app/[locale]/staff/users/
git commit -m "feat(staff): seller_status enum + suspension blocks new listings (PTAC §6.1)"
```

---

## Phase 7 — Trader-volume measurement + soft-touch verification workflow (Gap 5 enforcement)

**Goal:** Build the data pipeline + the staff-driven verification workflow the lawyer's 2026-04-28 response laid out. Counters surface to staff at the 25-sales / €1,800-revenue threshold; staff initiates a community-vibe verification email; seller's response (or non-response) becomes structured evidence; staff dismisses or escalates with full audit trail. No automatic suspension at any threshold — suspension remains a human decision via Phase 6, now informed by verification.

> **Lawyer's framework (filed at `docs/legal_audit/trader-detection-deferral.md`).** Advisory + reactive enforcement is acceptable for launch, with two new requirements: (a) **mandatory dismissal logging** with structured rationale when staff reviews a signal and decides not to act, and (b) a **soft-touch verification workflow** that sits between "signal fires" and "consider suspension." Threshold: **25 sales** as the verification trigger; lawyer was silent on revenue counterpart, **decision recorded: €1,800** (DAC7's €2,000 minus a 200 buffer, fires on whichever crosses first). The hard-coded suspension tier is dropped entirely — suspension is purely a staff decision after verification.
>
> **Threshold values (locked in from lawyer correspondence):** verification trigger at 25 sales OR €1,800 in rolling 12 months. No automatic suspension threshold.

### Task 7.0: Lawyer correspondence on file (gate)

**This task gates the rest of Phase 7.** Verify that `docs/legal_audit/trader-detection-deferral.md` exists and contains:
1. The lawyer's confirmation that advisory + reactive enforcement is acceptable for launch.
2. The verification email template copy (the community-vibe wording the lawyer drafted — to be lifted directly with light voice polish in Task 7.5).
3. The 25-sales verification trigger.
4. The two new requirements (dismissal logging + verification workflow).

If the file is not on disk, **stop**. Phases 0-6 and 8 are independent and can ship while waiting.

### Task 7.1: Counter + verification columns

**File:** `supabase/migrations/<next>_seller_trader_workflow.sql`

```sql
alter table public.user_profiles
  -- Counters (rolling 12 months, refreshed daily by trader-signals cron)
  add column completed_sales_12mo_count integer not null default 0,
  add column completed_sales_12mo_revenue_cents integer not null default 0,
  -- Signal state
  add column trader_signal_first_crossed_at timestamptz,
  add column trader_signal_threshold_version text,
  -- Verification workflow
  add column verification_requested_at timestamptz,
  add column verification_response text check (verification_response in ('collector','trader','unresponsive')),
  add column verification_responded_at timestamptz;

create index idx_user_profiles_trader_signal on public.user_profiles(trader_signal_first_crossed_at)
  where trader_signal_first_crossed_at is not null;

create index idx_user_profiles_verification_pending on public.user_profiles(verification_requested_at)
  where verification_requested_at is not null and verification_response is null;

comment on column public.user_profiles.trader_signal_first_crossed_at is
  'Set when seller first crosses the verification trigger in TRADER_THRESHOLDS. Surfaces to staff dashboard. Does not auto-suspend. See docs/legal_audit/trader-detection-deferral.md.';
comment on column public.user_profiles.verification_requested_at is
  'When staff sent the soft-touch verification email. Sets the 14-day clock for verification-escalation cron.';
comment on column public.user_profiles.verification_response is
  'Seller''s self-classification: collector (private cull), trader (commercial), or unresponsive (no reply within 14d). Becomes structured evidence in any subsequent dismissal or suspension audit event.';
```

### Task 7.2: Constants file

**Create:** `src/lib/seller/trader-thresholds.ts`

```ts
export const TRADER_THRESHOLDS = {
  version: '2026-04-28-v2',
  // Advisory at launch per lawyer correspondence (docs/legal_audit/trader-detection-deferral.md).
  // No automatic seller_status writes — counters surface to staff dashboard, staff initiates
  // verification workflow, staff makes the dismiss-or-suspend decision after seeing the response.
  enforcement: 'advisory' as 'advisory' | 'automatic',
  // Lawyer's number: 25 sales as verification trigger.
  // Revenue: lawyer was silent; mirroring DAC7's €2,000 minus a 200 buffer = €1,800.
  // Fires on whichever crosses first.
  verificationTrigger: { salesCount: 25, revenueCents: 180_000 },
  // No suspendThreshold by design — suspension is purely a staff decision after verification.
  // The constant exists with explicit null so a future contributor doesn't add one without
  // re-reading the deferral memo.
  suspendThreshold: null,
  // Days between verification email send and unresponsive-escalation
  verificationResponseDeadlineDays: 14,
} as const;
```

### Task 7.3: New `trader-signals` cron route (separate from `dac7-reconcile`)

**Create:** `src/app/api/cron/trader-signals/route.ts` — runs daily.

Architectural separation: `dac7-reconcile` handles tax reporting; `trader-signals` handles enforcement counters. Different SLA categories, different failure modes — keeping them in separate files lets each fail independently and keeps either file from growing unwieldy. Pattern per [CLAUDE.md "Cron Routes"](CLAUDE.md#cron-routes): POST + Bearer auth.

Per seller, write rolling 12-month counters into the new columns. Then evaluate:

- If `completed_sales_12mo_count >= verificationTrigger.salesCount` OR `completed_sales_12mo_revenue_cents >= verificationTrigger.revenueCents`, AND `trader_signal_first_crossed_at IS NULL`:
  - Set `trader_signal_first_crossed_at = now()`, `trader_signal_threshold_version = TRADER_THRESHOLDS.version`.
  - Fire `logAuditEvent({ action: 'seller.trader_signal_crossed', resourceType: 'user', resourceId: sellerId, metadata: { count, revenue_cents, threshold_version, enforcement: TRADER_THRESHOLDS.enforcement, triggered_by: count >= 25 ? 'sales' : 'revenue' } })`.
  - **Do not** mutate `seller_status`. **Do not** notify the seller.
- If `enforcement === 'automatic'` (future flip): branch on the flag and write `seller_status = 'warned'` or `'suspended'` per pre-flip thresholds. Branch is unreachable at launch but its presence keeps the flip a one-line constant change.

Add the cron entry in Coolify (POST + Bearer `${CRON_SECRET}`).

### Task 7.4: Verification-escalation cron

**Create:** `src/app/api/cron/verification-escalation/route.ts` — runs daily.

For each seller where `verification_requested_at IS NOT NULL`, `verification_response IS NULL`, and `verification_requested_at + interval '14 days' < now()`:
- Set `verification_response = 'unresponsive'`, `verification_responded_at = now()`.
- Fire `logAuditEvent({ action: 'seller.verification_unresponsive', resourceType: 'user', resourceId: sellerId, metadata: { requested_at, escalation_days: 14 } })`.
- Surface the seller back to the staff dashboard (the index list filter from Task 7.6 picks up `verification_response = 'unresponsive'` rows automatically — no separate notification queue needed).

### Task 7.5: Verification email template

**Create:** `src/lib/email/templates/seller-verification-request.tsx`

Lift the lawyer's drafted email copy from `docs/legal_audit/trader-detection-deferral.md` verbatim, with light voice polish to match STG's "warm-factual" register (per memory `feedback_voice_board_gamey`). The community-vibe tone is doing real work here — stiff legal Latvian undermines the C2C-platform defense as much as the underlying logic. Localize via next-intl under `email.sellerVerificationRequest.*`. EN at launch; LV/LT/EE land with the locale rollout.

The email links to a self-classification flow at `/account/seller-verification` (Task 7.6 below) that lets the seller pick one of the three responses. No free-text required — the structured response is what feeds the staff decision.

### Task 7.6: Self-classification page + staff dashboard surfacing

**Create:** `src/app/[locale]/account/seller-verification/page.tsx` — three-radio form ("I'm a private collector culling my collection" / "I'm acting commercially as a trader" / "I'd rather not say"). Submit writes `verification_response`, `verification_responded_at`, fires `logAuditEvent({ action: 'seller.verification_responded', resourceType: 'user', resourceId: sellerId, metadata: { response, responded_within_days } })`. The "I'd rather not say" choice writes `'unresponsive'` and surfaces back to staff like the cron escalation.

**Extend:** `src/app/[locale]/staff/users/[id]/page.tsx` (Phase 6's page) — show:
- Counters: `completed_sales_12mo_count` / `revenue_cents` with `verificationTrigger` shown inline for context. Color the row warning-yellow if past the trigger.
- Verification state: "Not yet requested" / "Sent {date}, awaiting response" / "Responded {date}: collector|trader|unresponsive."
- Action buttons depending on state:
  - If signal crossed AND `verification_requested_at IS NULL`: **"Send verification request"** button → fires the email + sets `verification_requested_at` + fires `logAuditEvent({ action: 'seller.verification_requested', resourceType: 'user', resourceId, metadata: { staff_id, sales_count, revenue_cents } })`.
  - If `verification_response IS NOT NULL` (or unresponsive after 14d): **"Dismiss signal"** + **"Suspend seller"** buttons. Dismiss opens a modal capturing rationale (see Task 7.7).

**Create or extend:** the staff index list — surface sellers with `trader_signal_first_crossed_at IS NOT NULL` joined with `dsa_notices` counts. Sort: signal date descending, then unresponsive verifications first (those need staff action), then verified-collector last (lowest priority).

### Task 7.7: Dismissal-with-rationale flow (lawyer requirement)

The dismiss action from Task 7.6 opens a modal:

- **Rationale category** (required, dropdown): `verified_collector`, `low_engagement_pattern`, `marketplace_norm`, `other`
- **Free-text justification** (required, ≥ 50 chars): why this specific seller's pattern doesn't warrant action
- **Evidence URL** (optional): link to a comment thread, a verification response, a Phase 5 notice — anything material to the decision

On submit, fire `logAuditEvent({ actorType: 'user', actorId: staffId, action: 'seller.trader_signal_dismissed', resourceType: 'user', resourceId: sellerId, metadata: { rationale: { category, justification, evidenceUrl }, sellerCountAtDismissal: completed_sales_12mo_count, sellerRevenueAtDismissal: completed_sales_12mo_revenue_cents, verificationResponse: verification_response, signalThresholdVersion: trader_signal_threshold_version } })`.

This is the lawyer's **mandatory dismissal logging** requirement. Without it, "why didn't you act on the 45-sale seller" has no defensible answer. The structured metadata makes the answer queryable.

### Task 7.8: Audit-log registration in CLAUDE.md

**File:** `CLAUDE.md` — under the `## Audit Events` section's `Registered events:` bullet list.

Add five new events with the established format:
- `seller.trader_signal_crossed` — daily `trader-signals` cron, advisory only.
- `seller.verification_requested` — staff dashboard "Send verification request" action.
- `seller.verification_responded` — seller's self-classification submission.
- `seller.verification_unresponsive` — `verification-escalation` cron after 14 days.
- `seller.trader_signal_dismissed` — staff "Dismiss signal" with rationale.

Per `feedback_doc_couples_to_command_changes.md`, doc and code change in the same commit.

### Task 7.9: Tests

`src/lib/seller/trader-thresholds.test.ts` — pure unit tests over fake counter inputs:
- Counters under verification trigger → no signal
- Counters past sales trigger only → signal fires with `triggered_by: 'sales'`
- Counters past revenue trigger only → signal fires with `triggered_by: 'revenue'`
- "First crossed" guard: re-running cron on a seller with `trader_signal_first_crossed_at` already set doesn't re-fire the audit event
- `enforcement: 'automatic'` future-flip branch (unreachable at launch but tested for the day it's enabled)

`src/app/api/cron/verification-escalation/route.test.ts` — escalates only sellers past the 14-day window with no response; idempotent (re-running same day doesn't double-set `verification_response`).

### Task 7.10: Commit

```bash
git add supabase/migrations/ src/lib/seller/ src/lib/email/templates/ src/app/api/cron/ src/app/[locale]/staff/ src/app/[locale]/account/seller-verification/ CLAUDE.md docs/legal_audit/trader-detection-deferral.md src/messages/en.json
git commit -m "feat(seller): trader-volume signal + soft-touch verification workflow + dismissal logging (PTAC §6.1, lawyer 2026-04-28)"
```

---

## Phase 8 — Durable-medium delivery via inline email body (Gap 3)

**Goal:** Satisfy ECJ Content Services C-49/11 — the consumer receives the contract terms + the withdrawal-form template on a durable medium they hold and the seller cannot edit.

> **Read of C-49/11.** The case turned on a merchant linking to a *website page they could later change*. The court explicitly distinguished an email body that contains the text — once delivered, the buyer holds an immutable copy in their own inbox, outside merchant reach. Inline-in-email is the textbook solution; static PDFs are a more elaborate solution to a problem the simpler architecture doesn't have. We pick inline for low authoring + maintenance overhead. The link to `/terms` (the editable canonical page) remains as a navigation convenience but is not the durable medium — the email body is.
>
> **Convenience route deliberately not built.** A versioned `/legal/terms-v[version]` route was considered and dropped. The compliance argument lives in the email body, not a route; building 600 lines of JSX-to-markdown plumbing plus a new dependency for navigation help is misallocated effort. A user who deletes the email and wants the historical text emails support — operational cost, not compliance gap. Documented as a deferred fallback in Phase 9.

### Task 8.1: Add version stamp to orders

**File:** `supabase/migrations/<next>_orders_terms_version.sql`

```sql
alter table public.orders
  add column terms_version text,
  add column seller_terms_version text;

comment on column public.orders.terms_version is
  'TERMS_VERSION at the moment of order creation — preserves "what the buyer agreed to" for forensics, independent of email durable-medium delivery';
```

Backfill not needed (live-test status — current orders are test data; the stamp begins meaning something at first real order).

### Task 8.2: Stamp version at order creation

**Pre-task:** grep `from('orders').*insert\\|insert into.*orders` in `src/lib/services/` to find the actual insert site (likely a service in `src/lib/services/checkout/` or `src/lib/services/orders/`).

```ts
import { TERMS_VERSION, SELLER_TERMS_VERSION } from '@/lib/legal/constants';
// at the orders insert payload:
terms_version: TERMS_VERSION,
seller_terms_version: SELLER_TERMS_VERSION,
```

### Task 8.3: Author the inline contract-summary + withdrawal-form component

**Create:** `src/lib/email/templates/_OrderTermsSummary.tsx`

A self-contained React Email subcomponent that renders:
1. **Order-governing terms summary** — a one-screen prose block stating the parties (private seller, STG as platform), the price + shipping breakdown, the applicable terms version (`terms_version`), the no-EU-withdrawal-right framing (cross-linked to the seller status notice from Phase 3), the dispute-resolution path (Terms §13 + ADR body for the buyer's country, reading from `ADR_BODIES` introduced in Phase 2), and STG's legal-entity contact block from the imprint.
2. **Withdrawal form template (Annex B)** — the statutory template text, localized via next-intl. Even though the private-only posture means the right does not apply, including the template defensively closes the PTAC gap with no admissive cost. Frame it as "If you and the seller disagree on whether the seller is acting in a business capacity, you may submit this form within 14 days of delivery; we will review per Terms §15."

Localization keys live under `email.orderTerms.*` in `src/messages/en.json`, ready for the `lv.json` rollout.

### Task 8.4: Wire the summary into the buyer confirmation + extend the call site

**File 1:** `src/lib/email/templates/order-confirmation-buyer.tsx`

Insert `<OrderTermsSummary order={order} buyerLocale={buyerLocale} adr={adr} />` immediately above the existing footer.

**File 2:** `src/lib/email/index.ts` — extend the `sendOrderConfirmationToBuyer` params type with three new fields: `termsVersion: string`, `sellerTermsVersion: string`, `buyerLocale: string`. Pass them through the React Email `createElement` call.

**File 3 (call site):** `src/lib/email/cart-emails.ts` (the only call site, at `cart-emails.ts:67` per grep) — extend the call to pass the three new fields. Source `termsVersion` and `sellerTermsVersion` from the order row that's already loaded; source `buyerLocale` from the buyer's `user_profiles.preferred_locale` (default `'en'`).

### Task 8.5: Defensive memo

**Create:** `docs/legal_audit/durable-medium-defense.md`

Brief (≤ 1 page) note explaining why inline-in-email satisfies C-49/11 (the buyer's email client is the durable storage, the text is "provided" not "linked," the merchant has no edit access to the buyer's inbox). Reference the case's paragraph 51 specifically. This protects against future audit drift if a teammate later proposes "let's just link to /terms instead — it's simpler."

### Task 8.6: Tests + commit

- `src/lib/services/orders/create.test.ts` (or wherever the orders create-service test lives) — extend to assert the order row carries the current `TERMS_VERSION` and `SELLER_TERMS_VERSION`.
- `src/lib/email/templates/order-confirmation-buyer.test.tsx` (create if missing) — render the template with a fixture order, snapshot-test that the inline Terms summary block + Annex B form template are present in the rendered HTML.

```bash
git add supabase/migrations/ src/lib/services/ src/lib/email/ src/messages/en.json docs/legal_audit/durable-medium-defense.md
git commit -m "feat(email): inline durable-medium delivery of Terms summary + Annex B (ECJ C-49/11, PTAC §5.1-5.2)"
```

---

## Phase 9 — Documentation cleanup

### Task 9.1: Update legal_deferred_work.md

**File:** `docs/legal_audit/legal_deferred_work.md`

Add entries (one paragraph each, format consistent with existing entries):

- **24-month conformity reminder** — N/A under private-only posture; revisit if business-seller path opens (DSA Art. 30 phase). Revisit-signal: the day a `is_business` schema migration lands.
- **Insolvency / Lursoft cross-check** — defer to alongside DSA Art. 30 trader pathway (lawyer memo Phase 3 deferral). Revisit-signal: same trigger as above.
- **Discount labeling rules (PTAC §2.3)** — no UI exists today. Revisit-signal: any PR that adds a strikethrough price, "% off" badge, or `originalPrice` field to listings.
- **Proactive listing-content review** — reactive moderation via the Phase 5 DSA notices flow is launch-acceptable per lawyer memo §A item 1. Revisit-signal: monthly notice volume crosses 50/month or a single PTAC inquiry references a published listing's accuracy.
- **Automated trader-volume suspension** — Phase 7 ships counters + audit + staff signal but does not write `seller_status` automatically. Revisit-signal: lawyer's written confirmation referenced in `docs/legal_audit/trader-detection-deferral.md` recommends flipping to automatic, OR PTAC opens an inquiry citing trader-status concerns. Flip is one-line constant change to `TRADER_THRESHOLDS.enforcement = 'automatic'` in `src/lib/seller/trader-thresholds.ts` plus the unreachable-branch test in `src/lib/seller/trader-thresholds.test.ts` becomes the active path.
- **Static-PDF durable medium fallback / versioned `/legal/terms-v[version]` route** — Phase 8 ships inline-in-email durable medium per ECJ C-49/11. Two documented fallback paths if a future regulator interprets durable medium more narrowly: (a) versioned static PDFs in `public/legal/` attached to Resend email via the `attachments` field, OR (b) a versioned read-only route rendered from a TS const map. Either keeps the architectural path open. Revisit-signal: any regulatory or lawyer correspondence treating email body as insufficient.
- **Localized Annex B withdrawal-form templates (LV/LT/EE)** — Phase 8 ships English-only inline Annex B in the buyer confirmation email at launch, deferred to the next-intl LV/LT/EE rollout (~Week 3-4 per CLAUDE.md). Defensible because the private-only framing positions the right as inapplicable, but flag for prioritization if either (a) the framing softens or (b) a regulator reads private-only narrowly. Revisit-signal: same as the framing-softens trigger above; or any PTAC inquiry that asks for the LV-language withdrawal template. **Two-sources-of-truth note:** this entry intentionally duplicates content from this plan file. The plan file is the engineering execution log; this file is what staff and lawyers consult. Each surface needs the same fact stated for its own audience — do not "deduplicate" by removing one copy.
- **Unisend DPA / cross-border transfer audit** — verified on file as of 2026-04-28 (per session-end confirmation). Document filed; this entry retained as historical acknowledgement that the check was performed.

### Task 9.2: Verify CLAUDE.md audit-events section already updated

Each phase's commit was supposed to update CLAUDE.md inline. Phase 9 verifies coverage:

**File:** `CLAUDE.md` — under the existing `## Audit Events` section's `Registered events:` bullet list, the following events are now present (renamed/added across Phases 5 and 7):

- **`dsa_notice.received`** (renamed from `illegal_content.reported` in Phase 5) — fires from the existing `/api/report-illegal-content` route on inbound DSA Art. 16 notice. `actorType: 'system'` (external inbound). Metadata: `{ category, anonymous: boolean, notifierEmail?, contentReferencePreview, listing_id? }`. `resourceType` is still null (notices don't have stable identifiers from the route caller's perspective; the `dsa_notices.id` is the persistent row ID, looked up via the metadata query when needed). `listing_id` may be null for non-listing-bound notices — staff dashboard treats `metadata->>'listing_id' IS NULL` as the "non-listing-bound" case, not a data bug.
- **`listing.actioned_by_staff`** (Phase 5) — fires from staff dashboard "Action listing" alongside the seller-facing Art. 17 notification. Metadata: `{ noticeId, action: 'soft_delete'|'edit'|'flag_only', reasonCategory, reasonText, statementOfReasonsSentAt }`. `resourceType: 'listing'`, `resourceId: listingId`.
- **`seller.status_changed`** (Phase 6) — fires from staff suspension UI. Metadata: `{ from, to, reason, actorStaffId, inFlightReservedCount, inFlightAuctionEndedCount }`. `resourceType: 'user'`, `resourceId: sellerId`.
- **`seller.trader_signal_crossed`** (Phase 7) — fires from daily `trader-signals` cron when counters first cross 25-sales OR €1,800-revenue trigger. Advisory: does not mutate `seller_status` and does not notify the seller. Metadata: `{ count, revenue_cents, threshold_version, enforcement: 'advisory'|'automatic', triggered_by: 'sales'|'revenue' }`. `resourceType: 'user'`, `resourceId: sellerId`.
- **`seller.verification_requested`** (Phase 7) — staff dashboard "Send verification request" action. Metadata: `{ staff_id, sales_count, revenue_cents }`.
- **`seller.verification_responded`** (Phase 7) — `/account/seller-verification` self-classification submission. Metadata: `{ response: 'collector'|'trader'|'unresponsive', responded_within_days }`.
- **`seller.verification_unresponsive`** (Phase 7) — `verification-escalation` cron after 14 days. Metadata: `{ requested_at, escalation_days: 14 }`.
- **`seller.trader_signal_dismissed`** (Phase 7) — staff "Dismiss signal" with rationale modal. Mandatory per lawyer's 2026-04-28 framework. Metadata: `{ rationale: { category, justification, evidenceUrl? }, sellerCountAtDismissal, sellerRevenueAtDismissal, verificationResponse, signalThresholdVersion }`.

Per `feedback_doc_couples_to_command_changes.md`: each phase's commit updates CLAUDE.md inline. The Phase 9 commit covers any drift not already captured.

### Task 9.3: Final commit + push

```bash
git add docs/legal_audit/legal_deferred_work.md CLAUDE.md
git commit -m "docs(ptac): deferred-work entries + audit-event register coverage"
git push -u origin feature/ptac-compliance
gh pr create --title "PTAC distance-trading compliance" --body "$(cat <<'EOF'
## Summary
- Closes pre-contract / durable-medium / unfair-clause gaps from PTAC's 27.09.2017 distance-trading guidance, ground-truthed against the codebase
- Preserves the lawyer-memo-adjudicated "private-sellers-only" posture; no business-seller schema, no insolvency check pre-launch
- Phase 5 *extends* the existing `/api/report-illegal-content` route with persistence + staff queue + audit-event rename to `dsa_notice.received`; introduces `misleading_listing` category for marketplace-specific harm
- Phase 7 ships measurement infrastructure for trader-volume signals + soft-touch verification workflow + mandatory dismissal logging per lawyer 2026-04-28
- Phase 8 satisfies ECJ C-49/11 via inline-in-email durable medium + per-order `terms_version` stamp; static PDFs and convenience route deliberately not built

## Test plan
- [ ] `pnpm verify` green
- [ ] LV / LT / EE buyer checkouts each show the matching ADR body on the review step
- [ ] Wallet and card checkouts each render the obligation-to-pay note adjacent to the final button
- [ ] Listing detail page shows the private-seller pre-contract notice
- [ ] DSA notice submission via existing route succeeds (anonymous + authenticated); 4th submission per IP within 1h is rejected (existing `reportIllegalContentLimiter`); row lands in `dsa_notices`; `dsa_notice.received` audit event fires
- [ ] Staff suspension of a test seller pauses their live listings; un-suspension does NOT auto-unpause (deliberate); reserved/auction_ended listings unaffected
- [ ] First trader-signal threshold crossing fires `seller.trader_signal_crossed` audit event but does not mutate `seller_status` and does not notify the seller
- [ ] Staff "Send verification request" delivers the lawyer's email copy + sets `verification_requested_at` + fires `seller.verification_requested`
- [ ] Order confirmation email body contains the inline Terms summary + Annex B template; `terms_version` stamped on the order row
- [ ] PTAC §3 unfair-clause re-read: §14 cap + carve-out inline, §16 14-day notice + in-flight carve-out, Seller §6 AML softened wording
- [ ] `TERMS_VERSION` / `_DISPLAY` and `SELLER_TERMS_VERSION` / `_DISPLAY` all bumped to `2026-04-28` / `'28 April 2026'`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Verification checklist (run before merge)

- [ ] `pnpm verify` passes (type-check, lint, tests, build)
- [ ] LV / LT / EE checkout walkthroughs each show the matching ADR body
- [ ] Wallet-only and card checkouts each render the obligation note adjacent to the button
- [ ] Listing detail page shows the private-seller notice with working `/terms#cancellations-refunds` link
- [ ] Listing detail page has a "Report listing" entry that pre-fills the existing report-illegal-content form
- [ ] DSA notice submissions via the existing route succeed (anon + authed); Turnstile token verified server-side; 4th submission from same IP within 1h is rejected by `reportIllegalContentLimiter`; row persists in `dsa_notices`; `dsa_notice.received` audit event fires; pre-existing `illegal_content.reported` rows have been renamed by the migration UPDATE
- [ ] `dsa_notices` filter "unbound" + "bound" + "any" all return correct subsets in the staff queue
- [ ] Staff manual suspension of a test seller pauses their live `active` listings; toggling status back to `active` does NOT auto-unpause; `reserved` / `auction_ended` listings remain in their status; in-flight warning Alert renders when applicable
- [ ] Run `trader-signals` cron once: counter columns populate; sellers past 25-sales OR €1,800-revenue trigger `seller.trader_signal_crossed`; `seller_status` is NOT mutated; seller is NOT notified
- [ ] Staff "Send verification request" delivers the lawyer's email copy + sets `verification_requested_at` + fires `seller.verification_requested`
- [ ] `/account/seller-verification` page accepts the seller's self-classification, writes `verification_response` + `verification_responded_at`, fires `seller.verification_responded`
- [ ] `verification-escalation` cron flips a 14-day-overdue seller to `verification_response = 'unresponsive'` and fires `seller.verification_unresponsive`; idempotent on second run
- [ ] Staff "Dismiss signal" modal requires rationale category + ≥50-char justification, fires `seller.trader_signal_dismissed` with structured metadata (lawyer's mandatory dismissal logging)
- [ ] Staff "Action listing" fires both `notify(sellerId, 'listing.actioned', ...)` (Art. 17) and `logAuditEvent({ action: 'listing.actioned_by_staff', ... })` (internal audit)
- [ ] Order confirmation email body contains the inline Terms summary + Annex B template (no broken images, no missing translations); render is mobile-readable
- [ ] `terms_version` and `seller_terms_version` are stamped on a freshly created test order
- [ ] PTAC §3 unfair-clause patterns: re-read Terms §14, §16, Seller §6 against the table at the top of this plan and confirm each is now compliant
- [ ] `TERMS_VERSION`, `TERMS_VERSION_DISPLAY`, `SELLER_TERMS_VERSION`, `SELLER_TERMS_VERSION_DISPLAY` all bumped in [src/lib/legal/constants.ts](src/lib/legal/constants.ts)
- [ ] Code-review agent green on Phase 4 diff (per `feedback_legal_copy_mirrors_code.md`)
- [ ] Lawyer's written response to the Phase 7 deferral question is filed at `docs/legal_audit/trader-detection-deferral.md` BEFORE the Phase 7 commit
- [ ] Operator-precedence-trap comment present at [src/lib/services/audit.ts](src/lib/services/audit.ts) `actorType` type definition
- [ ] All eight new audit events (`dsa_notice.received`, `listing.actioned_by_staff`, `seller.status_changed`, `seller.trader_signal_crossed`, `seller.verification_requested`, `seller.verification_responded`, `seller.verification_unresponsive`, `seller.trader_signal_dismissed`) are documented in CLAUDE.md `## Audit Events`

---

## Out of scope — explicit non-goals

- Business-seller schema (`is_business`, `legal_name`, `registration_number`) — adjudicated against pre-launch by lawyer memo Item 10
- Lursoft / Registrų centras / Äriregister insolvency lookups — defer alongside Art. 30 pathway
- **Automated trader-volume suspension** — Phase 7 ships measurement only; the automatic-write branch is in code but unreachable behind `TRADER_THRESHOLDS.enforcement === 'advisory'`. Flip is a single-line constant change when policy posture changes.
- **Static-PDF durable medium** — Phase 8 uses inline-in-email per ECJ C-49/11. Static PDFs are a documented fallback (deferred work entry in Phase 9) if a regulator interprets durable medium more narrowly than email body.
- **Versioned `/legal/terms-v[version]` convenience route** — deliberately not built; the email body is the durable medium, the route would be navigation help requiring 600 lines of JSX-to-markdown rewrite plus a new dependency. Documented as deferred fallback alongside static PDFs.
- 24-month conformity-rights reminder copy — N/A under private-only posture
- Discount labeling rules — no discount UI exists
- LV translations of the new copy — landing in the next-intl LV rollout (~Week 3-4 per CLAUDE.md), not this plan

---

## Glossary

- **PTAC** — Patērētāju tiesību aizsardzības centrs, Latvian Consumer Rights Protection Centre. Source of the 27.09.2017 guidance this plan addresses.
- **PTAL** — Patērētāju tiesību aizsardzības likums, the Latvian Consumer Rights Protection Law.
- **NKAL** — Negodīgas komercprakses aizlieguma likums, the Unfair Commercial Practices Prohibition Law.
- **Noteikumi Nr.255** — Cabinet Regulation No. 255 of 2014-05-20, the Latvian transposition of CRD distance-contract rules.
- **CRD** — Consumer Rights Directive 2011/83/EU.
- **DSA** — Digital Services Act (Regulation (EU) 2022/2065). Art. 16 = notice-and-action; Art. 17 = statement of reasons; Art. 30 = trader traceability.
- **CJEU Kamenova** — Case C-105/17 (2018), seminal ruling that "trader" status under CRD attaches based on a non-exhaustive factor list, possibly below any statutory threshold.
- **ECJ Content Services** — Case C-49/11 (2012), seminal ruling that a hyperlink to a merchant-editable page is not a "durable medium."

# Auction Soft Close Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace today's 5-minute auction snipe rule with a 24-hour soft-close mechanic, reduce duration options to 7 and 14 days, and restructure the review-step UI to make auction settings a distinct subsection.

**Architecture:** SQL-side: one new migration changes the snipe block in the `place_bid` RPC from `INTERVAL '5 minutes'` to `INTERVAL '24 hours'` and additionally nulls `listings.auction_ending_soon_notified_at` atomically when the deadline extends (so the existing ending-soon cron re-fires for each new deadline without code changes). TS-side: narrow `AuctionDuration` to `7 | 14`, remove the dead `isInSnipeWindow` helper, add `SOFT_CLOSE_WINDOW_HOURS = 24`, consolidate the hardcoded validation array against the same constant. UI-side: split the review step's pricing block from a new "Auction settings" subsection with a button-group duration picker and a soft-close info row.

**Tech Stack:** Next.js 16, TypeScript, Supabase Postgres + RPC, Vitest, Tailwind, React 19.

**Source design:** `docs/plans/2026-05-23-auction-soft-close-design.md` is the authoritative WHAT; this plan is the HOW. Read the design doc first.

**Coding-standard notes (from CLAUDE.md):**
- Use the shared `Button` / `cn()` utilities; do not hand-roll className concatenation.
- Use design tokens, not raw Tailwind colors.
- Run `pnpm verify` before pushing — `pnpm build` alone is not a sufficient gate.

**Branching & gates:**
- All work on `feature/auction-soft-close` (branch from `main`, NOT from `docs/auction-soft-close-design`).
- Migration application to production is **double-gated** per project convention (`feedback_double_gate_db_mutations.md`): plan-approve → about-to-execute-confirm → execute. User executes the production migration, not Claude.
- Pre-merge active-auction count query is user-executed against production.

---

## Task 0: Branch setup

**Files:**
- (none — git operation)

**Step 1:** Confirm you're on `main` with a clean tree.

```
git status
```

Expected: `On branch main`, `working tree clean`.

**Step 2:** Branch from main.

```
git checkout main && git pull && git checkout -b feature/auction-soft-close
```

Expected: `Switched to a new branch 'feature/auction-soft-close'`.

---

## Task 1: Update auction constants and remove dead code

**Files:**
- Modify: `src/lib/auctions/types.ts` (lines 1–22, 105–110)

**Step 1:** Replace the constants block at the top:

```ts
export type AuctionDuration = 7 | 14;

export const AUCTION_DURATIONS: AuctionDuration[] = [7, 14];

export const AUCTION_DURATION_OPTIONS = [
  { value: '7', label: '7 days' },
  { value: '14', label: '14 days' },
];

export const MIN_BID_INCREMENT_CENTS = 100; // €1.00

export const SOFT_CLOSE_WINDOW_HOURS = 24;
export const QUIET_WINDOW_MS = 30 * 60 * 1000;

export const PAYMENT_DEADLINE_HOURS = 24;

export const PAYMENT_REMINDER_HOURS = 12;
```

**Step 2:** Delete `isInSnipeWindow` (lines 104–110). Confirmed dead code (0 callers as of 2026-05-23 — see design doc).

**Step 3:** Verify no references to removed symbols remain.

```
grep -rn "SNIPE_WINDOW_MINUTES\|isInSnipeWindow" --include="*.ts" --include="*.tsx" src/
```

Expected: no output. Empty result is the success signal.

**Step 4:** Type-check.

```
pnpm type-check
```

Expected: no errors related to `AuctionDuration` or `SNIPE_WINDOW_MINUTES`.

**Step 5:** Commit.

```
git add src/lib/auctions/types.ts
git commit -m "auctions: narrow duration to 7|14, drop snipe constants

Removes SNIPE_WINDOW_MINUTES and isInSnipeWindow (the helper had zero
callers). Adds SOFT_CLOSE_WINDOW_HOURS = 24 for UI copy. AUCTION_DURATION
options drop to 7 and 14 days; default selection logic updates downstream."
```

---

## Task 2: Fix server validation drift

**Files:**
- Modify: `src/lib/listings/actions.ts` (lines 208–221)

**Context:** Line 213 currently hardcodes `const validDurations = [1, 3, 5, 7]` instead of importing `AUCTION_DURATIONS` from `@/lib/auctions/types`. This is a pre-existing drift bug that Task 1 makes load-bearing — if we leave the hardcoded array alone, server validation would accept 1/3/5 days even though the UI offers only 7/14, and `place_bid` would silently work on any value because `auction_end_at` is just a timestamp.

**Step 1:** Add the import at the top of the file (alongside other imports).

```ts
import { AUCTION_DURATIONS } from '@/lib/auctions/types';
```

**Step 2:** Replace lines 213–215 with:

```ts
if (!AUCTION_DURATIONS.includes(data.auction_duration_days as 7 | 14)) {
  return { error: 'Invalid auction duration' };
}
```

The `as 7 | 14` cast is required because `data.auction_duration_days` is a `number` from the form; `AUCTION_DURATIONS.includes` is typed against the union.

**Step 3:** Type-check + lint.

```
pnpm type-check && pnpm lint
```

Expected: clean.

**Step 4:** Run tests touching `actions.ts` if any exist.

```
pnpm test src/lib/listings/
```

Expected: pass (or zero tests in that directory, which is also fine — no regression).

**Step 5:** Commit.

```
git add src/lib/listings/actions.ts
git commit -m "listings: validate auction duration against AUCTION_DURATIONS

Replaces hardcoded [1, 3, 5, 7] literal with the imported constant so
UI options, type narrowing, and server validation share one source."
```

---

## Task 3: pg_proc introspection test (failing first)

**Files:**
- Create: `src/lib/auctions/place-bid-rpc.test.ts`

**Context:** This test enforces the TS↔SQL contract for the soft-close window. It introspects the live `place_bid` function body and asserts the interval literal matches `SOFT_CLOSE_WINDOW_HOURS`. Written failing first; passes after Task 5 ships the migration.

The test runs against the local Supabase service-role client. Requires the service-role env vars to be set (same setup as other tests that hit Supabase directly — confirm with `pnpm test` once and check that the existing accounting tests don't fail with auth errors).

**Step 1:** Create the test file.

```ts
import { describe, it, expect } from 'vitest';
import { createServiceClient } from '@/lib/supabase';
import { SOFT_CLOSE_WINDOW_HOURS } from '@/lib/auctions/types';

describe('place_bid RPC', () => {
  it('extends auction_end_at by the configured SOFT_CLOSE_WINDOW_HOURS', async () => {
    const supabase = createServiceClient();

    // pg_proc lookup: get the function source for place_bid in the public schema
    const { data, error } = await supabase
      .rpc('pg_get_functiondef_safe', { funcname: 'public.place_bid' })
      .single();

    // If the helper RPC doesn't exist (most likely), fall back to a raw SQL call.
    // We expect it to be added as part of this migration, or use a direct query.
    if (error) {
      // Alternative: use a SQL select via the postgrest /rpc endpoint we already have
      // for diagnostics. If that's also unavailable, skip this assertion with a
      // clear failure message rather than silently passing.
      throw new Error(
        `Cannot introspect place_bid: ${error.message}. ` +
        `Ensure pg_get_functiondef is callable via service role.`
      );
    }

    const body = String(data);
    const match = body.match(/INTERVAL\s+'(\d+)\s*hours?'/i);
    expect(match, `place_bid body did not contain an INTERVAL 'N hours' literal:\n${body}`).not.toBeNull();
    expect(Number(match![1])).toBe(SOFT_CLOSE_WINDOW_HOURS);
  });
});
```

**Step 2:** Run the test. Expected: **FAIL** (current RPC has `INTERVAL '5 minutes'`, not hours, so the regex doesn't match — match is null and the first `expect(...).not.toBeNull()` fails with a clear message).

```
pnpm test src/lib/auctions/place-bid-rpc.test.ts
```

Expected: FAIL with "place_bid body did not contain an INTERVAL 'N hours' literal" OR the introspection RPC isn't available and you get the "Cannot introspect" error. Either failure mode is acceptable as the red-bar starting point.

**Step 3:** Decide: if the `pg_get_functiondef` access path doesn't work via the service-role client, pivot the test to query directly via a SQL view or a custom helper RPC. **Stop and confirm with the user before writing a new SQL helper purely for testing.** Acceptable alternative: skip this introspection test for v1 and rely on manual smoke verification + the diff review. Capture the decision in the PR description.

**Step 4 (if introspection works):** Commit the failing test.

```
git add src/lib/auctions/place-bid-rpc.test.ts
git commit -m "auctions: add failing test for soft-close window TS/SQL drift

Introspects place_bid's SQL body and asserts the INTERVAL literal
matches SOFT_CLOSE_WINDOW_HOURS. Will pass after migration 115 ships."
```

---

## Task 4: Compose the migration

**Files:**
- Create: `supabase/migrations/115_auction_soft_close.sql`

**Step 1:** Read the current `place_bid` definition to know exactly which UPDATE statement to modify.

```
grep -n "UPDATE public.listings\|auction_end_at\|INTERVAL '5 minutes'" supabase/migrations/032_auctions.sql
```

Note line ranges of the snipe block (lines 158–162) and the listings UPDATE statement that follows.

**Step 2:** Compose the new migration. Use `CREATE OR REPLACE FUNCTION` to redefine `place_bid` with the same signature; only the snipe block and the UPDATE statement change. **Copy the full function body from migration 032 and modify only the two changed regions** — do not write a "partial" migration that ALTERs the function definition; the function body is one atomic SQL artifact.

Skeleton:

```sql
-- 115_auction_soft_close.sql
-- Replaces the 5-minute snipe rule with a 24-hour soft-close window in place_bid.
-- Also nulls listings.auction_ending_soon_notified_at atomically when the deadline
-- extends, so the existing auction-ending-soon cron re-fires for each new deadline
-- without code changes on its side.
--
-- IMPORTANT: auction_original_end_at is the seller's original-deadline audit field.
-- This migration MUST NOT modify or null auction_original_end_at under any code path.

CREATE OR REPLACE FUNCTION public.place_bid(/* same signature as 032 */)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  -- (copy from 032)
BEGIN
  -- (copy from 032 up to the snipe block)

  -- Snipe protection: if bid within last 24 hours, extend by 24 hours
  v_new_end_at := v_listing.auction_end_at;
  IF v_listing.auction_end_at - NOW() < INTERVAL '24 hours' THEN
    v_new_end_at := NOW() + INTERVAL '24 hours';
  END IF;

  -- (existing INSERT INTO bids ...)

  -- Listings UPDATE: when extending, also null the ending-soon stamp.
  -- The COALESCE/CASE pattern below preserves the existing column value when
  -- v_new_end_at == v_listing.auction_end_at (no extension), and sets it to NULL
  -- when v_new_end_at differs (extension happened).
  UPDATE public.listings
  SET
    auction_end_at = v_new_end_at,
    current_bid_cents = p_amount_cents,
    bid_count = bid_count + 1,
    highest_bidder_id = p_bidder_id,
    auction_ending_soon_notified_at = CASE
      WHEN v_new_end_at <> v_listing.auction_end_at THEN NULL
      ELSE auction_ending_soon_notified_at
    END
  WHERE id = p_listing_id;

  -- (existing return)
END;
$$;

COMMENT ON COLUMN public.listings.auction_ending_soon_notified_at IS
'Timestamp of the last ending-soon notification batch for this auction. '
'Set by the auction-ending-soon cron when it dispatches. Nulled atomically '
'by place_bid when auction_end_at is extended, so the cron re-fires for '
'each new deadline. Null means "ready to notify for the current deadline."';
```

**Step 3:** Verify the full RPC body. The placeholder regions `(copy from 032)` must be replaced by the actual code from migration 032 — read that file and paste verbatim, modifying only the snipe block and the UPDATE statement.

```
grep -n "CREATE OR REPLACE FUNCTION public.place_bid\|^\$\$\|^END;" supabase/migrations/032_auctions.sql
```

This locates the function bounds.

**Step 4:** Apply the migration to local/dev Supabase.

```
pnpm supabase migration up
```

(If the project uses a different command — e.g., `supabase db push` or a custom script — substitute it. Check `package.json` scripts and the `supabase/` README first.)

Expected: migration applies cleanly. `place_bid` definition refreshed.

**Step 5:** Re-run the pg_proc introspection test from Task 3.

```
pnpm test src/lib/auctions/place-bid-rpc.test.ts
```

Expected: **PASS**. The interval literal now matches `SOFT_CLOSE_WINDOW_HOURS = 24`.

**Step 6:** Commit migration + green test.

```
git add supabase/migrations/115_auction_soft_close.sql
git commit -m "auctions: 24h soft close in place_bid (migration 115)

Replaces the 5-minute snipe window with 24-hour soft close. When the
deadline extends, atomically nulls listings.auction_ending_soon_notified_at
so the ending-soon cron re-fires for each new deadline. The cron's TS
code is unchanged.

auction_original_end_at is preserved as the seller's immutable original
deadline (NOT modified by this migration).

Test from previous commit flips from RED to GREEN."
```

---

## Task 5: Restructure ReviewPriceStep UI

**Files:**
- Modify: `src/app/[locale]/sell/_components/ReviewPriceStep.tsx` (lines 137–144, and surrounding structure in `PriceInputSection`)

**Step 1:** In the `PriceInputSection` component, replace the `<Select>` block at lines 137–144 with a button-group block. **Use the existing `Button` shared component** (variant tile/active state inline since this is single-use). Do NOT introduce raw `<button>` elements styled by hand — use design tokens via `Button` or a `cn()`-merged className on a div with role="radiogroup".

Suggested implementation (single-use, inline — no new shared atom):

```tsx
{isAuction && onDurationChange && (
  <div className="space-y-3">
    {/* Visual separator from the pricing block above */}
    <hr className="border-semantic-border-subtle" />

    <p className="text-sm font-semibold text-semantic-text-secondary uppercase tracking-wide">
      Auction settings
    </p>

    <div>
      <label className="block text-sm font-medium text-semantic-text-secondary mb-2">
        Auction duration
      </label>
      <div role="radiogroup" aria-label="Auction duration" className="grid grid-cols-2 gap-2">
        {AUCTION_DURATION_OPTIONS.map((opt) => {
          const selected = String(auctionDurationDays ?? 7) === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onDurationChange(parseInt(opt.value, 10))}
              className={cn(
                'rounded-lg px-4 py-3 text-sm font-medium transition-colors duration-250 ease-out-custom',
                selected
                  ? 'border-2 border-semantic-brand bg-semantic-brand/10 text-semantic-text-primary'
                  : 'border border-semantic-border-default text-semantic-text-secondary hover:border-semantic-border-strong',
              )}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>

    {/* Soft-close info row */}
    <div className="bg-semantic-bg-surface rounded-lg px-4 py-3">
      <p className="text-sm text-semantic-text-secondary">
        If someone bids in the final 24 hours, the auction extends by 24 hours. It ends when 24 hours pass with no new bid.
      </p>
    </div>
  </div>
)}
```

Add the missing imports at the top:

```ts
import { cn } from '@/lib/cn';
```

**Step 2:** Update the default fallback for `auctionDurationDays`. Line 141 currently reads `String(auctionDurationDays ?? 3)`. Change the fallback to `7` everywhere in this file. Grep:

```
grep -n "auctionDurationDays ?? 3\|auctionDurationDays ?? 1" src/app/[locale]/sell/_components/ReviewPriceStep.tsx
```

Expected: matches are now `?? 7`.

**Step 3:** Check the parent component that initializes `auctionDurationDays` — likely `ListingCreationFlow.tsx` in the same directory.

```
grep -n "auction_duration_days\|auctionDurationDays" src/app/[locale]/sell/_components/ListingCreationFlow.tsx
```

If the parent initializes with `1` or `3`, change to `7`. The default must be coherent with `AUCTION_DURATION_OPTIONS`.

**Step 4:** Manual visual check.

```
pnpm dev
```

Open `localhost:3000/en/sell`, walk through the flow to the auction review step (game → condition → photos → review with listing type = auction). Confirm:
- "Auction settings" subsection appears below the pricing block with a horizontal rule separator
- Two duration buttons render: `7 days` (active by default) and `14 days`
- Tapping `14 days` swaps the active state
- Soft-close info row reads: "If someone bids in the final 24 hours, the auction extends by 24 hours. It ends when 24 hours pass with no new bid."
- Mobile (375px viewport): buttons stack as a 2-column grid, both visible at once, comfortably tap-friendly (~44px tall)

**Step 5:** Lint + type-check.

```
pnpm lint && pnpm type-check
```

Expected: clean.

**Step 6:** Commit.

```
git add src/app/[locale]/sell/_components/ReviewPriceStep.tsx src/app/[locale]/sell/_components/ListingCreationFlow.tsx
git commit -m "sell: button-group auction duration + soft-close info row

Splits PriceInputSection's auction-specific controls into a distinct
'Auction settings' subsection (eyebrow label, hr separator). Replaces
the duration <Select> with an inline two-tile button group. Adds a
soft-close info row directly under the buttons.

Inline button-group (not a new shared atom) — single use today per the
design system 'extract at 2+ call sites' rule."
```

---

## Task 6: Listing-detail soft-close explainer

**Files:**
- Modify: the auction listing-detail component that renders the countdown. Locate it first.

**Step 1:** Find the countdown component.

```
grep -rn "auction_end_at\|countdown\|timeLeft" src/app/[locale]/listing src/components/listings 2>/dev/null | head -20
```

The most likely candidates are under `src/components/listings/` or `src/app/[locale]/listing/[id]/`. Identify the component that renders the live "Ends in 2d 14h" text.

**Step 2:** Add a one-line explainer under the countdown, only for auctions:

```tsx
<p className="text-xs text-semantic-text-muted">
  Bids in the final 24 hours extend the auction by 24 hours.
</p>
```

Style: text-xs, muted text token, consistent with existing fine-print rows in the file.

**Step 3:** Verify in browser. With `pnpm dev` still running, navigate to an existing auction listing detail page (create one via sell flow if none exist locally) and confirm the explainer renders under the countdown.

**Step 4:** Lint + type-check.

```
pnpm lint && pnpm type-check
```

Expected: clean.

**Step 5:** Commit.

```
git add <files>
git commit -m "listings: soft-close explainer under auction countdown"
```

---

## Task 7: Full verify

**Files:**
- (none — verification only)

**Step 1:** Run the full pre-deploy gate.

```
pnpm verify
```

Expected: type-check + lint + test + build all green. This is the real gate per CLAUDE.md (`pnpm build` alone is insufficient).

**Step 2:** If anything is red:
- TypeScript error: address it. Most likely place is `AuctionDuration` narrowing breaking some consumer that assumed 1/3/5.
- Lint error: address it.
- Test failure: identify which test, fix root cause, do NOT skip the test.
- Build error: address it.

Re-run `pnpm verify` until green. Do NOT proceed to Task 8 with red.

**Step 3:** If any tests required code changes, commit those changes.

---

## Task 8: Push branch and open PR

**Files:**
- (none — git/gh operation)

**Step 1:** Push.

```
git push -u origin feature/auction-soft-close
```

**Step 2:** Open PR against `main` with a body that calls out:
- Links to the design doc (`docs/plans/2026-05-23-auction-soft-close-design.md`)
- Migration is included (115)
- pg_proc introspection test added (or noted as skipped + why)
- Pre-merge gate: active-auction count query (the user runs this)
- Migration application to production is double-gated (the user executes)

```
gh pr create --base main --title "auctions: 24h soft close + 7/14d durations + UI restructure" --body "$(cat <<'EOF'
## Summary

Implements the design from \`docs/plans/2026-05-23-auction-soft-close-design.md\`.

- Replaces 5-min snipe rule with 24h soft close in \`place_bid\` (migration 115)
- Narrows \`AuctionDuration\` to \`7 | 14\` and consolidates the previously-hardcoded validation array
- Restructures the review step: button-group duration picker + "Auction settings" subsection + soft-close info row
- Adds soft-close explainer under the listing-detail countdown
- pg_proc introspection test guards against future TS↔SQL drift

\`auction_original_end_at\` is preserved (not modified by this migration).

## Pre-merge gates

- [ ] User runs the active-auction count query against production:
  \`\`\`sql
  SELECT count(*) FROM listings
  WHERE listing_type = 'auction' AND status = 'active';
  \`\`\`
  Expected: 0. If non-zero, design's in-flight handling section applies.
- [ ] User confirms migration 115 has been reviewed for the auction_original_end_at preservation guard.

## Migration application

Production migration is **double-gated**. User executes the apply; do not auto-apply from CI.

## Test plan

- [ ] Review the design doc and the diff together
- [ ] pg_proc introspection test passes locally
- [ ] Manual smoke on local dev: place a bid in the final 24h of a test auction, verify auction_end_at extends and auction_ending_soon_notified_at is nulled
- [ ] Manual smoke on staging (if available): same as above against the staging Supabase project
EOF
)"
```

---

## Task 9: Pre-merge gate (user-executed)

**Files:**
- (none — user action)

**Step 1:** User runs the active-auction count query against the production Supabase project (`tfxqbtcdkzdwfgsivvet`):

```sql
SELECT count(*) AS active_auctions
FROM listings
WHERE listing_type = 'auction' AND status = 'active';
```

**Step 2:** Branch on result.

- **0 active auctions:** proceed to Task 10. The migration ships into a clean slate.
- **>0 active auctions:** STOP. Reactivate the "In-flight auction handling" section of the design doc, decide explicitly whether to ship the duration narrowing now or block on auctions completing first. Do NOT proceed without an explicit decision committed to the design doc.

---

## Task 10: Apply migration to production (user-executed, double-gated)

**Files:**
- (none — user action)

**Step 1 (Gate 1 — already passed):** Design doc + plan approved.

**Step 2 (Gate 2):** User confirms "I'm about to apply migration 115 to production" before executing. Claude does not run this command; the user does, against production credentials, via the Supabase project's normal migration path.

**Step 3:** Apply.

```
# Whatever the project's prod migration command is
supabase db push --linked
```

**Step 4:** Verify post-apply.

```sql
-- Confirm the function definition contains '24 hours'
SELECT pg_get_functiondef('public.place_bid'::regprocedure);

-- Confirm the COMMENT ON COLUMN landed
SELECT col_description('public.listings'::regclass, attnum)
FROM pg_attribute
WHERE attrelid = 'public.listings'::regclass
  AND attname = 'auction_ending_soon_notified_at';
```

Both should return the new content.

**Step 5:** Merge the PR.

---

## Task 11: Post-merge cleanup

**Files:**
- (none — git/gh)

**Step 1:** Delete the feature branch locally and remote.

```
git checkout main && git pull && git branch -d feature/auction-soft-close
git push origin :feature/auction-soft-close
```

**Step 2:** Spot-check on production:
- Open `/sell` flow → auction → review step. Confirm button group renders, default is 7 days.
- Open an existing auction listing detail page. Confirm the soft-close explainer renders under the countdown.

---

## Out of scope / not in this PR

- Per-listing seller opt-out for soft close (design doc "future work")
- Hard cap on total duration (design doc "future work")
- Buyer-side "watch this auction" reminder (design doc "future work")
- Trial cap on extensions / observational threshold tooling (design doc "operational watch list")

---

## Risks watch list (during implementation)

- **`place_bid` body length:** The function is ~100 lines. Copying it verbatim in migration 115 with two changed regions is mechanical but error-prone. After composing, diff against migration 032 to confirm only the snipe block + UPDATE were touched.
- **Test infrastructure:** If `pg_get_functiondef` is not exposed to the service-role client, Task 3 needs an alternate approach. Stop and discuss before inventing a new SQL helper purely for testing.
- **Default duration cascade:** Several files may initialize `auctionDurationDays` (form parent, action defaults, server defaults). Task 5 catches the parent; grep wider if any default to `3` remains after Task 5.

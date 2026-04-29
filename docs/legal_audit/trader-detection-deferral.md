# Trader-detection deferral — lawyer correspondence (2026-04-28)

> **Provenance.** This file is a Claude-synthesized capture of the lawyer's
> 2026-04-28 follow-up to the trader-detection question raised after the
> 2026-04-26 review (filed at `docs/legal_audit/lawyer-response.md`). The
> original email/PDF should land here verbatim — this synthesis exists so
> Phase 7 of the PTAC plan can proceed without losing the four required
> elements (a)-(d) below.

## Question put to the lawyer

> "We are deferring automated suspension at the 10/€750 and 20/€1,500
> trader-volume thresholds. Reactive enforcement (Report Listing flow + staff
> suspension at /staff/users/[id]) plus internal staff dashboards surfacing the
> counter signal — is this acceptable to satisfy 'prohibit + enforce' at launch?"

## Lawyer's framework — four required elements

### (a) Confirmation: advisory + reactive enforcement is acceptable for launch

Yes. The advisory posture is fine for launch. The lawyer did **not** say
"automate it" or "I disagree with deferring suspension." Their entire framework
describes the advisory posture STG proposed. Two new requirements are added
to it (see (c) and (d) below).

The framing in `docs/legal_audit/lawyer-response.md` Item 10 ("prohibit +
enforce stays") is preserved. Reactive enforcement via the Phase 5 DSA notices
flow + Phase 6 staff suspension covers the obligation; counters in the staff
dashboard supplement the human decision rather than replacing it.

### (b) Verification email template (community-vibe wording)

The community tone is doing real work — stiff legal Latvian undermines the
C2C-platform defense as much as the underlying logic. Lift verbatim with light
voice polish for STG's "warm-factual" register (per memory
`feedback_voice_board_gamey`).

**Subject:** "A quick question about your selling on Second Turn Games"

> Hey {firstName},
>
> We've noticed you've been doing quite a bit of selling on Second Turn Games
> lately — {salesCount} games over the past year, which is fantastic for the
> community. Pre-loved games finding new homes is exactly what we're here for.
>
> We just need to ask a quick question to keep our paperwork straight. The
> short version: EU consumer law treats people who sell games **as a business
> or trade** differently from people who sell **from their personal collection**.
> Most of our community sits squarely in the second group — collectors thinning
> shelves, parents passing on games their kids outgrew, that kind of thing. But
> we need to confirm with you which side of that line you're on.
>
> Could you take 30 seconds to let us know?
>
> [I'm a private collector culling my collection]
> [I'm acting as a trader (running a shop, reselling for profit)]
> [I'd rather not say]
>
> If you don't reply within 14 days, we'll assume the third option and reach
> out again.
>
> If you're a trader, that's totally fine — we'll just switch on the trader
> features in your account so buyers see your business details and get the
> 14-day return rights they're entitled to.
>
> Thanks for being part of the community.
> The Second Turn Games team

**Implementation notes:**
- The three response options should land at `/account/seller-verification` as
  three radio buttons (Task 7.6).
- "I'd rather not say" writes `verification_response = 'unresponsive'` and
  surfaces the seller back to staff like the cron escalation.
- 14-day deadline is the lawyer's number; mirrors the `/sell` AML appeal SLA
  in Seller Terms §6.

### (c) Verification trigger threshold

**25 sales** in rolling 12 months.

Lawyer's reasoning: a 5-sale buffer below DAC7 (30/€2,000), so traders flagged
under DAC7 also necessarily go through the verification path; collectors who
spike to 26-29 sales in one year (e.g. parent decluttering after a kid moves
out) get a soft-touch email rather than a hard tax block.

**Revenue counterpart**: lawyer was silent. STG decision (recorded 2026-04-28):
mirror DAC7's €2,000 minus a 200 buffer = **€1,800**. Fires on whichever
crosses first — sales count or revenue.

**No automatic suspension threshold.** Suspension is purely a staff decision
after verification, with `verification_response` as evidence in the
dismissal-or-suspension audit record. The plan's `TRADER_THRESHOLDS.suspendThreshold`
ships as `null` with an explicit comment so a future contributor doesn't add
one without re-reading this memo.

### (d) Two new requirements added to the advisory posture

**1. Mandatory dismissal logging.** When staff reviews a `seller.trader_signal_crossed`
audit event and decides not to act, the dismissal itself must be audit-logged
with structured rationale:

- `actorId` — staff user ID
- `rationale.category` — one of: `verified_collector`, `low_engagement_pattern`,
  `marketplace_norm`, `other`
- `rationale.justification` — free-text, ≥50 chars
- `rationale.evidenceUrl` — optional link to a comment thread, verification
  response, Phase 5 notice, etc.
- `sellerCountAtDismissal`, `sellerRevenueAtDismissal`, `verificationResponse`,
  `signalThresholdVersion`

Without this, "why didn't you act on the 45-sale seller" has no defensible
answer. The structured metadata makes the answer queryable. Audit event:
`seller.trader_signal_dismissed`.

**2. Soft-touch verification workflow.** A new step sits between "signal
fires" and "consider suspension":

1. `seller.trader_signal_crossed` fires (cron), surfaces in staff dashboard
2. Staff reviews counter + report history; if pattern warrants, clicks
   "Send verification request"
3. Email above (b) goes out; `verification_requested_at` set;
   `seller.verification_requested` audit event fires
4. Seller responds via `/account/seller-verification`:
   - `'collector'` → `verification_response='collector'`,
     `verification_responded_at` set, signal can be dismissed with this as
     evidence
   - `'trader'` → `verification_response='trader'`, triggers DSA Art. 30
     trader pathway (deferred to a separate phase per `lawyer-response.md`)
   - `'unresponsive'` (user picked "I'd rather not say") →
     `verification_response='unresponsive'`, surfaces back to staff
5. Cron escalation: if `verification_requested_at > 14 days ago` and
   `verification_response IS NULL`, cron sets
   `verification_response='unresponsive'`, fires
   `seller.verification_unresponsive`, surfaces back to staff
6. Staff makes the dismiss-or-suspend decision with the response as evidence

## Out of scope for this lawyer correspondence

- DSA Art. 30 trader-data display when `verification_response='trader'` — the
  lawyer's earlier `lawyer-response.md` Item 10 already deferred Art. 30 to a
  later phase. Phase 7 just captures the response; the trader-mode UI is
  Phase-3-or-later work.
- Cross-border enforcement (LT/EE thresholds may differ) — out of scope at
  current scale.

## Revisit signals

- PTAC opens an inquiry citing trader-status concerns → flip `enforcement` to
  `'automatic'` in `src/lib/seller/trader-thresholds.ts` (one-line constant
  change, unreachable-branch test in `trader-thresholds.test.ts` becomes the
  active path)
- Lawyer issues new written guidance superseding this → file the new memo
  here, supersede this synthesis
- Original lawyer email/PDF arrives → replace this synthesis verbatim,
  preserve the provenance note at top

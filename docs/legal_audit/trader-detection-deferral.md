# Trader-detection deferral — lawyer correspondence (2026-04-28 + follow-up)

> **Provenance.** Two rounds of lawyer correspondence on 2026-04-28 are
> captured here: the original framework for the trader-volume verification
> workflow, and the follow-up that fixed the "trader option in the form"
> question we ran into during Phase 7 implementation. Both are on file. The
> verbatim email copy in §(b) is the lawyer's actual wording — don't
> paraphrase it without checking with them first.

## Background

`docs/legal_audit/lawyer-response.md` Item 10 deferred the DSA Art. 30 trader
pathway and confirmed the "prohibit + enforce" framing for launch. The
2026-04-28 follow-up added two requirements: mandatory dismissal logging
and a soft-touch verification workflow.

A second follow-up landed after we noticed the synthesized email was
promising "trader features" the platform doesn't have. The lawyer's answer:
**Option B — binary form**, with the trader case routed through the support
inbox rather than a structured radio button.

## Lawyer's framework — four required elements

### (a) Confirmation: advisory + reactive enforcement is acceptable for launch

Confirmed. Counters surface to staff and `seller_status` is never auto-mutated;
suspension stays a human decision.

The "prohibit + enforce" framing from `lawyer-response.md` Item 10 still holds.
The Phase 5 DSA notices flow + Phase 6 staff suspension cover the enforcement
side; counters supplement the human decision rather than replacing it.

### (b) Verification email — verbatim copy

> **Subject:** Checking in: please confirm your account status
>
> Hi [Name],
>
> Wow, you recently crossed 25 sales — you're officially one of STG's most
> active sellers!
>
> Because Second Turn Games is built specifically for private collectors
> culling their personal shelves, EU consumer protection rules require us to
> occasionally check in with high-volume sellers to ensure they aren't
> operating as commercial businesses.
>
> Could you take 30 seconds to confirm your account status here?
>
> **[Link to /account/seller-verification]**
>
> *Note: STG does not currently support commercial accounts. If you are
> acting as a registered business or trader, please reply directly to this
> email so we can help you wrap up any active orders.*
>
> If you have any questions, just hit reply. Thanks for helping us keep the
> STG community awesome!
>
> Best,
> The Second Turn Games Team

Implementation site: `src/lib/email/templates/seller-verification-request.tsx`.
The structured response page at `/account/seller-verification` is intentionally
binary (collector / 'd-rather-not-answer); commercial sellers respond via the
support inbox per the email's note.

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

### (d) Two requirements added to the advisory posture

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
`seller.trader_signal_dismissed`. Mandatory per the lawyer's framework.

**2. Soft-touch verification workflow (Option B — binary form).** A new step
sits between "signal fires" and "consider suspension":

1. `seller.trader_signal_crossed` fires (cron), surfaces in staff dashboard
2. Staff reviews counter + report history; if pattern warrants, clicks
   "Send verification request"
3. Verbatim email above (§b) goes out; `verification_requested_at` set;
   `seller.verification_requested` audit event fires
4. Seller responds via `/account/seller-verification`:
   - `'collector'` → `verification_response='collector'`,
     `verification_responded_at` set, signal can be dismissed with this as
     evidence
   - `'unresponsive'` (user picked "I'd rather not answer") →
     `verification_response='unresponsive'`, surfaces back to staff
   - **Trader case** → seller replies to the email (not the form); support
     team handles wind-down + closure of active orders. No structured
     `verification_response='trader'` is written by the user-facing form.
5. Cron escalation: if `verification_requested_at > 14 days ago` and
   `verification_response IS NULL`, cron sets
   `verification_response='unresponsive'`, fires
   `seller.verification_unresponsive`, surfaces back to staff
6. Staff makes the dismiss-or-suspend decision with the response as evidence

## Why the form is binary (DSA Art. 30 trap)

Adding an "I'm a trader" radio button to a private-only platform creates
liability under DSA Art. 30. Quoting the lawyer's response:

> *"In compliance, 'knowing' is a liability. If you provide a radio button
> that says 'I am a trader,' and a user clicks it, STG now has actual
> knowledge that a commercial entity is operating on the platform. You are
> immediately on the hook for either offboarding them for ToS violation or
> complying with DSA Art. 30. Option B avoids creating this structured trap."*

The DB schema's `verification_response` CHECK constraint still permits
`'trader'` because edge cases may surface via the support inbox where staff
manually annotates the seller's record — but the user-facing form's TypeScript
union narrows to `'collector' | 'unresponsive'` so the structured trap is
closed at the form layer.

## Out of scope for this lawyer correspondence

- DSA Art. 30 trader-data display and full trader pathway — `lawyer-response.md`
  Item 10 explicitly defers Art. 30 to a later phase. Phase 7 just captures
  the response signal; the trader-mode UI is post-launch work.
- Cross-border enforcement (LT/EE thresholds may differ) — out of scope at
  current scale.
- **Staff response guide for inbound trader confirmations** — lawyer offered
  to provide one; we should request it as the next follow-up. The trigger:
  a seller replies to the verification email with "I'm a business" — staff
  needs a documented playbook for offboarding (cancel listings, close active
  orders, wallet payout, account closure pathway).

## Revisit signals

- PTAC opens an inquiry citing trader-status concerns → flip `enforcement` to
  `'automatic'` in `src/lib/seller/trader-thresholds.ts` (one-line constant
  change, unreachable-branch test in `trader-thresholds.test.ts` becomes the
  active path)
- Lawyer issues new written guidance superseding this → file the new memo
  here, supersede this version with provenance preserved
- A seller actually replies to the verification email confirming commercial
  activity → request the staff response guide from the lawyer (offered in
  the 2026-04-28 follow-up); file it alongside this memo
- Volume of `seller.trader_signal_dismissed` audit entries crosses any
  internally-defined threshold suggesting the verification workflow is being
  used too liberally as a rubber stamp → review with lawyer before continuing

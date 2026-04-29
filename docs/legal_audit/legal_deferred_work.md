# Legal — deferred work

Tracking file for legal/compliance items that are deliberately out of scope
for current launch but documented so future maintainers know what was
considered, why it was deferred, and what would trigger revisiting.

**Two-sources-of-truth note (deliberate):** entries here may duplicate text
from `docs/plans/2026-04-28-ptac-distance-trading-compliance.md`. The plan
file is the engineering execution log; this file is what staff and lawyers
consult. Each surface needs the same fact stated for its own audience —
do not "deduplicate" by removing one copy.

---

## 24-month conformity-rights reminder (PTAC §2.6)

**Why deferred.** N/A under STG's private-sellers-only posture. The 24-month
right is a B2C consumer-protection right (Directive 1999/44/EC / 2019/771);
private individuals selling from personal collections aren't subject to it.

**Revisit signal.** The day a `is_business` schema migration lands on
`user_profiles` (i.e. when STG opens the trader pathway). At that point the
reminder must appear on every listing page where the seller is flagged as a
business, before the buyer commits.

---

## Insolvency / public-register cross-check (PTAC §6.1)

**Why deferred.** Lawyer memo `lawyer-response.md` Item 10 explicitly defers
the DSA Art. 30 trader pathway and the associated public-register checks
(Lursoft for LV, Centre of Registers for LT, Äriregister for EE) to a later
phase, alongside the trader-mode UI.

**Revisit signal.** Same trigger as the 24-month reminder — when the trader
pathway opens, the insolvency check is a sibling task. The check applies only
to sellers flagged as businesses, which is exactly the cohort the trader
pathway introduces.

---

## Discount labeling rules (PTAC §2.3)

**Why deferred.** No UI exists today. STG does not currently surface
strikethrough prices, "% off" badges, or any `originalPrice` field on
listings. The compliance question (what counts as a "previous price" under
Directive 98/6/EC as amended by 2019/2161) only arises when there's a
discount UI to attach it to.

**Revisit signal.** Any PR that adds a strikethrough price, "% off" badge,
or `originalPrice` field to listings. PTAC §2.3 requires the previous price
to have been the seller's actual price for at least 30 days before the
discount.

---

## Proactive listing-content review (PTAC §6.1)

**Why deferred.** Lawyer memo Item 1 confirms reactive moderation via the
DSA Art. 16 notice-and-action flow (`/api/report-illegal-content` +
`/staff/notices` queue, Phase 5 of the PTAC plan) is launch-acceptable.
Proactive pre-publication review doesn't scale and isn't strictly required
under DSA for the marketplace's current scale (Art. 19 micro-enterprise
exemption from Section 3 obligations).

**Revisit signal.** Either (a) monthly DSA notice volume crosses 50/month
or (b) a single PTAC inquiry references a published listing's accuracy or
illegal-goods exposure. Either trigger likely warrants a `pending_review`
listing state and a staff approval gate.

---

## Automated trader-volume suspension (Phase 7 advisory posture)

**Why deferred.** Per lawyer correspondence 2026-04-28
(`docs/legal_audit/trader-detection-deferral.md`), the verification
counters at 25 sales / €1,800 revenue surface to staff but never auto-mutate
`seller_status`. Suspension remains a human decision after the soft-touch
verification workflow.

**Revisit signal.** Either (a) lawyer issues new guidance recommending
automation, or (b) PTAC opens an inquiry citing trader-status concerns.

**Flip mechanism.** Single-line constant change to
`TRADER_THRESHOLDS.enforcement = 'automatic'` in
`src/lib/seller/trader-thresholds.ts`. The unreachable-branch test in
`src/lib/seller/trader-thresholds.test.ts` keeps the future-flip path
syntactically green during the cron's lifetime — flipping the flag activates
it without a code rewrite.

---

## Static-PDF durable medium fallback / versioned `/legal/terms-v[version]` route

**Why deferred.** Phase 8 ships inline-in-email durable medium per ECJ
C-49/11 — the buyer's email client is the durable storage. Defense memo:
`docs/legal_audit/durable-medium-defense.md`.

If a future regulator interprets durable medium more narrowly than the email
body (e.g. "must be a downloadable attachment, body text is insufficient"),
two documented fallback paths exist:

1. **Versioned static PDFs** in `public/legal/terms-v[version].pdf`,
   attached to Resend email via the `attachments` field. Adds a per-version
   manual authoring burden + four-locale PDF translation effort.
2. **Versioned read-only Next.js route** at `/legal/terms-v[version]`,
   rendered from a TS const map. Requires JSX-to-markdown refactor of the
   594-line `/terms` page + a `react-markdown` dependency.

Either keeps the architectural path open without building it speculatively.

**Revisit signal.** Any regulatory or lawyer correspondence treating email
body as insufficient.

---

## Localized Annex B withdrawal-form templates (LV/LT/EE)

**Why deferred.** Phase 8 ships English-only inline Annex B in the buyer
confirmation email at launch, per the next-intl LV/LT/EE rollout cadence
(~Week 3-4 per CLAUDE.md). Defensible because the private-only framing
positions the right as inapplicable — the form is included defensively, not
as an admission that the right applies.

**Revisit signal.** Either (a) the private-only framing softens (i.e. the
trader pathway opens) or (b) a regulator reads the private-only framing
narrowly and asks for the LV-language withdrawal template. Either trigger
makes the Latvian Annex B mandatory rather than optional.

---

## Unisend DPA / cross-border transfer audit

**Status.** Verified on file as of 2026-04-28 (per session-end confirmation).
Document filed; this entry retained as historical acknowledgement that the
check was performed during the PTAC compliance work.

**Revisit signal.** Annual DPA review or any change in Unisend's
sub-processors (transfer of buyer PII to a new processor would require an
update to STG's Privacy Policy processor list).

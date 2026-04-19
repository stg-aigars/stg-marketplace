# Second Turn Games — Legal Review Brief

**Prepared:** 19 April 2026
**For:** Outside legal counsel
**Prepared by:** STG engineering + product
**Scope:** Review of public-facing legal documents (Terms of Service, Privacy Policy, Seller Agreement, Cookie Policy, Accessibility Statement) and the underlying business/payment/data architecture they describe.

## How to use this document

This brief pairs each review item with (a) the question we need you to answer, (b) our current position and the code or clause that implements it, (c) proposed draft language where we have one, and (d) an escalation path when the item is not resolvable at the doc-drafting layer. Where a question could have a product/engineering answer rather than a legal one, we flag it explicitly — please tell us when the right fix is outside your scope.

All cited files live in the `stg-aigars/stg-marketplace` repository on GitHub. Paths are stable against `main` as of the prepared date.

---

## Part 1 — Context

### Business model

Second Turn Games SIA (reg. 50203665371, Evalda Valtera 5-35, Riga, LV-1021, Latvia; VAT LV50203665371) operates a peer-to-peer marketplace for pre-loved board games, live in Latvia, Lithuania, and Estonia from launch. Three defining facts:

1. **All sellers are private individuals.** Not businesses, not traders, not resellers. The platform prohibits commercial reselling in its Seller Agreement and flags suspected commercial activity as grounds for suspension.
2. **STG is not a party to the sale contract.** Each sale contract is concluded directly between the private buyer and the private seller. STG provides the listing surface, mediates payment, arranges shipping, and runs dispute resolution.
3. **STG receives buyer payments as the seller's commercial agent.** We rely on PSD2 Article 3(b) (the commercial-agent exemption) — see item 2 below for the framing question we need your opinion on.

Key operational facts engineering and product believe apply:

- Payments are processed through EveryPay (Maksekeskus AS, Swedbank). Orders are only created after payment is confirmed.
- Shipping is exclusively through the Unisend parcel locker network (Unisend, Latvijas Pasts, uDrop terminals).
- Commission is 10% flat on the item price (not on shipping). Buyers pay item price + shipping; no service fee.
- Seller funds land in a platform-hosted wallet (integer cents); sellers withdraw to their own IBAN.
- Dispute window is 2 days after delivery.
- Order state machine: `pending_seller → accepted → shipped → delivered → completed`, with `cancelled` / `disputed → resolved` side paths.
- DAC7 thresholds (30 sales / €2,000 per calendar year) trigger reporting to the Latvian State Revenue Service (VID). We ask for TIN + DOB + address at an internal early-warning threshold (25 sales / €1,750) so reporting is not held up.
- Supabase (EU region, Stockholm) is our database and auth provider. Hetzner (Helsinki, HEL1) hosts the Next.js application.

### Current legal stack (as shipped)

All documents live at stable URLs on secondturn.games and as TSX source files in the repo:

| Document | URL | Source |
|---|---|---|
| Terms of Service | `/terms` | `src/app/[locale]/terms/page.tsx` |
| Privacy Policy | `/privacy` | `src/app/[locale]/privacy/page.tsx` |
| Seller Agreement | `/seller-terms` | `src/app/[locale]/seller-terms/page.tsx` |
| Cookie Policy | `/cookies` | `src/app/[locale]/cookies/page.tsx` |
| Accessibility Statement | `/accessibility` | `src/app/[locale]/accessibility/page.tsx` |

Version stamp: `TERMS_VERSION = '2026-04-19'` in `src/lib/legal/constants.ts`. Every legal page renders this date inline.

### Regulatory frameworks we believe apply

- **GDPR** (Regulation (EU) 2016/679) — data controller obligations, data-subject rights, processor disclosures, retention, breach notification, Art. 30 records.
- **DSA** (Regulation (EU) 2022/2065) — intermediary obligations: SPOCs (Art. 11/12), notice-and-action (Art. 16), statement of reasons (Art. 17), internal complaint handling (Art. 20), trader identification (Art. 30), transparency reporting (Art. 15). Possible Art. 19 small-platform exemptions — see item 1.
- **DAC7** (Council Directive (EU) 2021/514 amending Directive 2011/16/EU) — seller identification + reporting by marketplaces.
- **PSD2** (Directive (EU) 2015/2366) — specifically Article 3(b), the commercial-agent exemption.
- **ePrivacy Directive** (2002/58/EC as amended) — cookie and browser-storage disclosure.
- **Consumer Rights Directive** (2011/83/EU) — 14-day withdrawal, statutory conformity. We currently disapply these on the basis that sellers are private individuals, not traders.
- **Rome I** (Regulation (EC) 593/2008) — governing law and consumer-jurisdiction rules for LT/EE residents.
- **Latvia Commercial Law §8** — website identification requirements.
- **Latvia Accounting Law (Grāmatvedības likums)** — accounting-record retention.
- **Latvia VAT Law (PVN likums) Art. 133** — VAT-document retention.
- **E-Commerce Directive** (2000/31/EC) — Art. 5 information obligations.
- **European Accessibility Act** (Directive (EU) 2019/882) — applies to e-commerce services since 28 June 2025.

### What we have already done (Phase 1, merged 2026-04-19)

The following were implemented before this review by us — no legal sign-off sought yet, but all are low-risk factual corrections, disclosures, or descriptions of implemented behaviour. Please flag any that you think need revision, but we do not expect you to redraft them from scratch.

- Privacy §1: full controller identification + data-protection contact at `privacy@secondturn.games`.
- Privacy §2: disclosure of the fields exposed on public profiles (display name, country, avatar, created-at, public reviews).
- Privacy §3: legal-bases table with DAC7 row (Art. 6(1)(c)) and fraud-prevention row (Art. 6(1)(f)) added.
- Privacy §5: photo-cleanup documented (`cleanup-photos` cron removes listing photos from storage within 6 hours).
- Privacy §6: full processor rewrite grouped by role (payments / shipping / messaging; authentication; infrastructure; observability; outgoing browser connections). Named processors: EveryPay, Unisend, Resend, Google, Meta Platforms Ireland, Supabase, Hetzner, Cloudflare (incl. Turnstile), Sentry, PostHog. BGG disclosed as outbound browser contact (image hotlink from `cf.geekdo-images.com`) — not a processor.
- Privacy §8: GDPR Art. 77 right-to-complaint bullet added, cross-referenced to DVI in §12.
- Privacy §9: retention restructured by record type — account profile anonymized immediately on deletion, active listings + photos until removed, completed orders / invoices up to 10 years (Grāmatvedības likums + PVN likums Art. 133 — see item 12), DAC7 seller data 10 years, reviews retained on reviewed seller's profile, comments anonymized on account deletion, security logs 30 days. No grace-period fiction — deletion is immediate.
- Terms §14: ADR routing by country (PTAC for LV, VVTAT for LT, TTJA for EE). No ODR link (Regulation (EU) 2024/3228 repealed the ODR Regulation; platform closed 20 July 2025).
- Terms §16: DSA Art. 12 single-point-of-contact for users designated as `info@secondturn.games`.
- New `/cookies` page — full ePrivacy Art. 5(3) disclosure. PostHog runs in cookieless mode; client IPs are stripped at our first-party reverse proxy (`/ingest`) before events leave our server.
- New `/accessibility` stub — EAA commitment placeholder. Full statement to follow.
- Audit-log row on every terms acceptance (`action='terms.accepted'`, `resourceId=TERMS_VERSION`). Two sources in metadata: `'signup'` (email) and `'oauth_onboarding'` (OAuth). Append-only history for future re-consent defensibility.
- Signup and OAuth-onboarding checkbox copy: "I am at least 16 years old and I agree to the Terms of Service and Privacy Policy."

Footer imprint block is currently minimal (copyright + contact email only). Full imprint placement — `/imprint` page vs footer block vs Terms §1 only — is an open question for item 11.

---

## Part 2 — Items for review

### 1. DSA compliance block

**Question.** Which DSA obligations apply to STG as a non-VLOP intermediary, and how much can Art. 19 small-platform exemptions narrow the scope? We need drafted text for the obligations that apply and a clear skip-list for the ones that don't.

**Current position.** We have a single Art. 12 user-SPOC designation in Terms §16. We have no drafted text for:
- Art. 11 authorities SPOC
- Art. 16 notice-and-action mechanism (and the associated public-facing web form — planned at `/report-illegal-content`)
- Art. 17 statement of reasons on moderation actions
- Art. 20 internal complaint-handling / appeal path
- Art. 30 trader identification
- Art. 15 annual transparency report

Engineering is already wiring an audit log (`logAuditEvent` in `src/lib/services/audit.ts`) that captures moderation actions, which we believe will support Art. 17 statement-of-reasons claims. We have no complaint-handling UI or appeal path today.

**Proposed draft language.** Deferred to you. We can provide plain-English sketches of operational behaviour (how moderation happens, who reviews appeals, how we capture reasons), but the Art. 16/17/20 wording must survive regulator scrutiny.

**Escalation path.** If the full block is too much for an unlaunched platform, please flag which specific Art. 19 carve-outs apply and which obligations are hard-required regardless of scale. We do not want to gold-plate obligations that don't apply.

### 2. PSD2 Article 3(b) commercial-agent framing

**Question.** Is the commercial-agent exemption still defensible given our multi-day fund-holding window and our active role in dispute resolution? The 2019 EBA Guidelines narrowed Art. 3(b) considerably — the agent must act for only one side of the transaction with genuine authority.

**Current position.** Terms §1 and Seller Agreement §2 state that STG acts as the seller's commercial agent under PSD2 Art. 3(b). Funds are held by the platform until the order is completed or the dispute window closes. STG actively mediates disputes and can issue refunds from held funds.

**Proposed draft language.** Existing Terms §1 and Seller §2 language is in place. We need your confirmation (or redline) that this framing is still sound.

**Escalation path — important.** If your conclusion is that the exemption is *not* defensible, this becomes a product decision, not a drafting redline. The options in that case are:
- Partner with a licensed payment institution or e-money institution to hold funds in escrow on our behalf.
- Restructure payouts so STG never holds funds (immediate pass-through on payment confirmation, shifting chargeback risk).
- Pursue our own payment-institution license.

Please flag this explicitly in your report if you reach that conclusion — we need to know so we can scope the work early.

### 3. Rome I jurisdiction clause for LT and EE consumers

**Question.** Can we restrict jurisdiction to the courts of Riga against consumers habitually resident in Lithuania or Estonia, given that STG explicitly directs activity to both markets?

**Current position.** Terms §14 currently says "Disputes arising from these terms or use of the platform fall under the jurisdiction of the courts of Riga, Latvia." Our understanding is that under Rome I Art. 6, a consumer can always sue in their country of habitual residence when the trader directs activity there.

**Proposed draft language.** Replace the current clause with "Disputes are governed by Latvian law and subject to the jurisdiction of the courts of Riga, without prejudice to any mandatory consumer protection rules in your country of habitual residence."

**Escalation path.** None — drafting fix only.

### 4. Wallet mechanics and seller protections

**Question.** The Seller Agreement §5 describes wallet and payouts at a high level, but is missing operational terms that become load-bearing during chargebacks, dormant accounts, or negative balances.

**Current position.** §5 currently covers: earnings crediting, order-completion timing, withdrawal to seller IBAN, processing time. It is silent on:

- Minimum withdrawal amount (if any)
- Chargeback clawback — what happens if a buyer card-disputes a completed order after seller has withdrawn
- Currency (EUR)
- KYC / IBAN verification (what, when, why)
- Dormant wallet / escheatment policy (varies by country)
- Negative-balance handling (e.g. post-completion refund ordered after withdrawal)

The chargeback case is the operationally riskiest: buyer disputes, STG owes EveryPay, seller has already withdrawn. We need a contractual right to claw back from future wallet balance and, failing that, to pursue the seller directly.

**Proposed draft language.** We can sketch the mechanics; we need you to translate them into enforceable terms against a private seller (who is not a trader and not subject to commercial-seller obligations).

**Escalation path.** If the chargeback-clawback right is not enforceable against a private seller without additional contractual mechanics (e.g. pre-authorised debit mandate, collateral), please flag.

### 5. €100 liability floor in Terms §13

**Question.** Keep the €100 "whichever is greater" floor in Terms §13, raise it, or remove it in favour of "to the maximum extent permitted by law"?

**Current position.** Terms §13 currently states that STG's total liability to any user is limited to €100 or the service fees paid by that user in the preceding 12 months, whichever is greater.

**Proposed draft language.** Open to your judgment. Our concern is that €100 is low enough to be challenged as an unfair term under Latvian consumer law and broader EU unfair-terms doctrine. The "whichever is greater" framing helps but isn't a clean defence.

**Escalation path.** None.

### 6. AML / sanctions screening reservation

**Question.** Is there a standard reservation clause for a Baltic marketplace collecting payouts to IBANs?

**Current position.** Neither Terms nor Seller Agreement mentions AML, sanctions screening, or the right to freeze or refuse payouts on AML grounds. Operationally, EveryPay performs KYC on sellers at payout time, but STG has no independent screening today.

**Proposed draft language.** Deferred to you — please draft a short reservation clause reserving the right to screen, freeze, and refuse payouts for suspected money-laundering, sanctions, or fraud reasons. Place it in Seller Agreement §6 (suspension and termination).

**Escalation path.** None.

### 7. VAT disclosure in the Seller Agreement

**Question.** Should we disclose the VAT treatment of commission and shipping to sellers inside the Seller Agreement, and if so what is the correct wording?

**Current position.** STG invoices sellers for commission and shipping (shipping is funded by the buyer at checkout but is a logistics service provided to the seller — see STG's `Invoicing Model` note in internal docs). VAT follows the seller's country on both lines (LV/LT 21%, EE 24%). Invoice format is `INV-YYYY-NNNNN`. Seller Agreement §4 currently only describes the commission rate and gives a worked example; it does not mention VAT or the invoice.

**Proposed draft language.** Add to §4 or §7 (tax obligations):
- Commission is VAT-added (not VAT-inclusive).
- Shipping is a pass-through logistics service under Art. 50 (if this is the correct Article).
- An invoice is issued automatically in format INV-YYYY-NNNNN.
- STG's VAT number is LV50203665371.

**Escalation path.** Please coordinate with our accountant on the exact Art. 46 (for commission) / Art. 50 (for shipping) treatment before drafting, and confirm VAT-added vs VAT-inclusive.

### 8. Seller Terms acceptance copy

**Question.** We will build a role-gated Seller Terms acceptance checkpoint at the seller-onboarding moment in Phase 2 (not signup). The mechanic will write an audit row and stamp a new `SELLER_TERMS_VERSION` constant. We need the checkbox copy itself — the wording visible to the user at the moment of acceptance.

**Current position.** No copy exists yet; Phase 2 implementation is pending. We are planning something equivalent to the signup checkbox: "I am at least 18 years old and I agree to the Seller Agreement."

**Proposed draft language.** Your redline of the above.

**Escalation path.** None.

### 9. Age verification mechanism

**Question.** Is self-declaration sufficient at our two gates (buyers 16+, sellers 18+), or do we need date-of-birth capture for sellers?

**Current position.** We self-declare at signup via checkbox ("I am at least 16 years old ...") and plan the same mechanic at seller onboarding with an 18+ floor. No DOB field is captured at either gate. The Privacy Policy commits to deleting account data if we discover a minor.

**Analysis.** GDPR Art. 8 per-country minima (LV 13, LT 14, EE 13) are all lower than our 16 floor, so self-declaration that clears 16 clears all three countries. The 18 seller floor is motivated by contracting capacity + DAC7 data collection + IBAN operations.

**Proposed draft language.** None beyond the existing checkbox copy.

**Escalation path.** If self-declaration is not defensible in light of our platform collecting DAC7 data from 18+ sellers, please flag so we can scope DOB capture.

### 10. Trader/consumer distinction (DSA Art. 30 + CRD)

**Question.** How do we handle the edge case of a seller whose activity crosses into trader territory (as defined in case law, which can fire well below DAC7 thresholds)?

**Current position.** We treat all sellers as private individuals and require them to self-declare as such. The Seller Agreement prohibits commercial reselling and flags suspected commercial activity as grounds for suspension. We do not today have:

- A seller-facing self-identification mechanism to declare trader status
- Trader identification displayed on listings
- A way to ensure trader-sellers extend 14-day withdrawal rights to buyers

**Proposed draft language.** Deferred. The right framing depends on whether you think the platform needs to anticipate trader-sellers in the Baltic region (where the whole product is positioned around private collectors) or whether prohibiting them is a defensible posture. We can build either.

**Escalation path.** If the lawful posture requires us to permit and label trader-sellers, this becomes a multi-sprint product-engineering change: seller-type flag, listing UI differentiation, automated detection triggers, withdrawal-right workflow. Please scope impact in your report.

### 11. Imprint placement — LT + EE parity and Latvia Commercial Law §8

**Question.** (a) Does our current minimal footer (copyright + contact email only) satisfy Latvia Commercial Law §8 / E-Commerce Directive 2000/31/EC Art. 5 website-identification obligations? (b) Do Lithuania (Civil Code + Law on Electronic Commerce) and Estonia (Information Society Services Act) impose additional information requirements the same block would need to cover?

**Current position.** Full registered-entity details (name, reg no, VAT, address, phone, email) live in `src/lib/constants.ts` and are displayed inside Terms §1 and Privacy §1, but are not aggregated into a single identifiable footer block or imprint page. The footer shows only `© 2025 Second Turn Games SIA` and a contact mailto link.

**Proposed draft language.** We propose a dedicated `/imprint` page linked from the footer, carrying name + reg no + VAT + registered address + email + phone + supervisory authority (if any) — formatted once and reused across LV/LT/EE users. Your job: confirm the single block satisfies all three jurisdictions, or name what needs to be added.

**Escalation path.** None — drafting / placement question.

### 12. DPA and cross-border transfer audit

**Question — not a drafting question, an internal compliance question we want you to confirm the answer to.** Before the new Privacy §6 processor list is considered live-accurate, we need to verify (a) that we have a current DPA with each named processor, and (b) that the transfer mechanism is in place for any processor touching a US corporate entity.

**Current position.** Processors named in Privacy §6: EveryPay, Unisend, Resend, Google (Google Ireland Ltd), Meta Platforms Ireland Ltd, Supabase, Hetzner, Cloudflare, Sentry, PostHog. Of these, Supabase, Resend, Sentry, Google, Meta all have US corporate parents. Meta is the highest-scrutiny item given the Schrems II lineage.

**Proposed action.** Per-processor worksheet:

| Processor | Role | DPA in place? | Transfer mechanism | EU region confirmed? |
|---|---|---|---|---|
| EveryPay (Maksekeskus AS) | Processor | ? | ? | Estonia |
| Unisend SIA | Processor | ? | ? | Latvia |
| Resend | Processor | ? | SCCs / EU hosting? | ? |
| Supabase | Processor | ? | SCCs | Stockholm (confirmed) |
| Hetzner | Sub-processor | ? | ? | Helsinki (confirmed) |
| Cloudflare | Processor + Turnstile | ? | SCCs | Global edge |
| Sentry | Processor | ? | SCCs | ? |
| PostHog | Processor | ? | ? | EU (Frankfurt) |
| Google (OAuth) | Controller | DPA / JC | ? | Ireland |
| Meta (OAuth) | Controller | DPA / JC | ? | Ireland |

Please confirm each row — our Privacy §6 text is load-bearing on these being accurate. If any DPA is missing, the Privacy §6 disclosure is currently claiming protections that do not exist.

**Escalation path.** If any processor relationship requires terminating or swapping before we can launch, flag immediately.

### 13. ROPA (GDPR Art. 30 Record of Processing Activities)

**Question.** Not public-facing, but an Art. 30 ROPA is load-bearing on our overall GDPR posture. Please confirm one exists covering every processor in item 12, or start one.

**Current position.** We do not today have a formal ROPA document. Internal data flow is documented in engineering comments + the Privacy Policy §6 processor list.

**Proposed action.** Deferred to you — please advise on scope and format.

**Escalation path.** If absence of a current ROPA blocks other items (e.g. DPA review), flag.

### 14. Platform termination and account-closure clause

**Question.** We need one consolidated section covering user-initiated deletion, platform-initiated suspension, post-termination retention, and wallet-balance handling on closure.

**Current position.** User-initiated deletion is already implemented and described in Privacy §9 (immediate anonymization, no grace window). Platform-initiated suspension is in Seller Agreement §6 (grounds listed: fraud, misrepresentation, failure to ship, excessive chargebacks, suspected commercial activity). Wallet-balance handling on closure says "pending payouts may be held for up to 180 days to cover chargebacks." These are scattered.

**Code reference.** `src/lib/services/account.ts` (the full deletion flow — the most-questioned operational path; full code attached below for your reference).

**Proposed draft language.** Deferred — please propose consolidated wording that pulls the pieces together, probably as a new section in Terms or as a restructured Seller §6.

**Escalation path.** None.

---

## Part 3 — Specific factual points to verify

These are points where we have plausible answers but need your confirmation before publishing:

1. **Post-ODR-repeal ADR bodies.** We list PTAC (LV), VVTAT (LT), TTJA (EE) in Terms §14 as the successor consumer-protection authorities after Regulation (EU) 2024/3228 closed the EU ODR platform on 20 July 2025. Confirm these are the currently competent authorities for cross-border B2C disputes.
2. **Latvia VAT Law Art. 133 retention period.** We state "up to 10 years" in Privacy §9 as a conservative ceiling. Please confirm the exact figure for VAT-supporting-invoice retention under current Latvia PVN likums, in coordination with our accountant.
3. **Latvia Accounting Law (Grāmatvedības likums) retention period.** Same — we say "up to 10 years" in Privacy §9. Confirm against current statute.
4. **Meta Platforms Ireland Ltd — controller vs processor.** We treat Meta as an independent controller for Facebook Login data (we receive a verified email back after user authentication). Please confirm this is the correct GDPR classification.
5. **Footer imprint sufficiency.** See item 11 above — we want a specific answer on whether the planned `/imprint` page satisfies Directive 2000/31/EC Art. 5 + Latvia Commercial Law §8 + LT/EE equivalents in combination.
6. **DSA small-platform exemption scope.** See item 1 — we want a specific list of which Art. 19 carve-outs apply to STG at current scale, and which obligations are unconditional.

---

## Part 4 — Attached and referenced materials

**Live legal documents** (post-Phase 1 state, as of `TERMS_VERSION = '2026-04-19'`):

- [Terms of Service](../../src/app/[locale]/terms/page.tsx) — 16 sections, `/terms`
- [Privacy Policy](../../src/app/[locale]/privacy/page.tsx) — 13 sections, `/privacy`
- [Seller Agreement](../../src/app/[locale]/seller-terms/page.tsx) — 8 sections, `/seller-terms`
- [Cookie Policy](../../src/app/[locale]/cookies/page.tsx) — `/cookies`
- [Accessibility Statement](../../src/app/[locale]/accessibility/page.tsx) — `/accessibility`

**Legal-entity data source.** [`src/lib/constants.ts`](../../src/lib/constants.ts) — single source of truth for `LEGAL_ENTITY_NAME` / `REG_NUMBER` / `VAT_NUMBER` / `ADDRESS` / `PHONE` / `EMAIL` / `BANK_NAME` / `IBAN`.

**Version stamp.** [`src/lib/legal/constants.ts`](../../src/lib/legal/constants.ts) — `TERMS_VERSION` (currently shared across all legal docs; Phase 2 will split into per-doc constants).

**Account deletion flow — the single most-questioned operational path.** [`src/lib/services/account.ts`](../../src/lib/services/account.ts) — full implementation of `checkDeletionEligibility`, `gatherUserData`, and `deleteUserAccount`. The eligibility gate already blocks deletion while active listings, in-progress orders, wallet balance, or pending withdrawals exist. Deletion itself is immediate (anonymizes comments + order messages, anonymizes profile, cancels residual listings, deletes favourites, removes storage photos, calls `supabase.auth.admin.deleteUser`). No grace window.

**Audit-log helper and contract.** [`src/lib/services/audit.ts`](../../src/lib/services/audit.ts) — `logAuditEvent({ actorId, actorType, action, resourceType, resourceId, metadata })`. Convention documented in [`CLAUDE.md`](../../CLAUDE.md) under "Audit Events".

**PostHog reverse-proxy (IP stripping).** [`src/app/ingest/[...path]/route.ts`](../../src/app/ingest/[...path]/route.ts) — strips `x-forwarded-for`, `x-real-ip`, `forwarded`, `cf-connecting-ip`, `true-client-ip` so PostHog never sees client IPs.

**Audit inputs** (prior AI audits that informed the Phase 1 remediation — for your context; not for review):

- [`docs/legal_audit/claude.md`](claude.md)
- [`docs/legal_audit/copilot.md`](copilot.md)
- [`docs/legal_audit/gemini.md`](gemini.md)
- [`docs/legal_audit/perplexity.md`](perplexity.md)

**Remediation plan.** The full plan that produced Phase 1 lives at [`~/.claude/plans/we-have-to-review-snazzy-rabbit.md`](../../../.claude/plans/we-have-to-review-snazzy-rabbit.md) (outside the repo — can share separately on request). It enumerates Phase 2 (feature-coverage amendments for auctions, wanted listings, seller-terms acceptance gate, per-doc version constants) and Phase 4 (EAA statement fill, full two-column "Quick Start / Full Rulebook" treatment aligned to Latvian translation).

---

## What we need from you

A redline pass over the 14 items above, plus confirmations on the 6 factual points in Part 3, plus the DPA + transfer-mechanism worksheet in item 12. Where you reach a conclusion that requires a product or engineering change rather than a drafting change (items 2, 4, 10 in particular), we want that flagged explicitly so we can scope the work.

Timeline assumptions on our side: one revision round expected. If material items need a second pass after our engineering/accountant follow-ups, we can schedule that.

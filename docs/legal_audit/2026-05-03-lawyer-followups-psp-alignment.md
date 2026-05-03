# Lawyer follow-up questions — PSP identity alignment (2026-05-03)

> Briefing prepared for the next outside-counsel review session, anchored in PR #254 (`feat(legal): PSP identity alignment — Swedbank AS + EveryPay AS two-entity disclosure`, merged 2026-05-03 to `main`, commit `49157e5`).

## Context

PR #254 corrected an inherited disclosure inconsistency where marketing copy named "Swedbank" as the PSP while legal pages named "EveryPay (Maksekeskus AS)." Anchored in three signed agreements with **Swedbank AS** (LV, reg. 40003074764) and Swedbank's published *E-commerce Payments Platform Terms and Conditions* (R-33415, valid 2024-11-25), the PR established a two-entity disclosure structure across `/terms` §1, `/seller-terms` §2, `/privacy` §6 + §116, ROPA, the DPA-verification runbook, CLAUDE.md, and dependencies.md:

- **Service Provider:** Swedbank AS (Latvia, registration 40003074764) — the contracting counterparty across all three signed agreements (payment-initiation `EPLV_SECONDTURN`; e-commerce settlement platform no. 3382; online card-acquiring no. 54406).
- **Technical Provider:** EveryPay AS (Estonia, registration 12280690) — named explicitly in §1 of the E-commerce Payments Platform T&Cs and referenced throughout (§2.4, §2.8, §2.9, §3.2, §3.4, §3.9, §4.4, §4.6, §4.8, §5.1, §10.6, §11.3, §12.2.x). Same legal entity formerly known as Maksekeskus AS — rebrand only, same Estonian registration number, same Tallinn address.

The PR was scoped tightly to brand alignment + disclosure structure. Lawyer-drafted regulatory prose (Art. 3(b) framing, fallback clause, `PSD2_TRANSITIONAL_SUNSET`, "Option 1 collecting-account through Maksekeskus" architecture pointer) was preserved verbatim per the discipline of not editing legally-reviewed text without lawyer signoff.

This document captures the items deliberately deferred during that PR for the next legal review pass, plus two additional items surfaced during post-implementation review.

---

## 1. Version-bump treatment for the brand alignment edit

**Decision shipped:** option (c) — no `TERMS_VERSION`, `SELLER_TERMS_VERSION`, or `PRIVACY_VERSION` bump. Substantive obligations on STG and the user, the disclosed fund flow, the regulatory framing, and the named legal entities (Swedbank AS was already in marketing copy; EveryPay AS is the same legal entity as the formerly-named Maksekeskus AS) are unchanged. We treated this as a precision correction rather than a substantive rewrite.

**Pull on the decision.** The JSDoc on `PRIVACY_VERSION` in `src/lib/legal/constants.ts` reads: *"Update when Privacy content changes — processor list, legal bases, retention periods, data-subject rights."* PR #254 split a single processor row into two (Swedbank AS + EveryPay AS) in `/privacy` §6 — that is a literal processor-list change. Historical precedent in this codebase (commits `b1337b1`, `418186e`) bumped `TERMS_VERSION` and `SELLER_TERMS_VERSION` for similar paragraph-shape edits to the PSP disclosure.

**Question for counsel.** Do you concur that option (c) is defensible here, or should we:

- **(a)** bump all three constants to a new date and trigger the existing `SellerTermsAcceptanceGate` to force every existing seller through a re-acceptance flow at next `/sell` visit, or
- **(b)** bump only `TERMS_VERSION` + `SELLER_TERMS_VERSION` and leave `PRIVACY_VERSION` as-is given the absence of a privacy re-acceptance gate?

If (a), we will also fan out an ops/CS comms note pre-emptively to explain the support-ticket spike ("why am I being asked to re-accept seller terms?").

---

## 2. Card-acquiring §4.13.5 / §4.13.7 third-party-settlement carve-outs

**Source:** Swedbank's *Terms and Conditions for Online Card Acquiring* (R-30388, valid 2025-08-07).

> **§4.13.5.** *"The Merchant may not [...] accept Card payments for discharging or refinancing its existing debt that is not collectible or for making a settlement as part of business operation of any third party (including the Merchant's subsidiaries), unless otherwise agreed with the Service Provider."*
>
> **§4.13.7.** *"The Merchant may not [...] accept the Card for making a settlement for the business of any third parties unless otherwise agreed in the Agreement."*

STG's marketplace flow is exactly this shape: buyer pays via card → STG holds funds → STG releases to seller (a third party). Our MCC during onboarding was *"specialised retail not classified elsewhere"* / *"lietotu galda spēļu tirdzniecības platformas pakalpojumi"* — which by its description names the marketplace activity.

**Question for counsel.** Does Swedbank's onboarding (the MCC selection + the signed agreements as they stand) implicitly satisfy the "otherwise agreed with the Service Provider" / "otherwise agreed in the Agreement" carve-out? If not, do we need explicit written confirmation from Swedbank — and if so, what form (annex to existing Agreement; separate side-letter; email confirmation from a named Swedbank contact)?

This question interacts with the PSD2 Art. 3(b) commercial-agent framing in Item 3 below; both should be raised together.

---

## 3. Art. 3(b) fallback-clause coherence

**Current wording** (Terms §1 and Seller Terms §2, preserved verbatim from the lawyer's 2026-04-26 transitional draft):

> *"We are not a payment institution ourselves and do not hold a payment services licence. Our role in the payment flow is that of a commercial agent acting for sellers, relying on the exemption in Article 3(b) of Directive (EU) 2015/2366 (PSD2). If that exemption turns out not to apply, **we will move the flow to a licensed payment institution.**"*

**Coherence concern after the PR-254 entity rename.** The fallback clause was drafted when the named PSP was "EveryPay (Maksekeskus AS)" — a licensed Estonian payment institution. After PR #254, the lead sentence names **Swedbank AS, a Latvian credit institution** as the PSP, with EveryPay AS as the technical provider underneath. Both entities are already regulated (Swedbank AS holds a credit-institution license, which is a regulatory superset of "payment institution" under PSD2; EveryPay AS holds an Estonian PI license).

Reading the clause end-to-end now produces: *"...if the Art. 3(b) exemption doesn't apply, we will move the flow to a licensed payment institution"* — but the flow is already through a credit institution backed by a licensed PI as technical provider. The fallback reads as moving from "regulated" to "regulated."

**Question for counsel.** Is the fallback clause still needed in this form? Three options:

- **(a)** drop it (the clause was scoped to a different PSP architecture and no longer adds defensibility);
- **(b)** soften to *"...we will restructure the flow to address the determination"* — preserves the "we will fix it" commitment without naming a specific destination;
- **(c)** keep verbatim — the clause names a fallback that's wider than today's architecture and that's fine as a forward commitment.

---

## 4. `PSD2_TRANSITIONAL_SUNSET` applicability

**Source.** `src/lib/legal/constants.ts` line 38, with a co-located test (`src/lib/legal/constants.test.ts`) that fails CI on 2026-10-26 to force the question.

```ts
/** Sunset date for the transitional PSD2 Art. 3(b) wording in Terms §1 and
 *  Seller Agreement §2. The current wording does not affirmatively claim the
 *  exemption — it describes the fund flow and flags that if Art. 3(b) is
 *  determined not to apply, we will restructure through a licensed payment
 *  institution. The lawyer memo (2026-04-26) says this framing is valid for
 *  3–6 months while EveryPay Option 1 (collecting-account through Maksekeskus)
 *  is scoped. */
export const PSD2_TRANSITIONAL_SUNSET = new Date('2026-10-26T00:00:00.000Z');
```

**Question for counsel.** The 2026-04-26 lawyer memo scoped the sunset around "Option 1 collecting-account through Maksekeskus." After the rebrand (Maksekeskus AS → EveryPay AS, same legal entity, same reg. 12280690) and PR-254's clarification that Swedbank AS is the contracting counterparty:

1. Does Option 1 still apply, or is the architecture already in place (Swedbank AS as Service Provider with EveryPay AS as Technical Provider per §1 + §2.8 of the E-commerce Payments Platform T&Cs)?
2. Is the 2026-10-26 sunset still the right date?
3. If Option 1 is moot, should the sunset shift to a different deliverable (e.g., resolution of items 2 and 3 above), or be removed entirely?

---

## 5. DPA verification status

**Source.** `docs/compliance/dpa-verification-runbook.md` row 1 + `docs/compliance/ropa.md` §3 + `/privacy` §6.

**Current understanding** captured in PR #254's runbook annotation: §12 of the E-commerce Payments Platform T&Cs is the GDPR Art. 28 framework, supplemented by Swedbank's published *Principles of Processing Personal Data* document on `swedbank.lv` (referenced in §1 and §20.2 of those T&Cs). No separate signed DPA exists between STG and Swedbank AS or between STG and EveryPay AS, and we currently believe none is required because the framework runs through the published-policy route.

**Question for counsel.** Confirm or override:

1. Is §12 + the published Principles document genuinely sufficient to discharge STG's GDPR Art. 28 obligations as the controller passing personal data to Swedbank AS / EveryPay AS as processors?
2. Should we proactively request a standalone DPA addendum to the existing Agreement, even if the published policy is technically sufficient? (Auditor-readability vs. minimum compliance.)
3. The runbook row currently says "EE confirmed" because EveryPay AS is the Estonian-registered Technical Provider. With Swedbank AS now also disclosed as a controller in ROPA §3 (a), does the runbook need a Latvian (Swedbank AS) row alongside the Estonian (EveryPay AS) row, or is one row covering the joint relationship sufficient?

---

## 6. ROPA-vs-/privacy labeling consistency

**Surfaced during PR-254 code review.** `docs/compliance/ropa.md` §3 field (a) describes the relationship as:

> *"Swedbank AS (LV, reg. 40003074764) is the contracting Service Provider; EveryPay AS (EE, reg. 12280690) is the Technical Provider engaged by Swedbank that operates the PCI-DSS-certified payment platform on Swedbank's behalf. **Both are independent controllers for the card-data processing portion**. STG receives only tokenised references and transaction metadata."*

Meanwhile `/privacy` §6 lists both entities under a heading reading *"Payments, shipping, and messaging (**processors**)."*

**The dual-role pattern we believe is correct.** Swedbank AS and EveryPay AS act as:

- **Independent controllers** for card data inside the PCI-DSS environment (data STG never sees: PAN, CVV, etc.) — controller because they decide the purposes and means of processing within their own regulated environment.
- **Processors** of the transaction metadata STG provides them (buyer name, email, transaction amount, currency, transaction identifier) — processor because they process this data on STG's instructions to fulfill STG's contractual obligation to the buyer.

**Question for counsel.**

1. Is the dual-role characterization correct under EDPB guidance, or are we mischaracterizing one of the two roles?
2. Should `/privacy` §6 add a clarifying parenthetical (e.g., *"processors of transaction metadata STG provides them; for card data inside the PCI-DSS environment, see ROPA §3 — they act as independent controllers"*)?
3. Conversely, should the ROPA §3 (a) sentence be tightened so the two documents read consistently on a quick scan?

---

## What we shipped in PR #254

For situational awareness, the brand-alignment changes that landed:

| Surface | Before | After |
|---|---|---|
| `/terms` §1 | "Payments go through EveryPay (Maksekeskus AS), a licensed Estonian payment institution..." | "Payments go through Swedbank AS, a Latvian credit institution acting as our payment service provider. The technical platform is operated on Swedbank's behalf by EveryPay AS (registered in Estonia, reg. 12280690)..." |
| `/seller-terms` §2 | mirrors `/terms` §1 | mirrors new `/terms` §1 |
| `/privacy` §6 | One processor row: "EveryPay (Maksekeskus AS, part of Swedbank). Payment processing..." | Two rows: Row 1 "Swedbank AS (Latvia, registration 40003074764). Payment processing..." Row 2 "EveryPay AS (Estonia, registration 12280690). Technical provider engaged by Swedbank under §1 and §2.8..." |
| `/privacy` §116 short reference | "processed by EveryPay (Swedbank)" | "processed by Swedbank AS (a Latvian credit institution) and its technical provider EveryPay AS (Estonia, reg. 12280690). See §6 for processor details." |
| Marketing surfaces (`/`, `/help`, en.json, footer, README) | Mixed "EveryPay" + "Swedbank AS" | Swedbank only — no technical-provider plumbing visible |
| Logo asset | `everypay_logo.svg` (4 KB) | `swedbank.svg` (Swedbank brand-default, 41 KB after SVGOMG; over our 20 KB plan ceiling — flagged as a follow-up to request a wordmark-only variant from Swedbank's brand kit) |
| Internal code | `src/lib/services/everypay/`, DB columns `everypay_*`, merchant ID `EPLV_SECONDTURN` | **untouched** — names the actual API surface; EveryPay AS is contractually the Technical Provider |
| `src/lib/constants.ts` | `LEGAL_ENTITY_BANK_NAME = 'Swedbank AS'` | Added `LEGAL_ENTITY_BANK_REG_NUMBER`, `PSP_TECHNICAL_PROVIDER_NAME`, `PSP_TECHNICAL_PROVIDER_REG_NUMBER` constants; legal pages interpolate them |

---

## What we deliberately did NOT change

- **Internal code and DB columns** (`everypay/` folder, `EveryPay*` types, `everypay_payment_*` columns, `EPLV_SECONDTURN` merchant ID). EveryPay AS is contractually the Technical Provider; the API surface is the EveryPay API. Renaming is misleading, not clarifying.
- **Lawyer-drafted regulatory prose**: Art. 3(b) framing, fallback clause, `PSD2_TRANSITIONAL_SUNSET` constant, and "Option 1 collecting-account through Maksekeskus" architecture pointer in `src/lib/legal/constants.ts` line 34 and `CLAUDE.md` line 99. These are anchored in your 2026-04-26 memo. Items 3 and 4 above ask whether they should now move.
- **DPA verification runbook row label** (`docs/compliance/dpa-verification-runbook.md` row 1): kept as `**EveryPay (Maksekeskus AS)**` to align with the historical artifact filename. A rationale note was appended explaining the rebrand context.

---

## Suggested ordering for the review session

1. **Item 1** (version-bump treatment) is operational — answerable in minutes and unblocks the version-stamp discipline going forward.
2. **Items 2 and 3** (card-acquiring §4.13.5/§4.13.7 + Art. 3(b) fallback) are linked. Both touch STG's commercial-agent positioning under PSD2 and Swedbank's expectations of the marketplace flow. Bring them as a pair.
3. **Item 4** (`PSD2_TRANSITIONAL_SUNSET`) follows naturally from items 2 and 3. The sunset date should reflect resolution of those items.
4. **Items 5 and 6** (DPA framework + ROPA/Privacy labeling) are GDPR-side and can be addressed independently of the PSD2 questions.

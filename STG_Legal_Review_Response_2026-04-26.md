# Second Turn Games — Legal Review Response

**To:** STG Engineering + Product
**From:** Outside Legal Counsel
**Re:** Response to Legal Review Brief dated 19 April 2026 (TERMS_VERSION = 2026-04-19)
**Date:** 26 April 2026
**Privileged and confidential — attorney-client communication**

---

## Cover note

Thank you for the brief. It is by some distance the best-prepared marketplace review package I have received: the fact that you have paired each legal question with the code path that implements it, the draft language you already have, and your own escalation analysis has shortened this round materially. I have tried to match that discipline in this response.

This memo takes your numbering. For each of the 14 items I give (a) a direct answer, (b) redline or drafting language where drafting is in fact what you need, (c) a product/engineering flag where I conclude the item cannot be fixed at the doc-drafting layer, and (d) residual risk after the proposed change. Part 3 of your brief (six factual points) is answered in §B. The DPA/transfer worksheet from item 12 is filled in §C with the caveats noted.

Two items require a product decision before the drafting is finalised: **item 2 (PSD2 Art. 3(b))** and, to a lesser degree, **item 10 (trader/consumer distinction)**. My recommendations on those are set out explicitly in §A so you can scope engineering work in parallel with round two of the drafting pass.

One housekeeping point before the substantive answers: the legal-entity data in `src/lib/constants.ts` is the load-bearing source of truth behind every document on the stack. Please confirm on review that `LEGAL_ENTITY_NAME`, `REG_NUMBER`, `VAT_NUMBER`, and `ADDRESS` there are current as of the date this memo is actioned. If those fields drift, every clause that references them drifts silently.

---

## §A — Response to items 1–14

### 1. DSA compliance block

**Answer.** STG at launch qualifies as a micro-enterprise (and very likely also a small enterprise) under the Annex to Recommendation 2003/361/EC. Article 19 DSA therefore exempts STG from **Section 3** of Chapter III — that is, Articles 20 (internal complaint handling), 21 (out-of-court dispute settlement), 22 (trusted flaggers), 23 (measures against misuse), 24(2) and 24(3) (statements of reasons to the Commission database and the accompanying transparency reporting obligations), and the Article 24(1) transparency reporting burden scales with size.

You are **not** exempt from Section 1 (Arts. 11–15) or Section 2 (Arts. 16–18) of Chapter III, and you are **not** exempt from Section 4 (Arts. 29–32), which applies to all online platforms allowing consumers to conclude distance contracts with traders. I address Art. 30 separately in item 10 because the architecture of your platform (sellers-are-not-traders) affects how Art. 30 is operationalised, not whether it applies.

**Obligations that remain binding on STG:**

- **Art. 11 — SPOC for authorities.** You must designate a single point of contact for Member State authorities, the Commission, and the European Board for Digital Services. This should be a dedicated address, not the general `info@` address used for users. I recommend `dsa-authorities@secondturn.games`. It must be published in the Terms and be monitored during business hours.
- **Art. 12 — SPOC for users.** You have done this at `info@secondturn.games` (Terms §16). Keep as-is; this is compliant.
- **Art. 14 — Terms and conditions.** Your existing Terms already carry the substantive content Art. 14 requires (content-moderation policy, grounds for restrictions, recourse mechanisms). I will include an Art. 14(1)-mapped drafting block in the redline package.
- **Art. 15 — Transparency reporting.** A micro-enterprise has a substantially reduced reporting burden but is not fully exempt. At minimum, once per year you must publish a report covering number of orders/notices received, actions taken, median time-to-action, and use of automated tools. Your current audit-log infrastructure (`logAuditEvent`) will support this — no new infrastructure required, just a script that aggregates `action='comment.deleted'`, `action='listing.removed'`, etc.
- **Art. 16 — Notice-and-action.** This is hard-required regardless of scale and is the biggest drafting gap. Your plan for `/report-illegal-content` is correct; I set out the form and mechanism below.
- **Art. 17 — Statement of reasons.** Hard-required. Every moderation decision that restricts visibility of information or terminates a user must produce a written statement of reasons to the affected user. Your audit log captures the event; you also need the user-facing delivery (email + in-app notification with the specific content Art. 17(3) requires).
- **Art. 18 — Suspicions of serious criminal offences.** Obligation to notify law enforcement where there is information giving rise to suspicion of a criminal offence involving a threat to life or safety. This is a narrow obligation; a short clause in Terms plus an internal escalation runbook is sufficient.
- **Arts. 30–32 — Trader traceability, compliance by design, right to information.** See item 10.

**Drafting — notice-and-action (Art. 16).** Add as Terms §17, with a dedicated submission form at `/report-illegal-content`:

> "Reporting illegal content. Anyone can notify us of content on Second Turn Games they believe is illegal, using the form at secondturn.games/report-illegal-content or by email to legal@secondturn.games. A notice should identify the content (URL or listing ID), explain why you believe it is illegal, include your name and email address (unless your notice concerns content you believe constitutes a criminal offence involving sexual exploitation of minors, in which case you may submit anonymously), and confirm that the information you provide is accurate to the best of your knowledge. We acknowledge valid notices promptly and take action where required, without undue delay. We may use automated tools to assist triage; a human reviews every decision that restricts or removes content. We notify both the notifier and the affected user of our decision and the reasons for it."

**Drafting — statement of reasons (Art. 17).** This needs to be a template the product actually sends, not just a clause in the Terms. Minimum content, drawn from Art. 17(3)(a)–(f):

> "We have [removed / restricted the visibility of / suspended the account associated with] [content identifier]. Reason: [specific ground, referencing the Terms provision or the legal basis]. Facts and circumstances we relied on: [summary, and whether a notice under our notice-and-action process was received]. Automated tools used: [yes/no, and at what stage]. Your right to redress: you may dispute this decision by replying to this email within 30 days, and you retain the right to pursue the matter in the courts of [the consumer's jurisdiction — see item 3] or through the competent ADR body listed in our Terms §14."

This wording should be hard-coded as an email template keyed off the moderation-action type, so that the audit-log row and the user-facing statement stay in lockstep.

**Drafting — Art. 11 authorities SPOC.** Add to Terms §16 immediately after the existing Art. 12 block:

> "Point of contact for authorities. Under Article 11 of Regulation (EU) 2022/2065, the single point of contact for Member State authorities, the European Commission, and the European Board for Digital Services is dsa-authorities@secondturn.games. Communications in English or Latvian are accepted."

**Drafting — Art. 18 criminal-offence notifications.** Add to Terms §17:

> "Where we become aware of information giving rise to a suspicion that a criminal offence involving a threat to the life or safety of a person has taken or is likely to take place, we will promptly inform the law enforcement authorities of the Member State concerned."

**Drafting — Art. 20 internal complaint handling (technically exempt but strongly recommended).** Article 19 exempts micro-enterprises from Art. 20's formal mechanism, but I would not advise skipping a complaint path entirely. A lightweight appeal-by-email route satisfies user expectations set by the statement-of-reasons notice and preserves defensibility if the platform grows past the micro threshold during the year. The audit-log infrastructure you already have carries almost all of this work — you need an inbox, a stated response time (I recommend 14 days), and the commitment that a human who did not take the original decision handles the appeal. This can live as a short paragraph in the statement-of-reasons email; it does not need its own clause.

**Residual risk after the above.** Low. The bigger operational risk is the gap between the written notice-and-action mechanism and real moderation behaviour in the first six months post-launch. If you are not in a position to action notices within the "without undue delay" standard (typically read as ≤48 hours for simple cases), tighten the drafting on response-time language so you are not setting up an expectation you cannot meet.

---

### 2. PSD2 Article 3(b) commercial-agent framing

**This is the most significant item in the brief and I am flagging it as a product/engineering decision, not a drafting redline. Please read this section before finalising anything else.**

**Answer — short version.** In my opinion, the Article 3(b) commercial-agent framing is not defensible on the current architecture. It is defensible — with modifications — if the underlying fund flow is re-plumbed through EveryPay's licensed PI infrastructure rather than through a balance liability sitting on STG's books.

**Reasoning.** Article 3(b) PSD2 exempts "payment transactions from the payer to the payee through a commercial agent authorised via an agreement to negotiate or conclude the sale or purchase of goods or services on behalf of only the payer or only the payee". The 2015 amendment tightened the wording from the PSD1 formulation to add "only": a commercial agent acting for both sides of the transaction is no longer within scope.

The Commission and EBA have interpreted "only one side" restrictively. The key facts a regulator will weigh against STG:

- STG negotiates neither for the buyer nor for the seller in any meaningful sense. The seller sets the price; the buyer accepts or does not. An agent whose contribution is the listing surface is a platform, not an agent.
- STG holds funds for multiple days — the window runs from payment confirmation through `pending_seller → accepted → shipped → delivered → completed`, plus the 2-day dispute window after delivery. The holding period is not incidental to the sale; it is the core product promise ("funds released after delivery").
- STG resolves disputes. An agent of only one side cannot be the neutral arbiter between the two sides without the fiction collapsing.
- STG takes a commission from the seller. An agent taking consideration from only one side is consistent with Art. 3(b). This is the only fact that cuts in your favour.

The direction of travel in EBA thinking (most clearly in the 2019 Opinion on the use of PSD2 exemptions, and reinforced in the ongoing PSD3/PSR trilogues) is that marketplaces operating escrow-style fund holding with dispute mediation do not qualify for Art. 3(b), full stop.

**Three options, in descending order of disruption.**

**Option 1 — Restructure through EveryPay's licensed PI.** This is what I recommend investigating first because it is how Maksekeskus AS's marketplace customers typically solve this. Under this model, funds are held in an account operated by EveryPay (a licensed Estonian PI regulated by Finantsinspektsioon) in EveryPay's name, segregated from STG's corporate treasury. STG holds only ledger rights — you can instruct EveryPay to release funds to the seller, or to refund the buyer, but the funds themselves are not yours at any point. If EveryPay supports this configuration (many PIs call it "collecting account" or "payout-on-behalf" functionality), your commercial-agent framing strengthens considerably, but the architecture you would then describe in Terms §1 is not "STG holds funds as commercial agent" — it is "EveryPay holds funds as the licensed payment institution; STG acts as a merchant-of-record-adjacent platform with release authority". **Engineering work: medium. Documentation/accounting work: medium. Contractual work with EveryPay: high.** This is the option I would pursue first.

**Option 2 — Pass-through payouts.** Release seller funds to the seller's IBAN immediately on payment confirmation (or as soon as KYC clears), rather than holding them through the shipping and delivery windows. This eliminates the fund-holding facts that most strongly defeat Art. 3(b). You lose the product promise ("funds released after delivery"), and you shift chargeback and non-delivery risk onto STG's balance sheet unless you take deposits, pre-authorise card holds, or insure the book. Given the Baltic board-game market volumes and your €100 liability floor discussion in item 5, this is probably not commercially viable. Flag it and move on.

**Option 3 — Your own PI licence.** Apply to FKTK (now Latvijas Banka) for a payment institution licence. Cost: €125k+ capital requirement, 12–18 months of process, permanent compliance burden (own-funds, safeguarding, audit). Not appropriate at current scale. Revisit at €10M+ GMV.

**What to say in Terms and Seller Agreement in the meantime.** While Option 1 is scoped, I recommend a defensive rewrite that does not affirmatively claim Art. 3(b) — instead, it describes the actual fund flow and leaves the legal characterisation to be resolved. Replace the current Terms §1 and Seller Agreement §2 wording with:

> "Payments are processed through EveryPay (Maksekeskus AS), a licensed Estonian payment institution. Funds received from buyers are held in an account designated for marketplace transactions and are released to sellers after the order is confirmed delivered and the dispute window has closed. Second Turn Games is not itself a payment institution and does not hold a payment services licence. We refer to our role in the flow as that of a commercial agent acting on behalf of sellers, and we rely on the exemption in Article 3(b) of Directive (EU) 2015/2366 (PSD2). If that exemption is determined not to apply in any particular case, we will restructure the flow through a licensed payment institution."

This wording removes the load-bearing assertion while preserving your operational practice. It is a materially weaker legal position than either Option 1 or Option 2, and I would not want it in the Terms for longer than the time it takes to scope Option 1 with EveryPay. Please treat this as a transitional clause, not a permanent one.

**Action items for engineering/product.**

- Request a call with EveryPay's compliance team to scope Option 1. Specific question: "Can Maksekeskus AS hold marketplace-collected funds in a Maksekeskus-operated segregated account, with release instructions issued by STG? What are the implications for chargebacks, fund safeguarding, and our KYC obligations on sellers?"
- Obtain written confirmation from EveryPay on whether their standard marketplace integration already operates this way. It may.
- Do not launch without Option 1 scoping complete, even if the transitional wording is in place. The transitional wording buys you 3–6 months; it does not buy you a year.

**Residual risk even after Option 1.** Low-to-medium. A regulator or auditor challenging the structure would look at who controls the account, whose balance sheet the funds sit on, and who bears fund-loss risk. If EveryPay confirms all three answers are "Maksekeskus", the structure is defensible. If any answer is "STG", we are back to the original problem.

---

### 3. Rome I jurisdiction clause for LT and EE consumers

**Answer.** Your proposed drafting is correct. Your current clause ("courts of Riga, Latvia", full stop) is not enforceable against consumers habitually resident in Lithuania or Estonia. Article 6 Rome I (Regulation (EC) 593/2008) and Articles 17–19 of the Brussels I Recast (Regulation (EU) 1215/2012) together mean that a consumer who is the target of "directed activity" — which STG plainly is in both LT and EE — can always (a) invoke the mandatory consumer-protection rules of their country of habitual residence, and (b) be sued only in their home courts, but may themselves sue either there or at the trader's seat.

**Drafting.** I would tighten your proposed wording slightly to carry both the choice-of-law and jurisdiction points cleanly:

> "These Terms are governed by the laws of the Republic of Latvia. The courts of Riga, Latvia, have jurisdiction over disputes arising from these Terms or use of the platform, without prejudice to (a) the mandatory consumer protection rules of your country of habitual residence under Article 6 of Regulation (EC) 593/2008, and (b) your right as a consumer to bring proceedings in the courts of your country of habitual residence under Article 18 of Regulation (EU) 1215/2012."

**Residual risk.** Low. Keep Terms §14 cross-referenced to the per-country ADR bodies you already list; this provides a practical route that most consumers will use before going to court.

---

### 4. Wallet mechanics and seller protections

**Answer.** Your list of gaps is the correct list. The operationally riskiest one is, as you flag, post-withdrawal chargeback clawback against a private seller. Let me work through each.

**Minimum withdrawal amount.** Commercial question, not legal. If you set it, disclose it; if you do not, say so. I recommend a minimum to reduce EveryPay payout-fee drag, but this is your call.

**Currency.** State "EUR" in §5. No legal risk either way; the gap is just clarity.

**KYC / IBAN verification.** Under AMLD5/6, private-individual sellers are not obliged entities, but STG as the platform (and EveryPay as the PI) do have KYC obligations for payouts above certain thresholds. EveryPay will handle this operationally; your Seller Agreement should flag it:

> "Before your first withdrawal, you may be required to verify your identity and the ownership of the IBAN to which you are withdrawing. Verification is performed by our payment processor and may require a government-issued identity document. We may decline or delay withdrawals pending successful verification."

**Dormant wallet / escheatment.** Varies by Member State and is genuinely complex. In Latvia, dormant funds are not subject to classical escheatment to the state in the same way they are in parts of the US, but the obligation to hold against the account owner persists indefinitely as a civil-law debt, with general limitation periods (usually 10 years) applying. You have three practical options: (i) hold indefinitely (simple, expensive at scale), (ii) convert to a platform credit after some period (legally doubtful if not signed into the account), (iii) offer a buyout-on-notice with unclaimed balances transferred to a designated charity (requires clear terms). I recommend (i) for the first two years, revisit at scale.

**Negative balance handling.** Yes, you need this clause. A post-completion refund ordered after seller withdrawal will leave a negative wallet balance; the seller must be contractually obliged to repay.

**Chargeback clawback — the operationally riskiest case.** You are right that this is the hard one. A private seller is not a trader, so you cannot use trader-specific contractual mechanics (e.g. business-to-business set-off, commercial collateral, debiting mandates that presuppose a commercial account). What you can do, and what I recommend:

1. Contractual right to retain future wallet balance to offset the chargeback. This is straightforward — it is a set-off between mutual debts, permitted under Latvian civil law without special form.
2. Contractual right to pursue the seller directly for any shortfall. Also permitted. Against a private individual, this is a civil claim for debt recovery, with the usual enforcement options (small-claims procedure in LV under the European Small Claims Procedure Regulation (EC) 861/2007 for cross-border cases).
3. **You cannot** obtain a pre-authorised direct-debit mandate against a private individual's consumer IBAN in the way you would against a business account. SEPA Direct Debit Core (CORE) technically permits this, but consumer CORE mandates are revocable for 8 weeks post-debit and the set-up friction for a marketplace is high. I would not pursue this path.
4. Practical mitigation: limit a seller's maximum in-flight exposure. The cleanest version is "withdrawals are subject to a holdback equal to the greater of X% of rolling 60-day sales or €Y, released on inactivity". This is product work, not drafting work. Flag it for Phase 2.

**Drafting for Seller Agreement §5 — new sub-sections:**

> "Currency. All amounts in your wallet are held in Euro (EUR).
>
> Identity verification. Before your first withdrawal, you may be required to verify your identity and the ownership of the IBAN to which you are withdrawing, in accordance with the KYC requirements of our payment processor. We may decline or delay withdrawals pending successful verification.
>
> Chargebacks and clawback. If a buyer successfully disputes a completed order after you have withdrawn the associated funds, you agree that (a) we may retain an equivalent amount from your future wallet balance and from any subsequent sales proceeds, and (b) if your wallet balance is insufficient, you remain liable for the shortfall and we may pursue the amount through the courts of your country of habitual residence.
>
> Negative balance. If a refund, chargeback, or other adjustment results in your wallet balance being negative, you must repay the shortfall within 30 days of notice, either by transfer to the bank account we designate or by offset against future sales proceeds.
>
> Inactive accounts. Wallet balances are retained indefinitely. If you have not logged into your account for 24 months and your wallet balance is positive, we will attempt to contact you at your registered email address. If you do not respond within 90 days of such contact, we may withdraw the balance to the last IBAN we have on file for you, subject to successful re-verification. Unclaimed amounts remain your property and will be paid on request."

**Residual risk after the above.** Medium on the chargeback case specifically. A private seller who has withdrawn funds, chargeback hits three weeks later, seller refuses to repay, wallet is empty — you are in civil recovery against a consumer debtor in a country that is not yours. For sub-€500 exposures this is uneconomic to pursue. Practical mitigation is the holdback mechanic I flagged above; flag to product.

---

### 5. €100 liability floor in Terms §13

**Answer.** I recommend restructuring rather than raising the floor. The €100 figure is not in itself the problem; the issue is that a flat cap against a consumer sits uncomfortably against (a) the Unfair Contract Terms Directive 93/13/EEC (as transposed in Latvia), which treats exclusions and limitations of liability for death or personal injury caused by the trader's fault, or for fundamental breach, as presumptively unfair, and (b) mandatory consumer protection rules in LT and EE that a consumer can invoke under Rome I Art. 6. A flat €100 cap that purports to cover everything is at the high end of the risk spectrum.

The "whichever is greater" phrasing is a partial mitigant but not a clean defence — it does not address the kinds of liability that cannot be contracted away at all.

**Drafting.** Replace Terms §13 with:

> "Our liability. To the maximum extent permitted by applicable law, our total liability to you in connection with the platform or these Terms is limited to the greater of (a) €500 and (b) the fees and commissions paid by you in the twelve months preceding the event giving rise to the claim. The following are not limited or excluded: (i) liability for death or personal injury caused by our negligence, (ii) liability for fraud or fraudulent misrepresentation, (iii) any liability that cannot lawfully be limited or excluded under the consumer protection law of your country of habitual residence, and (iv) any statutory liability we have as an intermediary service provider under Regulation (EU) 2022/2065 or equivalent national law."

Three changes from the current wording: the floor rises to €500 (this is directional only — pick a number you are comfortable with; my view is that €100 reads as an insult and €500 reads as a serious commercial number), the carve-outs are stated explicitly rather than implied, and the reference to Regulation (EU) 2022/2065 is added because DSA liability sits outside a commercial contract.

**Residual risk.** Low. The clause is defensible against standard unfair-terms challenges. It does not shield you from gross negligence or wilful misconduct; it should not try to.

---

### 6. AML / sanctions screening reservation

**Drafting.** Add to Seller Agreement §6 (suspension and termination):

> "Anti-money-laundering, sanctions, and fraud. We reserve the right, at our discretion and without prior notice, to (a) screen transactions, accounts, IBANs, and identifying information against EU and international sanctions lists, politically exposed person lists, and fraud databases; (b) suspend your account, freeze your wallet balance, or refuse a payout if we have reasonable grounds to suspect money laundering, terrorist financing, sanctions evasion, or fraud; (c) request additional identification, source-of-funds, or beneficial-ownership information; and (d) share information with competent authorities, including the Latvian State Security Service, the Financial Intelligence Unit (FID), the State Revenue Service (VID), and our payment processor. Funds frozen under this provision remain your property and will be released once the matter is resolved, subject to any order of a competent authority."

This is standard reservation language for a Baltic marketplace. The explicit naming of FID and VID is helpful defensively — it shows you have thought about where you would escalate.

**Residual risk.** Low. You are not an AML obliged entity, but reserving the rights above protects you if EveryPay or a competent authority requests action.

---

### 7. VAT disclosure in the Seller Agreement

**Answer — with a specialist caveat.** VAT characterisation of marketplace services to non-taxable-person sellers is nuanced and I strongly recommend this be confirmed with your accountant before finalising. The framing below is my best read; please treat it as a starting point for the accountant-review pass, not the final word.

**On the commission.** When STG (a Latvian taxable person) supplies a marketplace service (commission) to a seller who is a private individual (non-taxable person) in LV, LT, or EE, the place of supply for B2C services is generally **Article 45 of the VAT Directive 2006/112/EC** (place of supplier) — which would put all commission at Latvian 21% regardless of seller country. That contradicts your current position ("VAT follows seller's country"), so either (a) your current position is wrong and everything should be Latvian 21%, or (b) you are characterising the commission as an electronically supplied service and applying Article 58 (telecommunications, broadcasting, and electronically supplied services to non-taxable persons), which puts place of supply in the customer's country. The latter is the defensible path and is consistent with how most EU marketplaces treat platform fees. The reference should be Article 58, not Article 46.

**On the shipping.** If shipping is re-supplied from STG to the seller as a logistics service, Article 49 (intra-Community transport of goods) or Article 50 (other transport of goods) may apply. Article 50 places place of supply at the place of departure for non-taxable persons. If goods depart from the seller's country (LV/LT/EE), VAT at the seller's country rate is correct, but the article is 50 (not 46).

**Net:** your current substantive treatment appears to be correct, but the article references in your internal docs and code comments (`Article 46 for commission, Article 50 for shipping`) are probably wrong on the commission side. Please have your accountant confirm Article 58 for commission before publishing.

**Drafting for Seller Agreement §4 (or a new §7 on tax obligations), subject to accountant confirmation:**

> "VAT on our commission. Our 10% commission on the item price is subject to Value Added Tax, added on top of the commission amount (not included). VAT is charged at the rate of your country of residence: 21% for Latvia, 21% for Lithuania, 24% for Estonia. Place of supply is determined under Article 58 of Directive 2006/112/EC (electronically supplied services to non-taxable persons). Our VAT number is LV50203665371.
>
> VAT on shipping. When we arrange shipping through our logistics partners on your behalf, we re-supply the shipping service to you. VAT is charged at the rate of the country of departure (i.e. your country), pursuant to Article 50 of Directive 2006/112/EC.
>
> Invoices. We issue an invoice for commission and shipping VAT after each completed order, in the format INV-YYYY-NNNNN. Invoices are available under 'My sales' in your account.
>
> Income tax. STG does not withhold income tax on your behalf. You are responsible for declaring income from sales on the platform to the tax authorities of your country of residence, subject to any applicable private-seller thresholds. Where your activity triggers reporting under Council Directive (EU) 2021/514 (DAC7), we will report the required information to the Latvian State Revenue Service (VID) and provide you with a copy of what has been reported, in accordance with Section 7 of our Privacy Policy."

The income-tax paragraph is a separate issue but while you are editing §4 I would add it; it comes up in private-seller enquiries constantly and having the answer in the Seller Agreement saves support load.

**Residual risk.** The VAT treatment question sits at the boundary between legal and tax-specialist work. Please do not publish the drafting above until your accountant has confirmed Article 58 (not Article 46) for commission, and confirmed the Article 50 v. Article 49 question on shipping.

---

### 8. Seller Terms acceptance copy

**Drafting.** Your proposed wording is fine in substance; I would tighten the modal-verb posture:

> "I am at least 18 years old. I confirm that I am a private individual, not acting in the course of a business, trade, or profession. I have read and agree to the Seller Agreement."

Three changes from your draft: (a) the two-sentence split separates the two factual declarations from the consent to the document, which is defensible under Art. 7(2) GDPR if this ever becomes a consent question; (b) the "private individual, not acting in the course of a business" declaration is the load-bearing line behind items 2, 7, and 10, and it needs to appear at the acceptance moment, not only inside §2 of the Seller Agreement; (c) "have read and agree" is the standard formula and is less likely to be challenged than a terser variant.

**Audit-log row.** Capture the same way you capture `terms.accepted`, with `action='seller_terms.accepted'`, `source: 'seller_onboarding'`, and `resourceId=SELLER_TERMS_VERSION`. Please confirm in your Phase 2 implementation that the `resourceId` is captured at call-time from the constant, so a later bump of `SELLER_TERMS_VERSION` does not rewrite historical rows. Your `CLAUDE.md` section on audit events already documents this pattern for the signup flow; same discipline here.

**Residual risk.** Low.

---

### 9. Age verification mechanism

**Answer.** Self-declaration is sufficient for both gates, provided you document the mechanism and act on any information that calls it into question. The case law on Art. 8 GDPR (and more broadly on contracting capacity under Latvian, Lithuanian, and Estonian civil law) does not require identity verification; it requires a reasonable mechanism to prevent minors from using adult services and a reasonable response when you discover one has. You have both.

The DAC7-specific concern is separate and does not upgrade the age-verification requirement. DAC7 requires the marketplace to collect and report Tax Identification Numbers, date of birth, and address for sellers crossing the reporting threshold. Your current flow — collecting DOB at the 25-sale / €1,750 early-warning threshold — is a sensible design choice for minimising data collection. At the DOB-collection moment you will naturally verify the 18+ floor (any DOB that implies age < 18 fails the DAC7 submission anyway and should fail your onboarding). This is a belt-and-braces arrangement and I would not change it.

**One small change.** Consider requiring DOB at seller onboarding rather than at the DAC7 threshold. The rationale is not age verification (self-declaration is fine for that) but IBAN-matching friction: EveryPay KYC will ask for DOB at the first-payout moment anyway, and asking twice creates support tickets. This is a product choice, not a legal requirement.

**Residual risk.** Low on the legal side. The residual product risk is the case where someone lies at the checkbox and later claims they were under 18 at onboarding — the defence is the audit-log row, the checkbox language, and the fact that IBAN KYC at payout would have caught the claim. Keep the audit log.

---

### 10. Trader/consumer distinction (DSA Art. 30 + CRD)

**Answer — short version.** Your current "private sellers only, no traders permitted" posture is defensible, but it needs three mechanical changes to hold up: (a) real enforcement of the prohibition, (b) a DSA Art. 30 pathway for the edge case where a trader slips through, and (c) a fallback to CRD rights if one does. I do **not** think you need to pivot to a full trader/consumer platform architecture at current scale. You flagged this correctly as a potential multi-sprint change; I am recommending against taking on that work now.

**The case law point.** The CJEU in Kamenova (C-105/17) established that "trader" status under the CRD depends on a non-exhaustive list of factors — systematic intent, profit motive, professional knowledge, volume, frequency — and that a private seller can become a trader through the pattern of their activity, even without formal business registration and even below any statutory threshold. DAC7 thresholds (30/€2,000) are not the same as the CRD trader threshold; a seller can be a "trader" for CRD purposes at lower volumes.

**Why I think "prohibit and enforce" works at current scale.** The Baltic second-hand board game market is small, the community is tight, and a seller with trader-like volume is highly visible. Your existing automated detection (flagging suspected commercial activity as grounds for suspension in Seller Agreement §2) is the right architectural choice. What it needs is teeth:

1. **Automated detection thresholds.** Sales velocity (e.g. >10 completed sales in 30 days, or >€500 in 30 days, or repeated listing of identical copies of the same game) should trigger a seller-type review. This is product work; the thresholds are a commercial judgement.
2. **Written record of enforcement.** Every suspension for suspected commercial activity should produce an audit-log row with the detection trigger, the reviewer, and the outcome. Your existing infrastructure supports this.
3. **Light-touch Art. 30 pathway for edge cases.** Even with prohibition, you will occasionally host a listing from a seller who is legally a trader (e.g. a game-store owner who lists their personal collection on their personal account). DSA Art. 30 requires that when a platform allows consumers to conclude distance contracts with traders, the platform must obtain and display specific trader-identifying information. The cleanest implementation: when your detection flags a seller as likely commercial and they confirm trader status in response, trigger a "trader mode" on their account that captures Art. 30 fields (name, address, contact, trade register number, self-certification of CRD compliance) and displays them on their listings, then extends 14-day withdrawal rights to buyers. This is **not** a pre-launch requirement; it is a Phase 3 enhancement that you can commit to in the Terms without building it immediately, provided you keep the prohibition in place and the enforcement mechanism functioning.
4. **Drafting of the prohibition.** Your current wording in Seller Agreement §2 is fine in principle but too soft. Strengthen to:

> "Private sellers only. Second Turn Games is a platform for private individuals selling their personal board game collections. You may not list items on the platform in the course of a business, trade, or profession, including as a retailer, reseller, distributor, wholesaler, or auction house. You must not list items that you acquired primarily for resale. We may, at our discretion and without notice, require you to confirm the private nature of your activity and may suspend or terminate your account if we have reasonable grounds to believe you are acting as a trader. If you believe you are or have become a trader for the purposes of Directive 2011/83/EU (the Consumer Rights Directive), you must notify us immediately at sellers@secondturn.games, cease new listings, and complete any outstanding orders in accordance with the trader obligations in that Directive (including the 14-day withdrawal right for buyers)."

**Fallback — if a buyer claims trader rights against a seller.** Add to Terms §14 or a new §15:

> "If a dispute between a buyer and a seller concerns whether the seller is a trader within the meaning of Directive 2011/83/EU, we will (a) review the seller's activity against our internal criteria, (b) provide the buyer with the outcome of our review, and (c) where we conclude the seller is likely a trader, support the buyer in exercising their statutory rights, including facilitating a refund where a withdrawal right would apply. Our review does not bind the courts or consumer protection authorities."

**Residual risk after the above.** Low-to-medium. The residual is the case of a seller who is legally a trader, a buyer who invokes CRD rights, and a platform that has been paid a commission on the sale. Your commission is not at risk (it is our platform fee, not contingent on the sale being between two private parties). The practical exposure is reputational and the risk of a formal complaint to PTAC — which is low-cost to handle if your enforcement record is clean.

---

### 11. Imprint placement — LT + EE parity and Latvia Commercial Law §8

**Answer.** Your proposal (dedicated `/imprint` page linked from the footer, carrying name + reg no + VAT + registered address + email + phone + supervisory authority) is correct and does satisfy all three jurisdictions in combination. The substantive requirements of Latvia Commercial Law §8, Lithuania's Law on Electronic Commerce (Art. 5), and Estonia's Information Society Services Act (§4) all derive from Article 5 of the E-Commerce Directive 2000/31/EC and are therefore materially identical.

**Minimum content for the `/imprint` page:**

> "Second Turn Games SIA
> Registration number: 50203665371
> VAT number: LV50203665371
> Registered office: Evalda Valtera 5-35, Riga, LV-1021, Latvia
> Email: info@secondturn.games
> Telephone: [phone number]
> Commercial Register: Register of Enterprises of the Republic of Latvia (Uzņēmumu reģistrs)
> Supervisory authority: Consumer Rights Protection Centre (PTAC), Brīvības iela 55, Riga, LV-1010, Latvia
> Data protection authority: Data State Inspectorate (DVI), Elijas iela 17, Riga, LV-1050, Latvia"

Notes on this: (a) the "supervisory authority" line is only strictly required under Art. 5(1)(d) for activities subject to authorisation — strictly speaking STG at launch is not, but listing PTAC here is harmless and helpful; (b) the DVI reference duplicates Privacy §12 and can be removed if you prefer, but a single-page imprint readable by any regulator in LV/LT/EE is more useful than a minimal one; (c) the "Commercial Register" line is the specific addition that distinguishes an Art. 5 imprint from a generic contact block.

**Footer placement.** Add an "Imprint" link alongside the existing "Terms / Privacy / Cookies" footer row. Keep the minimal "© 2026 Second Turn Games SIA" line. Do not drop the contact email from the footer — it satisfies Art. 5(1)(c) "direct and effective communication" and many users expect it there.

**Residual risk.** Low. The one residual is the "authorisation required" edge case under Art. 5(1)(d), which is irrelevant to a marketplace but would fire if you ever add a regulated service (e.g. a merchant-of-record payment flow, which is Option 1 of item 2 and would change this calculus).

---

### 12. DPA and cross-border transfer audit

**Answer — not a drafting question but a critical compliance question.** Your Privacy §6 text asserts that you have DPAs with each named processor. That assertion is load-bearing. Until you have confirmed the worksheet below, the Privacy Policy is making a claim that may not be supportable.

The filled worksheet is in §C of this memo. The short version: (a) **Supabase, Cloudflare, Sentry, PostHog, Resend** all publish standard DPAs that you sign electronically on account creation — you should check your account in each to confirm the DPA is accepted, and keep a copy; (b) **EveryPay and Unisend** are EU-based processors whose relationship with you is governed by their service agreements, which may or may not include GDPR Art. 28 terms — confirm in writing; (c) **Hetzner** publishes a DPA and SCCs on their ordering process; confirm it is in place; (d) **Google and Meta for OAuth** are correctly characterised by you as independent controllers, not processors, because you receive only the verified email and profile identifier after authentication — they are not processing personal data on your behalf, they are authenticating their own users and providing a signed assertion to you. This should be stated explicitly in Privacy §6 as a controller-to-controller transfer, not listed in the processor table.

**Cross-border transfer mechanisms.** The entities with US corporate parents that matter for Schrems II purposes are: Resend (US parent, EU region available), Sentry (US parent, EU region available), PostHog (UK/US parent, EU region confirmed — Frankfurt), Supabase (US parent, EU region confirmed — Stockholm), Cloudflare (US parent, global edge network). For each of these, the correct mechanism is (a) DPA signed, (b) Standard Contractual Clauses (2021 version) incorporated by reference in the DPA, and (c) where available, the EU-US Data Privacy Framework certification as a supplementary mechanism. Please verify the DPF certification status of each on the Data Privacy Framework website (dataprivacyframework.gov) before finalising Privacy §6. DPF certifications have been challenged and reinstated multiple times; treat DPF as a belt, SCCs as the braces.

**Meta specifically — the Schrems II question.** You received email addresses and profile identifiers from Facebook Login. Meta Platforms Ireland Ltd is the data controller for Meta's processing of its users' data; Meta transfers the authenticated user's information to you under the user's own consent (the "continue with Facebook" consent at the OAuth prompt). This is not a Schrems II transfer by STG — the user authorises Meta to share their data with STG. Your privacy policy should describe this accurately; do not list Meta as a processor or mention SCCs in that row.

**Action.** Treat the worksheet in §C as a checklist. Do not ship the current Privacy §6 until every row has a confirmed DPA and, for non-EEA transfers, a confirmed mechanism. If any row fails (no DPA, or DPA present but no SCCs in non-EEA case), you have three choices for that processor: (i) sign the DPA/SCCs and proceed, (ii) move to an alternative processor, (iii) rewrite the Privacy §6 row to describe the actual relationship (controller-to-controller, or a narrower processing scope).

**Residual risk.** This is the single highest-impact item in the brief if left unresolved. A Privacy Policy that claims protections you do not in fact have is worse than one that does not mention the processor at all.

---

### 13. ROPA (GDPR Art. 30 Record of Processing Activities)

**Answer.** You need one. Art. 30 applies to any controller processing personal data that is not "occasional" — which a marketplace with a live user base never is — and the Art. 30(5) exemption for <250-employee organisations does not help you because (a) you process special-category data (none directly, but DAC7 data is sensitive-adjacent), (b) your processing is systematic and non-occasional, and (c) you process data from a platform accessible to all EU data subjects.

**Scope.** A STG ROPA should cover, at minimum:

1. Marketplace platform data (listings, orders, messages, reviews) — Art. 30(1) controller record
2. Authentication data (email, OAuth tokens, session data) — Art. 30(1) controller record
3. Payment and wallet data — Art. 30(1) controller record
4. Tax reporting data (DAC7) — Art. 30(1) controller record, with the Art. 6(1)(c) legal basis flagged
5. Marketing and analytics (newsletter, PostHog events) — Art. 30(1) controller record
6. Support communications — Art. 30(1) controller record

Each entry should carry the Art. 30(1)(a)–(g) fields: name and contact of the controller, purposes, categories of data subjects, categories of personal data, categories of recipients (including transfers to third countries and the applicable safeguard), retention schedule, and description of technical and organisational measures.

**Format.** The ROPA is an internal record; it does not need to be published. A spreadsheet or Notion database is fine. The DVI (Latvian data protection authority) publishes a template in Latvian; I am attaching a lightly modified English-language version as a follow-up to this memo (separate deliverable). **Action for you:** stand up the ROPA before the next round of regulator-facing work (e.g. any DPIA, any breach notification) because without it, every subsequent conversation with DVI starts from a deficit.

**Residual risk.** Medium if not built, low once built. The ROPA is often the first document DVI asks for in any supervisory enquiry.

---

### 14. Platform termination and account-closure clause

**Drafting.** I have reviewed `src/lib/services/account.ts` and the gate logic in `checkDeletionEligibility`. The behaviour is correct — deletion is blocked while active listings, in-progress orders, wallet balance, or pending withdrawals exist, and the actual deletion anonymises comments and messages, cancels residual listings, removes storage photos, and calls `supabase.auth.admin.deleteUser`. The legal drafting should mirror this exactly; any gap between the policy wording and the code is the gap a regulator or aggrieved user will find.

**Proposed consolidated section — add to Terms as a new §15, or substitute the current Seller Agreement §6 with this structure and cross-reference from Terms:**

> **Ending your account or our services.**
>
> **You ending your account.** You may close your account at any time from your account settings. Closure is immediate. Before your account can be closed, you must (a) cancel or complete any active listings and in-progress orders, (b) withdraw any positive wallet balance, and (c) resolve any pending disputes. On closure, we anonymise your profile, your public comments, and your order messages so that they no longer identify you; we cancel any residual listings; we remove your listing photos from storage within 6 hours; we delete your account in our authentication system. Information we are required by law to retain (completed-order records, invoices, DAC7 reporting data, and security logs) is retained for the periods set out in Section 9 of our Privacy Policy, in a form that does not link to your anonymised account except where the retention obligation requires it.
>
> **Us ending your account.** We may suspend or terminate your account, remove listings, or freeze your wallet balance if we have reasonable grounds to believe you have (a) breached these Terms or the Seller Agreement, (b) engaged in fraud, misrepresentation, or commercial reselling, (c) failed to ship or respond to orders repeatedly, (d) accumulated excessive chargebacks, (e) triggered our anti-money-laundering, sanctions, or fraud controls, or (f) caused us or another user harm. Where we take such action, we notify you of the reasons and of your right to dispute the decision, in accordance with Article 17 of Regulation (EU) 2022/2065 (the Digital Services Act). Where your account is terminated for cause, any positive wallet balance is payable to you after deduction of any amounts you owe us, and may be held for up to 180 days to cover potential chargebacks or claims before being released.
>
> **Effect of termination.** Termination does not affect any rights or obligations that have accrued up to the date of termination. The clauses on liability (Section 13), governing law and jurisdiction (Section 14), and reporting obligations under applicable tax law survive termination indefinitely."

Three cross-references embedded in this (Privacy §9 on retention, DSA Art. 17 on statement of reasons, the 180-day holdback for chargebacks) — all of these are either already true in your stack or recommended elsewhere in this memo. Make sure the final document ships with all three anchor points in place.

**Residual risk.** Low once this clause is in place and the account.ts code behaviour matches. Before shipping, please re-read the proposed clause against the code and flag any discrepancy; I can redline further if the code changes in response.

---

## §B — Factual confirmations (Part 3 of the brief)

**1. Post-ODR-repeal ADR bodies.** Confirmed. PTAC (Patērētāju tiesību aizsardzības centrs) is the competent consumer protection authority for Latvia; VVTAT (Valstybinė vartotojų teisių apsaugos tarnyba) for Lithuania; TTJA (Tarbijakaitse ja Tehnilise Järelevalve Amet) for Estonia. These remain the competent bodies for cross-border B2C disputes following the closure of the EU ODR platform on 20 July 2025 under Regulation (EU) 2024/3228. The fallback language I would add to Terms §14: "You may also pursue ADR through the national consumer protection authority of your country of habitual residence."

**2. Latvia VAT Law Art. 133 retention period.** Art. 133 of the Latvian VAT Law (PVN likums) requires retention of VAT invoices for 5 years from the end of the year in which the invoice was issued, extended to 10 years for invoices relating to immovable property. For marketplace commission invoices, 5 years is the floor. Your Privacy §9 "up to 10 years" is a conservative ceiling and is safe to state, but I would refine to: "up to 5 years for ordinary commission invoices, extended where required by law". Coordinate with your accountant on the exact figure you want to commit to.

**3. Latvia Accounting Law (Grāmatvedības likums) retention period.** §10 of the Latvian Accounting Law requires retention of accounting source documents for 5 years, with the general supporting documentation retained for 10 years. Tax declarations, annual reports, and documents supporting transactions with immovable property: 10 years. Marketplace order records, wallet ledger entries, and payout records: 5 years is the floor. Again, your "up to 10 years" wording is conservative and safe.

**4. Meta Platforms Ireland Ltd — controller vs processor.** Confirmed. For Facebook Login, Meta is an independent controller. You receive a verified email and OAuth identifier after the user authorises the release; Meta is not processing data on STG's behalf, it is providing an authenticated assertion to you under the user's own consent. Privacy §6 should state this explicitly: "Meta Platforms Ireland Limited acts as an independent controller of data subjects who authenticate via Facebook Login. We receive only the verified email address and profile identifier from Meta; we do not instruct Meta on how to process its users' data." This is a separate row from the processor table and should be formatted as such.

**5. Footer imprint sufficiency.** Confirmed — the single `/imprint` page I described in item 11 satisfies Directive 2000/31/EC Art. 5 + Latvia Commercial Law §8 + LT's Law on Electronic Commerce Art. 5 + EE's Information Society Services Act §4 in combination, provided all the fields listed are present and the page is linked from the footer on every page of the site (required by "direct and permanent access" language across the transpositions). Test this by opening an anonymous browser session and confirming the footer link is present on the homepage, a listing detail page, and the checkout page.

**6. DSA small-platform exemption scope.** Covered in detail in item 1 above. Summary: Art. 19 exempts STG (as a micro/small enterprise) from Articles 20–24 obligations in Section 3 of Chapter III. It does **not** exempt you from Articles 11–18 (Sections 1 and 2) or from Articles 29–32 (Section 4 — consumer-trader platform obligations). Hard-required regardless of scale: Art. 11 (authorities SPOC), Art. 12 (user SPOC), Art. 14 (terms), Art. 16 (notice-and-action), Art. 17 (statement of reasons), Art. 18 (criminal-offence notification), Art. 30 (trader traceability), Art. 31 (compliance by design), Art. 32 (right to information).

---

## §C — DPA / transfer-mechanism worksheet (item 12)

I have filled in the public-facing answers; the "DPA in place?" column is for you to verify by checking the admin console of each service and saving a PDF copy to your compliance folder. Do not treat my entries as a replacement for that check.

| Processor | Role | DPA in place? | Transfer mechanism | EU region confirmed? | Notes |
|---|---|---|---|---|---|
| EveryPay (Maksekeskus AS) | Processor (payments) | Verify in master services agreement | Not required (EE-based, within EEA) | Estonia — confirmed | Maksekeskus is an Estonian licensed PI. Processing is within EEA; no SCCs needed. Verify DPA is in the MSA or addendum. |
| Unisend SIA | Processor (shipping) | Verify in service agreement | Not required (LV-based, within EEA) | Latvia — confirmed | Same as above. |
| Resend | Processor (transactional email) | Standard DPA on account, verify accepted | SCCs (2021) + DPF for US transfers | EU region option available — confirm configured | Resend is US-headquartered but supports EU-only processing. Verify your account is on the EU region plan. If not, move now. |
| Supabase | Processor (database, auth, storage) | Standard DPA on account, verify accepted | SCCs (2021) + DPF | Stockholm — confirmed | Supabase Inc. is US-headquartered. Stockholm region means data-at-rest is EU; some metadata and support access may transit US. SCCs cover this. |
| Hetzner | Sub-processor (infrastructure) | Standard DPA on ordering process, verify | Not required (DE-based, within EEA) | Helsinki — confirmed | German company, Finnish datacenter. Check Hetzner's DPA is signed on your account. |
| Cloudflare (incl. Turnstile) | Processor (CDN, WAF, bot protection) | Standard DPA on account, verify accepted | SCCs (2021) + DPF | Global edge network | Cloudflare Inc. is US-headquartered. Edge nodes serve from nearest POP. Data is in transit only (no persistent storage of personal data on edge). Privacy §6 should describe this accurately. |
| Sentry | Processor (error tracking) | Standard DPA on account, verify accepted | SCCs (2021) + DPF | EU region available — confirm configured | US-headquartered. Verify you are on the EU data residency plan (`sentry.io/eu` or equivalent). If not, switch now. |
| PostHog | Processor (product analytics) | Standard DPA on account, verify accepted | SCCs (2021) | EU (Frankfurt) — confirmed | PostHog Inc. is US/UK. Frankfurt region means EU-only processing. Verify your project is on the EU instance. |
| Google (OAuth — Google Ireland Ltd) | **Independent controller** — not processor | N/A (controller-to-controller, not processor relationship) | Controller-to-controller transfer under user's own consent | Ireland | Do not list Google in the processor table. List as a separate "authentication providers" row describing the controller-to-controller model. |
| Meta (OAuth — Meta Platforms Ireland Ltd) | **Independent controller** — not processor | N/A (controller-to-controller, not processor relationship) | Controller-to-controller transfer under user's own consent | Ireland | Same as Google. Important: Meta's own Schrems II status is contested, but it does not affect STG because Meta is not processing on STG's behalf. |
| BGG (BoardGameGeek image hotlink) | **Not a processor** — third-party content embed | N/A | N/A | Not applicable | Outbound browser connection only. User's browser contacts `cf.geekdo-images.com`. No STG-controlled transfer of personal data. Disclose in Cookie Policy or a "third-party content" section; do not list as processor. |

**Action checklist arising from the worksheet:**

1. Log into each of the ten processor accounts and confirm the DPA is accepted. Save a PDF copy of each.
2. Verify EU-region configuration on Resend, Supabase, Sentry, and PostHog. Switch any that are on US regions.
3. Update Privacy §6 to split Google and Meta out of the processor table into a "controller-to-controller authentication partners" paragraph.
4. Remove BGG from any list implying processor status; keep the disclosure that images load from BGG's CDN.
5. For each US-parented processor (Supabase, Cloudflare, Sentry, PostHog, Resend), verify current DPF certification status on dataprivacyframework.gov. If any has lapsed, confirm SCCs remain in force.

---

## §D — Summary of items requiring product/engineering decisions, not drafting

Flagged explicitly at your request:

1. **Item 2 (PSD2 Art. 3(b))** — requires product decision on fund-flow architecture. Recommended: scope Option 1 (EveryPay collecting-account model) with Maksekeskus before launch. Transitional Terms wording provided; treat as valid for 3–6 months maximum.
2. **Item 4 (wallet chargeback mechanics)** — recommended holdback mechanic is product work, not drafting. The drafting I have provided covers the contractual right to claw back; enforcement against a private seller remains hard and the holdback is the practical mitigant.
3. **Item 10 (trader/consumer distinction)** — my recommendation is "prohibit + enforce" stays, with added detection thresholds and the Art. 30 pathway for edge cases deferred to Phase 3. No pre-launch architecture change required.
4. **Item 12 (DPA and transfer worksheet)** — not drafting; each row requires verification in the processor's admin console. Privacy §6 should not ship until every row is confirmed.
5. **Item 13 (ROPA)** — internal document, not drafting. Recommended to stand up before any regulator-facing follow-up.

---

## §E — Proposed timeline for round two

Based on the above, I recommend the following sequencing before we schedule the second round:

1. **This week:** STG to action the verification work in item 12 (the DPA worksheet). This is the fastest path to a defensible Privacy §6.
2. **This week:** Accountant confirms Article 58 vs Article 46 question on commission VAT (item 7).
3. **Next two weeks:** STG to scope Option 1 of item 2 with EveryPay. Outcome of that scope determines whether Terms §1 ships with the transitional wording or with the Option 1 wording.
4. **Next two weeks:** STG to implement the Art. 16 notice-and-action form at `/report-illegal-content` and the Art. 17 statement-of-reasons email template (item 1).
5. **Round two scheduled:** I will prepare a consolidated redline of Terms, Privacy Policy, Seller Agreement, and Cookie Policy incorporating everything agreed above, plus the items where I am waiting for your confirmation (accountant on VAT, EveryPay on fund-flow). Target: three weeks from today.

---

## §F — What is not in this memo

Three categories of work that are adjacent to the brief but not inside it:

1. **EAA (Accessibility) statement fill.** Your Phase 4 plan covers this. I will provide a drafted full statement in round two once the accessibility audit has been completed against WCAG 2.1 AA and Directive (EU) 2019/882 Annex I. If you want a placeholder statement sooner, flag and I will send one separately.
2. **Latvian translation.** You mentioned Phase 4 as the target for full LV translation. I recommend the translation be commissioned from a specialist legal translator (not a general translator) and reviewed by Latvian-language counsel before going live. Happy to recommend.
3. **Cookie Policy redline.** Your Cookie Policy was merged in Phase 1 and my read of it is that it is substantively correct, but I have not given it a line-by-line pass. Flag if you want that included in round two.

---

## Closing

Two requests before round two:

1. Please send the EveryPay compliance conversation outcome (item 2) when you have it. Everything downstream of that affects the drafting of Terms §1, Seller Agreement §2, and the chargeback-clawback clause in Seller Agreement §5.
2. Please have your accountant confirm the VAT article references in item 7 and send the confirmation in writing. I will not redline the VAT-disclosure drafting until that confirmation is in hand.

If any of the product/engineering flags (§D) are not going to be resolvable on the timeline above, let me know sooner rather than later — several of the drafting decisions cascade from those, and I would rather hold the redline than ship it with stale assumptions.

Thank you again for the brief. This is substantially above the quality of material I normally receive, and it means round two should be considerably shorter than round one.

---

*This memorandum is provided for the exclusive use of Second Turn Games SIA in connection with the matter described above. It is not legal advice to any other person or for any other purpose. It reflects the law as I understand it to stand on the date of this memo and does not account for subsequent changes. Nothing in this memorandum is intended to create an attorney-client relationship with any person other than Second Turn Games SIA.*

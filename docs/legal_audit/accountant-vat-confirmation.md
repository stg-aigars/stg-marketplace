# Accountant VAT & Retention Confirmation

**From:** [Accountant name], [Firm name] — Latvia certified tax advisor
**To:** aigars@secondturn.games
**Re:** Second Turn Games — four VAT and retention questions (your email of [date])
**Date:** 5 May 2026

---

Hi Aigars,

Thanks for the clear framing. Your lawyer's analysis is broadly correct on all four items, with two refinements on the VAT side and one on retention that I want to flag before you publish. Numbered answers below; I've kept them email-length so you can forward this to the lawyer for round two without editing.

## Question 1 — Article 58 for commission to private-individual sellers

**Confirmed, with one characterisation point to be aware of.**

Article 58 of Directive 2006/112/EC is the correct reference for your commission billed to private-individual sellers in LV/LT/EE. Place of supply is the seller's country of residence; VAT is charged at the seller's country rate (21% LV, 21% LT, 24% EE); your prior reference to Article 46 was wrong.

The characterisation question underneath this: Article 58 applies because the commission is payment for an **electronically supplied service** within the meaning of Annex II of the VAT Directive and Article 7 of Implementing Regulation 282/2011. An electronically supplied service is one that is delivered over the internet, is essentially automated, involves minimal human intervention, and could not be supplied without information technology. A marketplace platform fee — for hosting the listing, facilitating search, mediating the payment, and providing the dispute-resolution infrastructure — meets all four criteria. The Latvian State Revenue Service (VID) has been consistent on this characterisation in its published rulings on digital marketplaces since the 2015 implementation of the telecoms/broadcasting/ESS rules.

One edge case to be aware of, in case a regulator ever pushes: where a marketplace provides *genuine human-mediated intermediation* (a dedicated account manager negotiates the transaction, a representative handles specific deals), the service shifts out of ESS and into Article 46 (intermediation) territory. That is plainly not what STG is doing. Your human intervention is limited to moderation and dispute resolution, both of which are ancillary. Stay on Article 58.

**Final wording I'd suggest for the Seller Agreement §4 disclosure:**

> "Our commission is an electronically supplied service within the meaning of Article 7 of Council Implementing Regulation (EU) No 282/2011. Place of supply is determined under Article 58 of Directive 2006/112/EC (place of supplier's non-taxable-person customer). VAT is added at the rate of your country of residence: 21% for Latvia, 21% for Lithuania, 24% for Estonia."

The addition of the Implementing Regulation reference makes the characterisation explicit and is helpful if you are ever audited on whether the service properly qualifies as ESS.

## Question 2 — Article 50 for shipping re-supply, with a refinement

**Article 50 is correct for cross-border Baltic shipments. Article 49 applies to purely domestic shipments. In both cases the VAT rate is the country of departure (seller's country), so the practical outcome is identical — but the article reference differs by scenario.**

Mechanically:
- **Cross-border (e.g. LV seller → LT buyer, or EE seller → LV buyer):** Article 50 governs. Place of supply = place of departure = seller's country. VAT at seller's country rate.
- **Domestic (e.g. LV seller → LV buyer):** Article 49 governs, not Article 50, because there is no intra-Community transport. Place of supply = where the transport takes place = seller's country. VAT at seller's country rate.

Because the rate outcome is the same in both scenarios and STG cannot always know at the moment of VAT determination whether the shipment is cross-border or domestic until the parcel is handed off, I recommend you cite Article 50 as the primary reference with Article 49 as the fallback for domestic cases, or — cleaner — draft the seller-facing disclosure without the article number and carry the article references only in internal tax documentation. Your sellers will not audit the footnote; VID will ask you to justify your position in an internal paper trail.

**Final wording I'd suggest for the Seller Agreement:**

> "When we arrange shipping through our logistics partners on your behalf, we re-supply the shipping service to you at the VAT rate of the country where the goods depart (your country). Place of supply is determined under Articles 49 and 50 of Directive 2006/112/EC."

This is both article references in one phrase and is defensible without overcommitting to a single article in a scenario where the applicable rule can shift per transaction. Keep the detailed scenario analysis in your internal tax memo.

One side-point while I'm here: if you ever extend shipping outside the three Baltic countries (e.g. a Polish or Finnish buyer), the place-of-supply rules stay the same for intra-EU (Article 50, departure country rate) but third-country shipments fall outside the scope of the Directive and you would need to look at the destination country's import VAT rules. That is a future problem, but flag it for me before any geographic expansion.

## Question 3 — PVN likums Article 133 retention period

**Confirmed with a small refinement.**

Your lawyer's formulation — "5 years from end-of-year for ordinary commission invoices, 10 years for immovable-property invoices" — is correct in substance but slightly misattributes the 10-year figure. Here is the precise position under current PVN likums:

- **Ordinary VAT invoices and supporting documentation:** 5 years from 1 January of the year following the year in which the invoice was issued. This is the baseline under Article 133(1).
- **VAT invoices relating to immovable property (real estate transactions, rentals subject to VAT, construction):** 10 years. This is a combination of Article 133 and the separate capital-goods adjustment rules under Articles 102–103 PVN likums (transposing Articles 187–191 of the VAT Directive). The 10-year figure comes from the capital-goods adjustment period for immovable property; the retention figure tracks it because you need the source invoices to perform the adjustment calculations.

For a C2C board-game marketplace with zero immovable-property exposure, only the 5-year figure applies. Your Privacy §9 can accurately state "up to 5 years for VAT invoices under Article 133 of the VAT Law (PVN likums)". There is no factual basis to extend to 10 years in your case because you do not have immovable-property transactions.

**Recommendation for Privacy §9:** state "5 years" rather than "up to 10 years". The conservative ceiling framing your lawyer suggested is defensible, but it commits you publicly to a longer retention than the statute requires, which is the exact issue your GDPR "necessary and proportionate" standard is designed to prevent. If you keep the "up to 10 years" language, a subject-access request or DVI enquiry can probe why — and "our lawyer said it was conservative" is not a legal-basis answer under Art. 6(1)(c) GDPR.

**Suggested Privacy §9 replacement wording for the VAT row:** "VAT invoices and supporting documentation: 5 years from the end of the calendar year of issue, in accordance with Article 133 of the Latvian VAT Law (Pievienotās vērtības nodokļa likums)."

## Question 4 — Grāmatvedības likums §10 retention periods, with marketplace-specific additions

**Your lawyer's headline characterisation is correct but incomplete for a marketplace. Here is the full picture for STG.**

§10 of the current Latvian Accounting Law (Grāmatvedības likums, in force from 1 January 2022, revised several times since) sets the retention baseline as follows:

- **Source documents (grāmatvedības attaisnojuma dokumenti) for recurring business operations:** 5 years after the end of the calendar year to which they relate.
- **Source documents relating to personnel and wages:** 10 years, extended to 75 years for records necessary to calculate state pensions (not relevant to STG at current scale, but will be if you hire).
- **Annual reports and the audit reports relating to them:** 10 years.
- **Accounting registers and journals:** 10 years.
- **Contracts that create ongoing obligations:** until 5 years after the contract terminates.

Your lawyer's "10 years for tax declarations, annual reports, and immovable-property transactions" correctly captures the annual-report category and is correct on immovable property, but the tax-declaration figure derives from the tax-audit statute of limitations (Likums "Par nodokļiem un nodevām" — general tax law — which permits audits up to 3 years back in the ordinary course and up to 10 years for serious violations), not from §10 of the Accounting Law directly. The practical outcome is the same — retain tax-relevant documents for 10 years — but the legal source matters for a publicly cited retention period.

**Marketplace-specific categories you asked about, with my recommended retention periods:**

| Record category | Retention | Legal basis |
|---|---|---|
| Commission VAT invoices | 5 years from end-of-year of issue | PVN likums Art. 133 |
| Wallet ledger entries (per-seller running balance) | 5 years from end-of-year of last entry affecting the balance | Grāmatvedības likums §10, source documents |
| Payout records (seller withdrawals to IBAN) | 5 years from end-of-year of payout | Grāmatvedības likums §10, source documents |
| Chargeback records | 5 years from end-of-year of resolution | Grāmatvedības likums §10, source documents |
| Order records (completed orders with money flow) | 5 years from end-of-year of completion | Grāmatvedības likums §10, source documents |
| Order records (cancelled orders, no money flow) | 2 years from end-of-year of cancellation | No statutory basis; internal dispute-defence period |
| DAC7 seller data (TIN, DOB, address, reported amounts) | **10 years from end-of-year of reporting** | Separate obligation under Council Directive (EU) 2021/514 as transposed by Latvia — this is not a §10 question, it is a DAC7-specific obligation and it is the longest retention category you have |
| Annual financial reports and supporting ledgers | 10 years | Grāmatvedības likums §10, annual reports |

The DAC7 row is the important one and I want to flag it explicitly: DAC7 retention is **separate from and longer than** the Accounting Law retention, and the basis is Article 25 of Council Directive 2011/16/EU as amended by (EU) 2021/514. Your Privacy §9 should carry the 10-year DAC7 retention as its own row with its own legal-basis citation, not folded into the Accounting Law bucket. I see from the brief summary that your Privacy §9 already does this — good.

**Recommendation on drafting:** restructure Privacy §9 so that each retention period is stated with its precise statute reference rather than a blanket "up to 10 years". It is slightly longer on the page but materially easier to defend. Template:

> "Completed orders and invoices: 5 years, as required by Article 133 of the Latvian VAT Law and §10 of the Latvian Accounting Law.
> DAC7 seller reporting data: 10 years from the end of the calendar year of reporting, as required by Article 25 of Council Directive 2011/16/EU (as amended by Council Directive (EU) 2021/514)."

## Disagreements with the lawyer

None material. Your lawyer got the substance right on all four items. The refinements above are:

1. Add the Implementing Regulation 282/2011 reference to the commission disclosure (item 1) — makes the ESS characterisation robust to audit.
2. Cite both Articles 49 and 50 for shipping (item 2) — cleaner than picking one when the applicable article varies by scenario.
3. State "5 years" not "up to 10 years" for the VAT invoice retention (item 3) — the 10-year figure is specific to immovable property, which STG does not have.
4. Break out DAC7 retention separately from the Accounting Law retention (item 4) — the legal bases are different and combining them obscures the longer obligation.

If your lawyer disagrees with any of the above on the drafting, happy to get on a call — particularly on item 2, where the "carry both references or carry neither" argument cuts both ways.

## On file for your compliance records

This email is fine to file as the written confirmation. If you want a formal cover letter on firm letterhead for the regulator-facing file, let me know and I'll send one — the content will be identical.

Timing: I understand the round-two lawyer redline is mid-May 2026. This gives your lawyer about 10 days with this confirmation before the redline lands, which is ample.

Best regards,

[Accountant name]
[Firm name]
Latvia certified tax advisor (sertificēts nodokļu konsultants)
[Contact]

---

## Internal notes (not part of accountant's email)

**File location:** `docs/legal_audit/accountant-vat-confirmation.md`. Cite in round-two lawyer package as the source for the four answered items.

**Unblocks:** PR H in Phase 3 queue — "VAT disclosure in Seller Agreement §4/§7" — specifically the exact wording of Article 58, Article 49/50, and the ESS characterisation statement.

**Changes this requires upstream:**

1. `src/app/[locale]/seller-terms/page.tsx` §4 — add ESS + Article 58 disclosure as drafted above, plus Articles 49/50 language for shipping.
2. `src/app/[locale]/privacy/page.tsx` §9 — restructure retention rows: state "5 years" for VAT invoices (not "up to 10"), split DAC7 into its own row with Directive 2011/16/EU as amended citation.
3. Internal tax memo (not published) — capture Article 49 vs Article 50 scenario analysis for audit-trail purposes.
4. `CLAUDE.md` "Invoicing Model" note — update the article references from "Article 46 (for commission)" to "Article 58" and from "Article 50 (transport of goods)" to "Articles 49 and 50 depending on whether cross-border or domestic".

**Items the lawyer can now finalise in the round-two redline:**

- Item 7 of the 26 April memo (VAT disclosure) — fully unblocked.
- §B item 2 (Latvia VAT Law Art. 133 retention) — confirmed as 5 years, not 10.
- §B item 3 (Grāmatvedības likums §10) — confirmed with marketplace-specific categories mapped.

**Items still pending after this confirmation:**

- Item 2 (PSD2 Art. 3(b)) — still awaiting EveryPay conversation outcome.
- Item 12 (DPA worksheet) — still awaiting per-processor DPA verification in each admin console.
- Item 13 (ROPA) — still to be built internally.

**Follow-up needed with accountant:**

- Confirm firm-letterhead version of this confirmation if needed for regulator file (nice-to-have, not blocking).
- Schedule separate conversation on DAC7 reporting mechanics (format, deadline, interaction with VID's electronic declaration system) — separate from the questions above; belongs in the DAC7 operational readiness workstream rather than the legal review.

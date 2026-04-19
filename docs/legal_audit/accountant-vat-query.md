# Accountant VAT & Retention Confirmation Request

**Purpose:** The outside legal counsel engaged for our pre-launch review flagged four items in their 26 April 2026 memo as sitting at the boundary between legal and tax-specialist work. We need your confirmation in writing before we publish the associated clauses in our public Seller Agreement and Privacy Policy.

The full legal memo is in `docs/legal_audit/lawyer-response.md` — the items below are items 7, §B item 2, and §B item 3 of that memo. Draft text below, ready to send as email.

---

## Draft email

**To:** [accountant]
**From:** aigars@secondturn.games
**Subject:** Second Turn Games — four VAT and retention questions before Seller Agreement update

Hi [name],

We're finalising the pre-launch version of the Second Turn Games Seller Agreement and Privacy Policy. Our lawyer's memo flagged four items that sit at the tax-specialist boundary, and we need your confirmation before we publish the associated clauses. Each item is one line; the full memo context is attached if you want it, but the questions should stand on their own.

### Question 1 — VAT place of supply for commission to private-individual sellers

Our commission (10% flat on item price) is charged to a seller who is a private individual — a non-taxable person — resident in Latvia, Lithuania, or Estonia. Our lawyer's analysis is that the place of supply should be determined under **Article 58 of Directive 2006/112/EC** (telecommunications, broadcasting, and electronically supplied services to non-taxable persons) — putting place of supply in the seller's country. Our internal docs had previously referenced Article 46, which the lawyer says is wrong.

**Can you confirm Article 58 is the correct reference for marketplace commission billed to private-individual sellers in LV/LT/EE?**

If confirmed, we will charge VAT at the seller's country rate: 21% for LV, 21% for LT, 24% for EE.

### Question 2 — VAT place of supply for shipping re-supply

Shipping (Unisend parcel locker) is funded by the buyer at checkout but is contractually a logistics service we re-supply to the seller. Our lawyer's view is that place of supply falls under **Article 50 of Directive 2006/112/EC** (transport of goods, non-taxable persons — place of departure). Goods depart from the seller's country, so VAT at the seller's country rate applies.

**Is Article 50 the correct reference for this re-supply, or should Article 49 (intra-Community transport of goods) apply in cross-border Baltic cases?**

### Question 3 — Latvia VAT Law (PVN likums) Article 133 retention period

Our lawyer cites Article 133 as requiring 5 years of retention for ordinary VAT invoices from the end of the calendar year in which the invoice was issued, extended to 10 years for invoices relating to immovable property.

**Is "5 years from end-of-year for ordinary commission invoices, 10 years for immovable-property invoices" the correct characterisation of the current Article 133 text?** If not, please give the correct figures — our Privacy Policy §9 commits to these retention periods publicly, so accuracy matters.

### Question 4 — Latvia Accounting Law (Grāmatvedības likums) §10 retention periods

Similar question for accounting source documents. Our lawyer says §10 requires 5 years for source documents, extended to 10 years for tax declarations, annual reports, and immovable-property transactions.

**Is this the correct characterisation of the current §10 text, and are there any record categories specific to a C2C marketplace (wallet ledger entries, payout records, chargeback records) that you'd retain for longer than 5 years by default?**

---

## Context for you (not part of email body)

**Why this matters now:** Our public Privacy Policy §9 already commits to retention periods based on your earlier guidance, and our Seller Agreement §4/§7 is about to publish VAT treatment in writing. If the article references or retention figures drift, we either publish inaccurate law references (which a regulator spots instantly) or we overshoot the statute on retention (which invites subject-access-request challenges on the "necessary and proportionate" standard).

**Timing:** Any time in the next two weeks works. We're not blocked on anything commercial; our lawyer's consolidated redline is scheduled for three weeks after their memo (so mid-May 2026), and your confirmation feeds directly into that redline.

**Format of your reply:** A short written confirmation (email is fine) that we can file with our compliance records is all we need. If you disagree with any of the lawyer's characterisations, say so and we'll route back through them.

---

## Response landing

When the confirmation comes back, save at `docs/legal_audit/accountant-vat-confirmation.md` so the round-two lawyer package can cite it. That file unblocks PR H (VAT disclosure in Seller Agreement §4/§7) in the Phase 3 PR queue.

I've read all three documents and cross-referenced them with your business model in CLAUDE.md. Overall, the docs are well-written and genuinely reflect a real operational model — better than most marketplaces at this stage. But there's meaningful regulatory debt, and a few inconsistencies between the docs and what the codebase actually does. Organized by severity below.

Tier 1 — Compliance risk (address before launch or very soon after)
1. DSA (Digital Services Act) obligations missing across all three docs. As an EU-based online marketplace, you're an "intermediary service" / "online platform" under the DSA (applies regardless of size — non-VLOPs still have core obligations). Currently missing:

Single point of contact for authorities (Art. 11) and for users (Art. 12) — contact email exists, but it should be explicitly designated in the terms.
Notice-and-action mechanism for illegal content (Art. 16) — users need a clear way to report illegal listings, not just "prohibited content".
Internal complaint-handling system for platform decisions like account suspensions and listing removals (Art. 20) — currently there's no appeal path described.
Statement of reasons when moderating content (Art. 17) — you already plan audit logging; add the user-facing commitment.
Trader identification under Art. 30 — even though you say "all sellers are private individuals", DSA requires you to have a process to collect and verify that status and handle cases where someone is actually a trader (your "suspected commercial activity" clause hints at this but doesn't operationalize it).

2. ODR platform link is legally required and absent. Regulation 524/2013 Art. 14 requires online traders in the EU to provide an easily accessible link to the ODR platform (https://ec.europa.eu/consumers/odr). Even though the sellers are private individuals, STG itself provides a paid service to consumers. Add this to the Terms §14 and ideally to the footer.
3. DAC7 threshold inconsistency. Seller Terms say "30 transactions or €2,000" (the correct statutory threshold from Council Directive 2021/514). CLAUDE.md references "25 transactions or €1,750" as your internal warning threshold. Both are correct in their context, but the Seller Terms should say something like: "We may ask for DAC7 data as you approach this threshold, and we are required to report it to the Latvian State Revenue Service (VID) if you exceed 30 sales or €2,000 in a calendar year." Otherwise a seller who gets asked for a TIN at €1,751 will reasonably claim the terms say you shouldn't be asking yet.
4. Privacy Policy — missing processors/recipients that the codebase uses. Per CLAUDE.md and dependencies.md, you use:

Sentry (error monitoring — can capture PII in stack traces and user context)
Google OAuth (for sign-in)
Cloudflare (DNS-only, minor — but Turnstile is planned and does set a cookie/collect IP)
BGG (outbound — noting it isn't a processor but users may want to know their searches don't go there)
Hetzner (sub-processor of your infra; Supabase is named but the host isn't)

Any of these missing from §5 is technically a GDPR Art. 13/14 breach and a discoverable gap if DVI audits. Sentry is the most exposed because stack traces routinely leak user IDs, emails, and request bodies.
5. Privacy Policy — missing legal bases (GDPR Art. 13(1)(c)). You list purposes but not the legal bases for each. Standard mapping:

Account + orders → contract performance (Art. 6(1)(b))
Tax records, invoices, DAC7 → legal obligation (Art. 6(1)(c))
Fraud prevention, security analytics → legitimate interest (Art. 6(1)(f))
Any marketing → consent (Art. 6(1)(a))

6. Privacy Policy — missing mandatory GDPR elements. Specifically:

Controller identification with full legal entity name + registration number + registered address (should match the Terms §1).
Data protection contact (e.g. privacy@secondturn.games) — a DPO isn't required at your scale, but a dedicated contact is expected.
Right to lodge a complaint with the supervisory authority (Latvia: Data State Inspectorate / DVI).
International transfer mechanism if any processor operates outside the EU/EEA (Resend and Sentry both have EU regions — confirm which region your accounts use and state it).

7. Rome I jurisdiction clause may not be enforceable against LT/EE consumers. Terms §14 says "courts of Riga" and Latvian law applies. Under Rome I Regulation Art. 6, a consumer can always sue in their country of habitual residence when the trader directs activity there — which you explicitly do for LT and EE. You can keep Latvia as governing law with appropriate wording, but you can't restrict jurisdiction. Soften to "without prejudice to mandatory consumer protection rules in your country of residence."
8. Privacy policy is stale relative to Terms. Privacy last updated 16 March 2026; Terms 6 April 2026. Suggests they're updated independently rather than as a coordinated legal review. Worth syncing to show version discipline.

Tier 2 — Business model gaps (codebase ≠ docs)
9. Features in the codebase not reflected in any document. From CLAUDE.md:

Shelf offers / open-to-offers flow — buyer-initiated offers, counters, 7-day expiry, 3-day listing deadline. This is a pricing mechanism with its own rules and should be in both Terms and Seller Agreement.
Listing comments — public Q&A with moderation and soft-delete. Current "User content" §11 doesn't cover comments, and the moderation policy (staff soft-delete) isn't described.
Auctions — planned with bid binding, snipe protection, payment deadlines. When this ships, auctions need their own section (binding nature of bids, reserve prices, non-payment consequences).
Wanted listings — planned; will need buyer-side obligations when ships.

Pattern suggestion: add a short "Marketplace features" section that names each feature mechanism and points to any feature-specific rules, so each launch is a small amendment rather than a structural rewrite.
10. Wallet mechanics are under-specified in the Seller Agreement §5. Missing:

Minimum withdrawal amount (if any).
What happens on chargeback after wallet withdrawal — this is the most dangerous operational scenario: buyer card-disputes a completed order, your platform owes EveryPay, seller has already withdrawn. You need contractual right to claw back from future wallet balance and, failing that, to pursue the seller directly.
Dormant/inactive wallet policy (escheatment rules vary by country).
Currency (EUR).
KYC/IBAN verification — what you check, when, why.
What happens if wallet goes negative (e.g. post-completion refund ordered).

11. PSD2 Article 3(b) "commercial agent" framing is under some pressure. The 2019 EBA Guidelines narrowed this exemption considerably — the agent must act for only one side of the transaction with genuine authority. Your model (holding funds on the seller's behalf, mediating disputes, managing refunds) is defensible but not bulletproof. Two concrete things to do:

State explicitly in Terms §1 and Seller §2 that STG is the seller's agent (single-sided).
Have your lawyer confirm with FCMC whether your model still qualifies, given the dispute-handling and multi-day holding period. If it doesn't, you're looking at either a payment institution license or partnering with a licensed PSP in escrow mode. This is expensive to discover late.

12. VAT treatment is invisible to sellers. Per CLAUDE.md, you invoice sellers for commission + shipping with VAT by seller's country (LV/LT 21%, EE 24%). Sellers should see this in the Seller Agreement so the invoice isn't a surprise:

Commission is VAT-inclusive or VAT-added — state which.
Shipping line is a pass-through service under Art. 50.
Invoice is issued automatically in the format INV-YYYY-NNNNN.
Whether STG itself is VAT-registered (include the VAT number if so — Latvia Commercial Law §8 arguably requires this on business communications anyway).

13. Latvia Commercial Law §8 identification. You've already flagged this for emails. The same obligation applies to the website and terms pages — add registered office, registration number, share capital, and VAT number to a consistent legal block. Currently Terms has reg number + address; Privacy has neither.
14. Registration number discrepancy flagged in CLAUDE.md is not resolved. The DAC7 files use a different identifier than constants.ts. Whatever the right number is, it should match across Terms, invoices, DAC7 filings, and any letterhead. Worth resolving before first DAC7 filing so you don't have to amend historical reports.

Tier 3 — Quality and completeness
15. Age verification mechanism. Terms say 16+ to use, 18+ to sell. How do you actually verify? GDPR Art. 8 digital services age of consent varies (LV 13, LT 14, EE 13). If you genuinely enforce 16+ you're safely above all three, but you need at least a self-declaration checkbox at signup and a clear deletion path when a minor is discovered.
16. €100 floor on limitation of liability may be challenged. Under Latvian consumer law and broader EU unfair terms doctrine, liability caps against consumers are scrutinized. The "whichever is greater" framing helps, but €100 is low. Consider anchoring higher (e.g. €500 or 6× order value) or removing the numeric floor entirely and relying on "to the maximum extent permitted by law."
17. European Accessibility Act (EAA) statement. Applies to e-commerce services from 28 June 2025. An accessibility statement page + commitment in Terms is expected. Low effort to add a placeholder and a remediation roadmap.
18. Data retention specifics. Privacy §8 says "7 years for tax" — actually:

VAT invoices in Latvia: 10 years (confirm with your accountant).
DAC7 records: 10 years.
Account data after deletion: should specify (e.g. 30 days grace for reactivation, then hard delete except legally retained records).

19. Chargeback/sanctions not mentioned. No AML/sanctions language. For a marketplace collecting payouts to IBANs, a short clause reserving the right to screen and freeze for sanctions/AML reasons is standard.
20. Photo deletion on listing removal. Privacy should note that listing photos are deleted from Supabase Storage per your cleanup-photos cron — this is actually a privacy strength worth documenting.
21. Public profile disclosure. Your public_profiles view exposes some fields to anonymous visitors. Privacy should name which profile fields are public (display name, country/flag, avatar, seller stats) so no user is surprised.

Suggested next steps
If you want a clean attack order for PRs:

Immediate, no-lawyer-needed: add Sentry, Turnstile (when deployed), Google OAuth, and Hetzner to Privacy §5; add privacy@ contact + DVI complaint right; sync Privacy and Terms dates; add ODR link in Terms §14 and footer.
Lawyer sign-off batch: DSA compliance block (SPOCs, notice-and-action, internal complaint handling, trader identification policy); Rome I jurisdiction softening; DAC7 threshold clarification; wallet chargeback-clawback clause; commercial agent single-sided framing.
Coordinated with features: amend Terms for shelf offers + listing comments (exist today), then again for auctions and wanted listings at their launches.
Strategic review with lawyer + accountant: PSD2 Article 3(b) exemption robustness under EBA 2019 guidelines; VAT disclosure in Seller Agreement; Latvia Commercial Law §8 full identification block; registration-number discrepancy.
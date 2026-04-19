# Record of Processing Activities (ROPA)

**Controller:** Second Turn Games SIA (reg. 50203665371, Evalda Valtera 5-35, Riga, LV-1021, Latvia)
**Data-protection contact:** privacy@secondturn.games
**Version:** 1.0
**Last reviewed:** 26 April 2026

This document is an internal record maintained under Article 30 of Regulation (EU) 2016/679 (GDPR). It covers every non-occasional processing activity where STG acts as controller. It is not a public document but is produced on request to the Data State Inspectorate of Latvia (DVI) or to a data subject making an access request against our overall processing posture.

The Article 30(5) exemption for organisations with fewer than 250 employees does **not** apply to STG because our processing is systematic, non-occasional, and reaches data subjects across the EU.

Each activity below carries the Article 30(1)(a)–(g) fields. Where a field is shared across activities (controller identity, DPO status, TOMs), the shared entries are in §0 and activity sections reference §0 rather than repeating.

---

## §0. Shared attributes

**Controller (Art. 30(1)(a)):** Second Turn Games SIA. Registration 50203665371. Registered at Evalda Valtera 5-35, Riga, LV-1021, Latvia. Phone +371 26779625. Email privacy@secondturn.games (data-protection requests); info@secondturn.games (general).

**Data protection officer (Art. 37):** Not designated. STG's processing does not meet the Art. 37(1)(a)–(c) mandatory-DPO thresholds (no public authority role, no large-scale systematic monitoring, no large-scale special-category processing). Data-protection contact is the `privacy@` mailbox, monitored by the founding team.

**Technical and organisational measures (Art. 30(1)(g)):** The following measures apply to every processing activity in this ROPA unless noted otherwise on the activity.

- **Encryption:** TLS 1.2+ in transit to all processors; AES-256 at rest via Supabase Storage and Supabase Postgres (managed by Supabase on AWS infrastructure, EU North region / Stockholm).
- **Access control:** row-level security policies enforced at the Postgres layer. Service-role access audited via audit_log table. Staff access gated by Supabase dashboard roles.
- **PII scrubbing before third-party transmission:** stack traces to Sentry are filtered by `src/lib/sentry/strip-pii.ts` before leaving the server; PostHog events are routed through a first-party `/ingest` proxy that strips client IP headers.
- **Authentication:** Supabase Auth with email/password, Google OAuth, Facebook OAuth. OAuth providers are independent controllers (see §2).
- **Audit logging:** compliance-relevant events (terms acceptance, moderation actions, order-status changes, dispute events) are recorded in `audit_log` table via `logAuditEvent` helper; retention is 30 days from the `cleanup-audit-log` cron.
- **Retention enforcement:** automated crons (`cleanup-sessions`, `cleanup-photos`, `cleanup-audit-log`, `cleanup-notifications`) remove expired data on schedule.
- **Breach response:** 72-hour notification to DVI per Art. 33, and direct notification to affected data subjects per Art. 34 where the risk is high.
- **Organisational:** all staff on need-to-know access; confidentiality obligations in employment contracts; periodic compliance review at each lawyer engagement.

**Subject access request handling:** Data-subject rights requests are handled by the founding team against the `privacy@` mailbox. Self-serve export and deletion are available from account settings; manual requests answered within 30 days of receipt.

---

## §1. Marketplace platform data

| Field | Value |
| --- | --- |
| **(a) Controller** | See §0. |
| **(b) Purpose** | Operate the peer-to-peer marketplace: listing creation, browse, search, order placement, order fulfilment tracking, reviews, messaging. |
| **(c) Data subjects + categories** | Registered users (buyers, sellers). Categories: user identifier, display name, country, avatar URL, listing content (game identifier, description, photos, price, condition), order metadata (order ID, status, timestamps), review text + rating, inbound/outbound message content. |
| **(d) Recipients** | Internal (founding team, service-role access only). Supabase (sub-processor — see §0 TOMs). The public (for fields exposed via `public_profiles` view: display name, country, avatar, account creation date, review text). |
| **(e) Third-country transfers** | None directly. Supabase runs on AWS EU-North (Stockholm); some metadata and support access may transit the US under SCCs + DPF. See processor-specific DPA worksheet. |
| **(f) Retention** | Active listings until removed or account deleted; photos removed within 6h of listing removal via `cleanup-photos` cron. Completed-order records: 5 years (10 years for tax-declaration support) per Latvia VAT Law Art. 133 and Accounting Law §10. Reviews: retained on reviewed seller's profile indefinitely; reviewer identity anonymised on account deletion. Messages: anonymised (content replaced with `[deleted]`) on account deletion; otherwise retained for life of order. |
| **(g) TOMs** | §0 baseline. Additional: RLS policies on `listings`, `orders`, `reviews`, `listing_comments`, `order_messages` tables. |

**Legal basis (Art. 6):** (b) contract performance for active user, plus (c) legal obligation for the retained-post-deletion subset (tax/accounting).

## §2. Authentication data

| Field | Value |
| --- | --- |
| **(a) Controller** | See §0. Google and Meta are independent controllers of their users' data; they authenticate their own users and return a verified email + profile identifier to STG under the user's own OAuth consent. See §6 of the public Privacy Policy. |
| **(b) Purpose** | User authentication (sign-in, session management, password reset, OAuth linking). |
| **(c) Data subjects + categories** | All registered users. Email address, password hash (argon2id via Supabase Auth), session tokens, OAuth provider identifier, OAuth-returned verified email. For Facebook-originating users: Meta-issued profile identifier. |
| **(d) Recipients** | Supabase Auth. Google / Meta (only at sign-in moment and only the fields they already hold — they do not receive net-new data from STG). |
| **(e) Third-country transfers** | Supabase: EU region, SCCs + DPF. Google and Meta: controller-to-controller transfers under user's own OAuth consent — not STG-originated transfers under Art. 44–49. |
| **(f) Retention** | Credentials and session tokens for life of account. OAuth link preserved until user disconnects or deletes account. On account deletion, `supabase.auth.admin.deleteUser()` is called and the auth row is removed. |
| **(g) TOMs** | §0 baseline. Passwords hashed with argon2id; session cookies HttpOnly + Secure + SameSite=Lax; Supabase Auth MFA available for staff. |

**Legal basis (Art. 6):** (b) contract performance. OAuth provider authentication is covered by the user's consent at the provider's prompt.

## §3. Payment and wallet data

| Field | Value |
| --- | --- |
| **(a) Controller** | See §0. EveryPay (Maksekeskus AS) is an independent controller for the card-data processing portion (PCI-DSS scope); STG receives only tokenised references and transaction metadata. |
| **(b) Purpose** | Accept buyer payments via EveryPay hosted payment page, credit seller earnings to platform wallet, process withdrawals to seller IBANs, handle refunds and chargebacks. |
| **(c) Data subjects + categories** | Buyers: name, email, transaction amount, currency, EveryPay transaction identifier. Sellers: legal name, IBAN, wallet balance (integer cents), withdrawal request history, KYC status from EveryPay. |
| **(d) Recipients** | EveryPay (Maksekeskus AS). Supabase (storage + RLS). Our bank (Swedbank) for outbound payouts. |
| **(e) Third-country transfers** | None. EveryPay and Swedbank are both EEA-resident. |
| **(f) Retention** | Wallet transaction history: 5 years from end-of-year for accounting purposes (10 years for transactions supporting tax declarations) per Latvia VAT + Accounting law. IBAN + KYC: retained for life of seller relationship + 5 years after last withdrawal. |
| **(g) TOMs** | §0 baseline. Card data never touches STG infrastructure (PCI-DSS scope is inside EveryPay). IBAN stored encrypted at rest. Withdrawals gated by first-withdrawal KYC through EveryPay per Seller §5. |

**Legal basis (Art. 6):** (b) contract performance for active transactions, (c) legal obligation for the retained records.

## §4. DAC7 tax reporting data

| Field | Value |
| --- | --- |
| **(a) Controller** | See §0. Latvian State Revenue Service (VID) is the statutory recipient under Directive (EU) 2021/514. |
| **(b) Purpose** | Statutory reporting of seller transactions to VID under DAC7 once reportable thresholds (30 sales or €2,000 per calendar year) are reached. |
| **(c) Data subjects + categories** | Reportable sellers only. Legal name, date of birth, address, Tax Identification Number (TIN), aggregate sales count, aggregate consideration in cents, quarterly breakdown. |
| **(d) Recipients** | Latvian State Revenue Service (VID) — statutory obligation. |
| **(e) Third-country transfers** | None. |
| **(f) Retention** | 10 years from the end of the reportable year per the implementing regulation under Directive 2011/16/EU Art. 25d. |
| **(g) TOMs** | §0 baseline. DAC7 data collected only once a seller reaches the early-warning threshold (25 sales / €1,750) via a dedicated consent-gated flow. Staff DAC7 submission through a narrow `/staff/dac7/*` route with service-role audit logging. |

**Legal basis (Art. 6):** (c) legal obligation — Council Directive (EU) 2021/514.

## §5. Marketing and analytics

| Field | Value |
| --- | --- |
| **(a) Controller** | See §0. |
| **(b) Purpose** | Product analytics (funnel behaviour, pageviews, custom events). Newsletter delivery to opted-in subscribers. We do not run advertising. |
| **(c) Data subjects + categories** | Site visitors (signed in or anonymous): cookieless event identifier, pageview URLs, custom event payloads (e.g. `listing_viewed`, `search_performed`, `order_completed`). Newsletter subscribers: email address, subscription timestamp, subscription source. |
| **(d) Recipients** | PostHog (EU region, Frankfurt). Resend (newsletter delivery). |
| **(e) Third-country transfers** | PostHog and Resend are US-parented; EU data residency configured where possible; SCCs + DPF where not. |
| **(f) Retention** | PostHog events: default PostHog retention (aligned with privacy policy — verified at each DPA review). Newsletter subscribers: until unsubscribed; one year of inactivity then prompted to re-confirm. |
| **(g) TOMs** | §0 baseline. PostHog runs in `cookieless_mode: 'always'` — no cookies, no localStorage. Events routed through `/ingest` first-party proxy that strips `x-forwarded-for` / `x-real-ip` / `forwarded` / `cf-connecting-ip` / `true-client-ip` before forwarding, so PostHog does not receive user IPs. Session replay disabled. |

**Legal basis (Art. 6):** (f) legitimate interest for analytics (platform improvement, security, fraud detection); (a) consent for newsletter subscription.

## §6. Support communications

| Field | Value |
| --- | --- |
| **(a) Controller** | See §0. |
| **(b) Purpose** | Respond to user enquiries, provide account support, handle complaints outside the dispute system, escalate abuse / illegal-content reports. |
| **(c) Data subjects + categories** | Users contacting STG or being contacted by STG: email address, display name, message content, any attachments. Complainants under DSA notice-and-action: the notice payload, the notifier's contact details. |
| **(d) Recipients** | Internal staff inbox (info@, privacy@, dsa-authorities@ — the last two are aliases to info@ for launch). Resend (for outbound emails). |
| **(e) Third-country transfers** | Resend: SCCs + DPF where applicable; EU region if configured. See DPA worksheet. |
| **(f) Retention** | Open enquiries: until resolved. Closed: 2 years, then deleted. DSA notices: 2 years from the decision date for audit-trail purposes. |
| **(g) TOMs** | §0 baseline. |

**Legal basis (Art. 6):** (f) legitimate interest for handling unsolicited support enquiries; (b) contract performance where the enquiry concerns an active order or account.

## §7. Dispute evidence

| Field | Value |
| --- | --- |
| **(a) Controller** | See §0. |
| **(b) Purpose** | Evidence collection and adjudication for buyer-seller disputes under Terms §9. Includes photos (e.g. of damaged packaging, wrong item), tracking screenshots, message transcripts surfaced into the dispute record. |
| **(c) Data subjects + categories** | Disputing buyer and disputed-against seller. Photos uploaded during dispute (may incidentally contain PII — shipping labels with addresses, hand-written notes, medical packaging, etc.). Tracking screenshots (carrier identifiers, addresses). Message excerpts (names, email addresses, timestamps). |
| **(d) Recipients** | Internal staff handling the dispute. Supabase Storage (photos), Supabase Postgres (`disputes` table). EveryPay (if chargeback-dispute status is shared with card network). |
| **(e) Third-country transfers** | As §0 for Supabase; none for internal handling. |
| **(f) Retention** | 7 years from dispute resolution date per legitimate interest (chargeback limitation periods + potential civil claims + audit trail for regulator complaints). This is longer than ordinary marketplace data retention because disputes have downstream legal-process implications. |
| **(g) TOMs** | §0 baseline. **DSAR operational notes:** (i) dispute evidence is the category most likely to trigger Art. 15 subject access requests — motivated + adversarial users. (ii) redaction applied before disclosure — the other disputing party's personal data must be redacted before any disclosure to either side; staff apply redaction manually during DSAR response. (iii) retention hold — if a DSAR is in flight on a dispute record, the automated 7-year retention cron is suspended for that record until the DSAR is closed. (iv) special-category data risk — uploaded photos may incidentally contain health, religious, or political information (medical packaging, religious iconography on gifts); handle as if Art. 9 processing could apply. |

**Legal basis (Art. 6):** (f) legitimate interest (fraud prevention, dispute adjudication, chargeback defence). For any incidental special-category data, Art. 9(2)(f) (legal claims) where the dispute is escalated to a formal claim.

---

## Changelog

- **1.0 — 2026-04-26** — Initial version. Covers the seven processing activities identified in the lawyer memo (§13) plus the DSAR-operational notes for dispute evidence added at review. Built against the lawyer's DPA worksheet in `docs/legal_audit/lawyer-response.md` §C; each activity's Recipients field references processors that are checklist-tracked in `docs/compliance/dpa-verification-runbook.md`.

## Review cadence

- **Annual** review at the calendar anniversary, plus ad-hoc at every lawyer engagement.
- **Event-triggered:** any new processor, any new processing purpose, any breach notification, any structural feature launch (auctions, wanted listings, shelves) requires a ROPA review before go-live.
- **Change log:** append-only at the top of this file; never rewrite historical entries.

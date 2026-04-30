# Audit cross-check — 2026-04-30

The audit document at `docs/legal_audit/claude.md` was reviewed item by item against the actual legal pages (`/privacy`, `/terms`, `/seller-terms`, `/imprint`) and codebase. **About two-thirds of the audit's specific factual claims were already addressed in the live legal pages**; the remaining items split cleanly into "lawyer batch" and "product scope decisions for the user."

This document records what was shipped, what was verified-already-correct, and what remains.

## Already shipped this session

- **#14 Address divergence (DAC7 vs constants)** — PR #234 merged. DAC7 platform-info now threads `LEGAL_ENTITY_ADDRESS` from `src/lib/constants` instead of hardcoding `'Riga, Latvia'`. The DPI XML now carries the full registered address. The "registration number" itself was already consistent.

## Audit claims verified already correct (no action needed)

| # | Audit claim | Reality |
|---|---|---|
| 2 | "ODR platform link missing" | Wrong — ODR was discontinued 20 July 2025 under Regulation (EU) 2024/3228. Terms §15 already states this and lists PTAC/VVTAT/TTJA as the post-ODR consumer-protection path |
| 3 | "DAC7 thresholds in seller terms inconsistent" | Already correct — seller-terms §13 says "30 sales or €2,000" (statutory) AND clarifies "internal warning trigger at 25 sales or €1,750" |
| 4 | "Privacy missing processors (Sentry, Google OAuth, Resend, Hetzner, Cloudflare)" | All already disclosed in Privacy §6 with full processor/independent-controller distinction |
| 5 | "Privacy missing legal bases (Art. 13(1)(c))" | Already mapped in Privacy §3 — full table covering account, listings, transactions, financial, DAC7, usage/security, fraud-prevention against Art. 6(1)(b/c/f) |
| 6 | "Privacy missing controller details + DVI complaint right" | Privacy §1 has full legal name + reg number + address; privacy@ contact in Quick Start; DVI complaint right in §12 |
| 7 | "Rome I jurisdiction unenforceable" | Terms §15 already includes "without prejudice to mandatory consumer protection rules of your country of habitual residence under Article 6 of Regulation (EC) 593/2008" plus Art. 18 of Regulation (EU) 1215/2012 |
| 18 | "VAT retention unclear; should be 10y" | Privacy §9 already correct at 5y per Article 133 of PVN likums. The accountant memo explicitly confirms 5y for non-immovable-property invoices and warns against extending |
| 20 | "Photo deletion not documented in Privacy" | Already in Privacy §5 — explains the cleanup-photos cron + 6-hour window |
| 21 | "Public profile fields not disclosed" | Already in Privacy §2 — names display name, country/flag, profile photo, account-creation date, public reviews |

## Codebase-feature claims verified

| # | Audit claim | Reality |
|---|---|---|
| 1 | "DSA Art. 11/12 SPOCs missing" | Terms §17 has both: Art. 11 (authorities) + Art. 12 (users) at info@secondturn.games |
| 1 | "DSA Art. 16 notice-and-action mechanism missing" | Terms §18 + `/report-illegal-content` form + `/staff/notices` queue + Art. 17 statement-of-reasons audit chain (registered events `dsa_notice.received` + `listing.actioned_by_staff`) |
| 12 | "VAT treatment invisible to sellers" | Already in seller-terms §11 ("VAT on our commission") — explains 10% commission, VAT added on top, country rates, platform VAT number |
| 10 (partial) | "Wallet mechanics under-specified" | Most items already covered in seller-terms §5: chargeback clawback, KYC/IBAN verification, EUR currency, dormant balance (24-month policy), negative-balance handling |

## Genuine gaps remaining

These split into three buckets — different decision owners.

### A. Lawyer batch (legal interpretation needed)

| # | Item | Why batch with lawyer |
|---|---|---|
| 1 | DSA Art. 20 internal complaint-handling system for platform decisions (account suspensions, listing removals) | Genuinely missing from Terms — needs an appeal path described. Legal text only counsel can sign off |
| 1 | DSA Art. 30 trader-identification policy reference | Handled implicitly via seller-terms but not exposed in main Terms with explicit DSA Art. 30 citation. Lawyer judgment whether to add |
| 11 | PSD2 Article 3(b) commercial-agent framing under EBA 2019 Guidelines | The transitional posture rests on this; needs FCMC confirmation. Already on the deferred-work list per `legal_deferred_work.md` |
| 16 | €100 liability cap may be challenged under Latvian consumer law / EU unfair-terms doctrine | Counsel judgment whether to anchor higher (€500 / 6× order value) or remove the floor entirely |
| 19 | AML / sanctions clause | Not present anywhere; standard for marketplaces collecting payouts to IBANs. Counsel-drafted addition |

### B. Product-scope decisions (you decide)

| # | Item | Decision required |
|---|---|---|
| 9 | Listing comments + shelf offers + auctions + wanted listings — feature-specific rules in Terms | Are these features live enough to need terms coverage today, or do they fit under §12 "Marketplace features" generic clause? |
| 15 | Age-verification mechanism | Terms says "16+ to use, 18+ to sell" — is the current self-declaration checkbox enough, or do you want soft-verification (date-of-birth at signup)? |
| 17 | EAA accessibility statement (effective 28 June 2025) | Standalone `/accessibility` page + a Terms reference. Low effort, but it's a public commitment + roadmap; you decide what to commit to |

### C. Operational / nice-to-have

- Sync Privacy `lastUpdated` (2026-04-19) with Terms `lastUpdated` (2026-04-28) **only if** there's a substantive change to ship at the same time — bumping the version constant alone triggers the version-gated acknowledgement banner pattern (per CLAUDE.md `privacy.acknowledged` audit-event flow). Don't churn the version for cosmetic alignment.

## Lawyer-batch email draft

Paste the below to the same counsel who answered the login-activity question. Pre-loads the cross-check so they're reviewing the analysis rather than rebuilding it.

---

**Subject:** Legal review — DSA Art. 20 + commercial-agent + liability cap + AML

Hello,

A separate audit document flagged a list of items across our Terms / Privacy / Seller Agreement. Most turned out to already be addressed when I cross-checked the live pages, but four items genuinely need your sign-off. Bundling them so it's a single review.

**1. DSA Article 20 — internal complaint-handling system**

Our Terms cover Art. 11/12 SPOCs and Art. 16/17 notice-and-action well. What's missing is an explicit internal-complaint path for platform decisions affecting users (account suspensions, listing removals, etc.) under Art. 20. We have the operational machinery — a staff dispute and notice queue, audit trail — but no Terms section telling a user how to appeal a decision we make about them.

Question: should we add a new Terms section "Appealing platform decisions" pointing to a dedicated email address (e.g. appeals@secondturn.games), with the Art. 20 statutory timelines? If yes, please draft the wording.

**2. DSA Article 30 trader identification — explicit reference**

Our seller-terms handle the trader question well (private-individual stance, "if you become a trader, tell us, stop new listings, complete open orders with trader obligations"). What we don't have is an explicit DSA Art. 30 citation in the main Terms or a description of the verification step we'd take if we suspect commercial activity.

Question: should the main Terms reference Art. 30 directly, and should we describe what "verification" means operationally?

**3. PSD2 Article 3(b) commercial-agent framing**

Our payment model relies on the Art. 3(b) commercial-agent exemption of Directive (EU) 2015/2366. EBA's 2019 Guidelines narrowed this exemption considerably — the agent must act for one side with genuine authority. Our model holds buyer funds for the seller's benefit through dispute windows that can run multiple days. The transitional sunset in our codebase (`PSD2_TRANSITIONAL_SUNSET = 2026-10-26`) makes this time-bound.

Question: is the current model still defensible under EBA 2019, or should we be planning the move to either (a) a payment-institution license, or (b) partnering with a licensed PSP in escrow mode? FCMC pre-clearance would help here. We'd value your view on whether to engage FCMC informally now or hold until closer to the sunset.

**4. €100 liability cap — defensibility under Latvian consumer law**

Our Terms cap liability to "the greater of €100 or the order value, save for liability that cannot lawfully be limited" plus the standard carve-outs (death/personal injury, fraud, intermediary statutory liability). The €100 floor may be challenged under Latvian consumer law / EU unfair-terms doctrine.

Question: do you recommend (a) anchoring higher (e.g. €500 or 6× order value), (b) removing the numeric floor entirely and relying only on "to the maximum extent permitted by law," or (c) leaving as-is because the carve-outs do the heavy lifting? Whichever you pick, please draft the replacement wording.

**5. AML / sanctions clause**

We have no AML / sanctions language anywhere. We collect payouts to IBANs across Latvia / Lithuania / Estonia plus occasional non-Baltic IBANs. Standard practice for marketplaces is a short clause reserving the right to screen and freeze for sanctions / AML reasons.

Question: please draft a clause we can add to seller-terms (covering IBAN screening at withdrawal time, freezing of suspicious balances, cooperation with authorities). Indicate which seller-terms section is the right home.

**6. Out of scope for this batch**

These items came up in the audit but are not for you:
- Age-verification mechanism — product decision (we'll decide whether self-declaration stays sufficient)
- EAA accessibility statement — product decision + drafting a public commitment
- Marketplace-feature wording (shelf offers, comments, auctions) — internal product/copy work, not legal interpretation

**Fee + turnaround**

Please indicate. Whichever fits your normal cycle.

Best,
[your name]

---

## Status of the staff-tooling work that was already in flight

Independent of the audit, the following landed today (2026-04-30):

- PR #233 — login-activity infrastructure (D2). Migration 090 + cleanup cron + `/staff/audit/security` page + ROPA entry at `docs/legal_audit/ropa-login-activity.md`. Cleared by counsel earlier today; no policy edit needed.
- PR #234 — DAC7 address consistency fix.

Both deployed via Coolify auto-deploy from main. Migration 090 applied to production via Supabase MCP.

The **Coolify cron entry for `cleanup-login-activity`** still needs to be added (you, in the Coolify dashboard):

```
POST /api/cron/cleanup-login-activity
Authorization: Bearer ${CRON_SECRET}
Schedule: daily
```

Same shape as the other cron entries in CLAUDE.md.

# DPA Verification Runbook

**Purpose:** Verify that we have a signed Data Processing Agreement (DPA) with every processor named in Privacy Policy §6, and that the cross-border transfer mechanism for each US-parented processor is in force. Per the lawyer's memo (§C), our current Privacy §6 text asserts these protections exist — this runbook is what lets us close the gap between that assertion and the filing cabinet.

**Owner:** whoever walks it. Mark yourself in the table below when you pick it up so we don't have two people doing it in parallel.

**Output:** every PDF saved under `docs/compliance/dpa-copies/<processor>.pdf` (and the Annex III sub-processor snapshot saved next to it as `<processor>-subprocessors-YYYY-MM-DD.pdf`). This directory is gitignored for size; the files are stored in our compliance archive (shared drive). The runbook file stays in git.

**What unblocks when it's done:** PR I (full Privacy §6 reframe) ships against the verified reality.

**Expected effort:** 2–3 hours for the ten rows, most of it logging into dashboards and clicking through DPA acceptance screens.

---

## Checklist per processor

For each row below:

1. Log into the processor's admin console.
2. Locate the DPA — usually under Settings → Legal, Security & Privacy, or Compliance. Screenshot or download the PDF.
3. Confirm the SCC module and clause version (details below the table). Old (pre-2021) clauses fail any serious audit after 27 December 2022.
4. Confirm whether the DPA includes the Art. 28(9) "docking clause" (Module 2 Clause 7) that lets new parties accede without amending.
5. Snapshot the processor's current Annex III sub-processor list as a separate PDF. Processors update this without individual notice; we need a dated snapshot of what we accepted.
6. For US-parented processors, check EU–US Data Privacy Framework certification status on https://dataprivacyframework.gov.
7. Confirm the EU-region configuration on your account (where the processor offers one).
8. Save everything to `docs/compliance/dpa-copies/` and update the table row with ✓/✗ + date.

---

## Processor table

| # | Processor | Role | DPA accepted | PDF path | SCC module + year | Docking clause (Clause 7) | Annex III snapshot | DPF certified | EU region confirmed | Notes |
| - | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | **EveryPay (Maksekeskus AS)** | Processor — payments | ⏳ | `…/everypay.pdf` | n/a (EEA) | — | `…/everypay-subprocessors-YYYY-MM-DD.pdf` | n/a (EEA) | EE confirmed | EEA-resident Estonian PI. No SCCs needed. Verify DPA is in the MSA or appended as addendum. Check whether their sub-processor list includes any US-parented entities (card networks, fraud providers). |
| 2 | **Unisend SIA** | Processor — shipping | ⏳ | `…/unisend.pdf` | n/a (EEA) | — | `…/unisend-subprocessors-YYYY-MM-DD.pdf` | n/a (EEA) | LV confirmed | EEA-resident. DPA likely in service agreement. If not explicitly Art. 28-compliant, request an addendum. |
| 3 | **Resend** | Processor — transactional email | ⏳ | `…/resend.pdf` | Module 2 (controller→processor), year 2021 expected | ⏳ Verify Clause 7 present | `…/resend-subprocessors-YYYY-MM-DD.pdf` | ⏳ | ⏳ **Verify EU-only plan configured.** If not, switch now. | US-parented. Standard DPA on account — check Settings → Legal or Compliance. Default DPF status should be active; confirm on dataprivacyframework.gov. |
| 4 | **Supabase** | Processor — DB / auth / storage | ⏳ | `…/supabase.pdf` | Module 2, year 2021 expected | ⏳ | `…/supabase-subprocessors-YYYY-MM-DD.pdf` | ⏳ | Stockholm — confirmed in Supabase dashboard | US-parented (Supabase Inc.). Data at rest in EU; metadata/support access may transit US under SCCs. DPA auto-accepted on account creation; download and file. |
| 5 | **Hetzner Online GmbH** | Sub-processor — VPS | ⏳ | `…/hetzner.pdf` | n/a (DE-based) | — | `…/hetzner-subprocessors-YYYY-MM-DD.pdf` | n/a (EEA) | Helsinki HEL1 confirmed | German company, Finnish datacenter. DPA accepted on ordering process; re-download current copy. |
| 6 | **Cloudflare (incl. Turnstile)** | Processor — CDN / WAF / bot management | ⏳ | `…/cloudflare.pdf` | Module 2, year 2021 expected | ⏳ | `…/cloudflare-subprocessors-YYYY-MM-DD.pdf` | ⏳ | Global edge (no persistent storage of PII) | US-parented. DPA auto-accepted on account; download current copy. Edge nodes are in-transit only — no storage. |
| 7 | **Sentry (Functional Software Inc.)** | Processor — error tracking | ⏳ | `…/sentry.pdf` | Module 2, year 2021 expected | ⏳ | `…/sentry-subprocessors-YYYY-MM-DD.pdf` | ⏳ | ⏳ **Verify EU data-residency plan** (`sentry.io/eu`). Switch if on US. | US-parented. Session replay disabled on our config; PII-stripping filter in `src/lib/sentry/strip-pii.ts` scrubs stack traces before transmission. |
| 8 | **PostHog** | Processor — product analytics | ⏳ | `…/posthog.pdf` | Module 2, year 2021 expected | ⏳ | `…/posthog-subprocessors-YYYY-MM-DD.pdf` | ⏳ | EU (Frankfurt) — confirmed in project settings | US/UK-parented. Frankfurt region means EU-only processing. Verify project is on EU instance. |
| 9 | **Google Ireland Ltd (OAuth)** | **Independent controller** — not processor | **n/a** | n/a | n/a | n/a | n/a | n/a | Ireland | Do not list in processor table in Privacy §6 — already moved to the "Sign-in providers (independent controllers)" section in PR B. Controller-to-controller transfer under user's own OAuth consent. |
| 10 | **Meta Platforms Ireland Ltd (OAuth)** | **Independent controller** — not processor | **n/a** | n/a | n/a | n/a | n/a | n/a | Ireland | Same as Google. No DPA needed; the transfer happens under the user's own "Continue with Facebook" consent. |

**Not a processor (context row):** **BoardGameGeek** — outbound browser connection for listing-card image hotlink only. User's browser contacts `cf.geekdo-images.com` directly; STG does not transfer personal data to BGG. Disclosed in Privacy §6 as "Outgoing connections your browser makes." Do not list in processor table or create a DPA — no processor relationship exists.

---

## SCC version check (detail)

Standard Contractual Clauses were updated by Commission Implementing Decision (EU) 2021/914 on 4 June 2021. Old (pre-2021) clauses became unenforceable for new transfers after 27 September 2021 and for all transfers after 27 December 2022.

When you download each DPA, open it and confirm:

- The clauses are the **2021** version (the document will reference "Commission Implementing Decision (EU) 2021/914").
- The correct **module** applies:
  - **Module 1** controller → controller
  - **Module 2** controller → processor ← *this is what almost all of our relationships need*
  - **Module 3** processor → processor
  - **Module 4** processor → controller
- **Clause 7 (docking)** is present (optional but helpful for future sub-processor additions).

If any processor is still distributing pre-2021 clauses — rare, but it happens — request an updated DPA before proceeding. The old clauses will not hold up on any audit.

## DPF verification (detail)

For the five US-parented processors (Resend, Supabase, Cloudflare, Sentry, PostHog):

1. Go to https://dataprivacyframework.gov
2. Search for the entity legal name (not the brand name — e.g. "Functional Software, Inc." not "Sentry")
3. Confirm status is **Active** — not "Inactive" or "Under Review"
4. Note the certification date — if within the last 90 days, re-check at next quarterly review

If DPF has lapsed: SCCs remain in force as the primary mechanism. DPF is the belt; SCCs are the braces. No action needed on lapse; note the date.

## Rows that fail

If a row comes back with a defect — no DPA, wrong SCC version, missing docking clause, US-configured when EU is available, DPF expired — you have three options for that row:

1. **Sign / accept / reconfigure** to close the defect and proceed.
2. **Switch processors** if the defect can't be closed (e.g. processor refuses updated clauses).
3. **Rewrite Privacy §6** to describe the actual narrower relationship — e.g. downgrade from "processor" to "data reference only" if the processor role isn't what we thought.

Option (3) is the weakest and should only be used when (1) and (2) aren't available on the timeline.

---

## Sign-off

When every row is green:

- [ ] All 10 rows (processors 1–8 confirmed; 9–10 marked n/a)
- [ ] Every PDF filed at `docs/compliance/dpa-copies/`
- [ ] Every Annex III snapshot filed with YYYY-MM-DD in filename
- [ ] DPF statuses checked for all five US-parented processors
- [ ] Date of completion: _______________ (fill in)
- [ ] Completed by: _______________ (initial)

Once signed off, notify the engineering team so PR I (Privacy §6 full reframe) can open and ship.

## Review cadence

Re-walk the whole runbook:

- **Annual** (calendar anniversary).
- **Event-triggered:** any new processor added to Privacy §6, any processor notification of SCC update, any DPF certification challenge (e.g. Schrems III), any breach notification involving a listed processor.

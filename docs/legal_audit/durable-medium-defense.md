# Durable medium — why inline-in-email satisfies ECJ C-49/11

## Context

PTAC §5.1 and §5.2 of the 27.09.2017 distance-trading guidance require the
trader to provide contract terms + the withdrawal-form template "on a durable
medium" (pastāvīgs informācijas nesējs). The seminal case interpreting that
phrase under Directive 2011/83/EU is **Case C-49/11 (BAWAG / Content Services
Ltd v Bundesarbeitskammer, 5 July 2012)**.

This memo records why STG's Phase 8 implementation — inlining the Terms
summary + Annex B withdrawal-form template directly in the order-confirmation
email body — satisfies the C-49/11 standard. The motivating concern: a future
contributor proposes "let's just link to /terms instead — it's simpler." That
proposal would re-introduce the exact failure mode the ECJ rejected.

## What C-49/11 actually held

The court was asked whether a merchant "provides" contract terms to a consumer
on a durable medium when the merchant emails a hyperlink to the merchant's own
website. The court said **no**, on three grounds (paragraphs 41-51):

1. **Active provision.** The directive requires the merchant to "provide"
   the information. A hyperlink requires the consumer to take additional
   steps — clicking through, reading on the merchant's site — and the
   information is not in the consumer's hands until they do. A pull
   (consumer fetches) is not equivalent to a push (merchant delivers).

2. **Editability by the merchant.** A page on the merchant's website can be
   changed by the merchant after the email is sent. The consumer therefore
   does not hold an immutable copy of the terms they agreed to. The court
   treated this as the load-bearing problem with the hyperlink form: it
   cannot serve as evidence of "what we agreed to on day X" because the
   merchant retains unilateral edit rights.

3. **Permanence and reproducibility.** Durable medium requires the consumer
   to be able to store the information personally and reproduce it
   unchanged. A live website page is neither stored personally nor
   guaranteed to be reproducible unchanged.

The court's solution — explicitly cited at paragraph 51 — was that the
merchant must either (a) deliver the text in the email body itself, or
(b) attach the text as a file (PDF, RTF, etc.) the consumer can save.
Either form makes the consumer's email client the durable storage and
removes the merchant's edit access.

## Why inline-in-email satisfies C-49/11

STG's Phase 8 implementation:

- Emails the buyer at order confirmation. The email body contains the full
  Terms summary (parties, version stamps, withdrawal-rights framing,
  dispute-resolution path, legal-entity contact) and the Annex B withdrawal-
  form template (Cabinet Regulation No. 255 of 2014-05-20).
- The buyer's email client (Gmail, Apple Mail, Outlook, Proton, etc.) is the
  storage. STG cannot reach into the buyer's inbox and edit a sent email.
- The buyer can save, print, forward, or screenshot the email at will. The
  text is permanent, personal, and reproducible.
- A `terms_version` and `seller_terms_version` are stamped on the `orders`
  row at insert time (migration 082). This is forensic evidence of which
  contractual constants were in force, independent of the email — the email
  is the consumer's copy; the order row is STG's copy. They match by
  construction.

This is the textbook resolution C-49/11 paragraph 51 contemplates. The link
to `/terms` (an editable canonical Next.js page) remains in the email as a
**navigation convenience** — but it is not the durable medium. Removing the
link would not affect compliance; removing the inline body would.

## Common alternatives — and why they don't help

- **Versioned static PDFs hosted at `public/legal/terms-v[version].pdf`.**
  Compliant in the same way email body is (immutable per filename version),
  but adds a per-version PDF authoring overhead, four-locale translation
  effort, hosting concerns, and the version-discovery complexity of "which
  PDF was current when this order shipped?" Substituting PDFs for email
  body does not improve C-49/11 defensibility — both forms satisfy paragraph
  51's "deliver in body OR attach as file" disjunction. Documented as a
  fallback path in `docs/legal_audit/legal_deferred_work.md`.

- **A versioned read-only Next.js route at `/legal/terms-v[version]`.**
  Considered and dropped during the Phase 8 design pass. The route is a
  navigation convenience, not the durable medium — the email body is
  already that. Building it would have required a JSX-to-markdown refactor
  of the 594-line `/terms` page plus a new `react-markdown` dependency, for
  no compliance lift. Documented as the second fallback path alongside
  static PDFs.

- **A hyperlink to `/terms` in the email body.** This is the C-49/11
  failure mode. Do not introduce it as the primary delivery method. The
  current implementation does keep a `/terms` link in the email — but only
  for navigation, alongside the inline content. If the inline content is
  ever removed and the link remains, that's a regression.

## Revisit signals

- Any regulatory or lawyer correspondence that interprets durable medium
  more narrowly than the email body (e.g. "must be a downloadable
  attachment, body text is insufficient"). Migration path: switch to PDF
  attachments via Resend's `attachments` field — see
  `legal_deferred_work.md`.
- A contributor proposes removing the inline content and relying on the
  `/terms` link. Block the change; refer the reviewer to this memo.
- The Latvian translation rollout (~Week 3-4 per CLAUDE.md). The Annex B
  template ships EN-only at launch under the private-only posture; LV/LT/EE
  versions land with the locale work. Tracking entry in
  `legal_deferred_work.md`.

## References

- Case C-49/11, *Content Services Ltd v Bundesarbeitskammer* (5 July 2012),
  paragraphs 41-51.
- Directive 2011/83/EU, Article 8(7).
- Cabinet Regulation No. 255 of 2014-05-20 (Latvia), Annex B (withdrawal-form
  template).
- PTAC distance-trading guidance, 27.09.2017, §§5.1-5.2.

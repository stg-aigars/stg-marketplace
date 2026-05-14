/** Governs the Terms of Service (/terms), Cookie Policy (/cookies), and
 *  Accessibility Statement (/accessibility). Also stamped on the user row at
 *  terms acceptance and recorded on the audit-log resourceId. Update when
 *  any of those pages change materially. */
export const TERMS_VERSION = '2026-05-13';
export const TERMS_VERSION_DISPLAY = '13 May 2026';

/** Governs the Privacy Policy (/privacy). Update when Privacy content changes
 *  — processor list, legal bases, retention periods, data-subject rights. */
export const PRIVACY_VERSION = '2026-05-13';
export const PRIVACY_VERSION_DISPLAY = '13 May 2026';

/** Governs the Seller Agreement (/seller-terms). Update when Seller content
 *  changes — commission rates, operational requirements, wallet mechanics,
 *  DAC7 narrative. Also stamped on the user row at seller terms acceptance
 *  (Phase 2) and recorded on the audit-log resourceId. */
export const SELLER_TERMS_VERSION = '2026-05-13';
export const SELLER_TERMS_VERSION_DISPLAY = '13 May 2026';

/** The lawyer-drafted private-individual declaration sellers must affirm at
 *  Seller Agreement acceptance. The phrase "not acting in the course of a
 *  business, trade, or profession" is the load-bearing Consumer Rights
 *  Directive term of art that anchors the trader-dispute fallback clause in
 *  Terms §14. Do not soften it in UI. Render via `{SELLER_DECLARATION_TEXT}`,
 *  never hard-code in JSX — a UI refactor must go through this constant. */
export const SELLER_DECLARATION_TEXT =
  'I am at least 18 years old. I confirm that I am a private individual, not acting in the course of a business, trade, or profession. I have read and agree to the Seller Agreement.';

/**
 * Three legal documents that ship with translations.
 * The doc id matches both the URL slug (`/terms`, `/seller-terms`, `/privacy`)
 * and the directory name under `app/[locale]/`.
 */
export type LegalDocId = 'terms' | 'seller-terms' | 'privacy';

/**
 * Four languages each legal document is published in.
 * English is canonical; LV/LT/ET are translations provided for convenience
 * (the English version controls in case of conflict per §17/§10/§14).
 */
export type LegalDocLang = 'en' | 'lv' | 'lt' | 'et';

/** Sunset date for the transitional PSD2 Art. 3(b) wording in Seller Agreement
 *  §3 (Payment authorisation and flow). The current wording does not
 *  affirmatively claim the exemption — it describes the fund flow and flags
 *  that if Art. 3(b) is determined not to apply, we will restructure through
 *  a licensed payment institution. The lawyer memo (2026-04-26) says this
 *  framing is valid for 3–6 months while EveryPay Option 1 (collecting-account
 *  through Maksekeskus) is scoped. Enforced by a Vitest assertion co-located
 *  in `constants.test.ts` — when the date passes, `pnpm test` fails and CI
 *  blocks every subsequent PR until the transitional wording is replaced. */
export const PSD2_TRANSITIONAL_SUNSET = new Date('2026-10-26T00:00:00.000Z');

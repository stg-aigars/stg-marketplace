/** Governs the Terms of Service (/terms), Cookie Policy (/cookies), and
 *  Accessibility Statement (/accessibility). Also stamped on the user row at
 *  terms acceptance and recorded on the audit-log resourceId. Update when
 *  any of those pages change materially. */
export const TERMS_VERSION = '2026-04-26';
export const TERMS_VERSION_DISPLAY = '26 April 2026';

/** Governs the Privacy Policy (/privacy). Update when Privacy content changes
 *  — processor list, legal bases, retention periods, data-subject rights. */
export const PRIVACY_VERSION = '2026-04-26';
export const PRIVACY_VERSION_DISPLAY = '26 April 2026';

/** Governs the Seller Agreement (/seller-terms). Update when Seller content
 *  changes — commission rates, operational requirements, wallet mechanics,
 *  DAC7 narrative. Also stamped on the user row at seller terms acceptance
 *  (Phase 2) and recorded on the audit-log resourceId. */
export const SELLER_TERMS_VERSION = '2026-04-26';
export const SELLER_TERMS_VERSION_DISPLAY = '26 April 2026';

/** Sunset date for the transitional PSD2 Art. 3(b) wording in Terms §1 and
 *  Seller Agreement §2. The current wording does not affirmatively claim the
 *  exemption — it describes the fund flow and flags that if Art. 3(b) is
 *  determined not to apply, we will restructure through a licensed payment
 *  institution. The lawyer memo (2026-04-26) says this framing is valid for
 *  3–6 months while EveryPay Option 1 (collecting-account through Maksekeskus)
 *  is scoped. Enforced by a Vitest assertion co-located in `constants.test.ts`
 *  — when the date passes, `pnpm test` fails and CI blocks every subsequent PR
 *  until the transitional wording is replaced. */
export const PSD2_TRANSITIONAL_SUNSET = new Date('2026-10-26T00:00:00.000Z');

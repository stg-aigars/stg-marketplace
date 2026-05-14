/** Governs the Terms of Service (/terms) and Accessibility Statement
 *  (/accessibility). Also stamped on the user row at terms acceptance and
 *  recorded on the audit-log resourceId. Update when either of those pages
 *  changes materially. (Cookies were decoupled into COOKIES_VERSION; the
 *  /accessibility decoupling remains a follow-up.) */
export const TERMS_VERSION = '2026-05-13';
export const TERMS_VERSION_DISPLAY = '13 May 2026';

/** Governs the Privacy Policy (/privacy). Update when Privacy content changes
 *  — processor list, legal bases, retention periods, data-subject rights. */
export const PRIVACY_VERSION = '2026-05-13';
export const PRIVACY_VERSION_DISPLAY = '13 May 2026';

/** Governs the Cookie Policy (/cookies). Decoupled from TERMS_VERSION as of
 *  2026-05-13. Bump independently when the Cookie Policy content changes —
 *  new cookies set, new third-party tools, new disclosures. There is no
 *  acceptance flow for the Cookie Policy (it's a notice under e-Privacy
 *  Directive Art. 5(3), not a bilateral contract), so this constant is not
 *  stamped on user rows or audit-log resourceIds. */
export const COOKIES_VERSION = '2026-05-13';
export const COOKIES_VERSION_DISPLAY = '13 May 2026';

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
 * Legal documents that ship with translations.
 * The doc id matches both the URL slug (`/terms`, `/seller-terms`, `/privacy`,
 * `/cookies`) and the directory name under `app/[locale]/`.
 */
export type LegalDocId = 'terms' | 'seller-terms' | 'privacy' | 'cookies';

/**
 * Four languages each legal document is published in.
 * English is canonical; LV/LT/ET are translations provided for convenience
 * (the English version controls in case of conflict per §17/§10/§14).
 */
export type LegalDocLang = 'en' | 'lv' | 'lt' | 'et';

/**
 * Languages other than English. Consumed by `[lang]/page.tsx`'s
 * `generateStaticParams` to prerender the three translated routes per
 * legal doc; unknown lang values fall through to `notFound()`.
 */
export const TRANSLATED_LANGS: ReadonlyArray<Exclude<LegalDocLang, 'en'>> = ['lv', 'lt', 'et'] as const;

/**
 * Native-language labels for the language switcher pills.
 * Order applied across all three legal documents for consistency.
 */
export const LEGAL_LANG_LABELS: Record<LegalDocLang, string> = {
  en: 'English',
  lv: 'Latviešu',
  lt: 'Lietuvių',
  et: 'Eesti',
};

/**
 * Per-doc-per-lang browser-tab `<title>` values rendered into each route's
 * `generateMetadata`. Single source of truth — both the EN canonical pages
 * (`{doc}/page.tsx`) and the translated pages (`{doc}/[lang]/page.tsx`)
 * pull from here, so the EN title cannot drift between the canonical site
 * and the translated routes' fallback.
 */
export const LEGAL_DOC_TITLES: Record<LegalDocId, Record<LegalDocLang, string>> = {
  terms: {
    en: 'Terms of Service',
    lv: 'Lietošanas noteikumi',
    lt: 'Paslaugų teikimo sąlygos',
    et: 'Kasutustingimused',
  },
  'seller-terms': {
    en: 'Seller Agreement',
    lv: 'Pārdevēja līgums',
    lt: 'Pardavėjo sutartis',
    et: 'Müügileping',
  },
  privacy: {
    en: 'Privacy Policy',
    lv: 'Privātuma politika',
    lt: 'Privatumo politika',
    et: 'Privaatsuspoliitika',
  },
  cookies: {
    en: 'Cookie Policy',
    lv: 'Sīkrīku politika',
    lt: 'Slapukų politika',
    et: 'Küpsiste eeskirjad',
  },
};

/**
 * Disclaimer banner messages shown on translated legal-doc pages
 * (lv / lt / et only — the EN canonical pages do not render a banner).
 *
 * Keyed by both doc and language because Terms/Seller use "legally
 * binding" framing while Privacy uses "authoritative" framing,
 * mirroring the §17 / §10 / §14 clause bodies inside each document.
 *
 * The substring `LEGAL_DISCLAIMER_CLAUSE_BRIDGE[doc][lang]` (below)
 * must appear in both this message AND the corresponding clause body
 * in `_content/{lang}.tsx`. The regression test in
 * language-clause.test.ts enforces this property — drift between the
 * banner and the clause is a test failure, not a production bug.
 */
export const LEGAL_DISCLAIMER_MESSAGES: Record<
  LegalDocId,
  Record<Exclude<LegalDocLang, 'en'>, string>
> = {
  terms: {
    lv: 'Šis tulkojums ir sniegts tavām ērtībām. Angļu valodas versija ir juridiski saistošā oriģinālversija.',
    lt: 'Šis vertimas pateiktas Jūsų patogumui. Anglų kalbos versija yra teisiškai įpareigojanti pirminė versija.',
    et: 'Käesolev tõlge on Teile mugavuse huvides. Ingliskeelne versioon on õiguslikult siduv originaal.',
  },
  'seller-terms': {
    lv: 'Šis tulkojums ir sniegts tavām ērtībām. Angļu valodas versija ir juridiski saistošā oriģinālversija.',
    lt: 'Šis vertimas pateiktas Jūsų patogumui. Anglų kalbos versija yra teisiškai įpareigojanti pirminė versija.',
    et: 'Käesolev tõlge on Teile mugavuse huvides. Ingliskeelne versioon on õiguslikult siduv originaal.',
  },
  privacy: {
    lv: 'Šis tulkojums ir sniegts tavām ērtībām. Angļu valodas versija ir autoritatīvā oriģinālversija.',
    lt: 'Šis vertimas pateiktas Jūsų patogumui. Anglų kalbos versija yra autoritetinga pirminė versija.',
    et: 'Käesolev tõlge on Teile mugavuse huvides. Ingliskeelne versioon on autoriteetne originaal.',
  },
  cookies: {
    lv: 'Šis tulkojums ir sniegts tavām ērtībām. Angļu valodas versija ir autoritatīvā oriģinālversija.',
    lt: 'Šis vertimas pateiktas Jūsų patogumui. Anglų kalbos versija yra autoritetinga pirminė versija.',
    et: 'Käesolev tõlge on Teile mugavuse huvides. Ingliskeelne versioon on autoriteetne originaal.',
  },
};

/**
 * The "binding/authoritative" framing substring that MUST appear in
 * both the disclaimer banner message AND the §17 / §10 / §14 clause
 * body for each (doc, lang) combination. Used by
 * language-clause.test.ts to catch drift between banner and clause.
 */
export const LEGAL_DISCLAIMER_CLAUSE_BRIDGE: Record<
  LegalDocId,
  Record<Exclude<LegalDocLang, 'en'>, string>
> = {
  terms: {
    lv: 'juridiski saistošā oriģinālversija',
    lt: 'teisiškai įpareigojanti pirminė versija',
    et: 'õiguslikult siduv originaal',
  },
  'seller-terms': {
    lv: 'juridiski saistošā oriģinālversija',
    lt: 'teisiškai įpareigojanti pirminė versija',
    et: 'õiguslikult siduv originaal',
  },
  privacy: {
    lv: 'autoritatīvā oriģinālversija',
    lt: 'autoritetinga pirminė versija',
    et: 'autoriteetne originaal',
  },
  cookies: {
    lv: 'autoritatīvā oriģinālversija',
    lt: 'autoritetinga pirminė versija',
    et: 'autoriteetne originaal',
  },
};

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

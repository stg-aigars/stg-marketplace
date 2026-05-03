/** Legal entity name — used in checkout, invoices, and legal pages */
export const LEGAL_ENTITY_NAME = 'Second Turn Games SIA';

/** Registered business address — displayed at checkout per Swedbank requirements, in email footers, and on legal pages */
export const LEGAL_ENTITY_ADDRESS = 'Evalda Valtera 5-35, Riga, LV-1021, Latvia';

/** Company registration number */
export const LEGAL_ENTITY_REG_NUMBER = '50203665371';

/** VAT registration number */
export const LEGAL_ENTITY_VAT_NUMBER = 'LV50203665371';

/** Contact phone number — displayed in email footers and on legal pages */
export const LEGAL_ENTITY_PHONE = '+371 26779625';

/** General contact email — imprint, email footers, legal pages */
export const LEGAL_ENTITY_EMAIL = 'info@secondturn.games';

/** Public-facing website — displayed in email footers */
export const LEGAL_ENTITY_WEBSITE = 'secondturn.games';

/** Bank name for invoice/document footer. Also the marketplace payment service provider
 *  named in /terms §1, /seller-terms §2, /privacy §6, ROPA, and dependencies.md. */
export const LEGAL_ENTITY_BANK_NAME = 'Swedbank AS';

/** Swedbank AS Latvia registration number — disclosed in /privacy §6 row 1, ROPA, and
 *  dependencies.md alongside `LEGAL_ENTITY_BANK_NAME`. */
export const LEGAL_ENTITY_BANK_REG_NUMBER = '40003074764';

/** IBAN for invoice/document footer */
export const LEGAL_ENTITY_IBAN = 'LV89HABA0551062053777';

/** Technical Provider engaged by Swedbank under §1 + §2.8 of the Swedbank E-commerce
 *  Payments Platform T&Cs. Disclosed in /privacy §6 row 2, /terms §1, /seller-terms §2,
 *  ROPA, dpa-verification-runbook, and CLAUDE.md line 99. Same legal entity formerly
 *  named Maksekeskus AS — rebrand only, same Estonian reg number. */
export const PSP_TECHNICAL_PROVIDER_NAME = 'EveryPay AS';
export const PSP_TECHNICAL_PROVIDER_REG_NUMBER = '12280690';

/** EveryPay locale codes by buyer country — determines which banks show first on the payment page */
export const COUNTRY_TO_EVERYPAY_LOCALE: Record<string, string> = {
  LV: 'lv',
  LT: 'lt',
  EE: 'et',
};

export const IS_PRELAUNCH = true;

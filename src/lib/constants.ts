/** Legal entity name — used in checkout, invoices, and legal pages */
export const LEGAL_ENTITY_NAME = 'Second Turn Games SIA';

/** Registered business address — displayed at checkout per EveryPay requirements, in email footers, and on legal pages */
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

/** Bank name for invoice/document footer */
export const LEGAL_ENTITY_BANK_NAME = 'Swedbank AS';

/** IBAN for invoice/document footer */
export const LEGAL_ENTITY_IBAN = 'LV89HABA0551062053777';

/** EveryPay locale codes by buyer country — determines which banks show first on the payment page */
export const COUNTRY_TO_EVERYPAY_LOCALE: Record<string, string> = {
  LV: 'lv',
  LT: 'lt',
  EE: 'et',
};

export const IS_PRELAUNCH = true;

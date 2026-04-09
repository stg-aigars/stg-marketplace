/**
 * DAC7 field validation — format checks only, not tax authority verification.
 */

/**
 * Validate Baltic TIN (Tax Identification Number / personal code) format.
 * LV/LT/EE personal codes are all 11 digits.
 * Other EU countries fall through to a generic length check.
 */
export function isValidBalticTIN(tin: string, country: string): boolean {
  const cleaned = tin.replace(/[\s-]/g, '');
  switch (country) {
    case 'LV':
    case 'LT':
    case 'EE':
      return /^\d{11}$/.test(cleaned);
    default:
      // Generic fallback for other EU countries
      return cleaned.length >= 5 && cleaned.length <= 20;
  }
}

/** Clean TIN for storage — strip whitespace and dashes */
export function cleanTIN(tin: string): string {
  return tin.replace(/[\s-]/g, '');
}

/**
 * Validate IBAN format.
 * Baltic IBANs: LV (21 chars), LT (20 chars), EE (20 chars).
 * Accepts any country code with basic structure check.
 */
export function isValidIBAN(iban: string): boolean {
  const cleaned = iban.replace(/\s/g, '').toUpperCase();
  // 2 letter country + 2 check digits + 4-30 alphanumeric BBAN
  return /^[A-Z]{2}\d{2}[A-Z0-9]{4,30}$/.test(cleaned);
}

/** Clean IBAN for storage — strip whitespace, uppercase */
export function cleanIBAN(iban: string): string {
  return iban.replace(/\s/g, '').toUpperCase();
}

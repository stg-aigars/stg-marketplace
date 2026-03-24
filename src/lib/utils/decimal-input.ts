/** Normalize European comma decimal separator to period, strip non-numeric chars. */
export function normalizeDecimalInput(value: string): string {
  // Accept comma as decimal separator (Baltic/European locales)
  let cleaned = value.replace(',', '.').replace(/[^0-9.]/g, '');

  const parts = cleaned.split('.');
  // Allow only one decimal point
  if (parts.length > 2) {
    cleaned = parts[0] + '.' + parts.slice(1).join('');
  }
  // Max 2 decimal places
  if (parts.length === 2 && parts[1].length > 2) {
    cleaned = parts[0] + '.' + parts[1].slice(0, 2);
  }

  return cleaned;
}

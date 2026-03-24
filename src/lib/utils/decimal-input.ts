/** Normalize European comma decimal separator to period, strip non-numeric chars. */
export function normalizeDecimalInput(value: string): string {
  const cleaned = value.replace(/,/g, '.').replace(/[^0-9.]/g, '');

  const [integer, ...rest] = cleaned.split('.');
  if (rest.length === 0) return cleaned;

  const decimals = rest.join('').slice(0, 2);
  const intPart = integer || '0';
  return `${intPart}.${decimals}`;
}

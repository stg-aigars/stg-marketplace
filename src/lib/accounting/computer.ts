/**
 * Posting engine compute helpers (PR #2).
 *
 * Pure functions used by per-type compute() in mapping.ts:
 *
 *   roundHalfUpCents — half-up cent rounding. Plain Math.round rounds
 *                      half-to-positive, which differs from accounting
 *                      half-up convention for negative values.
 *
 *   decomposeFx       — §F worked example. usd_amount + fx_rate +
 *                       bank_amount_eur → service_value_eur_cents +
 *                       fx_fee_eur_cents. Used by I.4 (non-EU vendor B2B
 *                       reverse-charge with FX).
 *
 *   lookupVatRate    — reads vat_rates(country, valid_from, valid_to) and
 *                      returns the rate snapshot for posting_date. Throws
 *                      PostingValidationError if no rate covers the date.
 *
 *   requireNumber    — coerces an unknown payload value to a positive integer
 *                      cents bigint-safe number; throws PostingValidationError
 *                      on missing/negative/non-finite.
 *
 * Discipline (per PR #2 plan §"Conventions locked"):
 *   - All intermediate values stay in integer cents.
 *   - The ONLY multiply-then-round operation is `vat_base_cents × vat_rate
 *     → vat_amount_cents`. Compound multiplications never appear.
 *   - decomposeFx divides cents by a decimal rate; result is rounded once.
 *     The FX fee is then `bank_amount_cents - service_value_cents` (subtraction
 *     preserves cents exactness).
 *   - buildOrderRevenueLines (mapping.ts) does the inclusive-VAT decomposition
 *     `gross_cents / (1 + rate) → net_cents`, rounded once via roundHalfUpCents.
 *     `vat_cents = gross_cents - net_cents` (subtraction preserves exactness),
 *     same shape as decomposeFx's fee derivation.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import { PostingValidationError } from './errors';

/**
 * Round to integer cents using accounting half-up convention (round toward +∞).
 *
 *   roundHalfUpCents(0.5)    === 1
 *   roundHalfUpCents(1.5)    === 2
 *   roundHalfUpCents(2.5)    === 3
 *   roundHalfUpCents(-0.5)   === 0   (toward +∞)
 *   roundHalfUpCents(-1.5)   === -1  (toward +∞)
 *   roundHalfUpCents(361.83) === 362
 *
 * JavaScript's Math.round is exactly "half-up toward +∞", which matches the
 * convention for VAT credit notes (so a refund of €1.50 in commission VAT
 * lands at €1, not €2 — symmetric with the original posting). For VAT
 * compute, the half boundary is functionally unreachable (rate × integer
 * cents almost never lands exactly on .5), but we lock the convention in
 * tests anyway.
 *
 * Throws PostingValidationError on non-finite input (NaN, ±Infinity) so
 * upstream bugs don't silently produce 0.
 */
export function roundHalfUpCents(value: number): number {
  if (!Number.isFinite(value)) {
    throw new PostingValidationError({
      code: 'invalid_payload_value',
      reason: `roundHalfUpCents received non-finite value: ${value}`
    });
  }
  const result = Math.round(value);
  // Math.round(-0.5) returns -0 (negative zero). Normalize to +0 so caller
  // equality checks (Object.is, ===-strict, JSON.stringify) all see a clean 0.
  return result === 0 ? 0 : result;
}

/**
 * Inclusive VAT decomposition: gross_cents = net_cents + vat_cents, where
 * the gross amount carries VAT inside it (e.g. STG seller invoice's commission
 * and shipping lines per Seller Terms §8). Mirrors the shape of decomposeFx —
 * one divide-then-round + one subtraction so cents stay exact.
 *
 *   net_cents = round_half_up(gross_cents / (1 + vat_rate))
 *   vat_cents = gross_cents - net_cents
 *
 * `vat_rate = 0` collapses to net = gross, vat = 0 (B2B reverse-charge case
 * where the helper still gets called but the VAT line is omitted upstream).
 *
 * `services/pricing.ts:calculateVatSplit` does the same arithmetic for the
 * orders-row decomposition seen by buyers/sellers; the two stay in sync as
 * long as both use this rounding rule.
 */
export function splitInclusiveVat(
  gross_cents: number,
  vat_rate: number
): { net_cents: number; vat_cents: number } {
  const net_cents = roundHalfUpCents(gross_cents / (1 + vat_rate));
  return { net_cents, vat_cents: gross_cents - net_cents };
}

/**
 * §F FX decomposition for I.4 non-EU vendor invoices billed in foreign
 * currency and auto-converted by the bank.
 *
 * Inputs (all in display units, not cents — caller passes raw payload values):
 *   - foreign_amount: e.g. 20.00 USD
 *   - fx_rate:        e.g. 1.160766 (units of foreign currency per EUR)
 *   - bank_amount_eur: e.g. 17.74 EUR (final EUR billed by bank, includes FX fee)
 *
 * Outputs (integer cents):
 *   - service_value_eur_cents = round_half_up(foreign_amount × 100 / fx_rate)
 *   - fx_fee_eur_cents        = bank_amount_eur × 100 − service_value_eur_cents
 *
 * §F.3 Cursor September verbatim:
 *   foreign_amount=20.00, fx_rate=1.160766, bank_amount_eur=17.74
 *   → service_value_eur_cents=1723 (€17.23)
 *   → fx_fee_eur_cents=51 (€0.51)
 */
export function decomposeFx(input: {
  foreign_amount: number;
  fx_rate: number;
  bank_amount_eur: number;
}): { service_value_eur_cents: number; fx_fee_eur_cents: number } {
  if (input.fx_rate <= 0) {
    throw new PostingValidationError({
      code: 'invalid_payload_value',
      reason: `fx_rate must be positive, got ${input.fx_rate}`
    });
  }
  if (input.foreign_amount <= 0) {
    throw new PostingValidationError({
      code: 'invalid_payload_value',
      reason: `foreign_amount must be positive, got ${input.foreign_amount}`
    });
  }
  if (input.bank_amount_eur <= 0) {
    throw new PostingValidationError({
      code: 'invalid_payload_value',
      reason: `bank_amount_eur must be positive, got ${input.bank_amount_eur}`
    });
  }
  // Decimal divide → cents conversion → half-up round at the boundary
  const service_value_eur_cents = roundHalfUpCents(
    (input.foreign_amount * 100) / input.fx_rate
  );
  const bank_amount_eur_cents = roundHalfUpCents(input.bank_amount_eur * 100);
  const fx_fee_eur_cents = bank_amount_eur_cents - service_value_eur_cents;
  // Guard: a negative FX fee means the caller's inputs are inconsistent
  // (bank charged less than the implied conversion-only EUR — would only happen
  // with a wrong fx_rate, wrong bank_amount, or a refund/reversal mis-routed
  // through I.4). Without this guard, the negative cents lands in `debit_cents`
  // for account 7710 and trips the `journal_lines.debit_cents >= 0` CHECK with
  // a generic SQL error rather than a typed validation failure.
  if (fx_fee_eur_cents < 0) {
    throw new PostingValidationError({
      code: 'invalid_payload_value',
      reason: `FX decomposition produced negative fx_fee_eur_cents=${fx_fee_eur_cents} (bank_amount=${input.bank_amount_eur} < implied service_value=${service_value_eur_cents / 100}). Check fx_rate and bank_amount inputs.`,
      context: {
        foreign_amount: input.foreign_amount,
        fx_rate: input.fx_rate,
        bank_amount_eur: input.bank_amount_eur,
        service_value_eur_cents,
        fx_fee_eur_cents
      }
    });
  }
  return { service_value_eur_cents, fx_fee_eur_cents };
}

/**
 * Look up the VAT rate for (country, posting_date). Returns the snapshot to
 * write into journal_lines.vat_rate_snapshot. Throws if no rate covers the
 * date.
 *
 * vat_rates schema: (country, rate, valid_from, valid_to NULL=current).
 * Returns the rate where posting_date is in [valid_from, valid_to].
 */
export async function lookupVatRate(
  supabase: SupabaseClient,
  country: 'LV' | 'LT' | 'EE',
  posting_date: string
): Promise<number> {
  const { data, error } = await supabase
    .from('vat_rates')
    .select('rate, valid_from, valid_to')
    .eq('country', country)
    .lte('valid_from', posting_date)
    .or(`valid_to.is.null,valid_to.gte.${posting_date}`)
    .order('valid_from', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new PostingValidationError({
      code: 'vat_rate_not_found',
      reason: `vat_rates lookup failed for ${country}@${posting_date}: ${error.message}`,
      context: { country, posting_date }
    });
  }
  if (!data) {
    throw new PostingValidationError({
      code: 'vat_rate_not_found',
      reason: `No VAT rate found for ${country} effective ${posting_date}`,
      context: { country, posting_date }
    });
  }
  return Number(data.rate) / 100; // vat_rates.rate is stored as percent (21.00); engine works in 0.21
}

/**
 * Coerce an unknown payload value to a number, with descriptive error for
 * missing/wrong-type/non-finite/negative cases. Used inside per-type
 * compute() to validate caller-supplied economics before arithmetic.
 *
 *   { allowZero: true } — admits 0 (e.g., bank fees can be 0 in tests)
 *   { allowNegative: true } — admits negative (rare; e.g., refund amounts)
 */
export function requireNumber(
  payload: Record<string, unknown>,
  key: string,
  opts: { allowZero?: boolean; allowNegative?: boolean } = {}
): number {
  const raw = payload[key];
  if (raw === undefined || raw === null) {
    throw new PostingValidationError({
      code: 'missing_required_key',
      reason: `payload missing required numeric key: ${key}`
    });
  }
  const num = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(num)) {
    throw new PostingValidationError({
      code: 'invalid_payload_value',
      reason: `payload.${key} is not a finite number: ${String(raw)}`
    });
  }
  if (!opts.allowNegative && num < 0) {
    throw new PostingValidationError({
      code: 'invalid_payload_value',
      reason: `payload.${key} must be non-negative, got ${num}`
    });
  }
  if (!opts.allowZero && num === 0) {
    throw new PostingValidationError({
      code: 'invalid_payload_value',
      reason: `payload.${key} must be positive, got 0`
    });
  }
  return num;
}

/**
 * String getter with descriptive error.
 */
export function requireString(
  payload: Record<string, unknown>,
  key: string
): string {
  const raw = payload[key];
  if (raw === undefined || raw === null || raw === '') {
    throw new PostingValidationError({
      code: 'missing_required_key',
      reason: `payload missing required string key: ${key}`
    });
  }
  if (typeof raw !== 'string') {
    throw new PostingValidationError({
      code: 'invalid_payload_value',
      reason: `payload.${key} must be string, got ${typeof raw}`
    });
  }
  return raw;
}

/**
 * Assert that the lines balance (Σdebit = Σcredit). Engine calls this after
 * compute() to fail fast with a clean error before the RPC's deferred trigger
 * would fire. Mirrors the trigger's invariant.
 */
export function assertBalanced(lines: ReadonlyArray<{ debit_cents: number; credit_cents: number }>): void {
  let total_dr = 0;
  let total_cr = 0;
  for (const line of lines) {
    total_dr += line.debit_cents;
    total_cr += line.credit_cents;
  }
  if (total_dr !== total_cr) {
    throw new PostingValidationError({
      code: 'unbalanced_lines',
      reason: `Lines unbalanced: Σdr=${total_dr}, Σcr=${total_cr}`,
      context: { total_dr, total_cr }
    });
  }
}

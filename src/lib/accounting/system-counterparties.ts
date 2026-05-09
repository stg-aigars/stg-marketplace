/**
 * Pinned UUIDs for system counterparties seeded by migration 096.
 *
 * The posting engine (PR #2) and Phase 0 backfill (PR #3) reference these
 * counterparties by importing this constant rather than re-querying. Do NOT
 * change these values — the GL is FK-bound to them via journal_lines.counterparty_id
 * and changing a UUID here would orphan existing references.
 *
 * VID = Valsts ieņēmumu dienests (Latvian State Revenue Service).
 *   - tin = '90000010008' (VID reģistrācijas numurs visible on every
 *     state-budget transfer reference)
 *   - Used as the counterparty on VID VAT refund/payment journal entries
 *     (e.g. Phase 0 Entry 17: VID refund of January 2026 input VAT €13.05)
 *   - Bank-statement reconciliation queries match VID inflows/outflows by
 *     this TIN.
 *
 * STG_INTERNAL = Second Turn Games SIA (the platform itself).
 *   - vat_number = 'LV50203665371' (canonical source: LEGAL_ENTITY_VAT_NUMBER
 *     in src/lib/constants.ts; duplicated here in the seed because SQL
 *     migrations cannot import TypeScript)
 *   - Used for period-close consolidations, year-end P&L close, monthly
 *     depreciation entries — i.e. journal entries that have no external
 *     counterparty.
 */
export const SYSTEM_COUNTERPARTY = {
  VID: '00000000-0000-0000-0000-000000000001',
  STG_INTERNAL: '00000000-0000-0000-0000-000000000002',
} as const;

export type SystemCounterpartyKey = keyof typeof SYSTEM_COUNTERPARTY;

/**
 * Pure helpers for the EveryPay settlement staff UI (PR C commit 11a).
 *
 * Split out from the server-action module so the parsing logic is
 * unit-testable without invoking `'use server'` machinery. Per the
 * `feedback_use_server_file_constraints.md` convention: server-action files
 * constrain exports to async server actions; pure helpers live in a sibling
 * non-directive module.
 */

/**
 * Parse a free-form "included transaction references" input from the staff
 * settlement form. Designed for the "messy paste" reality: staff copy-paste
 * references from a Swedbank statement or EveryPay export, where separators
 * vary (commas, newlines, tabs, mixed whitespace), individual refs may have
 * surrounding whitespace, and duplicates can sneak in from sloppy selection.
 *
 * Behaviour:
 *   - Split on any run of commas, newlines, tabs, or whitespace
 *   - Trim each resulting fragment
 *   - Drop empty fragments
 *   - Dedupe (preserving first-occurrence order — useful for staff who
 *     intentionally ordered refs chronologically in their paste)
 *
 * Empty input (empty string, whitespace-only, only commas) → empty array.
 * Empty array is acceptable to the server action — captured in
 * `included_txn_refs` of the C.3 payload as an empty list; staff can still
 * record a settlement before reconciling individual refs.
 */
export function parseIncludedTxnRefs(raw: string | null | undefined): string[] {
  if (!raw || typeof raw !== 'string') return [];
  // Split on commas, newlines, tabs, or any whitespace run. The character
  // class is intentionally inclusive — bank statement copy-paste produces
  // varied separators across OSes and PDF renderers.
  const fragments = raw.split(/[,\s\t\r\n]+/);
  const seen = new Set<string>();
  const result: string[] = [];
  for (const f of fragments) {
    const trimmed = f.trim();
    if (trimmed.length === 0) continue;
    if (seen.has(trimmed)) continue;
    seen.add(trimmed);
    result.push(trimmed);
  }
  return result;
}

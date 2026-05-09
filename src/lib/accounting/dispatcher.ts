/**
 * Dispatcher — pure function (PR #2).
 *
 * Routes a DispatchContext to a VatMappingEntry from MAPPING_TABLE using
 * first-match-wins evaluation against routing.event_type and
 * routing.conditions.
 *
 * Routing condition evaluation:
 *
 *   key             — dot path into the dispatch context. Supported prefixes:
 *                       'counterparty.<field>' → DispatchContext.counterparty?.[field]
 *                       'payload.<field>'      → DispatchContext.payload[field]
 *
 *   value match:
 *     - literal string/number/boolean → strict equality
 *     - readonly array                → IN (any element matches)
 *     - '!null'                       → field must be non-null and non-undefined
 *
 * The dispatcher does NOT load the counterparty — engine.ts handles that
 * before calling dispatch(). The dispatcher is pure: same input → same
 * output, no I/O.
 *
 * Throws PostingValidationError with code 'no_matching_type' when no entry
 * matches.
 */

import { PostingValidationError } from './errors';
import { MAPPING_TABLE } from './mapping';
import type { DispatchContext, RoutingCriteria, VatMappingEntry } from './types';

export function dispatch(ctx: DispatchContext): VatMappingEntry {
  for (const entry of MAPPING_TABLE) {
    if (matchesRouting(ctx, entry.routing)) {
      return entry;
    }
  }
  throw new PostingValidationError({
    code: 'no_matching_type',
    reason: `No VatMappingEntry matches event_type='${ctx.event_type}'`,
    context: {
      event_type: ctx.event_type,
      counterparty_country: ctx.counterparty?.country,
      counterparty_tax_status: ctx.counterparty?.tax_status,
      payload_keys: Object.keys(ctx.payload)
    }
  });
}

/**
 * Exposed for the mutual-exclusivity test in dispatcher.test.ts. Returns
 * true iff the context matches the entry's routing.
 */
export function matchesRouting(ctx: DispatchContext, routing: RoutingCriteria): boolean {
  if (ctx.event_type !== routing.event_type) return false;
  for (const [key, expected] of Object.entries(routing.conditions)) {
    const actual = readPath(ctx, key);
    if (!matchValue(actual, expected)) return false;
  }
  return true;
}

function readPath(ctx: DispatchContext, key: string): unknown {
  const [root, ...rest] = key.split('.');
  if (rest.length === 0) return undefined; // bare keys not supported
  const fieldPath = rest.join('.');
  if (root === 'counterparty') {
    if (!ctx.counterparty) return undefined;
    return readObjectPath(ctx.counterparty as unknown as Record<string, unknown>, fieldPath);
  }
  if (root === 'payload') {
    return readObjectPath(ctx.payload, fieldPath);
  }
  return undefined;
}

function readObjectPath(obj: Record<string, unknown>, path: string): unknown {
  // PR #2 doesn't need deep paths; flat field lookup is sufficient. Extend
  // here when a future type needs e.g. payload.metadata.foo.
  return obj[path];
}

function matchValue(actual: unknown, expected: unknown): boolean {
  if (expected === '!null') {
    return actual !== null && actual !== undefined;
  }
  if (Array.isArray(expected)) {
    return expected.includes(actual as never);
  }
  return actual === expected;
}

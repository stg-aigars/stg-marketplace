import { describe, it, expect } from 'vitest';
import { dbExecOrThrow } from '../helpers/db-exec';
import { SOFT_CLOSE_WINDOW_HOURS } from '@/lib/auctions/types';

describe('place_bid RPC soft-close window', () => {
  it('extends auction_end_at by SOFT_CLOSE_WINDOW_HOURS (TS↔SQL drift guard)', () => {
    // Introspect the place_bid function definition. pg_get_functiondef returns
    // the full CREATE OR REPLACE FUNCTION text for a given function OID.
    const result = dbExecOrThrow(
      "SELECT pg_get_functiondef('public.place_bid(uuid, uuid, integer)'::regprocedure) AS def;"
    );

    const body = result.stdout;
    expect(body, 'pg_get_functiondef returned empty output').toBeTruthy();

    // Match the soft-close interval literal in the function body.
    // Tolerates whitespace variation; matches singular/plural 'hour'/'hours'.
    const match = body.match(/INTERVAL\s+'(\d+)\s+hours?'/i);
    expect(
      match,
      `place_bid body did not contain an INTERVAL 'N hours' literal. ` +
        `Body length: ${body.length}. First 500 chars: ${body.slice(0, 500)}`
    ).not.toBeNull();

    expect(Number(match![1])).toBe(SOFT_CLOSE_WINDOW_HOURS);
  });
});

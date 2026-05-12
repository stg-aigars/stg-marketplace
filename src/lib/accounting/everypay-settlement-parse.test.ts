/**
 * Unit tests for parseIncludedTxnRefs — the messy-paste handler.
 *
 * Covers the realistic Swedbank statement / EveryPay export paste scenarios:
 * mixed separators, surrounding whitespace, duplicates, empty fragments.
 */

import { describe, it, expect } from 'vitest';

import { parseIncludedTxnRefs } from './everypay-settlement-parse';

describe('parseIncludedTxnRefs', () => {
  it('returns empty array for null / undefined / empty / whitespace-only', () => {
    expect(parseIncludedTxnRefs(null)).toEqual([]);
    expect(parseIncludedTxnRefs(undefined)).toEqual([]);
    expect(parseIncludedTxnRefs('')).toEqual([]);
    expect(parseIncludedTxnRefs('   ')).toEqual([]);
    expect(parseIncludedTxnRefs('\n\t  \n')).toEqual([]);
    expect(parseIncludedTxnRefs(',, , ,')).toEqual([]);
  });

  it('handles a single ref with surrounding whitespace', () => {
    expect(parseIncludedTxnRefs('  ep-ref-123  ')).toEqual(['ep-ref-123']);
  });

  it('splits comma-separated refs (canonical form)', () => {
    expect(parseIncludedTxnRefs('ep-1,ep-2,ep-3')).toEqual(['ep-1', 'ep-2', 'ep-3']);
  });

  it('splits comma-separated refs with whitespace padding (typical paste)', () => {
    expect(parseIncludedTxnRefs('ep-1, ep-2,  ep-3')).toEqual(['ep-1', 'ep-2', 'ep-3']);
  });

  it('splits newline-separated refs (multi-line paste from a PDF or table)', () => {
    expect(parseIncludedTxnRefs('ep-1\nep-2\nep-3')).toEqual(['ep-1', 'ep-2', 'ep-3']);
  });

  it('handles mixed comma + newline + whitespace separators', () => {
    const messy = 'ep-1, ep-2\n  ep-3\tep-4 ,, ep-5';
    expect(parseIncludedTxnRefs(messy)).toEqual(['ep-1', 'ep-2', 'ep-3', 'ep-4', 'ep-5']);
  });

  it('dedupes duplicate refs preserving first-occurrence order', () => {
    expect(parseIncludedTxnRefs('ep-1,ep-2,ep-1,ep-3,ep-2')).toEqual(['ep-1', 'ep-2', 'ep-3']);
  });

  it('preserves case sensitivity (refs are user-defined opaque strings)', () => {
    expect(parseIncludedTxnRefs('EP-1, ep-1')).toEqual(['EP-1', 'ep-1']);
  });

  it('handles CRLF line endings (Windows clipboards)', () => {
    expect(parseIncludedTxnRefs('ep-1\r\nep-2\r\nep-3')).toEqual(['ep-1', 'ep-2', 'ep-3']);
  });

  it('handles tab-separated refs (TSV paste from spreadsheet)', () => {
    expect(parseIncludedTxnRefs('ep-1\tep-2\tep-3')).toEqual(['ep-1', 'ep-2', 'ep-3']);
  });

  it('handles realistic messy paste with leading / trailing noise + duplicates', () => {
    const realistic = '\n\n  ep-2026-04-15-001,\n  ep-2026-04-15-002\n  ep-2026-04-15-001,\nep-2026-04-15-003   \n';
    expect(parseIncludedTxnRefs(realistic)).toEqual([
      'ep-2026-04-15-001',
      'ep-2026-04-15-002',
      'ep-2026-04-15-003',
    ]);
  });
});

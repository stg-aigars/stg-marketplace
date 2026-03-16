import { describe, it, expect } from 'vitest';
import { SUCCESSFUL_STATES, FAILED_STATES, PENDING_STATES } from './types';
import type { EveryPayPaymentState } from './types';

describe('EveryPay payment state sets', () => {
  const allClassified = new Set([
    ...SUCCESSFUL_STATES,
    ...FAILED_STATES,
    ...PENDING_STATES,
  ]);

  // Terminal states are intentionally not in any set — they occur
  // after initial settlement (refunded, chargebacked)
  const terminalStates: EveryPayPaymentState[] = ['refunded', 'chargebacked'];

  it('sets are disjoint (no state in multiple sets)', () => {
    for (const state of SUCCESSFUL_STATES) {
      expect(FAILED_STATES.has(state)).toBe(false);
      expect(PENDING_STATES.has(state)).toBe(false);
    }
    for (const state of FAILED_STATES) {
      expect(PENDING_STATES.has(state)).toBe(false);
    }
  });

  it('SUCCESSFUL_STATES contains authorised and settled', () => {
    expect(SUCCESSFUL_STATES.has('authorised')).toBe(true);
    expect(SUCCESSFUL_STATES.has('settled')).toBe(true);
    expect(SUCCESSFUL_STATES.size).toBe(2);
  });

  it('FAILED_STATES contains failed, abandoned, voided', () => {
    expect(FAILED_STATES.has('failed')).toBe(true);
    expect(FAILED_STATES.has('abandoned')).toBe(true);
    expect(FAILED_STATES.has('voided')).toBe(true);
    expect(FAILED_STATES.size).toBe(3);
  });

  it('PENDING_STATES contains all in-progress states', () => {
    expect(PENDING_STATES.has('initial')).toBe(true);
    expect(PENDING_STATES.has('sent_for_processing')).toBe(true);
    expect(PENDING_STATES.has('waiting_for_3ds_response')).toBe(true);
    expect(PENDING_STATES.has('waiting_for_sca')).toBe(true);
    expect(PENDING_STATES.has('confirmed_3ds')).toBe(true);
    expect(PENDING_STATES.size).toBe(5);
  });

  it('terminal states (refunded, chargebacked) are not in any set', () => {
    for (const state of terminalStates) {
      expect(allClassified.has(state)).toBe(false);
    }
  });

  it('all non-terminal EveryPayPaymentState values are classified', () => {
    const allStates: EveryPayPaymentState[] = [
      'initial', 'authorised', 'settled', 'failed',
      'sent_for_processing', 'waiting_for_3ds_response',
      'waiting_for_sca', 'confirmed_3ds', 'abandoned',
      'voided', 'refunded', 'chargebacked',
    ];
    for (const state of allStates) {
      const isTerminal = terminalStates.includes(state);
      const isClassified = allClassified.has(state);
      expect(isTerminal || isClassified).toBe(true);
    }
  });
});

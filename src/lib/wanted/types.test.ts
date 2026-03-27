import { describe, it, expect } from 'vitest';
import { meetsConditionThreshold, CONDITION_RANK } from './types';

describe('CONDITION_RANK', () => {
  it('ranks conditions from worst to best', () => {
    expect(CONDITION_RANK.for_parts).toBeLessThan(CONDITION_RANK.acceptable);
    expect(CONDITION_RANK.acceptable).toBeLessThan(CONDITION_RANK.good);
    expect(CONDITION_RANK.good).toBeLessThan(CONDITION_RANK.very_good);
    expect(CONDITION_RANK.very_good).toBeLessThan(CONDITION_RANK.like_new);
  });
});

describe('meetsConditionThreshold', () => {
  it('returns true when offered condition equals minimum', () => {
    expect(meetsConditionThreshold('good', 'good')).toBe(true);
    expect(meetsConditionThreshold('like_new', 'like_new')).toBe(true);
    expect(meetsConditionThreshold('for_parts', 'for_parts')).toBe(true);
  });

  it('returns true when offered condition exceeds minimum', () => {
    expect(meetsConditionThreshold('like_new', 'good')).toBe(true);
    expect(meetsConditionThreshold('very_good', 'acceptable')).toBe(true);
    expect(meetsConditionThreshold('good', 'for_parts')).toBe(true);
  });

  it('returns false when offered condition is below minimum', () => {
    expect(meetsConditionThreshold('acceptable', 'good')).toBe(false);
    expect(meetsConditionThreshold('for_parts', 'like_new')).toBe(false);
    expect(meetsConditionThreshold('good', 'very_good')).toBe(false);
  });

  it('handles boundary: like_new meets any minimum', () => {
    expect(meetsConditionThreshold('like_new', 'for_parts')).toBe(true);
    expect(meetsConditionThreshold('like_new', 'acceptable')).toBe(true);
    expect(meetsConditionThreshold('like_new', 'good')).toBe(true);
    expect(meetsConditionThreshold('like_new', 'very_good')).toBe(true);
    expect(meetsConditionThreshold('like_new', 'like_new')).toBe(true);
  });

  it('handles boundary: for_parts only meets for_parts minimum', () => {
    expect(meetsConditionThreshold('for_parts', 'for_parts')).toBe(true);
    expect(meetsConditionThreshold('for_parts', 'acceptable')).toBe(false);
  });
});

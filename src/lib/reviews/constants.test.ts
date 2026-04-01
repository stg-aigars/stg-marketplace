import { describe, it, expect } from 'vitest';
import { REVIEW_WINDOW_DAYS, REVIEW_MAX_COMMENT_LENGTH, REVIEW_ELIGIBLE_STATUSES } from './constants';

describe('review constants', () => {
  it('has a 30-day review window', () => {
    expect(REVIEW_WINDOW_DAYS).toBe(30);
  });

  it('limits comments to 500 characters', () => {
    expect(REVIEW_MAX_COMMENT_LENGTH).toBe(500);
  });

  it('allows reviews only for completed orders', () => {
    expect(REVIEW_ELIGIBLE_STATUSES).toContain('completed');
    expect(REVIEW_ELIGIBLE_STATUSES).not.toContain('delivered');
    expect(REVIEW_ELIGIBLE_STATUSES).toHaveLength(1);
  });
});

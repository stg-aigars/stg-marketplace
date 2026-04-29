import { describe, it, expect } from 'vitest';
import { REPORT_CATEGORY_VALUES, REPORT_CATEGORY_LABELS } from './categories';

describe('REPORT_CATEGORY_VALUES', () => {
  it('includes misleading_listing as a marketplace-specific category (PTAC §6.1)', () => {
    expect(REPORT_CATEGORY_VALUES).toContain('misleading_listing');
  });

  it('preserves the original DSA Art. 16 categories', () => {
    expect(REPORT_CATEGORY_VALUES).toContain('counterfeit');
    expect(REPORT_CATEGORY_VALUES).toContain('ip_infringement');
    expect(REPORT_CATEGORY_VALUES).toContain('illegal_goods');
    expect(REPORT_CATEGORY_VALUES).toContain('csam');
    expect(REPORT_CATEGORY_VALUES).toContain('hate_or_harassment');
    expect(REPORT_CATEGORY_VALUES).toContain('other');
  });

  it('has a label for every value', () => {
    for (const value of REPORT_CATEGORY_VALUES) {
      expect(REPORT_CATEGORY_LABELS[value]).toBeTruthy();
    }
  });

  it('misleading_listing has a marketplace-specific label', () => {
    expect(REPORT_CATEGORY_LABELS.misleading_listing).toMatch(/condition|edition|completeness|pricing/i);
  });
});

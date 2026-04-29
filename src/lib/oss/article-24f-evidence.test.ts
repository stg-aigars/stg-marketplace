import { describe, it, expect } from 'vitest';
import {
  aggregateArticle24fEvidence,
  type Article24fEvidenceRow,
} from './article-24f-evidence';

const row = (overrides: Partial<Article24fEvidenceRow> = {}): Article24fEvidenceRow => ({
  status: 'completed',
  seller_country: 'LT',
  seller_iban_country_at_order: 'LT',
  ...overrides,
});

describe('aggregateArticle24fEvidence', () => {
  it('returns empty record for no rows', () => {
    expect(aggregateArticle24fEvidence([])).toEqual({});
  });

  it('classifies IBAN-matches-declared as consistent', () => {
    const result = aggregateArticle24fEvidence([row()]);
    expect(result.LT).toEqual({ total: 1, consistent: 1, singleStranded: 0, conflicting: 0 });
  });

  it('classifies null IBAN as single-stranded', () => {
    const result = aggregateArticle24fEvidence([
      row({ seller_iban_country_at_order: null }),
    ]);
    expect(result.LT).toEqual({ total: 1, consistent: 0, singleStranded: 1, conflicting: 0 });
  });

  it('classifies IBAN-mismatches-declared as conflicting', () => {
    const result = aggregateArticle24fEvidence([
      row({ seller_country: 'LT', seller_iban_country_at_order: 'EE' }),
    ]);
    expect(result.LT).toEqual({ total: 1, consistent: 0, singleStranded: 0, conflicting: 1 });
  });

  it('drops cancelled and refunded orders', () => {
    const result = aggregateArticle24fEvidence([
      row({ status: 'cancelled' }),
      row({ status: 'refunded' }),
      row(),
    ]);
    expect(result.LT?.total).toBe(1);
  });

  it('drops non-OSS member-state seller_country', () => {
    const result = aggregateArticle24fEvidence([
      row({ seller_country: 'LV' }),
      row({ seller_country: 'DE' }),
      row({ seller_country: null }),
      row(),
    ]);
    expect(result.LT?.total).toBe(1);
    expect(Object.keys(result)).toEqual(['LT']);
  });

  it('normalises casing on both seller_country and IBAN', () => {
    const result = aggregateArticle24fEvidence([
      row({ seller_country: 'lt', seller_iban_country_at_order: 'lt' }),
    ]);
    expect(result.LT).toEqual({ total: 1, consistent: 1, singleStranded: 0, conflicting: 0 });
  });

  it('aggregates multiple rows per MS', () => {
    const result = aggregateArticle24fEvidence([
      row(),
      row({ seller_iban_country_at_order: null }),
      row({ seller_country: 'EE', seller_iban_country_at_order: 'EE' }),
      row({ seller_country: 'EE', seller_iban_country_at_order: 'LT' }),
    ]);
    expect(result.LT).toEqual({ total: 2, consistent: 1, singleStranded: 1, conflicting: 0 });
    expect(result.EE).toEqual({ total: 2, consistent: 1, singleStranded: 0, conflicting: 1 });
  });
});

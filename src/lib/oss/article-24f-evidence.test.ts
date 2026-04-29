import { describe, it, expect } from 'vitest';
import {
  aggregateArticle24fEvidence,
  type Article24fEvidenceRow,
} from './article-24f-evidence';

let _idCounter = 0;
const row = (overrides: Partial<Article24fEvidenceRow> = {}): Article24fEvidenceRow => ({
  id: `order-${++_idCounter}`,
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
    expect(result.LT?.total).toBe(1);
    expect(result.LT?.consistent).toBe(1);
    expect(result.LT?.singleStranded).toBe(0);
    expect(result.LT?.conflicting).toBe(0);
  });

  it('classifies null IBAN as single-stranded', () => {
    const result = aggregateArticle24fEvidence([
      row({ seller_iban_country_at_order: null }),
    ]);
    expect(result.LT?.total).toBe(1);
    expect(result.LT?.singleStranded).toBe(1);
  });

  it('classifies empty-string IBAN as single-stranded (not conflicting)', () => {
    const result = aggregateArticle24fEvidence([
      row({ seller_iban_country_at_order: '   ' }),
    ]);
    expect(result.LT?.singleStranded).toBe(1);
    expect(result.LT?.conflicting).toBe(0);
  });

  it('classifies IBAN-mismatches-declared as conflicting and captures order id', () => {
    const result = aggregateArticle24fEvidence([
      row({ id: 'order-conflict-1', seller_country: 'LT', seller_iban_country_at_order: 'EE' }),
    ]);
    expect(result.LT?.conflicting).toBe(1);
    expect(result.LT?.conflictingOrderIds).toEqual(['order-conflict-1']);
  });

  it('caps conflictingOrderIds at the sample limit', () => {
    const conflictRows = Array.from({ length: 25 }, () =>
      row({ seller_country: 'LT', seller_iban_country_at_order: 'EE' }),
    );
    const result = aggregateArticle24fEvidence(conflictRows);
    expect(result.LT?.conflicting).toBe(25);
    expect(result.LT?.conflictingOrderIds.length).toBe(20);
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
    expect(result.LT?.consistent).toBe(1);
  });

  it('aggregates multiple rows per MS', () => {
    const result = aggregateArticle24fEvidence([
      row(),
      row({ seller_iban_country_at_order: null }),
      row({ seller_country: 'EE', seller_iban_country_at_order: 'EE' }),
      row({ seller_country: 'EE', seller_iban_country_at_order: 'LT' }),
    ]);
    expect(result.LT?.total).toBe(2);
    expect(result.LT?.consistent).toBe(1);
    expect(result.LT?.singleStranded).toBe(1);
    expect(result.EE?.total).toBe(2);
    expect(result.EE?.conflicting).toBe(1);
  });
});

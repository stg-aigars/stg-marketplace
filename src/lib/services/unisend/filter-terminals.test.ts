import { describe, expect, it } from 'vitest';
import { filterTerminals } from './filter-terminals';
import type { TerminalOption } from './types';

const t = (over: Partial<TerminalOption>): TerminalOption => ({
  id: '1', name: 'Rimi Centrs', city: 'Riga', address: 'Brivibas 1',
  postalCode: 'LV-1010', countryCode: 'LV', latitude: '0', longitude: '0', ...over,
});

const terminals = [
  t({ id: '1', name: 'Rimi Centrs', city: 'Riga', address: 'Brivibas 1' }),
  t({ id: '2', name: 'Maxima Kauns', city: 'Kaunas', address: 'Laisves 5' }),
  t({ id: '3', name: 'Depo Mezciems', city: 'Riga', address: 'Mezciema 3' }),
];

describe('filterTerminals', () => {
  it('returns all terminals for an empty/whitespace query', () => {
    expect(filterTerminals(terminals, '')).toHaveLength(3);
    expect(filterTerminals(terminals, '   ')).toHaveLength(3);
  });

  it('matches case-insensitively on name', () => {
    expect(filterTerminals(terminals, 'rimi').map((x) => x.id)).toEqual(['1']);
  });

  it('matches on city', () => {
    expect(filterTerminals(terminals, 'riga').map((x) => x.id)).toEqual(['1', '3']);
  });

  it('matches on address', () => {
    expect(filterTerminals(terminals, 'laisves').map((x) => x.id)).toEqual(['2']);
  });

  it('returns empty when nothing matches', () => {
    expect(filterTerminals(terminals, 'zzz')).toEqual([]);
  });
});

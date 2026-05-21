import { describe, it, expect } from 'vitest';
import { formatTerminalLines, formatTerminalCompact } from './format';

describe('formatTerminalLines', () => {
  it('returns empty array when name is missing', () => {
    expect(formatTerminalLines({ name: null })).toEqual([]);
    expect(formatTerminalLines({ name: undefined })).toEqual([]);
    expect(formatTerminalLines({ name: '' })).toEqual([]);
  });

  it('returns just the name when address details are missing', () => {
    expect(formatTerminalLines({ name: 'Minska' })).toEqual(['Minska']);
  });

  it('builds the full Baltic address from all fields', () => {
    expect(
      formatTerminalLines({
        name: 'Minska',
        address: 'Nīcgales iela 2A',
        city: 'Riga',
        postalCode: 'LV-1073',
        country: 'LV',
      }),
    ).toEqual(['Minska', 'Nīcgales iela 2A', 'Riga, LV-1073', 'Latvia']);
  });

  it('combines city and postal code on a single line', () => {
    expect(
      formatTerminalLines({ name: 'X', city: 'Tallinn', postalCode: '10115' }),
    ).toEqual(['X', 'Tallinn, 10115']);
  });

  it('shows city alone when postal code is missing', () => {
    expect(formatTerminalLines({ name: 'X', city: 'Tallinn' })).toEqual([
      'X',
      'Tallinn',
    ]);
  });

  it('shows postal code alone when city is missing', () => {
    expect(formatTerminalLines({ name: 'X', postalCode: 'LV-1073' })).toEqual([
      'X',
      'LV-1073',
    ]);
  });

  it('expands country code to country name', () => {
    expect(formatTerminalLines({ name: 'X', country: 'EE' })).toEqual([
      'X',
      'Estonia',
    ]);
    expect(formatTerminalLines({ name: 'X', country: 'LT' })).toEqual([
      'X',
      'Lithuania',
    ]);
  });
});

describe('formatTerminalCompact', () => {
  it('returns the name', () => {
    expect(formatTerminalCompact({ name: 'Minska' })).toBe('Minska');
  });

  it('returns empty string when name is missing', () => {
    expect(formatTerminalCompact({ name: null })).toBe('');
    expect(formatTerminalCompact({ name: undefined })).toBe('');
  });
});

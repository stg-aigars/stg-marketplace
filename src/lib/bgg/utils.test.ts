import { describe, it, expect } from 'vitest';
import { getWeightLabel, decodeHTMLEntities } from './utils';

describe('getWeightLabel', () => {
  it('returns Light for weight below 1.5', () => {
    expect(getWeightLabel(1.0)).toBe('Light');
    expect(getWeightLabel(1.49)).toBe('Light');
  });

  it('returns Medium Light for weight 1.5 to 2.49', () => {
    expect(getWeightLabel(1.5)).toBe('Medium Light');
    expect(getWeightLabel(2.0)).toBe('Medium Light');
    expect(getWeightLabel(2.49)).toBe('Medium Light');
  });

  it('returns Medium for weight 2.5 to 3.49', () => {
    expect(getWeightLabel(2.5)).toBe('Medium');
    expect(getWeightLabel(3.0)).toBe('Medium');
    expect(getWeightLabel(3.49)).toBe('Medium');
  });

  it('returns Medium Heavy for weight 3.5 to 4.49', () => {
    expect(getWeightLabel(3.5)).toBe('Medium Heavy');
    expect(getWeightLabel(4.0)).toBe('Medium Heavy');
    expect(getWeightLabel(4.49)).toBe('Medium Heavy');
  });

  it('returns Heavy for weight 4.5 and above', () => {
    expect(getWeightLabel(4.5)).toBe('Heavy');
    expect(getWeightLabel(5.0)).toBe('Heavy');
  });
});

describe('decodeHTMLEntities', () => {
  it('decodes common HTML entities from BGG data', () => {
    expect(decodeHTMLEntities('Catan: Traders &amp; Barbarians')).toBe(
      'Catan: Traders & Barbarians'
    );
    expect(decodeHTMLEntities('It&#039;s a Wonderful World')).toBe(
      "It's a Wonderful World"
    );
  });

  it('returns empty string for null/undefined', () => {
    expect(decodeHTMLEntities(null)).toBe('');
    expect(decodeHTMLEntities(undefined)).toBe('');
  });

  it('passes through plain text unchanged', () => {
    expect(decodeHTMLEntities('Catan')).toBe('Catan');
  });
});

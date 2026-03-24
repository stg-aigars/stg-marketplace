import { describe, it, expect } from 'vitest';
import { normalizeDecimalInput } from './decimal-input';

describe('normalizeDecimalInput', () => {
  it('passes through period decimal separator', () => {
    expect(normalizeDecimalInput('12.50')).toBe('12.50');
  });

  it('converts comma to period', () => {
    expect(normalizeDecimalInput('12,50')).toBe('12.50');
  });

  it('strips non-numeric characters', () => {
    expect(normalizeDecimalInput('€12.50')).toBe('12.50');
    expect(normalizeDecimalInput('abc')).toBe('');
  });

  it('allows only one decimal point', () => {
    expect(normalizeDecimalInput('12.50.30')).toBe('12.50');
  });

  it('limits to 2 decimal places', () => {
    expect(normalizeDecimalInput('12.999')).toBe('12.99');
  });

  it('handles empty and dot-only input', () => {
    expect(normalizeDecimalInput('')).toBe('');
    expect(normalizeDecimalInput('.')).toBe('.');
  });

  it('handles integer input', () => {
    expect(normalizeDecimalInput('42')).toBe('42');
  });

  it('handles comma with single decimal digit', () => {
    expect(normalizeDecimalInput('12,5')).toBe('12.5');
  });

  it('handles multiple dots with long fractions', () => {
    expect(normalizeDecimalInput('1.23456.7')).toBe('1.23');
  });

  it('handles pasted European thousand-separator format', () => {
    expect(normalizeDecimalInput('1,234,56')).toBe('1.23');
  });
});

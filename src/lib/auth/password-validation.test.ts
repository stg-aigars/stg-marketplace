import { describe, it, expect } from 'vitest';
import {
  PASSWORD_RULES,
  checkPasswordRules,
  validatePasswordStrength,
} from './password-validation';

describe('PASSWORD_RULES', () => {
  it('mirrors the Supabase preset (length, upper, lower, number, symbol)', () => {
    expect(PASSWORD_RULES.map((r) => r.id)).toEqual([
      'length',
      'upper',
      'lower',
      'number',
      'symbol',
    ]);
  });
});

describe('checkPasswordRules', () => {
  it('flags every rule as unmet for an empty password', () => {
    const result = checkPasswordRules('');
    expect(result.every((r) => !r.met)).toBe(true);
  });

  it('flags every rule as met for a fully compliant password', () => {
    const result = checkPasswordRules('Abcdef1!');
    expect(result.every((r) => r.met)).toBe(true);
  });

  it('flags length and symbol unmet for "Abcdef1"', () => {
    const result = checkPasswordRules('Abcdef1');
    const unmet = result.filter((r) => !r.met).map((r) => r.id);
    expect(unmet).toEqual(['length', 'symbol']);
  });

  it('flags upper unmet for "abcdef1!"', () => {
    const result = checkPasswordRules('abcdef1!');
    expect(result.find((r) => r.id === 'upper')?.met).toBe(false);
  });

  it('flags lower unmet for "ABCDEF1!"', () => {
    const result = checkPasswordRules('ABCDEF1!');
    expect(result.find((r) => r.id === 'lower')?.met).toBe(false);
  });
});

describe('validatePasswordStrength', () => {
  it('returns null when every rule passes', () => {
    expect(validatePasswordStrength('Abcdef1!')).toBeNull();
  });

  it('returns the length message first when too short', () => {
    expect(validatePasswordStrength('Ab1!')).toBe(
      'Password must be at least 8 characters'
    );
  });

  it('returns the uppercase message when only uppercase is missing', () => {
    expect(validatePasswordStrength('abcdef1!')).toBe(
      'Password must include an uppercase letter'
    );
  });

  it('returns the lowercase message when only lowercase is missing', () => {
    expect(validatePasswordStrength('ABCDEF1!')).toBe(
      'Password must include a lowercase letter'
    );
  });

  it('returns the number message when only a number is missing', () => {
    expect(validatePasswordStrength('Abcdefgh!')).toBe(
      'Password must include a number'
    );
  });

  it('returns the symbol message when only a symbol is missing', () => {
    expect(validatePasswordStrength('Abcdef12')).toBe(
      'Password must include a symbol'
    );
  });

  it('rejects passwords that the previous 4-rule check would have accepted', () => {
    // Regression guard: under the old check, "password1!" passed (had a
    // letter, number, symbol, >=8). Supabase rejected it because there was
    // no uppercase. We close the gap here.
    expect(validatePasswordStrength('password1!')).toBe(
      'Password must include an uppercase letter'
    );
  });
});

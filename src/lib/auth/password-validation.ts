/**
 * Shared password strength rules.
 * Used by both client-side forms and server-side actions so the UI rule
 * displayed to the user matches what the server actually enforces.
 *
 * Rules mirror the Supabase Auth password requirements configured on the
 * project: at least 8 characters with an uppercase letter, a lowercase
 * letter, a number, and a symbol. Supabase's `password_requirements` preset
 * is the source of truth — keep these in sync if the dashboard setting
 * changes (otherwise client allows what Supabase rejects, or vice versa).
 */

export type PasswordRuleId = 'length' | 'upper' | 'lower' | 'number' | 'symbol';

export interface PasswordRule {
  id: PasswordRuleId;
  label: string;
  test: (password: string) => boolean;
}

export const PASSWORD_RULES: readonly PasswordRule[] = [
  { id: 'length', label: 'At least 8 characters', test: (p) => p.length >= 8 },
  { id: 'upper', label: 'An uppercase letter', test: (p) => /[A-Z]/.test(p) },
  { id: 'lower', label: 'A lowercase letter', test: (p) => /[a-z]/.test(p) },
  { id: 'number', label: 'A number', test: (p) => /[0-9]/.test(p) },
  { id: 'symbol', label: 'A symbol', test: (p) => /[^a-zA-Z0-9]/.test(p) },
];

export interface PasswordRuleStatus {
  id: PasswordRuleId;
  label: string;
  met: boolean;
}

export function checkPasswordRules(password: string): PasswordRuleStatus[] {
  return PASSWORD_RULES.map((rule) => ({
    id: rule.id,
    label: rule.label,
    met: rule.test(password),
  }));
}

export function validatePasswordStrength(password: string): string | null {
  const failed = PASSWORD_RULES.find((rule) => !rule.test(password));
  if (!failed) return null;
  if (failed.id === 'length') return 'Password must be at least 8 characters';
  return `Password must include ${failed.label.toLowerCase()}`;
}

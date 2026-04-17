/**
 * Shared password strength validator.
 * Used by both client-side forms and server-side actions so the UI rule
 * displayed to the user matches what the server actually enforces.
 *
 * Rule: at least 8 characters, with letters, numbers, and symbols.
 * Supabase's own `password_requirements` presets don't offer exactly this
 * combination, so we enforce it in application code.
 */

export const PASSWORD_REQUIREMENT_MESSAGE =
  'At least 8 characters with letters, numbers, and symbols';

export function validatePasswordStrength(password: string): string | null {
  if (password.length < 8) {
    return 'Password must be at least 8 characters';
  }
  if (!/[a-zA-Z]/.test(password)) {
    return 'Password must include a letter';
  }
  if (!/[0-9]/.test(password)) {
    return 'Password must include a number';
  }
  if (!/[^a-zA-Z0-9]/.test(password)) {
    return 'Password must include a symbol';
  }
  return null;
}

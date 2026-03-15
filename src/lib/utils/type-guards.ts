/**
 * Type guard utilities for safe type narrowing
 * Use these instead of `any` casts in catch blocks and Supabase results.
 */

export function isError(value: unknown): value is Error {
  return value instanceof Error;
}

export function getErrorMessage(error: unknown): string {
  if (isError(error)) return error.message;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  return 'Unknown error';
}

export function hasData<T>(
  result: { data: T | null; error: unknown }
): result is { data: T; error: null } {
  return result.data !== null && result.error === null;
}

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isArray<T = unknown>(value: unknown): value is T[] {
  return Array.isArray(value);
}

export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value);
}

export function getProperty<T>(obj: unknown, key: string, defaultValue: T): T {
  if (isObject(obj) && key in obj) {
    return obj[key] as T;
  }
  return defaultValue;
}

import { format, formatDistanceToNow, isToday, isYesterday } from 'date-fns';

/**
 * Date formatting utilities for consistent European-style display.
 * Format: dd.MM.yyyy (e.g., 31.08.2026) with 24-hour time.
 * Time separator is locale-aware: colon for most locales (14:30), dot for Latvian (14.30).
 */

type DateInput = Date | string | number;

/**
 * Safely converts various date inputs to a Date object
 */
function toDate(date: DateInput): Date {
  if (date instanceof Date) return date;
  return new Date(date);
}

/**
 * Applies locale-specific time separator.
 * Latvian uses dots (14.30), all other locales use colons (14:30).
 */
function localizeTime(timeStr: string, locale?: string): string {
  if (locale === 'lv') return timeStr.replace(/:/g, '.');
  return timeStr;
}

/**
 * Formats a date as dd.MM.yyyy (e.g., 31.08.2026)
 */
export function formatDate(date: DateInput): string {
  return format(toDate(date), 'dd.MM.yyyy');
}

/**
 * Formats a date as dd.MM (e.g., 31.08) for compact displays
 */
export function formatDateShort(date: DateInput): string {
  return format(toDate(date), 'dd.MM');
}

/**
 * Formats time as HH:mm in 24-hour format (e.g., 14:30 or 14.30 for Latvian)
 */
export function formatTime(date: DateInput, locale?: string): string {
  return localizeTime(format(toDate(date), 'HH:mm'), locale);
}

/**
 * Formats date and time as dd.MM.yyyy HH:mm (e.g., 31.08.2026 14:30 or 14.30 for Latvian)
 */
export function formatDateTime(date: DateInput, locale?: string): string {
  const d = toDate(date);
  return `${format(d, 'dd.MM.yyyy')} ${localizeTime(format(d, 'HH:mm'), locale)}`;
}

/**
 * Formats a date as dd.MM for the current year, dd.MM.yyyy for older dates.
 */
export function formatDateCompact(date: DateInput): string {
  const d = toDate(date);
  if (d.getFullYear() === new Date().getFullYear()) {
    return format(d, 'dd.MM');
  }
  return format(d, 'dd.MM.yyyy');
}

/**
 * Formats a relative time string (e.g., "5 minutes ago", "2 hours ago")
 */
export function formatRelativeTime(date: DateInput, addSuffix = true): string {
  return formatDistanceToNow(toDate(date), { addSuffix });
}

/**
 * Formats a message timestamp with smart relative display:
 * - Today: "14:30"
 * - Yesterday: "Yesterday, 14:30"
 * - Within 7 days: "Wed, 14:30"
 * - Older: "31.08 14:30"
 */
export function formatMessageTime(timestamp: DateInput, locale?: string): string {
  const date = toDate(timestamp);

  if (isToday(date)) {
    return formatTime(date, locale);
  }

  if (isYesterday(date)) {
    return `Yesterday, ${formatTime(date, locale)}`;
  }

  // Less than 7 days ago
  if (Date.now() - date.getTime() < 7 * 24 * 60 * 60 * 1000) {
    return `${format(date, 'EEE')}, ${localizeTime(format(date, 'HH:mm'), locale)}`;
  }

  return `${formatDateShort(date)} ${formatTime(date, locale)}`;
}

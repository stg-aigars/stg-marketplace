import { formatDistanceToNow } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';

/**
 * Date formatting utilities for consistent European-style display.
 * Format: dd.MM.yyyy (e.g., 31.08.2026) with 24-hour time.
 * Time separator is locale-aware: colon for most locales (14:30), dot for Latvian (14.30).
 *
 * All wall-clock rendering is pinned to Europe/Riga. The production Node
 * runtime is UTC, so plain `date-fns` `format()` would print UTC; this
 * module wraps everything in `formatInTimeZone` so server-rendered staff
 * pages match what a Riga-based operator sees on their clock. Estonia and
 * Lithuania share the same EET/EEST offset, so one pin covers all three
 * launch markets.
 */

const RIGA_TZ = 'Europe/Riga';

type DateInput = Date | string | number;

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
  return formatInTimeZone(toDate(date), RIGA_TZ, 'dd.MM.yyyy');
}

/**
 * Formats a date as dd.MM (e.g., 31.08) for compact displays
 */
export function formatDateShort(date: DateInput): string {
  return formatInTimeZone(toDate(date), RIGA_TZ, 'dd.MM');
}

/**
 * Formats time as HH:mm in 24-hour format (e.g., 14:30 or 14.30 for Latvian)
 */
export function formatTime(date: DateInput, locale?: string): string {
  return localizeTime(formatInTimeZone(toDate(date), RIGA_TZ, 'HH:mm'), locale);
}

/**
 * Formats date and time as dd.MM.yyyy HH:mm (e.g., 31.08.2026 14:30 or 14.30 for Latvian)
 */
export function formatDateTime(date: DateInput, locale?: string): string {
  const d = toDate(date);
  return `${formatInTimeZone(d, RIGA_TZ, 'dd.MM.yyyy')} ${localizeTime(formatInTimeZone(d, RIGA_TZ, 'HH:mm'), locale)}`;
}

/**
 * Formats a date as full month name + year (e.g., "March 2026").
 * Use for low-precision "member since" / "joined" style fields where the day
 * is unnecessary or mildly privacy-sensitive.
 *
 * Uses `LLLL` (standalone month form) rather than `MMMM` (contextual).
 * Today both render identically in English. When Latvian / Lithuanian lands,
 * the locale implementer needs to revisit this: Baltic languages inflect month
 * names by case, and "Member since {month}" is a since-phrase that may want
 * the genitive form (`MMMM`) rather than the nominative standalone (`LLLL`).
 */
export function formatMonthYear(date: DateInput): string {
  return formatInTimeZone(toDate(date), RIGA_TZ, 'LLLL yyyy');
}

/**
 * Formats a date as dd.MM for the current year, dd.MM.yyyy for older dates.
 */
export function formatDateCompact(date: DateInput): string {
  const d = toDate(date);
  const year = formatInTimeZone(d, RIGA_TZ, 'yyyy');
  const currentYear = formatInTimeZone(new Date(), RIGA_TZ, 'yyyy');
  if (year === currentYear) {
    return formatInTimeZone(d, RIGA_TZ, 'dd.MM');
  }
  return formatInTimeZone(d, RIGA_TZ, 'dd.MM.yyyy');
}

/**
 * Formats a relative time string (e.g., "5 minutes ago", "2 hours ago").
 * Timezone-agnostic — compares timestamps numerically.
 */
export function formatRelativeTime(date: DateInput, addSuffix = true): string {
  return formatDistanceToNow(toDate(date), { addSuffix });
}

/**
 * Returns the Riga-local calendar date as `yyyy-MM-dd` for boundary comparisons.
 * Using string equality on this representation avoids `date-fns` `isToday` /
 * `isYesterday`, which test against the runtime's local tz rather than Riga.
 */
function rigaCalendarDate(d: Date): string {
  return formatInTimeZone(d, RIGA_TZ, 'yyyy-MM-dd');
}

/**
 * Formats a message timestamp with smart relative display:
 * - Today (Riga): "14:30"
 * - Yesterday (Riga): "Yesterday, 14:30"
 * - Within 7 days: "Wed, 14:30"
 * - Older: "31.08 14:30"
 */
export function formatMessageTime(timestamp: DateInput, locale?: string): string {
  const date = toDate(timestamp);
  const now = new Date();
  const today = rigaCalendarDate(now);
  const yesterday = rigaCalendarDate(new Date(now.getTime() - 24 * 60 * 60 * 1000));
  const target = rigaCalendarDate(date);

  if (target === today) {
    return formatTime(date, locale);
  }

  if (target === yesterday) {
    return `Yesterday, ${formatTime(date, locale)}`;
  }

  // Less than 7 days ago
  if (now.getTime() - date.getTime() < 7 * 24 * 60 * 60 * 1000) {
    return `${formatInTimeZone(date, RIGA_TZ, 'EEE')}, ${localizeTime(formatInTimeZone(date, RIGA_TZ, 'HH:mm'), locale)}`;
  }

  return `${formatDateShort(date)} ${formatTime(date, locale)}`;
}

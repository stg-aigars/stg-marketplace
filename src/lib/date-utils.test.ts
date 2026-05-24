import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  formatDate,
  formatDateShort,
  formatTime,
  formatDateTime,
  formatDateCompact,
  formatMessageTime,
  formatMonthYear,
} from './date-utils';

// All wall-clock rendering is pinned to Europe/Riga. Tests therefore use
// offset-explicit ISO strings (+02:00 winter EET, +03:00 summer EEST) so
// the inputs mean the same wall-clock moment regardless of the runner's
// own timezone — production runs Node in UTC, the dev's machine runs in
// Riga, and we want both green.
//
// EU DST in 2026: starts Sunday 29 Mar, ends Sunday 25 Oct.

afterEach(() => {
  vi.useRealTimers();
});

describe('formatDate', () => {
  it('formats Date object as dd.MM.yyyy', () => {
    expect(formatDate(new Date('2026-08-31T12:00:00+03:00'))).toBe('31.08.2026');
  });

  it('accepts ISO string input', () => {
    expect(formatDate('2026-08-31T14:30:00+03:00')).toBe('31.08.2026');
  });

  it('accepts timestamp number', () => {
    const ts = new Date('2026-01-15T12:00:00+02:00').getTime();
    expect(formatDate(ts)).toBe('15.01.2026');
  });

  it('pads single-digit day and month', () => {
    expect(formatDate(new Date('2026-01-05T12:00:00+02:00'))).toBe('05.01.2026');
  });
});

describe('formatDateShort', () => {
  it('formats as dd.MM', () => {
    expect(formatDateShort(new Date('2026-08-31T12:00:00+03:00'))).toBe('31.08');
  });

  it('pads single digits', () => {
    expect(formatDateShort(new Date('2026-01-03T12:00:00+02:00'))).toBe('03.01');
  });
});

describe('formatTime', () => {
  it('formats with colon by default', () => {
    expect(formatTime(new Date('2026-01-01T14:30:00+02:00'))).toBe('14:30');
  });

  it('uses dot separator for lv locale', () => {
    expect(formatTime(new Date('2026-01-01T14:30:00+02:00'), 'lv')).toBe('14.30');
  });

  it('uses colon for en locale', () => {
    expect(formatTime(new Date('2026-01-01T09:05:00+02:00'), 'en')).toBe('09:05');
  });
});

describe('formatDateTime', () => {
  it('combines date and time', () => {
    expect(formatDateTime(new Date('2026-08-31T14:30:00+03:00'))).toBe('31.08.2026 14:30');
  });

  it('respects lv locale for time separator', () => {
    expect(formatDateTime(new Date('2026-08-31T14:30:00+03:00'), 'lv')).toBe('31.08.2026 14.30');
  });
});

describe('Europe/Riga pinning', () => {
  it('renders a late-evening UTC timestamp as next-day Riga date (summer)', () => {
    // 24 May 2026 22:30 UTC == 25 May 2026 01:30 Riga (EEST +03:00)
    expect(formatDate('2026-05-24T22:30:00Z')).toBe('25.05.2026');
    expect(formatTime('2026-05-24T22:30:00Z')).toBe('01:30');
    expect(formatDateTime('2026-05-24T22:30:00Z')).toBe('25.05.2026 01:30');
  });

  it('renders a late-evening UTC timestamp as next-day Riga date (winter)', () => {
    // 1 Jan 2026 22:30 UTC == 2 Jan 2026 00:30 Riga (EET +02:00)
    expect(formatDateTime('2026-01-01T22:30:00Z')).toBe('02.01.2026 00:30');
  });
});

describe('formatDateCompact', () => {
  it('omits year for same year', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-15T12:00:00+03:00'));
    expect(formatDateCompact(new Date('2026-08-31T14:30:00+03:00'))).toBe('31.08');
    vi.useRealTimers();
  });

  it('includes year for different year', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-15T12:00:00+03:00'));
    expect(formatDateCompact(new Date('2025-12-25T12:00:00+02:00'))).toBe('25.12.2025');
    vi.useRealTimers();
  });
});

describe('formatMonthYear', () => {
  it('formats a Date as "March 2026"', () => {
    expect(formatMonthYear(new Date('2026-03-15T12:00:00+02:00'))).toBe('March 2026');
  });

  it('accepts ISO string input', () => {
    expect(formatMonthYear('2026-03-15T10:00:00+02:00')).toBe('March 2026');
  });
});

describe('formatMessageTime', () => {
  it('shows time only for today', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-15T16:00:00+02:00'));
    expect(formatMessageTime(new Date('2026-03-15T14:30:00+02:00'))).toBe('14:30');
  });

  it('shows "Yesterday, HH:mm" for yesterday', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-15T16:00:00+02:00'));
    expect(formatMessageTime(new Date('2026-03-14T09:15:00+02:00'))).toBe('Yesterday, 09:15');
  });

  it('shows day name within 7 days', () => {
    vi.useFakeTimers();
    // Sunday March 15, 2026
    vi.setSystemTime(new Date('2026-03-15T16:00:00+02:00'));
    // Wednesday March 11, 2026
    expect(formatMessageTime(new Date('2026-03-11T10:00:00+02:00'))).toBe('Wed, 10:00');
  });

  it('shows date + time for older messages', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-15T16:00:00+02:00'));
    expect(formatMessageTime(new Date('2026-02-01T08:45:00+02:00'))).toBe('01.02 08:45');
  });

  it('uses dot separator for lv locale', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-15T16:00:00+02:00'));
    expect(formatMessageTime(new Date('2026-03-15T14:30:00+02:00'), 'lv')).toBe('14.30');
  });

  it('uses dot separator for lv locale on yesterday', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-15T16:00:00+02:00'));
    expect(formatMessageTime(new Date('2026-03-14T09:15:00+02:00'), 'lv')).toBe('Yesterday, 09.15');
  });

  it('uses Riga calendar boundary, not runtime tz, for "today"', () => {
    vi.useFakeTimers();
    // System "now" = 22:00 UTC on 24 May 2026 (= 01:00 Riga on 25 May).
    vi.setSystemTime(new Date('2026-05-24T22:00:00Z'));
    // A message at 21:00 UTC same day = 00:00 Riga on 25 May — same Riga
    // calendar day as "now", even though it's the previous UTC day.
    expect(formatMessageTime('2026-05-24T21:00:00Z')).toBe('00:00');
  });
});

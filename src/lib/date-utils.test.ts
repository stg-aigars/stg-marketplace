import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  formatDate,
  formatDateShort,
  formatTime,
  formatDateTime,
  formatDateCompact,
  formatMessageTime,
} from './date-utils';

afterEach(() => {
  vi.useRealTimers();
});

describe('formatDate', () => {
  it('formats Date object as dd.MM.yyyy', () => {
    expect(formatDate(new Date(2026, 7, 31))).toBe('31.08.2026');
  });

  it('accepts ISO string input', () => {
    expect(formatDate('2026-08-31T14:30:00')).toBe('31.08.2026');
  });

  it('accepts timestamp number', () => {
    const ts = new Date(2026, 0, 15).getTime();
    expect(formatDate(ts)).toBe('15.01.2026');
  });

  it('pads single-digit day and month', () => {
    expect(formatDate(new Date(2026, 0, 5))).toBe('05.01.2026');
  });
});

describe('formatDateShort', () => {
  it('formats as dd.MM', () => {
    expect(formatDateShort(new Date(2026, 7, 31))).toBe('31.08');
  });

  it('pads single digits', () => {
    expect(formatDateShort(new Date(2026, 0, 3))).toBe('03.01');
  });
});

describe('formatTime', () => {
  it('formats with colon by default', () => {
    expect(formatTime(new Date(2026, 0, 1, 14, 30))).toBe('14:30');
  });

  it('uses dot separator for lv locale', () => {
    expect(formatTime(new Date(2026, 0, 1, 14, 30), 'lv')).toBe('14.30');
  });

  it('uses colon for en locale', () => {
    expect(formatTime(new Date(2026, 0, 1, 9, 5), 'en')).toBe('09:05');
  });
});

describe('formatDateTime', () => {
  it('combines date and time', () => {
    expect(formatDateTime(new Date(2026, 7, 31, 14, 30))).toBe('31.08.2026 14:30');
  });

  it('respects lv locale for time separator', () => {
    expect(formatDateTime(new Date(2026, 7, 31, 14, 30), 'lv')).toBe('31.08.2026 14.30');
  });
});

describe('formatDateCompact', () => {
  it('omits year for same year', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 15));
    expect(formatDateCompact(new Date(2026, 7, 31))).toBe('31.08');
    vi.useRealTimers();
  });

  it('includes year for different year', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 15));
    expect(formatDateCompact(new Date(2025, 11, 25))).toBe('25.12.2025');
    vi.useRealTimers();
  });
});

describe('formatMessageTime', () => {
  it('shows time only for today', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 2, 15, 16, 0));
    expect(formatMessageTime(new Date(2026, 2, 15, 14, 30))).toBe('14:30');
  });

  it('shows "Yesterday, HH:mm" for yesterday', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 2, 15, 16, 0));
    expect(formatMessageTime(new Date(2026, 2, 14, 9, 15))).toBe('Yesterday, 09:15');
  });

  it('shows day name within 7 days', () => {
    vi.useFakeTimers();
    // Sunday March 15, 2026
    vi.setSystemTime(new Date(2026, 2, 15, 16, 0));
    // Wednesday March 11, 2026
    const wed = new Date(2026, 2, 11, 10, 0);
    expect(formatMessageTime(wed)).toBe('Wed, 10:00');
  });

  it('shows date + time for older messages', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 2, 15, 16, 0));
    const old = new Date(2026, 1, 1, 8, 45);
    expect(formatMessageTime(old)).toBe('01.02 08:45');
  });

  it('uses dot separator for lv locale', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 2, 15, 16, 0));
    expect(formatMessageTime(new Date(2026, 2, 15, 14, 30), 'lv')).toBe('14.30');
  });

  it('uses dot separator for lv locale on yesterday', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 2, 15, 16, 0));
    expect(formatMessageTime(new Date(2026, 2, 14, 9, 15), 'lv')).toBe('Yesterday, 09.15');
  });
});

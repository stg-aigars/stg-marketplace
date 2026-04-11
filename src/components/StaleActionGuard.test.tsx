// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { StaleActionGuard } from './StaleActionGuard';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock('sonner', () => ({
  toast: vi.fn(),
}));

const STORAGE_KEY = 'stg-stale-action-reload';

describe('StaleActionGuard', () => {
  let reloadMock: ReturnType<typeof vi.fn>;
  let originalLocation: Location;

  beforeEach(() => {
    vi.useFakeTimers();
    sessionStorage.clear();
    reloadMock = vi.fn();
    originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...originalLocation, reload: reloadMock },
    });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    });
  });

  function dispatchRejection(reason: unknown) {
    const event = new Event('unhandledrejection', { cancelable: true }) as PromiseRejectionEvent;
    Object.assign(event, { reason, promise: Promise.resolve() });
    act(() => {
      window.dispatchEvent(event);
    });
  }

  it('reloads the page when a stale Server Action error is rejected', () => {
    render(<StaleActionGuard />);
    dispatchRejection(new Error('Server Action "abc" was not found on the server'));
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(reloadMock).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem(STORAGE_KEY)).not.toBeNull();
  });

  it('renders the alert instead of reloading when a recent reload was attempted', () => {
    sessionStorage.setItem(STORAGE_KEY, String(Date.now()));
    render(<StaleActionGuard />);
    dispatchRejection(new Error('Server Action "abc" was not found on the server'));
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(reloadMock).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toBeTruthy();
  });

  it('ignores unrelated rejection reasons', () => {
    render(<StaleActionGuard />);
    dispatchRejection(new Error('random network failure'));
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(reloadMock).not.toHaveBeenCalled();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

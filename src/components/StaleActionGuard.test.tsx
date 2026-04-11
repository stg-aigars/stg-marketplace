// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { toast } from 'sonner';
import { StaleActionGuard } from './StaleActionGuard';

vi.mock('next-intl', () => ({
  // Prefix the returned string so tests can prove the i18n key was resolved
  // (a missed key would surface as the raw key or as empty text).
  useTranslations: () => (key: string) => `t:${key}`,
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
    vi.mocked(toast).mockClear();
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

  it('reloads the page and shows the updating toast when a stale Server Action error is rejected', () => {
    render(<StaleActionGuard />);
    dispatchRejection(new Error('Server Action "abc" was not found on the server'));
    expect(toast).toHaveBeenCalledTimes(1);
    expect(toast).toHaveBeenCalledWith('t:updating');
    expect(reloadMock).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(reloadMock).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem(STORAGE_KEY)).not.toBeNull();
  });

  it('renders the new-version alert instead of reloading when a recent reload was attempted', () => {
    sessionStorage.setItem(STORAGE_KEY, String(Date.now()));
    render(<StaleActionGuard />);
    dispatchRejection(new Error('Server Action "abc" was not found on the server'));
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(reloadMock).not.toHaveBeenCalled();
    expect(toast).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toContain('t:newVersionAvailable');
  });

  it('ignores unrelated rejection reasons', () => {
    render(<StaleActionGuard />);
    dispatchRejection(new Error('random network failure'));
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(reloadMock).not.toHaveBeenCalled();
    expect(toast).not.toHaveBeenCalled();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

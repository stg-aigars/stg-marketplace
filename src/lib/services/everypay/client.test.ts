import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('@sentry/nextjs', () => ({
  captureMessage: vi.fn(),
}));

import * as Sentry from '@sentry/nextjs';
import { mapEveryPayMethod } from './client';

describe('mapEveryPayMethod', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('maps "card" to card', () => {
    expect(mapEveryPayMethod('card')).toBe('card');
    expect(Sentry.captureMessage).not.toHaveBeenCalled();
  });

  it('maps known Swedbank OB to bank_link without warning', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(mapEveryPayMethod('swed_ob_ep_baltics_lv')).toBe('bank_link');
    expect(warnSpy).not.toHaveBeenCalled();
    expect(Sentry.captureMessage).not.toHaveBeenCalled();
  });

  it('maps known SEB OB to bank_link without warning', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(mapEveryPayMethod('seb_ob_ee')).toBe('bank_link');
    expect(warnSpy).not.toHaveBeenCalled();
    expect(Sentry.captureMessage).not.toHaveBeenCalled();
  });

  it('maps unknown method to bank_link with Sentry warning', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(mapEveryPayMethod('apple_pay', 'STG-TEST-001')).toBe('bank_link');
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      'Unknown EveryPay payment_method: apple_pay',
      expect.objectContaining({
        level: 'warning',
        tags: { rawPaymentMethod: 'apple_pay' },
        extra: { orderReference: 'STG-TEST-001' },
      })
    );
  });

  it('defaults undefined to bank_link with console warning', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(mapEveryPayMethod(undefined)).toBe('bank_link');
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      'Missing EveryPay payment_method field',
      expect.objectContaining({ level: 'warning' })
    );
  });
});

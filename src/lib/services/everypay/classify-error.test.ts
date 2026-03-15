import { describe, it, expect } from 'vitest';
import { classifyPaymentError } from './classify-error';

describe('classifyPaymentError', () => {
  it('returns user_cancelled for abandoned payments', () => {
    expect(classifyPaymentError('abandoned')).toBe('user_cancelled');
  });

  it('returns payment_failed for voided payments', () => {
    expect(classifyPaymentError('voided')).toBe('payment_failed');
  });

  it('returns payment_failed when no error details provided', () => {
    expect(classifyPaymentError('failed')).toBe('payment_failed');
    expect(classifyPaymentError('failed', null)).toBe('payment_failed');
  });

  it('returns fraud_declined for explicit fraud check messages', () => {
    expect(
      classifyPaymentError('failed', {
        code: 9999,
        message: 'Processing cancelled by fraud check',
      })
    ).toBe('fraud_declined');
  });

  it('returns auth_failed for 3DS cancellation (code 4018)', () => {
    expect(
      classifyPaymentError('failed', {
        code: 4018,
        message: '3D secure cancelled by issuing bank',
      })
    ).toBe('auth_failed');
  });

  it('returns auth_failed for 3DS-related error messages', () => {
    expect(
      classifyPaymentError('failed', {
        code: 5000,
        message: '3D Secure authentication failed',
      })
    ).toBe('auth_failed');
  });

  it('returns technical_error for issuer timeout (code 3045)', () => {
    expect(
      classifyPaymentError('failed', {
        code: 3045,
        message: 'Card issuer or network not available; Card issuer timed out',
      })
    ).toBe('technical_error');
  });

  it('returns technical_error for timeout messages', () => {
    expect(
      classifyPaymentError('failed', {
        code: 1234,
        message: 'Connection timed out',
      })
    ).toBe('technical_error');
  });

  it('returns card_declined for issuer signed off (code 3057)', () => {
    expect(
      classifyPaymentError('failed', {
        code: 3057,
        message: 'Issuer is Signed Off',
      })
    ).toBe('card_declined');
  });

  it('returns card_declined for insufficient funds', () => {
    expect(
      classifyPaymentError('failed', {
        code: 2000,
        message: 'Insufficient funds',
      })
    ).toBe('card_declined');
  });

  it('returns card_declined for do not honour', () => {
    expect(
      classifyPaymentError('failed', {
        code: 2001,
        message: 'Do not honour',
      })
    ).toBe('card_declined');
  });

  it('returns payment_failed for unknown error codes and messages', () => {
    expect(
      classifyPaymentError('failed', {
        code: 9999,
        message: 'Some unknown error',
      })
    ).toBe('payment_failed');
  });
});

import { describe, it, expect } from 'vitest';
import {
  EVERYPAY_NON_REFUNDABLE_ERROR_CODE,
  REFUND_BLOCKED_REASON_LABELS,
  blockedReasonForEveryPayCode,
  classifyRefundability,
  isApiRefundable,
} from './refundability';

describe('classifyRefundability', () => {
  it('treats card payments as gateway-refundable', () => {
    expect(classifyRefundability('card')).toEqual({ refundable: true });
  });

  it('treats wallet payments as gateway-refundable', () => {
    expect(classifyRefundability('wallet')).toEqual({ refundable: true });
  });

  it('treats bank_link as non-refundable — the open banking rail cannot be reversed', () => {
    expect(classifyRefundability('bank_link')).toEqual({
      refundable: false,
      reason: 'open_banking_not_refundable',
    });
  });

  it('routes an unrecognised method to manual review rather than assuming refundable', () => {
    expect(classifyRefundability('apple_pay')).toEqual({
      refundable: false,
      reason: 'unknown_payment_method',
    });
  });

  it('routes a null payment method to manual review', () => {
    expect(classifyRefundability(null)).toEqual({
      refundable: false,
      reason: 'unknown_payment_method',
    });
  });

  it('routes an undefined payment method to manual review', () => {
    expect(classifyRefundability(undefined)).toEqual({
      refundable: false,
      reason: 'unknown_payment_method',
    });
  });

  it('routes an empty string to manual review', () => {
    expect(classifyRefundability('')).toEqual({
      refundable: false,
      reason: 'unknown_payment_method',
    });
  });
});

describe('isApiRefundable', () => {
  it('is true only for card and wallet', () => {
    expect(isApiRefundable('card')).toBe(true);
    expect(isApiRefundable('wallet')).toBe(true);
    expect(isApiRefundable('bank_link')).toBe(false);
    expect(isApiRefundable('swed_ob_lv')).toBe(false);
    expect(isApiRefundable(null)).toBe(false);
  });
});

describe('blockedReasonForEveryPayCode', () => {
  it('maps 4037 to the open-banking block', () => {
    expect(blockedReasonForEveryPayCode(EVERYPAY_NON_REFUNDABLE_ERROR_CODE)).toBe(
      'open_banking_not_refundable'
    );
    expect(EVERYPAY_NON_REFUNDABLE_ERROR_CODE).toBe(4037);
  });

  it('leaves other codes as ordinary failures', () => {
    expect(blockedReasonForEveryPayCode(4000)).toBeNull();
    expect(blockedReasonForEveryPayCode(500)).toBeNull();
    expect(blockedReasonForEveryPayCode(null)).toBeNull();
    expect(blockedReasonForEveryPayCode(undefined)).toBeNull();
  });
});

describe('REFUND_BLOCKED_REASON_LABELS', () => {
  it('has a label for every blocked reason the classifier can produce', () => {
    const reasons = [
      classifyRefundability('bank_link'),
      classifyRefundability('apple_pay'),
    ];
    for (const verdict of reasons) {
      expect(verdict.refundable).toBe(false);
      if (!verdict.refundable) {
        expect(REFUND_BLOCKED_REASON_LABELS[verdict.reason]).toBeTruthy();
      }
    }
  });
});

import { describe, it, expect } from 'vitest';
import { generateOrderNumber } from './orders';

describe('generateOrderNumber', () => {
  it('matches format STG-YYYYMMDD-XXXX', () => {
    const orderNumber = generateOrderNumber();
    expect(orderNumber).toMatch(/^STG-\d{8}-[A-Z2-9]{4}$/);
  });

  it('uses current date', () => {
    const orderNumber = generateOrderNumber();
    const now = new Date();
    const expectedDate = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
    ].join('');
    expect(orderNumber).toContain(expectedDate);
  });

  it('does not contain ambiguous characters (I, O, 0, 1)', () => {
    for (let i = 0; i < 50; i++) {
      const orderNumber = generateOrderNumber();
      const randomPart = orderNumber.split('-')[2];
      expect(randomPart).not.toMatch(/[IO01]/);
    }
  });
});

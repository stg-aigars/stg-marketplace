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

  it('generates different numbers on consecutive calls', () => {
    const numbers = new Set<string>();
    for (let i = 0; i < 20; i++) {
      numbers.add(generateOrderNumber());
    }
    // With 4 chars from a 30-char alphabet, collision in 20 tries is extremely unlikely
    expect(numbers.size).toBe(20);
  });

  it('does not contain ambiguous characters (I, O, 0, 1)', () => {
    for (let i = 0; i < 50; i++) {
      const orderNumber = generateOrderNumber();
      const randomPart = orderNumber.split('-')[2];
      expect(randomPart).not.toMatch(/[IO01]/);
    }
  });
});

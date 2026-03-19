import { describe, it, expect } from 'vitest';
import { InsufficientBalanceError } from './wallet';

describe('InsufficientBalanceError', () => {
  it('includes requested and available amounts in message', () => {
    const error = new InsufficientBalanceError(5000, 3000);
    expect(error.message).toContain('5000');
    expect(error.message).toContain('3000');
    expect(error.name).toBe('InsufficientBalanceError');
  });

  it('is an instance of Error', () => {
    const error = new InsufficientBalanceError(100, 50);
    expect(error).toBeInstanceOf(Error);
  });
});

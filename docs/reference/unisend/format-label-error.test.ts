import { describe, it, expect } from 'vitest';
import { formatLabelError } from './format-label-error';
import { UnisendValidationError } from './types';

describe('formatLabelError', () => {
  it('formats single validation error with known field name', () => {
    const error = new UnisendValidationError('Validation failed', [
      { field: 'receiver.contacts.phone', error: 'INVALID', error_description: 'invalid format' },
    ]);
    expect(formatLabelError(error)).toBe(
      'Validation failed: Buyer phone number: invalid format'
    );
  });

  it('formats multiple validation errors joined by semicolons', () => {
    const error = new UnisendValidationError('Validation failed', [
      { field: 'receiver.contacts.phone', error: 'INVALID', error_description: 'invalid format' },
      { field: 'sender.name', error: 'REQUIRED', error_description: 'name is required' },
    ]);
    expect(formatLabelError(error)).toBe(
      'Validation failed: Buyer phone number: invalid format; Seller name: name is required'
    );
  });

  it('prefers error_description over error code when both present', () => {
    const error = new UnisendValidationError('Validation failed', [
      { field: 'receiver.name', error: 'ERR_CODE', error_description: 'Name is required' },
    ]);
    expect(formatLabelError(error)).toContain('Name is required');
    expect(formatLabelError(error)).not.toContain('ERR_CODE');
  });

  it('falls back to error code when error_description is absent', () => {
    const error = new UnisendValidationError('Validation failed', [
      { field: 'parcel.size', error: 'INVALID_SIZE' },
    ]);
    expect(formatLabelError(error)).toContain('INVALID_SIZE');
  });

  it('returns generic message for empty validation errors array', () => {
    const error = new UnisendValidationError('Validation failed', []);
    expect(formatLabelError(error)).toBe(
      'Validation failed - please check all shipping details'
    );
  });

  it('uses unknown field name as-is when not in FIELD_NAME_MAP', () => {
    const error = new UnisendValidationError('Validation failed', [
      { field: 'some.unknown.field', error: 'BAD' },
    ]);
    expect(formatLabelError(error)).toBe(
      'Validation failed: some.unknown.field: BAD'
    );
  });

  it('returns error.message for regular Error instances', () => {
    expect(formatLabelError(new Error('Network timeout'))).toBe('Network timeout');
  });

  it('returns generic message for non-Error values', () => {
    expect(formatLabelError('some string error')).toBe(
      'Unknown error generating shipping label'
    );
    expect(formatLabelError(null)).toBe(
      'Unknown error generating shipping label'
    );
    expect(formatLabelError(42)).toBe(
      'Unknown error generating shipping label'
    );
  });
});

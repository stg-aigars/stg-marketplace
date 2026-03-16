import { describe, it, expect } from 'vitest';
import {
  getUserFriendlyFieldName,
  getUserFriendlyErrorMessage,
  FIELD_NAME_MAP,
  ERROR_MESSAGES,
} from './types';

// ---------------------------------------------------------------------------
// getUserFriendlyFieldName
// ---------------------------------------------------------------------------

describe('getUserFriendlyFieldName', () => {
  it('maps receiver.contacts.phone to Buyer phone number', () => {
    expect(getUserFriendlyFieldName('receiver.contacts.phone')).toBe('Buyer phone number');
  });

  it('maps sender.contacts.phone to Seller phone number', () => {
    expect(getUserFriendlyFieldName('sender.contacts.phone')).toBe('Seller phone number');
  });

  it('maps parcel.size to Parcel size', () => {
    expect(getUserFriendlyFieldName('parcel.size')).toBe('Parcel size');
  });

  it('returns raw field string for unmapped fields', () => {
    expect(getUserFriendlyFieldName('some.unknown.field')).toBe('some.unknown.field');
  });

  it('has mappings for all expected Unisend fields', () => {
    const expectedFields = [
      'receiver.contacts.phone',
      'receiver.contacts.email',
      'receiver.name',
      'receiver.address.terminalId',
      'receiver.address.countryCode',
      'sender.contacts.phone',
      'sender.contacts.email',
      'sender.name',
      'sender.address.countryCode',
      'parcel.size',
      'parcel.type',
      'parcel.weight',
      'plan.code',
    ];
    for (const field of expectedFields) {
      expect(FIELD_NAME_MAP[field]).toBeDefined();
    }
  });
});

// ---------------------------------------------------------------------------
// getUserFriendlyErrorMessage
// ---------------------------------------------------------------------------

describe('getUserFriendlyErrorMessage', () => {
  it('maps TERMINAL_NOT_FOUND to user-friendly message', () => {
    expect(getUserFriendlyErrorMessage('TERMINAL_NOT_FOUND')).toBe(
      'Selected terminal is no longer available. Please choose another.'
    );
  });

  it('maps NETWORK_ERROR to user-friendly message', () => {
    expect(getUserFriendlyErrorMessage('NETWORK_ERROR')).toBe(
      'Connection error. Please check your internet and try again.'
    );
  });

  it('maps SERVICE_UNAVAILABLE to user-friendly message', () => {
    expect(getUserFriendlyErrorMessage('SERVICE_UNAVAILABLE')).toBe(
      'Shipping service temporarily unavailable. Please try again later.'
    );
  });

  it('returns raw error string for unmapped errors', () => {
    expect(getUserFriendlyErrorMessage('UNKNOWN_ERROR')).toBe('UNKNOWN_ERROR');
  });

  it('has mappings for all expected error codes', () => {
    const expectedCodes = [
      'INCORRECT_RECEIVER',
      'TERMINAL_NOT_FOUND',
      'UNAUTHORIZED',
      'SERVICE_UNAVAILABLE',
      'NETWORK_ERROR',
    ];
    for (const code of expectedCodes) {
      expect(ERROR_MESSAGES[code]).toBeDefined();
    }
  });
});

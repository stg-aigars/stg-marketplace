import { describe, it, expect } from 'vitest';

import { assertPayoutAllowed } from './compliance-gate';
import { PostingComplianceGateError } from './errors';
import type { CounterpartyComplianceStatus, CounterpartyRow } from './types';

function counterparty(status: CounterpartyComplianceStatus): CounterpartyRow {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    type: 'seller',
    user_id: null,
    full_name: 'Test',
    country: 'LV',
    tax_status: 'private',
    tin: null,
    vat_number: null,
    vies_verified_at: null,
    iban: null,
    iban_validated_at: null,
    legal_compliance_status: status,
    kyc_status: 'not_required',
    kyc_verified_at: null,
    vendor_code: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z'
  };
}

describe('assertPayoutAllowed', () => {
  describe('payout allowed', () => {
    it("passes for status='ok'", () => {
      expect(() => assertPayoutAllowed(counterparty('ok'))).not.toThrow();
    });

    it("passes for status='dormant' (not a compliance block — see plan §f)", () => {
      expect(() => assertPayoutAllowed(counterparty('dormant'))).not.toThrow();
    });
  });

  describe('payout blocked', () => {
    const blockedCases: Array<[CounterpartyComplianceStatus, string]> = [
      ['pending_kyc', 'kyc_gate'],
      ['dac7_blocked', 'dac7_blocked'],
      ['negative_wallet', 'negative_wallet'],
      ['suspended', 'suspended']
    ];

    for (const [status, expectedCode] of blockedCases) {
      it(`rejects status='${status}' with code='${expectedCode}'`, () => {
        try {
          assertPayoutAllowed(counterparty(status));
          throw new Error('should have thrown');
        } catch (e) {
          expect(e).toBeInstanceOf(PostingComplianceGateError);
          if (e instanceof PostingComplianceGateError) {
            expect(e.code).toBe(expectedCode);
            expect(e.reason).toContain(status);
            expect(e.context.counterparty_id).toBe('11111111-1111-4111-8111-111111111111');
            expect(e.context.status).toBe(status);
          }
        }
      });
    }
  });

  describe('null counterparty', () => {
    it('rejects with counterparty_not_found when null is passed', () => {
      try {
        assertPayoutAllowed(null);
        throw new Error('should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(PostingComplianceGateError);
        if (e instanceof PostingComplianceGateError) {
          expect(e.code).toBe('counterparty_not_found');
        }
      }
    });
  });
});

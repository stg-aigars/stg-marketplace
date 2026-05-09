import { describe, it, expect, vi } from 'vitest';

import { assertPayoutAllowed } from './compliance-gate';
import { PostingComplianceGateError } from './errors';
import type { CounterpartyComplianceStatus } from './types';

function makeMockSupabase(maybeSingleResult: { data: unknown; error: unknown }): {
  from: ReturnType<typeof vi.fn>;
} {
  const builder = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue(maybeSingleResult)
  };
  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  return { from: vi.fn().mockReturnValue(builder) };
}

describe('assertPayoutAllowed', () => {
  describe('payout allowed', () => {
    it("passes for status='ok'", async () => {
      const supabase = makeMockSupabase({ data: { legal_compliance_status: 'ok' }, error: null });
      await expect(assertPayoutAllowed(supabase as never, 'some-uuid')).resolves.toBeUndefined();
    });

    it("passes for status='dormant' (not a compliance block — see plan §f)", async () => {
      const supabase = makeMockSupabase({ data: { legal_compliance_status: 'dormant' }, error: null });
      await expect(assertPayoutAllowed(supabase as never, 'some-uuid')).resolves.toBeUndefined();
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
      it(`rejects status='${status}' with code='${expectedCode}'`, async () => {
        const supabase = makeMockSupabase({ data: { legal_compliance_status: status }, error: null });
        try {
          await assertPayoutAllowed(supabase as never, 'some-uuid');
          throw new Error('should have thrown');
        } catch (e) {
          expect(e).toBeInstanceOf(PostingComplianceGateError);
          if (e instanceof PostingComplianceGateError) {
            expect(e.code).toBe(expectedCode);
            expect(e.reason).toContain(status);
            expect(e.context.counterparty_id).toBe('some-uuid');
            expect(e.context.status).toBe(status);
          }
        }
      });
    }
  });

  describe('counterparty lookup failures', () => {
    it('rejects with counterparty_not_found when row missing', async () => {
      const supabase = makeMockSupabase({ data: null, error: null });
      try {
        await assertPayoutAllowed(supabase as never, 'missing-uuid');
        throw new Error('should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(PostingComplianceGateError);
        if (e instanceof PostingComplianceGateError) {
          expect(e.code).toBe('counterparty_not_found');
        }
      }
    });

    it('rejects with counterparty_not_found when supabase errors', async () => {
      const supabase = makeMockSupabase({ data: null, error: { message: 'connection lost' } });
      try {
        await assertPayoutAllowed(supabase as never, 'some-uuid');
        throw new Error('should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(PostingComplianceGateError);
        if (e instanceof PostingComplianceGateError) {
          expect(e.code).toBe('counterparty_not_found');
          expect(e.reason).toContain('connection lost');
        }
      }
    });
  });
});

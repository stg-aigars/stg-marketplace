/**
 * order-transitions.ts wrap-branch tests.
 *
 * Covers `creditSellerWallet`'s flag-check delegation:
 *   - Flag-OFF: byte-identical pre-PR-#5 behavior (calls creditWallet,
 *     stamps wallet_credited_at)
 *   - Flag-ON: delegates to `completeOrderWithGL` from
 *     `src/lib/accounting/lifecycle-wraps.ts` — does NOT call the legacy
 *     creditWallet path
 *
 * This test is intentionally narrow: it locks in the flag-check branch
 * contract. End-to-end coverage (counterparty resolution, RPC dispatch,
 * orphan-path telemetry) lands via integration tests in PR C.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/accounting/feature-flag', () => ({
  isAccountingEngineEnabled: vi.fn(() => false)
}));

vi.mock('@/lib/accounting/lifecycle-wraps', () => ({
  completeOrderWithGL: vi.fn(async () => ({
    wallet_txn_id: 'txn_uuid_test',
    journal_entry_id: 'je_uuid_test',
    orphan: false,
    idempotent_skip: false
  }))
}));

vi.mock('@/lib/services/wallet', () => ({
  creditWallet: vi.fn(async () => ({ id: 'txn_uuid_legacy' }))
}));

vi.mock('@/lib/supabase', () => ({
  createServiceClient: vi.fn(() => ({
    from: vi.fn(() => ({
      update: vi.fn(() => ({
        eq: vi.fn(async () => ({ data: null, error: null }))
      }))
    }))
  }))
}));

// Stub email + unisend transitively imported by order-transitions.ts at
// module load — both construct external clients in their top-level scope
// from env vars that aren't set in the unit test runner.
vi.mock('@/lib/email', () => ({
  sendOrderAcceptedToBuyer: vi.fn(),
  sendOrderShippedToBuyer: vi.fn(),
  sendOrderDeliveredToBuyer: vi.fn(),
  sendOrderDeliveredToSeller: vi.fn(),
  sendOrderCompletedToSeller: vi.fn(),
  sendOrderDeclinedToBuyer: vi.fn()
}));

vi.mock('@/lib/services/unisend/shipping', () => ({
  createOrderShipping: vi.fn(),
  cancelOrderShipment: vi.fn()
}));

import { isAccountingEngineEnabled } from '@/lib/accounting/feature-flag';
import { completeOrderWithGL } from '@/lib/accounting/lifecycle-wraps';
import { creditWallet } from '@/lib/services/wallet';
import type { OrderWithRelations } from '@/lib/orders/types';
import { creditSellerWallet } from './order-transitions';

type CreditSellerWalletOrder = Pick<
  OrderWithRelations,
  | 'seller_id'
  | 'seller_wallet_credit_cents'
  | 'listings'
  | 'order_number'
  | 'items_total_cents'
  | 'shipping_cost_cents'
  | 'seller_country'
  | 'cart_group_id'
>;

const orderFixture: CreditSellerWalletOrder = {
  seller_id: 'seller_uuid_test',
  seller_wallet_credit_cents: 9000,
  listings: { game_name: 'Test Game' } as OrderWithRelations['listings'],
  order_number: 'STG-2027-00001',
  items_total_cents: 10000,
  shipping_cost_cents: 500,
  seller_country: 'LV',
  cart_group_id: 'cart_uuid_test'
};

describe('creditSellerWallet — flag-branch contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('flag-OFF: calls legacy creditWallet, does NOT call completeOrderWithGL', async () => {
    vi.mocked(isAccountingEngineEnabled).mockReturnValue(false);
    await creditSellerWallet('order_uuid_test', orderFixture);
    expect(creditWallet).toHaveBeenCalledTimes(1);
    expect(completeOrderWithGL).not.toHaveBeenCalled();
  });

  it('flag-ON: calls completeOrderWithGL, does NOT call legacy creditWallet', async () => {
    vi.mocked(isAccountingEngineEnabled).mockReturnValue(true);
    await creditSellerWallet('order_uuid_test', orderFixture);
    expect(completeOrderWithGL).toHaveBeenCalledTimes(1);
    expect(completeOrderWithGL).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        id: 'order_uuid_test',
        seller_id: 'seller_uuid_test',
        seller_country: 'LV',
        items_total_cents: 10000,
        shipping_cost_cents: 500,
        order_number: 'STG-2027-00001',
        cart_group_id: 'cart_uuid_test'
      })
    );
    expect(creditWallet).not.toHaveBeenCalled();
  });

  it('skips both paths when seller_wallet_credit_cents is zero', async () => {
    vi.mocked(isAccountingEngineEnabled).mockReturnValue(true);
    await creditSellerWallet('order_uuid_test', { ...orderFixture, seller_wallet_credit_cents: 0 });
    expect(completeOrderWithGL).not.toHaveBeenCalled();
    expect(creditWallet).not.toHaveBeenCalled();
  });
});

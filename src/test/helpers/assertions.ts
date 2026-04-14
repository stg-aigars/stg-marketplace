import { expect } from 'vitest';
import { createTestServiceClient } from './supabase';

const supabase = createTestServiceClient();

export async function assertOrderStatus(orderId: string, expected: string) {
  const { data } = await supabase.from('orders').select('status').eq('id', orderId).single();
  expect(data?.status).toBe(expected);
}

export async function assertWalletBalance(userId: string, expectedCents: number) {
  const { data } = await supabase.from('wallets').select('balance_cents').eq('user_id', userId).single();
  expect(data?.balance_cents).toBe(expectedCents);
}

export async function assertTransactionExists(orderId: string, type: string) {
  const { data } = await supabase.from('wallet_transactions').select('id').eq('order_id', orderId).eq('type', type).single();
  expect(data).toBeTruthy();
}

export async function assertTransactionNotExists(orderId: string, type: string) {
  const { data } = await supabase.from('wallet_transactions').select('id').eq('order_id', orderId).eq('type', type).maybeSingle();
  expect(data).toBeNull();
}

export async function assertListingStatus(listingId: string, expected: string) {
  const { data } = await supabase.from('listings').select('status').eq('id', listingId).single();
  expect(data?.status).toBe(expected);
}

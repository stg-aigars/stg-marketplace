import { createTestServiceClient } from './supabase';
import type { OrderStatus, CancellationReason } from '@/lib/orders/types';
import type { ListingCondition, ListingStatus, ListingType } from '@/lib/listings/types';

const supabase = createTestServiceClient();

let userCounter = 0;

// ---------------------------------------------------------------------------
// Test user
// ---------------------------------------------------------------------------

interface CreateTestUserOptions {
  country?: string;
  fullName?: string;
}

interface TestUser {
  id: string;
  email: string;
  country: string;
  full_name: string;
}

export async function createTestUser(opts: CreateTestUserOptions = {}): Promise<TestUser> {
  userCounter++;
  const email = `test-${Date.now()}-${userCounter}@stg-test.local`;
  const fullName = opts.fullName ?? `Test User ${userCounter}`;
  const country = opts.country ?? 'LV';

  // Create auth user via Supabase Admin API
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { full_name: fullName, country },
  });

  if (authError || !authData.user) {
    throw new Error(`Failed to create test user: ${authError?.message}`);
  }

  const userId = authData.user.id;

  // The on_auth_user_created trigger should auto-create the profile.
  // Update it to ensure our values are set (trigger uses COALESCE defaults).
  const { error: profileError } = await supabase
    .from('user_profiles')
    .update({ full_name: fullName, email, country })
    .eq('id', userId);

  if (profileError) {
    throw new Error(`Failed to update test user profile: ${profileError.message}`);
  }

  return { id: userId, email, country, full_name: fullName };
}

// ---------------------------------------------------------------------------
// Test game (ensures FK target exists)
// ---------------------------------------------------------------------------

let gameCounter = 900000;

async function ensureTestGame(bggGameId?: number, gameName?: string): Promise<number> {
  const id = bggGameId ?? ++gameCounter;
  const name = gameName ?? `Test Game ${id}`;

  const { error } = await supabase
    .from('games')
    .upsert({ id, name, is_expansion: false }, { onConflict: 'id' });

  if (error) {
    throw new Error(`Failed to upsert test game: ${error.message}`);
  }

  return id;
}

// ---------------------------------------------------------------------------
// Test listing
// ---------------------------------------------------------------------------

interface CreateTestListingOptions {
  sellerId: string;
  priceCents?: number;
  country?: string;
  status?: ListingStatus;
  listingType?: ListingType;
  gameName?: string;
  condition?: ListingCondition;
  bggGameId?: number;
}

export async function createTestListing(opts: CreateTestListingOptions) {
  const bggGameId = await ensureTestGame(opts.bggGameId, opts.gameName);
  const gameName = opts.gameName ?? `Test Game ${bggGameId}`;

  const { data, error } = await supabase
    .from('listings')
    .insert({
      seller_id: opts.sellerId,
      bgg_game_id: bggGameId,
      game_name: gameName,
      condition: opts.condition ?? 'very_good',
      price_cents: opts.priceCents ?? 1500,
      status: opts.status ?? 'active',
      country: opts.country ?? 'LV',
      version_source: 'manual',
      listing_type: opts.listingType ?? 'fixed_price',
      photos: [],
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(`Failed to create test listing: ${error?.message}`);
  }

  return data;
}

// ---------------------------------------------------------------------------
// Test order
// ---------------------------------------------------------------------------

interface CreateTestOrderOptions {
  buyerId: string;
  sellerId: string;
  items: Array<{ listingId: string; priceCents: number }>;
  status?: OrderStatus;
  shippingCostCents?: number;
  createdAt?: string;
  acceptedAt?: string;
  shippedAt?: string;
  deliveredAt?: string;
  cancellationReason?: CancellationReason;
}

export async function createTestOrder(opts: CreateTestOrderOptions) {
  const shippingCostCents = opts.shippingCostCents ?? 350;
  const itemsTotalCents = opts.items.reduce((sum, i) => sum + i.priceCents, 0);
  const totalAmountCents = itemsTotalCents + shippingCostCents;
  const commissionCents = Math.round(itemsTotalCents * 0.1);
  const sellerCreditCents = itemsTotalCents - commissionCents;
  const orderNumber = `STG-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      order_number: orderNumber,
      buyer_id: opts.buyerId,
      seller_id: opts.sellerId,
      listing_id: opts.items[0].listingId,
      status: opts.status ?? 'pending_seller',
      total_amount_cents: totalAmountCents,
      items_total_cents: itemsTotalCents,
      shipping_cost_cents: shippingCostCents,
      seller_country: 'LV',
      platform_commission_cents: commissionCents,
      seller_wallet_credit_cents: sellerCreditCents,
      payment_method: 'card',
      item_count: opts.items.length,
      buyer_wallet_debit_cents: 0,
      cancellation_reason: opts.cancellationReason ?? null,
      created_at: opts.createdAt ?? undefined,
      accepted_at: opts.acceptedAt ?? undefined,
      shipped_at: opts.shippedAt ?? undefined,
      delivered_at: opts.deliveredAt ?? undefined,
    })
    .select()
    .single();

  if (orderError || !order) {
    throw new Error(`Failed to create test order: ${orderError?.message}`);
  }

  // Insert order_items
  const orderItems = opts.items.map((item) => ({
    order_id: order.id,
    listing_id: item.listingId,
    price_cents: item.priceCents,
  }));

  const { error: itemsError } = await supabase
    .from('order_items')
    .insert(orderItems);

  if (itemsError) {
    throw new Error(`Failed to create test order items: ${itemsError.message}`);
  }

  return order;
}

// ---------------------------------------------------------------------------
// Test wallet
// ---------------------------------------------------------------------------

interface CreateTestWalletOptions {
  userId: string;
  balanceCents?: number;
}

export async function createTestWallet(opts: CreateTestWalletOptions) {
  const { data, error } = await supabase
    .from('wallets')
    .insert({
      user_id: opts.userId,
      balance_cents: opts.balanceCents ?? 0,
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(`Failed to create test wallet: ${error?.message}`);
  }

  return data;
}

// ---------------------------------------------------------------------------
// Build variants (plain objects, no DB calls)
// ---------------------------------------------------------------------------

interface BuildTestListingOverrides {
  id?: string;
  sellerId?: string;
  priceCents?: number;
  country?: string;
  status?: ListingStatus;
  listingType?: ListingType;
  gameName?: string;
  condition?: ListingCondition;
  bggGameId?: number;
}

export function buildTestListing(overrides: BuildTestListingOverrides = {}) {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    seller_id: overrides.sellerId ?? crypto.randomUUID(),
    bgg_game_id: overrides.bggGameId ?? 999999,
    game_name: overrides.gameName ?? 'Test Game',
    game_year: null,
    condition: overrides.condition ?? 'very_good',
    price_cents: overrides.priceCents ?? 1500,
    status: overrides.status ?? 'active',
    country: overrides.country ?? 'LV',
    version_source: 'manual' as const,
    listing_type: overrides.listingType ?? 'fixed_price',
    photos: [],
    description: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

interface BuildTestOrderOverrides {
  id?: string;
  orderNumber?: string;
  buyerId?: string;
  sellerId?: string;
  listingId?: string;
  status?: OrderStatus;
  totalAmountCents?: number;
  itemsTotalCents?: number;
  shippingCostCents?: number;
  sellerCountry?: string;
  platformCommissionCents?: number;
  cancellationReason?: CancellationReason | null;
  createdAt?: string;
}

export function buildTestOrder(overrides: BuildTestOrderOverrides = {}) {
  const itemsTotal = overrides.itemsTotalCents ?? 1500;
  const shipping = overrides.shippingCostCents ?? 350;

  return {
    id: overrides.id ?? crypto.randomUUID(),
    order_number: overrides.orderNumber ?? `STG-TEST-${Date.now()}`,
    buyer_id: overrides.buyerId ?? crypto.randomUUID(),
    seller_id: overrides.sellerId ?? crypto.randomUUID(),
    listing_id: overrides.listingId ?? crypto.randomUUID(),
    status: overrides.status ?? 'pending_seller',
    total_amount_cents: overrides.totalAmountCents ?? itemsTotal + shipping,
    items_total_cents: itemsTotal,
    shipping_cost_cents: shipping,
    seller_country: overrides.sellerCountry ?? 'LV',
    platform_commission_cents: overrides.platformCommissionCents ?? Math.round(itemsTotal * 0.1),
    payment_method: 'card',
    buyer_wallet_debit_cents: 0,
    seller_wallet_credit_cents: itemsTotal - Math.round(itemsTotal * 0.1),
    cancellation_reason: overrides.cancellationReason ?? null,
    item_count: 1,
    created_at: overrides.createdAt ?? new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

/**
 * Cleans up test data in FK-safe order.
 * Only use with local Supabase — this deletes ALL data from these tables.
 */
export async function cleanupTestData() {
  // Delete auth users created during tests first (cascades to user_profiles)
  const { data: users } = await supabase.auth.admin.listUsers();
  if (users?.users) {
    for (const user of users.users) {
      if (user.email?.endsWith('@stg-test.local')) {
        await supabase.auth.admin.deleteUser(user.id);
      }
    }
  }

  // Delete remaining rows in reverse-dependency order (service role bypasses RLS).
  // Use gte/gt with min values to match all rows since supabase-js requires a filter for delete.
  await supabase.from('wallet_transactions').delete().gte('created_at', '1970-01-01');
  await supabase.from('wallets').delete().gte('created_at', '1970-01-01');
  await supabase.from('order_items').delete().gte('created_at', '1970-01-01');
  await supabase.from('orders').delete().gte('created_at', '1970-01-01');
  await supabase.from('listings').delete().gte('created_at', '1970-01-01');
  await supabase.from('user_profiles').delete().gte('created_at', '1970-01-01');
  await supabase.from('games').delete().gt('id', 0);
}

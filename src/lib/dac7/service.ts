/**
 * DAC7 service — stats tracking and threshold evaluation.
 * All writes use service client (bypasses RLS).
 */

import { createServiceClient } from '@/lib/supabase';
import {
  DAC7_WARN_TRANSACTIONS,
  DAC7_WARN_CONSIDERATION_CENTS,
  DAC7_REPORT_TRANSACTIONS,
  DAC7_REPORT_CONSIDERATION_CENTS,
} from './constants';
import type { Dac7SellerStatus, Dac7ProfileData, Dac7SellerAnnualStats } from './types';

/**
 * Update DAC7 stats after an order is completed.
 * Atomically increments transaction count and consideration for the current year.
 * Then checks if the seller crossed a threshold and escalates status if needed.
 *
 * Fire-and-forget from order completion — never blocks the main flow.
 */
export async function updateDac7StatsOnCompletion(
  sellerId: string,
  itemsTotalCents: number,
  commissionCents: number
): Promise<void> {
  const considerationCents = itemsTotalCents - commissionCents;
  const year = new Date().getFullYear();
  const supabase = createServiceClient();

  // Atomic upsert via Postgres RPC — ON CONFLICT increments in a single statement,
  // safe under concurrent order completions for the same seller.
  const { error: rpcError } = await supabase.rpc('upsert_dac7_seller_stats', {
    p_seller_id: sellerId,
    p_calendar_year: year,
    p_consideration_cents: considerationCents,
  });

  if (rpcError) {
    console.error('[DAC7] Failed to upsert stats:', rpcError);
  }

  // Check threshold crossing
  await evaluateAndEscalateStatus(sellerId);
}

/**
 * Evaluate a seller's DAC7 stats against thresholds and escalate status if needed.
 * Status only escalates, never downgrades (except at year-start reset in the cron).
 */
async function evaluateAndEscalateStatus(
  sellerId: string,
  preloadedStats?: { completed_transaction_count: number; total_consideration_cents: number }
): Promise<void> {
  const supabase = createServiceClient();
  const year = new Date().getFullYear();

  const stats = preloadedStats ?? await (async () => {
    const { data } = await supabase
      .from('dac7_seller_annual_stats')
      .select('completed_transaction_count, total_consideration_cents')
      .eq('seller_id', sellerId)
      .eq('calendar_year', year)
      .single();
    return data;
  })();

  if (!stats) return;

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('dac7_status')
    .eq('id', sellerId)
    .single<{ dac7_status: Dac7SellerStatus }>();

  if (!profile) return;

  const crossedRegulatory =
    stats.completed_transaction_count >= DAC7_REPORT_TRANSACTIONS ||
    stats.total_consideration_cents >= DAC7_REPORT_CONSIDERATION_CENTS;

  const crossedWarning =
    stats.completed_transaction_count >= DAC7_WARN_TRANSACTIONS ||
    stats.total_consideration_cents >= DAC7_WARN_CONSIDERATION_CENTS;

  const now = new Date().toISOString();

  // Check regulatory threshold first — a large order can jump past both thresholds at once.
  // Must be checked before warning threshold to avoid setting 'approaching' when 'data_requested' is correct.
  if (crossedRegulatory && (profile.dac7_status === 'not_applicable' || profile.dac7_status === 'approaching')) {
    await supabase
      .from('user_profiles')
      .update({
        dac7_status: 'data_requested',
        dac7_status_updated_at: now,
        dac7_first_reminder_sent_at: now,
      })
      .eq('id', sellerId);
    // Notification + email handled by cron to avoid inline import cycles
    return;
  }

  // Escalate: not_applicable → approaching (warning threshold crossed, no timer)
  if (crossedWarning && profile.dac7_status === 'not_applicable') {
    await supabase
      .from('user_profiles')
      .update({
        dac7_status: 'approaching',
        dac7_status_updated_at: now,
      })
      .eq('id', sellerId);
    return;
  }
}

/**
 * Get a seller's DAC7 profile data for the tax settings page.
 */
export async function getDac7Profile(userId: string): Promise<Dac7ProfileData | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('user_profiles')
    .select('dac7_date_of_birth, dac7_tax_id, dac7_tax_country, dac7_address, iban, dac7_status')
    .eq('id', userId)
    .single<Dac7ProfileData>();
  return data;
}

/**
 * Get a seller's annual stats for the current year.
 */
export async function getDac7Stats(
  userId: string,
  year?: number
): Promise<Dac7SellerAnnualStats | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('dac7_seller_annual_stats')
    .select('*')
    .eq('seller_id', userId)
    .eq('calendar_year', year ?? new Date().getFullYear())
    .single<Dac7SellerAnnualStats>();
  return data;
}

/**
 * Submit DAC7 data from the seller form.
 * Sets status to 'data_provided' regardless of current status (including 'blocked').
 */
export async function submitDac7Data(
  userId: string,
  data: {
    dateOfBirth: string;
    taxId: string;
    taxCountry: string;
    address: string;
    iban: string;
  }
): Promise<{ success: true } | { error: string }> {
  const supabase = createServiceClient();

  const { error } = await supabase
    .from('user_profiles')
    .update({
      dac7_date_of_birth: data.dateOfBirth,
      dac7_tax_id: data.taxId,
      dac7_tax_country: data.taxCountry,
      dac7_address: data.address,
      iban: data.iban,
      dac7_status: 'data_provided',
      dac7_status_updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  if (error) {
    console.error('[DAC7] Failed to save seller data:', error);
    return { error: 'Failed to save tax information' };
  }

  return { success: true };
}

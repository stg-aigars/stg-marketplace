/**
 * DAC7 annual report generation.
 * Collects data for all reportable sellers and builds report entries.
 */

import { createServiceClient } from '@/lib/supabase';
import {
  DAC7_REPORT_TRANSACTIONS,
  DAC7_REPORT_CONSIDERATION_CENTS,
} from './constants';
import type { Dac7ReportData, QuarterlyCents, QuarterlyCounts } from './types';

export interface ReportEntry {
  sellerId: string;
  sellerName: string;
  reportData: Dac7ReportData;
}

export interface IncompleteEntry {
  sellerId: string;
  sellerName: string;
  missingFields: string[];
}

export interface ReportResult {
  complete: ReportEntry[];
  incomplete: IncompleteEntry[];
}

const PLATFORM_INFO = {
  name: 'Second Turn Games',
  registered_name: 'SIA Second Turn Games',
  registration_number: '40203544396',
  address: 'Riga, Latvia',
  country: 'LV',
};

/**
 * Generate annual reports for all sellers crossing the regulatory threshold.
 */
export async function generateAnnualReports(year: number): Promise<ReportResult> {
  const supabase = createServiceClient();
  const result: ReportResult = { complete: [], incomplete: [] };

  // Find all sellers who crossed the regulatory threshold
  const { data: stats } = await supabase
    .from('dac7_seller_annual_stats')
    .select('seller_id, completed_transaction_count, total_consideration_cents')
    .eq('calendar_year', year)
    .or(
      `completed_transaction_count.gte.${DAC7_REPORT_TRANSACTIONS},total_consideration_cents.gte.${DAC7_REPORT_CONSIDERATION_CENTS}`
    );

  if (!stats || stats.length === 0) return result;

  // Fetch profile data for all reportable sellers
  const sellerIds = stats.map((s) => s.seller_id);
  const { data: profiles } = await supabase
    .from('user_profiles')
    .select('id, full_name, country, dac7_date_of_birth, dac7_tax_id, dac7_tax_country, dac7_address, iban')
    .in('id', sellerIds);

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

  // Fetch quarterly breakdowns
  const { data: orders } = await supabase
    .from('orders')
    .select('seller_id, items_total_cents, platform_commission_cents, completed_at')
    .eq('status', 'completed')
    .in('seller_id', sellerIds)
    .gte('completed_at', `${year}-01-01T00:00:00Z`)
    .lt('completed_at', `${year + 1}-01-01T00:00:00Z`);

  // Build quarterly data per seller
  const quarterlyData = new Map<string, {
    consideration: QuarterlyCents;
    fees: QuarterlyCents;
    transactions: QuarterlyCounts;
    totalFees: number;
  }>();

  for (const order of orders ?? []) {
    const q = getQuarter(order.completed_at);
    const consideration = order.items_total_cents - (order.platform_commission_cents ?? 0);
    const fees = order.platform_commission_cents ?? 0;

    if (!quarterlyData.has(order.seller_id)) {
      quarterlyData.set(order.seller_id, {
        consideration: { q1_cents: 0, q2_cents: 0, q3_cents: 0, q4_cents: 0 },
        fees: { q1_cents: 0, q2_cents: 0, q3_cents: 0, q4_cents: 0 },
        transactions: { q1_count: 0, q2_count: 0, q3_count: 0, q4_count: 0 },
        totalFees: 0,
      });
    }

    const data = quarterlyData.get(order.seller_id)!;
    const qKey = `q${q}_cents` as keyof QuarterlyCents;
    const tKey = `q${q}_count` as keyof QuarterlyCounts;
    data.consideration[qKey] += consideration;
    data.fees[qKey] += fees;
    data.transactions[tKey] += 1;
    data.totalFees += fees;
  }

  // Build reports
  const reportRows: Array<{ seller_id: string; calendar_year: number; report_data: Dac7ReportData; generated_at: string }> = [];
  for (const stat of stats) {
    const profile = profileMap.get(stat.seller_id);
    if (!profile) continue;

    // Check for incomplete data
    const missing: string[] = [];
    if (!profile.dac7_date_of_birth) missing.push('date_of_birth');
    if (!profile.dac7_tax_id) missing.push('tax_id');
    if (!profile.iban) missing.push('iban');

    if (missing.length > 0) {
      result.incomplete.push({
        sellerId: stat.seller_id,
        sellerName: profile.full_name ?? 'Unknown',
        missingFields: missing,
      });
      continue;
    }

    const quarterly = quarterlyData.get(stat.seller_id);
    const reportData: Dac7ReportData = {
      seller: {
        full_name: profile.full_name ?? '',
        date_of_birth: profile.dac7_date_of_birth,
        address: profile.dac7_address ?? '',
        country: profile.country ?? profile.dac7_tax_country ?? '',
        tax_identification_number: profile.dac7_tax_id,
        tax_country: profile.dac7_tax_country ?? profile.country ?? '',
        iban: profile.iban,
      },
      activity: {
        calendar_year: year,
        completed_transaction_count: stat.completed_transaction_count,
        total_consideration_cents: stat.total_consideration_cents,
        platform_fees_cents: quarterly?.totalFees ?? 0,
        consideration_by_quarter: quarterly?.consideration ?? { q1_cents: 0, q2_cents: 0, q3_cents: 0, q4_cents: 0 },
        fees_by_quarter: quarterly?.fees ?? { q1_cents: 0, q2_cents: 0, q3_cents: 0, q4_cents: 0 },
        transactions_by_quarter: quarterly?.transactions ?? { q1_count: 0, q2_count: 0, q3_count: 0, q4_count: 0 },
      },
      platform: PLATFORM_INFO,
    };

    result.complete.push({
      sellerId: stat.seller_id,
      sellerName: profile.full_name ?? 'Unknown',
      reportData,
    });

    reportRows.push({
      seller_id: stat.seller_id,
      calendar_year: year,
      report_data: reportData,
      generated_at: new Date().toISOString(),
    });
  }

  // Batch upsert all reports in one query
  if (reportRows.length > 0) {
    await supabase
      .from('dac7_annual_reports')
      .upsert(reportRows, { onConflict: 'seller_id,calendar_year' });
  }

  return result;
}

/**
 * Notify reportable sellers about their annual report.
 */
export async function notifyReportableSellers(year: number): Promise<number> {
  const supabase = createServiceClient();

  const { data: reports } = await supabase
    .from('dac7_annual_reports')
    .select('id, seller_id')
    .eq('calendar_year', year)
    .is('seller_notified_at', null);

  if (!reports || reports.length === 0) return 0;

  // Lazy import to avoid circular deps
  const { sendDac7ReportAvailable } = await import('@/lib/email');
  const { notify } = await import('@/lib/notifications');

  // Batch fetch all seller profiles in one query
  const sellerIds = reports.map((r) => r.seller_id);
  const { data: profiles } = await supabase
    .from('user_profiles')
    .select('id, full_name, email')
    .in('id', sellerIds);

  const profileMap = new Map(
    (profiles ?? []).map((p: { id: string; full_name: string | null; email: string | null }) => [p.id, p])
  );

  for (const report of reports) {
    const profile = profileMap.get(report.seller_id);

    if (profile?.email) {
      sendDac7ReportAvailable({
        sellerName: profile.full_name ?? 'Seller',
        sellerEmail: profile.email,
        year,
      }).catch((err) => console.error('[DAC7] Failed to send report email:', err));
    }

    void notify(report.seller_id, 'dac7.report_available');
  }

  // Batch mark all as notified
  const reportIds = reports.map((r) => r.id);
  await supabase
    .from('dac7_annual_reports')
    .update({ seller_notified_at: new Date().toISOString() })
    .in('id', reportIds);

  return reports.length;
}

/**
 * Mark all reports for a year as submitted to VID.
 */
export async function markReportsSubmitted(year: number): Promise<number> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('dac7_annual_reports')
    .update({ submitted_to_vid_at: new Date().toISOString() })
    .eq('calendar_year', year)
    .is('submitted_to_vid_at', null)
    .select('id');

  return data?.length ?? 0;
}

function getQuarter(dateStr: string): number {
  const month = new Date(dateStr).getMonth(); // 0-indexed
  return Math.floor(month / 3) + 1;
}

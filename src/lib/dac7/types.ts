/**
 * DAC7 (EU Directive 2021/514) types
 * Platform operator reporting obligations for seller income data.
 */

export type Dac7SellerStatus =
  | 'not_applicable'   // Below warning threshold
  | 'approaching'      // Crossed warning threshold (notification-only, no timer)
  | 'data_requested'   // Crossed regulatory threshold — 14-day reminder clock starts
  | 'reminder_sent'    // Second reminder sent — 14 days to comply or blocked
  | 'data_provided'    // Seller submitted required fields (persists across years)
  | 'blocked';         // Seller failed to provide data — new listings + withdrawals blocked

export interface Dac7SellerAnnualStats {
  seller_id: string;
  calendar_year: number;
  completed_transaction_count: number;
  /** Net of platform commission (items_total - commission), per DAC7 definition */
  total_consideration_cents: number;
  updated_at: string;
}

export interface Dac7AnnualReport {
  id: string;
  seller_id: string;
  calendar_year: number;
  report_data: Dac7ReportData;
  generated_at: string;
  seller_notified_at: string | null;
  submitted_to_vid_at: string | null;
}

export interface Dac7ReportData {
  seller: {
    full_name: string;
    date_of_birth: string; // ISO date
    address: string;
    country: string; // ISO 3166-1 alpha-2
    tax_identification_number: string;
    tax_country: string; // Country that issued the TIN
    iban: string;
  };
  activity: {
    calendar_year: number;
    completed_transaction_count: number;
    /** Net consideration (after commission), INTEGER CENTS */
    total_consideration_cents: number;
    /** Commission withheld by platform, INTEGER CENTS */
    platform_fees_cents: number;
    consideration_by_quarter: QuarterlyCents;
    fees_by_quarter: QuarterlyCents;
    transactions_by_quarter: QuarterlyCounts;
  };
  platform: {
    name: string;
    registered_name: string;
    registration_number: string;
    address: string;
    country: string;
  };
}

export interface QuarterlyCents {
  q1_cents: number;
  q2_cents: number;
  q3_cents: number;
  q4_cents: number;
}

export interface QuarterlyCounts {
  q1_count: number;
  q2_count: number;
  q3_count: number;
  q4_count: number;
}

/** DAC7 profile fields collected from the seller */
export interface Dac7ProfileData {
  dac7_date_of_birth: string | null;
  dac7_tax_id: string | null;
  dac7_tax_country: string | null;
  dac7_address: string | null;
  iban: string | null;
  dac7_status: Dac7SellerStatus;
}

/** Form submission payload */
export interface Dac7FormData {
  dateOfBirth: string;
  taxId: string;
  taxCountry: string;
  address: string;
  iban: string;
}

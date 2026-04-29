import type { CountryCode } from '@/lib/country-utils';
import type { Dac7SellerStatus } from '@/lib/dac7/types';

export type SellerStatus = 'active' | 'warned' | 'suspended';
export type VerificationResponseStored = 'collector' | 'trader' | 'unresponsive';

export interface UserProfile {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  country: CountryCode;
  preferred_locale: string;
  country_confirmed: boolean;
  is_staff: boolean;
  avatar_url: string | null;
  onboarding_dismissed_at: string | null;
  dac7_status: Dac7SellerStatus;
  seller_terms_accepted_at: string | null;
  seller_terms_version: string | null;
  // PTAC compliance — added in PR #214 (migrations 080–083)
  seller_status: SellerStatus;
  completed_sales_12mo_count: number;
  completed_sales_12mo_revenue_cents: number;
  trader_signal_first_crossed_at: string | null;
  trader_signal_threshold_version: string | null;
  trader_signal_dismissed_at: string | null;
  trader_signal_dismissed_threshold_version: string | null;
  verification_requested_at: string | null;
  verification_response: VerificationResponseStored | null;
  verification_responded_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuthActionResult {
  error?: string;
  success?: string;
}

export interface SignInFormData {
  email: string;
  password: string;
}

export interface SignUpFormData {
  email: string;
  password: string;
  displayName: string;
  country: CountryCode;
}

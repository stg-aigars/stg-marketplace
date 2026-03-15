import type { CountryCode } from '@/lib/country-utils';

export interface UserProfile {
  id: string;
  full_name: string | null;
  email: string | null;
  country: CountryCode;
  preferred_locale: string;
  is_staff: boolean;
  created_at: string;
  updated_at: string;
}

export interface AuthActionResult {
  error?: string;
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

import { createClient } from '@supabase/supabase-js';

const TEST_URL = process.env.SUPABASE_TEST_URL ?? 'http://127.0.0.1:54321';
const TEST_SERVICE_KEY = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY ?? '';
const TEST_ANON_KEY = process.env.SUPABASE_TEST_ANON_KEY ?? '';

export function createTestServiceClient() {
  return createClient(TEST_URL, TEST_SERVICE_KEY);
}

export function createTestAnonClient() {
  return createClient(TEST_URL, TEST_ANON_KEY);
}

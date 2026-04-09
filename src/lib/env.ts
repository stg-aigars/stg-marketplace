/**
 * Environment Variable Validation
 * Validates all required environment variables at build/runtime
 */

const serverEnvSchema = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,

  EVERYPAY_API_USERNAME: process.env.EVERYPAY_API_USERNAME,
  EVERYPAY_API_SECRET: process.env.EVERYPAY_API_SECRET,
  EVERYPAY_API_URL: process.env.EVERYPAY_API_URL,
  EVERYPAY_ACCOUNT_NAME: process.env.EVERYPAY_ACCOUNT_NAME,

  RESEND_API_KEY: process.env.RESEND_API_KEY,
  RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL,

  UNISEND_API_URL: process.env.UNISEND_API_URL,
  UNISEND_USERNAME: process.env.UNISEND_USERNAME,
  UNISEND_PASSWORD: process.env.UNISEND_PASSWORD,

  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  APP_ORIGIN: process.env.APP_ORIGIN,

  CRON_SECRET: process.env.CRON_SECRET,
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
  TURNSTILE_SECRET_KEY: process.env.TURNSTILE_SECRET_KEY,

  NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
  SENTRY_AUTH_TOKEN: process.env.SENTRY_AUTH_TOKEN,
  SENTRY_ORG: process.env.SENTRY_ORG,
  SENTRY_PROJECT: process.env.SENTRY_PROJECT,

  CLOUDFLARE_ZONE_ID: process.env.CLOUDFLARE_ZONE_ID,
  CLOUDFLARE_API_TOKEN: process.env.CLOUDFLARE_API_TOKEN,
} as const;

type EnvKey = keyof typeof serverEnvSchema;

interface ValidationResult {
  valid: boolean;
  missing: string[];
  warnings: string[];
}

export function validateEnv(): ValidationResult {
  const missing: string[] = [];
  const warnings: string[] = [];

  const required: EnvKey[] = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'EVERYPAY_API_USERNAME',
    'EVERYPAY_API_SECRET',
    'EVERYPAY_API_URL',
    'EVERYPAY_ACCOUNT_NAME',
    'RESEND_API_KEY',
    'RESEND_FROM_EMAIL',
    'UNISEND_API_URL',
    'UNISEND_USERNAME',
    'UNISEND_PASSWORD',
    'NEXT_PUBLIC_APP_URL',
  ];

  const requiredInProduction: EnvKey[] = ['CRON_SECRET'];
  const optional: EnvKey[] = [
    'APP_ORIGIN',
    'NEXT_PUBLIC_TURNSTILE_SITE_KEY',
    'TURNSTILE_SECRET_KEY',
    'NEXT_PUBLIC_SENTRY_DSN',
    'SENTRY_AUTH_TOKEN',
    'SENTRY_ORG',
    'SENTRY_PROJECT',
    'CLOUDFLARE_ZONE_ID',
    'CLOUDFLARE_API_TOKEN',
  ];

  const isProduction = process.env.NODE_ENV === 'production';

  for (const key of required) {
    if (!serverEnvSchema[key]) missing.push(key);
  }

  for (const key of requiredInProduction) {
    if (!serverEnvSchema[key]) {
      if (isProduction) missing.push(key);
      else warnings.push(`${key} not set (required in production)`);
    }
  }

  for (const key of optional) {
    if (!serverEnvSchema[key]) {
      warnings.push(`${key} not set (feature will be disabled)`);
    }
  }

  return { valid: missing.length === 0, missing, warnings };
}

export function assertEnv(): void {
  const result = validateEnv();
  if (result.warnings.length > 0) {
    console.warn('Environment Warnings:');
    result.warnings.forEach((w) => console.warn(`  - ${w}`));
  }
  if (!result.valid) {
    console.error('Missing required environment variables:');
    result.missing.forEach((k) => console.error(`  - ${k}`));
    throw new Error(`Missing required environment variables: ${result.missing.join(', ')}`);
  }
}

export const env = {
  supabase: {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  },
  everypay: {
    apiUsername: process.env.EVERYPAY_API_USERNAME!,
    apiSecret: process.env.EVERYPAY_API_SECRET!,
    apiUrl: process.env.EVERYPAY_API_URL!,
    accountName: process.env.EVERYPAY_ACCOUNT_NAME!,
  },
  resend: {
    apiKey: process.env.RESEND_API_KEY!,
    fromEmail: process.env.RESEND_FROM_EMAIL!,
    audienceId: process.env.RESEND_AUDIENCE_ID ?? '',
  },
  unisend: {
    apiUrl: process.env.UNISEND_API_URL!,
    username: process.env.UNISEND_USERNAME!,
    password: process.env.UNISEND_PASSWORD!,
  },
  app: {
    url: process.env.NEXT_PUBLIC_APP_URL!,
    origin: process.env.APP_ORIGIN,
    adminEmail: process.env.ADMIN_EMAIL,
  },
  cron: {
    secret: process.env.CRON_SECRET,
  },
  turnstile: {
    siteKey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
    secretKey: process.env.TURNSTILE_SECRET_KEY,
  },
  sentry: {
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    authToken: process.env.SENTRY_AUTH_TOKEN,
    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,
  },
  cloudflare: {
    zoneId: process.env.CLOUDFLARE_ZONE_ID,
    apiToken: process.env.CLOUDFLARE_API_TOKEN,
  },
} as const;

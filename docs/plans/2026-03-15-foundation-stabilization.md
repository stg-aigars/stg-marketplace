# Foundation Stabilization Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix all infrastructure gaps and wiring issues so that feature development can proceed on a stable foundation.

**Architecture:** Wire design tokens into Tailwind, create Supabase SSR client helpers, add auth middleware, build shared UI component library, add tests for existing pure functions, minimally configure next-intl, and clean up Create Next App boilerplate.

**Tech Stack:** Next.js 14 App Router, Tailwind CSS 3, Supabase SSR, next-intl, Vitest

---

### Task 1: Wire Design Tokens into Tailwind

**Files:**
- Modify: `tailwind.config.ts`
- Modify: `src/app/globals.css`

**Step 1: Update tailwind.config.ts to consume design tokens**

Replace the entire file with:

```ts
import type { Config } from "tailwindcss";
import { colors, borderRadius, shadows, typography } from "./src/styles/tokens";

const config: Config = {
  content: [
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        polar: {
          night: colors.polar.night,
          'night-light': colors.polar.nightLight,
          'night-medium': colors.polar.nightMedium,
          'night-dark': colors.polar.nightDark,
        },
        snow: {
          storm: colors.snow.storm,
          'storm-light': colors.snow.stormLight,
          'storm-lightest': colors.snow.stormLightest,
          white: colors.snow.white,
        },
        frost: {
          ice: colors.frost.ice,
          polar: colors.frost.polar,
          arctic: colors.frost.arctic,
          ocean: colors.frost.ocean,
        },
        aurora: {
          orange: colors.aurora.orange,
          green: colors.aurora.green,
          red: colors.aurora.red,
          yellow: colors.aurora.yellow,
          purple: colors.aurora.purple,
        },
        brand: {
          primary: colors.semantic.primary,
          'primary-hover': colors.semantic.primaryHover,
          'primary-active': colors.semantic.primaryActive,
        },
        trust: {
          DEFAULT: colors.semantic.trust,
          hover: colors.semantic.trustHover,
          active: colors.semantic.trustActive,
        },
        success: {
          DEFAULT: colors.semantic.success,
          hover: colors.semantic.successHover,
        },
        error: {
          DEFAULT: colors.semantic.error,
          hover: colors.semantic.errorHover,
        },
        warning: {
          DEFAULT: colors.semantic.warning,
          hover: colors.semantic.warningHover,
        },
        text: {
          heading: colors.semantic.textHeading,
          primary: colors.semantic.textPrimary,
          secondary: colors.semantic.textSecondary,
          muted: colors.semantic.textMuted,
          inverse: colors.semantic.textInverse,
        },
        bg: {
          primary: colors.semantic.bgPrimary,
          secondary: colors.semantic.bgSecondary,
          elevated: colors.semantic.bgElevated,
          overlay: colors.semantic.bgOverlay,
        },
        border: {
          subtle: colors.semantic.borderSubtle,
          DEFAULT: colors.semantic.borderDefault,
          strong: colors.semantic.borderStrong,
          focus: colors.semantic.borderFocus,
        },
        condition: {
          'like-new-bg': colors.condition.likeNew.bg,
          'like-new-text': colors.condition.likeNew.text,
          'like-new-border': colors.condition.likeNew.border,
          'very-good-bg': colors.condition.veryGood.bg,
          'very-good-text': colors.condition.veryGood.text,
          'very-good-border': colors.condition.veryGood.border,
          'good-bg': colors.condition.good.bg,
          'good-text': colors.condition.good.text,
          'good-border': colors.condition.good.border,
          'acceptable-bg': colors.condition.acceptable.bg,
          'acceptable-text': colors.condition.acceptable.text,
          'acceptable-border': colors.condition.acceptable.border,
          'for-parts-bg': colors.condition.forParts.bg,
          'for-parts-text': colors.condition.forParts.text,
          'for-parts-border': colors.condition.forParts.border,
        },
      },
      fontFamily: {
        sans: typography.fontFamily.primary.split(',').map(f => f.trim().replace(/"/g, '')),
      },
      borderRadius: {
        xs: borderRadius.xs,
        sm: borderRadius.sm,
        md: borderRadius.md,
        lg: borderRadius.lg,
        xl: borderRadius.xl,
        '2xl': borderRadius['2xl'],
        full: borderRadius.full,
      },
      boxShadow: {
        xs: shadows.xs,
        sm: shadows.sm,
        md: shadows.md,
        lg: shadows.lg,
        xl: shadows.xl,
        focus: shadows.focus,
      },
    },
  },
  plugins: [],
};
export default config;
```

**Step 2: Replace globals.css with Nordic theme variables**

Replace the entire file with:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  body {
    @apply bg-bg-primary text-text-primary;
    font-family: theme('fontFamily.sans');
  }
}
```

**Step 3: Verify it compiles**

Run: `pnpm build`
Expected: Build succeeds with no Tailwind errors.

**Step 4: Commit**

```bash
git add tailwind.config.ts src/app/globals.css
git commit -m "feat: wire design tokens into Tailwind config"
```

---

### Task 2: Create Supabase Client Helpers

**Files:**
- Create: `src/lib/supabase/client.ts` (browser client)
- Create: `src/lib/supabase/server.ts` (server client with cookie handling)
- Create: `src/lib/supabase/middleware.ts` (middleware client for session refresh)

**Step 1: Create browser client**

Create `src/lib/supabase/client.ts`:

```ts
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

**Step 2: Create server client**

Create `src/lib/supabase/server.ts`:

```ts
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // setAll called from Server Component — safe to ignore.
            // Session refresh is handled by middleware.
          }
        },
      },
    }
  );
}
```

**Step 3: Create middleware client**

Create `src/lib/supabase/middleware.ts`:

```ts
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session - do not remove this line
  await supabase.auth.getUser();

  return supabaseResponse;
}
```

**Step 4: Verify TypeScript compiles**

Run: `pnpm build`
Expected: No type errors.

**Step 5: Commit**

```bash
git add src/lib/supabase/
git commit -m "feat: add Supabase SSR client helpers (browser, server, middleware)"
```

---

### Task 3: Add Auth Middleware

**Files:**
- Create: `src/middleware.ts`

**Step 1: Create middleware**

Create `src/middleware.ts`:

```ts
import { type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico (browser icon)
     * - public assets (svg, png, jpg, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
```

**Step 2: Verify build**

Run: `pnpm build`
Expected: Build succeeds.

**Step 3: Commit**

```bash
git add src/middleware.ts
git commit -m "feat: add auth middleware for Supabase session refresh"
```

---

### Task 4: Add Vitest Configuration and Test Script

**Files:**
- Create: `vitest.config.ts`
- Modify: `package.json` (add `test` and `type-check` scripts)

**Step 1: Create vitest.config.ts**

```ts
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

**Step 2: Add test and type-check scripts to package.json**

Add to `scripts`:
```json
"test": "vitest run",
"test:watch": "vitest",
"type-check": "tsc --noEmit"
```

**Step 3: Verify vitest runs (no tests yet, should exit cleanly)**

Run: `pnpm test`
Expected: "No test files found" or clean exit.

**Step 4: Commit**

```bash
git add vitest.config.ts package.json
git commit -m "feat: add Vitest config and test/type-check scripts"
```

---

### Task 5: Add Tests for Pricing Service

**Files:**
- Create: `src/lib/services/pricing.test.ts`

**Step 1: Write tests**

```ts
import { describe, it, expect } from 'vitest';
import {
  calculateBuyerPricing,
  calculateSellerEarnings,
  calculateOrderPricing,
  calculateCheckoutPricing,
  formatPrice,
  formatCentsToEuros,
  formatCentsToCurrency,
  getVatRate,
  calculateVatSplit,
} from './pricing';

describe('calculateBuyerPricing', () => {
  it('sums item price and shipping', () => {
    const result = calculateBuyerPricing(2500, 350);
    expect(result).toEqual({
      itemsTotalCents: 2500,
      shippingCostCents: 350,
      totalChargeCents: 2850,
    });
  });

  it('handles zero shipping', () => {
    const result = calculateBuyerPricing(1000, 0);
    expect(result.totalChargeCents).toBe(1000);
  });
});

describe('calculateSellerEarnings', () => {
  it('takes 10% commission', () => {
    const result = calculateSellerEarnings(2500);
    expect(result.commissionCents).toBe(250);
    expect(result.walletCreditCents).toBe(2250);
  });

  it('rounds commission correctly', () => {
    const result = calculateSellerEarnings(1999);
    expect(result.commissionCents).toBe(200);
    expect(result.walletCreditCents).toBe(1799);
  });

  it('handles small amounts', () => {
    const result = calculateSellerEarnings(50);
    expect(result.commissionCents).toBe(5);
    expect(result.walletCreditCents).toBe(45);
  });
});

describe('calculateOrderPricing', () => {
  it('combines buyer and seller pricing', () => {
    const result = calculateOrderPricing(2500, 350);
    expect(result.totalChargeCents).toBe(2850);
    expect(result.walletCreditCents).toBe(2250);
    expect(result.commissionCents).toBe(250);
  });
});

describe('calculateCheckoutPricing', () => {
  it('applies wallet balance to reduce payment', () => {
    const result = calculateCheckoutPricing(2500, 350, 1000);
    expect(result.walletDebitCents).toBe(1000);
    expect(result.everypayChargeCents).toBe(1850);
  });

  it('caps wallet debit at total charge', () => {
    const result = calculateCheckoutPricing(2500, 350, 50000);
    expect(result.walletDebitCents).toBe(2850);
    expect(result.everypayChargeCents).toBe(0);
  });

  it('handles zero wallet balance', () => {
    const result = calculateCheckoutPricing(2500, 350, 0);
    expect(result.walletDebitCents).toBe(0);
    expect(result.everypayChargeCents).toBe(2850);
  });
});

describe('formatPrice', () => {
  it('formats euros with two decimals', () => {
    expect(formatPrice(25.5)).toBe('€25.50');
    expect(formatPrice(0)).toBe('€0.00');
    expect(formatPrice(100)).toBe('€100.00');
  });
});

describe('formatCentsToEuros', () => {
  it('converts cents to euros string', () => {
    expect(formatCentsToEuros(2550)).toBe('25.50');
    expect(formatCentsToEuros(0)).toBe('0.00');
    expect(formatCentsToEuros(99)).toBe('0.99');
  });
});

describe('formatCentsToCurrency', () => {
  it('converts cents to currency string', () => {
    expect(formatCentsToCurrency(2550)).toBe('€25.50');
    expect(formatCentsToCurrency(1299)).toBe('€12.99');
  });
});

describe('getVatRate', () => {
  it('returns correct VAT for Baltic countries', () => {
    expect(getVatRate('LV')).toBe(0.21);
    expect(getVatRate('LT')).toBe(0.21);
    expect(getVatRate('EE')).toBe(0.24);
  });

  it('is case-insensitive', () => {
    expect(getVatRate('lv')).toBe(0.21);
    expect(getVatRate('ee')).toBe(0.24);
  });

  it('returns default for null/undefined/unknown', () => {
    expect(getVatRate(null)).toBe(0.21);
    expect(getVatRate(undefined)).toBe(0.21);
    expect(getVatRate('DE')).toBe(0.21);
  });
});

describe('calculateVatSplit', () => {
  it('splits gross into net + VAT (LV 21%)', () => {
    const result = calculateVatSplit(1210, 0.21);
    expect(result.netCents).toBe(1000);
    expect(result.vatCents).toBe(210);
  });

  it('splits gross into net + VAT (EE 24%)', () => {
    const result = calculateVatSplit(1240, 0.24);
    expect(result.netCents).toBe(1000);
    expect(result.vatCents).toBe(240);
  });

  it('rounds correctly for non-clean splits', () => {
    const result = calculateVatSplit(999, 0.21);
    expect(result.netCents + result.vatCents).toBe(999);
  });
});
```

**Step 2: Run tests to verify they pass**

Run: `pnpm test`
Expected: All tests pass.

**Step 3: Commit**

```bash
git add src/lib/services/pricing.test.ts
git commit -m "test: add pricing service unit tests"
```

---

### Task 6: Add Tests for Date Utilities

**Files:**
- Create: `src/lib/date-utils.test.ts`

**Step 1: Write tests**

```ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  formatDate,
  formatDateShort,
  formatTime,
  formatDateTime,
  formatDateCompact,
  formatMessageTime,
} from './date-utils';

describe('formatDate', () => {
  it('formats as dd.MM.yyyy', () => {
    expect(formatDate(new Date(2026, 7, 31))).toBe('31.08.2026');
  });

  it('accepts string input', () => {
    expect(formatDate('2026-01-15T00:00:00')).toBe('15.01.2026');
  });

  it('accepts timestamp input', () => {
    const ts = new Date(2026, 0, 1).getTime();
    expect(formatDate(ts)).toBe('01.01.2026');
  });
});

describe('formatDateShort', () => {
  it('formats as dd.MM', () => {
    expect(formatDateShort(new Date(2026, 7, 31))).toBe('31.08');
  });
});

describe('formatTime', () => {
  it('formats as HH:mm by default', () => {
    expect(formatTime(new Date(2026, 0, 1, 14, 30))).toBe('14:30');
  });

  it('uses dot separator for Latvian locale', () => {
    expect(formatTime(new Date(2026, 0, 1, 14, 30), 'lv')).toBe('14.30');
  });

  it('uses colon for English locale', () => {
    expect(formatTime(new Date(2026, 0, 1, 9, 5), 'en')).toBe('09:05');
  });
});

describe('formatDateTime', () => {
  it('combines date and time', () => {
    expect(formatDateTime(new Date(2026, 7, 31, 14, 30))).toBe('31.08.2026 14:30');
  });

  it('uses Latvian time separator', () => {
    expect(formatDateTime(new Date(2026, 7, 31, 14, 30), 'lv')).toBe('31.08.2026 14.30');
  });
});

describe('formatDateCompact', () => {
  it('omits year for current year', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 15));
    expect(formatDateCompact(new Date(2026, 3, 10))).toBe('10.04');
    vi.useRealTimers();
  });

  it('includes year for past years', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 15));
    expect(formatDateCompact(new Date(2025, 3, 10))).toBe('10.04.2025');
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });
});

describe('formatMessageTime', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows time only for today', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 15, 16, 0));
    expect(formatMessageTime(new Date(2026, 5, 15, 14, 30))).toBe('14:30');
  });

  it('shows "Yesterday" for yesterday', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 15, 16, 0));
    expect(formatMessageTime(new Date(2026, 5, 14, 10, 0))).toBe('Yesterday, 10:00');
  });

  it('shows day name within 7 days', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 15, 16, 0)); // Monday
    const threeDaysAgo = new Date(2026, 5, 12, 10, 0); // Friday
    const result = formatMessageTime(threeDaysAgo);
    expect(result).toMatch(/^[A-Z][a-z]{2}, \d{2}:\d{2}$/);
  });

  it('shows date for older messages', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 15, 16, 0));
    expect(formatMessageTime(new Date(2026, 4, 1, 10, 0))).toBe('01.05 10:00');
  });

  it('respects Latvian locale', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 15, 16, 0));
    expect(formatMessageTime(new Date(2026, 5, 15, 14, 30), 'lv')).toBe('14.30');
  });
});
```

**Step 2: Run tests**

Run: `pnpm test`
Expected: All tests pass.

**Step 3: Commit**

```bash
git add src/lib/date-utils.test.ts
git commit -m "test: add date utilities unit tests"
```

---

### Task 7: Add Tests for Country Utilities

**Files:**
- Create: `src/lib/country-utils.test.ts`

**Step 1: Write tests**

```ts
import { describe, it, expect } from 'vitest';
import {
  getCountryFlag,
  getCountryName,
  getCountry,
  isValidCountryCode,
  COUNTRIES,
} from './country-utils';

describe('COUNTRIES', () => {
  it('has exactly 3 Baltic countries', () => {
    expect(COUNTRIES).toHaveLength(3);
    expect(COUNTRIES.map(c => c.code)).toEqual(['LV', 'EE', 'LT']);
  });
});

describe('getCountryFlag', () => {
  it('returns flag class for valid code', () => {
    expect(getCountryFlag('LV')).toBe('fi fi-lv');
    expect(getCountryFlag('EE')).toBe('fi fi-ee');
  });

  it('returns empty string for null/undefined', () => {
    expect(getCountryFlag(null)).toBe('');
    expect(getCountryFlag(undefined)).toBe('');
  });

  it('returns empty string for unknown code', () => {
    expect(getCountryFlag('DE')).toBe('');
  });
});

describe('getCountryName', () => {
  it('returns name for valid code', () => {
    expect(getCountryName('LV')).toBe('Latvia');
  });

  it('returns Unknown for null/undefined/invalid', () => {
    expect(getCountryName(null)).toBe('Unknown');
    expect(getCountryName('XX')).toBe('Unknown');
  });
});

describe('getCountry', () => {
  it('returns country object for valid code', () => {
    const country = getCountry('LT');
    expect(country).toEqual({ code: 'LT', name: 'Lithuania', flagClass: 'fi fi-lt' });
  });

  it('returns undefined for invalid code', () => {
    expect(getCountry('XX')).toBeUndefined();
    expect(getCountry(null)).toBeUndefined();
  });
});

describe('isValidCountryCode', () => {
  it('returns true for Baltic codes', () => {
    expect(isValidCountryCode('LV')).toBe(true);
    expect(isValidCountryCode('EE')).toBe(true);
    expect(isValidCountryCode('LT')).toBe(true);
  });

  it('returns false for non-Baltic codes', () => {
    expect(isValidCountryCode('DE')).toBe(false);
    expect(isValidCountryCode('US')).toBe(false);
  });
});
```

**Step 2: Run tests**

Run: `pnpm test`
Expected: All tests pass.

**Step 3: Commit**

```bash
git add src/lib/country-utils.test.ts
git commit -m "test: add country utilities unit tests"
```

---

### Task 8: Build Shared UI Components

**Files:**
- Create: `src/components/ui/button.tsx`
- Create: `src/components/ui/card.tsx`
- Create: `src/components/ui/input.tsx`
- Create: `src/components/ui/select.tsx`
- Create: `src/components/ui/modal.tsx`
- Create: `src/components/ui/badge.tsx`
- Create: `src/components/ui/index.ts`

**Step 1: Create Button component**

Create `src/components/ui/button.tsx`:

```tsx
import { forwardRef, type ButtonHTMLAttributes } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-brand-primary text-text-inverse hover:bg-brand-primary-hover active:bg-brand-primary-active disabled:opacity-50',
  secondary: 'bg-bg-elevated text-text-primary border border-border hover:border-border-strong hover:shadow-md disabled:opacity-50',
  ghost: 'text-text-secondary hover:bg-snow-storm-light active:bg-snow-storm disabled:opacity-50',
  danger: 'bg-error text-text-inverse hover:bg-error-hover disabled:opacity-50',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm rounded-sm',
  md: 'px-4 py-2 text-sm rounded-md',
  lg: 'px-6 py-3 text-base rounded-md',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading, disabled, className = '', children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={`inline-flex items-center justify-center font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-frost-ice focus-visible:ring-offset-2 ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
        {...props}
      >
        {loading ? (
          <>
            <svg className="mr-2 h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            {children}
          </>
        ) : (
          children
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';
```

**Step 2: Create Card component**

Create `src/components/ui/card.tsx`:

```tsx
import { type HTMLAttributes } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean;
}

export function Card({ hoverable, className = '', children, ...props }: CardProps) {
  return (
    <div
      className={`bg-bg-elevated rounded-lg border border-border shadow-sm ${hoverable ? 'transition-shadow hover:shadow-md' : ''} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className = '', children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`px-4 py-3 border-b border-border-subtle ${className}`} {...props}>
      {children}
    </div>
  );
}

export function CardBody({ className = '', children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`px-4 py-4 ${className}`} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({ className = '', children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`px-4 py-3 border-t border-border-subtle ${className}`} {...props}>
      {children}
    </div>
  );
}
```

**Step 3: Create Input component**

Create `src/components/ui/input.tsx`:

```tsx
'use client';

import { forwardRef, type InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, id, className = '', ...props }, ref) => {
    return (
      <div>
        {label && (
          <label htmlFor={id} className="block text-sm font-medium text-text-primary mb-1">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={id}
          className={`block w-full rounded-md border px-3 py-2 text-sm text-text-primary bg-bg-elevated placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-frost-ice focus:border-frost-ice ${error ? 'border-error' : 'border-border'} ${className}`}
          {...props}
        />
        {error && <p className="mt-1 text-sm text-error">{error}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';
```

**Step 4: Create Select component**

Create `src/components/ui/select.tsx`:

```tsx
'use client';

import { forwardRef, type SelectHTMLAttributes } from 'react';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, id, options, placeholder, className = '', ...props }, ref) => {
    return (
      <div>
        {label && (
          <label htmlFor={id} className="block text-sm font-medium text-text-primary mb-1">
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={id}
          className={`block w-full rounded-md border px-3 py-2 text-sm text-text-primary bg-bg-elevated focus:outline-none focus:ring-2 focus:ring-frost-ice focus:border-frost-ice ${error ? 'border-error' : 'border-border'} ${className}`}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {error && <p className="mt-1 text-sm text-error">{error}</p>}
      </div>
    );
  }
);

Select.displayName = 'Select';
```

**Step 5: Create Modal component**

Create `src/components/ui/modal.tsx`:

```tsx
'use client';

import { useEffect, useRef, type ReactNode } from 'react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

export function Modal({ open, onClose, title, children }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open) {
      dialog.showModal();
    } else {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleClose = () => onClose();
    dialog.addEventListener('close', handleClose);
    return () => dialog.removeEventListener('close', handleClose);
  }, [onClose]);

  return (
    <dialog
      ref={dialogRef}
      className="backdrop:bg-bg-overlay rounded-lg shadow-xl border border-border p-0 max-w-lg w-full"
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
    >
      <div className="bg-bg-elevated rounded-lg">
        {title && (
          <div className="px-6 py-4 border-b border-border-subtle flex items-center justify-between">
            <h2 className="text-lg font-semibold text-text-heading">{title}</h2>
            <button
              onClick={onClose}
              className="text-text-muted hover:text-text-primary transition-colors"
              aria-label="Close"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
        <div className="px-6 py-4">{children}</div>
      </div>
    </dialog>
  );
}
```

**Step 6: Create Badge component**

Create `src/components/ui/badge.tsx`:

```tsx
import { type HTMLAttributes } from 'react';
import type { conditionConfig } from '@/lib/condition-config';

type ConditionKey = keyof typeof import('@/lib/condition-config').conditionConfig;

type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'trust';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  condition?: ConditionKey;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-snow-storm-light text-text-secondary border-snow-storm',
  success: 'bg-condition-like-new-bg text-condition-like-new-text border-condition-like-new-border',
  warning: 'bg-condition-good-bg text-condition-good-text border-condition-good-border',
  error: 'bg-condition-for-parts-bg text-condition-for-parts-text border-condition-for-parts-border',
  trust: 'bg-frost-ice/10 text-frost-arctic border-frost-ice',
};

const conditionClasses: Record<ConditionKey, string> = {
  likeNew: 'bg-condition-like-new-bg text-condition-like-new-text border-condition-like-new-border',
  veryGood: 'bg-condition-very-good-bg text-condition-very-good-text border-condition-very-good-border',
  good: 'bg-condition-good-bg text-condition-good-text border-condition-good-border',
  acceptable: 'bg-condition-acceptable-bg text-condition-acceptable-text border-condition-acceptable-border',
  forParts: 'bg-condition-for-parts-bg text-condition-for-parts-text border-condition-for-parts-border',
};

export function Badge({ variant = 'default', condition, className = '', children, ...props }: BadgeProps) {
  const classes = condition ? conditionClasses[condition] : variantClasses[variant];

  return (
    <span
      className={`inline-flex items-center rounded-2xl border px-2.5 py-0.5 text-xs font-medium ${classes} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
}
```

**Step 7: Create barrel export**

Create `src/components/ui/index.ts`:

```ts
export { Button } from './button';
export { Card, CardHeader, CardBody, CardFooter } from './card';
export { Input } from './input';
export { Select } from './select';
export { Modal } from './modal';
export { Badge } from './badge';
```

**Step 8: Verify build**

Run: `pnpm build`
Expected: Build succeeds with no type errors.

**Step 9: Commit**

```bash
git add src/components/
git commit -m "feat: add shared UI component library (Button, Card, Input, Select, Modal, Badge)"
```

---

### Task 9: Minimal next-intl Configuration

**Files:**
- Create: `src/i18n/request.ts`
- Create: `src/i18n/routing.ts`
- Create: `src/messages/en.json`

**Step 1: Create routing config**

Create `src/i18n/routing.ts`:

```ts
import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['en'],
  defaultLocale: 'en',
});
```

**Step 2: Create request config**

Create `src/i18n/request.ts`:

```ts
import { getRequestConfig } from 'next-intl/server';
import { routing } from './routing';

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;

  // Validate locale, fallback to default
  if (!locale || !routing.locales.includes(locale as 'en')) {
    locale = routing.defaultLocale;
  }

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
```

**Step 3: Create English messages file**

Create `src/messages/en.json`:

```json
{
  "common": {
    "appName": "Second Turn Games",
    "tagline": "Every game deserves a second turn",
    "loading": "Loading...",
    "error": "Something went wrong",
    "save": "Save",
    "cancel": "Cancel",
    "confirm": "Confirm",
    "back": "Back",
    "search": "Search",
    "noResults": "No results found"
  },
  "nav": {
    "browse": "Browse",
    "sell": "Sell a game",
    "messages": "Messages",
    "profile": "Profile",
    "signIn": "Sign in",
    "signOut": "Sign out"
  },
  "listing": {
    "condition": "Condition",
    "price": "Price",
    "shipping": "Shipping",
    "seller": "Seller",
    "addToCart": "Buy now",
    "preLovedGames": "Pre-loved games"
  }
}
```

**Step 4: Add next-intl plugin to next.config.mjs**

Replace `next.config.mjs`:

```mjs
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {};

export default withNextIntl(nextConfig);
```

**Step 5: Verify build**

Run: `pnpm build`
Expected: Build succeeds.

**Step 6: Commit**

```bash
git add src/i18n/ src/messages/ next.config.mjs
git commit -m "feat: configure next-intl with English locale"
```

---

### Task 10: Clean Up Boilerplate

**Files:**
- Modify: `src/app/layout.tsx`
- Modify: `src/app/page.tsx`

**Step 1: Update root layout**

Replace `src/app/layout.tsx`:

```tsx
import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Second Turn Games',
    template: '%s | Second Turn Games',
  },
  description: 'Every game deserves a second turn. Pre-loved board games marketplace for the Baltic region.',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <body className="min-h-screen antialiased">
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
```

**Step 2: Replace homepage with placeholder**

Replace `src/app/page.tsx`:

```tsx
export default function Home() {
  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      <h1 className="text-2xl sm:text-3xl font-bold text-text-heading">
        Second Turn Games
      </h1>
      <p className="mt-2 text-text-secondary">
        Every game deserves a second turn. Pre-loved board games for the Baltic region.
      </p>
    </main>
  );
}
```

**Step 3: Delete unused font files**

Remove `src/app/fonts/` directory (Geist fonts replaced by system Inter via Tailwind).

**Step 4: Verify build**

Run: `pnpm build`
Expected: Build succeeds. Homepage renders with Nordic styling.

**Step 5: Commit**

```bash
git add -A src/app/
git commit -m "feat: replace Create Next App boilerplate with STG branding"
```

---

## Summary

| Task | What | Why |
|------|------|-----|
| 1 | Wire design tokens → Tailwind | All UI needs correct colors |
| 2 | Supabase client helpers | All data fetching depends on this |
| 3 | Auth middleware | Session refresh breaks without it |
| 4 | Vitest config + scripts | Testing infrastructure |
| 5 | Pricing tests | Safety net for core business logic |
| 6 | Date utils tests | Safety net for display logic |
| 7 | Country utils tests | Safety net for market logic |
| 8 | Shared UI components | Every page needs these |
| 9 | next-intl config | Avoid string rework later |
| 10 | Clean up boilerplate | Professional starting point |

After all 10 tasks: the codebase is ready for feature development (browse, listing creation, checkout).

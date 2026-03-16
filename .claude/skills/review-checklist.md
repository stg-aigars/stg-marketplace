---
name: review-checklist
description: Pre-commit quality checklist for STG-specific standards — brand voice, layout, dates, prices, RLS
---

# Pre-Commit Review Checklist

Run through this checklist before committing changes.

## Brand Voice
- [ ] "Pre-loved" not "used" or "secondhand"
- [ ] No exclamation marks in UI copy
- [ ] Tone is welcoming, straightforward, not salesy

## Design Tokens
- [ ] No hardcoded hex colors — use Tailwind token classes (`bg-aurora-orange`, `text-frost-ice`)
- [ ] Layout follows standards: `max-w-7xl mx-auto px-4 sm:px-6` for pages
- [ ] Shadows follow scale: `shadow-sm` → `shadow-md` → `shadow-lg` → `shadow-xl`
- [ ] Borders: `border` (1px default), `border-2` only for selected/active states

## Date & Time
- [ ] All dates use `lib/date-utils` (`formatDate`, `formatDateShort`, `formatTime`, `formatDateTime`)
- [ ] No `toLocaleDateString()`, `toLocaleTimeString()`, or `toLocaleString()`
- [ ] No AM/PM — 24-hour time only
- [ ] Time functions pass `locale` parameter in components

## Money & Pricing
- [ ] All monetary values as integer cents (1299 not 12.99)
- [ ] Display formatting via `formatPrice()` or `formatCentsToCurrency()`
- [ ] Commission: 10% on items only, never on shipping
- [ ] VAT by seller's country (LV=21%, LT=21%, EE=24%)

## Components
- [ ] Using shared components from `@/components/ui` — not writing inline equivalents
- [ ] Server Components by default; `'use client'` only when needed
- [ ] Existing utilities reused (not reinvented)

## Security
- [ ] No service role key exposed to client
- [ ] Supabase cookies: `getAll()`/`setAll()`, never `get()`/`set()`
- [ ] New tables have appropriate RLS policies
- [ ] Input validation on API boundaries

## Build Gate
- [ ] `pnpm build` passes (not just `pnpm type-check`)
- [ ] No unused imports or variables
- [ ] Translations complete for all active locales

---
name: build-feature
description: Workflow for implementing a new feature — loads relevant memory files based on feature area, then plans and implements
---

# Build Feature

When starting a new feature, load the right context before planning.

## Step 1: Identify Feature Area

Based on what the user wants to build, read the relevant memory files:

| Feature Area | Memory Files to Read |
|-------------|---------------------|
| **Auth / signup / login** | `memory/auth_architecture.md` |
| **Listing creation / sell flow** | `memory/ui_flows.md`, `memory/design_tokens.md` |
| **Browse / search / filters** | `memory/ui_flows.md`, `memory/design_tokens.md` |
| **Checkout / payments** | `memory/payment_architecture.md`, `memory/shipping_model.md`, `memory/ui_flows.md` |
| **Orders / tracking** | `memory/ui_flows.md`, `memory/payment_architecture.md` |
| **Wallet / withdrawals** | `memory/payment_architecture.md` |
| **Reviews / trust** | `memory/ui_flows.md` |
| **Disputes / refunds** | `memory/payment_architecture.md`, `memory/security_patterns.md` |
| **Shipping / terminals** | `memory/shipping_model.md` |
| **Translations / i18n** | `memory/i18n_patterns.md` |
| **Design / UI components** | `memory/design_tokens.md` |
| **Security / RLS** | `memory/security_patterns.md`, `memory/db_patterns.md` |
| **Database / migrations** | `memory/db_patterns.md`, `memory/security_patterns.md` |
| **Deployment** | `memory/deployment.md` |
| **Email templates** | `memory/brand_voice.md` |

Read 1-3 memory files relevant to the feature. Skip files you don't need.

## Step 2: Check Weekly Plan

Read `memory/weekly_plan.md` to understand where this feature fits in the rollout and what dependencies exist.

## Step 3: Plan

Use `/plan` to design the implementation. The plan should reference:
- Existing components from CLAUDE.md's Shared Components table
- Patterns from the memory files you loaded
- Database tables from `memory/db_patterns.md` if data layer is involved

## Step 4: Implement

Build the feature following the plan. Key rules (from CLAUDE.md):
- Server Components by default, `'use client'` only when needed
- Integer cents for all money
- `lib/date-utils` for all dates
- Design token classes, never hex values
- `getAll()`/`setAll()` for Supabase cookies

## Step 5: Verify

- `pnpm build` passes (the real gate)
- No hardcoded hex colors
- No `toLocaleDateString()` or AM/PM
- Brand voice: "pre-loved" not "used", no exclamation marks

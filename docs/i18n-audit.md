# i18n Audit: Hardcoded English Strings

> **Purpose:** Track all files with hardcoded English UI strings for Week 3 Latvian locale work.
> **Do NOT convert these to translation keys yet.** This document scopes the i18n effort.

---

## Summary

| Category | Files | Approx. Strings |
|----------|-------|-----------------|
| Order constants & config | 2 | 23 |
| Checkout flow | 2 | 23 |
| Order display & actions | 4 | 40 |
| Auth forms | 6 | 27 |
| Browse & listing display | 2 | 18 |
| Navigation & layout | 2 | 12 |
| Listing creation (sell) | 7 | 50 |
| Account & orders list | 3 | 12 |
| **Total** | **28 files** | **~205 strings** |

---

## Files by Category

### Order & Condition Config

- `src/lib/orders/constants.ts` — 8 status labels ("Awaiting seller", "Accepted", etc.) + 5 timeline step labels
- `src/lib/condition-config.ts` — 5 condition labels + 5 condition descriptions

### Checkout Flow

- `src/app/[locale]/checkout/[listingId]/page.tsx` — 11 error messages, section headings, unavailability messages
- `src/app/[locale]/checkout/[listingId]/CheckoutForm.tsx` — form labels, placeholder, button text, helper text

### Order Management

- `src/components/orders/OrderDetailClient.tsx` — ~20 strings: status context messages (buyer/seller views), breadcrumb, section headings, price labels
- `src/components/orders/OrderActions.tsx` — button labels, modal title/body, phone field label, error messages
- `src/components/orders/OrderTimeline.tsx` — "Cancelled", "Disputed" labels
- `src/components/orders/ShippingInfo.tsx` — section heading, field labels, copy button, track link, seller instructions

### Authentication

- `src/app/[locale]/auth/_components/SignInForm.tsx` — divider text, form labels, links, button
- `src/app/[locale]/auth/_components/SignUpForm.tsx` — form labels, placeholder, helper text, validation messages, button
- `src/app/[locale]/auth/_components/ForgotPasswordForm.tsx` — form label, button, success message, link
- `src/app/[locale]/auth/_components/OAuthButton.tsx` — "Continue with Google"
- `src/app/[locale]/auth/_components/CompleteProfileForm.tsx` — form labels, helper text, button, validation
- `src/app/[locale]/auth/_components/UpdatePasswordForm.tsx` — form labels, button, validation messages

### Browse & Listing Display

- `src/app/[locale]/browse/page.tsx` — page heading, empty state, pagination text
- `src/app/[locale]/listings/[id]/page.tsx` — breadcrumb, unavailable state, button labels, section headings, edition/seller labels

### Navigation & Layout

- `src/components/layout/SiteHeader.tsx` — site name, nav links, auth links, dropdown items
- `src/components/layout/SiteFooter.tsx` — copyright, footer links

### Listing Creation (Sell Flow)

- `src/app/[locale]/sell/page.tsx` — page heading
- `src/app/[locale]/sell/_components/ListingCreationFlow.tsx` — step labels, progress text, buttons
- `src/app/[locale]/sell/_components/GameSearchStep.tsx` — headings, placeholder, states, button
- `src/app/[locale]/sell/_components/VersionStep.tsx` — headings, form labels, placeholders, buttons, helper text
- `src/app/[locale]/sell/_components/PhotoUploadStep.tsx` — headings, helper text, upload states, errors
- `src/app/[locale]/sell/_components/ConditionStep.tsx` — heading, helper text, modal content
- `src/app/[locale]/sell/_components/PriceStep.tsx` — heading, form labels, placeholder, earnings text, error
- `src/app/[locale]/sell/_components/ReviewStep.tsx` — heading, labels, button, info text

### Account

- `src/app/[locale]/account/page.tsx` — page heading, profile labels, quick links
- `src/app/[locale]/account/orders/page.tsx` — page heading
- `src/app/[locale]/account/orders/OrderTabs.tsx` — tab labels, empty states

---

## Suggested next-intl Key Namespaces

```
orders.status.*     — Order status labels
orders.messages.*   — Status context messages (buyer/seller views)
conditions.*        — Game condition labels & descriptions
checkout.*          — Checkout flow copy
auth.*              — Authentication form text
browse.*            — Browse & listing display
sell.*              — Listing creation steps
account.*           — Account profile & orders
nav.*               — Navigation, header, footer
errors.*            — Shared error messages
common.*            — Shared UI text (buttons, labels)
```

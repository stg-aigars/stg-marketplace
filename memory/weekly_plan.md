---
name: Weekly Feature Rollout
description: Week-by-week feature plan from MVP launch through Week 8+, with dependencies
type: project
---

## Principle

Ship one visible feature per week. Users see progress. Each week builds on the last.

## Schedule

### Week 0 — Core MVP
Auth, list with BGG search, browse, buy, EveryPay payments, Unisend shipping, order tracking. All three countries. Seed 10-20 listings yourself. Basic SEO + legal pages. Invite 5-10 beta testers per country.

### Week 1 — Polish the Core
Fix beta bugs. Better empty states. Email templates (order confirmation, seller notification, shipped). Mobile responsiveness fixes.

### Week 2 — Better Listings ✓
Enhanced BGG data (weight, categories, mechanics). Drag-and-drop photo upload with reorder. Condition grading guide modal. Sentry setup. Image optimization.

### Week 3 — Discovery + Communication ✓
Browse filters (condition, price, player count, country, sort). In-app messaging V1 (with email notifications, 30s polling). Saved/favorite listings. ~~Cart for multi-item checkout~~ (deferred to Week 8+). ~~Map-based terminal selector~~ (deferred). **Latvian locale deferred** (UI copy still stabilizing).

### Week 4 — Trust + Notifications ✓
Reviews system (thumbs up/down). Seller ratings + public seller profiles. Reservation timer (30 min lock). ~~In-app notifications~~ (→ Week 6). ~~Cloudflare Turnstile~~ (→ Week 8+). ~~Onboarding checklist~~ (→ Week 8+).

### Week 5 — Wallet + Financial Infrastructure
Wallet system + transaction history. Escrow (2-day dispute window). Wallet checkout. Withdrawal requests. Staff dashboard. VAT tracking.

### Week 6 — Trust + Safety
Dispute system. Refund flow. In-app notifications. Seller trust badges. Newsletter. Help center. Account settings + GDPR.

### Week 7 — Wanted + Social
Wanted listings. Seller offers on wanted. Public seller profiles. Social sharing.

### Week 8+ — Growth
Cloudflare Turnstile. Onboarding checklist. Auctions. PWA. Achievements. Price suggestions. Advanced search. Multi-seller cart. Shipping tracking. Seller analytics. Estonian + Lithuanian locales.

## Dependencies

- Week 3 messaging requires auth (Week 0) + notification infrastructure
- Week 4 reviews require completed orders (Week 0 order lifecycle)
- Week 5 wallet requires order completion flow (Week 0) + dispute window concept
- Week 6 disputes require wallet (Week 5) for refund mechanics
- Latvian locale (Week 3) should wait until UI copy stabilizes (post-Week 2)
- Week 6 in-app notifications benefit from dispute/refund events as notification triggers

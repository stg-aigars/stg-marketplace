---
name: Reservation timer and future cart
description: When multi-seller cart ships (Week 8+), reservation trigger moves from checkout initiation to cart add
type: project
---

Reservation timer (Week 4) reserves listings at checkout initiation (`payments/create`).

When multi-seller cart ships (Week 8+), the reservation trigger should move from "start checkout" to "add to cart." The underlying mechanics (`reserved_at`, `reserved_by`, cron expiry, `expire_stale_reservations()`) are reusable — only the trigger point changes.

**Why:** Buyers expect items in their cart to be held for them, not just during payment.

**How to apply:** When implementing cart, move the reservation logic from `src/app/api/payments/create/route.ts` to the cart add endpoint. Consider whether adding a new item should refresh timers on all cart items.

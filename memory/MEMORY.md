# STG Project Memory

## Architecture
- [db_patterns.md](db_patterns.md) - Supabase migration pitfalls, RLS, cookie handling, games table
- [payment_architecture.md](payment_architecture.md) - EveryPay + wallet integration, refund rules, invoicing
- [auth_architecture.md](auth_architecture.md) - OAuth flow, cookie handling, middleware, auth helpers, provider stack
- [security_patterns.md](security_patterns.md) - RLS policies, service role, security headers, env vars

## Features & Flows
- [ui_flows.md](ui_flows.md) - Browse, sell/create listing, checkout, order lifecycle
- [shipping_model.md](shipping_model.md) - Unisend parcel lockers, route-based pricing, Baltic cross-border
- [shipping_architecture.md](shipping_architecture.md) - Unisend implementation: price matrix, terminal API, label gen, tracking sync
- [listing_creation.md](listing_creation.md) - Listing creation feature status, code review findings, deferred items

## Design & Localization
- [design_tokens.md](design_tokens.md) - Nordic color palette, layout standards, component inventory
- [i18n_patterns.md](i18n_patterns.md) - next-intl setup, locale strategy, message files, date/time rules
- [brand_voice.md](brand_voice.md) - Brand guidelines, tone, terminology

## Planning
- [weekly_plan.md](weekly_plan.md) - Week-by-week feature rollout plan with dependencies
- [deployment.md](deployment.md) - Hetzner VPS + Coolify deployment, staging→main, pre-deploy gate, rollback
- [reservation_cart_note.md](reservation_cart_note.md) - When cart ships, move reservation trigger from checkout to cart add

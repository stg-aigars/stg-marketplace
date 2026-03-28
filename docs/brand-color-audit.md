# Brand Color Audit — Frost/Orange Migration

## Summary
- `semantic-primary` (orange) is overloaded: purchase CTAs + navigation/status indicators
- `frost-arctic`/`frost-ice` used for links, trust indicators, filter states
- Focus rings already use `semantic-border-focus` token (changed to teal in Task 1.3)
- No raw `aurora-orange` usage found — orange flows through `semantic-primary`

## Should become brand teal (`semantic-brand`)

### Navigation tabs & progress
- `nav-tabs.tsx` — active pill/underline indicator uses `semantic-primary`
- `tabs.tsx` — active tab text/indicator uses `semantic-primary`
- `stepper.tsx` — completed step bg uses `semantic-primary`
- `OrderTimeline.tsx` — active/completed step colors
- `OnboardingChecklist.tsx` — progress bar, completion icons

### Links (non-purchase)
- Auth page links (forgot password, sign up/in) — `semantic-trust`
- Help/privacy/terms/contact page links — `frost-arctic`/`frost-ice`
- Checkout back-navigation links
- Order detail links (seller, tracking)
- Notification links

### Filters & selection states
- `BrowseFilters.tsx` — active filter chips use `frost-ice`/`frost-arctic`
- `FilterMultiSelect.tsx` — selected option uses `frost-arctic`
- `WantedBrowseFilters.tsx` — active country chip uses `semantic-primary`
- `TerminalPicker.tsx` — selected terminal uses frost tokens

### Trust/info badges
- `badge.tsx` trust variant — `frost-ice`/`frost-arctic`
- `alert.tsx` info variant — `frost-ice`
- Notification unread indicators — `frost-arctic`/`semantic-trust`
- Message unread indicators — `frost-arctic`

### Focus rings (already migrated via token change)
- All 22 usages of `ring-semantic-border-focus` — now teal automatically

## Should stay orange (`semantic-primary`)
- `button.tsx` primary variant — purchase-intent CTAs
- "Sign in to place a bid" link (BidPanel)
- Sell page section toggle tabs (contextually purchase-related)

## Needs evaluation
- `SellPageClient.tsx` sell/auction tab headers — could go either way
- `VersionStep.tsx` selection states — mixed purchase/navigation context

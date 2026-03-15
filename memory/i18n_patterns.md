---
name: Internationalization Patterns
description: next-intl setup, locale strategy, message file structure, date/time rules for Baltic markets
type: project
---

## Market vs Locale Strategy

All three Baltic countries (LV, LT, EE) served from day one — shipping, payments, terminals all work cross-border. Locale rollout is separate:

| Phase | Locale | When |
|-------|--------|------|
| MVP | English only | Day 0 |
| Phase 2 | + Latvian (lv) | Week 3-4 |
| Phase 3 | + Estonian (et) | Week 6-8 |
| Phase 4 | + Lithuanian (lt) | Week 8-10 |

## Setup

- **Library:** `next-intl` with App Router integration
- **URL strategy:** `as-needed` prefix — no prefix for English, `/lv/`, `/et/`, `/lt/` for others
- **Timezone:** `Europe/Riga`

## Key Files

```
i18n/routing.ts     ← Locale definitions (add new locales here)
i18n/request.ts     ← Message loading, timezone
i18n/navigation.ts  ← Link, redirect, useRouter (locale-aware)
messages/en.json    ← English translations (always complete)
messages/lv.json    ← Latvian (add in Phase 2)
messages/et.json    ← Estonian (add in Phase 3)
messages/lt.json    ← Lithuanian (add in Phase 4)
```

## Adding a New Locale

1. Add locale to `i18n/routing.ts`
2. Create `messages/<locale>.json` (copy from `en.json`, translate)
3. Routing automatically handles `/<locale>/` prefix
4. Use `/translate` skill for batch translation updates

## Date/Time Rules

All Baltic locales use European date format (dd.MM.yyyy) and 24-hour time. Only the time separator varies:
- English/Estonian/Lithuanian: colon (`14:30`)
- Latvian: dot (`14.30`)

Always use `lib/date-utils` — never `toLocaleDateString()` or AM/PM.

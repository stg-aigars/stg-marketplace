---
name: translate
description: Add or update translations across STG locale files
---

# Translation Skill

## Locale Files
- `src/messages/en.json` — English (always complete, source of truth)
- `src/messages/lv.json` — Latvian (added ~Week 3-4)
- `src/messages/et.json` — Estonian (added later)
- `src/messages/lt.json` — Lithuanian (added later)

## Adding New Translations

1. Add the English key first in `en.json`
2. Add the same key to ALL other locale files that exist
3. Use nested keys: `"Section.key": "value"`

## Rules

- Keys use PascalCase for sections, camelCase for values: `"NavBar.searchPlaceholder"`
- Keep translations concise — UI space is limited
- "Pre-loved" not "used" or "secondhand" in all languages
- No exclamation marks in any language
- European date references: dd.MM.yyyy format

## Latvian Translation Notes

- Latvian uses dots for time separator (14.30 not 14:30) — handled by date-utils
- Formal "you" (Jūs) for UI copy, informal (tu) only in playful marketing
- Board game terminology: check latvian board game community for standard terms

## Workflow

1. Read the English source to understand context
2. Add/update the translation in all existing locale files
3. Verify no keys are missing by comparing file structures
4. Run `pnpm build` to catch any missing translation references

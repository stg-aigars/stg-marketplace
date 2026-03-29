# STG Typography Guide

## Font Usage Rules

| Font | Class | When to Use |
|------|-------|-------------|
| **Fraunces** (display serif) | `font-display` | Page headings (H1), game titles on cards, featured collection titles, marketing hero text, empty state headings, editorial section titles |
| **Plus Jakarta Sans** (functional sans) | `font-sans` (default) | Everything else: body text, labels, buttons, navigation, form inputs, badges, metadata, prices, system messages |

## Rules
- Fraunces is ONLY for headings and game-identity text. Never for body copy, labels, or UI chrome.
- Prices always use Plus Jakarta Sans (functional precision, not editorial flair)
- Button text always uses Plus Jakarta Sans
- Badge text always uses Plus Jakarta Sans
- When Fraunces is used, also apply `tracking-tight` (letter-spacing: -0.01em to -0.02em) for proper optical fit at display sizes
- Fraunces looks best at semibold (600) to extrabold (800). Never use it at regular (400) weight.

## Heading Scale

| Level | Desktop | Mobile | Font | Weight |
|-------|---------|--------|------|--------|
| H1 page heading | `text-3xl` (30px) | `text-2xl` (24px) | `font-display` | `font-bold` (700) |
| H2 section heading | `text-2xl` (24px) | `text-xl` (20px) | `font-display` | `font-semibold` (600) |
| H2 card subsection | `text-base` (16px) | `text-base` (16px) | `font-sans` | `font-semibold` (600) |
| Game title (card) | `text-sm` (14px) | `text-sm` (14px) | `font-display` | `font-semibold` (600) |
| Game title (detail) | `text-2xl` (24px) | `text-xl` (20px) | `font-display` | `font-bold` (700) |

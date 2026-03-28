# STG Icon Guide

## Weight Rules (Phosphor Icons)

| Weight | When to Use | Example |
|--------|-------------|---------|
| `light` | Decorative, background, disabled state | Empty state illustration accents |
| `regular` | UI chrome, navigation, labels (DEFAULT) | Nav icons, breadcrumb separators |
| `bold` | Interactive affordance, emphasis | Filter icon button, action icons |
| `fill` | Active/selected/toggled state | Favorited heart, selected filter, active tab |

## Import Convention
Always import from `@phosphor-icons/react/ssr` (even in client components).

## Sizing Convention
| Size | Context |
|------|---------|
| 14px | Inside badges, inline with small text |
| 16px | Next to body text (buttons, metadata rows) |
| 20px | Standalone nav/action icons |
| 24px | Inside icon containers |
| 36px | Empty state focal icons |

## Icon Container Style
- Shape: `rounded-lg` (12px), NOT circular
- Background: semantic color tint matching function
- Border: `border-[1.5px]` with matching color at 20% opacity
- Example: teal container = `bg-semantic-brand/10 border-semantic-brand/20`

---
name: Design Tokens
description: Nordic minimalist color palette, typography, layout standards, component inventory
type: project
---

## Color Palette

| Token Group | Purpose |
|-------------|---------|
| `polar` (#2E3440–#4C566A) | Dark text, borders |
| `snow` (#D8DEE9–#FEFEFE) | Light backgrounds |
| `frost` (#88C0D0–#4C7099) | Trust/primary brand (blues) |
| `aurora` (orange, green, red, yellow, purple) | Accents, states, CTAs |
| `semantic` | Mapped to purposes (primary=orange, trust=frost, success, error) |
| `condition` | Game condition badges (likeNew, veryGood, good, acceptable, forParts) |

**Never hardcode hex values.** Use Tailwind token classes: `bg-aurora-orange`, `text-frost-ice`, `border-semantic-border`.

## Layout Standards

```
Page containers:     max-w-7xl mx-auto px-4 sm:px-6
Focused/form pages:  max-w-4xl mx-auto px-4 sm:px-6
Page padding:        py-6
Homepage sections:   py-8 sm:py-10 lg:py-12
Card image heights:  h-40 sm:h-44 lg:h-48
H1 headings:         text-2xl sm:text-3xl font-bold
H2 headings:         text-xl sm:text-2xl font-semibold
Borders:             border (1px default), border-2 (selected/active only)
Shadows:             shadow-sm → shadow-md (hover) → shadow-lg (dropdowns) → shadow-xl (modals)
```

## Component Inventory (18)

`Button`, `Card`, `Badge`, `Input`, `Select`, `Checkbox`, `Modal`, `SlidePanel`, `Skeleton`, `Avatar`, `Toast`, `Tabs`, `Dropdown`, `ActionSheet`, `ImageCarousel`, `ResultPage`, `SegmentedNav`, `ListingThumbnail`, `CountryDisplay`

All live in `src/components/ui/`. Import from `@/components/ui`.

## Token Source

Design tokens defined in `src/styles/tokens.ts`. Extended into `tailwind.config.ts` to generate utility classes.

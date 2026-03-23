# Silk Design System Audit — Claude Code Prompt

> **What this is:** A prompt file for Claude Code with the Figma MCP server connected.
> Copy this into your Claude Code session or reference it as a task file.
> 
> **Prerequisites:**
> 1. Figma MCP server connected (`claude mcp add --transport http figma https://mcp.figma.com/mcp`)
> 2. Authenticated via `/mcp` → figma → Authenticate
> 3. Silk Design System duplicated to your Figma workspace from:
>    https://www.figma.com/community/file/1599110970205546188/silk-design-system-by-netguru
> 4. Your duplicated Silk file URL ready (replace SILK_FILE_URL below)

---

## Context: Second Turn Games Design System

You are working on **Second Turn Games (STG)**, a Next.js 14 + Tailwind CSS peer-to-peer board game marketplace for the Baltic region. The project has an established Nordic-minimalist design system with custom Tailwind tokens and shared UI components.

### Existing STG Design Tokens (in `src/styles/tokens.ts` and `tailwind.config.js`)

**Color palettes** — all referenced via semantic Tailwind classes, never hardcoded hex:
- `aurora-*` — Teal accent/brand colors (primary actions, links, highlights)
- `frost-*` — Cool gray palette (backgrounds, borders, subtle UI)
- `condition-*` — Game condition badge colors (mint, good, fair, acceptable)
- `semantic-*` — Functional colors (error, warning, success, info, primary)

**Layout standards:**
- Page containers: `max-w-7xl mx-auto px-4 sm:px-6`
- Focused/form pages: `max-w-4xl mx-auto px-4 sm:px-6`
- Page vertical padding: `py-6`
- Card image heights: `h-40 sm:h-44 lg:h-48`
- Shadows: `shadow-sm` (resting) → `shadow-md` (hover) → `shadow-lg` (dropdowns) → `shadow-xl` (modals)
- Borders: `border` (1px default); `border-2` only for selected/active states

**Typography:**
- H1 page headings: `text-2xl sm:text-3xl font-bold`
- H2 section headings: `text-xl sm:text-2xl font-semibold`
- H2 card subsections: `text-base font-semibold`

### Existing STG Shared Components (`src/components/ui/`)

| Component | Variants / Props | File |
|-----------|-----------------|------|
| `Button` | variants: primary, secondary, ghost, danger; sizes: sm, md, lg | `button.tsx` |
| `Card`, `CardHeader`, `CardBody`, `CardFooter` | composable card pattern | `card.tsx` |
| `Input` | standard text input with label, error state | `input.tsx` |
| `Select` | dropdown select with label, error state | `select.tsx` |
| `Modal` | modal / bottom sheet pattern | `modal.tsx` |
| `Badge` | variants: default, success, warning, error, trust; condition keys | `badge.tsx` |
| `Alert` | variants: error, success, warning, info; dismissible | `alert.tsx` |
| `Avatar` | sizes: sm, md; initials fallback | `avatar.tsx` |
| `Skeleton` | loading placeholder | `skeleton.tsx` |

### STG Design Principles
- Nordic minimalist aesthetic — clean, calm, spacious
- "Pre-loved" not "used" or "secondhand"
- No exclamation marks in UI copy
- All monetary values as INTEGER CENTS (1299 not 12.99)
- `formatPrice()` / `formatCentsToCurrency()` for display
- `formatDate()` etc. from `@/lib/date-utils` — never raw `toLocaleDateString()`

---

## Task: Audit Silk Design System Against STG

### Phase 1 — Extract Silk's Design Tokens

Use the Figma MCP to extract Silk's foundation layer. Run these in sequence:

```
Step 1: Get Silk's variable definitions (color tokens, spacing, typography, shape)
→ Use get_variable_defs on the Silk file
→ URL: https://www.figma.com/design/RXaFI9YRdYten2tp0Bhkoa/Silk?node-id=4396-68962&p=f&t=GbcWtVrEgDrQD90X-0

Step 2: For each token category, document:
- Color: List all tier-1 palettes (Blueberry, Night, Slate, Teal, Red, Amber, Aquamarine)
         List all tier-2 core mappings (accent, neutral, semantic)
         List all tier-3 functional tokens (text/*, surface/*, stroke/*)
- Spacing: Base grid unit, available spacing scale values
- Typography: Font families, size scale, weight scale, responsive modes
- Shape: Border radius scale, shadow definitions
- Layout: Grid/container settings if defined
```

### Phase 2 — Extract Silk's Components

For each of Silk's component categories, use `get_design_context` on the relevant frames:

```
Step 3: Actions & Inputs
→ Buttons (all variants: primary, secondary, tertiary, link; all states: default, hover, pressed, disabled)
→ Form controls (text input, textarea, select/dropdown, checkbox, radio, toggle/switch)
→ Chips / tags
→ Search input

Step 4: Data Display & Content
→ Product cards (grid and list variants if available)
→ Lists / list items
→ Tables (if available)
→ Price display patterns

Step 5: Feedback & Messaging
→ Alerts / banners
→ Toast / notification patterns
→ Validation messages (inline, summary)
→ Empty states
→ Loading states

Step 6: Navigation & Way-finding
→ Navigation bar / header
→ Tabs
→ Breadcrumbs
→ Pagination
→ Footer
```

### Phase 3 — Generate Comparison Report

Create a file at `docs/silk-audit-report.md` with this structure:

```markdown
# Silk vs STG Design System — Audit Report
Generated: [date]

## Executive Summary
[2-3 sentences: key findings, biggest gaps, recommended actions]

## Token Comparison

### Colors
| Token Layer | Silk | STG | Gap / Notes |
|-------------|------|-----|-------------|
| Brand/Accent | [Silk approach] | aurora-* | [compatibility notes] |
| Neutral/Gray | [Silk approach] | frost-* | [compatibility notes] |
| Semantic | [Silk approach] | semantic-* | [compatibility notes] |
| Condition-specific | [none expected] | condition-* | STG-specific, keep as-is |

### Spacing
| Property | Silk | STG | Aligned? |
|----------|------|-----|----------|
| Base grid | [value] | 8px | [yes/no] |
| Scale | [values] | [Tailwind default] | [notes] |

### Typography
| Property | Silk | STG | Gap / Notes |
|----------|------|-----|-------------|
| Font family | [value] | Inter | [notes] |
| Size scale | [values] | [STG values] | [notes] |
| Responsive modes | [desktop/tablet/mobile] | [sm/md breakpoints] | [notes] |

### Shape
| Property | Silk | STG | Gap / Notes |
|----------|------|-----|-------------|
| Border radius | [values] | 4px subtle | [notes] |
| Shadow scale | [values] | sm→md→lg→xl | [notes] |

## Component Comparison

For each component, rate: ✅ STG has equivalent | ⚠️ STG has partial | ❌ STG missing | 🔄 Silk has better variant coverage

### Buttons
| Variant/State | Silk | STG | Notes |
|---------------|------|-----|-------|
| Primary | [describe] | ✅ primary variant | [differences] |
| Secondary | [describe] | ✅ secondary variant | [differences] |
| Tertiary/Ghost | [describe] | ✅ ghost variant | [differences] |
| Danger/Destructive | [describe] | ✅ danger variant | [differences] |
| Link button | [describe] | [status] | [notes] |
| Icon-only | [describe] | [status] | [notes] |
| Loading state | [describe] | [status] | [notes] |
| Size variants | [describe] | ✅ sm, md, lg | [differences] |

### Form Controls
[Same table pattern for Input, Select, Checkbox, Radio, Toggle, Textarea]

### Cards
[Same table pattern — pay special attention to product card layouts]

### Badges
[Same table pattern — compare condition badges, status badges, category tags]

### Alerts / Feedback
[Same table pattern]

### Navigation
[Same table pattern — note STG may be missing dedicated nav components]

### Components Silk Has That STG Does Not
| Silk Component | Description | Priority for STG | Rationale |
|----------------|-------------|------------------|-----------|
| [name] | [what it does] | High/Medium/Low | [why STG needs/doesn't need it] |

## Recommendations

### Quick Wins (adopt from Silk, low effort)
- [list components or patterns worth adding immediately]

### State Coverage Gaps (enhance existing STG components)
- [list missing states like loading, disabled, error that Silk covers]

### Token Refinements (consider adopting from Silk)
- [list token-level improvements, e.g., shadow scale, radius scale]

### Skip (Silk has it but STG doesn't need it)
- [list things not relevant to a board game marketplace]

### Marketplace-Specific Patterns (Silk's commerce patterns)
- [list checkout, product listing, filter, cart patterns and relevance to STG]
```

### Phase 4 — Optional: Generate Token Mapping

If the token comparison reveals strong alignment, create a mapping file:

```
Step 7: Create src/styles/silk-token-mapping.ts (reference only, do not import)

Map Silk functional tokens → STG Tailwind equivalents:
- silk-colors/core/accent → aurora-*
- silk-colors/core/neutral → frost-*
- silk-colors/semantic/success → semantic-success
- silk-colors/semantic/error → semantic-error
- etc.

This file is for developer reference, NOT for runtime use.
```

---

## How to Run This

1. Open Claude Code in the STG project root
2. Make sure Figma MCP is connected: `/mcp` should show figma as connected
3. Replace `SILK_FILE_URL` above with your duplicated Silk Figma file URL
4. Paste or reference this file and say:

```
Follow the Silk Design System audit in silk-design-audit.md. 
Start with Phase 1 — extract Silk's design tokens from my Figma file:
SILK_FILE_URL = https://www.figma.com/design/RXaFI9YRdYten2tp0Bhkoa/Silk?node-id=4396-68962&p=f&t=GbcWtVrEgDrQD90X-0

Then proceed through all 4 phases and generate the comparison report.
Work through one phase at a time and confirm before moving to the next.
```

5. Review the generated `docs/silk-audit-report.md` after completion
6. Use the report to decide which Silk patterns to adopt, adapt, or skip

---

## Tips for Best Results

- **Process one component category at a time.** Don't ask Claude Code to extract everything in one prompt — the Figma MCP returns large payloads and you'll hit token limits.
- **Use frame-level URLs when possible.** Right-click a specific frame in Figma → "Copy link" gives Claude Code a focused extraction target instead of the whole file.
- **Reference your existing components.** When comparing, tell Claude Code: "Read src/components/ui/button.tsx and compare it to the Silk button you just extracted."
- **Watch for token limits.** If Claude Code errors on large frames, set `MAX_MCP_OUTPUT_TOKENS=50000` before starting your session.
- **The report is the deliverable.** The goal is a clear comparison doc you can use to make decisions — not to automatically merge Silk into your codebase.

# Component upgrades on listings — design

**Date:** 2026-06-13
**Feedback:** "Integration with the BGG accessories section could be useful to show the presence of component upgrades."

## Goal

Let a seller declare that their pre-loved copy includes component upgrades / extras
(metal coins, custom inserts, upgraded tokens, sleeves, …), and surface that as a
structured, visible signal to buyers. On a pre-loved marketplace this is real value:
a used copy with €50 of metal coins is worth more, and buyers want to know.

The BGG "accessories section" is the **source list** the seller picks from, so
declarations use recognizable, consistent names rather than free-text guesses.

## Key constraint discovered during design

BGG's accessory data is **noisy**. The `boardgameaccessory` links on a game's thing
record are a community catalog of every accessory product ever associated with the
game — for Gloomhaven, **69 entries**, dominated by per-token SKUs
("Adventure Tokens – Altar/Barrel/…") and third-party inserts (Folded Space,
Broken Token, E-Raptor, …). There is no field distinguishing "official component
upgrade" from "third-party insert" from "single token". So:

- A full checklist of all accessories would be unusable.
- Any auto-filter to "real upgrades" would be arbitrary and unreliable.

**Resolution:** the seller *searches* the list (typeahead) and ticks matches, plus a
free-text "add your own" for anything not in BGG. Noise is handled by search, not by
pre-filtering or by dumping a wall of checkboxes.

## Data model

**`games` (new columns, mirror the existing `versions` cache):**
- `accessories JSONB` — `[{ id: number, name: string }]`, the full BGG accessory link list.
- `accessories_fetched_at TIMESTAMPTZ` — lazy cache timestamp.

**`listings` (new column):**
- `component_upgrades JSONB` (nullable) — `[{ bgg_accessory_id: number | null, name: string }]`.
  BGG-picked items carry their accessory id; free-text items have `bgg_accessory_id: null`.
  Empty / null = none declared.

**Why a JSONB column, not a child table** (unlike `listing_expansions`): expansions are
first-class entities (own bgg id, version, condition, thumbnail, rendered as a full
`GameIdentityRow`). Component upgrades are lightweight labels (id + name). A child table
with RLS would over-model a tag list.

Migration **127** adds all three columns.

## BGG fetch

`api.ts` already parses all `<link>` elements; it just discards `boardgameaccessory`.
Capture that type into metadata. New route **`/api/games/[id]/accessories`** returns the
cached list or fetches the thing record, extracts accessory links, caches on `games`,
and returns — mirroring `/api/games/[id]/versions`.

## Sell-flow input

New optional section in the "details" step (`ConditionPhotosStep`): **"Included extras /
component upgrades"**, rendered by a new sell-flow-local `ComponentUpgradesPicker`:
- Fetches `/api/games/[id]/accessories` on mount (`apiFetch`, same as `VersionStep`).
- Search box filters the cached list by substring; tapping a match adds a removable chip.
- "Add your own" free-text input appends a custom chip (`bgg_accessory_id: null`).
- Dedup: by `bgg_accessory_id` for BGG items, case-insensitive `name` for free-text.
- No multi-select primitive exists; keep it sell-flow-local, flag for extraction if a
  second caller appears.

Threaded through `ListingCreationFlow` state → `CreateListingData.component_upgrades`.
Edit flow (`UpdateListingData`) gets the same field so listings stay editable.

## Display

- **Listing detail:** an "Included extras" section near the edition details; names render
  as `Badge variant="default"` tags (existing category/mechanic tag style).
- **ListingCard:** a small `+N extras` badge mirroring the existing `+N expansions` badge,
  shown when the array is non-empty. Card query selects `component_upgrades`.

## Validation (in `validation.ts`, create + update)

- Cap **20** upgrades per listing.
- Each `name` ≤ **100** chars.
- Trim, drop empty names, reject malformed entries.

## Testing

Unit tests, no mocking:
- Accessory-link extraction from a BGG XML fixture.
- Selection dedup (BGG id + case-insensitive free-text).
- Validation rules (count cap, name length, empties).

## Out of scope (YAGNI)

- Browse filter "has upgrades" — defer until there's demand; the JSONB shape supports it later.
- Per-upgrade condition / photos — upgrades are labels, not first-class items.

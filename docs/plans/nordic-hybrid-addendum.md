# Nordic Hybrid Design Upgrade — Addendum

> **For Claude Code:** This is a companion to `docs/plans/nordic-hybrid-design-upgrade.md`. These tasks extend Phase 6 (Component Upgrades), Phase 7 (Page Compositions), and add a new Phase 5.6 (Kallax Grid). Read the main document first for context. Same rules: work sequentially within each section, commit after each task, `pnpm build` after every task.

## Pre-work: Read These Files

In addition to the files listed in the main document, read:
- `src/components/layout/SiteHeader.tsx`
- `src/components/layout/SiteFooter.tsx`
- `src/components/ui/modal.tsx`
- `src/components/ui/stepper.tsx`
- `src/components/ui/skeleton.tsx`
- `src/components/messages/` — ConversationList, ConversationView, MessageInput
- `src/components/reviews/` — ReviewForm, ReviewItem, SellerRating
- `src/components/orders/OrderDetailClient.tsx`
- `src/app/[locale]/account/page.tsx`
- `src/app/[locale]/sell/_components/` — all sell flow step components
- `src/app/[locale]/account/shelf/` — shelf management components

---

## Phase 5 Addendum: Kallax Shelf Grid

### Task 5.6: Create KallaxGrid and KallaxCell for seller shelves

**Why:** The IKEA Kallax is the cultural artifact of the board game hobby — every collector has one. Using the shelf-cubby metaphor for seller shelves creates instant recognition and makes browsing someone's collection feel like looking at a real shelf. This is STG's most distinctive layout pattern.

**Important:** The Kallax layout is used ONLY on seller shelf pages (public profile shelf view + seller's own shelf management). Browse, search, favorites, and other listing views continue using the standard ListingCard grid. The metaphor specifically means "this is someone's collection."

**Files to create:**
- `src/components/shelves/KallaxGrid.tsx` — the container component
- `src/components/shelves/KallaxCell.tsx` — individual cubby cell

#### `KallaxGrid.tsx`

A single bordered container with internal CSS Grid dividers:

```tsx
interface KallaxGridProps {
  children: React.ReactNode;
  columns?: { default: number; sm: number; lg: number };  // default: 2, sm: 3, lg: 4
  className?: string;
}
```

Implementation details:
- Outer container: `bg-semantic-bg-elevated rounded-xl border-2 border-semantic-border-subtle overflow-hidden`
- CSS Grid: `grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4`
- Internal dividers are NOT gap-based — they use borders on each cell:
  - Each cell gets `border-r border-b border-semantic-border-subtle`
  - Last column in each row: remove `border-r` (use `[&:nth-child(4n)]:border-r-0` for 4-col, media-query adjusted for responsive)
  - Last row: remove `border-b` (calculate dynamically or use negative margin trick)
- Border width: `border-[1.5px]` for the internal dividers (slightly lighter than the 2px outer border)
- No shadows on individual cells — the compartment structure itself creates the visual

**Responsive column handling:**
```css
/* 2 cols: every 2nd child loses right border */
/* 3 cols at sm: every 3rd child loses right border */
/* 4 cols at lg: every 4th child loses right border */
```

This is tricky with pure Tailwind. Consider a small CSS class in `globals.css` or use inline style calculation based on column count. The cleanest approach is likely a CSS Grid with `gap-0` and borders on all cells, then removing the outer-edge borders via negative margin or overflow-hidden on the container.

**Alternative (simpler) approach:** Use `outline` instead of `border` on cells. Set `outline: 1.5px solid var(--border-color)` on each cell, and the container's `overflow-hidden` clips the outer edges cleanly. This avoids the last-row/last-column removal problem entirely.

#### `KallaxCell.tsx`

An individual cubby within the Kallax:

```tsx
interface KallaxCellProps {
  item: ShelfItemWithGame;
  isOwner?: boolean;  // shows edit controls on own shelf
  className?: string;
}
```

Layout (from top to bottom within the cell):
1. **Square image area** (`aspect-square`): Game thumbnail centered with warm background (`bg-semantic-bg-secondary`), rounded-lg inner image with subtle shadow. On hover: image scales to 1.03 with enhanced shadow.
2. **Status indicator** (positioned absolute, top-right of image area):
   - "Open to offers": green dot (10px, `bg-semantic-success`, white 2px border)
   - "Listed": small price badge (`bg-white/90 backdrop-blur-sm rounded text-[9px] font-bold text-semantic-brand`)
   - "Not for sale": no indicator
3. **Info row** (below image, always visible): 
   - Game title: `<GameTitle size="sm" serif />` — uses the shared atom
   - Status/price row: price (if listed) + status badge using existing Badge component
   - Padding: `px-2.5 py-2`

**Hover treatment:**
- Cell background: `hover:bg-[rgba(107,163,181,0.03)]` (barely-there teal tint)
- Image: `group-hover:scale-[1.03]` with `transition-transform duration-300 ease-out-custom`
- Cursor: `pointer`

**Empty cubbies (owner's shelf management only):**

When `isOwner` is true and the grid has fewer items than would fill the last row, render empty placeholder cells:

```tsx
<div className="aspect-square flex items-center justify-center">
  <div className="w-10 h-10 rounded-lg border-[1.5px] border-dashed border-semantic-border-default flex items-center justify-center">
    <Plus size={16} weight="regular" className="text-semantic-text-muted opacity-40" />
  </div>
</div>
```

Clicking an empty cubby triggers the "Add game to shelf" action (same as the existing "Add game" flow).

On the public shelf view (not owner), do not render empty cubbies — the grid ends at the last game.

**Integration with existing shelf pages:**

- `src/app/[locale]/sellers/[id]/page.tsx` — replace the shelf section grid with `<KallaxGrid>` + `<KallaxCell>` for each shelf item
- `src/app/[locale]/account/shelf/page.tsx` — replace the shelf management grid with `<KallaxGrid>` + `<KallaxCell isOwner />`

**Verify:** `pnpm build` passes. Seller profile page shows the Kallax compartment grid. Shelf management page shows the same with empty cubbies and "+" placeholders. Responsive: 2 cols on mobile, 3 on tablet, 4 on desktop.

**Commit:** `feat: Kallax bento grid for seller shelves — compartment layout with cubby cells`

---

## Phase 6 Addendum: Component Upgrades (continued)

### Task 6.6: Navigation header upgrade

**Why:** The header is the brand's first impression on every page load. Currently it's functional but invisible — opaque white bar with plain text links. The upgrade adds warmth, brand identity, and subtle polish without changing the layout structure.

**File:** `src/components/layout/SiteHeader.tsx`

**Changes:**

1. **Frosted glass effect.** Replace the opaque background with translucent + backdrop blur:
   ```
   // Before
   bg-semantic-bg-elevated

   // After
   bg-[rgba(253,252,250,0.85)] backdrop-blur-xl
   ```
   This lets the warm page background subtly show through when scrolling, creating depth. The border-bottom stays as-is for the separation line.

2. **Brand name in display font.** The site name text shifts to `font-display tracking-tight`. Consider shortening to "Second Turn" (dropping "Games") at nav scale — it's cleaner and the context is obvious. Keep the full name in metadata/SEO/footer.

3. **Active nav link pill.** Currently active links use a color change only. Add a subtle background pill for the active state:
   ```
   // Active link
   bg-[#EDF5F7] text-semantic-brand font-semibold rounded-md px-3 py-1.5

   // Inactive link  
   text-semantic-text-muted hover:text-semantic-text-primary rounded-md px-3 py-1.5
   ```
   Transition: `transition-all duration-250 ease-out-custom`

4. **Search bar warm treatment.** Update the search input area:
   - Background: `bg-semantic-bg-secondary` (warm tone instead of white)
   - Border: `border border-semantic-border-subtle`
   - Add a `/` shortcut hint badge on the right side (desktop only, hidden on mobile):
     ```tsx
     <kbd className="hidden sm:inline-flex ml-auto text-[10px] font-semibold text-semantic-text-muted bg-semantic-bg-primary px-1.5 py-0.5 rounded">
       /
     </kbd>
     ```
   - Wire up the keyboard shortcut: pressing `/` when no input is focused should focus the search input. Add a `useEffect` with a keydown listener. Skip if `event.target` is an input, textarea, select, or contentEditable element:
     ```ts
     useEffect(() => {
       const handleKeyDown = (e: KeyboardEvent) => {
         if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)
             && !(e.target as HTMLElement).isContentEditable) {
           e.preventDefault();
           searchInputRef.current?.focus();
         }
       };
       document.addEventListener('keydown', handleKeyDown);
       return () => document.removeEventListener('keydown', handleKeyDown);
     }, []);
     ```

5. **Squared avatar.** The user avatar in the header shifts from `rounded-full` to `rounded-lg`. If the user has no avatar image, the initials badge uses the brand teal gradient: `bg-gradient-to-br from-semantic-brand to-semantic-brand-active text-white`.

6. **Transitions.** All nav link hover/active states use `transition-all duration-250 ease-out-custom` instead of Tailwind's default `transition-colors`.

**Do NOT change:** The mobile hamburger menu structure, the sticky/z-50 behavior, the header height (`h-14 sm:h-16`), the notification bell, or the messages link. Only the visual treatment changes, not the layout or functionality.

**Verify:** `pnpm build` passes. Desktop: frosted glass visible when scrolling content behind the header, active nav has teal pill, search shows `/` hint, pressing `/` focuses search. Mobile: hamburger menu still works, no layout breaks.

**Commit:** `design: navigation header — frosted glass, brand font, active pill, search shortcut`

---

### Task 6.7: Footer upgrade

**Why:** The footer is the last element on every page and currently uses the same visual voice as the rest of the UI. A small typographic and tonal upgrade ties it to the brand refresh.

**File:** `src/components/layout/SiteFooter.tsx`

**Changes:**

1. **Brand name in display font.** The "Second Turn Games" text in the footer uses `font-display tracking-tight` — matching the header treatment.

2. **Warm background differentiation.** Give the footer a slightly distinct background from the page:
   ```
   bg-semantic-bg-secondary border-t border-semantic-border-subtle
   ```
   This creates a gentle visual separation without being heavy.

3. **Link hover color.** Footer links shift to brand teal on hover:
   ```
   text-semantic-text-muted hover:text-semantic-brand transition-colors duration-250 ease-out-custom
   ```

4. **Newsletter input.** If the footer contains a newsletter signup form, apply the same warm input treatment from Task 6.4 — warm fill (`bg-[#FDFCFA]`), teal focus ring. The submit button uses the primary orange (subscribing is a CTA action).

5. **Tagline.** If not already present, add "Every game deserves a second turn" in `text-semantic-text-muted text-sm italic` below the brand name. The `font-display` serif in italic is a nice touch here if it works visually — test and fall back to `font-sans italic` if not.

6. **Copyright year.** Ensure the copyright line uses a dynamic year (`new Date().getFullYear()`) if not already.

**Do NOT change:** The footer layout structure (stacked mobile, flex-row desktop), the link groups, or any legal page links (Terms, Privacy, Contact).

**Verify:** `pnpm build` passes. Footer has warm background, serif brand name, teal link hovers, tagline visible.

**Commit:** `design: footer — display font brand name, warm background, teal link hovers`

---

### Task 6.8: Modal warm treatment

**Why:** Modals appear in offers, sell flow condition guide, filter panels, and confirmation dialogs — they're a frequent surface that needs the warm treatment.

**File:** `src/components/ui/modal.tsx`

**Changes:**

1. **Title in display font.** The modal title (`<h2>` in the header) shifts to `font-display tracking-tight`:
   ```tsx
   <h2 className="text-lg font-semibold font-display tracking-tight text-semantic-text-heading">{title}</h2>
   ```

2. **Warm backdrop overlay.** Update the backdrop from cool-tinted to warm:
   ```
   // Before (in tokens.ts, already set by Phase 1):
   bgOverlay: 'rgba(46, 52, 64, 0.6)'

   // Verify this was updated. If not, change to:
   bgOverlay: 'rgba(26, 31, 38, 0.5)'
   ```
   The `backdrop-blur` stays as-is.

3. **Close button hover.** The X close button hover state shifts to brand teal:
   ```
   text-semantic-text-muted hover:text-semantic-brand transition-colors duration-250 ease-out-custom
   ```

4. **Mobile bottom sheet drag handle.** The drag handle bar should use `bg-semantic-border-default` (now warm-toned from Phase 1). Verify it's not hardcoded to a cool color.

5. **Transition.** The modal open/close transition (if any) should use the branded easing: `transition-all duration-350 ease-out-custom`.

**Verify:** Open any modal (e.g., condition guide in sell flow, confirm dialog on order actions). Title is serif, backdrop is warm, close button hovers teal.

**Commit:** `design: modal warm treatment — display font title, warm backdrop, teal close hover`

---

### Task 6.9: Stepper brand color

**Why:** The Stepper component uses `semantic-primary` (orange) for completed steps and the progress bar. Since the stepper represents progress (not purchase), it should use `semantic-brand` (teal).

**File:** `src/components/ui/stepper.tsx`

**Changes:**

1. **Progress bar fill.** Change from `bg-semantic-primary` to `bg-semantic-brand`:
   ```
   // Completed step fill
   bg-semantic-brand
   
   // Incomplete step fill
   bg-semantic-border-subtle
   ```

2. **Step label active color.** The current step label shifts from `text-semantic-primary` to `text-semantic-brand`.

3. **CheckCircle icon.** Completed step checkmarks should use `text-semantic-brand` (they currently inherit from the step color, so this may work automatically).

4. **Keep orange only if** the stepper is inside the checkout flow and represents payment progress. But since the checkout stepper and sell flow stepper use the same component, brand teal is appropriate for both — the "purchase action" distinction applies to buttons, not progress indicators.

**Verify:** Open the sell flow (listing creation) — the step indicator should be teal. Check the checkout page stepper if one exists.

**Commit:** `design: stepper uses brand teal instead of orange for progress`

---

### Task 6.10: Skeleton warm tone

**Why:** The Skeleton component's pulse animation needs to look right against the new warm backgrounds.

**File:** `src/components/ui/skeleton.tsx`

**Changes:**

1. **Verify the base color.** The skeleton currently uses `bg-snow-storm-light`. After Phase 1's token changes, this should now map to the warm `#F5F3EF`. Verify this is the case — if the Skeleton component hardcodes a class name that still references the old cool color, update it:
   ```
   // Should be using the warm secondary background
   bg-semantic-bg-secondary
   ```

2. **Pulse animation color.** The `animate-pulse` Tailwind animation oscillates opacity. Verify the skeleton looks good against `#FAF9F6` (warm bg). If the pulse looks too subtle or too strong, consider replacing the default `animate-pulse` with a custom shimmer:
   ```css
   @keyframes shimmer {
     0% { opacity: 0.5; }
     50% { opacity: 0.8; }
     100% { opacity: 0.5; }
   }
   ```
   Applied as a custom Tailwind animation class. But test the default first — it's likely fine.

3. **ListingCardSkeleton.** Verify the listing card skeleton (wherever it lives) now uses `aspect-square` for the image placeholder instead of `h-40 sm:h-44 lg:h-48`, matching the card refactor from Task 5.2.

**Commit:** `design: verify skeleton warm tone against new backgrounds`

---

### Task 6.11: Toast/notification styling

**Why:** Toasts are transient but frequent — every order action, offer, and form submission triggers one. They should match the warm system.

**File:** Find the toast/notification component — likely in `src/components/ui/` or configured via a toast library. Check the `ToastProvider` in the provider stack in `layout.tsx` to find the implementation.

**Changes:**

1. **Toast background.** Use `bg-semantic-bg-elevated` (white) with warm shadow:
   ```
   shadow-lg border border-semantic-border-subtle
   ```

2. **Toast border radius.** Use `rounded-lg` (12px) — squared, consistent with the badge/card direction.

3. **Toast icons.** If toasts show status icons (success checkmark, error X, warning triangle), use Phosphor icons at `weight="regular"` with semantic colors:
   - Success: `CheckCircle` in `text-semantic-success`
   - Error: `XCircle` in `text-semantic-error`
   - Warning: `Warning` in `text-semantic-warning`
   - Info: `Info` in `text-semantic-brand`

4. **Dismiss button.** If there's a close/dismiss button, it should follow the same pattern as the modal close: `text-semantic-text-muted hover:text-semantic-brand`.

5. **Toast position.** If not already configured, bottom-right on desktop and bottom-center on mobile is the standard for marketplace apps (doesn't interfere with the header or primary content).

**Commit:** `design: toast styling — warm background, squared radius, Phosphor status icons`

---

### Task 6.12: Message bubble styling

**Why:** The messaging UI is a key community surface where trust is built between buyers and sellers. Currently it likely uses generic gray bubbles. Tinting outgoing messages with the brand color creates visual ownership.

**Files:**
- `src/components/messages/ConversationView.tsx` (or wherever message bubbles render)
- `src/components/messages/ConversationList.tsx` (conversation sidebar/list)
- `src/components/messages/MessageInput.tsx`

**Changes to ConversationView (message bubbles):**

1. **Outgoing messages** (from the current user): 
   ```
   bg-[#EDF5F7] text-semantic-text-primary rounded-xl rounded-br-sm
   ```
   The subtle teal tint (`#EDF5F7`) signals "this is yours" without being heavy. The `rounded-br-sm` (small bottom-right radius) creates the classic chat bubble tail pointing to the sender.

2. **Incoming messages** (from the other party):
   ```
   bg-semantic-bg-elevated text-semantic-text-primary border border-semantic-border-subtle rounded-xl rounded-bl-sm
   ```
   White card background with subtle border. The `rounded-bl-sm` tail points to the other party.

3. **Timestamps.** Use `font-sans text-[11px] text-semantic-text-muted` — no change to the formatting functions, just verify the visual styling.

4. **Message transitions.** New messages should fade in with a subtle animation if not already animated:
   ```
   animate-in fade-in slide-in-from-bottom-1 duration-250
   ```
   (If custom animations aren't set up, skip this — the Phase 1 motion tokens provide the easing but CSS animation keyframes would need to be defined separately.)

**Changes to ConversationList (sidebar):**

1. **Squared avatars** on conversation list items — `rounded-lg` instead of `rounded-full`.
2. **Unread indicator.** If not already present, add a small teal dot (`w-2 h-2 rounded-full bg-semantic-brand`) for conversations with unread messages.
3. **Active conversation highlight.** The currently open conversation uses `bg-semantic-bg-secondary` (warm) instead of just a border or text change.

**Changes to MessageInput:**

1. Apply the warm input treatment from Task 6.4 — warm fill, teal focus ring.
2. Send button: use `text-semantic-brand hover:text-semantic-brand-hover` (teal for messaging, not orange — sending a message is communication, not purchase).

**Commit:** `design: message bubbles — teal tint outgoing, squared avatars, unread dots`

---

### Task 6.13: Review display styling

**Why:** The review system is a trust surface. The thumbs up/down pattern and seller rating summary deserve the new token treatment and icon weight convention.

**Files:**
- `src/components/reviews/ReviewItem.tsx`
- `src/components/reviews/ReviewForm.tsx`
- `src/components/reviews/SellerRating.tsx`

**Changes to ReviewItem:**

1. **Positive review icon.** `ThumbsUp` with `weight="fill"` in `text-semantic-brand` (teal = trust). This connects positive reviews to the brand identity — positive feedback IS trust.

2. **Negative review icon.** `ThumbsDown` with `weight="fill"` in `text-semantic-text-muted` (neutral gray, not error red). Negative reviews shouldn't look alarming — they're informational.

3. **Review card.** If reviews are displayed in card-like containers, ensure they use the warm card treatment: `bg-semantic-bg-elevated rounded-lg border border-semantic-border-subtle`.

4. **Reviewer name.** Keep `font-sans` — reviews are functional content, not editorial.

**Changes to ReviewForm:**

1. **ThumbsUp / ThumbsDown selection buttons.** Active state should use `weight="fill"`:
   - Thumbs up selected: `bg-[#EDF5F7] text-semantic-brand border-semantic-brand`
   - Thumbs down selected: `bg-semantic-bg-secondary text-semantic-text-secondary border-semantic-border-strong`
   - Unselected: `bg-transparent text-semantic-text-muted border-semantic-border-subtle`

2. **Review text input.** Apply warm input treatment from Task 6.4.

**Changes to SellerRating:**

1. **Rating indicator.** If there's a percentage or score display, use the warm gold accent token (`text-semantic-accent`) for positive ratings. The gold accent was defined in Task 1.3 but not yet used — this is its primary home.

2. **Star or ThumbsUp icon** in the rating summary: `weight="fill"` in `text-semantic-accent` (gold).

3. **Sales count.** If displayed alongside the rating, keep `font-sans text-sm text-semantic-text-muted`.

**Commit:** `design: review styling — teal positive, gold ratings, icon weight convention`

---

## Phase 7 Addendum: Page Compositions (continued)

### Task 7.5: Sell flow polish

**Why:** The listing creation wizard is a multi-step experience that every seller goes through. It's the "onboarding" for sellers and should feel as polished as the buyer-facing pages.

**Files:** `src/app/[locale]/sell/_components/` — all step components:
- `ListingCreationFlow.tsx` (orchestrator)
- `GameSearchStep.tsx`
- `VersionStep.tsx`
- `PhotoUploadStep.tsx`
- `ConditionStep.tsx`
- `PriceStep.tsx`
- `ReviewStep.tsx`

**Changes to ListingCreationFlow.tsx:**

1. **Step labels.** If step names are displayed (in the stepper or as section headings), use `font-display` for the current step's title. The stepper component itself was already updated to brand teal in Task 6.9.

**Changes to GameSearchStep.tsx:**

1. **Game search results.** When the user searches for a game and gets a list of results, these should use `ListingRow` from the card family (Task 5.3) — horizontal layout with `GameThumb` (square), `GameTitle` (serif), and year/publisher metadata. This replaces any ad-hoc game result rendering.

2. **Search input.** Apply warm input treatment from Task 6.4.

3. **Empty search state.** If the search returns no results, use the upgraded EmptyState component from Task 6.2.

**Changes to PhotoUploadStep.tsx:**

1. **Upload dropzone.** Style the drag-and-drop area with the dashed-border warm treatment matching the empty state icon container pattern:
   ```
   border-[1.5px] border-dashed border-semantic-border-default bg-semantic-bg-secondary rounded-xl
   ```
   With a Phosphor `CloudArrowUp` icon at `size={36} weight="regular"` in `text-semantic-brand`.

2. **Photo thumbnails.** Uploaded photo previews should use `aspect-square rounded-lg` — consistent with the square image direction from the card refactor.

**Changes to ConditionStep.tsx:**

1. **Condition options.** The condition selection UI (cards or buttons for each tier) should display the Phosphor condition tier icons from Task 4.2 (Sparkle, Star, Check, Warning, PuzzlePiece) alongside the condition labels. This creates continuity — sellers see the same icons they'll see on their listing badge.

2. **Selected condition.** Use `border-2 border-semantic-brand` for the selected condition (teal highlight, not orange — selecting a condition is a choice, not a purchase).

**Changes to PriceStep.tsx:**

1. **Price input.** Apply warm input treatment. Add a `€` prefix inside the input (consistent with the checkout price input pattern from Part 2 comparisons).

2. **Earnings preview.** If there's a "You'll earn" display, use `font-display` for the earnings amount and `text-semantic-accent` (gold) for emphasis — this is money the seller will receive.

**Changes to ReviewStep.tsx:**

1. **Listing preview.** If the final review step shows a preview of the listing, it should use `ListingCard` from the card family — the exact same component the buyer will see. This gives the seller confidence about how their listing will appear.

2. **"Publish" button.** This is a CTA action — it stays `semantic-primary` (orange). This is correct: publishing a listing is a significant action equivalent to "submit."

**Commit:** `design: sell flow polish — game search uses ListingRow, warm dropzone, condition icons`

---

### Task 7.6: Account hub page

**Why:** The account page is a dashboard hub with links to orders, wallet, shelf, listings, and settings. It's seen frequently but currently uses the same visual voice as content pages.

**File:** `src/app/[locale]/account/page.tsx`

**Changes:**

1. **Page heading.** Already handled by Task 2.3 (`font-display`), but verify.

2. **Quick-link cards.** If the account page has card-style links to different sections (Orders, Wallet, Shelf, Listings, Settings), upgrade each with a semantically-tinted icon container:

   | Section | Icon | Container tint | Meaning |
   |---------|------|----------------|---------|
   | Orders | `Package` | `bg-[#EDF5F7]` border-semantic-brand tint | Brand/core function |
   | Wallet | `Wallet` | `bg-semantic-accent-bg` border-semantic-accent tint | Money/gold |
   | Shelf | `BookBookmark` | `bg-[#EEF5EB]` border-success tint | Collection/green |
   | Listings | `Tag` | `bg-[#FBF0EB]` border-semantic-primary tint | Selling/orange |
   | Settings | `GearSix` | `bg-semantic-bg-secondary` border-semantic-border tint | Neutral |
   | Messages | `ChatCircle` | `bg-[#EDF5F7]` border-semantic-brand tint | Communication/brand |
   | Offers | `Handshake` | `bg-semantic-accent-bg` border-semantic-accent tint | Negotiation/gold |

   Icon container: `w-10 h-10 rounded-lg border-[1.5px] flex items-center justify-center` with the tint colors above.
   Icon: `size={20} weight="regular"` — shifts to `weight="fill"` for the section the user is currently in (if there's an active state).

3. **Section headings within the page.** If the account page has grouped sections ("Quick links", "Your activity"), these headings get `font-display tracking-tight`.

4. **Stats or counts.** If any sections show counts (e.g., "3 active orders", "€24.50 wallet balance"), the number can use `font-display font-bold` for emphasis, with the label in `font-sans text-semantic-text-muted`.

**Commit:** `design: account hub — semantically-tinted icon cards, display font headings`

---

## Updated Summary

These tasks extend the main PRD. Here's the full addendum scope:

| Task | Scope | Phase |
|------|-------|-------|
| 5.6 | Kallax grid for seller shelves | Phase 5 |
| 6.6 | Navigation header upgrade | Phase 6 |
| 6.7 | Footer upgrade | Phase 6 |
| 6.8 | Modal warm treatment | Phase 6 |
| 6.9 | Stepper brand color | Phase 6 |
| 6.10 | Skeleton warm tone | Phase 6 |
| 6.11 | Toast/notification styling | Phase 6 |
| 6.12 | Message bubble styling | Phase 6 |
| 6.13 | Review display styling | Phase 6 |
| 7.5 | Sell flow polish | Phase 7 |
| 7.6 | Account hub page | Phase 7 |

**Implementation order:**
- Task 5.6 (Kallax) can be done anytime after Phase 5 tasks 5.1-5.5 complete (it uses the shared atoms)
- Tasks 6.6-6.13 can be done in any order after Phases 1-4 complete
- Tasks 7.5-7.6 should come after Phase 6 (they reference upgraded components)

**Estimated additional effort:** 2-3 days, bringing the total upgrade to roughly 5-7 days of focused work over 2-3 weeks at a careful pace.

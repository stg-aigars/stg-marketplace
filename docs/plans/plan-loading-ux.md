# Plan: Loading & Feedback UX Improvements

## Goal
Add visual feedback for navigation, page loading, and user-initiated actions across the app. Four changes, shipped in one branch.

## Branch
`feat/loading-ux`

---

## Task 1: Top Navigation Progress Bar

Install and configure `nextjs-toploader` for instant navigation feedback on all `<Link>` clicks.

### Steps

1. Run `pnpm add nextjs-toploader`
2. Open `src/app/[locale]/layout.tsx` (the root locale layout)
3. Import `NextTopLoader` from `nextjs-toploader`
4. Add `<NextTopLoader color="#5E9CA0" showSpinner={false} height={3} shadow={false} />` inside `<body>`, **before** the main content/children — ensure it's outside any `<main>` wrapper so it renders at the very top of the viewport
5. Do NOT add `"use client"` to the layout — `NextTopLoader` is a client component and can be composed into a server layout without making the layout itself a client component

### Verification
- `pnpm build` passes
- Navigation between pages shows a teal progress bar at the top

### Commit
`feat: add top navigation progress bar with nextjs-toploader`

---

## Task 2: `loading.tsx` Skeletons for Key Routes

Add `loading.tsx` files for the heaviest data-fetching routes. These render instantly while the server component streams.

### Target routes (in priority order)

Each `loading.tsx` is a **Server Component** (no `"use client"`). Import `Skeleton` from `@/components/ui`. Wrap content in the same layout container as the corresponding `page.tsx` uses (check each page's outermost container — typically `max-w-7xl mx-auto px-4 sm:px-6 py-6` for marketplace pages, `max-w-4xl mx-auto px-4 sm:px-6 py-6` for focused pages).

#### A. Listing Detail — `src/app/[locale]/(marketplace)/listings/[id]/loading.tsx`
Look at the actual `page.tsx` to match the layout. The skeleton should approximate:
- Left column: large image skeleton (`aspect-[4/3]` rectangle), smaller thumbnail row below
- Right column: title skeleton (h-8 w-3/4), price skeleton (h-10 w-1/3), condition badge skeleton (h-6 w-24), action button skeleton (h-12 full width), seller card skeleton (h-20)
- Use the same grid structure as the real page (check if it's a `grid grid-cols-1 lg:grid-cols-2` or similar)

#### B. Browse/Search — `src/app/[locale]/(marketplace)/listings/loading.tsx`
- Filter bar skeleton at top (h-10 full width)
- 4-column grid at `lg` matching the listing card grid: `grid grid-cols-2 lg:grid-cols-4 gap-4`
- Each card skeleton: image area (h-40), title line (h-5 w-3/4), price line (h-5 w-1/3)
- Show 8 card skeletons

#### C. Order Detail — `src/app/[locale]/(marketplace)/orders/[id]/loading.tsx`
- Check the actual page layout. Approximate:
- Status banner skeleton at top (h-12 full width rounded)
- Two-column layout: left = order items + timeline, right = summary card
- Order item: image (h-20 w-20) + text lines
- Timeline: 4-5 dot+line skeletons vertically

#### D. Dashboard/My Listings — check if a seller dashboard listings page exists (e.g. `src/app/[locale]/dashboard/listings/` or `src/app/[locale]/(marketplace)/sell/listings/`). If it exists:
- Table or card grid skeleton matching the existing layout
- 5-6 row skeletons

### Important patterns
- Every `loading.tsx` exports a **default function** (not named export)
- Use `<Skeleton className="h-X w-Y rounded-md" />` — check the existing `Skeleton` component's API for exact prop patterns
- No animation classes needed — `Skeleton` likely already has pulse animation built in
- No translation keys needed — skeletons have no text

### Verification
- `pnpm build` passes
- Navigating to each route shows the skeleton before the real content streams in

### Commit
`feat: add loading.tsx skeletons for listing detail, browse, order detail`

---

## Task 3: Button Loading State

Extend the existing `Button` component to support a `loading` prop that shows a spinner and disables interaction.

### Steps

1. Open `src/components/ui/Button.tsx` (or wherever `Button` is defined — check `src/components/ui/index.ts` for the re-export path)
2. Read the existing component thoroughly before making changes
3. Add a `loading?: boolean` prop to the Button props interface
4. When `loading` is true:
   - Set `disabled={true}` on the underlying element (in addition to any explicit `disabled` prop)
   - Set `aria-busy="true"` for accessibility
   - Prepend a small spinner SVG before `children`. The spinner should be:
     ```tsx
     <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
       <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
       <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
     </svg>
     ```
   - Use `h-3 w-3` for `size="sm"`, `h-4 w-4` for `size="md"` (default), `h-5 w-5` for `size="lg"` — match spinner size to the button's text size
   - Add `cursor-not-allowed` to the disabled styling if not already present
5. Ensure the button width doesn't shift when toggling loading — use `inline-flex items-center justify-center` on the button (likely already there)

### Do NOT
- Create a separate `LoadingButton` component — extend the existing `Button`
- Change the public API for existing props — `loading` is purely additive

### Verification
- `pnpm build` passes
- Grep the codebase for existing `<Button` usages that pass `disabled` — confirm none break

### Commit
`feat: add loading prop to Button component with spinner`

---

## Task 4: Wire Up Loading States on Key Actions

Add `loading` states to buttons that trigger server actions or async operations. Use React `useTransition` for server actions and local `useState` for client-side async.

### Target buttons (find each in the codebase and update)

#### A. Place Bid button
- Find the bid placement form/button (likely in listing detail page or a bid component)
- It probably uses a server action or form submission
- Wrap the action call in `useTransition`: `const [isPending, startTransition] = useTransition()`
- Pass `loading={isPending}` to the `<Button>`

#### B. Accept / Decline Order buttons (seller flow)
- Find in the order detail page — there should be accept/decline actions for `pending_seller` status
- Same `useTransition` pattern
- Pass `loading={isPending}` to each button
- When one button is loading, disable the other too (prevent conflicting actions): pass `disabled={isPending}` to the non-loading button

#### C. Checkout / Pay button
- Find the checkout flow button that initiates payment
- Apply `loading` state during the redirect/payment initiation

#### D. Ship Order button (seller marks as shipped)
- Find the button sellers use to mark an order as shipped
- Same `useTransition` pattern

### Important patterns
- If the component is already a `"use client"` component, add `useTransition` directly
- If the component is a Server Component with a form action, check if there's already a client wrapper. If not, extract the button + action into a small client component (e.g. `AcceptOrderButton.tsx`) and import it into the server component
- **Do NOT convert entire page components to client components just for a loading state** — extract only the interactive part
- If you find existing `useState` + `setLoading` patterns for the same buttons, refactor them to `useTransition` for consistency (unless the action is not a server action — e.g., a client-side fetch should keep `useState`)
- Always reset loading state in error cases — `useTransition` handles this automatically for server actions (pending goes false on completion or error)
- Check for existing `formAction` patterns — if the button is inside a `<form action={serverAction}>`, use `useFormStatus` from `react-dom` instead of `useTransition`. Create a small `SubmitButton` wrapper if needed:
  ```tsx
  'use client'
  import { useFormStatus } from 'react-dom'
  import { Button } from '@/components/ui'
  
  export function SubmitButton({ children, ...props }) {
    const { pending } = useFormStatus()
    return <Button type="submit" loading={pending} disabled={pending} {...props}>{children}</Button>
  }
  ```

### Verification
- `pnpm build` passes
- Each button shows spinner during its action and is disabled until completion
- No double-submission is possible

### Commit
`feat: wire loading states to bid, order, checkout, and ship buttons`

---

## Final Verification

After all four tasks:
1. `pnpm build` — must pass clean
2. `pnpm lint` — must pass clean  
3. Manual check: navigate between listing browse → listing detail → back. Top bar animates, skeleton shows, real content streams in.
4. Verify no regressions: check that no existing functionality broke (especially button click handlers)

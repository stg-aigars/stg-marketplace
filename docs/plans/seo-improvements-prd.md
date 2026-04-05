# SEO Improvements: JSON-LD Structured Data & Sitemap Enhancements

## Context

We are adding structured data (JSON-LD) and enhancing the sitemap for Second Turn Games, a peer-to-peer board game marketplace for the Baltic region. The goal is to enable Google rich results (price, condition, availability in search snippets) and ensure all active listings are discoverable by search engines.

**Reference project:** Check `/Users/secondturn/stg-mvp` for any existing SEO patterns (sitemap generation, metadata helpers, JSON-LD, robots.txt). Reuse anything good from that codebase — adapt to the current stack and patterns described in `CLAUDE.md`.

**Current state:**
- `robots.txt` exists with security exclusions (`/api/`, `/auth/`, `/account/`, `/checkout/`)
- A sitemap exists (from Week 0) — likely static, needs to be made dynamic
- OpenGraph metadata exists on pages (page titles render correctly)
- No JSON-LD structured data exists anywhere

**Branch:** Work on `staging`. Single branch for all tasks.

---

## Task 1: JSON-LD helper utility

**Why:** Centralizes JSON-LD rendering with XSS sanitization. Every page that emits structured data uses this one helper.

**Files to create:**
- `src/lib/seo/json-ld.tsx`

**Install dependency:**
```bash
pnpm add -D schema-dts
```

**Implementation:**

Create a `JsonLd` React Server Component:

```tsx
import type { Thing, WithContext } from 'schema-dts'

interface JsonLdProps {
  data: WithContext<Thing> | WithContext<Thing>[]
}

export function JsonLd({ data }: JsonLdProps) {
  const json = JSON.stringify(data)
  // Sanitize to prevent XSS — replace < with unicode equivalent
  // per Next.js docs recommendation
  const sanitized = json.replace(/</g, '\\u003c')

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: sanitized }}
    />
  )
}
```

**Key rules:**
- This is a Server Component — no `'use client'`
- The `schema-dts` types provide compile-time validation of structured data shapes
- The `WithContext<Thing>` type accepts any Schema.org type with `@context` included
- Also accepts an array for pages that emit multiple JSON-LD blocks (e.g., Product + BreadcrumbList on the same page)
- The XSS sanitization replaces `<` with `\u003c` to prevent malicious strings in user-generated content (listing titles, seller names) from breaking out of the script tag

**Verify:** `pnpm build` passes.

**Commit:** `seo: add JSON-LD helper utility with XSS sanitization`

---

## Task 2: Organization + WebSite JSON-LD (site-wide)

**Why:** Tells search engines what Second Turn Games is as an entity and enables potential sitelinks search box.

**File to modify:** The root locale layout — likely `src/app/[locale]/layout.tsx` (the outermost server layout that wraps all pages). Find it by checking which layout is the top-level one that renders `<html>` and `<body>`.

**Implementation:**

Import `JsonLd` from Task 1 and render it inside the `<body>`, before `{children}`:

```tsx
import { JsonLd } from '@/lib/seo/json-ld'

// Inside the layout component, before {children}:
const baseUrl = env.app.url // or NEXT_PUBLIC_APP_URL — use whatever pattern exists

<JsonLd data={[
  {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Second Turn Games',
    url: baseUrl,
    logo: `${baseUrl}/images/logo.svg`,
    description: 'Pre-loved board games for the Baltic region',
    areaServed: [
      { '@type': 'Country', name: 'Latvia' },
      { '@type': 'Country', name: 'Lithuania' },
      { '@type': 'Country', name: 'Estonia' },
    ],
  },
  {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Second Turn Games',
    url: baseUrl,
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${baseUrl}/browse?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  },
]} />
```

**Important decisions:**
- Check if there's an actual logo file at `public/images/logo.svg` (or similar). Use whatever logo asset exists. If there's no standalone logo image file, use the OG image or omit the `logo` field.
- The `WebSite` SearchAction assumes `/browse?q=` works for search. Check the browse page — if it supports a `q` or `search` query parameter, use the correct param name. If browse has no text search at all, **omit the entire `WebSite` block** — we'll add it when search exists.
- Emit both Organization and WebSite as an array in a single `<JsonLd>` call — not two separate script tags.
- Use `env.app.url` or `process.env.NEXT_PUBLIC_APP_URL` — follow whatever pattern the existing codebase uses for the base URL. Never hardcode `https://secondturn.games`.

**Verify:** `pnpm build` passes. Run `pnpm dev`, view page source on homepage, confirm the `<script type="application/ld+json">` appears in the HTML body.

**Commit:** `seo: add Organization and WebSite JSON-LD to root layout`

---

## Task 3: Product JSON-LD on listing detail pages

**Why:** Highest-value structured data for a marketplace. Enables Google rich results with price, condition, and availability in search snippets.

**Files to create:**
- `src/lib/seo/listing-json-ld.ts` — pure function that builds the JSON-LD data
- `src/lib/seo/listing-json-ld.test.ts` — unit tests

**File to modify:**
- `src/app/[locale]/listings/[id]/page.tsx` — render the JSON-LD component

### 3a. Condition mapping constant

In `src/lib/seo/listing-json-ld.ts`:

```ts
// Schema.org only has NewCondition, UsedCondition, RefurbishedCondition.
// All STG conditions are pre-loved (used), so they all map to UsedCondition.
const SCHEMA_ITEM_CONDITION = 'https://schema.org/UsedCondition' as const
```

There is no need for a per-condition map — every STG listing is used. A single constant is cleaner.

### 3b. Availability mapping

```ts
// Map listing status to Schema.org availability
function getSchemaAvailability(status: string): string | null {
  switch (status) {
    case 'active':
      return 'https://schema.org/InStock'
    case 'reserved':
      return 'https://schema.org/LimitedAvailability'
    default:
      return null // Don't emit JSON-LD for sold/cancelled listings
  }
}
```

### 3c. Build function

Create a pure function `buildListingJsonLd` that accepts the listing data, game metadata, seller info, and base URL. Return a `WithContext<Product>` object (from `schema-dts`).

**Input types** — use whatever types already exist in the codebase for listing, game, and seller/profile. Don't create new types; pick the minimum fields needed:

```ts
interface ListingJsonLdInput {
  // From the listing
  id: string
  title: string // the game name as displayed
  priceCents: number
  status: string
  conditionKey: string // 'like_new' | 'very_good' | 'good' | 'acceptable' | 'for_parts'
  conditionLabel: string // human-readable, e.g. "Very Good"
  sellerNotes: string | null
  updatedAt: string

  // From the game metadata
  description: string | null // BGG description — use first 200 chars
  yearPublished: number | null

  // Images — ordered: seller photos first, then BGG image
  imageUrls: string[]

  // From the edition/version
  publisher: string | null
  language: string | null

  // From the seller
  sellerName: string

  // Auction-specific (null for fixed-price)
  isAuction: boolean
  currentBidCents: number | null
  auctionEndsAt: string | null
}
```

**Build logic:**

```ts
import type { WithContext, Product } from 'schema-dts'

export function buildListingJsonLd(
  input: ListingJsonLdInput,
  baseUrl: string
): WithContext<Product> | null {
  const availability = getSchemaAvailability(input.status)
  if (!availability) return null // Don't emit for sold/cancelled

  // Price: convert cents to decimal string
  const price = (input.priceCents / 100).toFixed(2)

  // Description: game condition + seller notes, max 200 chars
  const descriptionParts = [`Pre-loved board game in ${input.conditionLabel} condition`]
  if (input.sellerNotes) {
    descriptionParts.push(input.sellerNotes)
  }
  const description = descriptionParts.join('. ').slice(0, 200)

  const jsonLd: WithContext<Product> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: input.title,
    description,
    sku: input.id,
    url: `${baseUrl}/listings/${input.id}`,
    offers: {
      '@type': 'Offer',
      url: `${baseUrl}/listings/${input.id}`,
      priceCurrency: 'EUR',
      price,
      itemCondition: SCHEMA_ITEM_CONDITION,
      availability,
      seller: {
        '@type': 'Person',
        name: input.sellerName,
      },
    },
  }

  // Images — use raw Supabase storage URLs, NOT _next/image proxy URLs.
  // Google needs stable, directly crawlable image URLs.
  if (input.imageUrls.length > 0) {
    jsonLd.image = input.imageUrls
  }

  // Brand — only include if publisher is known
  if (input.publisher) {
    jsonLd.brand = {
      '@type': 'Brand',
      name: input.publisher,
    }
  }

  // For auctions: override price with current bid or starting price
  if (input.isAuction && input.currentBidCents !== null) {
    (jsonLd.offers as Record<string, unknown>).price = (input.currentBidCents / 100).toFixed(2)
  }

  return jsonLd
}
```

**Critical rules:**
- **Never use floats for money internally.** The cents → string conversion `(cents / 100).toFixed(2)` happens only at the JSON-LD boundary. The function receives integer cents.
- **Images:** Use the raw Supabase storage URLs (e.g., `https://tfxqbtcdkzdwfgsivvet.supabase.co/storage/v1/object/public/listing-photos/...`), not the Next.js `_next/image` proxy URLs. The `_next/image` URLs require query params and may not be crawlable. For BGG images, use the `cf.geekdo-images.com` URLs directly.
- **Seller photos come first** in the images array, then the BGG cover image. The first image is what Google may show in rich results — actual product photos are more relevant than the generic box art.
- **Don't dump the full BGG description** into the Product description. The JSON-LD description should be about *this specific copy* (condition + seller notes), not a 500-word game overview.

### 3d. Render in the listing page

In the listing detail page server component, after fetching the listing data (which already happens for the page render), call `buildListingJsonLd` and render:

```tsx
import { JsonLd } from '@/lib/seo/json-ld'
import { buildListingJsonLd } from '@/lib/seo/listing-json-ld'

// Inside the page component, after data fetching:
const listingJsonLd = buildListingJsonLd(
  {
    id: listing.id,
    title: listing.title, // or game.name — whatever the page already uses
    priceCents: listing.price_cents,
    status: listing.status,
    conditionKey: listing.condition,
    conditionLabel: /* use the same condition label the page already displays */,
    sellerNotes: listing.seller_notes,
    updatedAt: listing.updated_at,
    description: game.description,
    yearPublished: game.year_published,
    imageUrls: [
      ...listing.photos.map(p => p.url), // raw Supabase URLs
      ...(game.image_url ? [game.image_url] : []),
    ],
    publisher: listing.publisher, // from edition/version data
    language: listing.language,
    sellerName: seller.display_name,
    isAuction: listing.listing_type === 'auction', // or however auction type is determined
    currentBidCents: listing.current_bid_cents ?? null,
    auctionEndsAt: listing.auction_ends_at ?? null,
  },
  env.app.url
)

// In the JSX return:
{listingJsonLd && <JsonLd data={listingJsonLd} />}
```

**Adapt the field names** to match whatever the actual listing/game/seller data shapes are in the codebase. The names above are guesses — look at the actual page component's existing data fetching to find the correct property names.

### 3e. Unit tests

**File:** `src/lib/seo/listing-json-ld.test.ts`

Test cases:
1. **Fixed-price active listing** — returns valid Product JSON-LD with InStock availability
2. **Reserved listing** — returns LimitedAvailability
3. **Sold listing** — returns `null` (no JSON-LD)
4. **Price formatting** — 1629 cents → `"16.29"`, 741 cents → `"7.41"`, 10000 cents → `"100.00"`
5. **No publisher** — brand field is omitted entirely (not `null`, not empty string)
6. **No images** — image field is omitted
7. **Seller notes included** — description includes notes, capped at 200 chars
8. **Auction listing** — uses current bid as price
9. **XSS in title** — a listing title containing `<script>` doesn't break the JSON structure (this is handled by the JsonLd component sanitization, but good to verify the data function doesn't choke on it)

Follow existing test conventions: co-located file, `describe` per function, `it` per behavior.

**Verify:** `pnpm test` passes. `pnpm build` passes.

**Commit:** `seo: add Product JSON-LD to listing detail pages`

---

## Task 4: BreadcrumbList JSON-LD on listing detail pages

**Why:** Shows "Second Turn Games › Browse › The Castles of Burgundy" in Google search results instead of just the raw URL.

**Files to create:**
- `src/lib/seo/breadcrumb-json-ld.ts`

**Implementation:**

```ts
import type { WithContext, BreadcrumbList } from 'schema-dts'

interface BreadcrumbItem {
  name: string
  url?: string // omit for the current (terminal) page
}

export function buildBreadcrumbJsonLd(
  items: BreadcrumbItem[],
  baseUrl: string
): WithContext<BreadcrumbList> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem' as const,
      position: index + 1,
      name: item.name,
      ...(item.url ? { item: item.url.startsWith('http') ? item.url : `${baseUrl}${item.url}` } : {}),
    })),
  }
}
```

**Render in the listing detail page** (same page as Task 3):

```tsx
import { buildBreadcrumbJsonLd } from '@/lib/seo/breadcrumb-json-ld'

const breadcrumbJsonLd = buildBreadcrumbJsonLd(
  [
    { name: 'Second Turn Games', url: '/' },
    { name: 'Browse', url: '/browse' },
    { name: listing.title }, // terminal — no URL
  ],
  env.app.url
)

// Combine with the Product JSON-LD in a single JsonLd call:
{listingJsonLd && <JsonLd data={[listingJsonLd, breadcrumbJsonLd]} />}
// Or two separate calls — either is fine, both produce valid JSON-LD.
```

**Key rules:**
- The terminal breadcrumb (current page) intentionally omits the `item` URL — Schema.org spec says this is correct for the current page
- URLs that don't start with `http` get the baseUrl prepended
- This utility is generic — it will be reused on seller profile pages later

**Verify:** `pnpm build` passes.

**Commit:** `seo: add BreadcrumbList JSON-LD to listing detail pages`

---

## Task 5: Dynamic sitemap with active listings

**Why:** The current sitemap is likely static. A dynamic sitemap ensures every active listing and seller profile is discoverable by search engines.

**File to modify:** `src/app/sitemap.ts` (replace contents if it exists, or create it)

**Implementation:**

```ts
import type { MetadataRoute } from 'next'
import { createServiceClient } from '@/lib/supabase/server'
// Use whatever the service role client import is — check existing cron routes for the pattern.
// It might be createClient with service role, or a dedicated createServiceClient.

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://secondturn.games'

export const revalidate = 3600 // Regenerate every hour via ISR

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = createServiceClient()

  // --- Static pages ---
  const staticPages: MetadataRoute.Sitemap = [
    { url: `${BASE_URL}`,         lastModified: new Date(), changeFrequency: 'daily',   priority: 1.0 },
    { url: `${BASE_URL}/browse`,  lastModified: new Date(), changeFrequency: 'daily',   priority: 0.9 },
    { url: `${BASE_URL}/wanted`,  lastModified: new Date(), changeFrequency: 'daily',   priority: 0.7 },
    { url: `${BASE_URL}/sell`,    lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE_URL}/help`,    lastModified: new Date(), changeFrequency: 'monthly', priority: 0.3 },
    { url: `${BASE_URL}/terms`,   lastModified: new Date(), changeFrequency: 'yearly',  priority: 0.2 },
    { url: `${BASE_URL}/privacy`, lastModified: new Date(), changeFrequency: 'yearly',  priority: 0.2 },
    { url: `${BASE_URL}/contact`, lastModified: new Date(), changeFrequency: 'yearly',  priority: 0.3 },
  ]

  // --- Active listings ---
  const { data: listings } = await supabase
    .from('listings')
    .select('id, updated_at')
    .eq('status', 'active')
    .order('updated_at', { ascending: false })

  const listingPages: MetadataRoute.Sitemap = (listings ?? []).map((listing) => ({
    url: `${BASE_URL}/listings/${listing.id}`,
    lastModified: new Date(listing.updated_at),
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }))

  // --- Seller profiles (only sellers with active listings) ---
  const { data: sellers } = await supabase
    .from('listings')
    .select('seller_id, updated_at')
    .eq('status', 'active')
    .order('updated_at', { ascending: false })

  // Deduplicate sellers — keep the most recent updated_at per seller
  const sellerMap = new Map<string, string>()
  for (const row of sellers ?? []) {
    if (!sellerMap.has(row.seller_id)) {
      sellerMap.set(row.seller_id, row.updated_at)
    }
  }

  const sellerPages: MetadataRoute.Sitemap = Array.from(sellerMap.entries()).map(
    ([sellerId, updatedAt]) => ({
      url: `${BASE_URL}/sellers/${sellerId}`,
      lastModified: new Date(updatedAt),
      changeFrequency: 'weekly' as const,
      priority: 0.5,
    })
  )

  return [...staticPages, ...listingPages, ...sellerPages]
}
```

**Key decisions:**
- **Service role client** is required because the sitemap runs without a user session. Check how existing cron routes create their Supabase client — the sitemap should use the same pattern. This might be `createClient()` from `@/lib/supabase/server` called without cookies, or a dedicated service client. Look at `src/app/api/cron/` for the pattern.
- **`revalidate = 3600`** — the sitemap regenerates hourly via ISR. Not on every request (wasteful), not fully static (listings change). One hour is a good balance.
- **Only `active` listings** go in the sitemap. Reserved listings are temporarily unavailable; sold/cancelled are irrelevant for search. This also means the sitemap naturally shrinks as items sell.
- **Seller deduplication** — a seller with 5 active listings still gets one sitemap entry. The `Map` approach keeps the most recent `updated_at` since results are ordered descending.
- **`changeFrequency` and `priority`** — Google ignores these, but Bing and Yandex may use them. Zero cost to include.
- **No `generateSitemaps` pagination needed** — at current scale (dozens of listings), a single sitemap file is well under the 50,000 URL limit.
- Verify the actual static page routes exist — check if `/wanted` is a real route. If any listed static page doesn't exist, remove it from the array.

**Verify:** `pnpm build` passes. Run `pnpm dev` and visit `http://localhost:3000/sitemap.xml` — confirm listing URLs and seller URLs appear.

**Commit:** `seo: dynamic sitemap with active listings and seller profiles`

---

## Task 6: Update robots.txt

**Why:** Ensure the sitemap URL is explicitly referenced.

**File to check/modify:** Either `src/app/robots.ts` or `public/robots.txt` — find whichever exists.

**Expected content** (if using `robots.ts`):

```ts
import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://secondturn.games'

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/auth/', '/account/', '/checkout/', '/admin/'],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  }
}
```

**If `public/robots.txt` exists instead**, ensure it has:
```
User-agent: *
Allow: /
Disallow: /api/
Disallow: /auth/
Disallow: /account/
Disallow: /checkout/
Disallow: /admin/

Sitemap: https://secondturn.games/sitemap.xml
```

**Recommendation:** If the current implementation is a static `public/robots.txt`, migrate it to `src/app/robots.ts` for consistency with the dynamic `sitemap.ts` and to avoid hardcoding the domain.

**Key check:** The security audit (Task 7 from the security plan) already added the disallow rules. This task is primarily about ensuring the `Sitemap:` line is present and pointing to the correct URL. If it's already there, no change needed.

**Verify:** `pnpm build` passes. Visit `http://localhost:3000/robots.txt` — confirm the sitemap reference appears.

**Commit:** `seo: ensure robots.txt references sitemap` (only if changes were needed)

---

## Task 7: Metadata enhancements on listing detail page

**Why:** While adding JSON-LD, audit and improve the existing `generateMetadata` on listing pages to ensure OpenGraph and basic meta tags are complete.

**File to check:** `src/app/[locale]/listings/[id]/page.tsx` — find the `generateMetadata` export.

**Ensure the following are present:**

```ts
export async function generateMetadata({ params }): Promise<Metadata> {
  // ... existing data fetch ...

  return {
    title: `${listing.title} | Second Turn Games`,
    description: `Pre-loved ${listing.title} in ${conditionLabel} condition. ${price} — ships across Latvia, Lithuania, Estonia.`,
    openGraph: {
      title: `${listing.title} — ${price}`,
      description: `${conditionLabel} condition. Ships across the Baltics.`,
      url: `${baseUrl}/listings/${listing.id}`,
      siteName: 'Second Turn Games',
      images: [
        {
          url: primaryImageUrl, // first seller photo, or BGG image
          width: 1200,
          height: 630,
          alt: listing.title,
        },
      ],
      type: 'website', // 'product' is not a standard OG type
    },
  }
}
```

**Only modify if improvements are needed.** If the existing `generateMetadata` already has good title, description, and OpenGraph with images, leave it alone. The key things to check:
- Is there a `description` meta tag? (Important for search snippets)
- Does OpenGraph include an image? (Important for social sharing)
- Is the title format consistent with other pages?

**Do not break existing metadata** — only add missing fields.

**Verify:** `pnpm build` passes.

**Commit:** `seo: enhance listing page metadata` (only if changes were needed)

---

## Execution Order

```
Task 1 (JSON-LD utility)          — foundation for all JSON-LD tasks
  ↓
Task 2 (Organization + WebSite)   — site-wide, root layout
  ↓
Task 3 (Product JSON-LD)          — highest value, listing pages
  ↓
Task 4 (BreadcrumbList)           — listing pages, uses same utility
  ↓
Task 5 (Dynamic sitemap)          — independent of JSON-LD but benefits from it
  ↓
Task 6 (robots.txt)               — quick check/update
  ↓
Task 7 (Metadata audit)           — quick check/update
```

Run `pnpm build` after every task. Commit after every task with the specified message.

---

## Files Summary

**New files:**
- `src/lib/seo/json-ld.tsx`
- `src/lib/seo/listing-json-ld.ts`
- `src/lib/seo/listing-json-ld.test.ts`
- `src/lib/seo/breadcrumb-json-ld.ts`

**Modified files:**
- `src/app/[locale]/layout.tsx` (or whichever is the root layout) — add Organization + WebSite JSON-LD
- `src/app/[locale]/listings/[id]/page.tsx` — add Product + Breadcrumb JSON-LD, audit metadata
- `src/app/sitemap.ts` — replace with dynamic version
- `src/app/robots.ts` or `public/robots.txt` — ensure sitemap reference

**New dev dependency:**
- `schema-dts` (TypeScript types for Schema.org)

---

## What is explicitly out of scope

- `ItemList` JSON-LD on the browse page (low value for Google — they prefer Product on detail pages)
- `hreflang` alternates in sitemap (no Latvian locale yet)
- Google Merchant Center feed (separate effort)
- Twitter/X card meta tags
- `next-sitemap` npm package (built-in Next.js `sitemap.ts` is sufficient at this scale)
- JSON-LD on seller profile pages (can be added later with `Person` or `Organization` type)

---

## Validation

After all tasks are complete:

1. `pnpm build` passes
2. `pnpm test` passes (new tests in Task 3e)
3. Visit `http://localhost:3000/sitemap.xml` — confirm listing and seller URLs appear
4. Visit `http://localhost:3000/robots.txt` — confirm sitemap reference
5. View page source on a listing detail page — confirm `<script type="application/ld+json">` contains Product data
6. View page source on homepage — confirm Organization JSON-LD
7. Paste a listing URL into Google's Rich Results Test (https://search.google.com/test/rich-results) — confirm "Product" is detected with price, availability, and condition

# Image Pipeline Audit

**Date:** 2026-04-25
**Scope:** End-to-end image lifecycle — upload, storage, serving, hero/static, CDN/caching, dependencies.
**Stance:** Read-only. No code changes proposed; sequencing only.
**Stack at time of audit:** Next 16.2.1, React 19, Sharp 0.34.5. See [package.json](../../package.json).

---

## 1. Current state

### 1.1 Upload pipeline (listing photos)

Server route: [src/app/api/listings/photos/route.ts](../../src/app/api/listings/photos/route.ts).

- Per-user photo cap: 100 across all listings, enforced server-side at [route.ts:19-29](../../src/app/api/listings/photos/route.ts#L19-L29) via a Storage `list()` count.
- Per-listing photo cap: 8 (`MAX_PHOTOS`), enforced client-side at [PhotoUploadStep.tsx:140-144](../../src/app/[locale]/sell/_components/PhotoUploadStep.tsx#L140-L144) and indirectly server-side via the listing-write path.
- Per-file size cap: 10 MiB (`MAX_PHOTO_SIZE_BYTES`), enforced both client-side ([PhotoUploadStep.tsx:154-157](../../src/app/[locale]/sell/_components/PhotoUploadStep.tsx#L154-L157)) and server-side at [route.ts:32-55](../../src/app/api/listings/photos/route.ts#L32-L55) (Content-Length pre-check + actual file size).
- Allowed MIME types: `image/jpeg`, `image/png`, `image/webp`, `image/avif`. Constants at [src/lib/listings/types.ts:110-112](../../src/lib/listings/types.ts#L110-L112). Server validates via magic-byte sniff at [src/lib/images/process.ts:10-57](../../src/lib/images/process.ts#L10-L57), not via the user-supplied `Content-Type`.
- Client-side processing before upload: **none.** [PhotoUploadStep.tsx:165-184](../../src/app/[locale]/sell/_components/PhotoUploadStep.tsx#L165-L184) submits the raw file via `FormData` directly. No resize, no re-encode, no client compression library is installed (see §6).
- Server-side processing: EXIF metadata stripped via Sharp at [process.ts:63-72](../../src/lib/images/process.ts#L63-L72). The pipeline is `sharp(buffer, { limitInputPixels: 25_000_000 }).rotate()` (auto-orientation, drops EXIF) followed by format-specific re-encode (JPEG quality 90, PNG default, WebP quality 90, AVIF quality 75). **No `.resize()` is called.** A 12-megapixel phone photo (4032×3024) stays at 4032×3024 in storage; a 10 MiB upload stays roughly that size in storage.
- Bucket path convention: `{user_id}/{uuid}.{extension}` ([route.ts:69](../../src/app/api/listings/photos/route.ts#L69)).
- Rate limiting: `photoUploadLimiter` applied at [route.ts:9](../../src/app/api/listings/photos/route.ts#L9) (and on the avatar route).

### 1.2 Upload pipeline (avatars)

Server route: [src/app/api/profile/avatar/route.ts](../../src/app/api/profile/avatar/route.ts).

- Size cap: 2 MiB ([route.ts:8](../../src/app/api/profile/avatar/route.ts#L8), [route.ts:38-40](../../src/app/api/profile/avatar/route.ts#L38-L40)).
- Allowed MIME types: JPEG, PNG, WebP (no AVIF; narrower than listing photos) ([route.ts:10](../../src/app/api/profile/avatar/route.ts#L10)).
- **Server-side resize present**: 256×256 `cover` fit at [route.ts:53-55](../../src/app/api/profile/avatar/route.ts#L53-L55), then EXIF strip. This is the only resize step on the platform.
- Bucket path convention: `{user_id}/avatar.{extension}` ([route.ts:68](../../src/app/api/profile/avatar/route.ts#L68)), uploaded with `upsert: true`. Old file at the previous extension is removed at [route.ts:92-94](../../src/app/api/profile/avatar/route.ts#L92-L94) after successful upload + DB update.
- Cache-bust query string: `?v=${Date.now()}` appended at upload and persisted into `user_profiles.avatar_url` ([route.ts:79](../../src/app/api/profile/avatar/route.ts#L79)). One-shot per upload, not per render.

### 1.3 Upload pipeline (dispute photos)

Referenced from [src/components/orders/DisputeDetails.tsx](../../src/components/orders/DisputeDetails.tsx) and DisputeForm. Bucket name `dispute-photos` is referenced in code; bucket-level RLS not surfaced in this audit (see §3).

### 1.4 Storage layout

Buckets referenced in code:

- `listing-photos` — listing photos. Path: `{user_id}/{uuid}.{ext}`. Public read.
- `avatars` — user profile avatars. Path: `{user_id}/avatar.{ext}`. Public read.
- `dispute-photos` — dispute evidence. Path convention referenced in dispute upload code (not re-verified here).

All three are public buckets accessed via `getPublicUrl()` (no signed URLs). Storage URL pattern: `{SUPABASE_URL}/storage/v1/object/public/{bucket}/{path}`.

### 1.5 Lifecycle / cleanup

Cron job: [src/app/api/cron/cleanup-photos/route.ts](../../src/app/api/cron/cleanup-photos/route.ts). Runs every 6 h per CLAUDE.md.

- Auth: `Authorization: Bearer ${env.cron.secret}` at [cleanup-photos/route.ts:12-15](../../src/app/api/cron/cleanup-photos/route.ts#L12-L15).
- Strategy: builds set of all photo paths referenced by *any* listing regardless of status ([route.ts:24-43](../../src/app/api/cron/cleanup-photos/route.ts#L24-L43)), then walks the entire `listing-photos` bucket folder-by-folder ([route.ts:50-84](../../src/app/api/cron/cleanup-photos/route.ts#L50-L84)). Files older than the 2-hour `GRACE_PERIOD_MS` ([route.ts:6](../../src/app/api/cron/cleanup-photos/route.ts#L6)) and not in the active set are flagged.
- Safety cap: `MAX_DELETIONS = 500` per run ([route.ts:9](../../src/app/api/cron/cleanup-photos/route.ts#L9)). When exceeded, the job logs a warning at [route.ts:87-91](../../src/app/api/cron/cleanup-photos/route.ts#L87-L91) and only deletes the first 500.
- Cleanup is `listing-photos` only. The `avatars` bucket relies on the inline old-file deletion in the avatar upload route ([avatar/route.ts:92-94](../../src/app/api/profile/avatar/route.ts#L92-L94)) and the `DELETE` handler at [avatar/route.ts:99-130](../../src/app/api/profile/avatar/route.ts#L99-L130). No cron sweep for orphaned avatars or dispute photos.

### 1.6 Serving (`next.config.mjs`)

[next.config.mjs:89-101](../../next.config.mjs#L89-L101):

```
images: {
  minimumCacheTTL: 2592000, // 30 days
  remotePatterns: [
    { protocol: 'https', hostname: 'cf.geekdo-images.com' },
    { protocol: 'https', hostname: '*.supabase.co' },
  ],
}
```

Not configured (Next 16.2.1 defaults apply):
- `formats` — Next 16 default is `['image/webp']` only. Verified by reading `node_modules/next/dist/shared/lib/image-config.js` `imageConfigDefault.formats`. **AVIF is not served.**
- `deviceSizes` — defaults to `[640, 750, 828, 1080, 1200, 1920, 2048, 3840]`.
- `imageSizes` — Next defaults.
- No `unoptimized: true` global flag. No custom `loader`. No `dangerouslyAllowSVG`.

### 1.7 Serving (component inventory)

Files importing `next/image`:

- [src/app/[locale]/account/bids/page.tsx](../../src/app/[locale]/account/bids/page.tsx) — bids list thumb
- [src/app/[locale]/account/wanted/WantedListingsManager.tsx](../../src/app/[locale]/account/wanted/WantedListingsManager.tsx)
- [src/app/[locale]/listings/[id]/PhotoGallery.tsx](../../src/app/[locale]/listings/[id]/PhotoGallery.tsx) — listing detail gallery + lightbox
- [src/app/[locale]/listings/[id]/edit/EditListingForm.tsx](../../src/app/[locale]/listings/[id]/edit/EditListingForm.tsx)
- [src/app/[locale]/sell/_components/GameSearchStep.tsx](../../src/app/[locale]/sell/_components/GameSearchStep.tsx)
- [src/app/[locale]/sell/_components/PhotoUploadStep.tsx](../../src/app/[locale]/sell/_components/PhotoUploadStep.tsx) — sortable upload tiles
- [src/app/[locale]/sell/_components/ReviewPriceStep.tsx](../../src/app/[locale]/sell/_components/ReviewPriceStep.tsx)
- [src/app/[locale]/staff/disputes/[id]/page.tsx](../../src/app/[locale]/staff/disputes/[id]/page.tsx)
- [src/app/[locale]/staff/orders/[id]/page.tsx](../../src/app/[locale]/staff/orders/[id]/page.tsx)
- [src/app/[locale]/wanted/[id]/page.tsx](../../src/app/[locale]/wanted/[id]/page.tsx)
- [src/components/listings/ListingCard.tsx](../../src/components/listings/ListingCard.tsx) — browse + homepage tiles
- [src/components/listings/ListingCardMini.tsx](../../src/components/listings/ListingCardMini.tsx) — mobile compact tile
- [src/components/listings/atoms/GameThumb.tsx](../../src/components/listings/atoms/GameThumb.tsx) — universal thumb (cart, orders, comments, etc.)
- [src/components/orders/DisputeDetails.tsx](../../src/components/orders/DisputeDetails.tsx)
- [src/components/orders/DisputeForm.tsx](../../src/components/orders/DisputeForm.tsx)
- [src/components/wanted/WantedListingCard.tsx](../../src/components/wanted/WantedListingCard.tsx)

Universal pattern across the listing surfaces: `<Image fill sizes="…" unoptimized={isBggImage(src)}>` with the `isBggImage()` gate from [src/lib/bgg/utils.ts:47-49](../../src/lib/bgg/utils.ts#L47-L49). BGG-hosted images bypass `/_next/image` and load direct from `cf.geekdo-images.com`; Supabase-hosted (user-uploaded) images flow through `/_next/image`.

Notable per-component details (verified):

- **GameThumb** ([GameThumb.tsx:28-35](../../src/components/listings/atoms/GameThumb.tsx#L28-L35)): `sizes={`${px}px`}` matched to the rendered size (40/48/56/96 px). Correct.
- **ListingCard** ([ListingCard.tsx:74-81](../../src/components/listings/ListingCard.tsx#L74-L81)): `sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"`. Correct.
- **ListingCardMini** ([ListingCardMini.tsx:38-45](../../src/components/listings/ListingCardMini.tsx#L38-L45)): `sizes="50vw"`. Correct.
- **PhotoGallery** ([PhotoGallery.tsx:168-176](../../src/app/[locale]/listings/[id]/PhotoGallery.tsx#L168-L176)): main image carries `priority={activeIndex === 0}` — the only `priority` flag in the codebase. Lightbox image at [PhotoGallery.tsx:104-111](../../src/app/[locale]/listings/[id]/PhotoGallery.tsx#L104-L111) and thumbnail strip at [PhotoGallery.tsx:198-205](../../src/app/[locale]/listings/[id]/PhotoGallery.tsx#L198-L205) use appropriate sizes.
- **DisputeDetails** ([DisputeDetails.tsx:54-60](../../src/components/orders/DisputeDetails.tsx#L54-L60)): `<Image fill sizes="(min-width: 640px) 25vw, 50vw">`. Width/height handled via `fill` + the wrapping `relative aspect-square` container at [DisputeDetails.tsx:52](../../src/components/orders/DisputeDetails.tsx#L52). Correct.
- **Bids page thumb** ([account/bids/page.tsx:78-83](../../src/app/[locale]/account/bids/page.tsx#L78-L83)): `<Image fill sizes="56px">` — but **no `unoptimized={isBggImage(bid.thumbnail)}` flag.** When `bid.thumbnail` is a BGG-hosted URL (the common case), this routes through `/_next/image` instead of direct geekdo CDN, generating VPS optimization work for no visual benefit. Inconsistent with every other listing-image surface in the codebase.

`blurDataURL` / `placeholder="blur"`: not used anywhere (verified by grep across `src/`).

### 1.8 Plain `<img>` usage (intentional)

- [src/components/ui/avatar.tsx:26-35](../../src/components/ui/avatar.tsx#L26-L35) — plain `<img>` with `eslint-disable @next/next/no-img-element` and inline justification: small avatar with `onError` → initials fallback. Renders on seller pages, comments, headers, settings, listing detail, account header. Always with `object-cover` and explicit Tailwind sizing (5–16 in `sizeClasses` at [avatar.tsx:13-19](../../src/components/ui/avatar.tsx#L13-L19)).
- [src/components/layout/SiteFooter.tsx:40,72,80,88](../../src/components/layout/SiteFooter.tsx#L40) — favicon SVG + 3 partner logos (BoardGameGeek, EveryPay, Unisend). All SVG, all with explicit `width`/`height`, all eslint-disabled with the comment "SVG logo, next/image adds no value for vectors."
- [src/components/layout/SiteHeader.tsx:86](../../src/components/layout/SiteHeader.tsx#L86) — favicon SVG. Same pattern.

### 1.9 Hero / static / marketing images

Homepage hero: [src/app/[locale]/page.tsx:63](../../src/app/[locale]/page.tsx#L63) renders the hero as a CSS `background-image`:

```
<section className="… bg-[#363e4b] lg:bg-[url('/images/hero-bg-2.webp')] lg:bg-cover lg:bg-center">
```

Mobile (< lg breakpoint, ≤ 1024 px): solid color background, no image. Desktop: WebP background. Not a `next/image` element, so `priority`, responsive `sizes`, and the `<link rel=preload>` Next would emit are all unavailable for this asset. `bgg-logo.jpeg` is rendered through `<Image>` inside [PhotoGallery.tsx:114](../../src/app/[locale]/listings/[id]/PhotoGallery.tsx#L114) and [PhotoGallery.tsx:179](../../src/app/[locale]/listings/[id]/PhotoGallery.tsx#L179) with explicit width/height (correct).

Inventory of `public/` images (sizes via `wc -c`, verified during this audit):

| File | Bytes | Notes |
|---|---:|---|
| `public/images/hero-bg-2.png` | 2,272,119 | Apparent PNG fallback for `hero-bg-2.webp` — not referenced by any code path found. |
| `public/images/hero-bg.png` | 2,155,511 | Older PNG hero — not referenced. |
| `public/images/hero-bg-2.webp` | 147,796 | Current hero (referenced at page.tsx:63). |
| `public/images/hero-bg.webp` | 113,194 | Older WebP hero — not referenced. |
| `public/images/bgg-logo.jpeg` | 5,865 | Used in PhotoGallery. |
| `public/icons/icon-{192,512,maskable-192,maskable-512}.png` | 2,288–10,346 each | PWA manifest icons. `icon-192.png` also used in transactional emails (see §1.11). |
| `public/apple-touch-icon.png` | 2,366 | Apple touch icon. |
| `public/favicon.svg` | 260 | Favicon. |
| `public/{everypay,unisend}_logo.svg` and `images/powered-by-bgg.svg` | small | Footer logos. |
| **Total in `public/`** | **4,722,035 (≈4.5 MiB)** | Of which roughly 4.4 MiB is PNG hero variants. |

**Reference-presence verified by grep on `hero-bg`, `hero-bg-2`:** only `hero-bg-2.webp` matches a code-path string anywhere in `src/`.

### 1.10 OG / metadata / social-share images

- Root metadata at [src/app/[locale]/layout.tsx:46-69](../../src/app/[locale]/layout.tsx#L46-L69) declares `openGraph` (type, siteName, title, description, url) and `twitter: { card: 'summary' }` — but **no `images` field on either**. Icons block declares `/favicon.svg` and `/apple-touch-icon.png` only.
- Per-page `openGraph` blocks exist at [src/app/[locale]/page.tsx:16](../../src/app/[locale]/page.tsx#L16), [src/app/[locale]/wanted/page.tsx:19](../../src/app/[locale]/wanted/page.tsx#L19), [src/app/[locale]/sellers/[id]/page.tsx:61](../../src/app/[locale]/sellers/[id]/page.tsx#L61), [src/app/[locale]/wanted/[id]/page.tsx:30](../../src/app/[locale]/wanted/[id]/page.tsx#L30), [src/app/[locale]/browse/page.tsx:35](../../src/app/[locale]/browse/page.tsx#L35), [src/app/[locale]/listings/[id]/page.tsx:131](../../src/app/[locale]/listings/[id]/page.tsx#L131). None populate `images`.
- No `opengraph-image.{tsx,jpg,png}` or `twitter-image.{tsx,jpg,png}` files exist anywhere under `src/app/` (verified by `find`).
- A single `src/app/icon.png` exists (Next-routed icon).

Net effect: every share to Slack, WhatsApp, Discord, Facebook, LinkedIn, Twitter, iMessage renders without a card image. Listing detail shares — the most likely conversion vector for a marketplace — fall back to text-only.

### 1.11 Transactional emails

- [src/lib/email/templates/layout.tsx:84-90](../../src/lib/email/templates/layout.tsx#L84-L90) — single `Img` from `@react-email/components` referencing `${env.app.url}/icons/icon-192.png` (the 2.3 KiB PWA icon). No listing photos appear in any react-email template.
- [src/lib/email/index.ts](../../src/lib/email/index.ts) — message templates pass `listingUrl` strings only; no photo URLs are inlined.
- [supabase/templates/*.html](../../supabase/templates/) — all six Supabase auth email templates (`confirm-signup`, `email-change`, `invite`, `magic-link`, `reauthentication`, `reset-password`) reference the same hardcoded `https://secondturn.games/icons/icon-192.png`.

Email image surface area is the icon only.

### 1.12 CDN / caching layer

Cloudflare proxy (orange cloud) on `secondturn.games`. Documented at [docs/cloudflare-cache-purge-setup.md](../../docs/cloudflare-cache-purge-setup.md). Cache rules live in the Cloudflare dashboard, not in code:

| Priority | Match | Action |
|---:|---|---|
| 1 | URI path starts with `/_next/static/` | Eligible for cache, Edge TTL 1 year |
| 2 | URI path starts with `/_next/image` | Eligible for cache, Edge TTL 1 day |
| 3 | All incoming requests | Bypass cache |

Origin-side `Cache-Control` rules in [next.config.mjs:15-87](../../next.config.mjs#L15-L87): static assets `immutable` + 1y; public pages `public, s-maxage=60, stale-while-revalidate=300`; authenticated routes `no-cache, no-store, must-revalidate`. No origin-side rule specifically for `/_next/image` or for Supabase Storage URLs (none would matter for storage URLs anyway, since they don't pass through Next).

Middleware excludes `/_next/image` from the matcher at [src/middleware.ts:113](../../src/middleware.ts#L113), so CSP nonce injection and i18n routing don't run on image traffic.

Post-deploy purge script: [scripts/purge-cloudflare-cache.sh:14-18](../../scripts/purge-cloudflare-cache.sh#L14-L18) calls Cloudflare's `/purge_cache` endpoint with `{"purge_everything": true}`. This invalidates the `/_next/static/` rule (correct — chunk hashes change on deploy) and the `/_next/image` rule (collateral — image content didn't change).

### 1.13 Image-optimization cache on origin

Production runs in a Docker container on Hetzner via Coolify. [Dockerfile](../../Dockerfile) is at the repo root (the audit plan referenced `src/app/Dockerfile`, which does not exist).

- Stage 4 (runner) at [Dockerfile:26-52](../../Dockerfile#L26-L52) copies `.next/standalone`, `.next/static`, and `public/` into the image. **`.next/cache/images` is not in any `COPY` and no `VOLUME` directive declares it.** Whether Coolify mounts a persistent volume at that path is configured in the Coolify dashboard, outside this codebase, and cannot be verified from the audit. See open question O-1.
- Sharp's musl-linux native bindings are layered in via stage 3 at [Dockerfile:21-23](../../Dockerfile#L21-L23) and overlaid at [Dockerfile:42-44](../../Dockerfile#L42-L44).

### 1.14 Sitemap

[src/app/sitemap.ts](../../src/app/sitemap.ts) emits static pages, listing URLs (limit 5,000), and one entry per active seller. No `images` arrays. No separate image sitemap. Defensible for a marketplace that's not optimizing for Google Images traffic.

### 1.15 Shelves — confirmed null

Shelf upload pipeline was removed in [supabase/migrations/076_remove_shelves_and_offers.sql](../../supabase/migrations/076_remove_shelves_and_offers.sql). Grep for `shelf|shelves|Shelf` across `src/` surfaces only:

- [src/app/[locale]/sell/_components/GameSearchStep.tsx:30](../../src/app/[locale]/sell/_components/GameSearchStep.tsx#L30) — comment text "from a listing/shelf row." Stale comment, no functional impact.
- [public/llms.txt](../../public/llms.txt) — phrase "active listings, and game shelf." Stale doc.
- [src/app/[locale]/help/packing/page.tsx:17](../../src/app/[locale]/help/packing/page.tsx#L17) and [src/app/[locale]/browse/page.tsx:222](../../src/app/[locale]/browse/page.tsx#L222) — literal furniture-sense usage ("left your shelf", "the shelf's empty"). Not residue.

No image-pipeline residue from shelves. The two stale-text hits are noted for completeness.

### 1.16 Dependencies (image-related)

From [package.json](../../package.json):

- `sharp` ^0.34.5 — server-side, used in [src/lib/images/process.ts](../../src/lib/images/process.ts) and [src/app/api/profile/avatar/route.ts](../../src/app/api/profile/avatar/route.ts). Loaded with musl native bindings via [Dockerfile:21-23](../../Dockerfile#L21-L23).
- No `browser-image-compression`, `compressorjs`, `pica`, `@squoosh/*`, `imagemin`, or `heic2any`. No client-side image processing of any kind.

---

## 2. Findings by impact

### 2.1 High impact — storage savings (free-tier survival)

#### F-1 [storage] No server-side resize on listing photo upload
- **Where:** [src/lib/images/process.ts:63-72](../../src/lib/images/process.ts#L63-L72). The Sharp pipeline calls `.rotate()` and a format-specific encoder, never `.resize()`.
- **State:** Phone uploads land in `listing-photos` at full sensor resolution (commonly 4032×3024 for iPhone, 4080×3060 for Pixel, up to ~6000×4000 for newer DSLRs). The 10 MiB cap caps the worst case but does nothing about the median.
- **Why it matters:** Supabase free tier is 1 GiB. With an 8-photo listing cap and modern phone photos averaging 3–6 MiB each, ~25–40 listings consume 1 GiB. Browse tiles render at ≤ 25 vw (≈ 480 px on a 1920 px viewport), the lightbox at 90 vw, and `next/image` already responds with smaller variants — full-resolution storage delivers zero user-visible benefit.
- **Magnitude:** *Estimate pending measurement.* See M-1 in §5.

#### F-2 [storage] No format normalization on stored photos
- **Where:** [src/lib/images/process.ts:66-72](../../src/lib/images/process.ts#L66-L72). JPEG → JPEG (q90), PNG → PNG, WebP → WebP, AVIF → AVIF.
- **State:** Whatever format the user uploads is what we store. PNG screenshots and PNG-as-photo uploads stay PNG (typically 2–5× larger than the equivalent JPEG; 4–8× larger than AVIF).
- **Why it matters:** A normalized output format would shrink bucket consumption regardless of user input. Compounds with F-1.
- **Magnitude:** *Estimate pending measurement.* See M-1.

#### F-3 [storage] Stale hero PNG fallbacks shipped in repo and Docker image
- **Where:** [public/images/](../../public/images/) — `hero-bg-2.png` (2.17 MiB) and `hero-bg.png` (2.06 MiB), plus `hero-bg.webp` (111 KiB). Only `hero-bg-2.webp` is referenced (at [page.tsx:63](../../src/app/[locale]/page.tsx#L63)); grep confirms no other code path mentions the PNGs or the older webp.
- **State:** ~4.34 MiB of unused image assets sit in `public/`, get committed in every git operation, ship into the Docker image at [Dockerfile:39](../../Dockerfile#L39), and inflate every container layer pull on Hetzner.
- **Why it matters:** Not a Supabase-bucket issue, but the same "free tier survival" theme — every unused MiB shipped is bandwidth, build cache, and image-pull cost.

#### F-4 [storage] No bucket cleanup for `avatars` or `dispute-photos`
- **Where:** [src/app/api/cron/cleanup-photos/route.ts](../../src/app/api/cron/cleanup-photos/route.ts) only sweeps `listing-photos`. Avatars rely on inline old-file deletion in the upload route ([avatar/route.ts:92-94](../../src/app/api/profile/avatar/route.ts#L92-L94)). Dispute photos have no cleanup path visible in this audit.
- **State:** If an avatar upload succeeds but the subsequent `user_profiles.avatar_url` update fails ([avatar/route.ts:81-89](../../src/app/api/profile/avatar/route.ts#L81-L89)), the new file is left orphaned in storage with no sweeper to find it. Same shape for any dispute-photos lifecycle gap.
- **Why it matters:** Low-volume buckets today, but the leak grows monotonically with no upper bound.

### 2.2 High impact — page performance

#### F-5 [perf] Homepage hero is a CSS `background-image`, not `next/image`
- **Where:** [src/app/[locale]/page.tsx:63](../../src/app/[locale]/page.tsx#L63).
- **State:** The desktop LCP candidate loads via CSS `background-image` after stylesheet parse. No `<link rel=preload as=image>` is emitted; no `priority` flag is available; no responsive `sizes`; no AVIF served (CSS background-image doesn't go through `/_next/image`).
- **Why it matters:** LCP on the homepage is gated on this asset. The current implementation guarantees the slowest possible discovery and load order on desktop. Mobile is unaffected (solid color background only).

#### F-6 [perf, storage-adjacent] Cloudflare post-deploy purge invalidates the `/_next/image` cache
- **Where:** [scripts/purge-cloudflare-cache.sh:14-18](../../scripts/purge-cloudflare-cache.sh#L14-L18) calls `purge_everything: true`. Cloudflare cache rule for `/_next/image` is Edge TTL 1 day per [docs/cloudflare-cache-purge-setup.md:40](../../docs/cloudflare-cache-purge-setup.md#L40).
- **State:** Every deploy clears the edge cache for transformed images. Combined with F-7 below, the next visitor after every deploy triggers a fresh transform on the VPS for every image they encounter.
- **Why it matters:** Hetzner CX23 is a 2-vCPU box. Image transforms are CPU-heavy. Browse-page first-render-after-deploy will spike CPU and degrade response time across all routes that share the runtime.

#### F-7 [perf] No persistent volume for `.next/cache/images` is declared in code
- **Where:** [Dockerfile](../../Dockerfile). No `VOLUME` directive; no copy of `.next/cache/images`; the runner stage starts with an empty cache directory on every container start.
- **State, qualified:** This is a code-level finding only. Whether Coolify mounts a persistent volume at that path is configured in the Coolify dashboard, outside the repo. See open question O-1.
- **Why it matters (assuming no Coolify volume):** Container restart and redeploy both wipe the transform cache. Combined with F-6, the cache-miss rate after every deploy is effectively 100% until traffic warms it.

#### F-8 [perf] Avatar component uses plain `<img>` with no responsive variants
- **Where:** [src/components/ui/avatar.tsx:26-35](../../src/components/ui/avatar.tsx#L26-L35).
- **State:** The avatar route resizes the source to 256×256 ([avatar/route.ts:53-55](../../src/app/api/profile/avatar/route.ts#L53-L55)), so there's a hard upper bound on bytes — but the rendered display sizes range from 20 px (`xs`) to 64 px (`lg`) per [avatar.tsx:13-19](../../src/components/ui/avatar.tsx#L13-L19). A 20 px avatar still loads the full 256 px source. Multiplied across seller pages, comment threads, and headers, this is meaningful mobile data on listings with many comments.
- **Why it matters:** The eslint-disable comment is correct that `next/image` "adds no value for vectors" — but the avatar is a raster, not a vector, and the original justification ("small user-uploaded avatar") doesn't hold for the comment-thread and seller-page cases where many avatars appear at once.

#### F-9 [perf] `formats` defaults to `['image/webp']` only — AVIF never served
- **Where:** [next.config.mjs:89-101](../../next.config.mjs#L89-L101) does not declare `formats`. Verified Next 16.2.1 default is `['image/webp']` only.
- **State:** Every `/_next/image` response serves WebP at best. Modern browsers (Safari 16+, Chrome, Firefox, Edge — covers ~95%+ of EU traffic) all support AVIF, which is typically 20–30% smaller than equivalent WebP for photos.
- **Why it matters:** Both performance (smaller bytes over the wire) and storage-adjacent (smaller transformed-image cache footprint).

### 2.3 High impact — both (storage and performance)

#### F-10 [perf, storage] OG / Twitter card images are missing across the site
- **Where:** [src/app/[locale]/layout.tsx:46-69](../../src/app/[locale]/layout.tsx#L46-L69), [src/app/[locale]/listings/[id]/page.tsx:131](../../src/app/[locale]/listings/[id]/page.tsx#L131), and four other per-page `openGraph` blocks. None populate `images`. No `opengraph-image.tsx` or `twitter-image.tsx` files exist.
- **State:** Sharing a listing URL into Slack/WhatsApp/Discord/Facebook/Twitter/LinkedIn/iMessage renders text-only — no card image. Listing detail shares are the most likely organic acquisition vector for a marketplace; today they look broken on social.
- **Why it matters:** Strictly speaking this is a marketing/conversion finding, not a performance/storage one. Included here because it's clearly in scope of "image pipeline" and the audit found no other place where it would surface.

### 2.4 Medium impact

#### F-11 [perf] Bids page thumbnail bypasses the BGG-direct optimization
- **Where:** [src/app/[locale]/account/bids/page.tsx:78-83](../../src/app/[locale]/account/bids/page.tsx#L78-L83).
- **State:** Uses `<Image fill sizes="56px">` but omits the `unoptimized={isBggImage(bid.thumbnail)}` flag that every other listing-image surface uses. When `bid.thumbnail` is a BGG URL (the common case), the request routes through `/_next/image` and the VPS transforms an image that geekdo's CDN would have served faster for free.
- **Why it matters:** Inconsistency, low user impact today (bids page is low-traffic), worth a one-line fix when someone is in the file.

#### F-12 [perf] `deviceSizes` includes the 3840 variant, never useful for marketplace tiles
- **Where:** [next.config.mjs:89-101](../../next.config.mjs#L89-L101) doesn't override `deviceSizes`, so Next defaults `[640, 750, 828, 1080, 1200, 1920, 2048, 3840]` apply.
- **State:** A 3840 px variant gets generated for any image whose `sizes` attribute could match a 4K viewport. Stored in the image cache, served to ~zero real users.
- **Why it matters:** Cache pollution + occasional CPU waste. Trimming to `[640, 750, 828, 1080, 1200, 1920]` would shrink the transform set without affecting any current surface.

#### F-13 [perf] BGG-image `unoptimized=true` is a configurable trade-off, not a defect
- **Where:** Used at every listing-image surface via [src/lib/bgg/utils.ts:47-49](../../src/lib/bgg/utils.ts#L47-L49).
- **State:** BGG images bypass our optimizer to avoid double-transform and to leverage geekdo's CDN. Trade-off: we never serve AVIF for BGG art (a meaningful chunk of all images on the site). The current choice is defensible — flagging only as a known knob.

### 2.5 Low impact

#### F-14 [low] Stale shelf comment in GameSearchStep
- [src/app/[locale]/sell/_components/GameSearchStep.tsx:30](../../src/app/[locale]/sell/_components/GameSearchStep.tsx#L30) — comment mentions "listing/shelf row." Inert.

#### F-15 [low] Stale shelf phrase in llms.txt
- [public/llms.txt](../../public/llms.txt) mentions "game shelf" in the seller profiles description. Inert.

---

## 3. Risks & gotchas

### R-1 `dispute-photos` bucket — RLS not surfaced in this audit
The bucket is referenced from code but its RLS policies were not re-verified during this audit (CLAUDE.md notes a known concern that the policies may exist only as SQL comments in [supabase/migrations/022_disputes.sql](../../supabase/migrations/022_disputes.sql)). Out of scope for an image-pipeline audit but flagged here so it doesn't fall through the cracks: the same bucket appears in any "fix uploads" implementation plan and the policy state should be confirmed at that time.

### R-2 Backfill of existing listing photos
Any change to upload-time processing (resize, format normalization, etc.) only affects future uploads. The bucket already contains whatever it contains. Plans that follow this audit will need to decide: ignore the legacy, opportunistically rewrite on listing edit, or run a one-shot backfill script. None of these is a blocker for the upload-time change itself.

### R-3 `src/app/icon.png` is the canonical app icon
Anything that touches Next metadata-image routing should be aware that [src/app/icon.png](../../src/app/icon.png) is the file Next picks up automatically. If a plan adds `opengraph-image.tsx`, it should not also relocate or duplicate the existing `icon.png`.

### R-4 Cloudflare full-purge is load-bearing for non-image surfaces
Per the comment in [docs/cloudflare-cache-purge-setup.md:50](../../docs/cloudflare-cache-purge-setup.md#L50): "Purges the entire edge cache after each deploy so any stale static assets referencing old chunk hashes are cleared." A change from `purge_everything: true` to a narrower scope must keep that property — the `/_next/static/` rule with 1-year TTL would otherwise serve stale chunks against a new HTML payload. Any plan targeting F-6 needs to handle this explicitly.

### R-5 Sharp `limitInputPixels: 25_000_000`
[process.ts:64](../../src/lib/images/process.ts#L64) caps Sharp's input at 25 megapixels. A 50 MP iPhone Pro photo (8064×6048 ≈ 48.7 MP) would slip in just under the cap; an 8K stock photo (7680×4320 ≈ 33.2 MP) would not. Worth re-checking the cap if upload behavior is touched, since the current cap allows photos larger than what any responsive `sizes` value will ever request.

### R-6 Avatar `?v=${Date.now()}` is one-shot
The cache-bust query string is appended once at upload and persisted into `user_profiles.avatar_url` ([avatar/route.ts:79](../../src/app/api/profile/avatar/route.ts#L79)). Any future "Optimize this URL" pass should not strip the query string thinking it's a render-time cache-bust — it's the canonical stored URL.

---

## 4. Recommended sequencing

Five phases, named by outcome only. Ordering reflects dependency and blast radius. No implementation prescriptions — those belong in a follow-up implementation plan written from this report.

| # | Outcome | Effort | Depends on | Addresses |
|---|---|---|---|---|
| 1 | **Reduce per-upload storage footprint** | S | — | F-1, partially F-2 |
| 2 | **Restore homepage LCP image discoverability + remove unused static assets** | S | — | F-5, F-3 |
| 3 | **Stop discarding image-optimization cache on every deploy** | M | Coolify access; resolve O-1, O-2 | F-6, F-7 |
| 4 | **Normalize stored image format** | M | Phase 1 (touches the same code path) | F-2, F-9 |
| 5 | **Avatar pipeline + perceived-load polish + bids consistency** | M | — | F-8, F-11, F-13 |

Notes on Phase 0 (not numbered):
- F-10 (OG images) is a marketing finding, not a performance/storage finding — sequence it through whatever channel handles social-share quality, not necessarily this track.
- F-4 (avatar / dispute-photos cleanup), F-12 (`deviceSizes`), F-14, F-15 are low-priority enough to slot opportunistically into whichever phase touches the same area.
- R-2 (backfill) is its own decision point that follows Phase 1, regardless of effort estimate.

---

## 5. Open questions

The audit cannot answer these from the codebase alone. Each must be resolved before the corresponding phase plan can be written.

### O-1 — Persistent volume at `.next/cache/images`
Does Coolify mount a persistent volume at `/app/.next/cache/images` for the production container? The Dockerfile does not declare one. If yes, F-7 is a non-issue and Phase 3 narrows to F-6 only. If no, Phase 3 needs both halves.

### O-2 — Cloudflare purge scope
Is the `purge_everything: true` behavior load-bearing for anything other than `/_next/static/` chunk hash invalidation? (i18n message bundles? Sitemap? The two `_next/static`/`_next/image` rules are the only cached patterns documented.) Phase 3 cannot narrow the purge without a clear "what else relies on this" answer.

### O-3 — Destructive resize policy
If Phase 1 resizes server-side, the seller's original is replaced. Is that acceptable, or is a "view original" affordance required? (Marketplace context suggests acceptable; explicit confirmation would unblock the implementation plan.)

### O-4 — AVIF encoding cost on the VPS
Sharp can re-encode to AVIF, but AVIF encoding is CPU-heavy. On a 2-vCPU CX23 with an 8-photo upload batch, is inline encoding acceptable, or does Phase 4 need a background job pattern? No prior measurement exists.

### O-5 — Existing-photo backfill
Per R-2: ignore legacy, lazy-rewrite on edit, or one-shot script? Decision needed before any storage-savings-from-backfill claim can be made for already-uploaded photos.

### O-6 — Measurement (M-1, deferred from plan)
This audit did not measure actual `listing-photos` bucket contents (median/p90 file size, % at full sensor resolution, format distribution). The audit plan flagged this as conditional on feasibility; running a one-off Node script with the service-role key against production storage was judged out of scope for a read-only audit. Consequence: every "estimated savings" claim in §2.1 is unmeasured. Before committing to Phase 1's effort/ROI, one or both of:
- Run a sampling script that lists 50 random objects from `listing-photos` and reports `metadata.size` distribution.
- Read `storage.objects.metadata` via the Supabase MCP `execute_sql` against `storage.objects` (the metadata column carries `size` and `mimetype`).

Either gives concrete inputs for Phase 1's storage-savings projection.

---

## 6. Verification

This report passed the verification checklist defined in the audit plan:

- **File existence:** `docs/audits/image-pipeline-audit-2026-04-25.md` exists.
- **Hallucination check:** All file:line citations were re-read fresh during the audit run, not copied from the plan. The audit plan's "Critical files" listed `src/app/Dockerfile` — the actual location is repo-root `/Dockerfile`, corrected here. All other critical-files paths confirmed.
- **Discipline check:** Findings (§2) describe state and impact only. Sequencing (§4) names outcomes only. No "add X / mount Y / convert to Z" directives in either.
- **Estimates check:** All file sizes in §1.9 come from actual `wc -c` output during the audit. Storage-savings percentages and magnitudes are explicitly tagged "estimate pending measurement" with a measurement step deferred to O-6.
- **Scope check:** Covers upload (§1.1, 1.2, 1.3), storage (§1.4, 1.5), serving (§1.6, 1.7, 1.8), hero/static (§1.9), OG/social (§1.10), emails (§1.11), CDN/caching (§1.12), origin cache (§1.13), sitemap (§1.14), shelves (§1.15), dependencies (§1.16). Surfaces flagged in the plan's "look beyond" instruction (emails, OG, sitemap, mobile cart, account pages) all covered.

# Image Pipeline Phase 1 — Server-Side Resize on Upload

> **For Claude:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task.

**Goal:** Add a long-edge resize cap to the existing Sharp pipeline in [src/lib/images/process.ts](../../src/lib/images/process.ts) so that listing-photo uploads have a bounded storage footprint regardless of input dimensions.

**Architecture:** Insert a single `.resize({ ..., fit: 'inside', withoutEnlargement: true })` call into the existing `stripExifMetadata` pipeline. Apply only to the listing-photos route — the avatar route at [src/app/api/profile/avatar/route.ts:53-55](../../src/app/api/profile/avatar/route.ts#L53-L55) already resizes (256×256) before calling the same helper, so its behavior is unchanged.

**Tech Stack:** Sharp ^0.34.5 (existing dependency), Vitest (existing test framework). No new packages.

**Why this matters (read before coding):** The audit at [docs/audits/image-pipeline-audit-2026-04-25.md](../audits/image-pipeline-audit-2026-04-25.md) §2.1 F-1 documents that no resize step exists in the upload pipeline. The structural argument is what's load-bearing here — adding a resize step costs nothing and caps worst-case footprint at a known ceiling. Quantitative projections in the audit are based on a five-photo sample (all JPEG, range 3.5–4.18 MiB, all > 1 MiB) and should be read as illustrative under current upload patterns rather than as a capacity plan. Don't let the small-n caveat delay a structurally-correct fix.

**What this plan deliberately does NOT do:**
- Format normalization (e.g., re-encoding everything to AVIF or WebP) — that's Phase 4 and depends on open question O-4 (AVIF encoding cost on the VPS).
- Backfill of existing photos — that's open question O-5; future uploads only.
- Change quality settings (JPEG q90, WebP q90, AVIF q75 stay as-is) — quality tuning is a separate, lower-priority polish pass.
- Touch the avatar pipeline.
- Address F-4 (avatar / dispute-photos cleanup) — that's a reliability-tail concern, not a Phase 1 storage concern.

**Open question this plan resolves implicitly:** Audit O-3 ("destructive resize policy"). This plan replaces the original on upload; the seller does not get a "view original" affordance. Marketplace context makes this acceptable; called out here so a reviewer can object before code lands.

---

## The resize-cap decision

**Recommended starting value: 2048 px long edge.**

Rationale and trade-off (read before changing the constant):

- The Next.js default `deviceSizes` includes `2048` and `3840`. The lightbox at [src/app/[locale]/listings/[id]/PhotoGallery.tsx:104-111](../../src/app/[locale]/listings/[id]/PhotoGallery.tsx#L104-L111) declares `sizes="90vw"`, so on a 4K (3840 px) display Next would request the 3840 variant; with a 2048 source, Next will not upscale and instead serves the 2048 variant. Lightbox clarity on 4K monitors is therefore visibly capped.
- Browse-tile sizes (`sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"`) cap effective width at ~480 px on a 1920-wide viewport. 2048 is generously above this.
- A 2048 long-edge JPEG of a 4032×3024 source at q90 typically lands around 600–900 KB (estimate, not measured).
- Lower (1920): aligns exactly with a default deviceSize, slightly worse 4K lightbox clarity.
- Higher (2400 / 3000): better lightbox, smaller storage win.

**If the reviewer pushes back on lightbox clarity**, the right answer is probably 2400 px (no exact deviceSize match, but Next will serve the next-larger variant unchanged). Either choice is defensible; 2048 is the safer starting point because it aligns with a Next deviceSize.

---

## Task 0: Create the feature branch

**Files:** None (branch only).

**Step 1:** Create branch from up-to-date main.

Run:
```bash
git checkout main
git pull --ff-only
git checkout -b feature/image-pipeline-phase-1-resize
```
Expected: "Switched to a new branch 'feature/image-pipeline-phase-1-resize'".

---

## Task 1: Add the resize constant

**Files:**
- Modify: `src/lib/images/process.ts`

**Step 1: Add the constant near the top of the file (above `EXTENSION_MAP`).**

> Location verified at plan-write time: `EXTENSION_MAP` is at lines 3–8 of [src/lib/images/process.ts](../../src/lib/images/process.ts). If the file has been refactored between plan and execution, locate it via `rg -n 'EXTENSION_MAP' src/lib/images/process.ts` and place the new constant immediately above the first hit.

Add:
```ts
/**
 * Listing-photo upload resize cap (long edge, in pixels).
 *
 * Caps stored photo dimensions so a 12 MP phone photo (4032×3024) becomes
 * ~2048×1536 in the bucket. Picked to match a Next deviceSize so /_next/image
 * doesn't have to upscale on browse / lightbox surfaces. See plan at
 * docs/plans/2026-04-25-image-pipeline-phase-1-resize-on-upload.md for the
 * trade-off behind this number.
 */
export const LISTING_PHOTO_MAX_DIMENSION = 2048;
```

(Keep this comment — it explains a non-obvious choice. The repo convention per CLAUDE.md is "no comments unless the WHY is non-obvious." This qualifies: the bare number `2048` would otherwise be a magic number with no traceable rationale.)

**Step 2:** Confirm the file still parses.

Run: `pnpm type-check`
Expected: PASS (no new types introduced; just an exported const).

---

## Task 2: Write the failing test for resize behavior

**Files:**
- Create: `src/lib/images/process.test.ts`

The repo convention per CLAUDE.md is co-located tests (`pricing.ts` → `pricing.test.ts`). No existing test file for `process.ts`, so this creates one.

**Step 1: Create the test file.**

```ts
import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import { stripExifMetadata, LISTING_PHOTO_MAX_DIMENSION } from './process';

/**
 * Helper: generate a synthetic JPEG buffer at the requested dimensions.
 * Uses a solid-color image — content doesn't matter, dimensions do.
 */
async function makeJpegBuffer(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: { r: 128, g: 128, b: 128 } },
  })
    .jpeg()
    .toBuffer();
}

describe('stripExifMetadata', () => {
  describe('resize cap', () => {
    it('caps the long edge of an oversized landscape JPEG', async () => {
      const input = await makeJpegBuffer(4032, 3024);
      const output = await stripExifMetadata(input, 'image/jpeg');
      const meta = await sharp(output).metadata();
      expect(Math.max(meta.width!, meta.height!)).toBe(LISTING_PHOTO_MAX_DIMENSION);
    });

    it('caps the long edge of an oversized portrait JPEG', async () => {
      const input = await makeJpegBuffer(3024, 4032);
      const output = await stripExifMetadata(input, 'image/jpeg');
      const meta = await sharp(output).metadata();
      expect(Math.max(meta.width!, meta.height!)).toBe(LISTING_PHOTO_MAX_DIMENSION);
    });

    it('preserves aspect ratio when resizing', async () => {
      const input = await makeJpegBuffer(4032, 3024);
      const output = await stripExifMetadata(input, 'image/jpeg');
      const meta = await sharp(output).metadata();
      // 4:3 aspect ratio should be preserved within rounding tolerance
      expect(meta.width! / meta.height!).toBeCloseTo(4032 / 3024, 2);
    });

    it('does not enlarge images already under the cap', async () => {
      const input = await makeJpegBuffer(800, 600);
      const output = await stripExifMetadata(input, 'image/jpeg');
      const meta = await sharp(output).metadata();
      expect(meta.width).toBe(800);
      expect(meta.height).toBe(600);
    });

    it('does not enlarge avatar-sized inputs (256px after the avatar route\'s fit:cover resize)', async () => {
      // Regression guard for the avatar pipeline: the avatar route resizes
      // to 256x256 BEFORE calling stripExifMetadata, so the new resize step
      // here must be a no-op for that case. If withoutEnlargement is ever
      // dropped, this test catches it before avatars get silently upscaled.
      const input = await sharp({
        create: { width: 256, height: 256, channels: 3, background: { r: 100, g: 100, b: 100 } },
      })
        .jpeg()
        .toBuffer();
      const output = await stripExifMetadata(input, 'image/jpeg');
      const meta = await sharp(output).metadata();
      expect(meta.width).toBe(256);
      expect(meta.height).toBe(256);
    });

    it('caps PNG inputs the same way as JPEG', async () => {
      const inputPng = await sharp({
        create: { width: 4000, height: 3000, channels: 3, background: { r: 200, g: 200, b: 200 } },
      })
        .png()
        .toBuffer();
      const output = await stripExifMetadata(inputPng, 'image/png');
      const meta = await sharp(output).metadata();
      expect(Math.max(meta.width!, meta.height!)).toBe(LISTING_PHOTO_MAX_DIMENSION);
      expect(meta.format).toBe('png'); // format preserved (Phase 4 will change this)
    });
  });

  describe('format preservation', () => {
    it('keeps JPEG output for JPEG input', async () => {
      const input = await makeJpegBuffer(2000, 1500);
      const output = await stripExifMetadata(input, 'image/jpeg');
      const meta = await sharp(output).metadata();
      expect(meta.format).toBe('jpeg');
    });
  });
});
```

**Note on what's NOT tested:** EXIF stripping is the existing behavior of the rotate() call and is exercised by Sharp's own test suite — adding a regression test for it here would require checked-in fixture images with real EXIF blocks. Skip; if EXIF stripping breaks in the future, it'll show up in production immediately.

**Step 2:** Run the test file.

Run: `pnpm test src/lib/images/process.test.ts`
Expected: All five resize-cap tests FAIL (the resize step doesn't exist yet). The format-preservation test should PASS.

---

## Task 3: Implement the resize step

**Files:**
- Modify: `src/lib/images/process.ts`

**Step 1: Add `.resize()` to the pipeline.**

Find the existing `stripExifMetadata` function:
```ts
export async function stripExifMetadata(buffer: Buffer, mimeType: string): Promise<Buffer> {
  const pipeline = sharp(buffer, { limitInputPixels: 25_000_000 }).rotate();
  // ... switch ...
}
```

Change the pipeline construction to:
```ts
export async function stripExifMetadata(buffer: Buffer, mimeType: string): Promise<Buffer> {
  const pipeline = sharp(buffer, { limitInputPixels: 25_000_000 })
    .rotate()
    .resize({
      width: LISTING_PHOTO_MAX_DIMENSION,
      height: LISTING_PHOTO_MAX_DIMENSION,
      fit: 'inside',
      withoutEnlargement: true,
    });
  // ... existing switch unchanged ...
}
```

What each Sharp option does (don't change without re-reading Sharp docs):
- `width: MAX, height: MAX` — set both bounds to the same value
- `fit: 'inside'` — scales the image so it fits inside both bounds while preserving aspect ratio. Long edge becomes the cap; short edge scales proportionally.
- `withoutEnlargement: true` — if the input is already smaller than the bounds in both dimensions, leave it alone instead of upscaling. Defensive; matters for thumbnails or already-compressed uploads.

**Note on the avatar route:** [src/app/api/profile/avatar/route.ts:53-55](../../src/app/api/profile/avatar/route.ts#L53-L55) calls `sharp(buffer).resize(256, 256, { fit: 'cover' })` *before* calling `stripExifMetadata(resized, …)`. After this change, `stripExifMetadata` will run a no-op `.resize({ ..., withoutEnlargement: true })` on the already-256-px buffer. Functionally a no-op; verify in Task 5 that avatar upload tests / behavior are unchanged.

---

## Task 4: Verify the tests now pass

**Step 1:** Re-run the test file.

Run: `pnpm test src/lib/images/process.test.ts`
Expected: All tests PASS.

**Step 2:** Run the full suite to catch regressions.

Run: `pnpm test`
Expected: PASS. If any avatar-route test regresses, investigate before proceeding — the Task 3 note flagged the no-op interaction.

---

## Task 5: Build + lint + type-check gate

**Step 1:** Run the deploy gate per CLAUDE.md ("`pnpm build` is the real deploy gate, not `pnpm type-check` alone").

Run, sequentially (each must pass before the next):
```bash
pnpm type-check
pnpm lint
pnpm build
```
Expected: all PASS.

**Step 2:** Manual upload smoke test.

Run: `pnpm dev`

Then in browser:
1. Sign in.
2. Navigate to `/sell`, complete the flow up to the photo step.
3. Upload a single large phone photo (≥ 3 MiB). The upload should succeed.
4. From the network response to `POST /api/listings/photos`, copy the `url` field. **This is the direct Supabase Storage URL** (format: `https://{project}.supabase.co/storage/v1/object/public/listing-photos/{userId}/{uuid}.{ext}`). Verify it does NOT start with `/_next/image` — that would be the optimizer-transformed variant, not the source bytes.
5. Open the direct Storage URL (not the gallery / browse rendering) in a new tab. The image should load.
6. Save the image (right-click → Save image as) and check its dimensions however your OS exposes them — image-viewer properties panel, file-manager Get Info, or a CLI tool you have installed (`identify` from ImageMagick, `sips` on macOS, `exiftool`, etc.). Long edge should be ≤ 2048 px. **This step matters because `next/image` would happily downscale at request time even if the source bytes weren't resized — only the Storage URL proves the resize-on-upload step actually ran.**
7. Verify the saved file size is under ~1 MiB (will vary by photo content).

If any step fails, do NOT commit. Diagnose first; the resize step should be transparent to the upload path.

---

## Task 6: Commit

**Step 1:** Stage only the two files this plan touches.

Run:
```bash
git add src/lib/images/process.ts src/lib/images/process.test.ts
git status --short
```
Expected: exactly two files staged (one M, one A). If anything else appears, do NOT proceed — investigate the unexpected change first.

**Step 2:** Commit.

```bash
git commit -m "$(cat <<'EOF'
feat(images): cap listing photo upload at 2048px long edge

Adds a server-side resize step to the existing Sharp EXIF-strip pipeline.
Inputs larger than 2048px on either dimension are scaled down (aspect
ratio preserved); inputs already at or below the cap are unchanged. Avatar
route is unaffected — its 256x256 pre-resize means the new step is a no-op
in that path.

Caps the worst-case stored photo size from "whatever sensor produced" to a
known ceiling. Format normalization and existing-photo backfill are
deliberately out of scope per the audit at
docs/audits/image-pipeline-audit-2026-04-25.md.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Push and open PR

**Step 1:** Push.

Run: `git push -u origin feature/image-pipeline-phase-1-resize`

**Step 2:** Open PR.

```bash
gh pr create --title "feat(images): cap listing photo upload at 2048px long edge" --body "$(cat <<'EOF'
## Summary

Phase 1 of the image-pipeline audit: add a long-edge resize cap to the listing-photo upload path. Caps stored photo dimensions to 2048px so a 12MP phone photo (4032×3024) becomes ~2048×1536 in the bucket.

Plan: [docs/plans/2026-04-25-image-pipeline-phase-1-resize-on-upload.md](docs/plans/2026-04-25-image-pipeline-phase-1-resize-on-upload.md)
Audit: [docs/audits/image-pipeline-audit-2026-04-25.md](docs/audits/image-pipeline-audit-2026-04-25.md) §2.1 F-1

### Scope

- ✅ Server-side resize on upload (listing photos only)
- ✅ Aspect-ratio preserving, no upscaling of small inputs
- ✅ Format unchanged (Phase 4 decision)
- ✅ EXIF strip behavior preserved
- ❌ Backfill of existing photos (audit O-5, separate decision)
- ❌ Format normalization (Phase 4)
- ❌ Avatar / dispute-photos cleanup (audit F-4, reliability-tail concern)

### Resize cap rationale

2048px chosen to match a Next.js \`deviceSizes\` entry so \`/_next/image\` doesn't have to upscale on browse / lightbox surfaces. Trade-off documented in the plan; if reviewer prefers 2400px for slightly better 4K lightbox clarity, change \`LISTING_PHOTO_MAX_DIMENSION\` and re-run tests.

### Open question this PR closes implicitly

Audit O-3 (destructive resize): originals are not preserved. Marketplace context makes this acceptable; flag now if you disagree.

## Test plan

- [ ] \`pnpm test src/lib/images/process.test.ts\` — five resize-cap tests pass
- [ ] \`pnpm test\` — full suite green (no avatar-route regression)
- [ ] \`pnpm type-check && pnpm lint && pnpm build\` — all pass
- [ ] Manual: upload a > 3 MiB phone photo via /sell, confirm stored URL serves an image with long edge ≤ 2048 px and file size ~600–900 KB

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Return the PR URL.

---

## Verification checklist before marking complete

- [ ] All five resize-cap tests pass (Task 4)
- [ ] Full vitest suite passes (Task 4)
- [ ] `pnpm build` passes (Task 5)
- [ ] Manual upload test confirms a real photo gets resized (Task 5)
- [ ] PR opened and URL surfaced to user (Task 7)
- [ ] Branch deleted after merge (per repo convention; do NOT delete pre-merge)

## Follow-ups this PR creates (not in scope, log only)

- **Phase 4 reciprocity:** When format normalization lands, the BGG `unoptimized=true` decision (audit F-13) should be re-evaluated — enabling AVIF in `next.config.mjs` shifts the trade-off (double-transform vs. no AVIF for BGG art).
- **R-5:** [process.ts](../../src/lib/images/process.ts) caps Sharp's `limitInputPixels` at 25M. With the new 2048-cap output, this input cap could be lowered (e.g. to 50M to allow current iPhone Pro photos but reject 8K stock images). Not urgent; flag for the next process.ts touch.
- **Backfill (audit O-5):** Existing bucket photos remain at original resolution. Decision required: ignore, lazy-rewrite-on-edit, or one-shot script. Not blocking Phase 1.

/** Must match the "Last updated" date on /terms, /privacy, and /seller-terms pages.
 *  Update this constant when any legal page content changes.
 *
 *  Note: Phase 2 of the legal remediation plan will split this into per-doc
 *  TERMS_VERSION / PRIVACY_VERSION / SELLER_TERMS_VERSION so each doc can
 *  bump independently. Until then, a material change to any legal page
 *  bumps this shared version. */
export const TERMS_VERSION = '2026-04-19';

/** Human-readable format for display on legal pages. */
export const TERMS_VERSION_DISPLAY = '19 April 2026';

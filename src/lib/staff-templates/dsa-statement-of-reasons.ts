/**
 * Statement-of-reasons templates for DSA Article 17 takedown decisions.
 *
 * Surfaced via a Select on the "Action listing" modal at /staff/notices.
 * Selecting a template prefills the reason textarea — staff edits before
 * submitting. The seller receives this exact text via the in-app
 * notification + email path triggered by `actionListingFromNotice`.
 *
 * Surfacing canned reasoning improves DSA Art. 17 legal defensibility:
 * every statement of reasons follows a consistent shape that maps to a
 * known category, so a regulator looking at a sample can verify the
 * platform applied the rule the notice cited rather than ad-hoc
 * reasoning per case.
 *
 * The `[Add specific clause + factual basis]` marker on the generic ToS
 * template is an explicit "you must fill this in" nudge before the
 * statement is sent. The 20-character minimum on the reason field is a
 * weak floor (the marker text alone is 39 chars), so the marker itself
 * is the compliance discipline rather than the input validator.
 */

export interface DsaStatementTemplate {
  /** Stable key — used as the Select option value. */
  key: string;
  /** Human-readable label shown in the Select. */
  label: string;
  /** Body text inserted into the reason textarea on selection. Sent to
   *  the affected seller via in-app notification + email. */
  body: string;
}

export const DSA_STATEMENT_TEMPLATES: DsaStatementTemplate[] = [
  { key: 'custom', label: 'Custom (start blank)', body: '' },
  {
    key: 'misleading_condition',
    label: 'Misleading — condition mismatch',
    body: 'Listing condition does not match the item shown in the photos. The cancellation is required because misleading condition descriptions undermine buyer trust on the platform. You can re-list with the correct condition selected.',
  },
  {
    key: 'misleading_edition',
    label: 'Misleading — edition / version mismatch',
    body: 'Listing description claims an edition or version that the photos / BGG metadata do not support. The cancellation is required because edition matters for buyer expectations (especially across language editions in the Baltic region). Re-list with accurate edition + language fields.',
  },
  {
    key: 'misleading_photos',
    label: 'Misleading — photos do not match item',
    body: 'Listing photos do not show the actual item being sold (stock images or photos of a different copy). Buyers need to see the specific copy they are buying. Re-list with photos of your actual copy, including any wear, missing components, or sleeves.',
  },
  {
    key: 'prohibited_item',
    label: 'Prohibited item',
    body: 'This item falls into a prohibited category under our Terms of Service (Section on Prohibited Items). The listing has been cancelled and the item cannot be re-listed on the platform.',
  },
  {
    key: 'ip_counterfeit',
    label: 'IP — counterfeit or unauthorized reproduction',
    body: 'Listing was identified as a counterfeit or unauthorized reproduction following a notice from the rights holder. Listings of counterfeit goods are prohibited under our Terms of Service and EU intellectual-property rules.',
  },
  {
    key: 'tos_violation_generic',
    label: 'ToS violation (generic)',
    body: 'This listing violates our Terms of Service. [Add specific clause + factual basis]. The listing has been cancelled. Please review the Terms before re-listing.',
  },
];

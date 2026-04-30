/**
 * Canned reasoning templates for staff dispute resolution.
 *
 * Surfaced via a Select on /staff/disputes/[id] that prefills the
 * staff-notes textarea. Staff edits before submitting. The discipline of
 * using canned-then-edited reasoning keeps the audit trail consistent
 * across resolutions, which improves legal defensibility — a regulator
 * sampling our resolutions can verify the platform applied the rule
 * coherently rather than reasoned ad-hoc per case.
 *
 * Custom (start blank) is the default — no prefill, staff writes from
 * scratch. The other entries are the high-volume shapes mined from real
 * mediation patterns; expand as new shapes emerge.
 *
 * To edit: change a body here, ship a PR, deploy. Staff sees the new
 * wording the moment the deploy lands. We do not persist these in the
 * database — the inline source-controlled approach gives us git history
 * and PR review on the wording, which is appropriate for legally
 * relevant copy.
 */

export interface DisputeResolutionTemplate {
  /** Stable key — used as the Select option value and in URL fragments. */
  key: string;
  /** Human-readable label shown in the Select. */
  label: string;
  /** Body text inserted into the staff-notes textarea on selection. */
  body: string;
}

export const DISPUTE_RESOLUTION_TEMPLATES: DisputeResolutionTemplate[] = [
  { key: 'custom', label: 'Custom (start blank)', body: '' },
  {
    key: 'favor_buyer_damage',
    label: 'Favor buyer — proof of damage',
    body: 'Buyer provided photo evidence of damage consistent with the dispute reason. Refunding to buyer wallet.',
  },
  {
    key: 'favor_buyer_not_received',
    label: 'Favor buyer — item not received',
    body: 'Tracking confirms shipment was not delivered (or seller never shipped within deadline). Refunding to buyer wallet.',
  },
  {
    key: 'favor_seller_unresponsive',
    label: 'Favor seller — buyer unresponsive',
    body: 'Buyer did not provide requested evidence within the dispute window. Resolving in seller\'s favor.',
  },
  {
    key: 'favor_seller_insufficient',
    label: 'Favor seller — claim unsubstantiated',
    body: 'Buyer\'s claim is not supported by the evidence provided. Resolving in seller\'s favor.',
  },
  {
    key: 'favor_seller_buyer_misuse',
    label: 'Favor seller — buyer caused damage',
    body: 'Damage appears consistent with buyer mishandling rather than condition at sale. Resolving in seller\'s favor.',
  },
];

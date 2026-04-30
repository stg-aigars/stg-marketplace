/**
 * Centralized library of canned-text templates surfaced from the staff
 * dashboard. Each template type lives in its own module so the call site
 * imports only what it needs.
 *
 * Templates are source-controlled (no DB-backed editor) — the wording
 * is legally relevant copy, so git history + PR review is the right
 * editing discipline. Staff sees changes the moment the deploy lands.
 */

export {
  DISPUTE_RESOLUTION_TEMPLATES,
  type DisputeResolutionTemplate,
} from './dispute-resolution';

export {
  DSA_STATEMENT_TEMPLATES,
  type DsaStatementTemplate,
} from './dsa-statement-of-reasons';

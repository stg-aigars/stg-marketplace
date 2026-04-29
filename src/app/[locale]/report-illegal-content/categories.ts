/**
 * Shared category enum for the DSA Art. 16 notice-and-action form and API.
 * Kept in one place so the form dropdown and the server-side validation
 * cannot drift from each other.
 */

export const REPORT_CATEGORY_VALUES = [
  'counterfeit',
  'ip_infringement',
  'illegal_goods',
  'csam',
  'hate_or_harassment',
  'misleading_listing',
  'other',
] as const;

export type ReportCategory = (typeof REPORT_CATEGORY_VALUES)[number];

export const REPORT_CATEGORY_LABELS: Record<ReportCategory, string> = {
  counterfeit: 'Counterfeit product',
  ip_infringement: 'Intellectual property infringement',
  illegal_goods: 'Illegal goods (stolen property, prohibited items)',
  csam: 'Child sexual abuse material',
  hate_or_harassment: 'Hate speech or harassment',
  misleading_listing: 'Misleading listing (condition, edition, completeness, pricing)',
  other: 'Other illegal content',
};

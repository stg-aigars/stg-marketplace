/**
 * Review constants
 */

/** Number of days after delivery that a buyer can leave a review */
export const REVIEW_WINDOW_DAYS = 30;

/** Maximum length for review comment text */
export const REVIEW_MAX_COMMENT_LENGTH = 500;

/** Order statuses that allow review submission */
export const REVIEW_ELIGIBLE_STATUSES = ['delivered', 'completed'] as const;

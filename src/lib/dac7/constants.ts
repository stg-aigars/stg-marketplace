/**
 * DAC7 threshold constants
 *
 * Regulatory threshold: 30 transactions OR €2,000 net consideration per calendar year.
 * Warning threshold: ~80% of regulatory — gives buffer before mandatory data collection.
 */

/** Warning: seller gets a heads-up notification */
export const DAC7_WARN_TRANSACTIONS = 25;
export const DAC7_WARN_CONSIDERATION_CENTS = 175_000; // €1,750

/** Regulatory: data collection becomes mandatory */
export const DAC7_REPORT_TRANSACTIONS = 30;
export const DAC7_REPORT_CONSIDERATION_CENTS = 200_000; // €2,000

/** Days between escalation steps (data_requested → reminder_sent → blocked) */
export const DAC7_REMINDER_DAYS = 14;

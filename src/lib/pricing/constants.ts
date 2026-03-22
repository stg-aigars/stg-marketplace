/**
 * Marketplace pricing constants
 * Centralized location for all fee and pricing configuration
 */

/** Platform commission rate: 10% flat on item price (not shipping) */
export const SELLER_COMMISSION_RATE = 0.10;

/** Days after delivery that buyer can dispute before auto-completion */
export const DISPUTE_WINDOW_DAYS = 2;

/** Days after dispute opened before escalation to staff is allowed */
export const DISPUTE_NEGOTIATION_DAYS = 7;

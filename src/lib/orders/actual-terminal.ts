/**
 * Parse the *actual* delivery terminal out of a Unisend tracking event's
 * `location` string. Unisend's API doesn't return a structured terminal_id
 * once the parcel is in flight — but the `RECEIVED_TERMINAL` event's
 * location string is consistently formatted as:
 *
 *   "<terminal_id> <type>, <name>, <address>, <city>, <postal>"
 *
 * Examples observed in production:
 *   "8541 pakomāts, NICE HOME (Udrop), Nīcgales iela 18A, Rīga, LV-1035"
 *   "9602 pakiautomaat, Häädemeeste uDrop Coop, Pärnu mnt 40, Häädemeeste, 86001"
 *
 * This is the only data path that tells us the buyer's parcel was rerouted
 * to a different locker than the one they chose at checkout (e.g. when the
 * original was full).
 */
import type { TrackingEventForTimeline } from './timeline';

export interface ActualTerminal {
  terminalId: string;
  name: string;
  city: string | null;
}

/**
 * Matches Baltic postal codes in Unisend location strings: `LV-1035`,
 * `EE 86001`, `LT-12345`, or bare 4–6 digit codes. Exported so the simpler
 * city-extraction path in `UnifiedTimeline` (`extractTerminalCity`) shares
 * the same definition rather than drifting with a numeric-only regex.
 */
export const POSTAL_CODE_RE = /^[A-Z]{2}-?\d{4,5}$|^\d{4,6}$/;

export function parseActualDeliveryTerminal(
  location: string | null | undefined
): ActualTerminal | null {
  if (!location) return null;
  const match = location.match(/^(\d{3,6})\s+\S+,\s*(.+)$/);
  if (!match) return null;
  const [, terminalId, rest] = match;
  const parts = rest
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length === 0) return null;

  const name = parts[0];
  // City sits just before the postal code when present; otherwise the last
  // segment is the city. A 1-segment rest means name only — no city.
  let city: string | null = null;
  if (parts.length >= 2) {
    const last = parts[parts.length - 1];
    const cityIdx = POSTAL_CODE_RE.test(last) ? parts.length - 2 : parts.length - 1;
    if (cityIdx > 0) city = parts[cityIdx];
  }
  return { terminalId, name, city };
}

/**
 * Latest delivery-terminal scan from a list of tracking events. Returns the
 * actual terminal the parcel landed at, or null when no destination scan
 * exists or the location string isn't parseable.
 *
 * `RECEIVED_TERMINAL` is the destination scan we want; `NOTIFICATIONS_INFORMED`
 * is the buyer-notification fallback (also at the destination locker, sometimes
 * the only one Unisend emits).
 */
export function getActualDeliveryTerminal(
  trackingEvents: TrackingEventForTimeline[]
): ActualTerminal | null {
  const destinationEvents = trackingEvents.filter(
    (e) => e.event_type === 'RECEIVED_TERMINAL' || e.event_type === 'NOTIFICATIONS_INFORMED'
  );
  if (destinationEvents.length === 0) return null;
  // Walk newest first so a later override (e.g. the rare second-leg rescan)
  // takes precedence over the original arrival.
  destinationEvents.sort(
    (a, b) => new Date(b.event_timestamp).getTime() - new Date(a.event_timestamp).getTime()
  );
  for (const event of destinationEvents) {
    const parsed = parseActualDeliveryTerminal(event.location);
    if (parsed) return parsed;
  }
  return null;
}

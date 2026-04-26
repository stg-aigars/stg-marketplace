import { Card, CardBody } from '@/components/ui';
import { formatDateTime } from '@/lib/date-utils';
import { buildOrderTimeline, type TimelineEntry } from '@/lib/orders/timeline';
import type { OrderStatus, CancellationReason } from '@/lib/orders/types';
import type { TrackingEventRow } from '@/lib/services/tracking';
import type { Icon as PhosphorIcon } from '@phosphor-icons/react';
import {
  Receipt,
  Check,
  CheckCircle,
  X,
  Warning,
  ArrowUUpLeft,
  Truck,
  Package,
  Tag,
  MapPin,
  XCircle,
} from '@phosphor-icons/react/ssr';

interface UnifiedTimelineProps {
  order: {
    status: OrderStatus;
    created_at: string;
    accepted_at: string | null;
    shipped_at: string | null;
    delivered_at: string | null;
    completed_at: string | null;
    cancelled_at: string | null;
    disputed_at?: string | null;
    refunded_at?: string | null;
    cancellation_reason?: CancellationReason | null;
    seller_country?: string | null;
    destination_country?: string | null;
  };
  trackingEvents: TrackingEventRow[];
  trackingUrl: string | null;
  destinationTerminal?: string;
}

const LABELS: Record<string, string> = {
  ordered: 'Order placed',
  accepted: 'Seller accepted',
  shipped: 'Shipped',
  delivered: 'Delivered',
  completed: 'Order completed',
  cancelled: 'Order cancelled',
  disputed: 'Dispute opened',
  refunded: 'Refunded',
  LABEL_CREATED: 'Shipment prepared',
  ON_THE_WAY: 'In transit',
  PARCEL_RECEIVED: 'Dropped off at terminal',
  PARCEL_DELIVERED: 'Picked up',
  PARCEL_CANCELED: 'Shipment cancelled',
  RETURNING: 'Returning to sender',
};

const MILESTONE_ICONS: Record<string, PhosphorIcon> = {
  ordered: Receipt,
  accepted: Check,
  completed: CheckCircle,
  cancelled: X,
  disputed: Warning,
  refunded: ArrowUUpLeft,
  shipped: Truck,
  delivered: Package,
};

const TRACKING_ICONS: Record<string, PhosphorIcon> = {
  LABEL_CREATED: Tag,
  ON_THE_WAY: Truck,
  PARCEL_RECEIVED: Package,
  PARCEL_DELIVERED: CheckCircle,
  PARCEL_CANCELED: XCircle,
  RETURNING: ArrowUUpLeft,
};

interface LabelContext {
  entry: TimelineEntry;
  destinationTerminal?: string;
}

/**
 * Granular Unisend publicEventType overrides — each entry's coarse state_type is
 * still ON_THE_WAY, but the event_type tells us *which* handoff this is. Unmapped
 * event_types fall through to the generic tracking-event label builder, which
 * appends the event's location with a middle dot when present.
 */
const EVENT_TYPE_OVERRIDES: Record<
  string,
  { label: (ctx: LabelContext) => string; icon: PhosphorIcon }
> = {
  ACCEPTED_TERMINAL: {
    label: ({ entry }) => {
      const city = extractTerminalCity(entry.location);
      return city ? `Dropped off at terminal in ${city}` : 'Dropped off at terminal';
    },
    icon: Package,
  },
  RECEIVED_TERMINAL_OUT: {
    label: () => 'Collected by courier',
    icon: Truck,
  },
  RECEIVED_TERMINAL: {
    label: ({ destinationTerminal }) =>
      destinationTerminal ? `Ready for pickup at ${destinationTerminal}` : 'Ready for pickup',
    icon: MapPin,
  },
  NOTIFICATIONS_INFORMED: {
    label: ({ destinationTerminal }) =>
      destinationTerminal ? `Ready for pickup at ${destinationTerminal}` : 'Ready for pickup',
    icon: MapPin,
  },
  DELIVERY_DELIVERED: {
    label: () => 'Picked up',
    icon: CheckCircle,
  },
};

/**
 * Pulls a city name out of a Unisend terminal address. Confident extraction
 * only when the trailing segment is a postal code; otherwise falls back to the
 * raw single-token location (e.g. transit scans that already report just a city).
 *
 * Examples:
 *   "9602 pakiautomaat, Häädemeeste uDrop Coop, Pärnu mnt 40, Häädemeeste, 86001" → "Häädemeeste"
 *   "Tallinn" → "Tallinn"
 *   undefined → null
 */
function extractTerminalCity(rawLocation: string | null | undefined): string | null {
  if (!rawLocation) return null;
  const parts = rawLocation
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length === 0) return null;
  const last = parts[parts.length - 1];
  if (/^\d{4,6}$/.test(last) && parts.length >= 2) {
    return parts[parts.length - 2];
  }
  if (parts.length === 1 && !/\d/.test(last)) {
    return last;
  }
  return null;
}

/**
 * Single-line label composer. Folds the entry's location (tracking events) and
 * detail (cancellation reason / "waiting for tracking") into the label so each
 * row renders as exactly two stacked lines: this label + the timestamp.
 */
function composeLabel(entry: TimelineEntry, destinationTerminal?: string): string {
  if (entry.eventType) {
    const override = EVENT_TYPE_OVERRIDES[entry.eventType];
    if (override) return override.label({ entry, destinationTerminal });
  }
  const baseLabel = LABELS[entry.key] ?? entry.key;
  if (entry.type === 'tracking_event' && entry.location) {
    return `${baseLabel} · ${entry.location}`;
  }
  if (entry.type === 'order_milestone' && entry.detail) {
    const detailLower = entry.detail.charAt(0).toLowerCase() + entry.detail.slice(1);
    return `${baseLabel}: ${detailLower}`;
  }
  return baseLabel;
}

const ERROR_KEYS = new Set(['cancelled', 'disputed', 'refunded', 'PARCEL_CANCELED', 'RETURNING']);

export function UnifiedTimeline({ order, trackingEvents, trackingUrl, destinationTerminal }: UnifiedTimelineProps) {
  const entries = buildOrderTimeline(order, trackingEvents);

  return (
    <Card>
      <CardBody>
        <h2 className="text-base font-semibold text-semantic-text-heading mb-4">
          Order progress
        </h2>

        <div className="flex flex-col">
          {entries.map((entry, index) => (
            <TimelineRow
              key={`${entry.key}-${entry.timestamp ?? 'future'}`}
              entry={entry}
              isLast={index === entries.length - 1}
              nextIsFuture={index < entries.length - 1 && entries[index + 1].isFuture}
              destinationTerminal={destinationTerminal}
            />
          ))}
        </div>

        {trackingUrl && order.shipped_at && (
          <div className="mt-3 pt-3 border-t border-semantic-border-subtle">
            <a
              href={trackingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-semantic-brand sm:hover:text-semantic-brand-hover transition-colors duration-250 ease-out-custom"
            >
              View full tracking details
            </a>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function TimelineRow({
  entry,
  isLast,
  nextIsFuture,
  destinationTerminal,
}: {
  entry: TimelineEntry;
  isLast: boolean;
  nextIsFuture: boolean;
  destinationTerminal?: string;
}) {
  const isError = ERROR_KEYS.has(entry.key);
  const isMilestone = entry.type === 'order_milestone';
  const override = entry.eventType ? EVENT_TYPE_OVERRIDES[entry.eventType] : undefined;
  const Icon = override
    ? override.icon
    : isMilestone
    ? MILESTONE_ICONS[entry.key]
    : TRACKING_ICONS[entry.key];
  const label = composeLabel(entry, destinationTerminal);

  const dotSize = isMilestone ? 'w-5 h-5' : 'w-4 h-4';
  const iconSize = isMilestone ? 12 : 10;
  const iconWeight = isMilestone ? 'bold' as const : 'regular' as const;

  let dotClass: string;
  let textClass: string;
  if (entry.isFuture) {
    dotClass = 'bg-semantic-border-subtle';
    textClass = 'text-semantic-text-muted';
  } else if (isError) {
    dotClass = 'bg-semantic-error';
    textClass = 'text-semantic-error';
  } else if (entry.isCurrent) {
    dotClass = 'bg-semantic-brand ring-4 ring-semantic-brand/20';
    textClass = 'text-semantic-brand';
  } else {
    dotClass = 'bg-semantic-brand';
    textClass = 'text-semantic-text-primary';
  }

  const showLine = !isLast;
  let lineClass = '';
  if (showLine) {
    if (entry.isFuture || nextIsFuture) {
      lineClass = 'border-l-2 border-dashed border-semantic-border-subtle';
    } else if (isError) {
      lineClass = 'bg-semantic-error w-0.5';
    } else {
      lineClass = 'bg-semantic-brand w-0.5';
    }
  }

  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div
          className={`${dotSize} rounded-full flex-shrink-0 mt-0.5 flex items-center justify-center ${dotClass}`}
        >
          {Icon && (
            <Icon
              size={iconSize}
              weight={iconWeight}
              className="text-white"
            />
          )}
        </div>
        {showLine && (
          <div className={`flex-1 min-h-[20px] ${lineClass}`} />
        )}
      </div>

      <div className={isLast ? 'pb-0' : 'pb-3'}>
        <p className={`text-sm font-medium ${textClass}`}>
          {label}
        </p>
        {entry.timestamp && !entry.isFuture && (
          <p className="text-xs text-semantic-text-muted mt-0.5">
            {formatDateTime(entry.timestamp)}
          </p>
        )}
      </div>
    </div>
  );
}

import type { ReactNode } from 'react';
import { Card, CardBody } from '@/components/ui';
import { cn } from '@/lib/cn';
import { formatDateTime } from '@/lib/date-utils';
import { buildOrderTimeline, type TimelineEntry } from '@/lib/orders/timeline';
import type { OrderStatus, CancellationReason } from '@/lib/orders/types';
import type { TrackingEventRow } from '@/lib/services/tracking';
import { getCountryFlag } from '@/lib/country-utils';
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
    terminal_country?: string | null;
  };
  trackingEvents: TrackingEventRow[];
  trackingUrl: string | null;
  destinationTerminal?: string;
  destinationCity?: string;
}

function CountryFlag({ countryCode }: { countryCode: string | null | undefined }) {
  const flagClass = getCountryFlag(countryCode);
  if (!flagClass) return null;
  return <span className={`${flagClass} ml-1.5 text-sm`} aria-hidden="true" />;
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
  destinationCity?: string;
  destinationCountry?: string | null;
  sellerCountry?: string | null;
}

/**
 * Granular Unisend publicEventType overrides — each entry's coarse state_type is
 * still ON_THE_WAY, but the event_type tells us *which* handoff this is. Unmapped
 * event_types fall through to the generic tracking-event label builder, which
 * appends the event's location with a middle dot when present.
 *
 * Override `label` returns a ReactNode so it can interleave inline country flags
 * (rendered via the flag-icons CSS classes from `@/lib/country-utils`).
 */
const EVENT_TYPE_OVERRIDES: Record<
  string,
  { label: (ctx: LabelContext) => ReactNode; icon: PhosphorIcon }
> = {
  ACCEPTED_TERMINAL: {
    label: ({ entry, sellerCountry }) => {
      const city = extractTerminalCity(entry.location);
      if (!city) return 'Dropped off at terminal';
      return (
        <>
          Dropped off at terminal in {city}
          <CountryFlag countryCode={sellerCountry} />
        </>
      );
    },
    icon: Package,
  },
  RECEIVED_TERMINAL_OUT: {
    label: () => 'Collected by courier',
    icon: Truck,
  },
  RECEIVED_TERMINAL: {
    label: ({ destinationTerminal, destinationCity, destinationCountry }) =>
      composeReadyForPickup(destinationTerminal, destinationCity, destinationCountry),
    icon: MapPin,
  },
  NOTIFICATIONS_INFORMED: {
    label: ({ destinationTerminal, destinationCity, destinationCountry }) =>
      composeReadyForPickup(destinationTerminal, destinationCity, destinationCountry),
    icon: MapPin,
  },
  DELIVERY_DELIVERED: {
    label: () => 'Picked up',
    icon: CheckCircle,
  },
};

function composeReadyForPickup(
  terminalName: string | undefined,
  city: string | undefined,
  countryCode: string | null | undefined
): ReactNode {
  if (!terminalName) return 'Ready for pickup';
  // Avoid duplicating the city when the terminal name already contains it
  // (e.g. "Häädemeeste uDrop Coop" + city "Häädemeeste"). When the terminal
  // name doesn't carry the city ("Circle K (Latvijas Pasts)"), append it.
  const cityIsRedundant =
    city != null && terminalName.toLowerCase().includes(city.toLowerCase());
  const showCity = city && !cityIsRedundant;
  return (
    <>
      Ready for pickup at {terminalName}
      {showCity ? `, ${city}` : null}
      <CountryFlag countryCode={countryCode} />
    </>
  );
}

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
 * Label composer. Folds the entry's location (tracking events) and detail
 * (cancellation reason / "waiting for tracking") into the label so each row's
 * primary line is self-contained. The ETA copy on the courier-collection row
 * is rendered as a separate small subtitle by `TimelineRow` rather than inlined.
 */
function composeLabel(ctx: LabelContext): ReactNode {
  const { entry } = ctx;
  if (entry.eventType) {
    const override = EVENT_TYPE_OVERRIDES[entry.eventType];
    if (override) return override.label(ctx);
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

export function UnifiedTimeline({
  order,
  trackingEvents,
  trackingUrl,
  destinationTerminal,
  destinationCity,
}: UnifiedTimelineProps) {
  const entries = buildOrderTimeline(order, trackingEvents);
  const labelCtx: Omit<LabelContext, 'entry'> = {
    destinationTerminal,
    destinationCity,
    destinationCountry: order.terminal_country,
    sellerCountry: order.seller_country,
  };

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
              labelCtx={labelCtx}
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
  labelCtx,
}: {
  entry: TimelineEntry;
  isLast: boolean;
  nextIsFuture: boolean;
  labelCtx: Omit<LabelContext, 'entry'>;
}) {
  const isError = ERROR_KEYS.has(entry.key);
  const isMilestone = entry.type === 'order_milestone';
  const override = entry.eventType ? EVENT_TYPE_OVERRIDES[entry.eventType] : undefined;
  const Icon = override
    ? override.icon
    : isMilestone
    ? MILESTONE_ICONS[entry.key]
    : TRACKING_ICONS[entry.key];
  const label = composeLabel({ entry, ...labelCtx });

  // Tracking events surface a small subtitle line for the in-flight ETA copy.
  // Milestone details are inlined into the label by `composeLabel`, so we only
  // render `entry.detail` as a 3rd line for tracking events.
  const showDetailSubtitle = entry.type === 'tracking_event' && Boolean(entry.detail);

  // Unified icon dimensions and squared shape across milestones and tracking
  // events. Milestones stay solid (filled); tracking events read as outlined
  // sub-points so the milestone hierarchy is still visible at a glance.
  let dotClass: string;
  let iconColorClass = 'text-white';
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
  } else if (isMilestone) {
    dotClass = 'bg-semantic-brand';
    textClass = 'text-semantic-text-primary';
  } else {
    dotClass = 'bg-semantic-bg-elevated border-2 border-semantic-brand';
    iconColorClass = 'text-semantic-brand';
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
          className={cn(
            'w-5 h-5 rounded-md flex-shrink-0 mt-0.5 flex items-center justify-center',
            dotClass
          )}
        >
          {Icon && (
            <Icon size={12} weight="bold" className={iconColorClass} />
          )}
        </div>
        {showLine && (
          <div className={`flex-1 min-h-[20px] ${lineClass}`} />
        )}
      </div>

      <div className={isLast ? 'pb-0' : 'pb-3'}>
        <p className={cn('text-sm font-medium', textClass)}>
          {label}
        </p>
        {showDetailSubtitle && (
          <p className="text-xs text-semantic-text-muted mt-0.5">
            {entry.detail}
          </p>
        )}
        {entry.timestamp && !entry.isFuture && (
          <p className="text-xs text-semantic-text-muted mt-0.5">
            {formatDateTime(entry.timestamp)}
          </p>
        )}
      </div>
    </div>
  );
}

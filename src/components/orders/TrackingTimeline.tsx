import { Card, CardBody } from '@/components/ui';
import { formatDateTime } from '@/lib/date-utils';
import type { TrackingStateType } from '@/lib/services/unisend/types';
import type { TrackingEventRow } from '@/lib/services/tracking';
import type { OrderStatus } from '@/lib/orders/types';

interface TrackingTimelineProps {
  events: TrackingEventRow[];
  trackingUrl: string | null;
  status: OrderStatus;
}

const STATE_LABELS: Partial<Record<TrackingStateType, string>> = {
  PARCEL_RECEIVED: 'Dropped off at terminal',
  ON_THE_WAY: 'In transit',
  PARCEL_DELIVERED: 'Ready for pickup',
  PARCEL_CANCELED: 'Shipment cancelled',
  RETURNING: 'Returning to sender',
};

/** States that indicate an error/terminal condition */
const ERROR_STATES: TrackingStateType[] = ['PARCEL_CANCELED', 'RETURNING'];

export function TrackingTimeline({ events, trackingUrl, status }: TrackingTimelineProps) {
  // Filter out LABEL_CREATED (system noise) and unknown states
  // Events arrive pre-sorted chronologically from the DB query
  const displayEvents = events
    .filter((e) => STATE_LABELS[e.state_type as TrackingStateType]);

  // Empty state: show placeholder for shipped/delivered, hide for completed
  if (displayEvents.length === 0) {
    if (status !== 'shipped' && status !== 'delivered') return null;

    return (
      <Card>
        <CardBody>
          <h2 className="text-base font-semibold text-semantic-text-heading mb-3">
            Parcel tracking
          </h2>
          <p className="text-sm text-semantic-text-muted">
            Waiting for tracking updates
          </p>
          {trackingUrl && (
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

  return (
    <Card>
      <CardBody>
        <h2 className="text-base font-semibold text-semantic-text-heading mb-3">
          Parcel tracking
        </h2>

        <div className="flex flex-col">
          {displayEvents.map((event, index) => {
            const stateType = event.state_type as TrackingStateType;
            const isError = ERROR_STATES.includes(stateType);
            const isLast = index === displayEvents.length - 1;

            return (
              <div key={`${event.state_type}-${event.event_timestamp}`} className="flex gap-3">
                {/* Dot and line */}
                <div className="flex flex-col items-center">
                  <div
                    className={`w-3 h-3 rounded-full flex-shrink-0 mt-1 ${
                      isError
                        ? 'bg-semantic-error'
                        : 'bg-semantic-brand'
                    }`}
                  />
                  {!isLast && (
                    <div className={`w-0.5 flex-1 min-h-[24px] ${isError ? 'bg-semantic-error' : 'bg-semantic-brand'}`} />
                  )}
                </div>

                {/* Content */}
                <div className={isLast ? 'pb-0' : 'pb-4'}>
                  <p
                    className={`text-sm font-medium ${
                      isError ? 'text-semantic-error' : 'text-semantic-text-primary'
                    }`}
                  >
                    {STATE_LABELS[stateType]}
                  </p>
                  {event.location && (
                    <p className="text-xs text-semantic-text-muted mt-0.5">
                      {event.location}
                    </p>
                  )}
                  <p className="text-xs text-semantic-text-muted mt-0.5">
                    {formatDateTime(event.event_timestamp)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {trackingUrl && (
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

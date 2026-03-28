'use client';

import { TIMELINE_STEPS } from '@/lib/orders/constants';
import type { OrderStatus } from '@/lib/orders/types';
import { formatDate } from '@/lib/date-utils';

interface OrderTimelineProps {
  status: OrderStatus;
  timestamps: {
    created_at: string;
    accepted_at: string | null;
    shipped_at: string | null;
    delivered_at: string | null;
    completed_at: string | null;
    cancelled_at: string | null;
    disputed_at: string | null;
    refunded_at: string | null;
  };
}

const STEP_TIMESTAMP_MAP: Record<string, keyof OrderTimelineProps['timestamps']> = {
  pending_seller: 'created_at',
  accepted: 'accepted_at',
  shipped: 'shipped_at',
  delivered: 'delivered_at',
  completed: 'completed_at',
};

export function OrderTimeline({ status, timestamps }: OrderTimelineProps) {
  const isCancelled = status === 'cancelled';
  const isDisputed = status === 'disputed';
  const isRefunded = status === 'refunded';
  const isTerminal = isCancelled || isDisputed || isRefunded;

  // Find current step index in the happy path
  const currentIndex = TIMELINE_STEPS.findIndex((s) => s.status === status);

  return (
    <div className="flex flex-col gap-0">
      {TIMELINE_STEPS.map((step, index) => {
        const timestampKey = STEP_TIMESTAMP_MAP[step.status];
        const timestamp = timestampKey ? timestamps[timestampKey] : null;
        const isPast = !isTerminal && currentIndex >= 0 && index < currentIndex;
        const isCurrent = !isTerminal && index === currentIndex;
        const isFuture = isTerminal || (currentIndex >= 0 && index > currentIndex);
        const isLast = index === TIMELINE_STEPS.length - 1;

        return (
          <div key={step.status} className="flex gap-3">
            {/* Dot and line */}
            <div className="flex flex-col items-center">
              <div
                className={`w-3 h-3 rounded-full flex-shrink-0 mt-1 ${
                  isCurrent
                    ? 'bg-semantic-brand ring-4 ring-semantic-brand/20'
                    : isPast
                    ? 'bg-semantic-brand'
                    : 'bg-semantic-border-subtle'
                }`}
              />
              {!isLast && (
                <div
                  className={`w-0.5 flex-1 min-h-[24px] ${
                    isPast ? 'bg-semantic-brand' : 'bg-semantic-border-subtle'
                  }`}
                />
              )}
            </div>

            {/* Content */}
            <div className={`pb-4 ${isLast ? 'pb-0' : ''}`}>
              <p
                className={`text-sm font-medium ${
                  isCurrent
                    ? 'text-semantic-brand'
                    : isPast
                    ? 'text-semantic-text-primary'
                    : isFuture
                    ? 'text-semantic-text-muted'
                    : ''
                }`}
              >
                {step.label}
              </p>
              {timestamp && (
                <p className="text-xs text-semantic-text-muted mt-0.5">
                  {formatDate(timestamp)}
                </p>
              )}
            </div>
          </div>
        );
      })}

      {/* Show cancelled/disputed as divergent endpoint */}
      {isTerminal && (
        <div className="flex gap-3">
          <div className="flex flex-col items-center">
            <div className="w-3 h-3 rounded-full flex-shrink-0 mt-1 bg-semantic-error ring-4 ring-semantic-error/20" />
          </div>
          <div>
            <p className="text-sm font-medium text-semantic-error">
              {isCancelled ? 'Cancelled' : isRefunded ? 'Refunded' : 'Disputed'}
            </p>
            {isCancelled && timestamps.cancelled_at && (
              <p className="text-xs text-semantic-text-muted mt-0.5">
                {formatDate(timestamps.cancelled_at)}
              </p>
            )}
            {isDisputed && timestamps.disputed_at && (
              <p className="text-xs text-semantic-text-muted mt-0.5">
                {formatDate(timestamps.disputed_at)}
              </p>
            )}
            {isRefunded && timestamps.refunded_at && (
              <p className="text-xs text-semantic-text-muted mt-0.5">
                {formatDate(timestamps.refunded_at)}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

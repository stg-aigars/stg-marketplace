import { Badge, Card, CardBody } from '@/components/ui';
import { formatDate } from '@/lib/date-utils';
import type { DisputeRow } from '@/lib/orders/types';

interface DisputeDetailsProps {
  dispute: DisputeRow;
}

export function DisputeDetails({ dispute }: DisputeDetailsProps) {
  const isEscalated = !!dispute.escalated_at;
  const isResolved = !!dispute.resolved_at;

  function getStatusBadge() {
    if (isResolved) {
      if (dispute.resolution === 'refunded') {
        return <Badge variant="error">Refunded</Badge>;
      }
      return <Badge variant="success">Resolved</Badge>;
    }
    if (isEscalated) {
      return <Badge variant="warning">Escalated to staff</Badge>;
    }
    return <Badge variant="warning">Under review</Badge>;
  }

  return (
    <Card>
      <CardBody>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-semantic-text-heading">
              Dispute details
            </h2>
            {getStatusBadge()}
          </div>

          {/* Reason */}
          <div>
            <p className="text-sm text-semantic-text-primary">{dispute.reason}</p>
          </div>

          {/* Photos */}
          {dispute.photos && dispute.photos.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {dispute.photos.map((url, index) => (
                <a
                  key={url}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block aspect-square rounded-lg overflow-hidden"
                >
                  <img
                    src={url}
                    alt={`Dispute photo ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                </a>
              ))}
            </div>
          )}

          {/* Resolution notes */}
          {dispute.resolution_notes && (
            <div className="p-3 rounded-lg bg-semantic-bg-subtle">
              <p className="text-sm text-semantic-text-secondary">
                <span className="font-medium">Staff notes:</span> {dispute.resolution_notes}
              </p>
            </div>
          )}

          {/* Dates */}
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-semantic-text-muted">
            <span>Opened {formatDate(dispute.created_at)}</span>
            {isResolved && dispute.resolved_at && (
              <span>Resolved {formatDate(dispute.resolved_at)}</span>
            )}
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

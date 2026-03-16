'use client';

import { Card, CardBody } from '@/components/ui';

interface ShippingInfoProps {
  terminalName: string | null;
  terminalCountry: string | null;
  parcelId: number | null;
  barcode: string | null;
  trackingUrl: string | null;
  userRole: 'buyer' | 'seller';
}

export function ShippingInfo({
  terminalName,
  parcelId,
  barcode,
  trackingUrl,
  userRole,
}: ShippingInfoProps) {
  if (!parcelId && !terminalName) return null;

  return (
    <Card>
      <CardBody>
        <h2 className="text-base font-semibold text-semantic-text-heading mb-3">
          Shipping
        </h2>
        <div className="space-y-3">
          {terminalName && (
            <div>
              <p className="text-sm text-semantic-text-muted">
                {userRole === 'seller' ? 'Delivery terminal' : 'Pickup terminal'}
              </p>
              <p className="text-sm text-semantic-text-primary mt-0.5">
                {terminalName}
              </p>
            </div>
          )}

          {parcelId && (
            <div>
              <p className="text-sm text-semantic-text-muted">Parcel ID</p>
              <p className="text-sm font-mono font-semibold text-semantic-text-heading mt-0.5">
                {parcelId}
              </p>
            </div>
          )}

          {barcode && (
            <div>
              <p className="text-sm text-semantic-text-muted">Barcode</p>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-sm font-mono text-semantic-text-primary">
                  {barcode}
                </p>
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(barcode)}
                  className="text-xs text-semantic-primary sm:hover:text-semantic-primary-hover transition-colors"
                >
                  Copy
                </button>
              </div>
            </div>
          )}

          {trackingUrl && (
            <div>
              <a
                href={trackingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-semantic-primary sm:hover:text-semantic-primary-hover transition-colors"
              >
                Track parcel
              </a>
            </div>
          )}

          {userRole === 'seller' && parcelId && (
            <div className="mt-2 p-3 rounded-lg bg-semantic-bg-subtle">
              <p className="text-sm text-semantic-text-secondary">
                Drop your parcel at any Unisend terminal. Use parcel ID: <span className="font-semibold">{parcelId}</span>
              </p>
            </div>
          )}
        </div>
      </CardBody>
    </Card>
  );
}

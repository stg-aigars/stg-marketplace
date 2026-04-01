'use client';

import { Card, CardBody } from '@/components/ui';

interface ShippingInfoProps {
  terminalName: string | null;
  terminalAddress: string | null;
  terminalCity: string | null;
  terminalPostalCode: string | null;
  terminalCountry: string | null;
  parcelId: number | null;
  trackingUrl: string | null;
  userRole: 'buyer' | 'seller';
}

function formatTerminalAddress(
  name: string | null,
  address: string | null,
  city: string | null,
  postalCode: string | null,
  country: string | null
): string {
  if (!name) return '';
  const parts = [name];
  if (address) parts.push(address);
  const cityPostal = [city, postalCode].filter(Boolean).join(', ');
  if (cityPostal) parts.push(cityPostal);
  if (country) parts.push(country);
  return parts.join(' / ');
}

export function ShippingInfo({
  terminalName,
  terminalAddress,
  terminalCity,
  terminalPostalCode,
  terminalCountry,
  parcelId,
  trackingUrl,
  userRole,
}: ShippingInfoProps) {
  if (!parcelId && !terminalName) return null;

  const hasAddress = terminalAddress || terminalCity;

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
                {hasAddress
                  ? formatTerminalAddress(terminalName, terminalAddress, terminalCity, terminalPostalCode, terminalCountry)
                  : terminalName}
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

          {trackingUrl && (
            <div>
              <a
                href={trackingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-semantic-brand sm:hover:text-semantic-brand-hover transition-colors duration-250 ease-out-custom"
              >
                Track parcel
              </a>
            </div>
          )}

        </div>
      </CardBody>
    </Card>
  );
}

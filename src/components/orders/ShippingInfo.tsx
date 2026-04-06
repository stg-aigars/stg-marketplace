import { Card, CardBody } from '@/components/ui';

interface ShippingInfoProps {
  terminalName: string | null;
  terminalAddress: string | null;
  terminalCity: string | null;
  terminalPostalCode: string | null;
  terminalCountry: string | null;
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
  userRole,
}: ShippingInfoProps) {
  if (!terminalName) return null;

  const hasAddress = terminalAddress || terminalCity;

  return (
    <Card>
      <CardBody>
        <p className="text-sm text-semantic-text-muted">
          {userRole === 'seller' ? "Buyer's pickup terminal" : 'Your pickup terminal'}
        </p>
        <p className="text-sm text-semantic-text-primary mt-1">
          {hasAddress
            ? formatTerminalAddress(terminalName, terminalAddress, terminalCity, terminalPostalCode, terminalCountry)
            : terminalName}
        </p>
      </CardBody>
    </Card>
  );
}

import { Card, CardBody } from '@/components/ui';
import { formatTerminalLines } from '@/lib/terminals/format';

interface ShippingInfoProps {
  terminalName: string | null;
  terminalAddress: string | null;
  terminalCity: string | null;
  terminalPostalCode: string | null;
  terminalCountry: string | null;
  userRole: 'buyer' | 'seller';
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

  const lines = userRole === 'buyer'
    ? formatTerminalLines({
        name: terminalName,
        address: terminalAddress,
        city: terminalCity,
        postalCode: terminalPostalCode,
        country: terminalCountry,
      })
    : [terminalName];

  return (
    <Card>
      <CardBody>
        <p className="text-sm text-semantic-text-muted">
          {userRole === 'seller' ? "Buyer's pickup terminal" : 'Your pickup terminal'}
        </p>
        <div className="text-sm text-semantic-text-primary mt-1 space-y-0.5">
          {lines.map((line, i) => (
            <p key={i}>{line}</p>
          ))}
        </div>
      </CardBody>
    </Card>
  );
}

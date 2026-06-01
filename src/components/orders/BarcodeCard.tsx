import { cn } from '@/lib/cn';

interface BarcodeCardProps {
  barcode: string;
  className?: string;
}

/**
 * Brand-tinted block showing the parcel barcode the seller types at the locker
 * kiosk to print the shipping label. Margin is caller-controlled via className.
 */
export function BarcodeCard({ barcode, className }: BarcodeCardProps) {
  return (
    <div className={cn('p-4 rounded-lg bg-semantic-brand/10 border border-semantic-brand/30', className)}>
      <p className="text-sm text-semantic-text-secondary mb-2">
        Enter this barcode at the parcel locker kiosk to print your shipping label
      </p>
      <code className="font-mono text-lg font-semibold tracking-wider text-semantic-text-heading">
        {barcode}
      </code>
    </div>
  );
}

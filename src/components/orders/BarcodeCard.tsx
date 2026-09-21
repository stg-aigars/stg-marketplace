import { QRCodeSVG } from 'qrcode.react';
import { cn } from '@/lib/cn';

interface BarcodeCardProps {
  barcode: string;
  className?: string;
}

/**
 * Brand-tinted block showing the parcel code the seller scans (or types) at
 * the locker kiosk to print the shipping label. The QR code encodes the same
 * reference as the printed text — confirmed against a real Unisend label,
 * which prints both a linear barcode and a QR code for this exact value, and
 * Unisend kiosks accept scanning either as an alternative to manual entry.
 * QR colors are hardcoded pure black/white rather than design tokens: scan
 * reliability needs maximum contrast regardless of theme, so this is a
 * technical requirement, not a branding choice.
 */
export function BarcodeCard({ barcode, className }: BarcodeCardProps) {
  return (
    <div className={cn('p-4 rounded-lg bg-semantic-brand/10 border border-semantic-brand/30', className)}>
      <p className="text-sm text-semantic-text-secondary mb-3">
        Scan this code at the parcel locker kiosk, or enter it manually to print your shipping label
      </p>
      <div className="flex items-center gap-4">
        <div className="shrink-0 p-2 bg-white rounded-md">
          <QRCodeSVG
            value={barcode}
            size={96}
            bgColor="#FFFFFF"
            fgColor="#000000"
            level="M"
            marginSize={0}
            title={`Drop-off QR code: ${barcode}`}
          />
        </div>
        <code className="font-mono text-lg font-semibold tracking-wider text-semantic-text-heading break-all">
          {barcode}
        </code>
      </div>
    </div>
  );
}

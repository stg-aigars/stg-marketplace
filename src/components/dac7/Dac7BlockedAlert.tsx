import Link from 'next/link';
import { Alert } from '@/components/ui';

/**
 * Shared alert for DAC7-blocked sellers, used across all sell-flow entry points.
 */
export function Dac7BlockedAlert() {
  return (
    <Alert variant="error">
      <p>
        New listings are paused until you provide your tax details.
      </p>
      <Link href="/account/tax" className="text-sm font-medium underline mt-1 inline-block">
        Go to tax settings
      </Link>
    </Alert>
  );
}

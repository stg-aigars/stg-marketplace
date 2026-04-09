import Link from 'next/link';
import { Alert } from '@/components/ui';

/**
 * Shared alert for DAC7-blocked sellers, used across all sell-flow entry points.
 */
export function Dac7BlockedAlert() {
  return (
    <Alert variant="error">
      <p>
        Your ability to create new listings has been paused because required
        tax reporting information has not been provided.
      </p>
      <Link href="/account/settings/tax" className="text-sm font-medium underline mt-1 inline-block">
        Provide tax information to restore access
      </Link>
    </Alert>
  );
}

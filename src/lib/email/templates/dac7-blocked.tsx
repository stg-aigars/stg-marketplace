/**
 * DAC7 Account Blocked — Seller
 * Sent when seller's account is restricted due to non-compliance.
 */

import { Button, Text } from '@react-email/components';
import * as React from 'react';
import { EmailLayout, theme, templateStyles as s } from './layout';

interface Dac7BlockedProps {
  sellerName: string;
  appUrl: string;
}

export function Dac7Blocked({
  sellerName,
  appUrl,
}: Dac7BlockedProps) {
  return (
    <EmailLayout preview="Your Second Turn Games account has been restricted">
      <Text style={s.greeting}>Hi {sellerName},</Text>

      <Text style={styles.alert}>
        New listings and withdrawals on Second Turn Games are paused.
      </Text>

      <Text style={s.body}>
        We need your tax details under EU reporting rules (DAC7) but haven&apos;t
        received them yet. Fill them in to restore full access.
      </Text>

      <Text style={s.body}>
        Your existing listings are still active and your wallet balance is safe.
        Access is restored as soon as you submit the form.
      </Text>

      <div style={s.ctaSection}>
        <Button style={s.ctaOrange} href={`${appUrl}/account/tax`}>
          Fill in tax details
        </Button>
      </div>

      <Text style={s.note}>
        Think this is a mistake? Contact info@secondturn.games.
      </Text>
    </EmailLayout>
  );
}

const styles = {
  alert: {
    color: theme.textPrimary,
    fontSize: '15px',
    fontWeight: '600' as const,
    lineHeight: '24px',
    margin: '0 0 16px',
    backgroundColor: '#FEE2E2',
    padding: '12px 16px',
    borderRadius: '8px',
  },
} as const;

export default Dac7Blocked;

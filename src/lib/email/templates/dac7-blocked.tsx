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
        Your ability to create new listings and withdraw funds on Second Turn Games
        has been paused.
      </Text>

      <Text style={s.body}>
        We were unable to collect the tax reporting information required under
        EU Directive 2021/514 (DAC7). To restore full access, please provide
        the required details in your account settings.
      </Text>

      <Text style={s.body}>
        Your existing listings remain active and your wallet balance is safe.
        Once you provide the required information, your account will be
        fully restored.
      </Text>

      <div style={s.ctaSection}>
        <Button style={s.ctaOrange} href={`${appUrl}/account/settings/tax`}>
          Provide Tax Information
        </Button>
      </div>

      <Text style={s.note}>
        If you believe this is an error or need help, please contact us at
        support@secondturn.games.
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

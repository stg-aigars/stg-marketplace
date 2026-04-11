/**
 * DAC7 Reminder — Seller
 * Final reminder before account restriction.
 */

import { Button, Text } from '@react-email/components';
import * as React from 'react';
import { EmailLayout, theme, templateStyles as s } from './layout';

interface Dac7ReminderProps {
  sellerName: string;
  appUrl: string;
}

export function Dac7Reminder({
  sellerName,
  appUrl,
}: Dac7ReminderProps) {
  return (
    <EmailLayout preview="Final reminder: Tax reporting information needed — account restriction in 14 days">
      <Text style={s.greeting}>Hi {sellerName},</Text>

      <Text style={s.body}>
        We still need your tax details. This is the final reminder.
      </Text>

      <Text style={styles.warning}>
        If we don&apos;t receive your details within 14 days, new listings
        and withdrawals will be paused.
      </Text>

      <Text style={s.body}>
        Go to your account settings and fill in your date of birth,
        personal code, country, address, and IBAN.
      </Text>

      <div style={s.ctaSection}>
        <Button style={s.ctaOrange} href={`${appUrl}/account/tax`}>
          Fill in tax details
        </Button>
      </div>

      <Text style={s.note}>
        Questions? Contact support@secondturn.games.
      </Text>
    </EmailLayout>
  );
}

const styles = {
  warning: {
    color: theme.orange,
    fontSize: '15px',
    fontWeight: '600' as const,
    lineHeight: '24px',
    margin: '0 0 16px',
  },
} as const;

export default Dac7Reminder;

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
        We still need your tax reporting information. This is a final reminder.
      </Text>

      <Text style={styles.warning}>
        If you do not provide the required information within 14 days,
        your ability to create new listings and withdraw funds will be paused.
      </Text>

      <Text style={s.body}>
        Please provide your date of birth, tax identification number, country
        of tax residence, address, and bank account (IBAN) in your account settings.
      </Text>

      <div style={s.ctaSection}>
        <Button style={s.ctaOrange} href={`${appUrl}/account/settings/tax`}>
          Provide Tax Information
        </Button>
      </div>

      <Text style={s.note}>
        If you have any questions, please contact us at support@secondturn.games.
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

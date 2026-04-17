/**
 * Account Deleted Confirmation
 * Sent when a user deletes their account. Confirms the action and provides info about data retention.
 */

import { Text } from '@react-email/components';
import * as React from 'react';
import { EmailLayout, templateStyles as s } from './layout';

interface AccountDeletedProps {
  userName: string;
}

export function AccountDeleted({ userName }: AccountDeletedProps) {
  return (
    <EmailLayout preview="Your Second Turn Games account has been deleted">
      <Text style={s.greeting}>Hi {userName},</Text>

      <Text style={s.body}>
        Your Second Turn Games account has been deleted as requested.
      </Text>

      <Text style={s.body}>
        Your personal information (name, email, phone) has been removed. Some transaction records
        (orders, invoices) are retained for up to 7 years as required by tax regulations.
      </Text>

      <Text style={s.note}>
        If you did not request this deletion, please contact us immediately at info@secondturn.games.
      </Text>
    </EmailLayout>
  );
}

export default AccountDeleted;

/**
 * DAC7 Approaching Threshold — Seller
 * Friendly heads-up when seller nears the warning threshold.
 */

import { Button, Text } from '@react-email/components';
import * as React from 'react';
import { EmailLayout, templateStyles as s } from './layout';

interface Dac7ApproachingProps {
  sellerName: string;
  transactionCount: number;
  considerationEuros: string;
  appUrl: string;
}

export function Dac7Approaching({
  sellerName,
  transactionCount,
  considerationEuros,
  appUrl,
}: Dac7ApproachingProps) {
  return (
    <EmailLayout preview="You're approaching the EU tax reporting threshold">
      <Text style={s.greeting}>Hi {sellerName},</Text>

      <Text style={s.body}>
        You're getting close to the EU tax reporting threshold on Second Turn Games.
        EU rules (DAC7) require us to report seller activity to tax authorities once
        a seller reaches 30 sales or 2,000 EUR in a calendar year.
      </Text>

      <div style={s.orderCard}>
        <Text style={s.detailLabel}>Sales this year</Text>
        <Text style={s.detailValue}>{transactionCount}</Text>

        <Text style={s.detailLabel}>Total amount</Text>
        <Text style={s.detailValue}>{considerationEuros}</Text>
      </div>

      <Text style={s.body}>
        If you reach the threshold, we'll ask for a few extra details:
        date of birth, personal code (TIN), and bank account. This is
        about reporting, not additional taxes.
      </Text>

      <div style={s.ctaSection}>
        <Button style={s.ctaFrost} href={`${appUrl}/account/tax`}>
          Learn more
        </Button>
      </div>

      <Text style={s.note}>
        Nothing to do right now. We'll let you know if you reach the threshold.
      </Text>
    </EmailLayout>
  );
}

export default Dac7Approaching;

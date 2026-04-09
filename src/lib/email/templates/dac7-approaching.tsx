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
        Your sales on Second Turn Games are approaching the EU tax reporting threshold.
        Under EU Directive 2021/514 (DAC7), platforms are required to report seller
        activity to tax authorities when a seller completes 30 or more transactions or
        earns more than 2,000 EUR in a calendar year.
      </Text>

      <div style={s.orderCard}>
        <Text style={s.detailLabel}>Completed sales this year</Text>
        <Text style={s.detailValue}>{transactionCount}</Text>

        <Text style={s.detailLabel}>Total sales amount</Text>
        <Text style={s.detailValue}>{considerationEuros}</Text>
      </div>

      <Text style={s.body}>
        If you reach the threshold, we will ask you to provide some additional
        information (date of birth, tax identification number, and bank account).
        This does not create new tax obligations — it ensures transparency for
        income you may already need to declare.
      </Text>

      <div style={s.ctaSection}>
        <Button style={s.ctaFrost} href={`${appUrl}/account/settings/tax`}>
          Learn More
        </Button>
      </div>

      <Text style={s.note}>
        No action is required right now. We will notify you if you reach the threshold.
      </Text>
    </EmailLayout>
  );
}

export default Dac7Approaching;

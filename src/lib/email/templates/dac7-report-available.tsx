/**
 * DAC7 Report Available — Seller
 * Sent before annual report submission to VID (legally required).
 */

import { Button, Text } from '@react-email/components';
import * as React from 'react';
import { EmailLayout, templateStyles as s } from './layout';

interface Dac7ReportAvailableProps {
  sellerName: string;
  year: number;
  appUrl: string;
}

export function Dac7ReportAvailable({
  sellerName,
  year,
  appUrl,
}: Dac7ReportAvailableProps) {
  return (
    <EmailLayout preview={`Your annual tax report for ${year} is ready for review`}>
      <Text style={s.greeting}>Hi {sellerName},</Text>

      <Text style={s.body}>
        Your annual tax report for {year} has been generated and is ready for
        your review. This report summarizes the information that will be submitted
        to the State Revenue Service (VID) as required by EU Directive 2021/514
        (DAC7).
      </Text>

      <Text style={s.body}>
        Please review the report in your account settings. If you notice any
        inaccuracies, let us know before the report is submitted.
      </Text>

      <div style={s.ctaSection}>
        <Button style={s.ctaFrost} href={`${appUrl}/account/settings/tax`}>
          Review Your Report
        </Button>
      </div>

      <Text style={s.note}>
        The report may be shared with tax authorities in other EU member states
        via automatic exchange of information. Data is retained for 5 years
        from the end of the reporting period.
      </Text>
    </EmailLayout>
  );
}

export default Dac7ReportAvailable;

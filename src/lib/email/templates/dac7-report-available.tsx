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
        Your tax report for {year} is ready. It shows what we'll submit to the
        State Revenue Service (VID) under EU reporting rules (DAC7).
      </Text>

      <Text style={s.body}>
        Take a look and let us know if anything seems off before we submit.
      </Text>

      <div style={s.ctaSection}>
        <Button style={s.ctaFrost} href={`${appUrl}/account/tax`}>
          Review report
        </Button>
      </div>

      <Text style={s.note}>
        This report may be shared with tax authorities in other EU countries.
        Data is kept for 5 years.
      </Text>
    </EmailLayout>
  );
}

export default Dac7ReportAvailable;

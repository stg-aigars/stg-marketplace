/**
 * DAC7 Data Requested — Seller
 * Sent when seller crosses the regulatory threshold.
 */

import { Button, Text } from '@react-email/components';
import * as React from 'react';
import { EmailLayout, templateStyles as s } from './layout';

interface Dac7DataRequestedProps {
  sellerName: string;
  appUrl: string;
}

export function Dac7DataRequested({
  sellerName,
  appUrl,
}: Dac7DataRequestedProps) {
  return (
    <EmailLayout preview="Action required: Tax reporting information needed">
      <Text style={s.greeting}>Hi {sellerName},</Text>

      <Text style={s.body}>
        You've reached the EU tax reporting threshold on Second Turn Games.
        Under EU rules (DAC7), we need to collect a few details from you.
      </Text>

      <Text style={s.body}>
        Head to your account settings and fill in:
      </Text>

      <Text style={s.stepList}>
        {'• Date of birth\n• Personal code (TIN)\n• Country of tax residence\n• Address\n• Bank account (IBAN)'}
      </Text>

      <div style={s.ctaSection}>
        <Button style={s.ctaOrange} href={`${appUrl}/account/tax`}>
          Fill in tax details
        </Button>
      </div>

      <Text style={s.note}>
        This data is reported to the State Revenue Service (VID) and may be
        shared with tax authorities in other EU countries. This is about
        reporting, not additional taxes.
      </Text>
    </EmailLayout>
  );
}

export default Dac7DataRequested;

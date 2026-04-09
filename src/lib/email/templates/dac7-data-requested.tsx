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
        You have reached the EU tax reporting threshold on Second Turn Games.
        Under EU Directive 2021/514 (DAC7), we are required to collect some
        additional information from you.
      </Text>

      <Text style={s.body}>
        Please provide the following in your account settings:
      </Text>

      <Text style={s.stepList}>
        {'• Date of birth\n• Tax identification number (personal code)\n• Country of tax residence\n• Address\n• Bank account (IBAN)'}
      </Text>

      <div style={s.ctaSection}>
        <Button style={s.ctaOrange} href={`${appUrl}/account/settings/tax`}>
          Provide Tax Information
        </Button>
      </div>

      <Text style={s.note}>
        This information will be shared with the State Revenue Service (VID) and may
        be exchanged with tax authorities in other EU member states. This does not
        create new tax obligations — it ensures transparency for income you may
        already need to declare.
      </Text>
    </EmailLayout>
  );
}

export default Dac7DataRequested;

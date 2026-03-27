/**
 * Wanted Offer Declined — Affected party
 * Sent when the other party declines a wanted offer.
 */

import { Link, Text } from '@react-email/components';
import * as React from 'react';
import { EmailLayout, templateStyles } from './layout';

interface WantedOfferDeclinedProps {
  recipientName: string;
  otherPartyName: string;
  gameName: string;
  wantedUrl: string;
}

export function WantedOfferDeclined({
  recipientName,
  otherPartyName,
  gameName,
  wantedUrl,
}: WantedOfferDeclinedProps) {
  return (
    <EmailLayout preview={`Your offer for ${gameName} was declined`}>
      <Text style={templateStyles.greeting}>Hi {recipientName},</Text>

      <Text style={templateStyles.body}>
        <strong>{otherPartyName}</strong> declined the offer for{' '}
        <strong>{gameName}</strong>.
      </Text>

      <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} border={0}>
        <tbody>
          <tr>
            <td style={templateStyles.ctaSection}>
              <Link href={wantedUrl} style={templateStyles.ctaFrost}>
                Browse wanted games
              </Link>
            </td>
          </tr>
        </tbody>
      </table>
    </EmailLayout>
  );
}

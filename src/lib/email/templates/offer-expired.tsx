/**
 * Offer Expired Notification — Buyer
 * Sent when an offer expires after 7 days without a response from the seller.
 */

import { Link, Text } from '@react-email/components';
import * as React from 'react';
import { EmailLayout, templateStyles } from './layout';

interface OfferExpiredProps {
  buyerName: string;
  gameName: string;
  offersUrl: string;
}

export function OfferExpired({
  buyerName,
  gameName,
  offersUrl,
}: OfferExpiredProps) {
  return (
    <EmailLayout preview={`Your offer on ${gameName} has expired`}>
      <Text style={templateStyles.greeting}>Hi {buyerName},</Text>

      <Text style={templateStyles.body}>
        Your offer on <strong>{gameName}</strong> has expired after 7 days
        without a response.
      </Text>

      <table
        role="presentation"
        width="100%"
        cellPadding={0}
        cellSpacing={0}
        border={0}
      >
        <tbody>
          <tr>
            <td style={templateStyles.ctaSection}>
              <Link href={offersUrl} style={templateStyles.ctaFrost}>
                View your offers
              </Link>
            </td>
          </tr>
        </tbody>
      </table>

      <Text style={templateStyles.note}>
        The game may still be available — check the seller&apos;s shelf if you&apos;re
        still interested.
      </Text>
    </EmailLayout>
  );
}

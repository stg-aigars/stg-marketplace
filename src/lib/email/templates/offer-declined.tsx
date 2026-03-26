/**
 * Offer Declined Notification — Buyer
 * Sent when the seller declines the buyer's offer.
 */

import { Link, Text } from '@react-email/components';
import * as React from 'react';
import { EmailLayout, templateStyles } from './layout';

interface OfferDeclinedProps {
  buyerName: string;
  sellerName: string;
  gameName: string;
  offersUrl: string;
}

export function OfferDeclined({
  buyerName,
  sellerName,
  gameName,
  offersUrl,
}: OfferDeclinedProps) {
  return (
    <EmailLayout preview={`Your offer on ${gameName} was declined`}>
      <Text style={templateStyles.greeting}>Hi {buyerName},</Text>

      <Text style={templateStyles.body}>
        <strong>{sellerName}</strong> declined your offer on{' '}
        <strong>{gameName}</strong>.
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
                Browse more games
              </Link>
            </td>
          </tr>
        </tbody>
      </table>

      <Text style={templateStyles.note}>
        You can always make a new offer if the game is still on their shelf.
      </Text>
    </EmailLayout>
  );
}

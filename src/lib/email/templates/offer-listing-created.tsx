/**
 * Offer Listing Created — Buyer Notification
 * Sent to the buyer when the seller creates a listing from their accepted offer.
 */

import { Link, Text } from '@react-email/components';
import * as React from 'react';
import { EmailLayout, templateStyles } from './layout';

interface OfferListingCreatedProps {
  buyerName: string;
  gameName: string;
  listingUrl: string;
}

export function OfferListingCreated({
  buyerName,
  gameName,
  listingUrl,
}: OfferListingCreatedProps) {
  return (
    <EmailLayout preview={`${gameName} is now listed and ready to buy`}>
      <Text style={templateStyles.greeting}>Hi {buyerName},</Text>

      <Text style={templateStyles.body}>
        <strong>{gameName}</strong> is now listed. You can buy it at the agreed price.
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
              <Link href={listingUrl} style={templateStyles.ctaFrost}>
                View listing
              </Link>
            </td>
          </tr>
        </tbody>
      </table>

      <Text style={templateStyles.note}>
        The listing is available to anyone, so don&apos;t wait too long.
      </Text>
    </EmailLayout>
  );
}

import type { Metadata } from 'next';
import Link from 'next/link';
import {
  LEGAL_ENTITY_NAME,
  LEGAL_ENTITY_ADDRESS,
  LEGAL_ENTITY_REG_NUMBER,
  LEGAL_ENTITY_PHONE,
} from '@/lib/constants';
import { CARD_SUBSECTION_HEADING_CLASS, PAGE_HEADING_CLASS } from '@/lib/heading-classes';
import { cn } from '@/lib/cn';
import { Card, CardBody } from '@/components/ui';
import { FeedbackFooterButton } from '@/components/feedback/FeedbackFooterButton';

export const metadata: Metadata = {
  title: 'Contact',
};

export default function ContactPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
      <h1 className={cn(PAGE_HEADING_CLASS, 'mb-6')}>
        Contact us
      </h1>

      <div className="max-w-lg space-y-6">
        <p className="text-semantic-text-secondary">
          Question or need help with an order? Get in touch.
        </p>

        <Card>
          <CardBody className="p-6 space-y-4">
            <div>
              <h2 className={cn(CARD_SUBSECTION_HEADING_CLASS, 'mb-1')}>
                Email
              </h2>
              <a
                href="mailto:info@secondturn.games"
                className="text-semantic-brand sm:hover:text-semantic-brand-hover transition-colors duration-250 ease-out-custom"
              >
                info@secondturn.games
              </a>
              <p className="text-sm text-semantic-text-muted mt-1">
                We aim to respond within 24 hours on business days.
              </p>
            </div>

            <div>
              <h2 className={cn(CARD_SUBSECTION_HEADING_CLASS, 'mb-1')}>
                Phone
              </h2>
              <a
                href={`tel:${LEGAL_ENTITY_PHONE.replace(/\s/g, '')}`}
                className="text-semantic-brand sm:hover:text-semantic-brand-hover transition-colors duration-250 ease-out-custom"
              >
                {LEGAL_ENTITY_PHONE}
              </a>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="p-6 space-y-4">
            <div>
              <h2 className={cn(CARD_SUBSECTION_HEADING_CLASS, 'mb-1')}>
                Business name
              </h2>
              <p className="text-semantic-text-secondary">{LEGAL_ENTITY_NAME}</p>
            </div>

            <div>
              <h2 className={cn(CARD_SUBSECTION_HEADING_CLASS, 'mb-1')}>
                Registration number
              </h2>
              <p className="text-semantic-text-secondary">{LEGAL_ENTITY_REG_NUMBER}</p>
            </div>

            <div>
              <h2 className={cn(CARD_SUBSECTION_HEADING_CLASS, 'mb-1')}>
                Registered address
              </h2>
              <p className="text-semantic-text-secondary">{LEGAL_ENTITY_ADDRESS}</p>
            </div>
          </CardBody>
        </Card>

        <div className="text-sm text-semantic-text-muted space-y-2">
          <p>
            For order-specific issues, please include your order number in your message.
          </p>
          <p>
            Have feedback or a suggestion?{' '}
            <FeedbackFooterButton className="link-brand">
              Send us a note
            </FeedbackFooterButton>
            .
          </p>
          <p>
            For GDPR data requests, see our{' '}
            <Link
              href="/privacy"
              className="link-brand"
            >
              Privacy Policy
            </Link>{' '}
            for data and privacy requests.
          </p>
        </div>
      </div>
    </div>
  );
}

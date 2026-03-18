import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Contact',
};

export default function ContactPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
      <h1 className="text-2xl sm:text-3xl font-bold text-semantic-text-heading mb-6">
        Contact us
      </h1>

      <div className="max-w-lg space-y-6">
        <p className="text-semantic-text-secondary">
          Have a question, found a bug, or need help with an order? We are here to help.
        </p>

        <div className="border border-semantic-border-subtle rounded-lg p-6 space-y-4">
          <div>
            <h2 className="text-base font-semibold text-semantic-text-heading mb-1">
              Email
            </h2>
            <a
              href="mailto:info@secondturn.games"
              className="text-frost-arctic sm:hover:text-frost-ice transition-colors"
            >
              info@secondturn.games
            </a>
          </div>

          <div>
            <h2 className="text-base font-semibold text-semantic-text-heading mb-1">
              Response time
            </h2>
            <p className="text-semantic-text-secondary">
              We aim to respond within 24 hours on business days.
            </p>
          </div>
        </div>

        <div className="text-sm text-semantic-text-muted space-y-2">
          <p>
            For order-specific issues, please include your order number in your message.
          </p>
          <p>
            For GDPR data requests, see our{' '}
            <Link
              href="/privacy"
              className="text-frost-arctic sm:hover:text-frost-ice transition-colors underline"
            >
              Privacy Policy
            </Link>{' '}
            for details on exercising your rights.
          </p>
        </div>
      </div>
    </div>
  );
}

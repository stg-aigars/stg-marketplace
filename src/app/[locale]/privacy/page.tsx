import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy Policy',
};

export default function PrivacyPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
      <h1 className="text-2xl sm:text-3xl font-bold text-semantic-text-heading mb-6">
        Privacy Policy
      </h1>

      <div className="prose prose-sm max-w-none text-semantic-text-secondary space-y-6">
        <p className="text-semantic-text-secondary">
          Last updated: 16 March 2026
        </p>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-semibold text-semantic-text-heading">
            1. Who we are
          </h2>
          <p>
            Second Turn Games (&ldquo;STG&rdquo;) operates a peer-to-peer board game marketplace
            for the Baltic region. This policy explains how we collect, use, and protect your
            personal data in accordance with the General Data Protection Regulation (GDPR).
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-semibold text-semantic-text-heading">
            2. Data we collect
          </h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>
              <strong>Account data:</strong> email address, display name, country, phone number
              (optional)
            </li>
            <li>
              <strong>Listing data:</strong> game details, condition, photos, pricing
            </li>
            <li>
              <strong>Order data:</strong> purchase history, shipping addresses (parcel locker
              selections), order status
            </li>
            <li>
              <strong>Payment data:</strong> processed securely by EveryPay (Swedbank) — we do not
              store card details
            </li>
            <li>
              <strong>Usage data:</strong> pages visited, browser type, IP address (for security and
              analytics)
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-semibold text-semantic-text-heading">
            3. How we use your data
          </h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>To provide and operate the marketplace</li>
            <li>To process transactions and generate shipping labels</li>
            <li>To send transactional emails (order confirmations, shipping updates)</li>
            <li>To prevent fraud and enforce our terms of service</li>
            <li>To improve our platform based on usage patterns</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-semibold text-semantic-text-heading">
            4. Data storage and security
          </h2>
          <p>
            Your data is stored securely using Supabase (cloud database) with row-level security
            policies. Our servers are hosted in the EU (Helsinki, Finland). All data transmission is
            encrypted via TLS. Photos are stored in Supabase Storage with access controls.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-semibold text-semantic-text-heading">
            5. Data sharing
          </h2>
          <p>We share your data only with:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>
              <strong>EveryPay (Swedbank):</strong> payment processing
            </li>
            <li>
              <strong>Unisend:</strong> parcel locker shipping and label generation
            </li>
            <li>
              <strong>Resend:</strong> transactional email delivery
            </li>
          </ul>
          <p>We do not sell your personal data to third parties.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-semibold text-semantic-text-heading">
            6. Cookies
          </h2>
          <p>
            We use essential cookies for authentication and session management. These are necessary
            for the platform to function and cannot be disabled. We do not use advertising or
            tracking cookies.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-semibold text-semantic-text-heading">
            7. Your rights under GDPR
          </h2>
          <p>You have the right to:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>
              <strong>Access</strong> your personal data
            </li>
            <li>
              <strong>Rectify</strong> inaccurate data
            </li>
            <li>
              <strong>Erase</strong> your data (&ldquo;right to be forgotten&rdquo;)
            </li>
            <li>
              <strong>Port</strong> your data to another service
            </li>
            <li>
              <strong>Object</strong> to processing of your data
            </li>
            <li>
              <strong>Restrict</strong> processing in certain circumstances
            </li>
          </ul>
          <p>
            To exercise any of these rights, please contact us via our{' '}
            <Link
              href="/contact"
              className="text-frost-arctic sm:hover:text-frost-ice transition-colors underline"
            >
              contact page
            </Link>
            .
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-semibold text-semantic-text-heading">
            8. Data retention
          </h2>
          <p>
            We retain your account data for as long as your account is active. Order data is
            retained for 7 years for tax and legal compliance. You may request deletion of your
            account at any time, subject to legal retention requirements.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-semibold text-semantic-text-heading">
            9. Changes to this policy
          </h2>
          <p>
            We may update this policy from time to time. We will notify registered users of
            significant changes via email.
          </p>
        </section>

        <p className="text-sm text-semantic-text-muted pt-4 border-t border-semantic-border-subtle">
          See also our{' '}
          <Link
            href="/terms"
            className="text-frost-arctic sm:hover:text-frost-ice transition-colors underline"
          >
            Terms of Service
          </Link>
          .
        </p>
      </div>
    </div>
  );
}

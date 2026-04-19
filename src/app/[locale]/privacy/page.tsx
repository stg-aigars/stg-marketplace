import type { Metadata } from 'next';
import Link from 'next/link';
import { Card, CardBody, CardHeader } from '@/components/ui';
import { PRIVACY_VERSION_DISPLAY } from '@/lib/legal/constants';
import {
  LEGAL_ENTITY_NAME,
  LEGAL_ENTITY_ADDRESS,
  LEGAL_ENTITY_REG_NUMBER,
} from '@/lib/constants';

export const metadata: Metadata = {
  title: 'Privacy Policy',
};

const subHeadingClass = 'text-base font-semibold pt-2';

export default function PrivacyPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
      <h1 className="text-2xl sm:text-3xl font-bold font-display tracking-tight text-semantic-text-heading mb-6">
        Privacy Policy
      </h1>

      <div className="prose prose-sm max-w-none text-semantic-text-secondary space-y-6">
        <p className="text-semantic-text-secondary">
          Last updated: {PRIVACY_VERSION_DISPLAY}
        </p>

        <Card className="not-prose">
          <CardHeader>
            <h2 className="text-base font-semibold text-semantic-text-heading">
              Quick Start
            </h2>
            <p className="text-xs text-semantic-text-muted mt-0.5">
              The plain-English version. For the full rulebook, read on.
            </p>
          </CardHeader>
          <CardBody>
            <ul className="list-disc pl-5 space-y-2 text-sm text-semantic-text-secondary">
              <li>
                We collect only what we need to run the marketplace — your account info, what
                you buy and sell, and the records the tax authorities require us to keep.
              </li>
              <li>
                We never sell your data. Everyone we share data with is listed in section 6,
                grouped by what they do.
              </li>
              <li>
                Our analytics run in cookieless mode, don&apos;t track you across sites, and
                don&apos;t see your IP address. We don&apos;t run ads.
              </li>
              <li>
                You can access, export, or delete your account any time from your settings.
                Deletion is immediate — your profile is anonymized in seconds.
              </li>
              <li>
                We keep some records (orders, invoices, DAC7 seller data) for up to 10 years
                because Latvian law requires it. Everything else goes when you do.
              </li>
              <li>
                Data-protection questions and requests go to{' '}
                <a href="mailto:privacy@secondturn.games" className="link-brand">
                  privacy@secondturn.games
                </a>
                . You can also complain to the Latvian Data State Inspectorate.
              </li>
            </ul>
          </CardBody>
        </Card>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-semibold font-display tracking-tight text-semantic-text-heading">
            1. Who we are
          </h2>
          <p>
            {LEGAL_ENTITY_NAME} (&ldquo;STG&rdquo;), registration number {LEGAL_ENTITY_REG_NUMBER},
            registered at {LEGAL_ENTITY_ADDRESS}, is the data controller. This policy explains how
            we collect, use, and protect your personal data under the General Data Protection
            Regulation (GDPR, EU 2016/679) and Latvian data protection law.
          </p>
          <p>
            For data-protection questions and requests (access, export, deletion, objection),
            write to{' '}
            <a href="mailto:privacy@secondturn.games" className="link-brand">
              privacy@secondturn.games
            </a>
            . For anything else, use{' '}
            <a href="mailto:info@secondturn.games" className="link-brand">
              info@secondturn.games
            </a>
            .
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-semibold font-display tracking-tight text-semantic-text-heading">
            2. Data we collect
          </h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>
              <strong>Account data:</strong> email address, display name, country, phone number
            </li>
            <li>
              <strong>Listing data:</strong> game details, condition, photos, pricing. Location
              metadata (EXIF) is automatically stripped from uploaded photos
            </li>
            <li>
              <strong>Order data:</strong> purchase history, shipping addresses (parcel locker
              selections), order status
            </li>
            <li>
              <strong>Seller financial data:</strong> wallet balance, transaction history, bank
              account details (IBAN) for withdrawals
            </li>
            <li>
              <strong>Payment data:</strong> processed by EveryPay (Swedbank). We do not store card
              details
            </li>
            <li>
              <strong>Usage data:</strong> pages visited, browser type, IP address (for security and
              to improve the platform)
            </li>
          </ul>
          <p>
            <strong>What is visible to the public.</strong> Once you list a game or leave a review,
            some of your profile becomes visible to anyone browsing the site, including people who
            are not signed in: your display name, your country (shown as a flag), your profile
            photo if you uploaded one, and the date your account was created. Seller reviews you
            receive are also public and show up on your profile. We do not expose your email
            address, phone number, full address, or any payment information to other users or to
            anonymous visitors.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-semibold font-display tracking-tight text-semantic-text-heading">
            3. Legal basis for processing
          </h2>
          <p>
            We process personal data under the following GDPR Article 6(1) legal bases:
          </p>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-semantic-border-subtle">
                  <th className="text-left py-2 pr-4 font-semibold text-semantic-text-heading">
                    Data category
                  </th>
                  <th className="text-left py-2 font-semibold text-semantic-text-heading">
                    Legal basis
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-semantic-border-subtle">
                <tr>
                  <td className="py-2 pr-4">Account data</td>
                  <td className="py-2">Art. 6(1)(b) &mdash; contract performance</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">Listing and order data</td>
                  <td className="py-2">Art. 6(1)(b) &mdash; contract performance</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">Transaction records</td>
                  <td className="py-2">
                    Art. 6(1)(b) &mdash; contract + Art. 6(1)(c) &mdash; legal obligation
                    (tax/accounting)
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">Seller financial data</td>
                  <td className="py-2">
                    Art. 6(1)(b) &mdash; contract + Art. 6(1)(c) &mdash; legal obligation
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">
                    DAC7 seller identification (TIN, date of birth, address)
                  </td>
                  <td className="py-2">
                    Art. 6(1)(c) &mdash; legal obligation (Council Directive (EU) 2021/514,
                    reporting to Latvian State Revenue Service)
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">Usage and security data</td>
                  <td className="py-2">
                    Art. 6(1)(f) &mdash; legitimate interest (platform security, service
                    improvement)
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">Fraud prevention signals</td>
                  <td className="py-2">
                    Art. 6(1)(f) &mdash; legitimate interest (preventing fraud, counterfeit
                    listings, and abuse)
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-semibold font-display tracking-tight text-semantic-text-heading">
            4. How we use your data
          </h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>To provide and operate the marketplace</li>
            <li>To process transactions and arrange shipping</li>
            <li>To send transactional emails (order confirmations, shipping updates)</li>
            <li>To prevent fraud and enforce our terms of service</li>
            <li>To improve our platform based on usage patterns</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-semibold font-display tracking-tight text-semantic-text-heading">
            5. Data storage and security
          </h2>
          <p>
            Your data is stored in Supabase (cloud database in the North EU region, Stockholm)
            with row-level security policies enforced at the database layer. Our application
            servers run on Hetzner in Helsinki, Finland. Data in transit is encrypted via TLS,
            data at rest via AES-256. Photos are stored in Supabase Storage with access controls.
          </p>
          <p>
            <strong>Photo cleanup.</strong> When a listing is removed — by the seller, by the
            platform, or when an account is deleted — the associated photos are removed from
            Supabase Storage by an automated cleanup job that runs every six hours. Photos are
            not retained beyond the life of the listing they belong to.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-semibold font-display tracking-tight text-semantic-text-heading">
            6. Who we share your data with
          </h2>
          <p>
            We share your personal data only with the third parties listed below, and only to the
            extent each of them needs to deliver a part of the service. Our partners fall into
            two groups: <strong>processors</strong>, who act on our documented instructions under
            a data processing agreement, and <strong>independent controllers</strong>, who have
            their own direct relationship with you and handle your data under their own privacy
            policy — primarily the sign-in providers. Each section below notes which relationship
            applies. We do not sell your personal data. We are not in the business of advertising.
          </p>

          <h3 className={subHeadingClass}>Payments, shipping, and messaging (processors)</h3>
          <ul className="list-disc pl-6 space-y-1">
            <li>
              <strong>EveryPay (Maksekeskus AS, part of Swedbank).</strong> Payment processing.
              Receives buyer name, email, amount, and transaction metadata. We do not store card
              details; card data is handled entirely within EveryPay&apos;s PCI-DSS environment.
            </li>
            <li>
              <strong>Unisend SIA.</strong> Parcel-locker shipping between the Baltic states.
              Receives sender and recipient names, phone numbers, email addresses, and the
              chosen terminals.
            </li>
            <li>
              <strong>Resend.</strong> Transactional email delivery (order confirmations,
              shipping updates, auction notifications). Receives the recipient email address,
              display name, and the content of the email. We do not use Resend for marketing.
            </li>
          </ul>

          <h3 className={subHeadingClass}>Sign-in providers (independent controllers)</h3>
          <p>
            If you choose to sign in with Google or Facebook, the provider authenticates you
            against their own account system and returns a verified email address and basic
            profile identifier to us. The provider is an <strong>independent controller</strong>{' '}
            of your account data with them under its own privacy policy; we do not instruct the
            provider on how to process its users&apos; data. The transfer from the provider to
            us happens under your own authorisation at the &ldquo;Continue with &hellip;&rdquo;
            prompt. These are not processor relationships, and no data processing agreement is
            needed for them.
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li>
              <strong>Google Ireland Limited</strong> &mdash; &ldquo;Continue with Google&rdquo;
              sign-in. Governed by Google&apos;s own privacy policy.
            </li>
            <li>
              <strong>Meta Platforms Ireland Limited</strong> &mdash; &ldquo;Continue with
              Facebook&rdquo; sign-in. Governed by Meta&apos;s own privacy policy.
            </li>
          </ul>

          <h3 className={subHeadingClass}>Infrastructure (processors)</h3>
          <ul className="list-disc pl-6 space-y-1">
            <li>
              <strong>Supabase (Supabase Inc., EU region).</strong> Our database, authentication
              provider, and file storage. Stores account, listing, order, messaging, wallet, and
              photo data. Access is governed by row-level security policies in the database.
            </li>
            <li>
              <strong>Hetzner Online GmbH (Helsinki, Finland).</strong> The VPS provider that
              hosts the Next.js application layer. Processes every HTTP request to the site as
              a network sub-processor.
            </li>
            <li>
              <strong>Cloudflare, Inc.</strong> DNS, CDN, reverse proxy, and bot-management edge
              for <span className="font-mono">secondturn.games</span>. Processes your IP address
              and request metadata when you visit the site, and runs{' '}
              <strong>Cloudflare Turnstile</strong> to keep automated submissions off the
              platform. Details of the cookies Cloudflare sets are in our{' '}
              <Link href="/cookies" className="link-brand">
                Cookie Policy
              </Link>
              .
            </li>
          </ul>

          <h3 className={subHeadingClass}>Observability (processors)</h3>
          <ul className="list-disc pl-6 space-y-1">
            <li>
              <strong>Sentry (Functional Software, Inc.).</strong> Error monitoring. Receives
              stack traces and limited browser context when something breaks so we can fix it.
              We run a PII-stripping filter on events before they leave our servers, and session
              replay is disabled.
            </li>
            <li>
              <strong>PostHog Cloud (PostHog, Inc., EU region in Frankfurt).</strong> Product
              analytics. Runs in cookieless mode, so it does not place cookies or local-storage
              items in your browser. Events are routed through a first-party reverse proxy on
              our own domain that strips client IP headers before the request leaves our
              server, so PostHog sees our server&apos;s IP rather than yours.
            </li>
          </ul>

          <h3 className={subHeadingClass}>Outgoing connections your browser makes</h3>
          <p>
            When you view a listing, your browser loads the game&apos;s cover image directly
            from BoardGameGeek&apos;s CDN (<span className="font-mono">cf.geekdo-images.com</span>).
            BoardGameGeek is the cornerstone data source for game identity on the platform; its
            CDN logs your IP address in the normal course of serving images, the same way any
            website you visit directly would. BoardGameGeek is not a processor of ours — we do
            not send them your account data — but this browser-level contact is worth knowing
            about. API calls to BoardGameGeek for game metadata are made server-side only and
            never expose your IP address.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-semibold font-display tracking-tight text-semantic-text-heading">
            7. Cookies
          </h2>
          <p>
            We use only strictly necessary cookies and a small number of preference items in your
            browser&apos;s local storage. We do not use advertising or tracking cookies. For the
            full list — including the exact names, purpose, and duration — see our{' '}
            <Link href="/cookies" className="link-brand">
              Cookie Policy
            </Link>
            .
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-semibold font-display tracking-tight text-semantic-text-heading">
            8. Your rights under GDPR
          </h2>
          <p>You have the right to:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>
              <strong>Access</strong> your personal data (Article 15)
            </li>
            <li>
              <strong>Rectify</strong> inaccurate data (Article 16)
            </li>
            <li>
              <strong>Erase</strong> your data, subject to legal retention requirements (Article 17)
            </li>
            <li>
              <strong>Port</strong> your data to another service in a machine-readable format
              (Article 20)
            </li>
            <li>
              <strong>Object</strong> to processing based on legitimate interest (Article 21)
            </li>
            <li>
              <strong>Restrict</strong> processing in certain circumstances (Article 18)
            </li>
            <li>
              <strong>Lodge a complaint</strong> with a supervisory authority (Article 77) — see
              section 12 for the Latvian authority and its contact details.
            </li>
          </ul>
          <p>
            We will respond to all rights requests within 30 days. To access, export, or delete your
            data, visit your{' '}
            <Link
              href="/account/settings"
              className="link-brand"
            >
              account settings
            </Link>
            . For other requests, contact us at{' '}
            <a
              href="mailto:info@secondturn.games"
              className="link-brand"
            >
              info@secondturn.games
            </a>
            .
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-semibold font-display tracking-tight text-semantic-text-heading">
            9. Data retention
          </h2>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-semantic-border-subtle">
                  <th className="text-left py-2 pr-4 font-semibold text-semantic-text-heading">
                    Data type
                  </th>
                  <th className="text-left py-2 font-semibold text-semantic-text-heading">
                    Retention period
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-semantic-border-subtle">
                <tr>
                  <td className="py-2 pr-4">Account profile (name, email, phone)</td>
                  <td className="py-2">
                    Anonymized the moment you delete your account. There is no reactivation
                    grace window &mdash; account deletion is immediate and final.
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">Active listing data and photos</td>
                  <td className="py-2">
                    Until the listing is removed or the account is deleted. Photos are removed
                    from Supabase Storage within six hours of listing removal.
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">
                    Completed orders, invoices, and transaction records
                  </td>
                  <td className="py-2">
                    5 years from the end of the calendar year of the transaction for ordinary
                    commission invoices, per Latvian VAT Law (PVN likums) Article 133, and
                    5 years for accounting source documents per Latvian Accounting Law
                    (Gr&#x101;matved&#x12B;bas likums) §10. Extended to 10 years where the
                    record supports a tax declaration, annual report, or transaction involving
                    immovable property. These records are retained even after you delete your
                    account &mdash; they are exempt from erasure requests under GDPR
                    Article 17(3)(b).
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">
                    DAC7 seller data (TIN, date of birth, address, annual totals)
                  </td>
                  <td className="py-2">
                    10 years after the reportable year, as required by Council Directive (EU)
                    2021/514 implementing Article 25d of Directive 2011/16/EU. Applies only to
                    sellers who reach the DAC7 reporting thresholds.
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">Reviews you wrote or received</td>
                  <td className="py-2">
                    Retained on the reviewed seller&apos;s profile indefinitely. When you delete
                    your account, reviews you wrote are anonymized rather than removed, so the
                    seller&apos;s reputation stays intact.
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">Listing comments and order messages</td>
                  <td className="py-2">
                    Anonymized the moment you delete your account (content replaced with
                    &ldquo;[deleted]&rdquo;); retained otherwise for the life of the listing or
                    order.
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">Security logs (IP, login activity)</td>
                  <td className="py-2">30 days</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p>
            You may request deletion of your account at any time from your account settings. The
            records listed above that are subject to legal-obligation retention will continue to
            be held for the period the law requires, but your profile, direct identifiers, and
            non-transactional content are removed or anonymized immediately.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-semibold font-display tracking-tight text-semantic-text-heading">
            10. Data breach notification
          </h2>
          <p>
            If a data breach poses a risk to your rights, we will notify the supervisory authority
            within 72 hours per GDPR Article 33. If the risk to you is high, we will notify you
            directly as well.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-semibold font-display tracking-tight text-semantic-text-heading">
            11. Children&apos;s data
          </h2>
          <p>
            You must be at least 16 to use the platform and at least 18 to sell. If someone under 16
            has created an account, contact us and we will delete their data.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-semibold font-display tracking-tight text-semantic-text-heading">
            12. Supervisory authority
          </h2>
          <p>
            If you believe your data protection rights have been violated, you can lodge a complaint
            with the Latvian Data State Inspectorate (DVI) at{' '}
            <a
              href="https://www.dvi.gov.lv"
              className="link-brand"
              target="_blank"
              rel="noopener noreferrer"
            >
              dvi.gov.lv
            </a>
            .
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-semibold font-display tracking-tight text-semantic-text-heading">
            13. Changes to this policy
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
            className="link-brand"
          >
            Terms of Service
          </Link>{' '}
          and{' '}
          <Link
            href="/seller-terms"
            className="link-brand"
          >
            Seller Agreement
          </Link>
          .
        </p>
      </div>
    </div>
  );
}

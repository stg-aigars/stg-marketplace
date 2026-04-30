import type { Metadata } from 'next';
import Link from 'next/link';
import { Card, CardBody, CardHeader } from '@/components/ui';
import { TERMS_VERSION_DISPLAY } from '@/lib/legal/constants';

export const metadata: Metadata = {
  title: 'Cookie Policy',
};

export default function CookiesPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
      <h1 className="text-2xl sm:text-3xl font-bold font-platform tracking-tight text-semantic-text-heading mb-6">
        Cookie Policy
      </h1>

      <div className="prose prose-sm max-w-none text-semantic-text-secondary space-y-6">
        <p className="text-semantic-text-secondary">
          Last updated: {TERMS_VERSION_DISPLAY}
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
                We disclose every cookie and browser-storage item we set — even the ones that
                don&apos;t need your consent. The ePrivacy Directive (Art. 5(3)) requires it,
                and we&apos;d do it anyway.
              </li>
              <li>
                Everything we set is either strictly necessary for the platform to work (keeping
                you signed in, cart contents, bot protection) or a preference you chose yourself.
              </li>
              <li>
                No advertising, retargeting, or cross-site tracking cookies. We don&apos;t run
                ads, and we don&apos;t plan to.
              </li>
              <li>
                Our analytics (PostHog, EU region) runs in cookieless mode — no cookies, no
                localStorage, and IP addresses are stripped at our own proxy before events
                leave the server.
              </li>
              <li>
                Cloudflare hosts our DNS and CDN and runs Turnstile on bot-prone forms. Both
                set a small number of cookies — listed in the tables below.
              </li>
              <li>
                You can clear cookies any time in your browser settings. That will sign you out
                and empty your cart, but the site will still work.
              </li>
            </ul>
          </CardBody>
        </Card>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-semibold font-platform tracking-tight text-semantic-text-heading">
            Cookies on our domain
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-semantic-border-subtle text-left">
                  <th className="py-2 pr-4 font-semibold text-semantic-text-heading">Name</th>
                  <th className="py-2 pr-4 font-semibold text-semantic-text-heading">Purpose</th>
                  <th className="py-2 pr-4 font-semibold text-semantic-text-heading">Duration</th>
                  <th className="py-2 font-semibold text-semantic-text-heading">Type</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-semantic-border-subtle">
                  <td className="py-2 pr-4 align-top font-mono text-xs">sb-*-auth-token.0/.1/.2</td>
                  <td className="py-2 pr-4 align-top">
                    Keeps you signed in. Set by our authentication provider (Supabase) when you
                    log in or register. A single session is split across numbered chunks
                    because browsers cap individual cookies at around 4 KB and OAuth sessions
                    exceed that.
                  </td>
                  <td className="py-2 pr-4 align-top">Session / until sign-out</td>
                  <td className="py-2 align-top">First-party, strictly necessary</td>
                </tr>
                <tr className="border-b border-semantic-border-subtle">
                  <td className="py-2 pr-4 align-top font-mono text-xs">cf_clearance</td>
                  <td className="py-2 pr-4 align-top">
                    Set by Cloudflare, which hosts our DNS and CDN, to mark that your browser
                    has passed Cloudflare&apos;s bot-management check for our domain. Prevents
                    you from being re-challenged on every page load.
                  </td>
                  <td className="py-2 pr-4 align-top">Up to 30 days (Cloudflare default)</td>
                  <td className="py-2 align-top">First-party, strictly necessary</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-xs text-semantic-text-muted">
            Exact Supabase cookie names vary by project reference (for example,{' '}
            <span className="font-mono">sb-tfxqbtcdkzdwfgsivvet-auth-token.0</span>).
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-semibold font-platform tracking-tight text-semantic-text-heading">
            Items stored in your browser&apos;s local or session storage
          </h2>
          <p>
            Local and session storage are not technically cookies, but the ePrivacy Directive
            covers any information stored on your device. We disclose these for the same reason.
            Session storage clears automatically when you close the tab; local storage persists
            until you clear it.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-semantic-border-subtle text-left">
                  <th className="py-2 pr-4 font-semibold text-semantic-text-heading">Key</th>
                  <th className="py-2 pr-4 font-semibold text-semantic-text-heading">Purpose</th>
                  <th className="py-2 pr-4 font-semibold text-semantic-text-heading">Storage</th>
                  <th className="py-2 font-semibold text-semantic-text-heading">Type</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-semantic-border-subtle">
                  <td className="py-2 pr-4 align-top font-mono text-xs">stg_cart</td>
                  <td className="py-2 pr-4 align-top">
                    Holds the items currently in your cart so they persist across page reloads.
                  </td>
                  <td className="py-2 pr-4 align-top">Local</td>
                  <td className="py-2 align-top">Strictly necessary</td>
                </tr>
                <tr className="border-b border-semantic-border-subtle">
                  <td className="py-2 pr-4 align-top font-mono text-xs">stg-stale-action-reload</td>
                  <td className="py-2 pr-4 align-top">
                    Session-integrity signal that tells the site to reload when your session has
                    gone stale after background auth changes.
                  </td>
                  <td className="py-2 pr-4 align-top">Local</td>
                  <td className="py-2 align-top">Strictly necessary</td>
                </tr>
                <tr className="border-b border-semantic-border-subtle">
                  <td className="py-2 pr-4 align-top font-mono text-xs">stg:launch-banner-dismissed:v1</td>
                  <td className="py-2 pr-4 align-top">
                    Remembers that you dismissed the launch banner so it does not reappear.
                  </td>
                  <td className="py-2 pr-4 align-top">Local</td>
                  <td className="py-2 align-top">Preference</td>
                </tr>
                <tr className="border-b border-semantic-border-subtle">
                  <td className="py-2 pr-4 align-top font-mono text-xs">stg-is-seller</td>
                  <td className="py-2 pr-4 align-top">
                    Caches whether your account currently has seller role, so the UI can render
                    seller-specific controls without a round-trip.
                  </td>
                  <td className="py-2 pr-4 align-top">Session</td>
                  <td className="py-2 align-top">Strictly necessary</td>
                </tr>
                <tr className="border-b border-semantic-border-subtle">
                  <td className="py-2 pr-4 align-top font-mono text-xs">stg-pending-actions-dismissed</td>
                  <td className="py-2 pr-4 align-top">
                    Remembers which pending-action notices you have dismissed during this tab
                    session.
                  </td>
                  <td className="py-2 pr-4 align-top">Session</td>
                  <td className="py-2 align-top">Preference</td>
                </tr>
                <tr className="border-b border-semantic-border-subtle">
                  <td className="py-2 pr-4 align-top font-mono text-xs">cf.turnstile.*</td>
                  <td className="py-2 pr-4 align-top">
                    Written by the Cloudflare Turnstile widget when bot-protected forms load
                    (sign-up, password reset, newsletter, comments, checkout, bids, listing
                    edits). Used by Turnstile itself to avoid redundant challenges. Not
                    readable by our application code.
                  </td>
                  <td className="py-2 pr-4 align-top">Local</td>
                  <td className="py-2 align-top">Strictly necessary</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-semibold font-platform tracking-tight text-semantic-text-heading">
            Third-party tools on form submissions
          </h2>
          <p>
            On forms that bots like to target — sign-up, password reset, newsletter, comments,
            checkout, bidding, listing edits — we use <strong>Cloudflare Turnstile</strong> in
            invisible mode. Turnstile loads a script from{' '}
            <span className="font-mono">challenges.cloudflare.com</span> and may set transient
            cookies on the <span className="font-mono">cloudflare.com</span> domain while it
            checks that the submission isn&apos;t automated. It also writes small items to
            your browser&apos;s local storage on our domain (prefixed{' '}
            <span className="font-mono">cf.turnstile.</span>) so it doesn&apos;t re-challenge
            you on every form — those are in the local-storage table above. Turnstile is
            strictly necessary to keep bots out of the marketplace. See{' '}
            <a
              href="https://www.cloudflare.com/privacypolicy/"
              target="_blank"
              rel="noopener noreferrer"
              className="link-brand"
            >
              Cloudflare&apos;s privacy policy
            </a>{' '}
            for details.
          </p>
          <p>
            Cloudflare also proxies our traffic and runs edge-level bot management, which is
            what sets the <span className="font-mono">cf_clearance</span> cookie in the
            cookies table above.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-semibold font-platform tracking-tight text-semantic-text-heading">
            What we do <em>not</em> set
          </h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>
              <strong>Analytics cookies.</strong> Our analytics tool (PostHog, EU region) runs in
              cookieless mode — no cookies, no local-storage items. Events are routed through a
              first-party reverse proxy that strips client IP addresses before the request leaves
              our server.
            </li>
            <li>
              <strong>Error-tracking cookies.</strong> Sentry is configured without session replay
              or session tracking, so it does not set any cookies in your browser.
            </li>
            <li>
              <strong>Advertising or retargeting cookies.</strong> We do not run ads.
            </li>
            <li>
              <strong>Locale cookies.</strong> Your language is part of the URL path
              (<span className="font-mono">/en/</span>, <span className="font-mono">/lv/</span>)
              rather than a cookie.
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-semibold font-platform tracking-tight text-semantic-text-heading">
            Your choices
          </h2>
          <p>
            Most browsers let you clear cookies and local storage in their privacy settings.
            Clearing them will sign you out and empty your cart. Because every item we set is
            either strictly necessary or a preference you chose, we do not show a consent banner.
          </p>
          <p>
            For everything else about how we handle your data, see the{' '}
            <Link href="/privacy" className="link-brand">
              Privacy Policy
            </Link>
            .
          </p>
        </section>
      </div>
    </div>
  );
}

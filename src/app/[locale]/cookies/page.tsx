import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Cookie Policy',
};

export default function CookiesPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
      <h1 className="text-2xl sm:text-3xl font-bold font-display tracking-tight text-semantic-text-heading mb-6">
        Cookie Policy
      </h1>

      <div className="prose prose-sm max-w-none text-semantic-text-secondary space-y-6">
        <p>
          This page lists every cookie and local-storage item Second Turn Games sets in your
          browser, what it is for, how long it lasts, and whether you can turn it off. Under the
          ePrivacy Directive (Art. 5(3)) we disclose all of them — not only the ones that need
          your consent.
        </p>

        <p>
          Today every item below is strictly necessary for the platform to work or stores a
          preference you chose yourself. We do not use advertising, retargeting, or cross-site
          tracking cookies. Our analytics tool (PostHog) runs in <em>cookieless mode</em> and
          does not set any cookies or local-storage items.
        </p>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-semibold font-display tracking-tight text-semantic-text-heading">
            Cookies we set
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
                  <td className="py-2 pr-4 align-top font-mono text-xs">sb-*-auth-token</td>
                  <td className="py-2 pr-4 align-top">
                    Keeps you signed in. Set by our authentication provider (Supabase) when you
                    log in or register.
                  </td>
                  <td className="py-2 pr-4 align-top">Session / until sign-out</td>
                  <td className="py-2 align-top">First-party, strictly necessary</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-xs text-semantic-text-muted">
            Exact cookie names vary by Supabase project reference (for example,{' '}
            <span className="font-mono">sb-tfxqbtcdkzdwfgsivvet-auth-token</span>).
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-semibold font-display tracking-tight text-semantic-text-heading">
            Local-storage items we set
          </h2>
          <p>
            Local storage is not technically a cookie, but the ePrivacy Directive covers any
            information stored on your device. We disclose these for the same reason.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-semantic-border-subtle text-left">
                  <th className="py-2 pr-4 font-semibold text-semantic-text-heading">Key</th>
                  <th className="py-2 pr-4 font-semibold text-semantic-text-heading">Purpose</th>
                  <th className="py-2 font-semibold text-semantic-text-heading">Type</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-semantic-border-subtle">
                  <td className="py-2 pr-4 align-top font-mono text-xs">stg_cart</td>
                  <td className="py-2 pr-4 align-top">
                    Holds the items currently in your cart so they persist across page reloads.
                  </td>
                  <td className="py-2 align-top">Strictly necessary</td>
                </tr>
                <tr className="border-b border-semantic-border-subtle">
                  <td className="py-2 pr-4 align-top font-mono text-xs">stg-stale-action-reload</td>
                  <td className="py-2 pr-4 align-top">
                    Session-integrity signal that tells the site to reload when your session has
                    gone stale after background auth changes.
                  </td>
                  <td className="py-2 align-top">Strictly necessary</td>
                </tr>
                <tr className="border-b border-semantic-border-subtle">
                  <td className="py-2 pr-4 align-top font-mono text-xs">stg:launch-banner-dismissed:v1</td>
                  <td className="py-2 pr-4 align-top">
                    Remembers that you dismissed the launch banner so it does not reappear.
                  </td>
                  <td className="py-2 align-top">Preference</td>
                </tr>
                <tr className="border-b border-semantic-border-subtle">
                  <td className="py-2 pr-4 align-top font-mono text-xs">stg-pending-actions-dismissed</td>
                  <td className="py-2 pr-4 align-top">
                    Remembers which pending-action notices you have dismissed.
                  </td>
                  <td className="py-2 align-top">Preference</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-semibold font-display tracking-tight text-semantic-text-heading">
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
          <h2 className="text-xl sm:text-2xl font-semibold font-display tracking-tight text-semantic-text-heading">
            Planned additions
          </h2>
          <p>
            We plan to deploy Cloudflare Turnstile for bot protection on sign-up and contact
            forms. Turnstile may set a short-lived challenge cookie when it is active. This page
            will be updated with the exact cookie name, purpose, and duration before the change
            goes live.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-semibold font-display tracking-tight text-semantic-text-heading">
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

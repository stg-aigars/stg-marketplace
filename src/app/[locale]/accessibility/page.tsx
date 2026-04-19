import type { Metadata } from 'next';
import Link from 'next/link';
import { TERMS_VERSION_DISPLAY } from '@/lib/legal/constants';

export const metadata: Metadata = {
  title: 'Accessibility Statement',
};

export default function AccessibilityPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
      <h1 className="text-2xl sm:text-3xl font-bold font-display tracking-tight text-semantic-text-heading mb-6">
        Accessibility Statement
      </h1>

      <div className="prose prose-sm max-w-none text-semantic-text-secondary space-y-6">
        <p className="text-semantic-text-secondary">
          Last updated: {TERMS_VERSION_DISPLAY}
        </p>

        <p>
          Second Turn Games should be usable for everyone. The European Accessibility Act
          (Directive (EU) 2019/882) has applied to e-commerce services since 28 June 2025, and
          this page is how we describe where we stand.
        </p>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-semibold font-display tracking-tight text-semantic-text-heading">
            Our commitment
          </h2>
          <p>
            We aim for Web Content Accessibility Guidelines (WCAG) 2.1 Level AA across the
            platform. That means: keyboard navigation works, screen readers get sensible
            labels, colour contrast is adequate, text resizes cleanly, and touch targets on
            mobile are big enough to tap reliably.
          </p>
          <p>
            Accessibility isn&apos;t a one-time checkbox. We audit new features as they ship,
            and we treat accessibility regressions as bugs.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-semibold font-display tracking-tight text-semantic-text-heading">
            Known limitations
          </h2>
          <p>
            We&apos;re still working through a full list of known gaps and the plan for
            closing them. This page will get updated as that work progresses.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-semibold font-display tracking-tight text-semantic-text-heading">
            Contact us
          </h2>
          <p>
            If you hit an accessibility barrier using Second Turn Games, let us know so we can
            fix it. Reach out through our{' '}
            <Link href="/contact" className="link-brand">
              contact page
            </Link>
            . Tell us what you were trying to do, which page you were on, and what assistive
            technology you were using (if any).
          </p>
        </section>
      </div>
    </div>
  );
}

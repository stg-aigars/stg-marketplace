import type { Metadata } from 'next';
import Link from 'next/link';

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
        <p>
          Second Turn Games is committed to making the marketplace usable for everyone, in line
          with the European Accessibility Act (EAA, Directive (EU) 2019/882) which applies to
          e-commerce services from 28 June 2025.
        </p>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-semibold font-display tracking-tight text-semantic-text-heading">
            Our commitment
          </h2>
          <p>
            We aim to meet Web Content Accessibility Guidelines (WCAG) 2.1 Level AA across the
            platform. We design for keyboard navigation, screen readers, adequate colour contrast,
            resizable text, and sensible touch targets on mobile.
          </p>
          <p>
            Accessibility is an ongoing effort. As we ship new features we audit them for
            accessibility issues, and we treat accessibility regressions as bugs.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-semibold font-display tracking-tight text-semantic-text-heading">
            Known limitations
          </h2>
          <p>
            We are still documenting the full list of known accessibility gaps and the plan to
            close them. This page will be updated as that work progresses.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-semibold font-display tracking-tight text-semantic-text-heading">
            Contact us
          </h2>
          <p>
            If you run into an accessibility barrier while using Second Turn Games, please let us
            know so we can fix it. Reach us via the{' '}
            <Link href="/contact" className="link-brand">
              contact page
            </Link>
            . Describe what you were trying to do, which page you were on, and which assistive
            technology you were using if any.
          </p>
        </section>
      </div>
    </div>
  );
}

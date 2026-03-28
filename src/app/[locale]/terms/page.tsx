import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Terms of Service',
};

export default function TermsPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
      <h1 className="text-2xl sm:text-3xl font-bold font-display tracking-tight text-semantic-text-heading mb-6">
        Terms of Service
      </h1>

      <div className="prose prose-sm max-w-none text-semantic-text-secondary space-y-6">
        <p className="text-semantic-text-secondary">
          Last updated: 16 March 2026
        </p>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-semibold font-display tracking-tight text-semantic-text-heading">
            1. About Second Turn Games
          </h2>
          <p>
            Second Turn Games (&ldquo;STG&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;) operates a
            peer-to-peer marketplace for pre-loved board games in the Baltic region (Latvia,
            Lithuania, and Estonia). We act as a commercial agent under PSD2 Article 3(b),
            facilitating transactions between buyers and sellers.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-semibold font-display tracking-tight text-semantic-text-heading">
            2. Eligibility
          </h2>
          <p>
            You must be at least 18 years old and reside in Latvia, Lithuania, or Estonia to use our
            platform. By creating an account, you confirm that you meet these requirements.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-semibold font-display tracking-tight text-semantic-text-heading">
            3. Buyer obligations
          </h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>Pay the listed item price plus shipping costs at checkout</li>
            <li>Confirm delivery once you have received and inspected the item</li>
            <li>Raise any disputes within the allowed timeframe</li>
            <li>Provide accurate shipping information (parcel locker selection)</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-semibold font-display tracking-tight text-semantic-text-heading">
            4. Seller obligations
          </h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>List items accurately, including condition, edition, and language</li>
            <li>Ship items within the agreed timeframe after accepting an order</li>
            <li>Use the provided Unisend shipping labels for delivery</li>
            <li>Respond to buyer inquiries and disputes in good faith</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-semibold font-display tracking-tight text-semantic-text-heading">
            5. Fees and commissions
          </h2>
          <p>
            Buyers pay the item price plus shipping. There is no service fee for buyers.
          </p>
          <p>
            Sellers are charged a 10% commission on the item price (not on shipping costs).
            Seller earnings (90% of item price) are credited to their platform wallet after order
            completion.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-semibold font-display tracking-tight text-semantic-text-heading">
            6. Payments
          </h2>
          <p>
            Payments are processed securely through EveryPay (Swedbank). Orders are only created
            after payment has been confirmed. STG does not store payment card details.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-semibold font-display tracking-tight text-semantic-text-heading">
            7. Shipping
          </h2>
          <p>
            All shipments are handled through Unisend parcel lockers across Latvia, Lithuania, and
            Estonia. Cross-border shipping between Baltic states is supported. Shipping labels are
            generated automatically after the seller accepts an order.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-semibold font-display tracking-tight text-semantic-text-heading">
            8. Prohibited content
          </h2>
          <p>
            Listings must be for board games only. Counterfeit items, stolen goods, and items that
            violate intellectual property rights are strictly prohibited. STG reserves the right to
            remove any listing or suspend any account that violates these terms.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-semibold font-display tracking-tight text-semantic-text-heading">
            9. Limitation of liability
          </h2>
          <p>
            STG facilitates transactions between buyers and sellers but is not a party to the sale
            itself. We are not liable for the condition, authenticity, or quality of items listed by
            sellers. Our liability is limited to the commission fees collected.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-semibold font-display tracking-tight text-semantic-text-heading">
            10. Changes to these terms
          </h2>
          <p>
            We may update these terms from time to time. Continued use of the platform after changes
            constitutes acceptance of the updated terms.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-semibold font-display tracking-tight text-semantic-text-heading">
            11. Contact
          </h2>
          <p>
            Questions about these terms? Reach us at{' '}
            <Link
              href="/contact"
              className="text-frost-arctic sm:hover:text-frost-ice transition-colors underline"
            >
              our contact page
            </Link>
            .
          </p>
        </section>

        <p className="text-sm text-semantic-text-muted pt-4 border-t border-semantic-border-subtle">
          See also our{' '}
          <Link
            href="/privacy"
            className="text-frost-arctic sm:hover:text-frost-ice transition-colors underline"
          >
            Privacy Policy
          </Link>
          .
        </p>
      </div>
    </div>
  );
}

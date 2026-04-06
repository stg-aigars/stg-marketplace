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
          Last updated: 6 April 2026
        </p>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-semibold font-display tracking-tight text-semantic-text-heading">
            1. About Second Turn Games
          </h2>
          <p>
            Second Turn Games SIA (&ldquo;STG&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;),
            registration number 50203665371, registered at Evalda Valtera iela 5 - 35, Riga, LV-1021,
            Latvia, operates a peer-to-peer marketplace for pre-loved board games in Latvia, Lithuania,
            and Estonia. We act as a commercial agent under PSD2 Article 3(b), connecting buyers and
            sellers and handling payments on their behalf.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-semibold font-display tracking-tight text-semantic-text-heading">
            2. Eligibility
          </h2>
          <p>
            You must be at least 16 years old and reside in Latvia, Lithuania, or Estonia to use our
            platform. By creating an account, you confirm that you meet these requirements. You must be
            at least 18 years old to list items for sale.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-semibold font-display tracking-tight text-semantic-text-heading">
            3. Consumer protection notice
          </h2>
          <p>
            All sellers on Second Turn Games are private individuals selling personal items, not
            businesses or professional traders. EU consumer protection rules that apply to
            business-to-consumer sales (the 14-day withdrawal right, the 2-year legal guarantee of
            conformity) do not apply to transactions on this platform.
          </p>
          <p>
            What we do instead: buyer payments are held until delivery is confirmed, and buyers have
            2 days after delivery to report issues with their order.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-semibold font-display tracking-tight text-semantic-text-heading">
            4. Buyer obligations
          </h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>Pay the listed item price plus shipping costs at checkout</li>
            <li>Provide accurate shipping information (parcel locker selection)</li>
            <li>Confirm delivery once you have received and inspected the item</li>
            <li>
              Raise any disputes within 2 days of delivery. Issues reported after the dispute window
              closes cannot be considered for a refund
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-semibold font-display tracking-tight text-semantic-text-heading">
            5. Seller obligations
          </h2>
          <p>
            Sellers have additional obligations under our{' '}
            <Link
              href="/seller-terms"
              className="text-semantic-brand sm:hover:text-semantic-brand-hover transition-colors duration-250 ease-out-custom underline"
            >
              Seller Agreement
            </Link>
            . By creating a listing, you confirm that you are at least 18 years old and agree to
            those terms. The key ones:
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li>List items accurately, including condition, edition, and language</li>
            <li>Confirm or decline orders within 48 hours</li>
            <li>Ship items within 5 days of accepting the order using the provided Unisend shipping code</li>
            <li>Package items securely. Sellers are liable for damage during transit</li>
            <li>Respond to buyer inquiries and disputes in good faith</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-semibold font-display tracking-tight text-semantic-text-heading">
            6. Fees and commissions
          </h2>
          <p>
            Buyers pay the item price plus shipping. There is no service fee for buyers.
          </p>
          <p>
            Sellers are charged a 10% commission on the item price (not on shipping costs).
            Seller earnings (90% of item price) are credited to their platform wallet after order
            completion. There are no listing fees.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-semibold font-display tracking-tight text-semantic-text-heading">
            7. Payments
          </h2>
          <p>
            Payments are processed through EveryPay (Swedbank). Orders are only created after
            payment is confirmed. STG does not store card details. Buyer funds are held by the
            platform until the order is completed.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-semibold font-display tracking-tight text-semantic-text-heading">
            8. Shipping
          </h2>
          <p>
            All shipments go through the Unisend parcel locker network, which includes Unisend,
            Latvijas Pasts, and uDrop terminals across Latvia, Lithuania, and Estonia. Cross-border
            shipping between Baltic states is supported. A shipping code is generated automatically
            after the seller accepts an order.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-semibold font-display tracking-tight text-semantic-text-heading">
            9. Disputes and refunds
          </h2>
          <p>
            Buyers have 2 days after delivery to open a dispute if an item arrives damaged, is the
            wrong item, or does not match its listing description. If an item is not delivered within
            21 days of shipping, the platform will automatically open a dispute on the buyer&apos;s
            behalf. Disputes for &ldquo;changed mind&rdquo; or buyer&apos;s remorse are not eligible
            for refunds.
          </p>
          <p>
            Once a dispute is opened, the seller and buyer have 7 days to negotiate a resolution.
            If no agreement is reached, either party may escalate the dispute to STG staff for review.
          </p>
          <p>
            Refunds, when approved, are returned to the original payment method. Card refunds
            typically take 3&ndash;5 business days. If you paid partly with wallet balance, each
            portion is refunded to its source (card to card, wallet to wallet).
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-semibold font-display tracking-tight text-semantic-text-heading">
            10. Prohibited content
          </h2>
          <p>
            Listings must be for board games only. Counterfeit items, stolen goods, and items that
            violate intellectual property rights are strictly prohibited. STG reserves the right to
            remove any listing or suspend any account that violates these terms.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-semibold font-display tracking-tight text-semantic-text-heading">
            11. User content
          </h2>
          <p>
            By posting listings, photos, descriptions, or comments on the platform, you grant STG a
            non-exclusive, royalty-free license to display, reproduce, and distribute that content on
            the platform for the purpose of operating the marketplace. You retain ownership of your
            content and may remove it at any time by deleting the associated listing or account.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-semibold font-display tracking-tight text-semantic-text-heading">
            12. Account suspension and termination
          </h2>
          <p>
            STG may suspend or terminate accounts for violations of these terms, including fraud,
            misrepresenting items, failing to ship orders, excessive chargebacks, or suspected
            commercial activity. On termination, pending payouts may be held for up to 180 days to
            cover chargebacks or disputes.
          </p>
          <p>
            You may delete your account at any time through your account settings, subject to
            completing any open orders and withdrawing your wallet balance.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-semibold font-display tracking-tight text-semantic-text-heading">
            13. Limitation of liability
          </h2>
          <p>
            The platform is provided &ldquo;as is&rdquo; without warranties of any kind. STG
            connects buyers and sellers but is not a party to the sale itself. We do not guarantee
            the condition, authenticity, or quality of listed items.
          </p>
          <p>
            To the maximum extent permitted by law, STG&apos;s total liability to any user is limited
            to &euro;100 or the total service fees paid by that user in the preceding 12 months,
            whichever is greater.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-semibold font-display tracking-tight text-semantic-text-heading">
            14. Governing law and disputes
          </h2>
          <p>
            These terms are governed by the laws of the Republic of Latvia. Disputes arising from
            these terms or use of the platform fall under the jurisdiction of the courts of Riga,
            Latvia.
          </p>
          <p>
            If you have a complaint, please contact us first at{' '}
            <a
              href="mailto:info@secondturn.games"
              className="text-semantic-brand sm:hover:text-semantic-brand-hover transition-colors duration-250 ease-out-custom underline"
            >
              info@secondturn.games
            </a>
            . You may also contact the Consumer Rights Protection Centre of Latvia (PTAC) at{' '}
            <a
              href="https://www.ptac.gov.lv"
              className="text-semantic-brand sm:hover:text-semantic-brand-hover transition-colors duration-250 ease-out-custom underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              ptac.gov.lv
            </a>
            .
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-semibold font-display tracking-tight text-semantic-text-heading">
            15. Changes to these terms
          </h2>
          <p>
            We may update these terms from time to time. Continued use of the platform after changes
            constitutes acceptance of the updated terms. We will notify registered users of
            significant changes via email.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-semibold font-display tracking-tight text-semantic-text-heading">
            16. Contact
          </h2>
          <p>
            Questions about these terms? Reach us at{' '}
            <a
              href="mailto:info@secondturn.games"
              className="text-semantic-brand sm:hover:text-semantic-brand-hover transition-colors duration-250 ease-out-custom underline"
            >
              info@secondturn.games
            </a>{' '}
            or visit our{' '}
            <Link
              href="/contact"
              className="text-semantic-brand sm:hover:text-semantic-brand-hover transition-colors duration-250 ease-out-custom underline"
            >
              contact page
            </Link>
            .
          </p>
        </section>

        <p className="text-sm text-semantic-text-muted pt-4 border-t border-semantic-border-subtle">
          See also our{' '}
          <Link
            href="/privacy"
            className="text-semantic-brand sm:hover:text-semantic-brand-hover transition-colors duration-250 ease-out-custom underline"
          >
            Privacy Policy
          </Link>{' '}
          and{' '}
          <Link
            href="/seller-terms"
            className="text-semantic-brand sm:hover:text-semantic-brand-hover transition-colors duration-250 ease-out-custom underline"
          >
            Seller Agreement
          </Link>
          .
        </p>
      </div>
    </div>
  );
}

import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Help Center',
};

export default function HelpPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
      <h1 className="text-2xl sm:text-3xl font-bold font-platform tracking-tight text-semantic-text-heading mb-6">
        Help center
      </h1>

      <div className="prose prose-sm max-w-none text-semantic-text-secondary space-y-8">
        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-semibold font-platform tracking-tight text-semantic-text-heading">
            Buying
          </h2>
          <h3 className="text-base font-semibold text-semantic-text-heading">How do I buy a game?</h3>
          <p>
            Browse the marketplace, find a game you like, and open the listing. Pick a parcel
            locker for delivery, pay with card, bank link, or wallet balance, and the seller
            ships it to your locker.
          </p>
          <h3 className="text-base font-semibold text-semantic-text-heading">What payment methods do you accept?</h3>
          <p>
            Cards (Visa, Mastercard), bank payments from major Baltic banks, and mobile
            wallets like Apple Pay and Google Pay, all through EveryPay. Available methods
            may vary. If you&apos;ve sold games before and have wallet balance, you can use
            that too.
          </p>
          <h3 className="text-base font-semibold text-semantic-text-heading">How much does shipping cost?</h3>
          <p>
            It depends on the route (which country the seller is in, which country you&apos;re in).
            All shipments go through the Unisend parcel network, which includes Unisend,
            Latvijas Pasts, and uDrop terminals across Latvia, Lithuania, and Estonia.
            You&apos;ll see the exact cost at checkout before you pay.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-semibold font-platform tracking-tight text-semantic-text-heading">
            Selling
          </h2>
          <h3 className="text-base font-semibold text-semantic-text-heading">How do I list a game?</h3>
          <p>
            Go to{' '}
            <Link href="/sell" className="text-semantic-brand sm:hover:text-semantic-brand-hover transition-colors duration-250 ease-out-custom">
              List a game
            </Link>
            , search for your game, pick the edition, add photos, set the condition and price,
            and publish. Buyers across all three Baltic countries can see it right away.
          </p>
          <h3 className="text-base font-semibold text-semantic-text-heading">What are the fees?</h3>
          <p>
            10% commission on the item price (not on shipping). No listing fees, no monthly
            charges. You only pay when a game sells.
          </p>
          <h3 className="text-base font-semibold text-semantic-text-heading">How do I get paid?</h3>
          <p>
            When an order completes, your earnings (90% of the item price) go into your wallet.
            You can withdraw to your bank account any time.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-semibold font-platform tracking-tight text-semantic-text-heading">
            Shipping
          </h2>
          <h3 className="text-base font-semibold text-semantic-text-heading">How does shipping work?</h3>
          <p>
            All shipments go through the Unisend network, which includes Unisend,
            Latvijas Pasts, and uDrop terminals. When you accept an order as a seller,
            you&apos;ll get shipping instructions with a barcode. Drop the package at any
            terminal that supports sending (some are receive-only, which you&apos;ll see
            during terminal selection at checkout). The buyer picks it up from their
            chosen locker.
          </p>
          <h3 className="text-base font-semibold text-semantic-text-heading">Which countries?</h3>
          <p>
            Latvia, Lithuania, and Estonia. You can ship between all three countries.
          </p>
          <h3 className="text-base font-semibold text-semantic-text-heading">How long does delivery take?</h3>
          <p>
            Domestic deliveries usually take 1–3 business days. Cross-border can take
            2–5 business days depending on the route.
          </p>
          <h3 className="text-base font-semibold text-semantic-text-heading">How should I pack a game?</h3>
          <p>
            We have a full{' '}
            <Link href="/help/packing" className="text-semantic-brand sm:hover:text-semantic-brand-hover transition-colors duration-250 ease-out-custom">
              packing guide
            </Link>
            {' '}with step-by-step instructions, locker sizes, and tips for Baltic weather.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-semibold font-platform tracking-tight text-semantic-text-heading">
            Orders and disputes
          </h2>
          <h3 className="text-base font-semibold text-semantic-text-heading">What happens after I buy?</h3>
          <p>
            The seller has 48 hours to accept the order, then 5 days to ship it. You can
            track everything on your{' '}
            <Link href="/account/orders" className="text-semantic-brand sm:hover:text-semantic-brand-hover transition-colors duration-250 ease-out-custom">
              orders page
            </Link>.
            Once delivered, you have 2 days to check the game before payment goes to the seller.
          </p>
          <h3 className="text-base font-semibold text-semantic-text-heading">What if the game arrives damaged?</h3>
          <p>
            You can open a dispute within 2 days of delivery. Upload photos and describe
            what&apos;s wrong. The seller can offer a refund, or you can escalate to our
            team if you can&apos;t reach an agreement.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-semibold font-platform tracking-tight text-semantic-text-heading">
            Your account
          </h2>
          <h3 className="text-base font-semibold text-semantic-text-heading">How do I change my settings?</h3>
          <p>
            Head to{' '}
            <Link href="/account/settings" className="text-semantic-brand sm:hover:text-semantic-brand-hover transition-colors duration-250 ease-out-custom">
              account settings
            </Link>
            {' '}to update your display name, email, password, or phone number.
          </p>
          <h3 className="text-base font-semibold text-semantic-text-heading">Can I export or delete my data?</h3>
          <p>
            Yes. In account settings you can export your data as JSON or permanently delete
            your account. Deleting anonymizes your profile and deactivates any active listings.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-semibold font-platform tracking-tight text-semantic-text-heading">
            About Second Turn Games
          </h2>
          <p>
            A marketplace for pre-loved board games in Latvia, Lithuania, and Estonia.
            Every game deserves a second turn at the table.
          </p>
          <p>
            Question not covered here?{' '}
            <Link href="/contact" className="text-semantic-brand sm:hover:text-semantic-brand-hover transition-colors duration-250 ease-out-custom">
              Get in touch
            </Link>.
          </p>
        </section>
      </div>
    </div>
  );
}

import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Help Center',
};

export default function HelpPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
      <h1 className="text-2xl sm:text-3xl font-bold font-display tracking-tight text-semantic-text-heading mb-6">
        Help Center
      </h1>

      <div className="prose prose-sm max-w-none text-semantic-text-secondary space-y-8">
        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-semibold font-display tracking-tight text-semantic-text-heading">
            Buying
          </h2>
          <h3 className="text-base font-semibold text-semantic-text-heading">How do I buy a game?</h3>
          <p>
            Browse the marketplace, find a game you like, and click through to the listing.
            Select a parcel locker for delivery, then pay with card or your wallet balance.
            The seller will ship the game to your chosen locker.
          </p>
          <h3 className="text-base font-semibold text-semantic-text-heading">What payment methods are accepted?</h3>
          <p>
            We accept card payments (Visa, Mastercard) through EveryPay. If you have a wallet
            balance from previous sales, you can use that too.
          </p>
          <h3 className="text-base font-semibold text-semantic-text-heading">How much does shipping cost?</h3>
          <p>
            Shipping prices depend on the route (seller country to buyer country). All shipments
            go through Unisend parcel lockers across Latvia, Lithuania, and Estonia. The shipping
            cost is shown at checkout before you pay.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-semibold font-display tracking-tight text-semantic-text-heading">
            Selling
          </h2>
          <h3 className="text-base font-semibold text-semantic-text-heading">How do I list a game?</h3>
          <p>
            Go to{' '}
            <Link href="/sell" className="text-semantic-brand sm:hover:text-semantic-brand-hover transition-colors">
              List a game
            </Link>
            {' '}and search for your game. Select the edition, add photos, set the condition and
            price, and publish. Your listing will be visible to buyers across all three Baltic countries.
          </p>
          <h3 className="text-base font-semibold text-semantic-text-heading">What are the fees?</h3>
          <p>
            We charge a 10% commission on the item price (not on shipping). There are no listing
            fees or monthly charges. You only pay when a game sells.
          </p>
          <h3 className="text-base font-semibold text-semantic-text-heading">How do I get paid?</h3>
          <p>
            When an order is completed, your earnings (90% of the item price) are credited to
            your wallet. You can withdraw your balance to your bank account at any time.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-semibold font-display tracking-tight text-semantic-text-heading">
            Shipping
          </h2>
          <h3 className="text-base font-semibold text-semantic-text-heading">How does shipping work?</h3>
          <p>
            All shipments use Unisend parcel lockers. When you accept an order as a seller,
            you will receive shipping instructions with a barcode. Drop the package at any
            Unisend terminal, and the buyer picks it up from their chosen locker.
          </p>
          <h3 className="text-base font-semibold text-semantic-text-heading">Which countries are supported?</h3>
          <p>
            Latvia, Lithuania, and Estonia. Cross-border shipping between all three countries
            is supported through the Unisend network.
          </p>
          <h3 className="text-base font-semibold text-semantic-text-heading">How long does delivery take?</h3>
          <p>
            Domestic deliveries typically take 1-3 business days. Cross-border shipments may
            take 2-5 business days depending on the route.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-semibold font-display tracking-tight text-semantic-text-heading">
            Orders and Disputes
          </h2>
          <h3 className="text-base font-semibold text-semantic-text-heading">What happens after I buy?</h3>
          <p>
            After payment, the seller has time to accept the order and ship the game. You can
            track the order status on your{' '}
            <Link href="/account/orders" className="text-semantic-brand sm:hover:text-semantic-brand-hover transition-colors">
              orders page
            </Link>.
            Once delivered, you have 2 days to confirm everything is in order before the
            payment is released to the seller.
          </p>
          <h3 className="text-base font-semibold text-semantic-text-heading">What if something goes wrong?</h3>
          <p>
            If the game arrives damaged or not as described, you can open a dispute within
            2 days of delivery. Upload photos as evidence and describe the issue. The seller
            can offer a refund, or you can escalate to our team for resolution.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-semibold font-display tracking-tight text-semantic-text-heading">
            Your Account
          </h2>
          <h3 className="text-base font-semibold text-semantic-text-heading">How do I change my settings?</h3>
          <p>
            Visit your{' '}
            <Link href="/account/settings" className="text-semantic-brand sm:hover:text-semantic-brand-hover transition-colors">
              account settings
            </Link>
            {' '}to update your display name, email, password, and phone number.
          </p>
          <h3 className="text-base font-semibold text-semantic-text-heading">Can I export or delete my data?</h3>
          <p>
            Yes. Under account settings, you can export all your data as a JSON file or
            permanently delete your account. Account deletion anonymizes your profile and
            deactivates all active listings.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl sm:text-2xl font-semibold font-display tracking-tight text-semantic-text-heading">
            About Second Turn Games
          </h2>
          <p>
            Second Turn Games is a peer-to-peer marketplace for pre-loved board games in
            the Baltic region. We believe every game deserves a second turn at the table.
          </p>
          <p>
            Currently serving Latvia, Lithuania, and Estonia. Have a question not covered here?{' '}
            <Link href="/contact" className="text-semantic-brand sm:hover:text-semantic-brand-hover transition-colors">
              Get in touch
            </Link>.
          </p>
        </section>
      </div>
    </div>
  );
}

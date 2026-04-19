'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Alert, Button, Card, CardBody, CardHeader, Checkbox } from '@/components/ui';
import { SELLER_DECLARATION_TEXT } from '@/lib/legal/constants';
import { acceptSellerTerms } from '@/lib/seller/actions';

/**
 * Page-level gate rendered on /sell when the signed-in user has not yet
 * accepted the Seller Agreement at the current SELLER_TERMS_VERSION.
 *
 * The gate renders instead of SellPageClient until the user accepts. On
 * accept: call acceptSellerTerms → router.refresh() so the server component
 * re-renders into the normal sell flow.
 *
 * The declaration label text is rendered via {SELLER_DECLARATION_TEXT}, never
 * hard-coded, so any UI refactor must go through the legal-constants file.
 */
interface SellerTermsAcceptanceGateProps {
  /** True when the user has previously accepted a stale SELLER_TERMS_VERSION
   *  (vs. never accepted). Only changes the heading + intro copy. */
  isReAcceptance: boolean;
}

export function SellerTermsAcceptanceGate({ isReAcceptance }: SellerTermsAcceptanceGateProps) {
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const heading = isReAcceptance ? 'We updated the Seller Agreement' : 'Before you list your first game';
  const intro = isReAcceptance
    ? 'The Seller Agreement has changed since you last accepted it. Please review the updated terms and confirm below to keep listing.'
    : 'Selling on Second Turn Games means agreeing to a short set of terms. Have a look, then confirm below to start listing.';

  function onAccept() {
    if (!checked) return;
    setError(null);
    startTransition(async () => {
      const result = await acceptSellerTerms();
      if ('error' in result) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <h2 className="text-xl sm:text-2xl font-semibold font-display tracking-tight text-semantic-text-heading">
          {heading}
        </h2>
        <p className="text-sm text-semantic-text-secondary mt-2">{intro}</p>
      </CardHeader>
      <CardBody className="space-y-4">
        <ul className="list-disc pl-5 space-y-2 text-sm text-semantic-text-secondary">
          <li>You must be at least 18 and a private individual living in Latvia, Lithuania, or Estonia &mdash; no business-like reselling.</li>
          <li>Describe games accurately, pack them well, and ship on time.</li>
          <li>We take a 10% commission on the item price (not shipping). Your earnings land in a platform wallet.</li>
          <li>DAC7 reporting kicks in at 30 sales or €2,000 in consideration per calendar year; we&apos;ll ask for your tax details before that.</li>
          <li>We can delay payouts, reverse transactions, or suspend your account for fraud, counterfeit items, or false descriptions.</li>
        </ul>

        <p className="text-sm text-semantic-text-secondary">
          Read the full{' '}
          <Link href="/seller-terms" className="link-brand">
            Seller Agreement
          </Link>{' '}
          before you accept.
        </p>

        <Checkbox checked={checked} onChange={setChecked} disabled={isPending}>
          {SELLER_DECLARATION_TEXT}
        </Checkbox>

        {error && <Alert variant="error">{error}</Alert>}

        <div className="flex justify-end">
          <Button
            variant="brand"
            onClick={onAccept}
            disabled={!checked || isPending}
          >
            {isPending ? 'Saving\u2026' : 'Accept and continue'}
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

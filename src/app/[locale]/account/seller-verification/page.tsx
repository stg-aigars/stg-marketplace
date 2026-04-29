import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireServerAuth } from '@/lib/auth/helpers';
import { Alert, Card, CardBody } from '@/components/ui';
import { formatDate } from '@/lib/date-utils';
import { SellerVerificationForm } from './SellerVerificationForm';

export const metadata: Metadata = {
  title: 'Seller verification',
};

export default async function SellerVerificationPage() {
  const { user, serviceClient } = await requireServerAuth();
  if (!user) {
    redirect('/sign-in');
  }

  const { data: profile } = await serviceClient
    .from('user_profiles')
    .select('verification_requested_at, verification_response, verification_responded_at')
    .eq('id', user.id)
    .single();

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold font-display tracking-tight text-semantic-text-heading">
          A quick question about your selling
        </h1>
        <p className="text-sm text-semantic-text-muted mt-1">
          Our team sent you a verification email — this page is where you answer.
        </p>
      </div>

      {!profile?.verification_requested_at ? (
        <Alert variant="info">
          No verification request is pending on your account. If you received an email about
          this, please <Link href="/contact" className="link-brand">let us know</Link>.
        </Alert>
      ) : profile.verification_response ? (
        <Alert variant="success" title="Already responded">
          You answered on{' '}
          {profile.verification_responded_at
            ? formatDate(profile.verification_responded_at)
            : 'an earlier date'}{' '}
          — recorded as <strong>{profile.verification_response}</strong>. If you need to change
          this, contact{' '}
          <a href="mailto:info@secondturn.games" className="link-brand">
            info@secondturn.games
          </a>
          .
        </Alert>
      ) : (
        <Card>
          <CardBody className="space-y-4">
            <p className="text-sm text-semantic-text-secondary">
              EU consumer law treats people who sell games <strong>as a business or trade</strong>{' '}
              differently from people who sell <strong>from their personal collection</strong>.
              Most of our community sits squarely in the second group — collectors thinning
              shelves, parents passing on games their kids outgrew, that kind of thing. But we
              need to confirm with you which side of that line you&apos;re on.
            </p>
            <SellerVerificationForm />
          </CardBody>
        </Card>
      )}
    </div>
  );
}

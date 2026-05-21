import { EnvelopeSimple } from '@phosphor-icons/react/ssr';
import { Card, CardBody } from '@/components/ui';
import { Link } from '@/i18n/navigation';
import { PAGE_HEADING_CLASS } from '@/lib/heading-classes';
import { safeReturnUrl } from '@/lib/auth/safe-return-url';

export const metadata = {
  title: 'Check your email',
};

export default async function VerifyEmailPage(
  props: {
    searchParams: Promise<{ email?: string; returnUrl?: string }>;
  }
) {
  const { email, returnUrl } = await props.searchParams;

  // searchParams arrive from the URL bar — re-sanitize on read so a crafted
  // value can't leak into the "Sign up again" href that we render.
  const safeReturn = safeReturnUrl(returnUrl);
  const signUpHref = safeReturn !== '/'
    ? `/auth/signup?returnUrl=${encodeURIComponent(safeReturn)}`
    : '/auth/signup';

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
      <div className="max-w-md mx-auto">
        <Card>
          <CardBody className="text-center py-10">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-md bg-semantic-brand-bg text-semantic-brand">
              <EnvelopeSimple
                size={32}
                weight="regular"
                aria-hidden="true"
              />
            </div>

            <h1 className={PAGE_HEADING_CLASS}>Check your email</h1>

            <p className="mt-3 text-semantic-text-secondary">
              We sent a confirmation link to{' '}
              {email ? (
                <span className="font-medium text-semantic-text-primary break-words">
                  {email}
                </span>
              ) : (
                'your email address'
              )}
              . Open it to finish setting up your account.
            </p>

            <p className="mt-6 text-sm text-semantic-text-muted">
              Don&apos;t see it? Check your spam folder, or give it a minute to arrive.
            </p>
          </CardBody>
        </Card>

        <p className="mt-6 text-center text-sm text-semantic-text-secondary">
          Used the wrong email?{' '}
          <Link
            href={signUpHref}
            className="font-medium text-semantic-brand sm:hover:underline"
          >
            Sign up again
          </Link>
        </p>
      </div>
    </div>
  );
}

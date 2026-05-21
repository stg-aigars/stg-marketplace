import { EnvelopeSimple } from '@phosphor-icons/react/ssr';
import { Card, CardBody } from '@/components/ui';
import { Link } from '@/i18n/navigation';
import { PAGE_HEADING_CLASS } from '@/lib/heading-classes';

export const metadata = {
  title: 'Check your email',
};

export default async function VerifyEmailPage(
  props: {
    searchParams: Promise<{ email?: string; returnUrl?: string }>;
  }
) {
  const { email, returnUrl } = await props.searchParams;

  const signUpHref = returnUrl
    ? `/auth/signup?returnUrl=${encodeURIComponent(returnUrl)}`
    : '/auth/signup';

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
      <div className="max-w-md mx-auto">
        <Card>
          <CardBody className="text-center py-10">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-semantic-brand/10">
              <EnvelopeSimple
                size={32}
                weight="duotone"
                className="text-semantic-brand"
                aria-hidden="true"
              />
            </div>

            <h1 className={PAGE_HEADING_CLASS}>Check your email</h1>

            <p className="mt-3 text-semantic-text-secondary">
              We sent a confirmation link to{' '}
              {email ? (
                <span className="font-medium text-semantic-text-primary break-all">
                  {email}
                </span>
              ) : (
                'your email address'
              )}
              . Click it to activate your account and start using Second Turn Games.
            </p>

            <p className="mt-6 text-sm text-semantic-text-muted">
              Don&apos;t see it? Check your spam folder, or wait a minute — emails
              can take a moment to arrive.
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

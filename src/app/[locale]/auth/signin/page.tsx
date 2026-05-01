import { Card, CardBody } from '@/components/ui';
import { SignInForm } from '../_components/SignInForm';

export const metadata = {
  title: 'Sign in',
};

export default async function SignInPage(
  props: {
    searchParams: Promise<{ returnUrl?: string; error?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const errorMessage =
    searchParams.error === 'auth_error'
      ? 'Something went wrong. Please try again'
      : undefined;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
      <div className="max-w-md mx-auto">
        <div className="text-center mb-6">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-semantic-text-heading">
            Welcome back
          </h1>
          <p className="mt-2 text-semantic-text-secondary">
            Sign in to buy and sell pre-loved board games
          </p>
        </div>

        <Card>
          <CardBody>
            <SignInForm
              returnUrl={searchParams.returnUrl}
              errorMessage={errorMessage}
            />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

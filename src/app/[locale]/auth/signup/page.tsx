import { Card, CardBody } from '@/components/ui';
import { SignUpForm } from '../_components/SignUpForm';

export const metadata = {
  title: 'Create account',
};

export default async function SignUpPage(
  props: {
    searchParams: Promise<{ returnUrl?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
      <div className="max-w-md mx-auto">
        <div className="text-center mb-6">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-semantic-text-heading">
            Create your account
          </h1>
          <p className="mt-2 text-semantic-text-secondary">
            Buy and sell pre-loved board games across the Baltics
          </p>
        </div>

        <Card>
          <CardBody>
            <SignUpForm returnUrl={searchParams.returnUrl} />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

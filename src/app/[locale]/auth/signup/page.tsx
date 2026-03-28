import { Card, CardBody } from '@/components/ui';
import { SignUpForm } from '../_components/SignUpForm';

export const metadata = {
  title: 'Create account',
};

export default function SignUpPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
      <div className="max-w-md mx-auto">
        <div className="text-center mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold font-display tracking-tight text-semantic-text-heading">
            Join the community
          </h1>
          <p className="mt-2 text-semantic-text-secondary">
            Start buying and selling pre-loved board games in the Baltics
          </p>
        </div>

        <Card>
          <CardBody>
            <SignUpForm />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

import { Card, CardBody } from '@/components/ui';
import { ForgotPasswordForm } from '../_components/ForgotPasswordForm';

export const metadata = {
  title: 'Forgot password',
};

export default function ForgotPasswordPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
      <div className="max-w-md mx-auto">
        <div className="text-center mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold font-platform tracking-tight text-semantic-text-heading">
            Reset your password
          </h1>
          <p className="mt-2 text-semantic-text-secondary">
            Enter your email and we will send you a reset link
          </p>
        </div>

        <Card>
          <CardBody>
            <ForgotPasswordForm />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

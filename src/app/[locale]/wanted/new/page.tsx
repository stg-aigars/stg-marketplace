import type { Metadata } from 'next';
import { requireServerAuth } from '@/lib/auth/helpers';
import { CreateWantedForm } from './CreateWantedForm';

export const metadata: Metadata = {
  title: 'Post a wanted game',
};

export default async function CreateWantedPage() {
  await requireServerAuth();

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
      <h1 className="text-2xl sm:text-3xl font-bold font-display tracking-tight text-semantic-text-heading mb-6">
        Post a wanted game
      </h1>
      <CreateWantedForm />
    </div>
  );
}

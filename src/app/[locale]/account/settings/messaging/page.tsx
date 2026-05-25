import type { Metadata } from 'next';
import { requireServerAuth } from '@/lib/auth/helpers';
import { createClient } from '@/lib/supabase/server';
import { BackLink, Card, CardBody } from '@/components/ui';
import { MessagingToggle } from './MessagingToggle';

export const metadata: Metadata = {
  title: 'Message settings',
};

export default async function MessagingSettingsPage() {
  const { user } = await requireServerAuth();
  const supabase = await createClient();

  const { data } = await supabase
    .from('user_profiles')
    .select('messaging_enabled')
    .eq('id', user.id)
    .maybeSingle();

  const initialValue = data?.messaging_enabled ?? true;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
      <BackLink href="/account/settings" label="Account settings" />
      <h1 className="mt-4 mb-6 text-2xl sm:text-3xl font-extrabold tracking-tight">
        Message settings
      </h1>
      <Card>
        <CardBody>
          <MessagingToggle initialValue={initialValue} />
        </CardBody>
      </Card>
    </div>
  );
}

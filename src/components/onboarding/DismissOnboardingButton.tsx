'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui';
import { dismissOnboarding } from '@/lib/onboarding/actions';

interface DismissOnboardingButtonProps {
  label?: string;
}

export function DismissOnboardingButton({ label = 'Dismiss' }: DismissOnboardingButtonProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleDismiss() {
    startTransition(async () => {
      await dismissOnboarding();
      router.refresh();
    });
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleDismiss}
      loading={isPending}
    >
      {label}
    </Button>
  );
}

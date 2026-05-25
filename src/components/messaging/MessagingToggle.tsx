'use client';

import { useState, useTransition } from 'react';
import { Toggle } from '@/components/ui';
import { toggleMessagingEnabled } from '@/lib/messaging/actions';

interface MessagingToggleProps {
  initialValue: boolean;
}

export function MessagingToggle({ initialValue }: MessagingToggleProps) {
  const [enabled, setEnabled] = useState(initialValue);
  const [isPending, startTransition] = useTransition();

  function handleChange(newValue: boolean) {
    setEnabled(newValue);
    startTransition(async () => {
      await toggleMessagingEnabled(newValue);
    });
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-semantic-text-primary">
          Allow others to start new conversations with you
        </span>
        <Toggle checked={enabled} onChange={handleChange} size="sm" />
      </div>
      <p className="text-xs text-semantic-text-muted">
        Ongoing conversations stay open. You can still reply to anyone who&rsquo;s already messaged you.
      </p>
      {isPending && (
        <p className="text-xs text-semantic-text-muted" aria-live="polite">
          Saving&hellip;
        </p>
      )}
    </div>
  );
}

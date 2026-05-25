'use client';

import { useState, useTransition } from 'react';
import { Checkbox } from '@/components/ui';
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
    <div className="flex flex-col gap-3">
      <Checkbox checked={enabled} onChange={handleChange} disabled={isPending}>
        <span className="block">
          <span className="block font-medium text-semantic-text-primary">
            Allow people to send me messages
          </span>
          <span className="block mt-1 text-sm text-semantic-text-muted">
            Existing conversations will continue. You&rsquo;ll stop receiving new ones.
          </span>
        </span>
      </Checkbox>
    </div>
  );
}

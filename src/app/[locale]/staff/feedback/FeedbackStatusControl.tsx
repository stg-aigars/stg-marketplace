'use client';

import { useState, useTransition } from 'react';
import { Select } from '@/components/ui';
import { setFeedbackStatus } from './actions';

type FeedbackStatus = 'new' | 'triaged' | 'resolved';

const STATUS_OPTIONS: { value: FeedbackStatus; label: string }[] = [
  { value: 'new', label: 'New' },
  { value: 'triaged', label: 'Triaged' },
  { value: 'resolved', label: 'Resolved' },
];

interface Props {
  feedbackId: string;
  status: FeedbackStatus;
}

export function FeedbackStatusControl({ feedbackId, status }: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [localStatus, setLocalStatus] = useState<FeedbackStatus>(status);

  function handleChange(next: FeedbackStatus) {
    if (next === localStatus) return;
    const previous = localStatus;
    setLocalStatus(next);
    setError(null);

    startTransition(async () => {
      const result = await setFeedbackStatus(feedbackId, next);
      if ('error' in result) {
        setLocalStatus(previous);
        setError(result.error);
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      <Select
        value={localStatus}
        onChange={(e) => handleChange(e.target.value as FeedbackStatus)}
        options={STATUS_OPTIONS}
        disabled={isPending}
        className="min-h-0 py-1 text-sm"
      />
      {error && <span className="text-xs text-semantic-error">{error}</span>}
    </div>
  );
}

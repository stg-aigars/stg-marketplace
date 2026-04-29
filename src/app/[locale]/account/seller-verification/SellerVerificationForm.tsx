'use client';

import { useState, useTransition } from 'react';
import { Alert, Button } from '@/components/ui';
import { submitSellerVerification, type VerificationResponse } from './actions';

const OPTIONS: { value: VerificationResponse; label: string; description: string }[] = [
  {
    value: 'collector',
    label: "I'm a private collector culling my collection",
    description:
      'Selling games you bought, played, and decided to pass on. Most of our community sits here.',
  },
  {
    value: 'trader',
    label: "I'm acting as a trader (running a shop, reselling for profit)",
    description:
      "We'll switch on the trader features in your account so buyers see your business details and get the 14-day return rights they're entitled to.",
  },
  {
    value: 'unresponsive',
    label: "I'd rather not say",
    description:
      "We'll record this as 'no answer' and our staff team will follow up if needed.",
  },
];

export function SellerVerificationForm() {
  const [isPending, startTransition] = useTransition();
  const [selected, setSelected] = useState<VerificationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const submit = () => {
    if (!selected) {
      setError('Pick one option.');
      return;
    }
    setError(null);
    setSuccess(false);
    startTransition(async () => {
      const result = await submitSellerVerification(selected);
      if ('error' in result) {
        setError(result.error);
      } else {
        setSuccess(true);
      }
    });
  };

  if (success) {
    return (
      <Alert variant="success" title="Thanks for letting us know">
        Your response has been recorded. If we need anything more, we&apos;ll be in touch.
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      {OPTIONS.map((opt) => (
        <label
          key={opt.value}
          className={`block border rounded-lg p-4 cursor-pointer transition-all duration-250 ease-out-custom ${
            selected === opt.value
              ? 'border-2 border-semantic-brand bg-semantic-bg-elevated'
              : 'border-semantic-border-default hover:border-semantic-border-strong'
          }`}
        >
          <div className="flex items-start gap-3">
            <input
              type="radio"
              name="verification"
              value={opt.value}
              checked={selected === opt.value}
              onChange={() => setSelected(opt.value)}
              className="mt-1"
            />
            <div className="flex-1">
              <div className="text-sm font-semibold text-semantic-text-heading">{opt.label}</div>
              <div className="text-xs text-semantic-text-muted mt-1">{opt.description}</div>
            </div>
          </div>
        </label>
      ))}

      {error && <Alert variant="error">{error}</Alert>}

      <div className="flex justify-end">
        <Button variant="primary" onClick={submit} disabled={isPending || !selected} loading={isPending}>
          Submit response
        </Button>
      </div>
    </div>
  );
}

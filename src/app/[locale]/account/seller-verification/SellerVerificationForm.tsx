'use client';

import { useState, useTransition } from 'react';
import { Alert, Button } from '@/components/ui';
import { submitSellerVerification, type VerificationResponse } from './actions';

/**
 * The structured form is BINARY by design (lawyer correspondence 2026-04-28,
 * Option B). Sellers who are commercial reply to the email instead — adding
 * an "I'm a trader" radio button to a private-only platform creates a DSA
 * Art. 30 trap (a click confirms knowledge of commercial activity, which
 * triggers either offboarding or full Art. 30 compliance). The trader case
 * is handled via the support inbox, not the structured response.
 */
type FormResponse = Extract<VerificationResponse, 'collector' | 'unresponsive'>;

const OPTIONS: { value: FormResponse; label: string; description: string }[] = [
  {
    value: 'collector',
    label: 'I confirm I am a private collector selling from my personal collection.',
    description:
      'Games you bought, played, and decided to pass on — collectors thinning shelves, parents passing on games their kids outgrew. This keeps everything on your account exactly as it is.',
  },
  {
    value: 'unresponsive',
    label: "I'd rather not answer.",
    description:
      "We'll record this as 'no answer' and our staff team will follow up directly. If you're a registered business or trader, please reply to the email instead — we don't currently support commercial accounts and want to help you wrap up cleanly.",
  },
];

export function SellerVerificationForm() {
  const [isPending, startTransition] = useTransition();
  const [selected, setSelected] = useState<FormResponse | null>(null);
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

'use client';

import { useState, useRef } from 'react';
import {
  Button,
  Checkbox,
  Input,
  Select,
  Textarea,
  TurnstileWidget,
} from '@/components/ui';
import type { SelectOption, TurnstileWidgetRef } from '@/components/ui';
import { apiFetch } from '@/lib/api-fetch';
import { REPORT_CATEGORY_LABELS, REPORT_CATEGORY_VALUES } from './categories';

const CATEGORY_OPTIONS: SelectOption[] = [
  { value: '', label: 'Select a category' },
  ...REPORT_CATEGORY_VALUES.map((value) => ({ value, label: REPORT_CATEGORY_LABELS[value] })),
];

export function ReportIllegalContentForm() {
  const [contentReference, setContentReference] = useState('');
  const [category, setCategory] = useState('');
  const [explanation, setExplanation] = useState('');
  const [notifierName, setNotifierName] = useState('');
  const [notifierEmail, setNotifierEmail] = useState('');
  const [accuracyConfirmed, setAccuracyConfirmed] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | undefined>();
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const turnstileRef = useRef<TurnstileWidgetRef>(null);

  const isCsam = category === 'csam';
  const nameAndEmailRequired = !isCsam;

  const canSubmit =
    contentReference.trim() &&
    category &&
    explanation.trim() &&
    accuracyConfirmed &&
    (isCsam || (notifierName.trim() && notifierEmail.trim()));

  if (status === 'success') {
    return (
      <div className="rounded-lg border border-semantic-border-subtle bg-semantic-bg-elevated px-4 py-6 text-sm text-semantic-text-secondary space-y-2">
        <p className="font-semibold text-semantic-text-heading">Notice received.</p>
        <p>
          Thank you. We will review your notice and respond without undue delay. If you provided
          your email, you will receive a decision at that address; the affected user will also be
          notified of the outcome in line with Article 17 of the Digital Services Act.
        </p>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    setErrorMsg('');

    try {
      const res = await apiFetch('/api/report-illegal-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contentReference,
          category,
          explanation,
          notifierName: notifierName || null,
          notifierEmail: notifierEmail || null,
          accuracyConfirmed,
          turnstileToken,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to submit notice');
      }

      setStatus('success');
    } catch (err) {
      setStatus('error');
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong');
      turnstileRef.current?.reset();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Input
          id="content-reference"
          label="What content is this about?"
          value={contentReference}
          onChange={(e) => setContentReference(e.target.value)}
          required
        />
        <p className="mt-1.5 text-sm text-semantic-text-muted">
          Paste the URL of the listing, comment, or profile — or a listing ID.
        </p>
      </div>

      <Select
        id="category"
        label="Category"
        options={CATEGORY_OPTIONS}
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        required
      />

      <div>
        <Textarea
          id="explanation"
          label="Why do you believe this content is illegal?"
          rows={5}
          value={explanation}
          onChange={(e) => setExplanation(e.target.value)}
          required
        />
        <p className="mt-1.5 text-sm text-semantic-text-muted">
          Be specific. Cite the law or rule you believe is being broken if you can.
        </p>
      </div>

      <Input
        id="notifier-name"
        label={nameAndEmailRequired ? 'Your name' : 'Your name (optional for CSAM reports)'}
        value={notifierName}
        onChange={(e) => setNotifierName(e.target.value)}
        required={nameAndEmailRequired}
      />

      <div>
        <Input
          id="notifier-email"
          type="email"
          label={nameAndEmailRequired ? 'Your email' : 'Your email (optional for CSAM reports)'}
          value={notifierEmail}
          onChange={(e) => setNotifierEmail(e.target.value)}
          required={nameAndEmailRequired}
        />
        {nameAndEmailRequired && (
          <p className="mt-1.5 text-sm text-semantic-text-muted">
            We will send our decision to this address.
          </p>
        )}
      </div>

      <Checkbox checked={accuracyConfirmed} onChange={setAccuracyConfirmed}>
        I confirm the information I am providing is accurate to the best of my knowledge.
      </Checkbox>

      <TurnstileWidget ref={turnstileRef} onVerify={setTurnstileToken} />

      {status === 'error' && (
        <p className="text-sm text-semantic-error">{errorMsg}</p>
      )}

      <Button
        type="submit"
        size="lg"
        loading={status === 'loading'}
        disabled={!canSubmit || status === 'loading'}
        className="w-full"
      >
        {status === 'loading' ? 'Submitting notice…' : 'Submit notice'}
      </Button>

      <p className="text-xs text-semantic-text-muted">
        Submitting a knowingly false notice may be a criminal offence under Latvian Criminal Law
        §300 (misleading information to authorities) and exposes you to liability for the
        resulting damages.
      </p>
    </form>
  );
}

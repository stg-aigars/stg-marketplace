'use client';

import { useState, useRef, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { usePathname } from '@/i18n/navigation';
import { Button, Textarea, Input, TurnstileWidget, Alert } from '@/components/ui';
import type { TurnstileWidgetRef } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';
import { apiFetch } from '@/lib/api-fetch';
import { FEEDBACK_CATEGORIES, type FeedbackCategory } from '@/lib/feedback/types';

const MAX_MESSAGE = 2000;
const SUCCESS_AUTO_CLOSE_MS = 3000;

interface FeedbackFormProps {
  onClose: () => void;
}

export function FeedbackForm({ onClose }: FeedbackFormProps) {
  const t = useTranslations('Feedback');
  const locale = useLocale();
  const pathname = usePathname();
  const { user, loading: authLoading } = useAuth();

  const [category, setCategory] = useState<FeedbackCategory>('idea');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success'>('idle');
  const [error, setError] = useState('');

  const turnstileRef = useRef<TurnstileWidgetRef>(null);
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear the auto-close timer on unmount so onClose can't fire against an
  // already-torn-down modal (an orphaned setTimeout would otherwise trigger
  // React's state-update-on-unmounted warning in dev).
  useEffect(() => {
    return () => {
      if (successTimerRef.current) {
        clearTimeout(successTimerRef.current);
        successTimerRef.current = null;
      }
    };
  }, []);

  const canSubmit =
    !!message.trim() && !!turnstileToken && status !== 'loading';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setStatus('loading');
    setError('');

    try {
      const res = await apiFetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          message: message.trim(),
          contactEmail: !user && email.trim() ? email.trim() : undefined,
          pageUrl: pathname,
          locale,
          turnstileToken,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || t('error.generic'));
      }

      setStatus('success');
      successTimerRef.current = setTimeout(() => {
        successTimerRef.current = null;
        onClose();
      }, SUCCESS_AUTO_CLOSE_MS);
    } catch (err) {
      setStatus('idle');
      setError(err instanceof Error ? err.message : t('error.generic'));
      turnstileRef.current?.reset();
    }
  }

  if (status === 'success') {
    return (
      <div className="py-8 text-center">
        <h3 className="text-base font-semibold text-semantic-text-heading">
          {t('success.title')}
        </h3>
        <p className="mt-2 text-sm text-semantic-text-secondary">
          {t('success.body')}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pb-4">
      <p className="text-sm text-semantic-text-secondary">{t('intro')}</p>

      <div>
        <p
          id="feedback-category-label"
          className="block text-sm font-medium text-semantic-text-primary mb-1.5"
        >
          {t('label.category')}
        </p>
        <div
          role="radiogroup"
          aria-labelledby="feedback-category-label"
          className="grid grid-cols-3 gap-2"
        >
          {FEEDBACK_CATEGORIES.map((cat) => {
            const selected = category === cat;
            return (
              <Button
                key={cat}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setCategory(cat)}
                variant={selected ? 'brand' : 'secondary'}
              >
                {t(`option.${cat}`)}
              </Button>
            );
          })}
        </div>
      </div>

      <div>
        <Textarea
          id="feedback-message"
          label={t('label.message')}
          rows={5}
          maxLength={MAX_MESSAGE}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          required
        />
        <p className="mt-1 text-xs text-semantic-text-muted">
          {t('messageHelper', { count: message.length })}
        </p>
      </div>

      {!authLoading && !user && (
        <div>
          <Input
            id="feedback-email"
            type="email"
            label={t('label.email')}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
          <p className="mt-1 text-xs text-semantic-text-muted">
            {t('helper.email')}
          </p>
        </div>
      )}

      <TurnstileWidget ref={turnstileRef} onVerify={setTurnstileToken} />

      {error && <Alert variant="error">{error}</Alert>}

      <div className="flex flex-col sm:flex-row sm:justify-end gap-2 pt-2">
        <Button
          type="submit"
          variant="brand"
          loading={status === 'loading'}
          disabled={!canSubmit}
          className="w-full sm:w-auto"
        >
          {t('submit')}
        </Button>
      </div>
    </form>
  );
}

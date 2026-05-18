'use client';

import { useEffect, useState } from 'react';
import { X } from '@phosphor-icons/react/ssr';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui';
import { IS_FEEDBACK_BANNER } from '@/lib/constants';
import { FeedbackModal } from '@/components/feedback/FeedbackModal';

const STORAGE_KEY = 'stg:feedback-banner-dismissed:v1';

export function FeedbackBanner() {
  const t = useTranslations('Feedback');
  const [mounted, setMounted] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [open, setOpen] = useState(false);

  // Wait for mount to avoid hydration mismatch — localStorage is client-only.
  useEffect(() => {
    setDismissed(localStorage.getItem(STORAGE_KEY) === '1');
    setMounted(true);
  }, []);

  if (!IS_FEEDBACK_BANNER) return null;
  if (!mounted) return null;
  if (dismissed) return null;

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, '1');
    setDismissed(true);
  };

  return (
    <>
      <div className="bg-semantic-brand/10 border-b border-semantic-brand/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 flex items-center gap-3">
          <p className="text-sm font-medium text-semantic-text-heading flex-1 min-w-0">
            {t('bannerCopy')}
          </p>
          <Button
            variant="brand"
            size="sm"
            onClick={() => setOpen(true)}
            className="shrink-0"
          >
            {t('bannerCta')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={dismiss}
            aria-label="Dismiss"
            className="shrink-0 !p-1"
          >
            <X size={16} weight="bold" />
          </Button>
        </div>
      </div>
      {open && <FeedbackModal open onClose={() => setOpen(false)} />}
    </>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { Alert } from '@/components/ui';
import {
  isStaleActionError,
  hasRecentReloadAttempt,
  markReloadAttempt,
} from '@/lib/stale-action-guard';

const RELOAD_DELAY_MS = 300;

export function StaleActionGuard() {
  const t = useTranslations('staleAction');
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    function handler(event: PromiseRejectionEvent) {
      if (!isStaleActionError(event.reason)) return;

      event.preventDefault();

      if (hasRecentReloadAttempt()) {
        setShowBanner(true);
        return;
      }

      markReloadAttempt();
      toast(t('updating'));
      window.setTimeout(() => {
        window.location.reload();
      }, RELOAD_DELAY_MS);
    }

    window.addEventListener('unhandledrejection', handler, true);
    return () => window.removeEventListener('unhandledrejection', handler, true);
  }, [t]);

  if (!showBanner) return null;

  return (
    <div className="fixed top-0 inset-x-0 z-50 px-4 sm:px-6 pt-4">
      <div className="max-w-7xl mx-auto">
        <Alert
          variant="warning"
          dismissible
          onDismiss={() => setShowBanner(false)}
        >
          {t('newVersionAvailable')}
        </Alert>
      </div>
    </div>
  );
}

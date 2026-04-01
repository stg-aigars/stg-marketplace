'use client';

import { useEffect, useState } from 'react';
import { X } from '@phosphor-icons/react/ssr';
import { Button } from '@/components/ui';
import {
  isStaleActionError,
  hasRecentReloadAttempt,
  attemptStaleActionReload,
} from '@/lib/stale-action-guard';

export function StaleActionGuard() {
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    function handler(event: PromiseRejectionEvent) {
      if (isStaleActionError(event.reason)) {
        event.preventDefault();
        const reloaded = attemptStaleActionReload();
        if (!reloaded) {
          // Loop guard blocked reload — show manual refresh banner
          setShowBanner(true);
        }
      }
    }

    window.addEventListener('unhandledrejection', handler, true);
    return () => window.removeEventListener('unhandledrejection', handler, true);
  }, []);

  if (!showBanner) return null;

  return (
    <div className="fixed top-0 inset-x-0 z-50 border-b border-semantic-brand bg-semantic-bg-elevated shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
        <p className="text-sm text-semantic-text-primary">
          This page has been updated. Please refresh to continue.
        </p>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => window.location.reload()}
          >
            Refresh now
          </Button>
          <button
            onClick={() => setShowBanner(false)}
            className="p-1.5 rounded-md text-semantic-text-secondary hover:text-semantic-text-primary hover:bg-semantic-bg-subtle duration-250 ease-out-custom"
            aria-label="Dismiss"
          >
            <X size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}

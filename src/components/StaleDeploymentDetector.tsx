'use client';

import { useEffect, useState } from 'react';
import { X } from '@phosphor-icons/react/ssr';
import { Button } from '@/components/ui';

function isStaleDeploymentError(reason: unknown): boolean {
  if (!reason || typeof reason !== 'object') return false;

  const name = (reason as { name?: unknown }).name;
  if (name === 'UnrecognizedActionError') return true;

  const message = (reason as { message?: unknown }).message;
  if (typeof message === 'string' && message.includes('was not found on the server')) return true;

  // TODO: Also detect ChunkLoadError (stale code-split chunks 404ing after deploy) — same UX applies

  return false;
}

export function StaleDeploymentDetector() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    function handler(event: PromiseRejectionEvent) {
      if (isStaleDeploymentError(event.reason)) {
        event.preventDefault();
        setIsVisible(true);
      }
    }

    window.addEventListener('unhandledrejection', handler, true);
    return () => window.removeEventListener('unhandledrejection', handler, true);
  }, []);

  if (!isVisible) return null;

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
            onClick={() => setIsVisible(false)}
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

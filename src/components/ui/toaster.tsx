'use client';

import { Toaster as SonnerToaster } from 'sonner';

function Toaster() {
  return (
    <SonnerToaster
      position="bottom-right"
      toastOptions={{
        className:
          'bg-semantic-bg-elevated border border-semantic-border-subtle shadow-lg rounded-lg text-semantic-text-primary text-sm',
        duration: 4000,
      }}
    />
  );
}

export { Toaster };

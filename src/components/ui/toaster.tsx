'use client';

import { Toaster as SonnerToaster } from 'sonner';

function Toaster() {
  return (
    <SonnerToaster
      position="bottom-right"
      toastOptions={{
        unstyled: true,
        className:
          'bg-semantic-bg-elevated border border-semantic-border-subtle shadow-lg rounded-lg text-semantic-text-primary text-sm p-4 flex items-center gap-3',
        duration: 4000,
      }}
    />
  );
}

export { Toaster };

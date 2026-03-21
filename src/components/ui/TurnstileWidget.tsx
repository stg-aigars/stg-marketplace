'use client';

import { useRef, useCallback, useImperativeHandle, forwardRef } from 'react';
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile';

export interface TurnstileWidgetRef {
  reset: () => void;
}

interface TurnstileWidgetProps {
  onVerify: (token: string) => void;
  onError?: () => void;
}

const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

export const TurnstileWidget = forwardRef<TurnstileWidgetRef, TurnstileWidgetProps>(
  function TurnstileWidget({ onVerify, onError }, forwardedRef) {
    const ref = useRef<TurnstileInstance>(null);

    useImperativeHandle(forwardedRef, () => ({
      reset: () => ref.current?.reset(),
    }));

    const handleExpire = useCallback(() => {
      // Auto-reset on expiry so a fresh token is ready at submit time.
      // Tokens expire after ~300s — this handles users who idle on a form.
      ref.current?.reset();
    }, []);

    if (!siteKey) return null;

    return (
      <Turnstile
        ref={ref}
        siteKey={siteKey}
        onSuccess={onVerify}
        onError={onError}
        onExpire={handleExpire}
        options={{
          size: 'invisible',
          theme: 'light',
        }}
      />
    );
  }
);

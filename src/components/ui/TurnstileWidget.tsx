'use client';

import { useRef, useCallback, useImperativeHandle, forwardRef } from 'react';
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile';

export interface TurnstileWidgetRef {
  reset: () => void;
}

interface TurnstileWidgetProps {
  // Receives the Cloudflare token on success, AND an empty string when the widget
  // resets (imperatively via the forwarded `reset()` or automatically on expiry).
  // Callers should treat falsy as "no usable token yet" and gate their submit
  // button on `!!token` to avoid sending a stale/empty token on quick retries.
  onVerify: (token: string) => void;
  onError?: () => void;
}

const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

export const TurnstileWidget = forwardRef<TurnstileWidgetRef, TurnstileWidgetProps>(
  function TurnstileWidget({ onVerify, onError }, forwardedRef) {
    const ref = useRef<TurnstileInstance>(null);

    // Reset and expire both invalidate the previously-emitted token. Clear the parent's
    // token state at the same moment so callers gating their submit button on the token
    // can't accidentally resend a stale (single-use, already consumed) token on retry.
    useImperativeHandle(forwardedRef, () => ({
      reset: () => {
        ref.current?.reset();
        onVerify('');
      },
    }), [onVerify]);

    const handleExpire = useCallback(() => {
      // Auto-reset on expiry so a fresh token is ready at submit time.
      // Tokens expire after ~300s — this handles users who idle on a form.
      ref.current?.reset();
      onVerify('');
    }, [onVerify]);

    if (!siteKey) return null;

    return (
      <Turnstile
        ref={ref}
        siteKey={siteKey}
        onSuccess={onVerify}
        onError={onError}
        onExpire={handleExpire}
        options={{
          // 'interaction-only' renders zero chrome when Cloudflare doesn't need
          // user interaction (preserves invisible UX for ~67% who pass silently),
          // but surfaces the "I'm not a robot" checkbox when Managed mode wants
          // to escalate a risky visitor. With size:'invisible' the checkbox had
          // no surface to render on — failing users just hit a wall.
          appearance: 'interaction-only',
          theme: 'light',
        }}
      />
    );
  }
);

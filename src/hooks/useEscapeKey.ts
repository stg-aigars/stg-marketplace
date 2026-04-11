import { useEffect, type RefObject } from 'react';
import { useLatestRef } from './useLatestRef';

/**
 * Fires `onEscape` on the Escape keydown. Optionally returns focus to a
 * specified element after the callback runs, which is useful for closing a
 * popover and restoring focus to its trigger button.
 *
 * Same stable-ref pattern as `useClickOutside` via useLatestRef — the effect
 * only re-subscribes when `enabled` toggles, not on every render.
 */
export function useEscapeKey(
  onEscape: () => void,
  enabled: boolean,
  restoreFocusTo?: RefObject<HTMLElement | null>,
) {
  const onEscapeRef = useLatestRef(onEscape);
  const restoreFocusRef = useLatestRef(restoreFocusTo);

  useEffect(() => {
    if (!enabled) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      onEscapeRef.current();
      restoreFocusRef.current?.current?.focus();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [enabled, onEscapeRef, restoreFocusRef]);
}

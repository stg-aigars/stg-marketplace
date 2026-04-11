import { useEffect, useRef, type RefObject } from 'react';

/**
 * Fires `onEscape` on the Escape keydown. Optionally returns focus to a
 * specified element after the callback runs, which is useful for closing a
 * popover and restoring focus to its trigger button.
 *
 * Stable-ref pattern matches `useClickOutside`: the effect only re-subscribes
 * when `enabled` toggles, not on every render.
 */
export function useEscapeKey(
  onEscape: () => void,
  enabled: boolean,
  restoreFocusTo?: RefObject<HTMLElement | null>,
) {
  const onEscapeRef = useRef(onEscape);
  const restoreFocusRef = useRef(restoreFocusTo);

  useEffect(() => {
    onEscapeRef.current = onEscape;
    restoreFocusRef.current = restoreFocusTo;
  });

  useEffect(() => {
    if (!enabled) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      onEscapeRef.current();
      restoreFocusRef.current?.current?.focus();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [enabled]);
}

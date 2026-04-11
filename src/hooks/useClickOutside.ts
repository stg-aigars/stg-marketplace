import { useEffect, useRef, type RefObject } from 'react';

/**
 * Fires `onOutside` when a mousedown occurs outside every supplied ref.
 * Pass multiple refs when the "inside" region has disjoint parts — e.g. a
 * dropdown menu plus its trigger button that sits outside the menu's DOM.
 *
 * Implementation note: refs and callback are stashed in refs so the effect
 * only re-subscribes when `enabled` toggles, not on every render. This lets
 * callers pass inline arrow callbacks and inline ref lists without paying
 * listener churn.
 */
export function useClickOutside(
  onOutside: () => void,
  enabled: boolean,
  ...refs: RefObject<HTMLElement | null>[]
) {
  const onOutsideRef = useRef(onOutside);
  const refsRef = useRef(refs);

  useEffect(() => {
    onOutsideRef.current = onOutside;
    refsRef.current = refs;
  });

  useEffect(() => {
    if (!enabled) return;
    function handleMouseDown(e: MouseEvent) {
      const target = e.target as Node;
      const insideAny = refsRef.current.some((ref) => ref.current?.contains(target));
      if (!insideAny) onOutsideRef.current();
    }
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [enabled]);
}

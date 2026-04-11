import { useEffect, useRef, type RefObject } from 'react';

/**
 * Fires `onOutside` when a mousedown occurs outside all supplied refs — i.e.
 * when the click target is not contained by any ref's element. Pass multiple
 * refs as additional rest arguments when the "inside" region has disjoint
 * parts, e.g. a dropdown menu plus its trigger button that sits outside the
 * menu's DOM subtree.
 *
 * Implementation note: the latest callback and refs are stashed in refs and
 * synced inside an effect, so the subscription effect only re-runs when
 * `enabled` toggles — not on every render. Callers can pass inline arrow
 * callbacks without paying listener churn.
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

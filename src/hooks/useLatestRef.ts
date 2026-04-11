import { useEffect, useRef } from 'react';

/**
 * Holds the latest value in a ref, synced via a bare useEffect so the update
 * happens after render commits (never during render, which React 19 Strict
 * Mode flags). Use inside subscription hooks to read the latest callback or
 * prop inside an event handler without making the subscription re-run every
 * time the caller's closure identity changes.
 */
export function useLatestRef<T>(value: T) {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  });
  return ref;
}

import { useRef, useEffect, useCallback, useState } from 'react';

interface UseTouchGesturesOptions {
  onSwipeLeft: (() => void) | null;
  onSwipeRight: (() => void) | null;
  imageIndex: number;
}

interface GestureState {
  initialPinchDistance: number;
  scaleAtPinchStart: number;
  lastPanX: number;
  lastPanY: number;
  swipeStartX: number;
  swipeStartY: number;
  swipeStartTime: number;
  lastTapTime: number;
  lastTapX: number;
  lastTapY: number;
  scale: number;
  translateX: number;
  translateY: number;
  mode: 'none' | 'pinch' | 'pan' | 'swipe';
}

const INITIAL_STATE: GestureState = {
  initialPinchDistance: 0,
  scaleAtPinchStart: 1,
  lastPanX: 0,
  lastPanY: 0,
  swipeStartX: 0,
  swipeStartY: 0,
  swipeStartTime: 0,
  lastTapTime: 0,
  lastTapX: 0,
  lastTapY: 0,
  scale: 1,
  translateX: 0,
  translateY: 0,
  mode: 'none',
};

const MIN_SCALE = 1;
const MAX_SCALE = 3;
const SWIPE_THRESHOLD = 50; // px
const SWIPE_MAX_TIME = 300; // ms
const DOUBLE_TAP_MAX_TIME = 300; // ms
const DOUBLE_TAP_MAX_DISTANCE = 20; // px
const SNAP_THRESHOLD = 1.05;
const DOUBLE_TAP_SCALE = 2;
const TRANSITION_DURATION = 250; // ms — branded duration

function getDistance(t1: Touch, t2: Touch): number {
  const dx = t1.clientX - t2.clientX;
  const dy = t1.clientY - t2.clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

const GESTURE_STYLE = { touchAction: 'none' as const };

export function useTouchGestures({ onSwipeLeft, onSwipeRight, imageIndex }: UseTouchGesturesOptions) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gestureRef = useRef<GestureState>({ ...INITIAL_STATE });
  const rafRef = useRef<number>(0);
  const transitionTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [isZoomed, setIsZoomed] = useState(false);

  // Store swipe callbacks in refs so the touch listener effect doesn't re-run on callback identity changes
  const onSwipeLeftRef = useRef(onSwipeLeft);
  const onSwipeRightRef = useRef(onSwipeRight);
  onSwipeLeftRef.current = onSwipeLeft;
  onSwipeRightRef.current = onSwipeRight;

  const applyTransform = useCallback((animate = false) => {
    const el = containerRef.current;
    if (!el) return;

    const { scale, translateX, translateY } = gestureRef.current;

    if (animate) {
      el.style.transition = `transform ${TRANSITION_DURATION}ms cubic-bezier(0.2, 0, 0, 1)`;
      clearTimeout(transitionTimeoutRef.current);
      transitionTimeoutRef.current = setTimeout(() => {
        if (el) el.style.transition = '';
      }, TRANSITION_DURATION);
    }

    el.style.transform = `scale(${scale}) translate(${translateX}px, ${translateY}px)`;
  }, []);

  const resetZoom = useCallback((animate = true) => {
    const g = gestureRef.current;
    g.scale = 1;
    g.translateX = 0;
    g.translateY = 0;
    g.mode = 'none';
    applyTransform(animate);
    setIsZoomed(false);
  }, [applyTransform]);

  const clampTranslate = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const g = gestureRef.current;
    const maxOffsetX = ((g.scale - 1) * el.offsetWidth) / (2 * g.scale);
    const maxOffsetY = ((g.scale - 1) * el.offsetHeight) / (2 * g.scale);
    g.translateX = clamp(g.translateX, -maxOffsetX, maxOffsetX);
    g.translateY = clamp(g.translateY, -maxOffsetY, maxOffsetY);
  }, []);

  // Reset zoom when image changes
  useEffect(() => {
    resetZoom(true);
  }, [imageIndex, resetZoom]);

  // Touch event handlers
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    function onTouchStart(e: TouchEvent) {
      const g = gestureRef.current;

      if (e.touches.length === 2) {
        // Pinch start
        e.preventDefault();
        g.mode = 'pinch';
        g.initialPinchDistance = getDistance(e.touches[0], e.touches[1]);
        g.scaleAtPinchStart = g.scale;
      } else if (e.touches.length === 1) {
        const touch = e.touches[0];
        const now = Date.now();

        // Check for double-tap
        const timeDelta = now - g.lastTapTime;
        const distDelta = Math.sqrt(
          (touch.clientX - g.lastTapX) ** 2 + (touch.clientY - g.lastTapY) ** 2
        );

        if (timeDelta < DOUBLE_TAP_MAX_TIME && distDelta < DOUBLE_TAP_MAX_DISTANCE) {
          e.preventDefault();
          // Toggle zoom
          if (g.scale > 1) {
            resetZoom(true);
          } else {
            g.scale = DOUBLE_TAP_SCALE;
            g.translateX = 0;
            g.translateY = 0;
            applyTransform(true);
            setIsZoomed(true);
          }
          g.lastTapTime = 0; // Reset so triple-tap doesn't re-trigger
          return;
        }

        g.lastTapTime = now;
        g.lastTapX = touch.clientX;
        g.lastTapY = touch.clientY;

        if (g.scale > 1) {
          // Pan start
          e.preventDefault();
          g.mode = 'pan';
          g.lastPanX = touch.clientX;
          g.lastPanY = touch.clientY;
        } else {
          // Potential swipe
          g.mode = 'swipe';
          g.swipeStartX = touch.clientX;
          g.swipeStartY = touch.clientY;
          g.swipeStartTime = now;
        }
      }
    }

    function onTouchMove(e: TouchEvent) {
      const g = gestureRef.current;

      if (e.touches.length === 2 && g.mode === 'pinch') {
        e.preventDefault();
        const newDistance = getDistance(e.touches[0], e.touches[1]);
        const ratio = newDistance / g.initialPinchDistance;
        g.scale = clamp(g.scaleAtPinchStart * ratio, MIN_SCALE, MAX_SCALE);

        // Clamp translate for new scale
        clampTranslate();

        cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(() => {
          applyTransform();
          setIsZoomed(g.scale > 1);
        });
      } else if (e.touches.length === 1 && g.mode === 'pan') {
        e.preventDefault();
        const touch = e.touches[0];
        const dx = (touch.clientX - g.lastPanX) / g.scale;
        const dy = (touch.clientY - g.lastPanY) / g.scale;
        g.lastPanX = touch.clientX;
        g.lastPanY = touch.clientY;
        g.translateX += dx;
        g.translateY += dy;

        clampTranslate();

        cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(() => applyTransform());
      } else if (e.touches.length === 1 && g.mode === 'swipe') {
        // Check if vertical scroll — if so, bail out of swipe
        const touch = e.touches[0];
        const dx = Math.abs(touch.clientX - g.swipeStartX);
        const dy = Math.abs(touch.clientY - g.swipeStartY);
        if (dy > dx && dy > 10) {
          g.mode = 'none';
        }
      }

      // Transition from 1 finger to 2 fingers — switch to pinch
      if (e.touches.length === 2 && g.mode !== 'pinch') {
        e.preventDefault();
        g.mode = 'pinch';
        g.initialPinchDistance = getDistance(e.touches[0], e.touches[1]);
        g.scaleAtPinchStart = g.scale;
      }
    }

    function onTouchEnd(e: TouchEvent) {
      const g = gestureRef.current;

      if (g.mode === 'pinch' && e.touches.length < 2) {
        // Snap to 1 if close
        if (g.scale < SNAP_THRESHOLD) {
          resetZoom(true);
        }
        g.mode = e.touches.length === 1 ? 'pan' : 'none';
        if (e.touches.length === 1) {
          g.lastPanX = e.touches[0].clientX;
          g.lastPanY = e.touches[0].clientY;
        }
      } else if (g.mode === 'swipe' && e.touches.length === 0) {
        // Check swipe
        const elapsed = Date.now() - g.swipeStartTime;
        if (elapsed < SWIPE_MAX_TIME) {
          const dx = e.changedTouches[0].clientX - g.swipeStartX;
          if (dx < -SWIPE_THRESHOLD) {
            onSwipeLeftRef.current?.();
          } else if (dx > SWIPE_THRESHOLD) {
            onSwipeRightRef.current?.();
          }
        }
        g.mode = 'none';
      } else if (g.mode === 'pan' && e.touches.length === 0) {
        g.mode = 'none';
      }
    }

    el.addEventListener('touchstart', onTouchStart, { passive: false });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: false });

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      cancelAnimationFrame(rafRef.current);
      clearTimeout(transitionTimeoutRef.current);
    };
  }, [applyTransform, resetZoom, clampTranslate]);

  return { containerRef, gestureStyle: GESTURE_STYLE, isZoomed };
}

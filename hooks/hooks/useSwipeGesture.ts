import { useRef, useCallback } from 'react';

interface SwipeGestureOptions {
  onSwipeRight?: () => void;
  onSwipeLeft?: () => void;
  threshold?: number; // px to count as swipe
}

interface SwipeState {
  startX: number;
  startY: number;
  currentX: number;
  swiping: boolean;
}

export function useSwipeGesture(options: SwipeGestureOptions) {
  const { onSwipeRight, onSwipeLeft, threshold = 60 } = options;
  const swipeState = useRef<SwipeState>({
    startX: 0,
    startY: 0,
    currentX: 0,
    swiping: false,
  });
  const offsetRef = useRef(0);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    swipeState.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      currentX: touch.clientX,
      swiping: true,
    };
    offsetRef.current = 0;
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!swipeState.current.swiping) return;
    const touch = e.touches[0];
    const dx = touch.clientX - swipeState.current.startX;
    const dy = Math.abs(touch.clientY - swipeState.current.startY);
    // If vertical movement > horizontal, cancel swipe
    if (dy > Math.abs(dx) + 10) {
      swipeState.current.swiping = false;
      offsetRef.current = 0;
      return;
    }
    swipeState.current.currentX = touch.clientX;
    offsetRef.current = dx;
  }, []);

  const onTouchEnd = useCallback(() => {
    if (!swipeState.current.swiping) return;
    const dx = swipeState.current.currentX - swipeState.current.startX;
    if (dx > threshold && onSwipeRight) {
      onSwipeRight();
    } else if (dx < -threshold && onSwipeLeft) {
      onSwipeLeft();
    }
    swipeState.current.swiping = false;
    offsetRef.current = 0;
  }, [onSwipeRight, onSwipeLeft, threshold]);

  return {
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    getSwipeOffset: () => offsetRef.current,
  };
}

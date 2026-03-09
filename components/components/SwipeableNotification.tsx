'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

export type NotificationType = 'toast' | 'achievement' | 'discovery' | 'reward';

export interface NotificationData {
  id: number;
  message: string;
  emoji: string;
  type: NotificationType;
  duration?: number; // ms, default 3000
}

interface Props {
  notification: NotificationData;
  onDismiss: (id: number) => void;
}

const TYPE_STYLES: Record<NotificationType, string> = {
  toast: 'border-gray-700',
  achievement: 'border-yellow',
  discovery: 'border-orange',
  reward: 'border-purple',
};

export default function SwipeableNotification({ notification, onDismiss }: Props) {
  const [offset, setOffset] = useState(0);
  const [dismissing, setDismissing] = useState(false);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const swipingRef = useRef(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const duration = notification.duration || (notification.type === 'toast' ? 3000 : 5000);

  const dismiss = useCallback(() => {
    if (dismissing) return;
    setDismissing(true);
    setOffset(300); // slide out right
    setTimeout(() => onDismiss(notification.id), 300);
  }, [dismissing, notification.id, onDismiss]);

  // Auto-dismiss timer
  useEffect(() => {
    timerRef.current = setTimeout(dismiss, duration);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [dismiss, duration]);

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    startXRef.current = touch.clientX;
    startYRef.current = touch.clientY;
    swipingRef.current = true;
    // Pause auto-dismiss while swiping
    if (timerRef.current) clearTimeout(timerRef.current);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!swipingRef.current) return;
    const touch = e.touches[0];
    const dx = touch.clientX - startXRef.current;
    const dy = Math.abs(touch.clientY - startYRef.current);
    if (dy > Math.abs(dx) + 10) {
      swipingRef.current = false;
      setOffset(0);
      return;
    }
    // Only allow swiping right (positive direction)
    setOffset(Math.max(0, dx));
  };

  const handleTouchEnd = () => {
    if (!swipingRef.current) {
      return;
    }
    swipingRef.current = false;
    if (offset > 60) {
      dismiss();
    } else {
      setOffset(0);
      // Resume auto-dismiss
      timerRef.current = setTimeout(dismiss, duration);
    }
  };

  // Click to dismiss on desktop
  const handleClick = () => {
    dismiss();
  };

  const borderStyle = TYPE_STYLES[notification.type];

  return (
    <div
      className={`toast-enter bg-space-lighter border ${borderStyle} rounded px-3 py-2 text-sm flex items-center gap-2 max-w-[90vw] cursor-pointer select-none`}
      style={{
        transform: `translateX(${offset}px)`,
        opacity: dismissing ? 0 : Math.max(0.3, 1 - offset / 200),
        transition: swipingRef.current ? 'none' : 'transform 0.3s ease, opacity 0.3s ease',
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onClick={handleClick}
    >
      <span className="shrink-0">{notification.emoji}</span>
      <span className="truncate">{notification.message}</span>
    </div>
  );
}

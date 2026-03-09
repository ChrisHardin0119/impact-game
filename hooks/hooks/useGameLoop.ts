'use client';

import { useEffect, useRef, useCallback } from 'react';
import { GameState } from '@/lib/types';
import { processTick } from '@/lib/gameEngine';
import { saveGame } from '@/lib/saveLoad';
import { checkDiscoveries } from '@/lib/discoveries';

const AUTO_SAVE_INTERVAL = 30; // seconds

export function useGameLoop(
  stateRef: React.MutableRefObject<GameState>,
  setState: (s: GameState) => void,
) {
  const lastTimeRef = useRef<number>(0);
  const autoSaveTimerRef = useRef<number>(0);
  const rafRef = useRef<number>(0);

  const tick = useCallback((timestamp: number) => {
    if (lastTimeRef.current === 0) {
      lastTimeRef.current = timestamp;
    }

    const dt = Math.min((timestamp - lastTimeRef.current) / 1000, 0.1); // Cap at 100ms
    lastTimeRef.current = timestamp;

    if (dt > 0) {
      let newState = processTick(stateRef.current, dt);

      // Check discoveries periodically (not every frame for perf)
      autoSaveTimerRef.current += dt;
      if (autoSaveTimerRef.current >= AUTO_SAVE_INTERVAL) {
        autoSaveTimerRef.current = 0;
        // Check discoveries
        const newDiscoveries = checkDiscoveries(newState);
        if (newDiscoveries.length > 0) {
          newState = {
            ...newState,
            discoveries: [...newState.discoveries, ...newDiscoveries],
          };
        }
        // Auto-save
        saveGame(newState);
      }

      stateRef.current = newState;
      setState(newState);
    }

    rafRef.current = requestAnimationFrame(tick);
  }, [stateRef, setState]);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [tick]);
}

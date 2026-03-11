'use client';

import { useEffect, useRef, useCallback } from 'react';
import { GameState, AchievementPopup } from '@/lib/types';
import { processTick } from '@/lib/gameEngine';
import { saveGame } from '@/lib/saveLoad';
import { checkAchievements } from '@/lib/achievements';

const AUTO_SAVE_INTERVAL = 30; // seconds
const ACHIEVEMENT_CHECK_INTERVAL = 2; // seconds

export function useGameLoop(
  stateRef: React.MutableRefObject<GameState>,
  setState: (s: GameState) => void,
  onNewAchievements?: (popups: AchievementPopup[]) => void,
) {
  const lastTimeRef = useRef<number>(0);
  const autoSaveTimerRef = useRef<number>(0);
  const achievementTimerRef = useRef<number>(0);
  const rafRef = useRef<number>(0);

  const tick = useCallback((timestamp: number) => {
    if (lastTimeRef.current === 0) {
      lastTimeRef.current = timestamp;
    }

    const dt = Math.min((timestamp - lastTimeRef.current) / 1000, 0.1); // Cap at 100ms
    lastTimeRef.current = timestamp;

    if (dt > 0) {
      let newState = processTick(stateRef.current, dt);

      // Check achievements every 2 seconds
      achievementTimerRef.current += dt;
      if (achievementTimerRef.current >= ACHIEVEMENT_CHECK_INTERVAL) {
        achievementTimerRef.current = 0;
        const newAchievements = checkAchievements(newState);
        if (newAchievements.length > 0) {
          newState = {
            ...newState,
            achievements: [
              ...newState.achievements,
              ...newAchievements.map(a => a.id),
            ],
          };
          // Notify UI for popup display
          if (onNewAchievements) {
            onNewAchievements(newAchievements.map(a => ({
              id: a.id,
              name: a.name,
              emoji: a.emoji,
              desc: a.desc,
              bonusDesc: a.bonusDesc,
            })));
          }
        }
      }

      // Auto-save every 30 seconds
      autoSaveTimerRef.current += dt;
      if (autoSaveTimerRef.current >= AUTO_SAVE_INTERVAL) {
        autoSaveTimerRef.current = 0;
        saveGame(newState);
      }

      stateRef.current = newState;
      setState(newState);
    }

    rafRef.current = requestAnimationFrame(tick);
  }, [stateRef, setState, onNewAchievements]);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [tick]);
}

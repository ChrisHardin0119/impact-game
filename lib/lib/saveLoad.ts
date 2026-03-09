import { GameState } from './types';
import { defaultGameState } from './prestige';
import { processTick } from './gameEngine';

const SAVE_KEY = 'impact_v2_save';
const SAVE_VERSION = 1;

export function saveGame(state: GameState): void {
  try {
    const saveData = { ...state, lastSaveTime: Date.now(), version: SAVE_VERSION };
    localStorage.setItem(SAVE_KEY, JSON.stringify(saveData));
  } catch (e) {
    console.error('Failed to save:', e);
  }
}

export function loadGame(): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Merge with defaults to handle missing fields from older saves
    const defaults = defaultGameState();
    const migrated: GameState = {
      ...defaults,
      ...parsed,
      // Ensure nested objects are properly merged (not overwritten by old save)
      boosts: {
        ...defaults.boosts,
        ...(parsed.boosts || {}),
        productionBoost: {
          ...defaults.boosts.productionBoost,
          ...(parsed.boosts?.productionBoost || {}),
        },
        prestigeDouble: {
          ...defaults.boosts.prestigeDouble,
          ...(parsed.boosts?.prestigeDouble || {}),
        },
        massDrop: {
          ...defaults.boosts.massDrop,
          ...(parsed.boosts?.massDrop || {}),
        },
      },
      // Ensure orbital mechanic fields exist (migration from pre-v10 saves)
      omCooldowns: parsed.omCooldowns || defaults.omCooldowns,
      omActive: parsed.omActive || defaults.omActive,
      omToggles: parsed.omToggles || defaults.omToggles,
      singularityUsed: parsed.singularityUsed ?? defaults.singularityUsed,
      tutorialCompleted: parsed.tutorialCompleted || defaults.tutorialCompleted,
      tutorialSkipped: parsed.tutorialSkipped ?? defaults.tutorialSkipped,
      adsRemoved: parsed.adsRemoved ?? defaults.adsRemoved,
    };
    return migrated;
  } catch (e) {
    console.error('Failed to load:', e);
    return null;
  }
}

export function calculateOfflineGains(state: GameState): { state: GameState; offlineTime: number } {
  const now = Date.now();
  const offlineMs = now - state.lastSaveTime;
  const offlineSeconds = Math.min(offlineMs / 1000, 3600 * 8); // Cap at 8 hours

  if (offlineSeconds < 5) {
    return { state, offlineTime: 0 };
  }

  // Simulate offline time in 1-second chunks (capped at reasonable amount)
  let newState = { ...state };
  const tickSize = 1; // 1 second per tick
  const ticks = Math.floor(offlineSeconds);

  // For performance, use larger tick sizes for long offline periods
  const effectiveTicks = Math.min(ticks, 3600); // Max 3600 ticks
  const effectiveTickSize = offlineSeconds / effectiveTicks;

  for (let i = 0; i < effectiveTicks; i++) {
    newState = processTick(newState, effectiveTickSize);
  }

  newState.lastSaveTime = now;
  return { state: newState, offlineTime: offlineSeconds };
}

export function exportSave(state: GameState): string {
  try {
    return btoa(JSON.stringify(state));
  } catch {
    return '';
  }
}

export function importSave(encoded: string): GameState | null {
  try {
    const parsed = JSON.parse(atob(encoded));
    // Use same migration logic as loadGame
    const defaults = defaultGameState();
    const migrated: GameState = {
      ...defaults,
      ...parsed,
      boosts: {
        ...defaults.boosts,
        ...(parsed.boosts || {}),
        productionBoost: { ...defaults.boosts.productionBoost, ...(parsed.boosts?.productionBoost || {}) },
        prestigeDouble: { ...defaults.boosts.prestigeDouble, ...(parsed.boosts?.prestigeDouble || {}) },
        massDrop: { ...defaults.boosts.massDrop, ...(parsed.boosts?.massDrop || {}) },
      },
      omCooldowns: parsed.omCooldowns || defaults.omCooldowns,
      omActive: parsed.omActive || defaults.omActive,
      omToggles: parsed.omToggles || defaults.omToggles,
      singularityUsed: parsed.singularityUsed ?? defaults.singularityUsed,
      tutorialCompleted: parsed.tutorialCompleted || defaults.tutorialCompleted,
      tutorialSkipped: parsed.tutorialSkipped ?? defaults.tutorialSkipped,
      adsRemoved: parsed.adsRemoved ?? defaults.adsRemoved,
    };
    return migrated;
  } catch {
    return null;
  }
}

export function hardReset(): void {
  localStorage.removeItem(SAVE_KEY);
}

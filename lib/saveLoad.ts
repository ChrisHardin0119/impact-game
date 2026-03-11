import { GameState } from './types';
import { defaultGameState } from './prestige';

const SAVE_KEY = 'impact_v13_save';

export function saveGame(state: GameState): void {
  try {
    const data = { ...state, lastSaveTime: Date.now() };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch {}
}

export function loadGame(): GameState | null {
  try {
    // Try v13 save first
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const data = JSON.parse(raw) as GameState;
      return migrateState(data);
    }

    // Try to migrate from old v2 save
    const oldRaw = localStorage.getItem('impact_v2_save');
    if (oldRaw) {
      const oldData = JSON.parse(oldRaw);
      return migrateFromV2(oldData);
    }

    return null;
  } catch {
    return null;
  }
}

function migrateState(data: any): GameState {
  const fresh = defaultGameState();
  return {
    ...fresh,
    ...data,
    // Ensure all new fields exist
    metals: data.metals || {},
    densityItems: data.densityItems || {},
    velocityItems: data.velocityItems || {},
    energyUpgrades: data.energyUpgrades || {},
    unlockedTabs: data.unlockedTabs || {},
    shardUpgrades: data.shardUpgrades || {},
    achievements: data.achievements || [],
    activeComets: data.activeComets || [],
    activeBoosts: data.activeBoosts || fresh.activeBoosts,
    converterUseCount: data.converterUseCount || 0,
    tabSwitchCount: data.tabSwitchCount || 0,
    idleStreak: data.idleStreak || 0,
    lastClickTime: data.lastClickTime || 0,
    velocityUnlockReady: data.velocityUnlockReady || false,
    version: 13,
  };
}

// Migrate from old v2 save — keep permanent progress, reset resources
function migrateFromV2(oldData: any): GameState {
  const fresh = defaultGameState();
  return {
    ...fresh,
    // Keep some permanent progress from old save
    lifetimeShards: oldData.lifetimeShards || 0,
    currentShards: oldData.currentShards || 0,
    totalPrestigeCount: oldData.totalPrestigeCount || 0,
    totalMassEarned: oldData.totalMassEarned || 0,
    totalClicks: oldData.totalClicks || 0,
    totalPlayTime: oldData.totalPlayTime || 0,
    cometsCaught: oldData.cometsCaught || 0,
    currentTier: oldData.currentTier || 0,
    devMode: oldData.devMode || false,
    tutorialCompleted: oldData.tutorialCompleted || [],
    tutorialSkipped: oldData.tutorialSkipped || true,
    adsRemoved: oldData.adsRemoved || false,
    version: 13,
  };
}

export function calculateOfflineGains(state: GameState): { state: GameState; offlineTime: number } {
  const now = Date.now();
  const elapsed = Math.min((now - state.lastSaveTime) / 1000, 7200); // max 2 hours
  if (elapsed < 5) return { state, offlineTime: 0 };

  let s = { ...state };
  // Simple offline calculation — grant production * time * 50% efficiency
  const prod = {
    mass: 0, density: 0, velocity: 0, energy: 0,
  };

  // Quick production calc (simplified)
  // We'll just use the raw numbers since importing full production calc is circular
  const massGain = elapsed * 0.5; // placeholder — will be overridden by actual tick
  s.mass += massGain;
  s.runMassEarned += massGain;
  s.totalMassEarned += massGain;

  return { state: s, offlineTime: elapsed };
}

export function hardReset(): void {
  localStorage.removeItem(SAVE_KEY);
  localStorage.removeItem('impact_v2_save');
}

export function exportSave(state: GameState): string {
  try {
    return btoa(JSON.stringify(state));
  } catch {
    return '';
  }
}

export function importSave(code: string): GameState | null {
  try {
    const data = JSON.parse(atob(code));
    return migrateState(data);
  } catch {
    return null;
  }
}

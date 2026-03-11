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

  // Handle migration from v13.0 (had density) to v13.1 (expulsion)
  const migrated = {
    ...fresh,
    ...data,
    // Ensure all new v13.1 fields exist
    metals: data.metals || {},
    velocityItems: data.velocityItems || {},
    energyUpgrades: data.energyUpgrades || {},
    unlockedTabs: data.unlockedTabs || {},
    shardUpgrades: data.shardUpgrades || {},
    achievements: data.achievements || [],
    activeComets: data.activeComets || [],
    activeBoosts: {
      productionDouble: data.activeBoosts?.productionDouble || data.activeBoosts?.velocityDouble || fresh.activeBoosts.productionDouble,
    },
    expulsionCooldown: data.expulsionCooldown || 0,
    nextProductionAdIn: data.nextProductionAdIn || data.nextVelocityAdIn || fresh.nextProductionAdIn,
    nextMassDropAdIn: data.nextMassDropAdIn || fresh.nextMassDropAdIn,
    productionAdAvailable: data.productionAdAvailable || data.velocityAdAvailable || false,
    massDropAdAvailable: data.massDropAdAvailable || false,
    shardAdExpiresIn: data.shardAdExpiresIn || 0,
    productionAdExpiresIn: data.productionAdExpiresIn || 0,
    massDropAdExpiresIn: data.massDropAdExpiresIn || 0,
    totalExpulsions: data.totalExpulsions || 0,
    accumulationUseCount: data.accumulationUseCount || data.converterUseCount || 0,
    tabSwitchCount: data.tabSwitchCount || 0,
    idleStreak: data.idleStreak || 0,
    lastClickTime: data.lastClickTime || 0,
    velocityUnlockReady: data.velocityUnlockReady || false,
    version: 13.1,
  };

  // If they had density tab unlocked, give them expulsion instead
  if (migrated.unlockedTabs['density']) {
    migrated.unlockedTabs['expulsion'] = true;
    delete migrated.unlockedTabs['density'];
  }
  // If they had converter tab, remove it (now part of expulsion)
  delete migrated.unlockedTabs['converter'];
  delete migrated.unlockedTabs['accumulation'];

  // Remove old density-related fields
  delete (migrated as any).density;
  delete (migrated as any).densityItems;
  delete (migrated as any).converterUseCount;

  // If active tab was density/converter/accumulation, redirect to expulsion
  if (migrated.activeTab === 'density' || migrated.activeTab === 'converter' || migrated.activeTab === 'accumulation') {
    migrated.activeTab = 'expulsion';
  }

  return migrated;
}

// Migrate from old v2 save — keep permanent progress, reset resources
function migrateFromV2(oldData: any): GameState {
  const fresh = defaultGameState();
  return {
    ...fresh,
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
    version: 13.1,
  };
}

export function calculateOfflineGains(state: GameState): { state: GameState; offlineTime: number } {
  const now = Date.now();
  const elapsed = Math.min((now - state.lastSaveTime) / 1000, 7200); // max 2 hours
  if (elapsed < 5) return { state, offlineTime: 0 };

  let s = { ...state };
  // Simple offline: grant a placeholder amount (actual tick will handle real production)
  const massGain = elapsed * 0.5;
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

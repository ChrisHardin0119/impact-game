import { GameState, PrestigeTier, PrestigeTierDef } from './types';

export const PRESTIGE_TIERS: Record<number, PrestigeTierDef> = {
  0: { tier: 0, name: 'Rock', emoji: '🪨', shardReq: 0, unlockDesc: 'Starting form' },
  1: { tier: 1, name: 'Asteroid', emoji: '☄️', shardReq: 100, unlockDesc: 'A proper space rock' },
  2: { tier: 2, name: 'Moon', emoji: '🌙', shardReq: 1000, unlockDesc: 'Gravitationally rounded' },
  3: { tier: 3, name: 'Planet', emoji: '🌍', shardReq: 10000, unlockDesc: 'Cleared its orbit' },
  4: { tier: 4, name: 'Star', emoji: '⭐', shardReq: 100000, unlockDesc: 'Nuclear fusion ignited' },
  5: { tier: 5, name: 'Black Hole', emoji: '🕳️', shardReq: 1000000, unlockDesc: 'Infinite density' },
};

export function defaultGameState(): GameState {
  return {
    mass: 0,
    velocity: 0,
    energy: 0,
    metals: {},
    velocityItems: {},
    energyUpgrades: {},
    unlockedTabs: {},
    shardUpgrades: {},
    currentShards: 0,
    lifetimeShards: 0,
    totalPrestigeCount: 0,
    currentTier: 0,
    achievements: [],
    composition: null,
    expulsionCooldown: 0,
    totalExpulsions: 0,
    runMassEarned: 0,
    totalMassEarned: 0,
    highestMass: 0,
    totalClicks: 0,
    totalPlayTime: 0,
    runTime: 0,
    cometsCaught: 0,
    accumulationUseCount: 0,
    tabSwitchCount: 0,
    activeComets: [],
    nextCometIn: 60 + Math.random() * 60,
    activeTab: 'metals',
    buyMode: 1,
    activeBoosts: {
      productionDouble: { active: false, endsAt: 0 },
    },
    nextShardAdIn: 600 + Math.random() * 600,
    nextProductionAdIn: 900 + Math.random() * 900,
    nextMassDropAdIn: 300 + Math.random() * 300,
    shardAdAvailable: false,
    productionAdAvailable: false,
    massDropAdAvailable: false,
    devMode: false,
    tutorialCompleted: [],
    tutorialSkipped: false,
    velocityUnlockReady: false,
    fastestPrestige: Infinity,
    maxComboReached: 0,
    lastClickTime: 0,
    idleStreak: 0,
    adsRemoved: false,
    lastSaveTime: Date.now(),
    version: 13.1,
  };
}

export function canPrestige(state: GameState): boolean {
  return state.runMassEarned >= 10000;
}

export function calcShards(runMassEarned: number, tier: PrestigeTier, bonusMult: number = 1): number {
  if (runMassEarned < 10000) return 0;
  const base = Math.floor(Math.pow(runMassEarned / 1000, 0.45));
  const tierBonus = 1 + tier * 0.15;
  return Math.max(1, Math.floor(base * tierBonus * bonusMult));
}

export function getPrestigeResetState(state: GameState): GameState {
  const fresh = defaultGameState();

  // If velocityUnlockReady was set, unlock the velocity tab on this Impact
  const newUnlockedTabs = { ...state.unlockedTabs };
  if (state.velocityUnlockReady) {
    newUnlockedTabs['velocity'] = true;
  }

  return {
    ...fresh,
    unlockedTabs: newUnlockedTabs,
    shardUpgrades: { ...state.shardUpgrades },
    currentShards: state.currentShards,
    lifetimeShards: state.lifetimeShards,
    totalPrestigeCount: state.totalPrestigeCount + 1,
    currentTier: state.currentTier,
    achievements: [...state.achievements],
    composition: null,
    totalMassEarned: state.totalMassEarned,
    highestMass: Math.max(state.highestMass, state.mass),
    totalClicks: state.totalClicks,
    totalPlayTime: state.totalPlayTime,
    cometsCaught: state.cometsCaught,
    accumulationUseCount: state.accumulationUseCount,
    totalExpulsions: state.totalExpulsions,
    tabSwitchCount: 0,
    velocityUnlockReady: false,
    fastestPrestige: state.fastestPrestige,
    maxComboReached: state.maxComboReached,
    devMode: state.devMode,
    tutorialCompleted: state.tutorialCompleted,
    tutorialSkipped: state.tutorialSkipped,
    adsRemoved: state.adsRemoved,
    activeTab: state.velocityUnlockReady ? 'velocity' : 'metals',
    version: 13.1,
  };
}

import { PrestigeTierDef, PrestigeTier, GameState } from './types';

export const PRESTIGE_TIERS: PrestigeTierDef[] = [
  {
    tier: 0,
    name: 'Rock',
    emoji: '🪨',
    shardReq: 0,
    unlockDesc: 'Starting state. A humble beginning.',
  },
  {
    tier: 1,
    name: 'Asteroid',
    emoji: '🪨',
    shardReq: 100,
    unlockDesc: 'Unlocks Silicate, Iron, Ice, and Carbonaceous compositions.',
  },
  {
    tier: 2,
    name: 'Moon',
    emoji: '🌙',
    shardReq: 1000,
    unlockDesc: 'Unlocks advanced Orbital Mechanics and Resonant processes.',
  },
  {
    tier: 3,
    name: 'Planet',
    emoji: '🌍',
    shardReq: 10000,
    unlockDesc: 'Unlocks Binary composition and powerful new upgrades.',
  },
  {
    tier: 4,
    name: 'Star',
    emoji: '⭐',
    shardReq: 100000,
    unlockDesc: 'Unlocks Stellar Harvester process. True cosmic power.',
  },
  {
    tier: 5,
    name: 'Black Hole',
    emoji: '🌑',
    shardReq: 1000000,
    unlockDesc: 'Unlocks Neutron composition. Incomprehensible density.',
  },
];

/**
 * Calculate shards earned from a prestige run
 * Formula: floor(sqrt(massEarned / 1e6)) * (1 + tier * 0.3) * shardBoostMultiplier
 */
export function calcShards(massEarned: number, tier: PrestigeTier, shardBoostMultiplier: number = 1): number {
  const baseShards = Math.floor(Math.sqrt(massEarned / 1000000));
  const tierBonus = 1 + tier * 0.3;
  return Math.floor(baseShards * tierBonus * shardBoostMultiplier);
}

/**
 * Check if the player can prestige (has at least 1 shard potential)
 */
export function canPrestige(state: GameState): boolean {
  const potentialShards = Math.floor(Math.sqrt(state.runMassEarned / 1000000));
  return potentialShards >= 1;
}

/**
 * Get current progress toward next tier
 * Returns: { currentTier, nextTier, progress: 0-1 }
 */
export function getCurrentTierProgress(
  state: GameState
): {
  currentTier: PrestigeTierDef;
  nextTier: PrestigeTierDef | null;
  progress: number;
} {
  const current = PRESTIGE_TIERS[state.currentTier];
  const next = state.currentTier < 5 ? PRESTIGE_TIERS[state.currentTier + 1] : null;

  let progress = 0;
  if (next) {
    const prevReq = current.shardReq;
    const nextReq = next.shardReq;
    const range = nextReq - prevReq;
    const earned = state.lifetimeShards - prevReq;
    progress = Math.min(1, Math.max(0, earned / range));
  } else {
    progress = 1; // At max tier
  }

  return { currentTier: current, nextTier: next, progress };
}

/**
 * Create a fresh game state after prestige, keeping permanent bonuses
 */
export function getPrestigeResetState(state: GameState): GameState {
  return {
    // Resources reset
    mass: 0,
    gravity: 0,
    density: 0,
    energy: 100,
    maxEnergy: 100,
    energyRegen: 1,

    // Composition reset
    composition: null,

    // Processes reset
    processes: {},

    // Orbital mechanics reset
    omCooldowns: {},
    omActive: {},
    singularityUsed: false,

    // Core upgrades PERSIST (permanently unlocked)
    coreUpgrades: { ...state.coreUpgrades },

    // Discoveries PERSIST
    discoveries: [...state.discoveries],

    // Prestige counters
    currentTier: state.currentTier,
    lifetimeShards: state.lifetimeShards,
    currentShards: state.currentShards,
    totalPrestigeCount: state.totalPrestigeCount + 1,

    // Stats reset for new run
    totalMassEarned: state.totalMassEarned + state.runMassEarned,
    runMassEarned: 0,
    totalClicks: state.totalClicks,
    runTime: 0,
    totalPlayTime: state.totalPlayTime,
    highestMass: Math.max(state.highestMass, state.mass),
    cometsCaught: state.cometsCaught,

    // Comet system reset
    nextCometIn: 0,

    // Charged building reset
    chargedProcess: null,
    chargeCooldown: 0,

    // Tutorial persists
    tutorialCompleted: [...state.tutorialCompleted],
    tutorialSkipped: state.tutorialSkipped,

    // Ads & Boosts persist (but prestige double may be consumed)
    adsRemoved: state.adsRemoved,
    boosts: {
      productionBoost: { active: false, endsAt: 0 },
      prestigeDouble: { active: false, usedThisRun: false },
      massDrop: { lastUsed: 0 },
    },

    // UI
    activeTab: 'build',
    buyMode: 1,

    // Meta
    lastSaveTime: Date.now(),
    version: state.version,
  };
}

/**
 * Get a prestige tier by number
 */
export function getPrestigeTier(tier: PrestigeTier): PrestigeTierDef {
  const t = PRESTIGE_TIERS.find((p) => p.tier === tier);
  if (!t) {
    throw new Error(`Unknown prestige tier: ${tier}`);
  }
  return t;
}

/**
 * Check if a tier is unlocked given current lifetime shards
 */
export function isTierUnlocked(tier: PrestigeTier, lifetimeShards: number): boolean {
  const tierDef = PRESTIGE_TIERS[tier];
  return lifetimeShards >= tierDef.shardReq;
}

/**
 * Get the highest tier a player has unlocked
 */
export function getHighestUnlockedTier(lifetimeShards: number): PrestigeTier {
  let highest: PrestigeTier = 0;
  for (let i = 5; i >= 0; i--) {
    if (isTierUnlocked(i as PrestigeTier, lifetimeShards)) {
      highest = i as PrestigeTier;
      break;
    }
  }
  return highest;
}

/**
 * Create the default initial game state
 */
export function defaultGameState(): GameState {
  return {
    // Resources
    mass: 0,
    gravity: 0,
    density: 0,
    energy: 100,
    maxEnergy: 100,
    energyRegen: 1,

    // Composition
    composition: null,

    // Processes
    processes: {},

    // Orbital mechanics
    omCooldowns: {},
    omActive: {},
    singularityUsed: false,

    // Core upgrades
    coreUpgrades: {},

    // Discoveries
    discoveries: [],

    // Prestige
    currentTier: 0,
    lifetimeShards: 0,
    currentShards: 0,
    totalPrestigeCount: 0,

    // Stats
    totalMassEarned: 0,
    totalClicks: 0,
    runMassEarned: 0,
    runTime: 0,
    totalPlayTime: 0,
    highestMass: 0,
    cometsCaught: 0,

    // Comet system
    nextCometIn: 0,

    // Charged buildings
    chargedProcess: null,
    chargeCooldown: 0,

    // Tutorial
    tutorialCompleted: [],
    tutorialSkipped: false,

    // Ads & Boosts
    adsRemoved: false,
    boosts: {
      productionBoost: { active: false, endsAt: 0 },
      prestigeDouble: { active: false, usedThisRun: false },
      massDrop: { lastUsed: 0 },
    },

    // UI
    activeTab: 'build',
    buyMode: 1,

    // Meta
    lastSaveTime: Date.now(),
    version: 1,
  };
}

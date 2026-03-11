import { CoreUpgradeDef, GameState } from './types';

export const CORE_UPGRADES: CoreUpgradeDef[] = [
  // ==================== FOUNDATION ====================
  {
    id: 'mass_boost',
    name: 'Mass Boost',
    emoji: '📈',
    desc: 'Permanently increase mass production by 25% per level.',
    path: 'foundation',
    cost: 5,
    maxLevel: 5,
    requires: [],
    unlockTier: 0,
  },
  {
    id: 'gravity_boost',
    name: 'Gravity Boost',
    emoji: '🌍',
    desc: 'Permanently increase gravity generation by 25% per level.',
    path: 'foundation',
    cost: 5,
    maxLevel: 5,
    requires: [],
    unlockTier: 0,
  },
  {
    id: 'shard_boost',
    name: 'Shard Boost',
    emoji: '💎',
    desc: 'Increase shard generation by 15% per level during prestige.',
    path: 'foundation',
    cost: 10,
    maxLevel: 5,
    requires: [],
    unlockTier: 0,
  },
  {
    id: 'energy_regen',
    name: 'Energy Regeneration',
    emoji: '⚡',
    desc: 'Regenerate 1 energy per second per level. Base energy is 100.',
    path: 'foundation',
    cost: 8,
    maxLevel: 5,
    requires: [],
    unlockTier: 0,
  },
  {
    id: 'process_efficiency',
    name: 'Process Efficiency',
    emoji: '⚙️',
    desc: 'All processes produce 10% more per level.',
    path: 'foundation',
    cost: 15,
    maxLevel: 5,
    requires: [],
    unlockTier: 0,
  },

  // ==================== SYNERGY PATH ====================
  {
    id: 'synergy_amplify',
    name: 'Synergy Amplification',
    emoji: '🔗',
    desc: 'Increase synergy bonuses by 50% per level.',
    path: 'synergy',
    cost: 100,
    maxLevel: 3,
    requires: ['mass_boost', 'process_efficiency'],
    unlockTier: 1,
  },
  {
    id: 'synergy_cascade',
    name: 'Synergy Cascade',
    emoji: '🌊',
    desc: 'Synergy chains now grant double bonuses instead of single. One-time upgrade.',
    path: 'synergy',
    cost: 300,
    maxLevel: 1,
    requires: ['synergy_amplify'],
    unlockTier: 1,
  },
  {
    id: 'harmonic_resonance',
    name: 'Harmonic Resonance',
    emoji: '♪',
    desc: 'Synergies from different process categories stack at 1.5x multiplier instead of additive.',
    path: 'synergy',
    cost: 500,
    maxLevel: 1,
    requires: ['synergy_amplify', 'synergy_cascade'],
    unlockTier: 2,
  },

  // ==================== DENSITY PATH ====================
  {
    id: 'compression_efficiency',
    name: 'Compression Efficiency',
    emoji: '🔨',
    desc: 'Increase density gains by 50% per level.',
    path: 'density',
    cost: 100,
    maxLevel: 3,
    requires: ['gravity_boost'],
    unlockTier: 1,
  },
  {
    id: 'stable_states',
    name: 'Stable States',
    emoji: '🔒',
    desc: 'Reduce density decay by 50%. Density stays with you longer.',
    path: 'density',
    cost: 250,
    maxLevel: 1,
    requires: ['compression_efficiency'],
    unlockTier: 1,
  },
  {
    id: 'density_overclock',
    name: 'Density Overclock',
    emoji: '💪',
    desc: '25% of current density acts as a bonus mass multiplier per level.',
    path: 'density',
    cost: 400,
    maxLevel: 1,
    requires: ['compression_efficiency', 'stable_states'],
    unlockTier: 2,
  },

  // ==================== COMET PATH ====================
  {
    id: 'comet_magnet',
    name: 'Comet Magnet',
    emoji: '☄️',
    desc: 'Auto-capture 20% of missed comets per level. At max level (5), all comets are auto-captured.',
    path: 'foundation',
    cost: 15,
    maxLevel: 5,
    requires: [],
    unlockTier: 0,
  },
  {
    id: 'comet_offline',
    name: 'Offline Comets',
    emoji: '🌙',
    desc: 'While offline, auto-capture 20% of spawned comets per level. Max 100% at level 5.',
    path: 'foundation',
    cost: 25,
    maxLevel: 5,
    requires: ['comet_magnet'],
    unlockTier: 1,
  },

  // ==================== ENERGY PATH ====================
  {
    id: 'energy_capacity',
    name: 'Energy Capacity',
    emoji: '🔋',
    desc: 'Increase max energy by 50 per level.',
    path: 'energy',
    cost: 80,
    maxLevel: 3,
    requires: ['energy_regen'],
    unlockTier: 0,
  },
  {
    id: 'kinetic_resonance',
    name: 'Kinetic Resonance',
    emoji: '⚡',
    desc: 'Energy regeneration is increased by 50%.',
    path: 'energy',
    cost: 200,
    maxLevel: 1,
    requires: ['energy_regen', 'energy_capacity'],
    unlockTier: 1,
  },
  {
    id: 'energy_overflow',
    name: 'Energy Overflow',
    emoji: '💥',
    desc: 'Excess energy converts to mass at a 1:1000 ratio (1 energy = 1000 mass).',
    path: 'energy',
    cost: 350,
    maxLevel: 1,
    requires: ['energy_capacity', 'kinetic_resonance'],
    unlockTier: 2,
  },
];

/**
 * Calculate the cost in shards for a given upgrade level
 * Each level increases exponentially
 */
export function getUpgradeCost(def: CoreUpgradeDef, currentLevel: number): number {
  if (currentLevel >= def.maxLevel) {
    return Infinity;
  }
  return Math.floor(def.cost * Math.pow(1.5, currentLevel));
}

/**
 * Check if an upgrade can be purchased given the current state
 */
export function canPurchaseUpgrade(def: CoreUpgradeDef, state: GameState): boolean {
  const currentLevel = state.coreUpgrades[def.id] || 0;

  // Check max level
  if (currentLevel >= def.maxLevel) {
    return false;
  }

  // Check shard cost
  if (state.currentShards < getUpgradeCost(def, currentLevel)) {
    return false;
  }

  // Check tier unlock
  if (state.currentTier < def.unlockTier) {
    return false;
  }

  // Check prerequisites
  for (const prereqId of def.requires) {
    if (!state.coreUpgrades[prereqId] || state.coreUpgrades[prereqId] === 0) {
      return false;
    }
  }

  return true;
}

/**
 * Get the effective bonus multiplier from an upgrade at a given level
 * Used to apply upgrade effects in the game engine
 */
export function getUpgradeEffect(id: string, level: number): number {
  if (level <= 0) return 1;

  switch (id) {
    case 'mass_boost':
      return 1 + level * 0.25;
    case 'gravity_boost':
      return 1 + level * 0.25;
    case 'shard_boost':
      return 1 + level * 0.15;
    case 'energy_regen':
      return level; // +1 per sec per level (handled differently)
    case 'process_efficiency':
      return 1 + level * 0.1;
    case 'synergy_amplify':
      return 1 + level * 0.5;
    case 'synergy_cascade':
      return 2; // double bonus
    case 'harmonic_resonance':
      return 1.5; // stack multiplier
    case 'compression_efficiency':
      return 1 + level * 0.5;
    case 'stable_states':
      return 0.5; // reduce decay by 50%
    case 'density_overclock':
      return 0.25; // 25% of density as mass mult
    case 'comet_magnet':
      return level * 0.2; // 20% per level
    case 'comet_offline':
      return level * 0.2; // 20% per level
    case 'energy_capacity':
      return level * 50; // +50 per level
    case 'kinetic_resonance':
      return 1.5; // 50% increase
    case 'energy_overflow':
      return 1000; // 1 energy = 1000 mass
    default:
      return 1;
  }
}

/**
 * Get a specific upgrade by ID
 */
export function getUpgrade(id: string): CoreUpgradeDef | undefined {
  return CORE_UPGRADES.find((u) => u.id === id);
}

/**
 * Get all upgrades in a specific path
 */
export function getUpgradesByPath(path: 'foundation' | 'synergy' | 'density' | 'energy'): CoreUpgradeDef[] {
  return CORE_UPGRADES.filter((u) => u.path === path);
}

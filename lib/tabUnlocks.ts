import { TabUnlockDef, ShardUpgradeDef, TabName } from './types';

// === TAB UNLOCK DEFINITIONS ===
// Each requires a certain number of Impacts + shard cost
// Designed so each takes ~30 min of gameplay to unlock
export const TAB_UNLOCKS: TabUnlockDef[] = [
  {
    tabId: 'density',
    name: 'Density Compression',
    emoji: '🧊',
    desc: 'Unlock the Density tab. Spend density to earn velocity.',
    shardCost: 50,
    requiresPrestige: 1,
  },
  {
    tabId: 'velocity',
    name: 'Velocity Research',
    emoji: '💨',
    desc: 'Reach 50 velocity, then unlock through your next Impact.',
    shardCost: 0, // No shard cost — uses velocity threshold instead
    requiresPrestige: 1, // Must have done at least 1 Impact (to have density tab)
    velocityThreshold: 50, // Must reach 50 velocity
    unlockViaImpact: true, // Unlocks after next Impact once threshold met
  },
  {
    tabId: 'converter',
    name: 'Resource Converter',
    emoji: '🔄',
    desc: 'Unlock the Converter tab. Trade resources between types.',
    shardCost: 500,
    requiresPrestige: 5,
  },
  {
    tabId: 'energy',
    name: 'Energy Mastery',
    emoji: '⚡',
    desc: 'Unlock the Energy tab. Premium upgrades and auto-purchase.',
    shardCost: 1000,
    requiresPrestige: 8,
  },
];

export function getTabUnlockDef(tabId: TabName): TabUnlockDef | undefined {
  return TAB_UNLOCKS.find(t => t.tabId === tabId);
}

export function isTabUnlocked(tabId: TabName, unlockedTabs: Record<string, boolean>): boolean {
  // Always-available tabs
  if (tabId === 'metals' || tabId === 'impact' || tabId === 'achievements' || tabId === 'stats' || tabId === 'dev') return true;
  return unlockedTabs[tabId] || false;
}

// === SHARD UPGRADES (permanent, small bonuses) ===
export const SHARD_UPGRADES: ShardUpgradeDef[] = [
  {
    id: 'shard_mass_boost',
    name: 'Mass Amplifier',
    emoji: '🪨',
    desc: 'Permanently increase mass production.',
    baseCost: 15,
    costScale: 1.5,
    maxLevel: 20,
    effect: '+2% mass production per level',
  },
  {
    id: 'shard_click_boost',
    name: 'Impact Force',
    emoji: '👆',
    desc: 'Permanently increase click power.',
    baseCost: 20,
    costScale: 1.6,
    maxLevel: 15,
    effect: '+3% click power per level',
  },
  {
    id: 'shard_density_boost',
    name: 'Compression Matrix',
    emoji: '🧊',
    desc: 'Permanently increase density production.',
    baseCost: 30,
    costScale: 1.5,
    maxLevel: 15,
    effect: '+2% density production per level',
  },
  {
    id: 'shard_velocity_boost',
    name: 'Momentum Drive',
    emoji: '💨',
    desc: 'Permanently increase velocity production.',
    baseCost: 50,
    costScale: 1.5,
    maxLevel: 10,
    effect: '+3% velocity production per level',
  },
  {
    id: 'shard_comet_boost',
    name: 'Comet Attractor',
    emoji: '☄️',
    desc: 'Comets give more mass.',
    baseCost: 25,
    costScale: 1.8,
    maxLevel: 10,
    effect: '+5% comet value per level',
  },
];

export function getShardUpgradeCost(def: ShardUpgradeDef, level: number): number {
  return Math.floor(def.baseCost * Math.pow(def.costScale, level));
}

// Get shard upgrade multipliers
export function getShardEffects(shardUpgrades: Record<string, number>): {
  massMult: number;
  clickMult: number;
  densityMult: number;
  velocityMult: number;
  cometMult: number;
} {
  const u = shardUpgrades || {};
  return {
    massMult: 1 + (u['shard_mass_boost'] || 0) * 0.02,
    clickMult: 1 + (u['shard_click_boost'] || 0) * 0.03,
    densityMult: 1 + (u['shard_density_boost'] || 0) * 0.02,
    velocityMult: 1 + (u['shard_velocity_boost'] || 0) * 0.03,
    cometMult: 1 + (u['shard_comet_boost'] || 0) * 0.05,
  };
}

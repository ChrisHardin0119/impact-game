import { TabUnlockDef, ShardUpgradeDef, TabName } from './types';

// === TAB UNLOCK DEFINITIONS ===
// Each requires a certain number of Impacts + shard cost
export const TAB_UNLOCKS: TabUnlockDef[] = [
  {
    tabId: 'expulsion',
    name: 'Mass Expulsion',
    emoji: '💨',
    desc: 'Unlock the Expulsion tab. Jettison mass for velocity, or sacrifice velocity for mass.',
    shardCost: 50,
    requiresPrestige: 1,
  },
  {
    tabId: 'velocity',
    name: 'Velocity Research',
    emoji: '🚀',
    desc: 'Reach 50 velocity, then unlock through your next Impact.',
    shardCost: 0, // No shard cost — uses velocity threshold instead
    requiresPrestige: 1, // Must have done at least 1 Impact
    velocityThreshold: 50, // Must reach 50 velocity
    unlockViaImpact: true, // Unlocks after next Impact once threshold met
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
    id: 'shard_expulsion_boost',
    name: 'Expulsion Efficiency',
    emoji: '💥',
    desc: 'Permanently improve mass-to-velocity expulsion rate.',
    baseCost: 30,
    costScale: 1.5,
    maxLevel: 15,
    effect: '+15% expulsion rate per level',
  },
  {
    id: 'shard_accumulation_boost',
    name: 'Accumulation Efficiency',
    emoji: '🔄',
    desc: 'Permanently improve velocity-to-mass accumulation rate.',
    baseCost: 40,
    costScale: 1.5,
    maxLevel: 15,
    effect: '+10% accumulation rate per level',
  },
  {
    id: 'shard_velocity_boost',
    name: 'Momentum Drive',
    emoji: '🚀',
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
  velocityMult: number;
  cometMult: number;
  expulsionMult: number;
  accumulationMult: number;
} {
  const u = shardUpgrades || {};
  return {
    massMult: 1 + (u['shard_mass_boost'] || 0) * 0.02,
    clickMult: 1 + (u['shard_click_boost'] || 0) * 0.03,
    velocityMult: 1 + (u['shard_velocity_boost'] || 0) * 0.03,
    cometMult: 1 + (u['shard_comet_boost'] || 0) * 0.05,
    expulsionMult: 1 + (u['shard_expulsion_boost'] || 0) * 0.15,
    accumulationMult: 1 + (u['shard_accumulation_boost'] || 0) * 0.10,
  };
}

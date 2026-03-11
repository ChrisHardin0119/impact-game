import { GameState } from './types';

export interface ForgeDef {
  id: string;
  name: string;
  emoji: string;
  desc: string;
  resource: 'gravity' | 'density'; // what you spend
  baseCost: number; // base amount of resource to spend
  costScale: number; // multiplicative scaling per level
  maxLevel: number;
  effect: string; // human-readable effect description
  unlockTier: number; // prestige tier required
}

export const FORGE_RECIPES: ForgeDef[] = [
  // ===== GRAVITY FORGES — spend gravity for mass/production bonuses =====
  {
    id: 'mass_catalyst',
    name: 'Mass Catalyst',
    emoji: '⚗️',
    desc: 'Forge gravity into a permanent mass production bonus.',
    resource: 'gravity',
    baseCost: 50,
    costScale: 1.4,
    maxLevel: 10,
    effect: '+10% mass production per level',
    unlockTier: 0,
  },
  {
    id: 'click_amplifier',
    name: 'Click Amplifier',
    emoji: '👆',
    desc: 'Forge gravity into permanent click power.',
    resource: 'gravity',
    baseCost: 80,
    costScale: 1.5,
    maxLevel: 5,
    effect: '+20% click value per level',
    unlockTier: 0,
  },
  {
    id: 'energy_conduit',
    name: 'Energy Conduit',
    emoji: '🔌',
    desc: 'Forge gravity into permanent energy regen.',
    resource: 'gravity',
    baseCost: 100,
    costScale: 1.6,
    maxLevel: 5,
    effect: '+0.5 energy regen per level',
    unlockTier: 1,
  },

  // ===== DENSITY FORGES — spend density for shard/prestige bonuses =====
  {
    id: 'shard_refiner',
    name: 'Shard Refiner',
    emoji: '💎',
    desc: 'Forge density into a permanent shard bonus on prestige.',
    resource: 'density',
    baseCost: 20,
    costScale: 1.3,
    maxLevel: 10,
    effect: '+8% shard generation per level',
    unlockTier: 0,
  },
  {
    id: 'gravity_anchor',
    name: 'Gravity Anchor',
    emoji: '⚓',
    desc: 'Forge density to permanently reduce gravity decay from orbital mechanics.',
    resource: 'density',
    baseCost: 30,
    costScale: 1.4,
    maxLevel: 5,
    effect: 'Gravity decays 10% slower per level',
    unlockTier: 0,
  },
  {
    id: 'density_recycler',
    name: 'Density Recycler',
    emoji: '♻️',
    desc: 'Forge density to permanently reduce density decay rate.',
    resource: 'density',
    baseCost: 40,
    costScale: 1.5,
    maxLevel: 5,
    effect: 'Density decays 15% slower per level',
    unlockTier: 1,
  },
];

/**
 * Get the cost of the next forge level.
 */
export function getForgeCost(def: ForgeDef, currentLevel: number): number {
  return Math.floor(def.baseCost * Math.pow(def.costScale, currentLevel));
}

/**
 * Check if a forge can be purchased.
 */
export function canForge(def: ForgeDef, state: GameState): boolean {
  const level = state.forgeLevels[def.id] || 0;
  if (level >= def.maxLevel) return false;
  if (state.currentTier < def.unlockTier) return false;
  const cost = getForgeCost(def, level);
  if (def.resource === 'gravity') return state.gravity >= cost;
  if (def.resource === 'density') return state.density >= cost;
  return false;
}

/**
 * Purchase a forge upgrade — spends the resource.
 */
export function purchaseForge(def: ForgeDef, state: GameState): GameState | null {
  if (!canForge(def, state)) return null;
  const level = state.forgeLevels[def.id] || 0;
  const cost = getForgeCost(def, level);

  let newState = {
    ...state,
    forgeLevels: { ...state.forgeLevels, [def.id]: level + 1 },
  };

  if (def.resource === 'gravity') {
    newState.gravity = Math.max(0, state.gravity - cost);
  } else if (def.resource === 'density') {
    newState.density = Math.max(0, state.density - cost);
  }

  return newState;
}

/**
 * Get forge effect multipliers for use in game engine.
 */
export function getForgeEffects(state: GameState): {
  massMult: number;
  clickMult: number;
  energyRegen: number;
  shardMult: number;
  gravityDecayReduction: number;
  densityDecayReduction: number;
} {
  const levels = state.forgeLevels || {};
  return {
    massMult: 1 + (levels['mass_catalyst'] || 0) * 0.10,
    clickMult: 1 + (levels['click_amplifier'] || 0) * 0.20,
    energyRegen: (levels['energy_conduit'] || 0) * 0.5,
    shardMult: 1 + (levels['shard_refiner'] || 0) * 0.08,
    gravityDecayReduction: 1 - (levels['gravity_anchor'] || 0) * 0.10,
    densityDecayReduction: 1 - (levels['density_recycler'] || 0) * 0.15,
  };
}

/**
 * Get unlocked forge recipes for the current tier.
 */
export function getUnlockedForges(tier: number): ForgeDef[] {
  return FORGE_RECIPES.filter(f => f.unlockTier <= tier);
}

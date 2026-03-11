import { EnergyUpgradeDef, GameState } from './types';

export const ENERGY_UPGRADES: EnergyUpgradeDef[] = [
  // === AUTO-PURCHASE TOGGLES (level 1 = on/off) ===
  {
    id: 'auto_mine',
    name: 'Auto-Mine Metals',
    emoji: '⛏️',
    desc: 'Automatically purchases the cheapest affordable metal deposit.',
    baseCost: 100,
    costScale: 1,
    maxLevel: 1,
    isToggle: true,
    effect: 'Auto-buys metals when affordable',
  },
  {
    id: 'auto_compress',
    name: 'Auto-Compress',
    emoji: '🗜️',
    desc: 'Automatically purchases the cheapest affordable density item.',
    baseCost: 500,
    costScale: 1,
    maxLevel: 1,
    isToggle: true,
    effect: 'Auto-buys density items when affordable',
  },
  {
    id: 'auto_accelerate',
    name: 'Auto-Accelerate',
    emoji: '🚀',
    desc: 'Automatically purchases the cheapest affordable velocity item.',
    baseCost: 2000,
    costScale: 1,
    maxLevel: 1,
    isToggle: true,
    effect: 'Auto-buys velocity items when affordable',
  },

  // === INCREMENTAL UPGRADES ===
  {
    id: 'mass_efficiency',
    name: 'Mass Efficiency',
    emoji: '⚗️',
    desc: 'Metals produce more mass per second.',
    baseCost: 50,
    costScale: 1.8,
    maxLevel: 20,
    isToggle: false,
    effect: '+3% mass production per level',
  },
  {
    id: 'density_efficiency',
    name: 'Density Efficiency',
    emoji: '🧊',
    desc: 'Metals produce more density per second.',
    baseCost: 80,
    costScale: 1.8,
    maxLevel: 20,
    isToggle: false,
    effect: '+3% density production per level',
  },
  {
    id: 'velocity_efficiency',
    name: 'Velocity Efficiency',
    emoji: '💨',
    desc: 'Density items produce more velocity per second.',
    baseCost: 200,
    costScale: 1.8,
    maxLevel: 20,
    isToggle: false,
    effect: '+3% velocity production per level',
  },
  {
    id: 'energy_efficiency',
    name: 'Energy Efficiency',
    emoji: '⚡',
    desc: 'Velocity items produce more energy per second.',
    baseCost: 500,
    costScale: 1.8,
    maxLevel: 20,
    isToggle: false,
    effect: '+3% energy production per level',
  },
  {
    id: 'click_power',
    name: 'Click Power',
    emoji: '👆',
    desc: 'Each click yields more mass.',
    baseCost: 30,
    costScale: 2.0,
    maxLevel: 15,
    isToggle: false,
    effect: '+5% click value per level',
  },
  {
    id: 'comet_magnet',
    name: 'Comet Magnet',
    emoji: '☄️',
    desc: 'Comets appear more frequently.',
    baseCost: 150,
    costScale: 2.5,
    maxLevel: 5,
    isToggle: false,
    effect: '+10% comet frequency per level',
  },
  {
    id: 'impact_bonus',
    name: 'Impact Bonus',
    emoji: '💥',
    desc: 'Earn more shards on each Impact.',
    baseCost: 800,
    costScale: 2.5,
    maxLevel: 5,
    isToggle: false,
    effect: '+5% shard gain per level',
  },
];

export function getEnergyUpgradeCost(def: EnergyUpgradeDef, level: number): number {
  if (def.isToggle) return def.baseCost;
  return Math.floor(def.baseCost * Math.pow(def.costScale, level));
}

export function canBuyEnergyUpgrade(def: EnergyUpgradeDef, state: GameState): boolean {
  const level = state.energyUpgrades[def.id] || 0;
  if (level >= def.maxLevel) return false;
  return state.energy >= getEnergyUpgradeCost(def, level);
}

export function getEnergyUpgradeEffect(id: string, state: GameState): number {
  const level = state.energyUpgrades[id] || 0;
  return level;
}

// Get all efficiency multipliers from energy upgrades
export function getEnergyEffects(state: GameState): {
  massMult: number;
  densityMult: number;
  velocityMult: number;
  energyMult: number;
  clickMult: number;
  cometFreqMult: number;
  shardMult: number;
} {
  const levels = state.energyUpgrades || {};
  return {
    massMult: 1 + (levels['mass_efficiency'] || 0) * 0.03,
    densityMult: 1 + (levels['density_efficiency'] || 0) * 0.03,
    velocityMult: 1 + (levels['velocity_efficiency'] || 0) * 0.03,
    energyMult: 1 + (levels['energy_efficiency'] || 0) * 0.03,
    clickMult: 1 + (levels['click_power'] || 0) * 0.05,
    cometFreqMult: 1 + (levels['comet_magnet'] || 0) * 0.10,
    shardMult: 1 + (levels['impact_bonus'] || 0) * 0.05,
  };
}

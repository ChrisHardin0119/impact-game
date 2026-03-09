import { ProcessDef, ProcessCategory } from './types';

export const PROCESSES: ProcessDef[] = [
  // ==================== ACTIVE ====================
  {
    id: 'dust_collector',
    name: 'Dust Collector',
    emoji: '🪫',
    desc: 'Gathers dust particles to begin your ascent. Scales well with density.',
    category: 'active',
    baseCost: 10,
    costScale: 1.15,
    baseMPS: 0.5,
    gravityPS: 0,
    densityPS: 0,
    synergyTarget: 'meteor_magnet',
    compositionBonus: null,
    unlockCondition: null,
  },
  {
    id: 'meteor_magnet',
    name: 'Meteor Magnet',
    emoji: '🧲',
    desc: 'Attracts meteors with magnetic fields. Scales well with density.',
    category: 'active',
    baseCost: 80,
    costScale: 1.15,
    baseMPS: 2,
    gravityPS: 0,
    densityPS: 0,
    synergyTarget: 'ice_harvester',
    compositionBonus: null,
    unlockCondition: null,
  },
  {
    id: 'ice_harvester',
    name: 'Ice Harvester',
    emoji: '⛸️',
    desc: 'Harvests volatile ice. Scales well with density.',
    category: 'active',
    baseCost: 600,
    costScale: 1.15,
    baseMPS: 12,
    gravityPS: 0,
    densityPS: 0.001,
    synergyTarget: 'dust_collector',
    compositionBonus: null,
    unlockCondition: null,
  },

  // ==================== PASSIVE ====================
  {
    id: 'gravity_well_gen',
    name: 'Gravity Well Generator',
    emoji: '⚫',
    desc: 'Generates localized gravity wells. A stable foundation for growth.',
    category: 'passive',
    baseCost: 5000,
    costScale: 1.15,
    baseMPS: 60,
    gravityPS: 0.1,
    densityPS: 0,
    synergyTarget: 'ore_refinery',
    compositionBonus: null,
    unlockCondition: null,
  },
  {
    id: 'ore_refinery',
    name: 'Ore Refinery',
    emoji: '🏭',
    desc: 'Refines raw materials into valuable resources. Increases gravity output.',
    category: 'passive',
    baseCost: 40000,
    costScale: 1.15,
    baseMPS: 260,
    gravityPS: 0.3,
    densityPS: 0,
    synergyTarget: 'core_compressor',
    compositionBonus: null,
    unlockCondition: null,
  },
  {
    id: 'core_compressor',
    name: 'Core Compressor',
    emoji: '🔨',
    desc: 'Compresses matter at extreme pressure. Generates both mass and density.',
    category: 'passive',
    baseCost: 350000,
    costScale: 1.15,
    baseMPS: 1400,
    gravityPS: 0.5,
    densityPS: 0.005,
    synergyTarget: 'gravity_well_gen',
    compositionBonus: null,
    unlockCondition: null,
  },

  // ==================== RESONANT ====================
  {
    id: 'tidal_amplifier',
    name: 'Tidal Amplifier',
    emoji: '🌊',
    desc: 'Amplifies tidal forces to massive proportions. Benefits from Silicate composition.',
    category: 'resonant',
    baseCost: 3000000,
    costScale: 1.15,
    baseMPS: 7800,
    gravityPS: 2,
    densityPS: 0.01,
    synergyTarget: 'fusion_forge',
    compositionBonus: 'silicate',
    unlockCondition: null,
  },
  {
    id: 'fusion_forge',
    name: 'Fusion Forge',
    emoji: '🔥',
    desc: 'Fuses elements at nuclear temperatures. Benefits from Iron composition.',
    category: 'resonant',
    baseCost: 25000000,
    costScale: 1.15,
    baseMPS: 44000,
    gravityPS: 5,
    densityPS: 0.008,
    synergyTarget: 'ring_constructor',
    compositionBonus: 'iron',
    unlockCondition: null,
  },
  {
    id: 'ring_constructor',
    name: 'Ring Constructor',
    emoji: '💫',
    desc: 'Constructs planetary ring systems. Benefits from Carbonaceous composition.',
    category: 'resonant',
    baseCost: 200000000,
    costScale: 1.15,
    baseMPS: 260000,
    gravityPS: 15,
    densityPS: 0.01,
    synergyTarget: 'tidal_amplifier',
    compositionBonus: 'carbonaceous',
    unlockCondition: null,
  },

  // ==================== EXOTIC ====================
  {
    id: 'stellar_harvester',
    name: 'Stellar Harvester',
    emoji: '🌟',
    desc: 'Harvests energy from stars themselves. Unlocked at Tier 4.',
    category: 'exotic',
    baseCost: 2000000000,
    costScale: 1.15,
    baseMPS: 1500000,
    gravityPS: 50,
    densityPS: 0.02,
    synergyTarget: null,
    compositionBonus: null,
    unlockCondition: { type: 'tier', value: 4 },
  },
];

/**
 * Calculate the cost of a process given how many are owned
 * Cost = baseCost * (costScale ^ owned)
 */
export function getProcessCost(
  def: ProcessDef,
  owned: number
): number {
  return Math.floor(def.baseCost * Math.pow(def.costScale, owned));
}

/**
 * Calculate the maximum number of a process that can be afforded with current mass
 * Returns the count of additional units that can be bought
 */
export function getMaxAffordable(
  def: ProcessDef,
  owned: number,
  mass: number
): number {
  let affordable = 0;
  let currentMass = mass;
  let currentOwned = owned;

  while (currentMass >= getProcessCost(def, currentOwned)) {
    currentMass -= getProcessCost(def, currentOwned);
    currentOwned++;
    affordable++;
  }

  return affordable;
}

/**
 * Get all processes
 */
export function getProcesses(): ProcessDef[] {
  return PROCESSES;
}

/**
 * Get a process by ID
 */
export function getProcess(id: string): ProcessDef | undefined {
  return PROCESSES.find((p) => p.id === id);
}

/**
 * Get processes by category
 */
export function getProcessesByCategory(category: ProcessCategory): ProcessDef[] {
  return PROCESSES.filter((p) => p.category === category);
}

import { BuildingDef, GameState } from './types';

// ============================================================
// METAL DEPOSITS — spend mass, produce mass
// ============================================================
export const METALS: BuildingDef[] = [
  { id: 'iron_fragments', name: 'Iron Fragments', emoji: '🪨', desc: 'Common iron-nickel fragments on the surface.', tab: 'metals', costResource: 'mass', baseCost: 15, costScale: 1.15, produces: [{ resource: 'mass', baseAmount: 0.5 }] },
  { id: 'nickel_nodules', name: 'Nickel Nodules', emoji: '⚙️', desc: 'Dense nickel clusters embedded in regolith.', tab: 'metals', costResource: 'mass', baseCost: 200, costScale: 1.15, produces: [{ resource: 'mass', baseAmount: 3 }] },
  { id: 'cobalt_seam', name: 'Cobalt Seam', emoji: '💙', desc: 'A vein of cobalt running through the core.', tab: 'metals', costResource: 'mass', baseCost: 3000, costScale: 1.15, produces: [{ resource: 'mass', baseAmount: 18 }] },
  { id: 'platinum_vein', name: 'Platinum Vein', emoji: '✨', desc: 'Rare platinum deposits from ancient collisions.', tab: 'metals', costResource: 'mass', baseCost: 50000, costScale: 1.15, produces: [{ resource: 'mass', baseAmount: 100 }] },
  { id: 'iridium_pocket', name: 'Iridium Pocket', emoji: '💎', desc: 'Ultra-dense iridium trapped since formation.', tab: 'metals', costResource: 'mass', baseCost: 800000, costScale: 1.15, produces: [{ resource: 'mass', baseAmount: 550 }] },
  { id: 'osmium_cluster', name: 'Osmium Cluster', emoji: '🔷', desc: 'The densest natural metal known to exist.', tab: 'metals', costResource: 'mass', baseCost: 15000000, costScale: 1.15, produces: [{ resource: 'mass', baseAmount: 3000 }] },
  { id: 'palladium_layer', name: 'Palladium Layer', emoji: '🌟', desc: 'A deep palladium stratum from a primordial nebula.', tab: 'metals', costResource: 'mass', baseCost: 300000000, costScale: 1.15, produces: [{ resource: 'mass', baseAmount: 16000 }] },
  { id: 'rhodium_core', name: 'Rhodium Core', emoji: '👑', desc: 'The rarest metal, found only at the deepest core.', tab: 'metals', costResource: 'mass', baseCost: 7000000000, costScale: 1.15, produces: [{ resource: 'mass', baseAmount: 85000 }] },
];

// ============================================================
// VELOCITY ITEMS — spend velocity, produce energy
// ============================================================
export const VELOCITY_ITEMS: BuildingDef[] = [
  { id: 'atmospheric_drag', name: 'Atmospheric Drag', emoji: '🌫️', desc: 'Friction with sparse interstellar gas.', tab: 'velocity', costResource: 'velocity', baseCost: 10, costScale: 1.20, produces: [{ resource: 'energy', baseAmount: 0.05 }] },
  { id: 'friction_heating', name: 'Friction Heating', emoji: '🔥', desc: 'Convert kinetic energy to thermal energy.', tab: 'velocity', costResource: 'velocity', baseCost: 200, costScale: 1.20, produces: [{ resource: 'energy', baseAmount: 0.5 }] },
  { id: 'solar_radiation', name: 'Solar Radiation Pressure', emoji: '☀️', desc: 'Absorb photon momentum into stored energy.', tab: 'velocity', costResource: 'velocity', baseCost: 4000, costScale: 1.20, produces: [{ resource: 'energy', baseAmount: 3 }] },
  { id: 'magnetic_interaction', name: 'Magnetic Field Interaction', emoji: '🧲', desc: 'Capture electromagnetic energy from planetary fields.', tab: 'velocity', costResource: 'velocity', baseCost: 80000, costScale: 1.20, produces: [{ resource: 'energy', baseAmount: 18 }] },
  { id: 'cosmic_ray_absorption', name: 'Cosmic Ray Absorption', emoji: '⚡', desc: 'Absorb high-energy cosmic particles.', tab: 'velocity', costResource: 'velocity', baseCost: 2000000, costScale: 1.20, produces: [{ resource: 'energy', baseAmount: 100 }] },
];

export const ALL_BUILDINGS: BuildingDef[] = [...METALS, ...VELOCITY_ITEMS];

// === COST & PURCHASE HELPERS ===
export function getBuildingCost(def: BuildingDef, owned: number): number {
  return Math.floor(def.baseCost * Math.pow(def.costScale, owned));
}

export function getMaxAffordable(def: BuildingDef, owned: number, available: number): number {
  let count = 0;
  let remaining = available;
  for (let i = 0; i < 9999; i++) {
    const cost = getBuildingCost(def, owned + i);
    if (remaining < cost) break;
    remaining -= cost;
    count++;
  }
  return count;
}

export function getTotalCostForN(def: BuildingDef, owned: number, n: number): number {
  let total = 0;
  for (let i = 0; i < n; i++) total += getBuildingCost(def, owned + i);
  return total;
}

export function getBuildingCount(state: GameState, def: BuildingDef): number {
  if (def.tab === 'metals') return state.metals[def.id] || 0;
  return state.velocityItems[def.id] || 0;
}

// ============================================================
// EXPULSION: Jettison % of mass for velocity
// Base rate: 10,000 mass = 1 velocity (rate = 0.0001)
// 5 second cooldown between uses
// Rate upgradeable with shards
// ============================================================
export const BASE_EXPULSION_RATE = 0.0001;
export const EXPULSION_COOLDOWN = 5;

export function getExpulsionRate(shardUpgrades: Record<string, number>): number {
  const level = shardUpgrades['shard_expulsion_boost'] || 0;
  return BASE_EXPULSION_RATE * (1 + level * 0.15);
}

export function calculateExpulsion(massToJettison: number, rate: number) {
  return { massLost: massToJettison, velocityGained: massToJettison * rate };
}

// ============================================================
// ACCUMULATION: Spend velocity to gain mass (opposite of expulsion)
// Rate is WORSE so you can't profit by converting back and forth
// Expulsion: 10,000 mass → 1 velocity
// Accumulation: 1 velocity → 6,666 mass (you lose ~33% round-trip)
// ============================================================
export const BASE_ACCUMULATION_RATE = 6666;

export function getAccumulationRate(shardUpgrades: Record<string, number>): number {
  const level = shardUpgrades['shard_accumulation_boost'] || 0;
  return BASE_ACCUMULATION_RATE * (1 + level * 0.10);
}

export function calculateAccumulation(velocityToSpend: number, rate: number) {
  return { velocityLost: velocityToSpend, massGained: velocityToSpend * rate };
}

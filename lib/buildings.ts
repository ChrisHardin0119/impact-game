import { BuildingDef, GameState } from './types';

// ============================================================
// SHARED RESOURCE: Mass and Density are the SAME resource pool.
// Density = mass * DENSITY_RATIO. When you spend mass, density drops.
// When you spend density, mass drops. Two views of one resource.
// ============================================================
export const DENSITY_RATIO = 0.001; // 1000 mass = 1 density
export const MASS_PER_DENSITY = 1000; // 1 density costs 1000 mass

/** Get the current density (derived from mass) */
export function getDensity(state: GameState): number {
  return state.mass * DENSITY_RATIO;
}

// ============================================================
// METAL DEPOSITS — spend mass, produce mass
// Density goes up automatically since it's mass * ratio
// ============================================================
export const METALS: BuildingDef[] = [
  {
    id: 'iron_fragments',
    name: 'Iron Fragments',
    emoji: '🪨',
    desc: 'Common iron-nickel fragments on the surface.',
    tab: 'metals',
    costResource: 'mass',
    baseCost: 15,
    costScale: 1.15,
    produces: [{ resource: 'mass', baseAmount: 0.5 }],
  },
  {
    id: 'nickel_nodules',
    name: 'Nickel Nodules',
    emoji: '⚙️',
    desc: 'Dense nickel clusters embedded in regolith.',
    tab: 'metals',
    costResource: 'mass',
    baseCost: 200,
    costScale: 1.15,
    produces: [{ resource: 'mass', baseAmount: 3 }],
  },
  {
    id: 'cobalt_seam',
    name: 'Cobalt Seam',
    emoji: '💙',
    desc: 'A vein of cobalt running through the core.',
    tab: 'metals',
    costResource: 'mass',
    baseCost: 3000,
    costScale: 1.15,
    produces: [{ resource: 'mass', baseAmount: 18 }],
  },
  {
    id: 'platinum_vein',
    name: 'Platinum Vein',
    emoji: '✨',
    desc: 'Rare platinum deposits from ancient collisions.',
    tab: 'metals',
    costResource: 'mass',
    baseCost: 50000,
    costScale: 1.15,
    produces: [{ resource: 'mass', baseAmount: 100 }],
  },
  {
    id: 'iridium_pocket',
    name: 'Iridium Pocket',
    emoji: '💎',
    desc: 'Ultra-dense iridium trapped since formation.',
    tab: 'metals',
    costResource: 'mass',
    baseCost: 800000,
    costScale: 1.15,
    produces: [{ resource: 'mass', baseAmount: 550 }],
  },
  {
    id: 'osmium_cluster',
    name: 'Osmium Cluster',
    emoji: '🔷',
    desc: 'The densest natural metal known to exist.',
    tab: 'metals',
    costResource: 'mass',
    baseCost: 15000000,
    costScale: 1.15,
    produces: [{ resource: 'mass', baseAmount: 3000 }],
  },
  {
    id: 'palladium_layer',
    name: 'Palladium Layer',
    emoji: '🌟',
    desc: 'A deep palladium stratum from a primordial nebula.',
    tab: 'metals',
    costResource: 'mass',
    baseCost: 300000000,
    costScale: 1.15,
    produces: [{ resource: 'mass', baseAmount: 16000 }],
  },
  {
    id: 'rhodium_core',
    name: 'Rhodium Core',
    emoji: '👑',
    desc: 'The rarest metal, found only at the deepest core.',
    tab: 'metals',
    costResource: 'mass',
    baseCost: 7000000000,
    costScale: 1.15,
    produces: [{ resource: 'mass', baseAmount: 85000 }],
  },
];

// ============================================================
// DENSITY ITEMS — spend density (which reduces mass), produce velocity
// Cost in density = cost * MASS_PER_DENSITY in mass
// ============================================================
export const DENSITY_ITEMS: BuildingDef[] = [
  {
    id: 'solar_wind_push',
    name: 'Solar Wind Push',
    emoji: '☀️',
    desc: 'Expose surface to solar wind for acceleration.',
    tab: 'density',
    costResource: 'density',
    baseCost: 5,
    costScale: 1.18,
    produces: [{ resource: 'velocity', baseAmount: 0.1 }],
  },
  {
    id: 'gravitational_slingshot',
    name: 'Gravitational Slingshot',
    emoji: '🌍',
    desc: 'Use nearby bodies for gravity assists.',
    tab: 'density',
    costResource: 'density',
    baseCost: 80,
    costScale: 1.18,
    produces: [{ resource: 'velocity', baseAmount: 0.8 }],
  },
  {
    id: 'orbital_resonance',
    name: 'Orbital Resonance',
    emoji: '🔄',
    desc: 'Lock into a resonant orbit to build speed.',
    tab: 'density',
    costResource: 'density',
    baseCost: 1200,
    costScale: 1.18,
    produces: [{ resource: 'velocity', baseAmount: 5 }],
  },
  {
    id: 'tidal_acceleration',
    name: 'Tidal Acceleration',
    emoji: '🌊',
    desc: 'Harness tidal forces from a nearby giant.',
    tab: 'density',
    costResource: 'density',
    baseCost: 20000,
    costScale: 1.18,
    produces: [{ resource: 'velocity', baseAmount: 30 }],
  },
  {
    id: 'outgassing_jets',
    name: 'Outgassing Jets',
    emoji: '💨',
    desc: 'Volatile materials vent, propelling forward.',
    tab: 'density',
    costResource: 'density',
    baseCost: 350000,
    costScale: 1.18,
    produces: [{ resource: 'velocity', baseAmount: 180 }],
  },
];

// ============================================================
// VELOCITY ITEMS — spend velocity, produce energy
// ============================================================
export const VELOCITY_ITEMS: BuildingDef[] = [
  {
    id: 'atmospheric_drag',
    name: 'Atmospheric Drag',
    emoji: '🌫️',
    desc: 'Friction with sparse interstellar gas.',
    tab: 'velocity',
    costResource: 'velocity',
    baseCost: 10,
    costScale: 1.20,
    produces: [{ resource: 'energy', baseAmount: 0.05 }],
  },
  {
    id: 'friction_heating',
    name: 'Friction Heating',
    emoji: '🔥',
    desc: 'Convert kinetic energy to thermal energy.',
    tab: 'velocity',
    costResource: 'velocity',
    baseCost: 200,
    costScale: 1.20,
    produces: [{ resource: 'energy', baseAmount: 0.5 }],
  },
  {
    id: 'solar_radiation',
    name: 'Solar Radiation Pressure',
    emoji: '☀️',
    desc: 'Absorb photon momentum into stored energy.',
    tab: 'velocity',
    costResource: 'velocity',
    baseCost: 4000,
    costScale: 1.20,
    produces: [{ resource: 'energy', baseAmount: 3 }],
  },
  {
    id: 'magnetic_interaction',
    name: 'Magnetic Field Interaction',
    emoji: '🧲',
    desc: 'Capture electromagnetic energy from planetary fields.',
    tab: 'velocity',
    costResource: 'velocity',
    baseCost: 80000,
    costScale: 1.20,
    produces: [{ resource: 'energy', baseAmount: 18 }],
  },
  {
    id: 'cosmic_ray_absorption',
    name: 'Cosmic Ray Absorption',
    emoji: '⚡',
    desc: 'Absorb high-energy cosmic particles.',
    tab: 'velocity',
    costResource: 'velocity',
    baseCost: 2000000,
    costScale: 1.20,
    produces: [{ resource: 'energy', baseAmount: 100 }],
  },
];

// All buildings combined
export const ALL_BUILDINGS: BuildingDef[] = [...METALS, ...DENSITY_ITEMS, ...VELOCITY_ITEMS];

// === COST & PURCHASE HELPERS ===

export function getBuildingCost(def: BuildingDef, owned: number): number {
  return Math.floor(def.baseCost * Math.pow(def.costScale, owned));
}

/**
 * Get the effective resource available for a building.
 * For density-costing items, this returns the density (mass * ratio).
 */
export function getEffectiveResource(state: GameState, costResource: 'mass' | 'density' | 'velocity'): number {
  if (costResource === 'mass') return state.mass;
  if (costResource === 'density') return getDensity(state); // density is derived from mass
  return state.velocity;
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
  for (let i = 0; i < n; i++) {
    total += getBuildingCost(def, owned + i);
  }
  return total;
}

export function getResourceForBuilding(state: GameState, resource: 'mass' | 'density' | 'velocity'): number {
  return getEffectiveResource(state, resource);
}

export function getBuildingsForTab(tab: 'metals' | 'density' | 'velocity'): BuildingDef[] {
  return ALL_BUILDINGS.filter(b => b.tab === tab);
}

export function getBuildingCount(state: GameState, def: BuildingDef): number {
  if (def.tab === 'metals') return state.metals[def.id] || 0;
  if (def.tab === 'density') return state.densityItems[def.id] || 0;
  return state.velocityItems[def.id] || 0;
}

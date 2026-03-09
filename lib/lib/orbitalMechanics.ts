import { OrbitalMechanicDef, PrestigeTier } from './types';

export const ORBITAL_MECHANICS: OrbitalMechanicDef[] = [
  // ===== TIER 0 — Starting =====
  {
    id: 'mass_pump',
    name: 'Mass Pump',
    emoji: '📈',
    desc: '1.3x mass production while active.',
    isToggle: true,
    energyCost: 15,
    energyDrain: 2.0,
    cooldown: 0,
    duration: 0,
    unlockTier: 0,
  },
  {
    id: 'gravity_harness',
    name: 'Gravity Harness',
    emoji: '⬆️',
    desc: '+0.2 gravity per second while active.',
    isToggle: true,
    energyCost: 10,
    energyDrain: 1.5,
    cooldown: 0,
    duration: 0,
    unlockTier: 0,
  },
  {
    id: 'density_pulse',
    name: 'Density Pulse',
    emoji: '🌊',
    desc: '+0.003 density per second while active.',
    isToggle: true,
    energyCost: 10,
    energyDrain: 1.2,
    cooldown: 0,
    duration: 0,
    unlockTier: 0,
  },
  {
    id: 'meteor_strike',
    name: 'Meteor Strike',
    emoji: '☄️',
    desc: '5x click power for 10 seconds. Tap fast!',
    isToggle: false,
    energyCost: 40,
    energyDrain: 0,
    cooldown: 45,
    duration: 10,
    unlockTier: 0,
  },

  // ===== TIER 1 — Asteroid =====
  {
    id: 'gravity_brake',
    name: 'Gravity Brake',
    emoji: '🛑',
    desc: '−0.15 gravity per second. Lower gravity when it gets too high.',
    isToggle: true,
    energyCost: 15,
    energyDrain: 1.5,
    cooldown: 0,
    duration: 0,
    unlockTier: 1,
  },
  {
    id: 'density_vent',
    name: 'Density Vent',
    emoji: '💨',
    desc: '−0.005 density per second. Shed excess density fast.',
    isToggle: true,
    energyCost: 15,
    energyDrain: 1.2,
    cooldown: 0,
    duration: 0,
    unlockTier: 1,
  },
  {
    id: 'process_optimizer',
    name: 'Process Optimizer',
    emoji: '🔧',
    desc: '40% off all process costs while active.',
    isToggle: true,
    energyCost: 20,
    energyDrain: 2.0,
    cooldown: 0,
    duration: 0,
    unlockTier: 1,
  },
  {
    id: 'synergy_cascade',
    name: 'Synergy Cascade',
    emoji: '〰️',
    desc: '2x all synergy bonuses for 15 seconds.',
    isToggle: false,
    energyCost: 50,
    energyDrain: 0,
    cooldown: 75,
    duration: 15,
    unlockTier: 1,
  },

  // ===== TIER 2 — Moon =====
  {
    id: 'temporal_flow',
    name: 'Temporal Flow',
    emoji: '⏳',
    desc: '1.5x ALL generation (mass, gravity, density) while active.',
    isToggle: true,
    energyCost: 25,
    energyDrain: 3.0,
    cooldown: 0,
    duration: 0,
    unlockTier: 2,
  },
  {
    id: 'energy_siphon',
    name: 'Energy Siphon',
    emoji: '⚡',
    desc: '+0.5 energy regen. Tradeoff: −0.1 gravity/sec.',
    isToggle: true,
    energyCost: 30,
    energyDrain: 0, // free drain — but costs gravity
    cooldown: 0,
    duration: 0,
    unlockTier: 2,
  },
  {
    id: 'chromatic_burst',
    name: 'Chromatic Burst',
    emoji: '🌈',
    desc: '3x mass production for 12 seconds.',
    isToggle: false,
    energyCost: 60,
    energyDrain: 0,
    cooldown: 60,
    duration: 12,
    unlockTier: 2,
  },

  // ===== TIER 3+ — Planet/Star =====
  {
    id: 'gravity_vortex',
    name: 'Gravity Vortex',
    emoji: '🌀',
    desc: '2x gravity generation while active.',
    isToggle: true,
    energyCost: 35,
    energyDrain: 4.0,
    cooldown: 0,
    duration: 0,
    unlockTier: 3,
  },
  {
    id: 'density_forge',
    name: 'Density Forge',
    emoji: '💎',
    desc: '2x density generation while active.',
    isToggle: true,
    energyCost: 30,
    energyDrain: 3.5,
    cooldown: 0,
    duration: 0,
    unlockTier: 3,
  },
  {
    id: 'singularity_pull',
    name: 'Singularity Pull',
    emoji: '🌌',
    desc: 'Absorb all mass into gravity permanently. Once per run.',
    isToggle: false,
    energyCost: 80,
    energyDrain: 0,
    cooldown: 60,
    duration: 0,
    unlockTier: 2,
  },
];

/**
 * Get all orbital mechanics unlocked at or below a given prestige tier
 */
export function getUnlockedOM(tier: PrestigeTier): OrbitalMechanicDef[] {
  return ORBITAL_MECHANICS.filter((om) => om.unlockTier <= tier);
}

/**
 * Get a specific orbital mechanic by ID
 */
export function getOrbitalMechanic(id: string): OrbitalMechanicDef | undefined {
  return ORBITAL_MECHANICS.find((om) => om.id === id);
}

/**
 * Calculate total energy drain from all active toggles
 */
export function getTotalEnergyDrain(omToggles: Record<string, boolean>): number {
  let total = 0;
  for (const om of ORBITAL_MECHANICS) {
    if (om.isToggle && omToggles[om.id]) {
      total += om.energyDrain;
    }
  }
  return total;
}

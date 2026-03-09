import { OrbitalMechanicDef, PrestigeTier } from './types';

export const ORBITAL_MECHANICS: OrbitalMechanicDef[] = [
  {
    id: 'gravitational_focus',
    name: 'Gravitational Focus',
    emoji: '🎯',
    desc: 'Concentrate all gravitational forces on a single point. Instantly doubles gravity generation for 6 seconds.',
    energyCost: 20,
    cooldown: 8,
    duration: 6,
    unlockTier: 0,
  },
  {
    id: 'density_compression',
    name: 'Density Compression',
    emoji: '🔒',
    desc: 'Compress matter to extreme density. Instantly increases density by 25% of current value.',
    energyCost: 30,
    cooldown: 12,
    duration: 0,
    unlockTier: 0,
  },
  {
    id: 'cosmic_expansion',
    name: 'Cosmic Expansion',
    emoji: '💥',
    desc: 'Expand your mass across cosmic scales. Multiplies mass production by 3x for 4 seconds.',
    energyCost: 25,
    cooldown: 10,
    duration: 4,
    unlockTier: 0,
  },
  {
    id: 'meteor_barrage',
    name: 'Meteor Barrage',
    emoji: '☄️',
    desc: 'Rain meteors from the heavens. Grants 8% of current mass every 0.5 seconds for 3 seconds.',
    energyCost: 40,
    cooldown: 15,
    duration: 3,
    unlockTier: 1,
  },
  {
    id: 'gravity_well',
    name: 'Gravity Well',
    emoji: '⚫',
    desc: 'Collapse space-time into a gravity well. Instantly gain 50% of all gravity production.',
    energyCost: 35,
    cooldown: 20,
    duration: 0,
    unlockTier: 1,
  },
  {
    id: 'resonance_cascade',
    name: 'Resonance Cascade',
    emoji: '〰️',
    desc: 'Trigger a cascade of resonant frequencies. All synergies grant double bonuses for 8 seconds.',
    energyCost: 50,
    cooldown: 30,
    duration: 8,
    unlockTier: 2,
  },
  {
    id: 'temporal_shift',
    name: 'Temporal Shift',
    emoji: '⏳',
    desc: 'Warp local time flow. Process cooldowns tick 4x faster for 5 seconds.',
    energyCost: 45,
    cooldown: 25,
    duration: 5,
    unlockTier: 3,
  },
  {
    id: 'singularity_pull',
    name: 'Singularity Pull',
    emoji: '🌌',
    desc: 'Summon a singularity to drain resources. Instantly absorb 100% of current mass into gravity (permanent buff).',
    energyCost: 60,
    cooldown: 40,
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

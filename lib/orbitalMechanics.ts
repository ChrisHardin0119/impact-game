import { OrbitalMechanicDef, PrestigeTier } from './types';

export const ORBITAL_MECHANICS: OrbitalMechanicDef[] = [
  {
    id: 'gravitational_focus',
    name: 'Gravitational Focus',
    emoji: '🎯',
    desc: 'Concentrate all gravitational forces on a single point. 1.5x mass & gravity for 10s.',
    energyCost: 30,
    cooldown: 45,
    duration: 10,
    unlockTier: 0,
  },
  {
    id: 'density_compression',
    name: 'Density Compression',
    emoji: '🔒',
    desc: 'Compress matter to extreme density. Instantly increases density by 15%.',
    energyCost: 35,
    cooldown: 40,
    duration: 0,
    unlockTier: 0,
  },
  {
    id: 'cosmic_expansion',
    name: 'Cosmic Expansion',
    emoji: '💥',
    desc: 'Expand your mass across cosmic scales. 3x mass production for 8s. Halves process costs while active.',
    energyCost: 40,
    cooldown: 60,
    duration: 8,
    unlockTier: 0,
  },
  {
    id: 'meteor_barrage',
    name: 'Meteor Barrage',
    emoji: '☄️',
    desc: 'Rain meteors from the heavens. 5x click power for 12s — tap fast!',
    energyCost: 50,
    cooldown: 60,
    duration: 12,
    unlockTier: 1,
  },
  {
    id: 'gravity_well',
    name: 'Gravity Well',
    emoji: '⚫',
    desc: 'Collapse space-time into a gravity well. Instantly gain +15 gravity.',
    energyCost: 45,
    cooldown: 50,
    duration: 0,
    unlockTier: 1,
  },
  {
    id: 'resonance_cascade',
    name: 'Resonance Cascade',
    emoji: '〰️',
    desc: 'Trigger a cascade of resonant frequencies. All synergies grant double bonuses for 15s.',
    energyCost: 60,
    cooldown: 75,
    duration: 15,
    unlockTier: 2,
  },
  {
    id: 'temporal_shift',
    name: 'Temporal Shift',
    emoji: '⏳',
    desc: 'Warp local time flow. All cooldowns tick 4x faster for 10s.',
    energyCost: 55,
    cooldown: 90,
    duration: 10,
    unlockTier: 3,
  },
  {
    id: 'singularity_pull',
    name: 'Singularity Pull',
    emoji: '🌌',
    desc: 'Summon a singularity. Instantly absorb 100% of current mass into gravity (permanent buff). Once per run.',
    energyCost: 80,
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

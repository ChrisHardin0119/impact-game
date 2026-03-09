import { CompositionDef, CompositionId, PrestigeTier } from './types';

export const COMPOSITIONS: CompositionDef[] = [
  {
    id: 'silicate',
    name: 'Silicate',
    emoji: '🪨',
    desc: 'A synergy-focused composition that grows stronger when processes work together.',
    flavor: 'Tectonic Bond',
    unlockTier: 0,
    massProductionMult: 0.8,
    costMult: 1.0,
    gravityMult: 1.3,
    densityMult: 1.0,
    synergyMult: 2.0,
    clickMult: 0.5,
    specialName: 'Tectonic Bond',
    specialDesc: 'Synergy bonuses grow +0.2% per synergy level (cumulative). Your connections strengthen over time.',
  },
  {
    id: 'iron',
    name: 'Iron',
    emoji: '⚙️',
    desc: 'An aggressive composition with high density and mass production at the cost of gravity.',
    flavor: 'Dense and Powerful',
    unlockTier: 0,
    massProductionMult: 1.5,
    costMult: 1.4,
    gravityMult: 0.7,
    densityMult: 2.0,
    synergyMult: 1.0,
    clickMult: 1.0,
    specialName: 'Density Pulse',
    specialDesc: 'When density exceeds 50%, it acts as a 1.5x mass multiplier. Compress and dominate.',
  },
  {
    id: 'ice',
    name: 'Ice',
    emoji: '❄️',
    desc: 'An event-driven composition that harnesses sudden comet impacts for resource boosts.',
    flavor: 'Volatile Impact',
    unlockTier: 0,
    massProductionMult: 0.75,
    costMult: 0.9,
    gravityMult: 1.0,
    densityMult: 0.5,
    synergyMult: 1.0,
    clickMult: 2.0,
    specialName: 'Comet Swarm',
    specialDesc: 'Random comet events every 3-8 seconds grant 5% of total resources. Unpredictable but rewarding.',
  },
  {
    id: 'carbonaceous',
    name: 'Carbonaceous',
    emoji: '💎',
    desc: 'A flexible composition with balanced stats and tactical density manipulation.',
    flavor: 'Versatile',
    unlockTier: 0,
    massProductionMult: 1.25,
    costMult: 1.0,
    gravityMult: 1.1,
    densityMult: 1.1,
    synergyMult: 1.5,
    clickMult: 1.2,
    specialName: 'Elemental Charge',
    specialDesc: 'Spend 5% of current density to boost a selected process by +50% for 8 seconds.',
  },
  {
    id: 'binary',
    name: 'Binary',
    emoji: '⭐',
    desc: 'Unlocked at tier 3. A dual-natured composition with oscillating bonuses.',
    flavor: 'Dual Star System',
    unlockTier: 3,
    massProductionMult: 1.6,
    costMult: 1.2,
    gravityMult: 1.8,
    densityMult: 1.3,
    synergyMult: 1.8,
    clickMult: 0.9,
    specialName: 'Orbital Dance',
    specialDesc: 'Bonuses oscillate every 5 seconds. Time your actions for maximum impact.',
  },
  {
    id: 'neutron',
    name: 'Neutron',
    emoji: '🌑',
    desc: 'Unlocked at tier 5. An extreme composition with massive gravity and density.',
    flavor: 'Incomprehensible Density',
    unlockTier: 5,
    massProductionMult: 2.0,
    costMult: 0.8,
    gravityMult: 3.0,
    densityMult: 3.0,
    synergyMult: 2.5,
    clickMult: 0.3,
    specialName: 'Neutron Degeneracy',
    specialDesc: 'Density and gravity stack multiplicatively. The denser you get, the stronger everything becomes.',
  },
];

/**
 * Get a composition by ID
 */
export function getComposition(id: CompositionId): CompositionDef {
  const comp = COMPOSITIONS.find((c) => c.id === id);
  if (!comp) {
    throw new Error(`Unknown composition: ${id}`);
  }
  return comp;
}

/**
 * Get all compositions unlocked at or below a given prestige tier
 */
export function getUnlockedCompositions(tier: PrestigeTier): CompositionDef[] {
  return COMPOSITIONS.filter((c) => c.unlockTier <= tier);
}

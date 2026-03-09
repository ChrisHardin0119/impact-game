import { GameState } from './types';

// Discovery definitions with extended properties for condition checking
// Using index signature to allow condition-specific fields since they vary per discovery type
interface DiscoveryData {
  id: string;
  name: string;
  emoji: string;
  desc: string;
  hint: string;
  bonusDesc: string;
  condition: string;
  [key: string]: any;
}

export const DISCOVERIES: DiscoveryData[] = [
  // ===== Hidden Synergy Combos (3) =====
  {
    id: 'magnetic_polarity',
    name: 'Magnetic Polarity',
    emoji: '🧲',
    desc: 'Own 10+ Meteor Magnets and 5+ Gravity Well Generators',
    hint: 'Some processes attract each other...',
    bonusDesc: '+100% synergy strength',
    condition: 'synergy_combo',
    synergyTarget: 'meteor_magnet',
    minOwned: 10,
    secondaryTarget: 'gravity_well_gen',
    secondaryMinOwned: 5,
  },
  {
    id: 'stellar_furnace',
    name: 'Stellar Furnace',
    emoji: '🔥',
    desc: 'Own both Fusion Forge and Stellar Harvester',
    hint: 'What happens when you combine the hottest processes?',
    bonusDesc: '+250% Fusion Forge production',
    condition: 'possession_combo',
    primaryTarget: 'fusion_forge',
    secondaryTarget: 'stellar_harvester',
  },
  {
    id: 'ancient_harmony',
    name: 'Ancient Harmony',
    emoji: '🎵',
    desc: 'Own at least 1 of every process type',
    hint: 'Collect them all...',
    bonusDesc: '+50% all production',
    condition: 'process_diversity',
  },

  // ===== Ability Combos (3) =====
  {
    id: 'resonance_echo',
    name: 'Resonance Echo',
    emoji: '〰️',
    desc: 'Use Resonance Cascade while Gravitational Focus is active',
    hint: 'Some abilities resonate with each other...',
    bonusDesc: '+2s duration to stacked abilities',
    condition: 'orbital_combo',
    primaryOM: 'resonance_cascade',
    secondaryOM: 'gravitational_focus',
  },
  {
    id: 'comet_chain',
    name: 'Comet Chain',
    emoji: '☄️',
    desc: 'Catch 50 comets in one run',
    hint: 'Keep catching those space rocks...',
    bonusDesc: '+100% comet value',
    condition: 'achievement',
    cometThreshold: 50,
  },
  {
    id: 'temporal_duplicate',
    name: 'Temporal Duplicate',
    emoji: '⏳',
    desc: 'Use Temporal Shift with density above 90%',
    hint: 'Time and density interact in strange ways...',
    bonusDesc: '+25% density gains permanently',
    condition: 'orbital_condition',
    orbitalMechanicId: 'temporal_shift',
    densityThreshold: 90,
  },

  // ===== Hidden Achievements (2) =====
  {
    id: 'silent_giant',
    name: 'Silent Giant',
    emoji: '🤫',
    desc: 'Prestige without using any Orbital Mechanics',
    hint: 'Sometimes less is more...',
    bonusDesc: '+10% shard generation',
    condition: 'prestige_condition',
    noOrbitalMechanics: true,
  },
  {
    id: 'cosmic_symmetry',
    name: 'Cosmic Symmetry',
    emoji: '⚖️',
    desc: 'Have density at exactly 50.0% (±0.5%)',
    hint: 'Perfect balance in all things...',
    bonusDesc: 'Special visual unlock',
    condition: 'density_exact',
    densityTarget: 50.0,
    densityTolerance: 0.5,
  },

  // ===== Composition Secrets (2) =====
  {
    id: 'tectonic_master',
    name: 'Tectonic Master',
    emoji: '🪨',
    desc: 'Play 5 runs as Silicate',
    hint: 'Loyalty to stone has its rewards...',
    bonusDesc: '+50% Silicate synergy multiplier',
    condition: 'composition_runs',
    compositionId: 'silicate',
    runsRequired: 5,
  },
  {
    id: 'iron_will',
    name: 'Iron Will',
    emoji: '⚙️',
    desc: 'Reach 95% density as Iron',
    hint: 'Iron and density go hand in hand...',
    bonusDesc: 'Iron density cap raised to 100%',
    condition: 'composition_density',
    compositionId: 'iron',
    densityThreshold: 95,
  },
];

/**
 * Check game state against all discovery conditions.
 * Returns array of newly discovered IDs.
 */
export function checkDiscoveries(state: GameState): string[] {
  const newDiscoveries: string[] = [];
  const processIds = [
    'dust_collector',
    'meteor_magnet',
    'ice_harvester',
    'gravity_well_gen',
    'ore_refinery',
    'core_compressor',
    'tidal_amplifier',
    'fusion_forge',
    'ring_constructor',
    'stellar_harvester',
  ];

  for (const discovery of DISCOVERIES) {
    if (state.discoveries.includes(discovery.id)) continue;

    let discovered = false;

    switch (discovery.condition) {
      case 'synergy_combo': {
        const primary = state.processes[discovery.synergyTarget] || 0;
        const secondary = state.processes[discovery.secondaryTarget] || 0;
        discovered = primary >= (discovery.minOwned || 10) && secondary >= (discovery.secondaryMinOwned || 5);
        break;
      }
      case 'possession_combo': {
        const primary = state.processes[discovery.primaryTarget] || 0;
        const secondary = state.processes[discovery.secondaryTarget] || 0;
        discovered = primary > 0 && secondary > 0;
        break;
      }
      case 'process_diversity': {
        discovered = processIds.every((id) => (state.processes[id] || 0) >= 1);
        break;
      }
      case 'orbital_combo': {
        const primaryActive = (state.omActive[discovery.primaryOM] || 0) > 0;
        const secondaryActive = (state.omActive[discovery.secondaryOM] || 0) > 0;
        discovered = primaryActive && secondaryActive;
        break;
      }
      case 'achievement': {
        if (discovery.cometThreshold !== undefined) {
          discovered = state.cometsCaught >= discovery.cometThreshold;
        }
        break;
      }
      case 'orbital_condition': {
        const wasUsed = (state.omActive[discovery.orbitalMechanicId] || 0) > 0;
        discovered = wasUsed && state.density >= (discovery.densityThreshold || 0);
        break;
      }
      case 'prestige_condition': {
        // This is checked at prestige time, not every tick
        break;
      }
      case 'density_exact': {
        const diff = Math.abs(state.density - (discovery.densityTarget || 50));
        discovered = diff <= (discovery.densityTolerance || 0.5);
        break;
      }
      case 'composition_runs': {
        // Would need compositionRunCounts in state; skip for now
        break;
      }
      case 'composition_density': {
        if (state.composition === discovery.compositionId) {
          discovered = state.density >= (discovery.densityThreshold || 0);
        }
        break;
      }
    }

    if (discovered) {
      newDiscoveries.push(discovery.id);
    }
  }

  return newDiscoveries;
}

import { GameState } from './types';

/**
 * Discovery/Achievement system
 *
 * Categories:
 * - process_milestone: Own X of a process → 2x production for that process
 * - synergy_combo: Own required amounts of two processes
 * - possession_combo: Own at least 1 of two specific processes
 * - process_diversity: Own at least 1 of every process
 * - resource_milestone: Hit a resource threshold
 * - prestige_achievement: Prestige-related goals
 * - click_achievement: Click-related goals
 * - comet_achievement: Comet-related goals
 * - hidden: Secret achievements for unusual actions
 * - composition_achievement: Composition-specific goals
 * - density_exact: Hit an exact density value
 */

interface DiscoveryData {
  id: string;
  name: string;
  emoji: string;
  desc: string;
  hint: string;
  bonusDesc: string;
  condition: string;
  hidden?: boolean;
  [key: string]: any;
}

export const DISCOVERIES: DiscoveryData[] = [
  // ===================================================================
  // PROCESS MILESTONES (6) — AdCap-style bonuses: 2x output at threshold
  // ===================================================================
  {
    id: 'dust_empire',
    name: 'Dust Empire',
    emoji: '🏜️',
    desc: 'Own 25 Dust Collectors',
    hint: 'Dust to dust, and then some more dust...',
    bonusDesc: '2x Dust Collector production',
    condition: 'process_milestone',
    processId: 'dust_collector',
    threshold: 25,
  },
  {
    id: 'meteor_shower',
    name: 'Meteor Shower',
    emoji: '☄️',
    desc: 'Own 25 Meteor Magnets',
    hint: 'When it rains, it pours meteors.',
    bonusDesc: '2x Meteor Magnet production',
    condition: 'process_milestone',
    processId: 'meteor_magnet',
    threshold: 25,
  },
  {
    id: 'ice_age',
    name: 'Ice Age',
    emoji: '🧊',
    desc: 'Own 25 Ice Harvesters',
    hint: 'Winter is coming... and staying.',
    bonusDesc: '2x Ice Harvester production',
    condition: 'process_milestone',
    processId: 'ice_harvester',
    threshold: 25,
  },
  {
    id: 'gravity_lord',
    name: 'Gravity Lord',
    emoji: '🕳️',
    desc: 'Own 25 Gravity Well Generators',
    hint: 'The pull becomes irresistible.',
    bonusDesc: '2x Gravity Well Generator production',
    condition: 'process_milestone',
    processId: 'gravity_well_gen',
    threshold: 25,
  },
  {
    id: 'refinery_baron',
    name: 'Refinery Baron',
    emoji: '🏗️',
    desc: 'Own 25 Ore Refineries',
    hint: 'Industrial might on a cosmic scale.',
    bonusDesc: '2x Ore Refinery production',
    condition: 'process_milestone',
    processId: 'ore_refinery',
    threshold: 25,
  },
  {
    id: 'core_master',
    name: 'Core Master',
    emoji: '💎',
    desc: 'Own 25 Core Compressors',
    hint: 'Pressure makes diamonds.',
    bonusDesc: '2x Core Compressor production',
    condition: 'process_milestone',
    processId: 'core_compressor',
    threshold: 25,
  },

  // ===================================================================
  // SYNERGY COMBOS (3) — Multi-process synergy bonuses
  // ===================================================================
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

  // ===================================================================
  // RESOURCE MILESTONES (4) — Hit big numbers
  // ===================================================================
  {
    id: 'mass_millionaire',
    name: 'Mass Millionaire',
    emoji: '💰',
    desc: 'Earn 1,000,000 total mass in a single run',
    hint: 'A million particles, give or take.',
    bonusDesc: '+10% all mass production',
    condition: 'resource_milestone',
    resource: 'runMassEarned',
    threshold: 1000000,
  },
  {
    id: 'gravity_king',
    name: 'Gravity King',
    emoji: '👑',
    desc: 'Reach 200+ gravity',
    hint: 'Gravity so strong, light bends around you.',
    bonusDesc: '+20% gravity generation',
    condition: 'resource_milestone',
    resource: 'gravity',
    threshold: 200,
  },
  {
    id: 'density_max',
    name: 'Maximum Density',
    emoji: '⬛',
    desc: 'Reach 95% density',
    hint: 'Almost a singularity...',
    bonusDesc: '+25% density gains',
    condition: 'resource_milestone',
    resource: 'density',
    threshold: 95,
  },
  {
    id: 'energy_hoarder',
    name: 'Energy Hoarder',
    emoji: '🔋',
    desc: 'Have 500+ max energy',
    hint: 'So much potential, so little drain.',
    bonusDesc: '+5% energy regen',
    condition: 'resource_milestone',
    resource: 'maxEnergy',
    threshold: 500,
  },

  // ===================================================================
  // PRESTIGE ACHIEVEMENTS (3) — Prestige milestones
  // ===================================================================
  {
    id: 'first_prestige',
    name: 'First Prestige',
    emoji: '🔄',
    desc: 'Prestige for the first time',
    hint: 'Everything old is new again.',
    bonusDesc: '+5% shard generation',
    condition: 'prestige_achievement',
    stat: 'totalPrestigeCount',
    threshold: 1,
  },
  {
    id: 'prestige_veteran',
    name: 'Prestige Veteran',
    emoji: '🎖️',
    desc: 'Prestige 10 times',
    hint: 'A seasoned traveler of the cosmic cycle.',
    bonusDesc: '+15% shard generation',
    condition: 'prestige_achievement',
    stat: 'totalPrestigeCount',
    threshold: 10,
  },
  {
    id: 'speed_runner',
    name: 'Speed Runner',
    emoji: '⚡',
    desc: 'Prestige in under 10 minutes',
    hint: 'Time is relative, but speed is absolute.',
    bonusDesc: '+10% all production',
    condition: 'prestige_achievement',
    stat: 'fastestPrestige',
    threshold: 600,
    comparison: 'less_than',
  },

  // ===================================================================
  // CLICK ACHIEVEMENTS (3) — Clicking milestones
  // ===================================================================
  {
    id: 'first_click',
    name: 'First Impact',
    emoji: '👆',
    desc: 'Click the asteroid for the first time',
    hint: 'Every journey begins with a single tap.',
    bonusDesc: 'Welcome to Impact!',
    condition: 'click_achievement',
    stat: 'totalClicks',
    threshold: 1,
  },
  {
    id: 'click_addict',
    name: 'Click Addict',
    emoji: '🖱️',
    desc: 'Click the asteroid 1,000 times',
    hint: 'Repetitive strain? Never heard of it.',
    bonusDesc: '+25% click value',
    condition: 'click_achievement',
    stat: 'totalClicks',
    threshold: 1000,
  },
  {
    id: 'combo_master',
    name: 'Combo Master',
    emoji: '🔥',
    desc: 'Reach a 50x click combo',
    hint: 'Keep tapping, the combo keeps climbing!',
    bonusDesc: '+50% combo multiplier cap',
    condition: 'click_achievement',
    stat: 'maxComboReached',
    threshold: 50,
  },

  // ===================================================================
  // COMET ACHIEVEMENTS (2) — Catching comets
  // ===================================================================
  {
    id: 'comet_catcher',
    name: 'Comet Catcher',
    emoji: '🌠',
    desc: 'Catch 10 comets',
    hint: 'Make a wish on each one.',
    bonusDesc: '+50% comet value',
    condition: 'comet_achievement',
    stat: 'cometsCaught',
    threshold: 10,
  },
  {
    id: 'comet_chain',
    name: 'Comet Chain',
    emoji: '☄️',
    desc: 'Catch 50 comets total',
    hint: 'Keep catching those space rocks...',
    bonusDesc: '+100% comet value',
    condition: 'comet_achievement',
    stat: 'cometsCaught',
    threshold: 50,
  },

  // ===================================================================
  // HIDDEN ACHIEVEMENTS (6) — Secret, weird, fun
  // ===================================================================
  {
    id: 'silent_giant',
    name: 'Silent Giant',
    emoji: '🤫',
    desc: 'Prestige without using any Orbital Mechanics',
    hint: '???',
    bonusDesc: '+10% shard generation',
    condition: 'prestige_condition',
    hidden: true,
    noOrbitalMechanics: true,
  },
  {
    id: 'cosmic_symmetry',
    name: 'Cosmic Symmetry',
    emoji: '⚖️',
    desc: 'Have density at exactly 50.0% (±0.5%)',
    hint: '???',
    bonusDesc: 'Special visual unlock',
    condition: 'density_exact',
    hidden: true,
    densityTarget: 50.0,
    densityTolerance: 0.5,
  },
  {
    id: 'indecisive',
    name: 'Indecisive',
    emoji: '🤷',
    desc: 'Toggle sound on and off 5 times quickly',
    hint: '???',
    bonusDesc: 'You earn the title of Most Indecisive!',
    condition: 'hidden_stat',
    hidden: true,
    stat: 'soundToggles',
    threshold: 5,
  },
  {
    id: 'backwards_builder',
    name: 'Backwards Builder',
    emoji: '🔙',
    desc: 'Own 100 Dust Collectors before owning any Meteor Magnets',
    hint: '???',
    bonusDesc: '+50% Dust Collector production',
    condition: 'backwards_builder',
    hidden: true,
  },
  {
    id: 'toggle_maniac',
    name: 'Toggle Maniac',
    emoji: '🎛️',
    desc: 'Toggle Orbital Mechanics 50 times total',
    hint: '???',
    bonusDesc: '-10% toggle energy drain',
    condition: 'hidden_stat',
    hidden: true,
    stat: 'totalOrbitalToggles',
    threshold: 50,
  },
  {
    id: 'weightless',
    name: 'Weightless',
    emoji: '🪶',
    desc: 'Have exactly 0 gravity with mass above 10,000',
    hint: '???',
    bonusDesc: 'Float on, cosmic wanderer',
    condition: 'hidden_weightless',
    hidden: true,
  },

  // ===================================================================
  // COMPOSITION ACHIEVEMENTS (2) — Composition-specific goals
  // ===================================================================
  {
    id: 'iron_will',
    name: 'Iron Will',
    emoji: '⚙️',
    desc: 'Reach 95% density as Iron',
    hint: 'Iron and density go hand in hand...',
    bonusDesc: '+25% density gains as Iron',
    condition: 'composition_density',
    compositionId: 'iron',
    densityThreshold: 95,
  },
  {
    id: 'ice_comets',
    name: 'Frozen Fortune',
    emoji: '❄️',
    desc: 'Catch 20 comets while using Ice composition',
    hint: 'Ice attracts cosmic visitors...',
    bonusDesc: '+50% comet spawn rate as Ice',
    condition: 'ice_comet_achievement',
  },
];

// List of all process IDs (used for process_diversity check)
const ALL_PROCESS_IDS = [
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

/**
 * Check game state against all discovery conditions.
 * Returns array of newly discovered IDs.
 *
 * NOTE: Some achievements (like silent_giant) are checked at prestige time
 * by calling checkPrestigeDiscoveries() separately.
 */
export function checkDiscoveries(state: GameState): string[] {
  const newDiscoveries: string[] = [];

  for (const discovery of DISCOVERIES) {
    // Already discovered — skip
    if (state.discoveries.includes(discovery.id)) continue;

    let discovered = false;

    switch (discovery.condition) {
      // === PROCESS MILESTONES: Own X of a specific process ===
      case 'process_milestone': {
        const owned = state.processes[discovery.processId] || 0;
        discovered = owned >= (discovery.threshold || 25);
        break;
      }

      // === SYNERGY COMBO: Own required amounts of two processes ===
      case 'synergy_combo': {
        const primary = state.processes[discovery.synergyTarget] || 0;
        const secondary = state.processes[discovery.secondaryTarget] || 0;
        discovered =
          primary >= (discovery.minOwned || 10) &&
          secondary >= (discovery.secondaryMinOwned || 5);
        break;
      }

      // === POSSESSION COMBO: Own at least 1 of two processes ===
      case 'possession_combo': {
        const primary = state.processes[discovery.primaryTarget] || 0;
        const secondary = state.processes[discovery.secondaryTarget] || 0;
        discovered = primary > 0 && secondary > 0;
        break;
      }

      // === PROCESS DIVERSITY: Own 1 of every process ===
      case 'process_diversity': {
        discovered = ALL_PROCESS_IDS.every(
          (id) => (state.processes[id] || 0) >= 1
        );
        break;
      }

      // === RESOURCE MILESTONES: Hit a numeric threshold ===
      case 'resource_milestone': {
        const value = (state as any)[discovery.resource] ?? 0;
        discovered = value >= (discovery.threshold || 0);
        break;
      }

      // === PRESTIGE ACHIEVEMENTS: Based on prestige stats ===
      case 'prestige_achievement': {
        const value = (state as any)[discovery.stat] ?? 0;
        if (discovery.comparison === 'less_than') {
          // For speed_runner: fastestPrestige < threshold AND > 0 (must have prestiged)
          discovered = value > 0 && value < (discovery.threshold || Infinity);
        } else {
          discovered = value >= (discovery.threshold || 0);
        }
        break;
      }

      // === CLICK ACHIEVEMENTS: Based on click stats ===
      case 'click_achievement': {
        const value = (state as any)[discovery.stat] ?? 0;
        discovered = value >= (discovery.threshold || 0);
        break;
      }

      // === COMET ACHIEVEMENTS: Based on comet count ===
      case 'comet_achievement': {
        const value = (state as any)[discovery.stat] ?? 0;
        discovered = value >= (discovery.threshold || 0);
        break;
      }

      // === HIDDEN STAT ACHIEVEMENTS ===
      case 'hidden_stat': {
        const value = (state as any)[discovery.stat] ?? 0;
        discovered = value >= (discovery.threshold || 0);
        break;
      }

      // === PRESTIGE CONDITION: Checked at prestige time only ===
      case 'prestige_condition': {
        // silent_giant: prestige without using OM
        // This is checked in checkPrestigeDiscoveries() below
        break;
      }

      // === DENSITY EXACT: Hit a specific density ===
      case 'density_exact': {
        const diff = Math.abs(state.density - (discovery.densityTarget || 50));
        discovered = diff <= (discovery.densityTolerance || 0.5);
        break;
      }

      // === BACKWARDS BUILDER: 100 dust collectors, 0 meteor magnets ===
      case 'backwards_builder': {
        const dustCount = state.processes['dust_collector'] || 0;
        const meteorCount = state.processes['meteor_magnet'] || 0;
        discovered = dustCount >= 100 && meteorCount === 0;
        break;
      }

      // === WEIGHTLESS: 0 gravity with mass > 10k ===
      case 'hidden_weightless': {
        discovered = state.gravity <= 0 && state.mass >= 10000;
        break;
      }

      // === COMPOSITION DENSITY: High density as specific composition ===
      case 'composition_density': {
        if (state.composition === discovery.compositionId) {
          discovered = state.density >= (discovery.densityThreshold || 0);
        }
        break;
      }

      // === ICE COMET ACHIEVEMENT: Catch comets as Ice ===
      case 'ice_comet_achievement': {
        discovered =
          state.composition === 'ice' && state.cometsCaught >= 20;
        break;
      }
    }

    if (discovered) {
      newDiscoveries.push(discovery.id);
    }
  }

  return newDiscoveries;
}

/**
 * Check for discoveries that should trigger at prestige time.
 * Call this BEFORE the prestige reset.
 */
export function checkPrestigeDiscoveries(state: GameState): string[] {
  const newDiscoveries: string[] = [];

  // Silent Giant: Prestige without using any Orbital Mechanics
  if (
    !state.discoveries.includes('silent_giant') &&
    !state.omUsedThisRun
  ) {
    newDiscoveries.push('silent_giant');
  }

  // Speed Runner: Check if this run was fast enough
  if (
    !state.discoveries.includes('speed_runner') &&
    state.runTime > 0 &&
    state.runTime < 600
  ) {
    newDiscoveries.push('speed_runner');
  }

  return newDiscoveries;
}

/**
 * Get a discovery by ID
 */
export function getDiscovery(id: string): DiscoveryData | undefined {
  return DISCOVERIES.find((d) => d.id === id);
}

/**
 * Get all undiscovered discoveries (for hint display)
 * Hidden discoveries show "???" for everything until discovered
 */
export function getUndiscoveredHints(state: GameState): { id: string; hint: string; hidden: boolean }[] {
  return DISCOVERIES
    .filter((d) => !state.discoveries.includes(d.id))
    .map((d) => ({
      id: d.id,
      hint: d.hidden ? '???' : d.hint,
      hidden: !!d.hidden,
    }));
}

/**
 * Check if a specific process has a milestone bonus active
 */
export function hasProcessMilestone(processId: string, discoveries: string[]): boolean {
  const milestone = DISCOVERIES.find(
    (d) => d.condition === 'process_milestone' && d.processId === processId
  );
  return milestone ? discoveries.includes(milestone.id) : false;
}

import { GameState } from './types';

export type BoostType = 'productionBoost' | 'prestigeDouble' | 'massDrop';

export interface BoostDef {
  id: BoostType;
  name: string;
  emoji: string;
  desc: string;
  adLabel: string;   // text when ads enabled
  freeLabel: string;  // text when ads removed
  duration?: number;  // seconds (for timed boosts)
  cooldown?: number;  // seconds (for cooldown-based boosts)
}

export const BOOST_DEFS: BoostDef[] = [
  {
    id: 'productionBoost',
    name: '2x Production',
    emoji: '⚡',
    desc: 'Double all mass production for 30 minutes',
    adLabel: 'Watch Ad',
    freeLabel: 'Boost',
    duration: 1800, // 30 minutes
  },
  {
    id: 'prestigeDouble',
    name: '2x Shards',
    emoji: '💎',
    desc: 'Double shards on your next prestige',
    adLabel: 'Watch Ad',
    freeLabel: 'Boost',
  },
  {
    id: 'massDrop',
    name: 'Mass Drop',
    emoji: '🎁',
    desc: 'Instantly gain 10% of your lifetime mass',
    adLabel: 'Watch Ad',
    freeLabel: 'Boost',
    cooldown: 300, // 5 min cooldown
  },
];

/**
 * Activate a boost. Returns updated state or null if boost can't be activated.
 */
export function applyBoost(type: BoostType, state: GameState): GameState | null {
  const now = Date.now();

  switch (type) {
    case 'productionBoost': {
      if (state.boosts.productionBoost.active && state.boosts.productionBoost.endsAt > now) {
        // Extend existing boost
        return {
          ...state,
          boosts: {
            ...state.boosts,
            productionBoost: {
              active: true,
              endsAt: state.boosts.productionBoost.endsAt + 1800000, // +30 min
            },
          },
        };
      }
      return {
        ...state,
        boosts: {
          ...state.boosts,
          productionBoost: {
            active: true,
            endsAt: now + 1800000, // 30 min from now
          },
        },
      };
    }
    case 'prestigeDouble': {
      if (state.boosts.prestigeDouble.active) return null; // Already queued
      return {
        ...state,
        boosts: {
          ...state.boosts,
          prestigeDouble: { active: true, usedThisRun: false },
        },
      };
    }
    case 'massDrop': {
      const cooldownEnd = state.boosts.massDrop.lastUsed + 300000; // 5 min
      if (now < cooldownEnd) return null; // On cooldown
      const dropAmount = state.totalMassEarned * 0.1;
      return {
        ...state,
        mass: state.mass + dropAmount,
        runMassEarned: state.runMassEarned + dropAmount,
        totalMassEarned: state.totalMassEarned + dropAmount,
        boosts: {
          ...state.boosts,
          massDrop: { lastUsed: now },
        },
      };
    }
    default:
      return null;
  }
}

/**
 * Check if a boost is currently active
 */
export function isBoostActive(type: BoostType, state: GameState): boolean {
  const now = Date.now();
  switch (type) {
    case 'productionBoost':
      return state.boosts.productionBoost.active && state.boosts.productionBoost.endsAt > now;
    case 'prestigeDouble':
      return state.boosts.prestigeDouble.active && !state.boosts.prestigeDouble.usedThisRun;
    case 'massDrop':
      return false; // Instant effect, not "active"
    default:
      return false;
  }
}

/**
 * Get remaining time for a timed boost (seconds)
 */
export function getBoostTimeRemaining(type: BoostType, state: GameState): number {
  const now = Date.now();
  switch (type) {
    case 'productionBoost':
      if (state.boosts.productionBoost.active && state.boosts.productionBoost.endsAt > now) {
        return Math.ceil((state.boosts.productionBoost.endsAt - now) / 1000);
      }
      return 0;
    default:
      return 0;
  }
}

/**
 * Get cooldown remaining for massDrop (seconds)
 */
export function getMassDropCooldown(state: GameState): number {
  const now = Date.now();
  const cooldownEnd = state.boosts.massDrop.lastUsed + 300000;
  if (now >= cooldownEnd) return 0;
  return Math.ceil((cooldownEnd - now) / 1000);
}

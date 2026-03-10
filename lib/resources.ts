import { GameState, PrestigeTier } from './types';
import { CORE_UPGRADES } from './upgrades';

/**
 * Calculates the gravity multiplier based on current gravity value.
 * - 0 gravity: 0.5x (penalty for no gravity)
 * - 0-50: linearly interpolate from 0.5 to 1.0
 * - 50-100: 1.0 (neutral)
 * - 100-300: gradually scale from 1.0 to 2.0 (bonus zone)
 */
export function getGravityMultiplier(gravity: number): number {
  if (gravity <= 0) return 0.5;
  if (gravity < 50) {
    return 0.5 + (gravity / 50) * 0.5;
  }
  if (gravity <= 100) {
    return 1.0;
  }
  const excess = Math.min(gravity - 100, 200);
  return 1.0 + (excess / 200) * 1.0;
}

/**
 * Returns a human-friendly label for the gravity multiplier zone
 */
export function getGravityZone(gravity: number): { label: string; color: string } {
  if (gravity <= 0) return { label: 'Critical', color: '#ff4444' };
  if (gravity < 50) return { label: 'Low', color: '#ff8800' };
  if (gravity <= 100) return { label: 'Stable', color: '#88cc44' };
  if (gravity <= 200) return { label: 'Strong', color: '#44ddff' };
  return { label: 'Massive', color: '#cc44ff' };
}

/**
 * Calculates the density multiplier based on density percentage.
 * - 0%: 0.5x (halved production — bad!)
 * - 0-50%: linearly interpolate 0.5 to 0.75
 * - 50-100%: linearly interpolate 0.75 to 1.5 (bonus zone)
 */
export function getDensityMultiplier(density: number): number {
  const clampedDensity = Math.max(0, Math.min(100, density));
  if (clampedDensity <= 0) return 0.5;
  if (clampedDensity < 50) {
    return 0.5 + (clampedDensity / 50) * 0.25;
  }
  const above50 = clampedDensity - 50;
  return 0.75 + (above50 / 50) * 0.75;
}

/**
 * Returns a human-friendly label for the density zone
 */
export function getDensityZone(density: number): { label: string; color: string } {
  if (density <= 10) return { label: 'Dispersed', color: '#ff4444' };
  if (density < 50) return { label: 'Thin', color: '#ff8800' };
  if (density < 75) return { label: 'Dense', color: '#88cc44' };
  return { label: 'Ultra-Dense', color: '#cc44ff' };
}

/**
 * Calculates the density decay per second based on prestige tier.
 * Formula: 0.001 * (1 + tier * 0.5)
 */
export function getDensityDecay(tier: PrestigeTier): number {
  return 0.001 * (1 + tier * 0.5);
}

/**
 * Calculates the energy regeneration rate per second.
 *
 * BALANCE DESIGN:
 * Base regen: 2.5/sec (sustains 1 cheap toggle from the start)
 * + 0.5/sec per prestige tier (permanent scaling — tier 3 = +1.5/sec)
 * + energy_regen upgrade: +1.0/sec per level (5 levels = +5.0/sec)
 * + kinetic_resonance: ×1.5 multiplicative
 * + energy_siphon toggle: +1.5/sec (gravity tradeoff)
 *
 * Progression curve:
 * - Tier 0, no upgrades: 2.5/sec (run 1 toggle)
 * - Tier 0, energy_regen 3: 5.5/sec (run 2 toggles)
 * - Tier 1, energy_regen 5 + kinetic: 12.0/sec (run 3-4 toggles)
 * - Tier 3, maxed energy path: ~18/sec (run most toggles)
 * - Tier 5, everything: ~22/sec (run all toggles)
 */
export function getEnergyRegen(state: GameState): number {
  // Base: 2.5 + 0.5 per prestige tier
  let baseRegen = 2.5 + state.currentTier * 0.5 + state.energyRegen;

  // energy_regen upgrade: +1.0/sec per level (was 0.5)
  const energyRegenUpgrade = state.coreUpgrades['energy_regen'] || 0;
  baseRegen += energyRegenUpgrade * 1.0;

  // kinetic_resonance: ×1.5 multiplicative
  const kineticResonance = state.coreUpgrades['kinetic_resonance'] || 0;
  const multiplier = 1 + kineticResonance * 0.5;

  let regen = baseRegen * multiplier;

  // Energy Siphon toggle: +1.5 regen (was 0.5 — now worth the gravity tradeoff)
  if (state.omToggles?.['energy_siphon']) {
    regen += 1.5;
  }

  return regen;
}

/**
 * Calculates the maximum energy capacity.
 * Base: 100 + 50 per energy_capacity level + 50 per prestige tier
 */
export function getMaxEnergy(state: GameState): number {
  let base = 100;
  const capacityUpgrade = state.coreUpgrades['energy_capacity'] || 0;
  base += capacityUpgrade * 50;
  base += state.currentTier * 50;
  return base;
}

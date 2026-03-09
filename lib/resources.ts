import { GameState, PrestigeTier } from './types';
import { CORE_UPGRADES } from './upgrades';

/**
 * Calculates the gravity multiplier based on current gravity value.
 * - 0-50: linearly interpolate from 0.5 to 1.0
 * - 50-100: 1.0 (no bonus yet)
 * - 100-300: gradually scale from 1.0 to 2.0
 */
export function getGravityMultiplier(gravity: number): number {
  if (gravity <= 0) return 0.5;
  if (gravity < 50) {
    // Linear interpolation from 0.5 to 1.0
    return 0.5 + (gravity / 50) * 0.5;
  }
  if (gravity <= 100) {
    return 1.0;
  }
  // From 100-300, scale 1.0 to 2.0
  const excess = Math.min(gravity - 100, 200);
  return 1.0 + (excess / 200) * 1.0;
}

/**
 * Calculates the density multiplier based on density percentage.
 * - 0%: 0.5 (halved production)
 * - 0-50%: linearly interpolate 0.5 to 0.75
 * - 50-100%: linearly interpolate 0.75 to 1.5
 * - Every 10% above 50% adds +0.15
 */
export function getDensityMultiplier(density: number): number {
  // Clamp density to valid range
  const clampedDensity = Math.max(0, Math.min(100, density));

  if (clampedDensity <= 0) {
    return 0.5;
  }
  if (clampedDensity < 50) {
    // Linear interpolation from 0.5 to 0.75
    return 0.5 + (clampedDensity / 50) * 0.25;
  }
  // From 50-100%, interpolate 0.75 to 1.5
  const above50 = clampedDensity - 50;
  return 0.75 + (above50 / 50) * 0.75;
}

/**
 * Calculates the density decay per second based on prestige tier.
 * Formula: 0.001 * (1 + tier * 0.5)
 * - Tier 0: 0.001/s
 * - Tier 5: 0.0035/s
 */
export function getDensityDecay(tier: PrestigeTier): number {
  return 0.001 * (1 + tier * 0.5);
}

/**
 * Calculates the energy regeneration rate per second.
 * Base: 1/sec (slow — energy is a strategic resource)
 * + state.energyRegen (from upgrades)
 * + core upgrade bonuses:
 *   - energy_regen: +0.5/sec per level
 *   - kinetic_resonance: +50% per level (multiplicative)
 */
export function getEnergyRegen(state: GameState): number {
  let baseRegen = 1 + state.energyRegen;

  // Apply energy_regen core upgrade (+0.5/sec per level)
  const energyRegenUpgrade = state.coreUpgrades['energy_regen'] || 0;
  baseRegen += energyRegenUpgrade * 0.5;

  // Apply kinetic_resonance multiplicative bonus
  const kineticResonance = state.coreUpgrades['kinetic_resonance'] || 0;
  const multiplier = 1 + kineticResonance * 0.5;

  return baseRegen * multiplier;
}

/**
 * Calculates the maximum energy capacity.
 * Base: 100
 * + 50 per energy_capacity core upgrade level
 * + 50 per prestige tier
 */
export function getMaxEnergy(state: GameState): number {
  let base = 100;

  // Add energy_capacity upgrade bonus
  const capacityUpgrade = state.coreUpgrades['energy_capacity'] || 0;
  base += capacityUpgrade * 50;

  // Add prestige tier bonus
  base += state.currentTier * 50;

  return base;
}

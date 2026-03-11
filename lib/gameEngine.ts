import { GameState } from './types';
import { getComposition } from './compositions';
import { PROCESSES } from './processes';
import { ORBITAL_MECHANICS, getTotalEnergyDrain } from './orbitalMechanics';
import {
  getGravityMultiplier,
  getDensityMultiplier,
  getDensityDecay,
  getEnergyRegen,
  getMaxEnergy,
} from './resources';
import { calcShards } from './prestige';
import { hasProcessMilestone } from './discoveries';

/**
 * Calculates production for a single process.
 * Applies all bonuses: composition, synergy, core upgrades, gravity, density, orbital mechanics, discoveries.
 */
export function getProcessProduction(
  processId: string,
  state: GameState,
): { mass: number; gravity: number; density: number } {
  const processDef = PROCESSES.find(p => p.id === processId);
  if (!processDef) {
    return { mass: 0, gravity: 0, density: 0 };
  }

  const count = state.processes[processId] || 0;
  if (count === 0) {
    return { mass: 0, gravity: 0, density: 0 };
  }

  // Base production
  let massProduction = processDef.baseMPS * count;
  let gravityProduction = processDef.gravityPS * count;
  let densityProduction = processDef.densityPS * count;

  // Apply composition multiplier
  if (state.composition) {
    const composition = getComposition(state.composition);
    if (composition) {
      massProduction *= composition.massProductionMult;
      gravityProduction *= composition.gravityMult;
      densityProduction *= composition.densityMult;
    }
  }

  // Apply synergy bonus
  if (processDef.synergyTarget) {
    const synergyTargetCount = state.processes[processDef.synergyTarget] || 0;
    if (synergyTargetCount > 0) {
      let composition = state.composition ? getComposition(state.composition) : null;
      const compSynergyMult = composition?.synergyMult || 1;

      let synergyBonus = 0.1 * synergyTargetCount * compSynergyMult;
      if (state.discoveries.includes('magnetic_polarity')) {
        synergyBonus *= 2;
      }

      const synergyMult = 1 + synergyBonus;
      massProduction *= synergyMult;
      gravityProduction *= synergyMult;
      densityProduction *= synergyMult;
    }
  }

  // Apply process milestone bonus (2x from achievements — AdCap style)
  if (hasProcessMilestone(processId, state.discoveries)) {
    massProduction *= 2;
    gravityProduction *= 2;
    densityProduction *= 2;
  }

  // Apply core upgrade bonuses
  const processEfficiency = state.coreUpgrades['process_efficiency'] || 0;
  const massBoost = state.coreUpgrades['mass_boost'] || 0;
  massProduction *= 1 + processEfficiency * 0.1 + massBoost * 0.05;

  // Apply gravity multiplier
  const gravityMult = getGravityMultiplier(state.gravity);
  massProduction *= gravityMult;
  gravityProduction *= gravityMult;

  // Apply density multiplier
  const densityMult = getDensityMultiplier(state.density);
  massProduction *= densityMult;
  densityProduction *= densityMult;

  // ===== TOGGLE EFFECTS =====
  // Mass Pump: 1.3x mass
  if (state.omToggles?.['mass_pump']) {
    massProduction *= 1.3;
  }
  // Temporal Flow: 1.5x ALL
  if (state.omToggles?.['temporal_flow']) {
    massProduction *= 1.5;
    gravityProduction *= 1.5;
    densityProduction *= 1.5;
  }
  // Gravity Vortex: 2x gravity
  if (state.omToggles?.['gravity_vortex']) {
    gravityProduction *= 2;
  }
  // Density Forge: 2x density
  if (state.omToggles?.['density_forge']) {
    densityProduction *= 2;
  }

  // ===== ONE-SHOT ACTIVE EFFECTS =====
  // Synergy Cascade: 2x synergy portion
  if (state.omActive['synergy_cascade'] && state.omActive['synergy_cascade'] > 0) {
    if (processDef.synergyTarget) {
      const synergyTargetCount = state.processes[processDef.synergyTarget] || 0;
      if (synergyTargetCount > 0) {
        massProduction *= 2;
        gravityProduction *= 2;
      }
    }
  }
  // Chromatic Burst: 3x mass
  if (state.omActive['chromatic_burst'] && state.omActive['chromatic_burst'] > 0) {
    massProduction *= 3;
  }

  // Apply production boost (2x from ad/boost)
  if (state.boosts?.productionBoost?.active && state.boosts.productionBoost.endsAt > Date.now()) {
    massProduction *= 2;
    gravityProduction *= 2;
    densityProduction *= 2;
  }

  // Apply discovery bonuses
  if (state.discoveries.includes('ancient_harmony')) {
    massProduction *= 1.5;
    gravityProduction *= 1.5;
    densityProduction *= 1.5;
  }

  if (state.discoveries.includes('stellar_furnace') && processId === 'fusion_forge') {
    massProduction *= 3.5;
    gravityProduction *= 3.5;
  }

  // Mass Millionaire: +10% all mass production
  if (state.discoveries.includes('mass_millionaire')) {
    massProduction *= 1.1;
  }

  // Gravity King: +20% gravity generation
  if (state.discoveries.includes('gravity_king')) {
    gravityProduction *= 1.2;
  }

  // Maximum Density: +25% density gains
  if (state.discoveries.includes('density_max')) {
    densityProduction *= 1.25;
  }

  // Speed Runner: +10% all production
  if (state.discoveries.includes('speed_runner')) {
    massProduction *= 1.1;
    gravityProduction *= 1.1;
    densityProduction *= 1.1;
  }

  // Iron Will: +25% density gains as Iron
  if (state.discoveries.includes('iron_will') && state.composition === 'iron') {
    densityProduction *= 1.25;
  }

  // Backwards Builder: +50% Dust Collector production
  if (state.discoveries.includes('backwards_builder') && processId === 'dust_collector') {
    massProduction *= 1.5;
  }

  return {
    mass: massProduction,
    gravity: gravityProduction,
    density: densityProduction,
  };
}

/**
 * Calculates total production from all processes.
 */
export function getTotalProduction(
  state: GameState,
): { mass: number; gravity: number; density: number } {
  let totalMass = 0;
  let totalGravity = 0;
  let totalDensity = 0;

  for (const processDef of PROCESSES) {
    const production = getProcessProduction(processDef.id, state);
    totalMass += production.mass;
    totalGravity += production.gravity;
    totalDensity += production.density;
  }

  // Apply composition-specific multipliers
  if (state.composition) {
    const composition = getComposition(state.composition);
    if (composition) {
      totalGravity *= composition.gravityMult;
      totalDensity *= composition.densityMult;
    }
  }

  return {
    mass: totalMass,
    gravity: totalGravity,
    density: totalDensity,
  };
}

/**
 * Calculates the current mass gained per second from all processes.
 */
export function getMassPerSecond(state: GameState): number {
  const production = getTotalProduction(state);
  return production.mass;
}

/**
 * Calculates the value of a single click.
 */
export function getClickValue(state: GameState, comboMultiplier: number = 1): number {
  const mps = getMassPerSecond(state);
  let value = 1 + mps * 0.1;

  if (state.composition) {
    const composition = getComposition(state.composition);
    if (composition) {
      value *= composition.clickMult;
    }
  }

  const clickScaling = Math.min(1 + state.totalClicks * 0.0001, 2);
  value *= clickScaling;

  value *= comboMultiplier;

  // Meteor Strike one-shot: 5x click power
  if (state.omActive['meteor_strike'] && state.omActive['meteor_strike'] > 0) {
    value *= 5;
  }

  // Click Addict: +25% click value
  if (state.discoveries.includes('click_addict')) {
    value *= 1.25;
  }

  return value;
}

/**
 * Processes a single click action.
 */
export function processClick(state: GameState, comboMultiplier: number = 1): GameState {
  const clickValue = getClickValue(state, comboMultiplier);

  return {
    ...state,
    mass: state.mass + clickValue,
    runMassEarned: state.runMassEarned + clickValue,
    totalMassEarned: state.totalMassEarned + clickValue,
    totalClicks: state.totalClicks + 1,
  };
}

/**
 * Processes a time tick (main game loop).
 */
export function processTick(state: GameState, dt: number): GameState {
  let newState = { ...state };

  // Calculate and apply production
  const production = getTotalProduction(newState);
  newState.mass += production.mass * dt;
  newState.gravity += production.gravity * dt;
  newState.density += production.density * dt;
  newState.runMassEarned += production.mass * dt;
  newState.totalMassEarned += production.mass * dt;

  // ===== TOGGLE DIRECT EFFECTS (gravity/density per sec) =====
  if (newState.omToggles?.['gravity_harness']) {
    newState.gravity += 0.2 * dt;
  }
  if (newState.omToggles?.['density_pulse']) {
    newState.density += 0.003 * dt;
  }
  if (newState.omToggles?.['gravity_brake']) {
    newState.gravity -= 0.15 * dt;
  }
  if (newState.omToggles?.['density_vent']) {
    newState.density -= 0.005 * dt;
  }
  if (newState.omToggles?.['energy_siphon']) {
    newState.gravity -= 0.1 * dt; // tradeoff: lose gravity for energy regen
  }

  // Apply density decay
  const decayRate = getDensityDecay(newState.currentTier);
  newState.density -= decayRate * dt;

  // Clamp values to valid ranges
  newState.gravity = Math.max(0, Math.min(300, newState.gravity));
  newState.density = Math.max(0, Math.min(100, newState.density));

  // ===== ENERGY: regen then drain from toggles =====
  const maxEnergy = getMaxEnergy(newState);
  const energyRegen = getEnergyRegen(newState);
  let totalDrain = getTotalEnergyDrain(newState.omToggles || {});
  // Toggle Maniac discovery: -10% toggle energy drain
  if (newState.discoveries.includes('toggle_maniac')) {
    totalDrain *= 0.9;
  }
  const netEnergy = energyRegen - totalDrain;
  newState.energy += netEnergy * dt;

  // Cap at max
  newState.energy = Math.min(maxEnergy, newState.energy);

  // Auto-disable all toggles if energy depleted
  if (newState.energy <= 0) {
    newState.energy = 0;
    const newToggles = { ...newState.omToggles };
    for (const key in newToggles) {
      newToggles[key] = false;
    }
    newState.omToggles = newToggles;
  }

  // Handle energy overflow (if energy_overflow upgrade owned)
  if (newState.coreUpgrades['energy_overflow'] && newState.coreUpgrades['energy_overflow'] > 0) {
    if (newState.energy >= maxEnergy) {
      const overflow = newState.energy - maxEnergy;
      newState.mass += overflow * 1000;
      newState.energy = maxEnergy;
    }
  }

  // Decrement orbital mechanic cooldowns (one-shots)
  const newCooldowns = { ...newState.omCooldowns };
  for (const omId in newCooldowns) {
    newCooldowns[omId] = Math.max(0, newCooldowns[omId] - dt);
  }
  newState.omCooldowns = newCooldowns;

  // Decrement orbital mechanic active durations (one-shots)
  const newActive = { ...newState.omActive };
  for (const omId in newActive) {
    const newDuration = newActive[omId] - dt;
    if (newDuration <= 0) {
      delete newActive[omId];
    } else {
      newActive[omId] = newDuration;
    }
  }
  newState.omActive = newActive;

  // Handle comet spawning for Ice composition
  if (newState.composition === 'ice') {
    newState.nextCometIn -= dt;
    if (newState.nextCometIn <= 0) {
      newState = spawnVisualComet(newState);
    }
  }

  // Update active comets — drift and expire
  if (newState.activeComets && newState.activeComets.length > 0) {
    const autoCaptureLevel = newState.coreUpgrades['comet_magnet'] || 0;
    const autoCaptureChance = autoCaptureLevel * 0.2; // 20% per level, max 100% at level 5
    let updatedComets: typeof newState.activeComets = [];
    for (const comet of newState.activeComets) {
      const updated = { ...comet, timeLeft: comet.timeLeft - dt };
      // Drift the comet
      updated.x += Math.cos(updated.angle) * updated.speed * dt;
      updated.y += Math.sin(updated.angle) * updated.speed * dt;
      // Bounce off edges
      if (updated.x < 5 || updated.x > 95) updated.angle = Math.PI - updated.angle;
      if (updated.y < 5 || updated.y > 85) updated.angle = -updated.angle;
      updated.x = Math.max(5, Math.min(95, updated.x));
      updated.y = Math.max(5, Math.min(85, updated.y));

      if (updated.timeLeft <= 0) {
        // Expired — auto-capture check
        if (autoCaptureChance > 0 && Math.random() < autoCaptureChance) {
          newState = { ...newState, mass: newState.mass + updated.value, cometsCaught: newState.cometsCaught + 1 };
        }
        // else comet is lost
      } else {
        updatedComets.push(updated);
      }
    }
    newState.activeComets = updatedComets;
  }

  // Handle charge cooldown for Carbonaceous
  if (newState.composition === 'carbonaceous' && newState.chargeCooldown > 0) {
    newState.chargeCooldown -= dt;
  }

  // Update time tracking
  newState.runTime += dt;
  newState.totalPlayTime += dt;

  // Update highest mass reached
  if (newState.mass > newState.highestMass) {
    newState.highestMass = newState.mass;
  }

  return newState;
}

/**
 * Activates or toggles an orbital mechanic.
 * For toggles: flips on/off. For one-shots: existing cooldown-based logic.
 */
export function activateOrbitalMechanic(omId: string, state: GameState): GameState | null {
  const omDef = ORBITAL_MECHANICS.find(o => o.id === omId);
  if (!omDef) {
    return null;
  }

  let newState = { ...state };

  // === TOGGLE MECHANIC ===
  if (omDef.isToggle) {
    const currentlyOn = newState.omToggles?.[omId] || false;

    if (currentlyOn) {
      // Turn OFF
      newState.omToggles = { ...newState.omToggles, [omId]: false };
      return newState;
    } else {
      // Turn ON — check startup energy
      if (newState.energy < omDef.energyCost) {
        return null; // Not enough energy for startup
      }
      newState.energy -= omDef.energyCost;
      newState.omToggles = { ...newState.omToggles, [omId]: true };
      return newState;
    }
  }

  // === ONE-SHOT MECHANIC ===
  if (newState.energy < omDef.energyCost) {
    return null;
  }

  const cooldown = newState.omCooldowns[omId] || 0;
  if (cooldown > 0) {
    return null;
  }

  // Deduct energy
  newState.energy -= omDef.energyCost;

  // Set cooldown
  newState.omCooldowns = { ...newState.omCooldowns, [omId]: omDef.cooldown };

  // If has duration, set as active
  if (omDef.duration > 0) {
    newState.omActive = { ...newState.omActive, [omId]: omDef.duration };
  }

  // Special handling
  switch (omId) {
    case 'singularity_pull':
      if (newState.singularityUsed) {
        return null;
      }
      // Convert all mass into gravity
      const gravGain = Math.min(300 - newState.gravity, newState.mass * 0.001);
      newState.gravity = Math.min(300, newState.gravity + gravGain);
      newState.mass = 0;
      newState.singularityUsed = true;
      break;
  }

  return newState;
}

/**
 * Purchases a process for the given count.
 */
export function buyProcess(
  processId: string,
  count: number,
  state: GameState,
): GameState | null {
  const processDef = PROCESSES.find(p => p.id === processId);
  if (!processDef) {
    return null;
  }

  let costPerUnit = processDef.baseCost;

  // Process Optimizer toggle: 40% off
  if (state.omToggles?.['process_optimizer']) {
    costPerUnit *= 0.6;
  }

  const totalCost = costPerUnit * count;

  if (state.mass < totalCost) {
    return null;
  }

  return {
    ...state,
    mass: state.mass - totalCost,
    processes: {
      ...state.processes,
      [processId]: (state.processes[processId] || 0) + count,
    },
  };
}

/**
 * Calculate comet value based on current state.
 */
export function getCometValue(state: GameState): number {
  let value = (state.mass + state.gravity * 100 + state.density * 1000) * 0.05;

  if (state.composition === 'ice') {
    value *= 1.5;
  }

  // Comet Catcher: +50% comet value
  if (state.discoveries.includes('comet_catcher')) {
    value *= 1.5;
  }

  // Comet Chain: +100% comet value (stacks)
  if (state.discoveries.includes('comet_chain')) {
    value *= 2;
  }

  return value;
}

/**
 * Get next comet interval based on state.
 */
function getNextCometInterval(state: GameState): number {
  if (state.composition === 'ice') {
    let cometInterval = 3 + Math.random() * 5;
    if (state.discoveries.includes('ice_comets')) {
      cometInterval *= 0.67;
    }
    return cometInterval;
  }
  return 15 + Math.random() * 15;
}

/**
 * Spawns a visual comet on screen (does NOT auto-grant mass).
 */
export function spawnVisualComet(state: GameState): GameState {
  const value = getCometValue(state);
  const newComet = {
    id: Date.now() + Math.random(),
    value,
    x: 10 + Math.random() * 80, // 10-90% horizontal
    y: 10 + Math.random() * 60, // 10-70% vertical
    timeLeft: 5, // 5 seconds to tap
    speed: 3 + Math.random() * 4, // drift speed
    angle: Math.random() * Math.PI * 2, // random direction
  };

  return {
    ...state,
    activeComets: [...(state.activeComets || []), newComet],
    nextCometIn: getNextCometInterval(state),
  };
}

/**
 * Catch (tap) a comet — grants its mass value.
 */
export function catchComet(state: GameState, cometId: number): { state: GameState; value: number } {
  const comet = (state.activeComets || []).find(c => c.id === cometId);
  if (!comet) return { state, value: 0 };

  return {
    state: {
      ...state,
      mass: state.mass + comet.value,
      cometsCaught: state.cometsCaught + 1,
      activeComets: (state.activeComets || []).filter(c => c.id !== cometId),
    },
    value: comet.value,
  };
}

/**
 * Legacy spawnComet — used for offline gains calculation.
 * Instantly grants mass (for offline auto-capture).
 */
export function spawnComet(state: GameState): { state: GameState; value: number } {
  const value = getCometValue(state);

  let newState = {
    ...state,
    mass: state.mass + value,
    cometsCaught: state.cometsCaught + 1,
    nextCometIn: getNextCometInterval(state),
  };

  return { state: newState, value };
}

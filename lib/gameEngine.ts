import { GameState } from './types';
import { getComposition } from './compositions';
import { PROCESSES } from './processes';
import { ORBITAL_MECHANICS } from './orbitalMechanics';
import {
  getGravityMultiplier,
  getDensityMultiplier,
  getDensityDecay,
  getEnergyRegen,
  getMaxEnergy,
} from './resources';
import { calcShards } from './prestige';

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

      // Check for magnetic_polarity discovery bonus
      let synergyBonus = 0.1 * synergyTargetCount * compSynergyMult;
      if (state.discoveries.includes('magnetic_polarity')) {
        synergyBonus *= 2; // +100% synergy strength
      }

      const synergyMult = 1 + synergyBonus;
      massProduction *= synergyMult;
      gravityProduction *= synergyMult;
      densityProduction *= synergyMult;
    }
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

  // Apply orbital mechanics
  if (state.omActive['gravitational_focus'] && state.omActive['gravitational_focus'] > 0) {
    massProduction *= 1.5;
    gravityProduction *= 1.5;
  }

  // Resonance cascade: triple synergy bonus portion
  if (state.omActive['resonance_cascade'] && state.omActive['resonance_cascade'] > 0) {
    if (processDef.synergyTarget) {
      const synergyTargetCount = state.processes[processDef.synergyTarget] || 0;
      if (synergyTargetCount > 0) {
        // Apply extra 2x multiplier to synergy portion (triple total)
        massProduction *= 2;
        gravityProduction *= 2;
      }
    }
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

  if (
    state.discoveries.includes('tectonic_master') &&
    state.composition === 'silicate'
  ) {
    massProduction *= 1.5;
    gravityProduction *= 1.5;
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
 * Calculates the value of a single click.
 * Base: 1
 * * composition clickMult
 * * (1 + totalClicks * 0.0001) capped at 2x
 * * 5 if meteor_barrage active
 */
export function getClickValue(state: GameState): number {
  let value = 1;

  // Apply composition multiplier
  if (state.composition) {
    const composition = getComposition(state.composition);
    if (composition) {
      value *= composition.clickMult;
    }
  }

  // Apply click scaling (capped at 2x)
  const clickScaling = Math.min(1 + state.totalClicks * 0.0001, 2);
  value *= clickScaling;

  // Apply meteor_barrage multiplier
  if (state.omActive['meteor_barrage'] && state.omActive['meteor_barrage'] > 0) {
    value *= 5;
  }

  return value;
}

/**
 * Processes a single click action.
 */
export function processClick(state: GameState): GameState {
  const clickValue = getClickValue(state);

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
 * Handles production, decay, energy regen, cooldowns, comets, and state updates.
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

  // Apply density decay
  const decayRate = getDensityDecay(newState.currentTier);
  newState.density -= decayRate * dt;

  // Clamp values to valid ranges
  newState.gravity = Math.max(0, Math.min(300, newState.gravity));
  newState.density = Math.max(0, Math.min(100, newState.density));

  // Handle energy regeneration
  const maxEnergy = getMaxEnergy(newState);
  const energyRegen = getEnergyRegen(newState);
  newState.energy = Math.min(maxEnergy, newState.energy + energyRegen * dt);

  // Handle energy overflow (if energy_overflow upgrade owned)
  if (newState.coreUpgrades['energy_overflow'] && newState.coreUpgrades['energy_overflow'] > 0) {
    if (newState.energy >= maxEnergy) {
      const overflow = newState.energy - maxEnergy;
      newState.mass += overflow * 1000; // Convert excess to mass at 1000:1
      newState.energy = maxEnergy;
    }
  }

  // Decrement orbital mechanic cooldowns
  const newCooldowns = { ...newState.omCooldowns };
  for (const omId in newCooldowns) {
    newCooldowns[omId] = Math.max(0, newCooldowns[omId] - dt);
  }
  newState.omCooldowns = newCooldowns;

  // Decrement orbital mechanic active durations
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
      const { state: stateAfterComet } = spawnComet(newState);
      newState = stateAfterComet;
    }
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
 * Activates an orbital mechanic if conditions are met.
 * Returns null if activation fails (not enough energy, cooldown, etc).
 */
export function activateOrbitalMechanic(omId: string, state: GameState): GameState | null {
  const omDef = ORBITAL_MECHANICS.find(o => o.id === omId);
  if (!omDef) {
    return null;
  }

  // Check energy and cooldown
  if (state.energy < omDef.energyCost) {
    return null;
  }

  const cooldown = state.omCooldowns[omId] || 0;
  if (cooldown > 0) {
    return null;
  }

  let newState = { ...state };

  // Deduct energy
  newState.energy -= omDef.energyCost;

  // Set cooldown
  newState.omCooldowns = { ...newState.omCooldowns, [omId]: omDef.cooldown };

  // If has duration, set as active
  if (omDef.duration > 0) {
    newState.omActive = { ...newState.omActive, [omId]: omDef.duration };
  }

  // Special handling per orbital mechanic
  switch (omId) {
    case 'density_compression':
      // Instantly add 15% density (capped at 100)
      newState.density = Math.min(100, newState.density + 15);
      break;

    case 'gravity_well':
      // Spawn 3 comets
      for (let i = 0; i < 3; i++) {
        const { state: stateAfterComet } = spawnComet(newState);
        newState = stateAfterComet;
      }
      break;

    case 'singularity_pull':
      // Check if already used
      if (newState.singularityUsed) {
        return null;
      }
      // Add shards (25% of run mass earned)
      const shardValue = newState.runMassEarned * 0.25;
      const shardsGained = calcShards(shardValue, newState.currentTier);
      newState.currentShards += shardsGained;
      newState.singularityUsed = true;
      break;

    case 'resonance_echo':
      // Check if gravitational_focus is active
      if (newState.omActive['gravitational_focus'] && newState.omActive['gravitational_focus'] > 0) {
        if (newState.discoveries.includes('resonance_echo')) {
          // Add 2s to both durations
          newState.omActive[omId] = (newState.omActive[omId] || 0) + 2;
          newState.omActive['gravitational_focus'] += 2;
        }
      }
      break;
  }

  return newState;
}

/**
 * Purchases a process for the given count.
 * Returns null if not enough mass or invalid process.
 * Applies cosmic_expansion cost reduction if active.
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

  // Calculate cost
  let costPerUnit = processDef.baseCost;

  // Apply cosmic_expansion cost reduction (50%)
  if (state.omActive['cosmic_expansion'] && state.omActive['cosmic_expansion'] > 0) {
    costPerUnit *= 0.5;
  }

  const totalCost = costPerUnit * count;

  // Check if can afford
  if (state.mass < totalCost) {
    return null;
  }

  // Deduct mass and add processes
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
 * Spawns a comet event.
 * Comet value based on current resources.
 * Ice composition gets 1.5x bonus.
 * Returns updated state and comet value for UI.
 */
export function spawnComet(state: GameState): { state: GameState; value: number } {
  // Calculate comet value
  let value = (state.mass + state.gravity * 100 + state.density * 1000) * 0.05;

  // Apply Ice composition bonus
  if (state.composition === 'ice') {
    value *= 1.5;
  }

  let newState = {
    ...state,
    mass: state.mass + value,
    cometsCaught: state.cometsCaught + 1,
  };

  // Reset nextCometIn to random interval
  if (state.composition === 'ice') {
    newState.nextCometIn = 3 + Math.random() * 5; // 3-8s
  } else {
    newState.nextCometIn = 15 + Math.random() * 15; // 15-30s
  }

  return { state: newState, value };
}

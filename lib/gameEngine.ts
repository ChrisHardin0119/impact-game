import { GameState, ActiveComet, CompositionDef } from './types';
import { ALL_BUILDINGS, METALS, VELOCITY_ITEMS, getBuildingCount, getBuildingCost, EXPULSION_COOLDOWN } from './buildings';
import { getEnergyEffects } from './energyUpgrades';
import { getAchievementEffects } from './achievements';
import { getShardEffects } from './tabUnlocks';

// ============================================================
// PRODUCTION CALCULATIONS
// ============================================================

export function getProduction(state: GameState): {
  massPerSec: number;
  velocityPerSec: number;
  energyPerSec: number;
} {
  const energyEff = getEnergyEffects(state);
  const achieveEff = getAchievementEffects(state);
  const shardEff = getShardEffects(state.shardUpgrades);

  let massPS = 0;
  let velocityPS = 0;
  let energyPS = 0;

  // Metal deposits produce mass
  for (const def of METALS) {
    const count = getBuildingCount(state, def);
    if (count === 0) continue;
    for (const prod of def.produces) {
      if (prod.resource === 'mass') massPS += prod.baseAmount * count;
    }
  }

  // Velocity items produce energy
  for (const def of VELOCITY_ITEMS) {
    const count = getBuildingCount(state, def);
    if (count === 0) continue;
    for (const prod of def.produces) {
      if (prod.resource === 'energy') energyPS += prod.baseAmount * count;
    }
  }

  // Apply energy upgrade multipliers
  massPS *= energyEff.massMult;
  energyPS *= energyEff.energyMult;

  // Apply shard upgrade multipliers
  massPS *= shardEff.massMult;

  // Apply achievement multipliers
  massPS *= achieveEff.massMult * achieveEff.allMult;
  velocityPS *= achieveEff.velocityMult * achieveEff.allMult;
  energyPS *= achieveEff.energyMult * achieveEff.allMult;

  // Production double boost (from ad)
  if (state.activeBoosts.productionDouble.active && Date.now() < state.activeBoosts.productionDouble.endsAt) {
    massPS *= 2;
    velocityPS *= 2;
    energyPS *= 2;
  }

  // Composition multipliers
  if (state.composition) {
    const comp = getCompositionDef(state.composition);
    if (comp) {
      massPS *= comp.massMult;
      velocityPS *= comp.velocityMult;
    }
  }

  return { massPerSec: massPS, velocityPerSec: velocityPS, energyPerSec: energyPS };
}

export function getMassPerSecond(state: GameState): number {
  return getProduction(state).massPerSec;
}

// ============================================================
// CLICK HANDLING
// ============================================================

export function getClickValue(state: GameState, comboMult: number = 1): number {
  const mps = getMassPerSecond(state);
  let value = 1 + mps * 0.1;

  // Energy click power upgrade
  const energyEff = getEnergyEffects(state);
  value *= energyEff.clickMult;

  // Shard click power upgrade
  const shardEff = getShardEffects(state.shardUpgrades);
  value *= shardEff.clickMult;

  // Achievement click bonus
  const achieveEff = getAchievementEffects(state);
  value *= achieveEff.clickMult;

  // Composition
  if (state.composition) {
    const comp = getCompositionDef(state.composition);
    if (comp) value *= comp.clickMult;
  }

  value *= comboMult;
  return Math.max(1, value);
}

export function processClick(state: GameState, comboMult: number = 1): GameState {
  const clickValue = getClickValue(state, comboMult);
  return {
    ...state,
    mass: state.mass + clickValue,
    runMassEarned: state.runMassEarned + clickValue,
    totalMassEarned: state.totalMassEarned + clickValue,
    totalClicks: state.totalClicks + 1,
    lastClickTime: Date.now(),
    idleStreak: 0,
  };
}

// ============================================================
// COMET SYSTEM — every 1-2 min, gives 1 min of current mass rate
// ============================================================

export function getCometValue(state: GameState): number {
  const mps = getMassPerSecond(state);
  let value = mps * 60; // 1 minute of production
  value = Math.max(10, value); // minimum 10 Kg

  // Achievement comet bonus
  const achieveEff = getAchievementEffects(state);
  value *= achieveEff.cometMult;

  // Shard comet bonus
  const shardEff = getShardEffects(state.shardUpgrades);
  value *= shardEff.cometMult;

  // Composition comet bonus
  if (state.composition) {
    const comp = getCompositionDef(state.composition);
    if (comp) value *= comp.cometMult;
  }

  return value;
}

export function spawnComet(state: GameState): GameState {
  const value = getCometValue(state);
  const comet: ActiveComet = {
    id: Date.now() + Math.random(),
    value,
    x: 10 + Math.random() * 80,
    y: 10 + Math.random() * 60,
    timeLeft: 10,
    speed: 2 + Math.random() * 3,
    angle: Math.random() * Math.PI * 2,
  };

  // Energy comet magnet upgrade affects frequency
  const energyEff = getEnergyEffects(state);
  const nextInterval = (60 + Math.random() * 60) / energyEff.cometFreqMult;

  return {
    ...state,
    activeComets: [...(state.activeComets || []), comet],
    nextCometIn: nextInterval,
  };
}

export function catchComet(state: GameState, cometId: number): { state: GameState; value: number } {
  const comet = state.activeComets.find(c => c.id === cometId);
  if (!comet) return { state, value: 0 };
  return {
    state: {
      ...state,
      mass: state.mass + comet.value,
      runMassEarned: state.runMassEarned + comet.value,
      totalMassEarned: state.totalMassEarned + comet.value,
      cometsCaught: state.cometsCaught + 1,
      activeComets: state.activeComets.filter(c => c.id !== cometId),
    },
    value: comet.value,
  };
}

// ============================================================
// BUILDING PURCHASE
// ============================================================

export function purchaseBuilding(state: GameState, buildingId: string, count: number = 1): GameState | null {
  const def = ALL_BUILDINGS.find(b => b.id === buildingId);
  if (!def) return null;

  const owned = getBuildingCount(state, def);
  let totalCost = 0;
  for (let i = 0; i < count; i++) {
    totalCost += getBuildingCost(def, owned + i);
  }

  // Check affordability
  const available = def.costResource === 'mass' ? state.mass : state.velocity;
  if (available < totalCost) return null;

  let newState = { ...state };

  // Deduct cost
  if (def.costResource === 'mass') {
    newState.mass -= totalCost;
  } else {
    newState.velocity -= totalCost;
  }

  // Clamp
  newState.mass = Math.max(0, newState.mass);
  newState.velocity = Math.max(0, newState.velocity);

  // Add building
  if (def.tab === 'metals') {
    newState.metals = { ...newState.metals, [def.id]: owned + count };
  } else {
    newState.velocityItems = { ...newState.velocityItems, [def.id]: owned + count };
  }

  return newState;
}

// ============================================================
// AUTO-PURCHASE (energy upgrades)
// ============================================================

function autoPurchase(state: GameState, tab: 'metals' | 'velocity'): GameState {
  const buildings = tab === 'metals' ? METALS : VELOCITY_ITEMS;
  for (const def of buildings) {
    const owned = getBuildingCount(state, def);
    const cost = getBuildingCost(def, owned);
    const available = def.costResource === 'mass' ? state.mass : state.velocity;
    if (available >= cost) {
      const result = purchaseBuilding(state, def.id, 1);
      if (result) return result;
    }
  }
  return state;
}

// ============================================================
// MAIN TICK
// ============================================================

export function processTick(state: GameState, dt: number): GameState {
  let s = { ...state };

  // Production
  const prod = getProduction(s);
  s.mass += prod.massPerSec * dt;
  s.velocity += prod.velocityPerSec * dt;
  s.energy += prod.energyPerSec * dt;

  s.runMassEarned += prod.massPerSec * dt;
  s.totalMassEarned += prod.massPerSec * dt;

  // Track highest mass
  if (s.mass > s.highestMass) s.highestMass = s.mass;

  // Clamp resources to 0 minimum
  s.mass = Math.max(0, s.mass);
  s.velocity = Math.max(0, s.velocity);
  s.energy = Math.max(0, s.energy);

  // Time tracking
  s.runTime += dt;
  s.totalPlayTime += dt;

  // Idle streak tracking
  if (Date.now() - s.lastClickTime > 1000) {
    s.idleStreak += dt;
  }

  // === EXPULSION COOLDOWN ===
  if (s.expulsionCooldown > 0) {
    s.expulsionCooldown = Math.max(0, s.expulsionCooldown - dt);
  }

  // === COMET SPAWNING (every 1-2 min) ===
  s.nextCometIn -= dt;
  if (s.nextCometIn <= 0) {
    s = spawnComet(s);
  }

  // Update active comets (drift, expire)
  if (s.activeComets && s.activeComets.length > 0) {
    s.activeComets = s.activeComets
      .map(c => ({
        ...c,
        timeLeft: c.timeLeft - dt,
        x: c.x + Math.cos(c.angle) * c.speed * dt,
        y: c.y + Math.sin(c.angle) * c.speed * dt,
      }))
      .map(c => {
        // Bounce off edges
        let { x, y, angle } = c;
        if (x < 5 || x > 95) angle = Math.PI - angle;
        if (y < 5 || y > 75) angle = -angle;
        return { ...c, x: Math.max(5, Math.min(95, x)), y: Math.max(5, Math.min(75, y)), angle };
      })
      .filter(c => c.timeLeft > 0);
  }

  // === AD BOOST TIMERS ===
  // Shard ad: every 10-20 min, 60s expiry
  if (s.totalPrestigeCount >= 1 && !s.shardAdAvailable) {
    s.nextShardAdIn -= dt;
    if (s.nextShardAdIn <= 0) {
      s.shardAdAvailable = true;
      s.shardAdExpiresIn = 60;
    }
  }
  if (s.shardAdAvailable && !s.adsRemoved) {
    s.shardAdExpiresIn -= dt;
    if (s.shardAdExpiresIn <= 0) {
      s.shardAdAvailable = false;
      s.nextShardAdIn = 600 + Math.random() * 600;
    }
  }

  // Production ad: every 30 min, 60s expiry
  if (!s.productionAdAvailable) {
    s.nextProductionAdIn -= dt;
    if (s.nextProductionAdIn <= 0) {
      s.productionAdAvailable = true;
      s.productionAdExpiresIn = 60;
    }
  }
  if (s.productionAdAvailable && !s.adsRemoved) {
    s.productionAdExpiresIn -= dt;
    if (s.productionAdExpiresIn <= 0) {
      s.productionAdAvailable = false;
      s.nextProductionAdIn = 1800;
    }
  }

  // Mass drop ad: every 5-10 min, 60s expiry
  if (!s.massDropAdAvailable) {
    s.nextMassDropAdIn -= dt;
    if (s.nextMassDropAdIn <= 0) {
      s.massDropAdAvailable = true;
      s.massDropAdExpiresIn = 60;
    }
  }
  if (s.massDropAdAvailable && !s.adsRemoved) {
    s.massDropAdExpiresIn -= dt;
    if (s.massDropAdExpiresIn <= 0) {
      s.massDropAdAvailable = false;
      s.nextMassDropAdIn = 300 + Math.random() * 300;
    }
  }

  // Check if production boost expired
  if (s.activeBoosts.productionDouble.active && Date.now() >= s.activeBoosts.productionDouble.endsAt) {
    s.activeBoosts = {
      ...s.activeBoosts,
      productionDouble: { active: false, endsAt: 0 },
    };
  }

  // === AUTO-PURCHASE (if energy toggles are bought) ===
  if ((s.energyUpgrades['auto_mine'] || 0) >= 1) {
    s = autoPurchase(s, 'metals');
  }
  if ((s.energyUpgrades['auto_accelerate'] || 0) >= 1 && s.unlockedTabs['velocity']) {
    s = autoPurchase(s, 'velocity');
  }

  return s;
}

// ============================================================
// COMPOSITION HELPERS
// ============================================================

const COMPOSITIONS: CompositionDef[] = [
  { id: 'rocky', name: 'Rocky', emoji: '🪨', desc: 'Balanced composition. Jack of all trades.', flavor: 'Solid silicate base.',
    unlockTier: 0, massMult: 1.1, velocityMult: 1.0, clickMult: 1.0, cometMult: 1.0, expulsionMult: 1.0 },
  { id: 'metallic', name: 'Metallic', emoji: '⚙️', desc: 'Heavy metals boost mass but slow velocity.', flavor: 'Iron-nickel core.',
    unlockTier: 0, massMult: 1.2, velocityMult: 0.85, clickMult: 1.1, cometMult: 1.0, expulsionMult: 0.9 },
  { id: 'ice', name: 'Ice', emoji: '🧊', desc: 'Volatile ices attract comets but reduce mass.', flavor: 'Frozen volatiles.',
    unlockTier: 1, massMult: 0.9, velocityMult: 1.1, clickMult: 0.9, cometMult: 1.5, expulsionMult: 1.1 },
  { id: 'carbonaceous', name: 'Carbonaceous', emoji: '⬛', desc: 'Carbon-rich. Boosts expulsion and velocity.', flavor: 'Organic compounds.',
    unlockTier: 1, massMult: 0.9, velocityMult: 1.15, clickMult: 0.95, cometMult: 1.0, expulsionMult: 1.2 },
];

export function getCompositionDef(id: string): CompositionDef | undefined {
  return COMPOSITIONS.find(c => c.id === id);
}

export function getUnlockedCompositions(tier: number): CompositionDef[] {
  return COMPOSITIONS.filter(c => c.unlockTier <= tier);
}

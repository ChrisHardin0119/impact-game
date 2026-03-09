// ============================================================
// IMPACT v2 — All TypeScript Interfaces
// ============================================================

export type CompositionId = 'silicate' | 'iron' | 'ice' | 'carbonaceous' | 'binary' | 'neutron';
export type ProcessCategory = 'active' | 'passive' | 'resonant' | 'exotic';
export type PrestigeTier = 0 | 1 | 2 | 3 | 4 | 5;
export type TabName = 'build' | 'orbital' | 'upgrades' | 'prestige' | 'discover' | 'stats';
export type BuyMode = 1 | 5 | 10 | 100 | 'max';
export type UpgradePath = 'synergy' | 'density' | 'energy';

// --- Compositions ---
export interface CompositionDef {
  id: CompositionId;
  name: string;
  emoji: string;
  desc: string;
  flavor: string;
  unlockTier: PrestigeTier;
  // Modifiers (1.0 = no change)
  massProductionMult: number;
  costMult: number;
  gravityMult: number;
  densityMult: number;
  synergyMult: number;
  clickMult: number;
  // Special mechanic description
  specialName: string;
  specialDesc: string;
}

// --- Processes (buildings) ---
export interface ProcessDef {
  id: string;
  name: string;
  emoji: string;
  desc: string;
  category: ProcessCategory;
  baseCost: number;
  costScale: number; // typically 1.15
  baseMPS: number;   // mass per second
  gravityPS: number; // gravity per second
  densityPS: number; // density per second (as %)
  synergyTarget: string | null; // id of process it synergizes with
  compositionBonus: CompositionId | null; // which composition boosts this
  unlockCondition: { type: 'mass' | 'tier' | 'gravity'; value: number } | null;
}

// --- Orbital Mechanics (active abilities) ---
export interface OrbitalMechanicDef {
  id: string;
  name: string;
  emoji: string;
  desc: string;
  energyCost: number;
  cooldown: number;   // seconds
  duration: number;    // seconds (0 = instant)
  unlockTier: PrestigeTier;
}

// --- Core Upgrades ---
export interface CoreUpgradeDef {
  id: string;
  name: string;
  emoji: string;
  desc: string;
  path: UpgradePath | 'foundation';
  cost: number; // shards
  maxLevel: number;
  requires: string[]; // ids of prerequisite upgrades
  unlockTier: PrestigeTier;
}

// --- Discoveries ---
export interface DiscoveryDef {
  id: string;
  name: string;
  emoji: string;
  desc: string;
  hint: string;
  bonusDesc: string;
  // condition is checked in engine
}

// --- Prestige Tier Info ---
export interface PrestigeTierDef {
  tier: PrestigeTier;
  name: string;
  emoji: string;
  shardReq: number; // lifetime shards needed to unlock this tier
  unlockDesc: string;
}

// --- Game State ---
export interface GameState {
  // Resources
  mass: number;
  gravity: number;
  density: number;
  energy: number;
  maxEnergy: number;
  energyRegen: number;

  // Composition
  composition: CompositionId | null; // null = not yet chosen (Rock stage)

  // Processes (buildings) owned
  processes: Record<string, number>; // processId -> count

  // Orbital mechanic cooldowns (seconds remaining)
  omCooldowns: Record<string, number>;
  // Active orbital mechanic effects (seconds remaining)
  omActive: Record<string, number>;
  // Whether singularity pull was used this run
  singularityUsed: boolean;

  // Core Upgrades (permanent, persist through prestige)
  coreUpgrades: Record<string, number>; // upgradeId -> level

  // Discoveries (permanent)
  discoveries: string[]; // ids of discovered bonuses

  // Prestige
  currentTier: PrestigeTier;
  lifetimeShards: number;
  currentShards: number; // available to spend
  totalPrestigeCount: number;

  // Stats
  totalMassEarned: number;
  totalClicks: number;
  runMassEarned: number;
  runTime: number; // seconds
  totalPlayTime: number;
  highestMass: number;
  cometsCaught: number;

  // Comet system (for Ice composition)
  nextCometIn: number; // seconds until next comet event

  // Charged buildings (for Carbonaceous composition)
  chargedProcess: string | null;
  chargeCooldown: number;

  // UI
  activeTab: TabName;
  buyMode: BuyMode;

  // Meta
  lastSaveTime: number;
  version: number;
}

export interface FloatingNumber {
  id: number;
  value: number;
  x: number;
  y: number;
  opacity: number;
}

export interface Toast {
  id: number;
  message: string;
  emoji: string;
  timeLeft: number;
}

export interface CometEvent {
  id: number;
  value: number;
  timeLeft: number;
}

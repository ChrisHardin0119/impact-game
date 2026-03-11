// ============================================================
// IMPACT v13 — Complete type system rewrite
// Resource chain: Mass (Kg) → Density → Velocity → Energy
// ============================================================

export type TabName = 'metals' | 'density' | 'velocity' | 'energy' | 'converter' | 'impact' | 'achievements' | 'stats' | 'dev';
export type BuyMode = 1 | 10 | 100 | 'max';
export type PrestigeTier = 0 | 1 | 2 | 3 | 4 | 5;

export interface ActiveComet {
  id: number;
  value: number;
  x: number;
  y: number;
  timeLeft: number;
  speed: number;
  angle: number;
}

export interface FloatingNumber {
  id: number;
  value: number;
  x: number;
  y: number;
  opacity: number;
}

export interface AchievementPopup {
  id: string;
  name: string;
  emoji: string;
  desc: string;
  bonusDesc: string;
}

// === GAME STATE ===
export interface GameState {
  // Primary resources
  mass: number;          // Kg
  density: number;       // linked to mass
  velocity: number;      // m/s — earned from density tab
  energy: number;        // J — earned from velocity tab

  // Building counts
  metals: Record<string, number>;
  densityItems: Record<string, number>;
  velocityItems: Record<string, number>;

  // Energy upgrades (level or toggle state)
  energyUpgrades: Record<string, number>;

  // Tab unlocks (permanent, bought with shards)
  unlockedTabs: Record<string, boolean>;

  // Shard upgrades (permanent small bonuses)
  shardUpgrades: Record<string, number>;

  // Prestige / Impact
  currentShards: number;
  lifetimeShards: number;
  totalPrestigeCount: number;
  currentTier: PrestigeTier;

  // Achievements (permanent)
  achievements: string[];

  // Composition (chosen at start / after Impact)
  composition: string | null;

  // Run tracking
  runMassEarned: number;
  totalMassEarned: number;
  highestMass: number;
  totalClicks: number;
  totalPlayTime: number;
  runTime: number;
  cometsCaught: number;
  converterUseCount: number;
  tabSwitchCount: number;

  // Comets
  activeComets: ActiveComet[];
  nextCometIn: number;

  // UI state
  activeTab: TabName;
  buyMode: BuyMode;

  // Ad boosts
  activeBoosts: {
    velocityDouble: { active: boolean; endsAt: number };
  };
  nextShardAdIn: number;
  nextVelocityAdIn: number;
  shardAdAvailable: boolean;
  velocityAdAvailable: boolean;

  // Dev mode
  devMode: boolean;

  // Tutorial
  tutorialCompleted: string[];
  tutorialSkipped: boolean;

  // Velocity tab unlock (special: threshold-based, not shard-based)
  velocityUnlockReady: boolean; // true = player hit threshold & pressed button, awaiting Impact

  // Misc tracking
  fastestPrestige: number;
  maxComboReached: number;
  lastClickTime: number;
  idleStreak: number;
  adsRemoved: boolean;

  // Meta
  lastSaveTime: number;
  version: number;
}

// === BUILDING DEFINITIONS ===
export interface BuildingDef {
  id: string;
  name: string;
  emoji: string;
  desc: string;
  tab: 'metals' | 'density' | 'velocity';
  costResource: 'mass' | 'density' | 'velocity';
  baseCost: number;
  costScale: number;
  produces: { resource: 'mass' | 'density' | 'velocity' | 'energy'; baseAmount: number }[];
}

// === ENERGY UPGRADE DEFINITIONS ===
export interface EnergyUpgradeDef {
  id: string;
  name: string;
  emoji: string;
  desc: string;
  baseCost: number;
  costScale: number;
  maxLevel: number;
  isToggle: boolean;
  effect: string;
}

// === ACHIEVEMENT DEFINITIONS ===
export interface AchievementDef {
  id: string;
  name: string;
  emoji: string;
  desc: string;
  bonusDesc: string;
  hidden: boolean;
  check: (state: GameState) => boolean;
}

// === SHARD UPGRADE DEFINITIONS ===
export interface ShardUpgradeDef {
  id: string;
  name: string;
  emoji: string;
  desc: string;
  baseCost: number;
  costScale: number;
  maxLevel: number;
  effect: string;
}

// === TAB UNLOCK DEFINITIONS ===
export interface TabUnlockDef {
  tabId: TabName;
  name: string;
  emoji: string;
  desc: string;
  shardCost: number;
  requiresPrestige: number;
  // Special unlock: velocity tab uses a resource threshold instead of shards
  velocityThreshold?: number;
  unlockViaImpact?: boolean;
}

// === CONVERTER DEFINITIONS ===
export interface ConverterDef {
  id: string;
  from: 'mass' | 'density' | 'velocity';
  to: 'mass' | 'density' | 'velocity';
  name: string;
  emoji: string;
  rate: number;
}

// === PRESTIGE TIER DEFINITIONS ===
export interface PrestigeTierDef {
  tier: PrestigeTier;
  name: string;
  emoji: string;
  shardReq: number;
  unlockDesc: string;
}

// === COMPOSITION DEFINITIONS ===
export interface CompositionDef {
  id: string;
  name: string;
  emoji: string;
  desc: string;
  flavor: string;
  unlockTier: PrestigeTier;
  massMult: number;
  densityMult: number;
  velocityMult: number;
  clickMult: number;
  cometMult: number;
}

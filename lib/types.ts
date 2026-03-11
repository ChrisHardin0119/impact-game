// ============================================================
// IMPACT v13.1 — Expulsion overhaul
// Resource chain: Mass (Kg) → Expulsion (jettison mass) → Velocity → Energy
// Three resources: Mass, Velocity, Energy
// ============================================================

export type TabName = 'metals' | 'expulsion' | 'velocity' | 'energy' | 'impact' | 'achievements' | 'stats' | 'impatient' | 'dev';
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
  // Primary resources (only 3 now)
  mass: number;          // Kg
  velocity: number;      // m/s — earned by jettisoning mass
  energy: number;        // J — earned from velocity tab

  // Building counts
  metals: Record<string, number>;
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

  // Expulsion state
  expulsionCooldown: number;  // seconds remaining until next expulsion
  totalExpulsions: number;    // lifetime count

  // Run tracking
  runMassEarned: number;
  totalMassEarned: number;
  highestMass: number;
  totalClicks: number;
  totalPlayTime: number;
  runTime: number;
  cometsCaught: number;
  accumulationUseCount: number;
  tabSwitchCount: number;

  // Comets
  activeComets: ActiveComet[];
  nextCometIn: number;

  // UI state
  activeTab: TabName;
  buyMode: BuyMode;

  // Active timed boosts
  activeBoosts: {
    productionDouble: { active: boolean; endsAt: number };
    velocityDouble: { active: boolean; endsAt: number };
  };

  // === 3 FLOATING AD BUTTONS (persist on screen, no expiry, cooldown after use) ===
  // 2x Production — doubles all production for 30 min
  productionAdAvailable: boolean;
  nextProductionAdIn: number;
  // 2x Shards on Next Impact — doubles shard reward on next prestige
  shardDoubleActive: boolean;         // is the 2x shard buff active for next impact?
  shardDoubleAdAvailable: boolean;    // is the button visible?
  // Mass Drop — instant mass bonus
  massDropAdAvailable: boolean;
  nextMassDropAdIn: number;

  // === 2 POPUP ADS (appear periodically with 60s expiry) ===
  // +10% Shards popup
  shardPopupAvailable: boolean;
  shardPopupExpiresIn: number;
  nextShardPopupIn: number;
  // 2x Velocity popup (only after velocity tab unlocked)
  velocityPopupAvailable: boolean;
  velocityPopupExpiresIn: number;
  nextVelocityPopupIn: number;

  // Impatient tab — 3 tiered ads: 30min, 1hr, 90min then 90min lockout
  impatientStep: number;          // 0 = 30min available, 1 = 1hr available, 2 = 90min available, 3 = locked out
  impatientLockoutEndsAt: number; // timestamp when lockout ends (0 = not locked)

  // Settings
  spaceDustEnabled: boolean;
  soundEnabled: boolean;
  musicEnabled: boolean;
  betaDismissed: boolean;

  // Dev mode
  devMode: boolean;

  // Tutorial
  tutorialCompleted: string[];
  tutorialSkipped: boolean;

  // Velocity tab unlock (special: threshold-based, not shard-based)
  velocityUnlockReady: boolean;

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
  tab: 'metals' | 'velocity';
  costResource: 'mass' | 'velocity';
  baseCost: number;
  costScale: number;
  produces: { resource: 'mass' | 'velocity' | 'energy'; baseAmount: number }[];
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
  velocityThreshold?: number;
  unlockViaImpact?: boolean;
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
  velocityMult: number;
  clickMult: number;
  cometMult: number;
  expulsionMult: number; // bonus to mass→velocity conversion
}

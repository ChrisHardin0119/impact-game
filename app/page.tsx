'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { GameState, TabName, BuyMode, FloatingNumber, AchievementPopup } from '@/lib/types';
import { defaultGameState, canPrestige, calcShards, getPrestigeResetState, PRESTIGE_TIERS } from '@/lib/prestige';
import { processClick, getClickValue, getMassPerSecond, getProduction, catchComet, purchaseBuilding, getCompositionDef, getUnlockedCompositions } from '@/lib/gameEngine';
import { METALS, VELOCITY_ITEMS, getBuildingCost, getBuildingCount, getMaxAffordable, getTotalCostForN, getExpulsionRate, calculateExpulsion, getAccumulationRate, calculateAccumulation, EXPULSION_COOLDOWN, BASE_EXPULSION_RATE, BASE_ACCUMULATION_RATE } from '@/lib/buildings';
import { ENERGY_UPGRADES, getEnergyUpgradeCost, canBuyEnergyUpgrade, getEnergyEffects } from '@/lib/energyUpgrades';
import { ACHIEVEMENTS, getAchievementEffects } from '@/lib/achievements';
import { TAB_UNLOCKS, SHARD_UPGRADES, getShardUpgradeCost, isTabUnlocked, getShardEffects } from '@/lib/tabUnlocks';
import { fmt, fmtKg, fmtRate, fmtTime, fmtPercent } from '@/lib/format';
import { saveGame, loadGame, calculateOfflineGains, hardReset, exportSave, importSave } from '@/lib/saveLoad';
import { useGameLoop } from '@/hooks/useGameLoop';

export default function GamePage() {
  const [state, setStateRaw] = useState<GameState>(defaultGameState());
  const stateRef = useRef(state);
  const [floatingNums, setFloatingNums] = useState<FloatingNumber[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [offlineGains, setOfflineGains] = useState<{ mass: number; time: number } | null>(null);
  const nextFloatId = useRef(0);

  // Achievement popup queue
  const [achievementPopups, setAchievementPopups] = useState<AchievementPopup[]>([]);

  // UI state
  const [showImpactWarning, setShowImpactWarning] = useState(false);
  const [impactExploding, setImpactExploding] = useState(false);
  const [showCompPicker, setShowCompPicker] = useState(false);
  const [devPasscode, setDevPasscode] = useState('');
  const [importCode, setImportCode] = useState('');
  const [showImportExport, setShowImportExport] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Expulsion tab state
  const [expulsionPercent, setExpulsionPercent] = useState(10);
  const [accumulationAmount, setAccumulationAmount] = useState(1);
  const [expulsionMsg, setExpulsionMsg] = useState<string | null>(null);

  // Click combo
  const [clickCombo, setClickCombo] = useState(0);
  const comboTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Scroll ref
  const scrollRef = useRef<HTMLDivElement>(null);

  const setState = useCallback((s: GameState) => {
    stateRef.current = s;
    setStateRaw(s);
  }, []);

  // Achievement callback for game loop
  const handleNewAchievements = useCallback((popups: AchievementPopup[]) => {
    setAchievementPopups(prev => [...prev, ...popups]);
  }, []);

  // Game loop
  useGameLoop(stateRef, setState, handleNewAchievements);

  // Load game on mount
  useEffect(() => {
    const saved = loadGame();
    if (saved) {
      const { state: withOffline, offlineTime } = calculateOfflineGains(saved);
      setState(withOffline);
      if (offlineTime > 5) {
        setOfflineGains({ mass: withOffline.mass - saved.mass, time: offlineTime });
      }
      if (!withOffline.composition && withOffline.totalPrestigeCount > 0) {
        setShowCompPicker(true);
      }
    }
    setLoaded(true);
  }, [setState]);

  // Text size fix for mobile
  useEffect(() => {
    document.documentElement.style.setProperty('-webkit-text-size-adjust', '100%');
  }, []);

  // === HANDLERS ===

  const handleClick = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (comboTimerRef.current) clearTimeout(comboTimerRef.current);
    const newCombo = clickCombo + 1;
    setClickCombo(newCombo);
    comboTimerRef.current = setTimeout(() => setClickCombo(0), 2000);

    const comboMult = 1 + Math.min(newCombo, 50) * 0.01;
    const clickVal = getClickValue(stateRef.current, comboMult);
    const newState = processClick(stateRef.current, comboMult);

    if (newCombo > newState.maxComboReached) {
      newState.maxComboReached = newCombo;
    }

    setState(newState);

    // Floating number
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0]?.clientX || rect.left + rect.width / 2 : e.clientX;
    const y = 'touches' in e ? e.touches[0]?.clientY || rect.top : e.clientY;
    const id = nextFloatId.current++;
    setFloatingNums(prev => [...prev, { id, value: clickVal, x: x - rect.left, y: y - rect.top, opacity: 1 }]);
    setTimeout(() => setFloatingNums(prev => prev.filter(f => f.id !== id)), 1000);
  }, [clickCombo, setState]);

  const handleBuy = useCallback((buildingId: string) => {
    const s = stateRef.current;
    const count = s.buyMode === 'max'
      ? (() => {
          const def = [...METALS, ...VELOCITY_ITEMS].find(b => b.id === buildingId);
          if (!def) return 1;
          const owned = getBuildingCount(s, def);
          const available = def.costResource === 'mass' ? s.mass : s.velocity;
          return Math.max(1, getMaxAffordable(def, owned, available));
        })()
      : (s.buyMode as number);

    const result = purchaseBuilding(s, buildingId, count);
    if (result) setState(result);
  }, [setState]);

  const handleBuyEnergyUpgrade = useCallback((upgradeId: string) => {
    const s = stateRef.current;
    const def = ENERGY_UPGRADES.find(u => u.id === upgradeId);
    if (!def) return;
    const level = s.energyUpgrades[def.id] || 0;
    if (level >= def.maxLevel) return;
    const cost = getEnergyUpgradeCost(def, level);
    if (s.energy < cost) return;
    setState({
      ...s,
      energy: s.energy - cost,
      energyUpgrades: { ...s.energyUpgrades, [def.id]: level + 1 },
    });
  }, [setState]);

  // === EXPULSION HANDLER ===
  const handleExpulsion = useCallback(() => {
    const s = stateRef.current;
    if (s.expulsionCooldown > 0) return;
    if (s.mass <= 0) return;

    const massToJettison = s.mass * (expulsionPercent / 100);
    if (massToJettison <= 0) return;

    const rate = getExpulsionRate(s.shardUpgrades);
    // Apply composition expulsion bonus
    let effectiveRate = rate;
    if (s.composition) {
      const comp = getCompositionDef(s.composition);
      if (comp) effectiveRate *= comp.expulsionMult;
    }
    // Apply achievement expulsion bonus
    const achieveEff = getAchievementEffects(s);
    effectiveRate *= achieveEff.expulsionMult;

    const result = calculateExpulsion(massToJettison, effectiveRate);

    setState({
      ...s,
      mass: s.mass - result.massLost,
      velocity: s.velocity + result.velocityGained,
      expulsionCooldown: EXPULSION_COOLDOWN,
      totalExpulsions: s.totalExpulsions + 1,
    });

    setExpulsionMsg(`Jettisoned ${fmtKg(result.massLost)} → +${fmt(result.velocityGained)} m/s`);
    setTimeout(() => setExpulsionMsg(null), 3000);
  }, [expulsionPercent, setState]);

  // === ACCUMULATION HANDLER ===
  const handleAccumulation = useCallback(() => {
    const s = stateRef.current;
    if (s.velocity < accumulationAmount) return;
    if (accumulationAmount <= 0) return;

    const rate = getAccumulationRate(s.shardUpgrades);
    // Apply achievement accumulation bonus
    const achieveEff = getAchievementEffects(s);
    const effectiveRate = rate * achieveEff.accumulationMult;

    const result = calculateAccumulation(accumulationAmount, effectiveRate);

    setState({
      ...s,
      velocity: s.velocity - result.velocityLost,
      mass: s.mass + result.massGained,
      accumulationUseCount: s.accumulationUseCount + 1,
    });

    setExpulsionMsg(`Sacrificed ${fmt(result.velocityLost)} m/s → +${fmtKg(result.massGained)}`);
    setTimeout(() => setExpulsionMsg(null), 3000);
  }, [accumulationAmount, setState]);

  const handleCatchComet = useCallback((cometId: number) => {
    const { state: newState, value } = catchComet(stateRef.current, cometId);
    if (value > 0) setState(newState);
  }, [setState]);

  const handleTabSwitch = useCallback((tab: TabName) => {
    const s = stateRef.current;
    if (!isTabUnlocked(tab, s.unlockedTabs) && tab !== 'dev') return;
    setState({ ...s, activeTab: tab, tabSwitchCount: s.tabSwitchCount + 1 });
  }, [setState]);

  const handleBuyTabUnlock = useCallback((tabId: string) => {
    const s = stateRef.current;
    const def = TAB_UNLOCKS.find(t => t.tabId === tabId);
    if (!def) return;
    if (s.unlockedTabs[tabId]) return;
    if (s.currentShards < def.shardCost) return;
    if (s.totalPrestigeCount < def.requiresPrestige) return;
    setState({
      ...s,
      currentShards: s.currentShards - def.shardCost,
      unlockedTabs: { ...s.unlockedTabs, [tabId]: true },
      activeTab: tabId as TabName,
    });
  }, [setState]);

  const handleVelocityUnlockReady = useCallback(() => {
    const s = stateRef.current;
    setState({ ...s, velocityUnlockReady: true });
  }, [setState]);

  const handleBuyShardUpgrade = useCallback((upgradeId: string) => {
    const s = stateRef.current;
    const def = SHARD_UPGRADES.find(u => u.id === upgradeId);
    if (!def) return;
    const level = s.shardUpgrades[def.id] || 0;
    if (level >= def.maxLevel) return;
    const cost = getShardUpgradeCost(def, level);
    if (s.currentShards < cost) return;
    setState({
      ...s,
      currentShards: s.currentShards - cost,
      shardUpgrades: { ...s.shardUpgrades, [def.id]: level + 1 },
    });
  }, [setState]);

  const handleImpact = useCallback(() => {
    setShowImpactWarning(true);
  }, []);

  const confirmImpact = useCallback(() => {
    setShowImpactWarning(false);
    setImpactExploding(true);

    const s = stateRef.current;
    const shardEff = getShardEffects(s.shardUpgrades);
    const achieveEff = getAchievementEffects(s);
    const energyEff = getEnergyEffects(s);
    const bonusMult = shardEff.massMult * achieveEff.shardMult * (1 + (energyEff.shardMult - 1));
    const earnedShards = calcShards(s.runMassEarned, s.currentTier, bonusMult);

    let newState = getPrestigeResetState(s);
    newState.currentShards += earnedShards;
    newState.lifetimeShards += earnedShards;

    if (s.runTime < newState.fastestPrestige) {
      newState.fastestPrestige = s.runTime;
    }

    for (let t = 5; t >= 0; t--) {
      const tierDef = PRESTIGE_TIERS[t];
      if (tierDef && newState.lifetimeShards >= tierDef.shardReq && t > newState.currentTier) {
        newState.currentTier = t as any;
      }
    }

    setTimeout(() => {
      setState(newState);
      setImpactExploding(false);
      saveGame(newState);
      if (getUnlockedCompositions(newState.currentTier).length > 0) {
        setShowCompPicker(true);
      }
    }, 1500);
  }, [setState]);

  const handleCompSelect = useCallback((compId: string) => {
    setState({ ...stateRef.current, composition: compId });
    setShowCompPicker(false);
  }, [setState]);

  const handleShardAd = useCallback(() => {
    const s = stateRef.current;
    if (!s.shardAdAvailable) return;
    const bonus = Math.max(1, Math.floor(s.lifetimeShards * 0.1));
    setState({
      ...s,
      currentShards: s.currentShards + bonus,
      lifetimeShards: s.lifetimeShards + bonus,
      shardAdAvailable: false,
      nextShardAdIn: 600 + Math.random() * 600,
    });
  }, [setState]);

  const handleVelocityAd = useCallback(() => {
    const s = stateRef.current;
    if (!s.velocityAdAvailable) return;
    setState({
      ...s,
      activeBoosts: {
        ...s.activeBoosts,
        velocityDouble: { active: true, endsAt: Date.now() + 20 * 60 * 1000 },
      },
      velocityAdAvailable: false,
      nextVelocityAdIn: 1200 + Math.random() * 1200,
    });
  }, [setState]);

  const handleDevPasscode = useCallback(() => {
    if (devPasscode === '9173') {
      setState({ ...stateRef.current, devMode: true });
      setDevPasscode('');
    }
  }, [devPasscode, setState]);

  const handleHardReset = useCallback(() => {
    hardReset();
    const fresh = defaultGameState();
    setState(fresh);
    setShowResetConfirm(false);
  }, [setState]);

  const handleExport = useCallback(() => {
    const code = exportSave(stateRef.current);
    navigator.clipboard?.writeText(code);
    setImportCode(code);
  }, []);

  const handleImport = useCallback(() => {
    const result = importSave(importCode);
    if (result) {
      setState(result);
      saveGame(result);
      setImportCode('');
      setShowImportExport(false);
    }
  }, [importCode, setState]);

  // === DERIVED VALUES ===
  const prod = getProduction(state);
  const currentTierDef = PRESTIGE_TIERS[state.currentTier];
  const nextTier = PRESTIGE_TIERS[state.currentTier + 1];

  // Tab list
  const allTabs: { id: TabName; label: string; emoji: string }[] = [
    { id: 'metals', label: 'Metals', emoji: '🪨' },
    { id: 'expulsion', label: 'Expulsion', emoji: '💨' },
    { id: 'velocity', label: 'Velocity', emoji: '🚀' },
    { id: 'energy', label: 'Energy', emoji: '⚡' },
    { id: 'impact', label: 'Impact', emoji: '💥' },
    { id: 'achievements', label: 'Awards', emoji: '🏆' },
    { id: 'stats', label: 'Stats', emoji: '📊' },
  ];

  if (!loaded) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-white text-xl animate-pulse">Loading...</div>
      </div>
    );
  }

  // === EXPULSION TAB COMPUTED VALUES ===
  const expulsionRate = getExpulsionRate(state.shardUpgrades);
  let effectiveExpulsionRate = expulsionRate;
  if (state.composition) {
    const comp = getCompositionDef(state.composition);
    if (comp) effectiveExpulsionRate *= comp.expulsionMult;
  }
  const achieveEffForExpulsion = getAchievementEffects(state);
  effectiveExpulsionRate *= achieveEffForExpulsion.expulsionMult;

  const massToJettison = state.mass * (expulsionPercent / 100);
  const velocityFromExpulsion = massToJettison * effectiveExpulsionRate;

  const accRate = getAccumulationRate(state.shardUpgrades);
  const effectiveAccRate = accRate * achieveEffForExpulsion.accumulationMult;
  const massFromAccumulation = accumulationAmount * effectiveAccRate;

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col max-w-lg mx-auto relative overflow-hidden select-none">
      {/* === IMPACT EXPLOSION OVERLAY === */}
      {impactExploding && (
        <div className="fixed inset-0 z-50 bg-orange-500 animate-impact-flash flex items-center justify-center">
          <div className="text-6xl animate-bounce">💥</div>
        </div>
      )}

      {/* === OFFLINE GAINS POPUP === */}
      {offlineGains && (
        <div className="fixed inset-0 z-40 bg-black/70 flex items-center justify-center p-4" onClick={() => setOfflineGains(null)}>
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 max-w-sm text-center">
            <div className="text-2xl mb-2">🌙</div>
            <div className="text-lg font-bold mb-2">Welcome back!</div>
            <div className="text-gray-400 mb-1">You were away for {fmtTime(offlineGains.time)}</div>
            <div className="text-green-400 font-bold">+{fmtKg(offlineGains.mass)} mass earned</div>
            <div className="text-gray-500 text-xs mt-3">Tap to dismiss</div>
          </div>
        </div>
      )}

      {/* === IMPACT WARNING MODAL === */}
      {showImpactWarning && (
        <div className="fixed inset-0 z-40 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-orange-500/50 rounded-xl p-6 max-w-sm text-center">
            <div className="text-3xl mb-2">💥</div>
            <div className="text-xl font-bold mb-2 text-orange-400">Impact Warning!</div>
            <div className="text-gray-300 mb-2 text-sm">
              This will RESET your mass, velocity, buildings, and energy upgrades.
            </div>
            <div className="text-green-400 font-bold mb-4">
              +{fmt(calcShards(state.runMassEarned, state.currentTier))} Shards
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowImpactWarning(false)}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded-lg text-sm"
              >Cancel</button>
              <button
                onClick={confirmImpact}
                className="flex-1 bg-orange-600 hover:bg-orange-500 text-white py-2 rounded-lg text-sm font-bold"
              >Impact!</button>
            </div>
          </div>
        </div>
      )}

      {/* === COMPOSITION PICKER === */}
      {showCompPicker && (
        <div className="fixed inset-0 z-40 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-purple-500/50 rounded-xl p-6 max-w-sm">
            <div className="text-center mb-4">
              <div className="text-2xl mb-1">🌌</div>
              <div className="text-lg font-bold">Choose Composition</div>
              <div className="text-gray-400 text-xs">This affects your bonuses for this run</div>
            </div>
            <div className="space-y-2">
              {getUnlockedCompositions(state.currentTier).map(comp => (
                <button
                  key={comp.id}
                  onClick={() => handleCompSelect(comp.id)}
                  className="w-full bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg p-3 text-left"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span>{comp.emoji}</span>
                    <span className="font-bold text-sm">{comp.name}</span>
                  </div>
                  <div className="text-gray-400 text-xs">{comp.desc}</div>
                  <div className="text-gray-500 text-xs mt-1 italic">{comp.flavor}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* === ACHIEVEMENT POPUP === */}
      {achievementPopups.length > 0 && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-bounce-in" onClick={() => setAchievementPopups(prev => prev.slice(1))}>
          <div className="bg-yellow-900/90 border border-yellow-500 rounded-xl px-4 py-3 max-w-xs text-center">
            <div className="text-2xl">{achievementPopups[0].emoji}</div>
            <div className="text-yellow-300 font-bold text-sm">{achievementPopups[0].name}</div>
            <div className="text-gray-300 text-xs">{achievementPopups[0].desc}</div>
            <div className="text-green-400 text-xs mt-1">{achievementPopups[0].bonusDesc}</div>
          </div>
        </div>
      )}

      {/* === RESOURCE HEADER === */}
      <div className="bg-gray-900/95 border-b border-gray-800 px-3 py-2 sticky top-0 z-30">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1.5">
            <span className="text-sm">{currentTierDef?.emoji}</span>
            <span className="text-xs text-gray-400">{currentTierDef?.name}</span>
            {state.composition && (
              <span className="text-xs text-purple-400 ml-1">
                {getCompositionDef(state.composition)?.emoji}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {state.currentShards > 0 && (
              <span className="text-xs text-orange-400">💎 {fmt(state.currentShards)}</span>
            )}
            {clickCombo > 2 && (
              <span className="text-xs text-yellow-400">x{clickCombo}</span>
            )}
          </div>
        </div>

        {/* 3 Resources */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-gray-800/50 rounded px-2 py-1">
            <div className="text-[10px] text-gray-500">Mass</div>
            <div className="text-sm font-bold text-blue-300">{fmtKg(state.mass)}</div>
            <div className="text-[10px] text-gray-500">{fmtRate(prod.massPerSec)}</div>
          </div>
          <div className="bg-gray-800/50 rounded px-2 py-1">
            <div className="text-[10px] text-gray-500">Velocity</div>
            <div className="text-sm font-bold text-green-300">{fmt(state.velocity)} m/s</div>
            <div className="text-[10px] text-gray-500">{fmtRate(prod.velocityPerSec)}</div>
          </div>
          <div className="bg-gray-800/50 rounded px-2 py-1">
            <div className="text-[10px] text-gray-500">Energy</div>
            <div className="text-sm font-bold text-yellow-300">{fmt(state.energy)} J</div>
            <div className="text-[10px] text-gray-500">{fmtRate(prod.energyPerSec)}</div>
          </div>
        </div>
      </div>

      {/* === TAB BAR === */}
      <div className="bg-gray-900/80 border-b border-gray-800 overflow-x-auto no-scrollbar">
        <div className="flex min-w-max">
          {allTabs.map(tab => {
            const unlocked = isTabUnlocked(tab.id, state.unlockedTabs);
            const active = state.activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabSwitch(tab.id)}
                className={`px-3 py-2 text-xs whitespace-nowrap border-b-2 transition-colors ${
                  active
                    ? 'border-blue-500 text-white bg-gray-800/50'
                    : unlocked
                    ? 'border-transparent text-gray-400 hover:text-gray-300'
                    : 'border-transparent text-gray-600 cursor-not-allowed'
                }`}
                disabled={!unlocked && tab.id !== 'dev'}
              >
                {tab.emoji} {tab.label}
                {!unlocked && tab.id !== 'impact' && tab.id !== 'achievements' && tab.id !== 'stats' && ' 🔒'}
              </button>
            );
          })}
          {state.devMode && (
            <button
              onClick={() => handleTabSwitch('dev')}
              className={`px-3 py-2 text-xs whitespace-nowrap border-b-2 transition-colors ${
                state.activeTab === 'dev' ? 'border-red-500 text-red-400' : 'border-transparent text-gray-600'
              }`}
            >🔧 Dev</button>
          )}
        </div>
      </div>

      {/* === MAIN CONTENT === */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">

        {/* === COMETS === */}
        {state.activeComets && state.activeComets.length > 0 && (
          <div className="relative w-full h-20 mb-2">
            {state.activeComets.map(comet => (
              <button
                key={comet.id}
                onClick={() => handleCatchComet(comet.id)}
                className="absolute text-2xl animate-pulse hover:scale-125 transition-transform"
                style={{ left: `${comet.x}%`, top: `${comet.y}%`, transform: 'translate(-50%, -50%)' }}
                title={`+${fmtKg(comet.value)}`}
              >
                ☄️
              </button>
            ))}
          </div>
        )}

        {/* ===================== METALS TAB ===================== */}
        {state.activeTab === 'metals' && (
          <>
            {/* Click area */}
            <div
              className="bg-gray-800 rounded-xl p-6 text-center cursor-pointer active:scale-95 transition-transform relative overflow-hidden"
              onClick={handleClick}
              onTouchStart={handleClick}
            >
              <div className="text-4xl mb-2">🪨</div>
              <div className="text-lg font-bold">Mine Asteroid</div>
              <div className="text-gray-400 text-sm">+{fmtKg(getClickValue(state))} per click</div>
              {/* Floating numbers */}
              {floatingNums.map(f => (
                <div
                  key={f.id}
                  className="absolute text-green-400 font-bold text-sm pointer-events-none animate-float-up"
                  style={{ left: f.x, top: f.y }}
                >
                  +{fmtKg(f.value)}
                </div>
              ))}
            </div>

            {/* Buy mode selector */}
            <div className="flex gap-2 justify-center">
              {([1, 10, 100, 'max'] as BuyMode[]).map(mode => (
                <button
                  key={mode}
                  onClick={() => setState({ ...state, buyMode: mode })}
                  className={`px-3 py-1 rounded text-xs font-bold ${
                    state.buyMode === mode ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400'
                  }`}
                >
                  {mode === 'max' ? 'MAX' : `x${mode}`}
                </button>
              ))}
            </div>

            {/* Metal buildings */}
            {METALS.map(def => {
              const owned = getBuildingCount(state, def);
              const count = state.buyMode === 'max' ? Math.max(1, getMaxAffordable(def, owned, state.mass)) : (state.buyMode as number);
              const cost = getTotalCostForN(def, owned, count);
              const canAfford = state.mass >= cost;
              return (
                <button
                  key={def.id}
                  onClick={() => handleBuy(def.id)}
                  disabled={!canAfford}
                  className={`w-full bg-gray-800 rounded-lg p-3 text-left transition-colors ${
                    canAfford ? 'hover:bg-gray-700 border border-gray-700' : 'opacity-50 border border-gray-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{def.emoji}</span>
                      <div>
                        <div className="text-sm font-bold">{def.name} <span className="text-gray-500 font-normal text-xs">({owned})</span></div>
                        <div className="text-gray-400 text-xs">{def.desc}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-xs font-bold ${canAfford ? 'text-green-400' : 'text-red-400'}`}>
                        {fmtKg(cost)}
                      </div>
                      <div className="text-gray-500 text-[10px]">
                        +{fmtRate(def.produces[0].baseAmount * count)} mass
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </>
        )}

        {/* ===================== EXPULSION TAB ===================== */}
        {state.activeTab === 'expulsion' && (
          <>
            {/* SECTION 1: JETTISON MASS → VELOCITY */}
            <div className="bg-gray-800 rounded-xl p-4">
              <div className="text-center mb-3">
                <div className="text-2xl mb-1">💨</div>
                <div className="text-lg font-bold">Mass Expulsion</div>
                <div className="text-gray-400 text-xs">Jettison mass to gain velocity</div>
              </div>

              {/* Slider */}
              <div className="mb-3">
                <div className="flex justify-between text-xs text-gray-400 mb-1">
                  <span>Jettison {expulsionPercent}% of mass</span>
                  <span>{fmtKg(massToJettison)}</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="100"
                  value={expulsionPercent}
                  onChange={(e) => setExpulsionPercent(Number(e.target.value))}
                  className="w-full accent-blue-500"
                />
                <div className="flex justify-between text-[10px] text-gray-600">
                  <span>1%</span>
                  <span>50%</span>
                  <span>100%</span>
                </div>
              </div>

              {/* Preview */}
              <div className="bg-gray-900 rounded-lg p-3 mb-3">
                <div className="flex justify-between items-center">
                  <div>
                    <div className="text-xs text-gray-500">You lose</div>
                    <div className="text-red-400 font-bold text-sm">{fmtKg(massToJettison)}</div>
                  </div>
                  <div className="text-gray-600">→</div>
                  <div className="text-right">
                    <div className="text-xs text-gray-500">You gain</div>
                    <div className="text-green-400 font-bold text-sm">+{fmt(velocityFromExpulsion)} m/s</div>
                  </div>
                </div>
                <div className="text-center text-[10px] text-gray-600 mt-1">
                  Rate: 1 velocity per {fmt(1 / effectiveExpulsionRate)} Kg
                </div>
              </div>

              {/* Cooldown / Button */}
              {state.expulsionCooldown > 0 ? (
                <div className="bg-gray-700 rounded-lg py-3 text-center">
                  <div className="text-gray-400 text-sm">Cooldown: {state.expulsionCooldown.toFixed(1)}s</div>
                  <div className="w-full bg-gray-600 rounded-full h-1 mt-1 mx-auto max-w-[200px]">
                    <div
                      className="bg-blue-500 h-1 rounded-full transition-all"
                      style={{ width: `${(1 - state.expulsionCooldown / EXPULSION_COOLDOWN) * 100}%` }}
                    />
                  </div>
                </div>
              ) : (
                <button
                  onClick={handleExpulsion}
                  disabled={state.mass <= 0}
                  className={`w-full py-3 rounded-lg font-bold text-sm transition-colors ${
                    state.mass > 0
                      ? 'bg-blue-600 hover:bg-blue-500 text-white'
                      : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  🚀 Jettison Mass
                </button>
              )}
            </div>

            {/* DIVIDER */}
            <div className="flex items-center gap-2 px-4">
              <div className="flex-1 border-t border-gray-700" />
              <div className="text-gray-600 text-xs">or</div>
              <div className="flex-1 border-t border-gray-700" />
            </div>

            {/* SECTION 2: SACRIFICE VELOCITY → MASS */}
            <div className="bg-gray-800 rounded-xl p-4">
              <div className="text-center mb-3">
                <div className="text-2xl mb-1">🔄</div>
                <div className="text-lg font-bold">Accumulation</div>
                <div className="text-gray-400 text-xs">Sacrifice velocity to regain mass (worse rate)</div>
              </div>

              {/* Amount input */}
              <div className="mb-3">
                <div className="flex justify-between text-xs text-gray-400 mb-1">
                  <span>Sacrifice velocity</span>
                  <span>Available: {fmt(state.velocity)} m/s</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max={Math.max(1, Math.floor(state.velocity))}
                  value={Math.min(accumulationAmount, Math.max(1, Math.floor(state.velocity)))}
                  onChange={(e) => setAccumulationAmount(Number(e.target.value))}
                  className="w-full accent-purple-500"
                />
                <div className="flex justify-between text-[10px] text-gray-600 mt-1">
                  <span>1 m/s</span>
                  <span>{fmt(Math.floor(state.velocity))} m/s</span>
                </div>
              </div>

              {/* Preview */}
              <div className="bg-gray-900 rounded-lg p-3 mb-3">
                <div className="flex justify-between items-center">
                  <div>
                    <div className="text-xs text-gray-500">You lose</div>
                    <div className="text-red-400 font-bold text-sm">{fmt(accumulationAmount)} m/s</div>
                  </div>
                  <div className="text-gray-600">→</div>
                  <div className="text-right">
                    <div className="text-xs text-gray-500">You gain</div>
                    <div className="text-green-400 font-bold text-sm">+{fmtKg(massFromAccumulation)}</div>
                  </div>
                </div>
                <div className="text-center text-[10px] text-gray-600 mt-1">
                  Rate: 1 velocity = {fmt(effectiveAccRate)} Kg (33% loss vs expulsion)
                </div>
              </div>

              <button
                onClick={handleAccumulation}
                disabled={state.velocity < accumulationAmount || accumulationAmount <= 0}
                className={`w-full py-3 rounded-lg font-bold text-sm transition-colors ${
                  state.velocity >= accumulationAmount && accumulationAmount > 0
                    ? 'bg-purple-600 hover:bg-purple-500 text-white'
                    : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                }`}
              >
                🔄 Sacrifice Velocity
              </button>
            </div>

            {/* Expulsion message */}
            {expulsionMsg && (
              <div className="bg-green-900/30 border border-green-700/50 rounded-lg p-2 text-center text-green-400 text-sm animate-bounce-in">
                {expulsionMsg}
              </div>
            )}

            {/* Rate info */}
            <div className="bg-gray-800/50 rounded-lg p-3 text-xs text-gray-500 space-y-1">
              <div>Expulsion rate: {fmt(effectiveExpulsionRate, 6)} vel/Kg {effectiveExpulsionRate > BASE_EXPULSION_RATE && <span className="text-green-400">(boosted!)</span>}</div>
              <div>Accumulation rate: {fmt(effectiveAccRate)} Kg/vel {effectiveAccRate > BASE_ACCUMULATION_RATE && <span className="text-green-400">(boosted!)</span>}</div>
              <div>Cooldown: {EXPULSION_COOLDOWN}s between jettisons</div>
              <div>Total expulsions: {state.totalExpulsions}</div>
            </div>
          </>
        )}

        {/* ===================== VELOCITY TAB ===================== */}
        {state.activeTab === 'velocity' && (
          <>
            <div className="text-center mb-2">
              <div className="text-2xl">🚀</div>
              <div className="text-sm text-gray-400">Spend velocity to produce energy</div>
            </div>

            {/* Buy mode selector */}
            <div className="flex gap-2 justify-center">
              {([1, 10, 100, 'max'] as BuyMode[]).map(mode => (
                <button
                  key={mode}
                  onClick={() => setState({ ...state, buyMode: mode })}
                  className={`px-3 py-1 rounded text-xs font-bold ${
                    state.buyMode === mode ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400'
                  }`}
                >
                  {mode === 'max' ? 'MAX' : `x${mode}`}
                </button>
              ))}
            </div>

            {/* Velocity ad boost */}
            {state.velocityAdAvailable && (
              <button
                onClick={handleVelocityAd}
                className="w-full bg-green-900/30 border border-green-500/50 rounded-lg p-3 text-center text-green-400 hover:bg-green-900/50"
              >
                📺 Watch Ad for 2x Velocity (20 min)
              </button>
            )}

            {VELOCITY_ITEMS.map(def => {
              const owned = getBuildingCount(state, def);
              const count = state.buyMode === 'max' ? Math.max(1, getMaxAffordable(def, owned, state.velocity)) : (state.buyMode as number);
              const cost = getTotalCostForN(def, owned, count);
              const canAfford = state.velocity >= cost;
              return (
                <button
                  key={def.id}
                  onClick={() => handleBuy(def.id)}
                  disabled={!canAfford}
                  className={`w-full bg-gray-800 rounded-lg p-3 text-left transition-colors ${
                    canAfford ? 'hover:bg-gray-700 border border-gray-700' : 'opacity-50 border border-gray-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{def.emoji}</span>
                      <div>
                        <div className="text-sm font-bold">{def.name} <span className="text-gray-500 font-normal text-xs">({owned})</span></div>
                        <div className="text-gray-400 text-xs">{def.desc}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-xs font-bold ${canAfford ? 'text-green-400' : 'text-red-400'}`}>
                        {fmt(cost)} m/s
                      </div>
                      <div className="text-gray-500 text-[10px]">
                        +{fmtRate(def.produces[0].baseAmount * count)} energy
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </>
        )}

        {/* ===================== ENERGY TAB ===================== */}
        {state.activeTab === 'energy' && (
          <>
            <div className="text-center mb-2">
              <div className="text-2xl">⚡</div>
              <div className="text-sm text-gray-400">Spend energy on permanent upgrades</div>
            </div>

            {ENERGY_UPGRADES.map(def => {
              const level = state.energyUpgrades[def.id] || 0;
              const maxed = level >= def.maxLevel;
              const cost = getEnergyUpgradeCost(def, level);
              const canAfford = state.energy >= cost && !maxed;
              return (
                <button
                  key={def.id}
                  onClick={() => handleBuyEnergyUpgrade(def.id)}
                  disabled={!canAfford}
                  className={`w-full bg-gray-800 rounded-lg p-3 text-left transition-colors ${
                    canAfford ? 'hover:bg-gray-700 border border-gray-700' : 'opacity-50 border border-gray-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{def.emoji}</span>
                      <div>
                        <div className="text-sm font-bold">
                          {def.name}
                          <span className="text-gray-500 font-normal text-xs ml-1">
                            {maxed ? '(MAX)' : def.isToggle ? (level > 0 ? '(ON)' : '(OFF)') : `(Lv ${level}/${def.maxLevel})`}
                          </span>
                        </div>
                        <div className="text-gray-400 text-xs">{def.effect}</div>
                      </div>
                    </div>
                    {!maxed && (
                      <div className={`text-xs font-bold ${canAfford ? 'text-green-400' : 'text-red-400'}`}>
                        {fmt(cost)} J
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </>
        )}

        {/* ===================== IMPACT TAB ===================== */}
        {state.activeTab === 'impact' && (
          <>
            <div className="text-center mb-3">
              <div className="text-3xl mb-1">{currentTierDef?.emoji}</div>
              <div className="text-lg font-bold">{currentTierDef?.name}</div>
              {nextTier && (
                <div className="text-gray-400 text-xs">
                  Next: {nextTier.emoji} {nextTier.name} ({fmt(nextTier.shardReq)} shards)
                </div>
              )}
            </div>

            {/* Shard info */}
            <div className="bg-gray-800 rounded-xl p-4 text-center mb-3">
              <div className="text-orange-400 text-2xl font-bold mb-1">💎 {fmt(state.currentShards)}</div>
              <div className="text-gray-400 text-xs">Lifetime: {fmt(state.lifetimeShards)} shards</div>
            </div>

            {/* Shard ad */}
            {state.shardAdAvailable && (
              <button
                onClick={handleShardAd}
                className="w-full bg-orange-900/30 border border-orange-500/50 rounded-lg p-3 text-center text-orange-400 hover:bg-orange-900/50 mb-3"
              >
                📺 Watch Ad for Bonus Shards (+{Math.max(1, Math.floor(state.lifetimeShards * 0.1))})
              </button>
            )}

            {/* Impact button */}
            <div className="bg-gray-800 rounded-xl p-4 text-center mb-3">
              <div className="text-sm text-gray-400 mb-2">
                Run mass earned: {fmtKg(state.runMassEarned)}
              </div>
              {canPrestige(state) ? (
                <>
                  <div className="text-green-400 font-bold mb-2">
                    +{fmt(calcShards(state.runMassEarned, state.currentTier))} Shards
                  </div>
                  <button
                    onClick={handleImpact}
                    className="bg-orange-600 hover:bg-orange-500 text-white font-bold py-3 px-6 rounded-lg text-lg"
                  >
                    💥 IMPACT!
                  </button>
                </>
              ) : (
                <div className="text-gray-500 text-sm">
                  Need {fmtKg(10000)} run mass to Impact
                  <br />(have {fmtKg(state.runMassEarned)})
                </div>
              )}
            </div>

            {/* Tab Unlocks */}
            <div className="text-sm font-bold text-gray-400 mb-2">Tab Unlocks</div>
            {TAB_UNLOCKS.map(unlock => {
              const isUnlocked = state.unlockedTabs[unlock.tabId];
              const canBuy = !isUnlocked &&
                state.currentShards >= unlock.shardCost &&
                state.totalPrestigeCount >= unlock.requiresPrestige &&
                !unlock.unlockViaImpact;
              const isVelocitySpecial = unlock.unlockViaImpact;
              const meetsVelocityThreshold = (unlock.velocityThreshold || 0) <= state.velocity;

              return (
                <div key={unlock.tabId} className={`bg-gray-800 rounded-lg p-3 mb-2 ${isUnlocked ? 'opacity-60' : ''}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span>{unlock.emoji}</span>
                      <div>
                        <div className="text-sm font-bold">{unlock.name} {isUnlocked && '✅'}</div>
                        <div className="text-gray-400 text-xs">{unlock.desc}</div>
                      </div>
                    </div>
                    {!isUnlocked && (
                      <div className="text-right">
                        {isVelocitySpecial ? (
                          <>
                            {meetsVelocityThreshold && !state.velocityUnlockReady ? (
                              <button
                                onClick={handleVelocityUnlockReady}
                                className="bg-green-600 hover:bg-green-500 text-white text-xs px-2 py-1 rounded"
                              >
                                Ready!
                              </button>
                            ) : state.velocityUnlockReady ? (
                              <span className="text-green-400 text-xs">Unlocks on Impact</span>
                            ) : (
                              <span className="text-gray-500 text-xs">
                                {fmt(state.velocity)}/{fmt(unlock.velocityThreshold || 0)} m/s
                              </span>
                            )}
                          </>
                        ) : canBuy ? (
                          <button
                            onClick={() => handleBuyTabUnlock(unlock.tabId)}
                            className="bg-orange-600 hover:bg-orange-500 text-white text-xs px-2 py-1 rounded"
                          >
                            💎 {fmt(unlock.shardCost)}
                          </button>
                        ) : (
                          <span className="text-gray-500 text-xs">
                            {state.totalPrestigeCount < unlock.requiresPrestige
                              ? `Need ${unlock.requiresPrestige} impacts`
                              : `💎 ${fmt(unlock.shardCost)}`}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Shard Upgrades */}
            <div className="text-sm font-bold text-gray-400 mb-2 mt-4">Shard Upgrades</div>
            {SHARD_UPGRADES.map(def => {
              const level = state.shardUpgrades[def.id] || 0;
              const maxed = level >= def.maxLevel;
              const cost = getShardUpgradeCost(def, level);
              const canBuy = !maxed && state.currentShards >= cost;
              return (
                <button
                  key={def.id}
                  onClick={() => handleBuyShardUpgrade(def.id)}
                  disabled={!canBuy}
                  className={`w-full bg-gray-800 rounded-lg p-3 text-left mb-2 ${
                    canBuy ? 'hover:bg-gray-700 border border-gray-700' : 'opacity-50 border border-gray-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span>{def.emoji}</span>
                      <div>
                        <div className="text-sm font-bold">
                          {def.name}
                          <span className="text-gray-500 font-normal text-xs ml-1">
                            {maxed ? '(MAX)' : `(Lv ${level}/${def.maxLevel})`}
                          </span>
                        </div>
                        <div className="text-gray-400 text-xs">{def.effect}</div>
                      </div>
                    </div>
                    {!maxed && (
                      <div className={`text-xs font-bold ${canBuy ? 'text-orange-400' : 'text-gray-500'}`}>
                        💎 {fmt(cost)}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </>
        )}

        {/* ===================== ACHIEVEMENTS TAB ===================== */}
        {state.activeTab === 'achievements' && (
          <>
            <div className="text-center mb-3">
              <div className="text-2xl">🏆</div>
              <div className="text-sm text-gray-400">
                {state.achievements.length}/{ACHIEVEMENTS.length} unlocked
              </div>
            </div>
            {ACHIEVEMENTS.filter(a => !a.hidden || state.achievements.includes(a.id)).map(def => {
              const unlocked = state.achievements.includes(def.id);
              return (
                <div
                  key={def.id}
                  className={`bg-gray-800 rounded-lg p-3 mb-2 ${unlocked ? '' : 'opacity-40'}`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{unlocked ? def.emoji : '❓'}</span>
                    <div>
                      <div className="text-sm font-bold">{unlocked ? def.name : '???'}</div>
                      <div className="text-gray-400 text-xs">{unlocked ? def.desc : 'Hidden achievement'}</div>
                      {unlocked && (
                        <div className="text-green-400 text-xs">{def.bonusDesc}</div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </>
        )}

        {/* ===================== STATS TAB ===================== */}
        {state.activeTab === 'stats' && (
          <>
            <div className="text-center mb-3">
              <div className="text-2xl">📊</div>
            </div>

            <div className="bg-gray-800 rounded-xl p-4 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-400">Total Mass Earned</span><span>{fmtKg(state.totalMassEarned)}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Highest Mass</span><span>{fmtKg(state.highestMass)}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Total Clicks</span><span>{fmt(state.totalClicks)}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Comets Caught</span><span>{fmt(state.cometsCaught)}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Total Impacts</span><span>{state.totalPrestigeCount}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Total Expulsions</span><span>{state.totalExpulsions}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Accumulation Uses</span><span>{state.accumulationUseCount}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Lifetime Shards</span><span>{fmt(state.lifetimeShards)}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Play Time</span><span>{fmtTime(state.totalPlayTime)}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Run Time</span><span>{fmtTime(state.runTime)}</span></div>
              {state.fastestPrestige < Infinity && (
                <div className="flex justify-between"><span className="text-gray-400">Fastest Impact</span><span>{fmtTime(state.fastestPrestige)}</span></div>
              )}
            </div>

            {/* Save / Load */}
            <div className="space-y-2 mt-4">
              <button
                onClick={() => { saveGame(stateRef.current); }}
                className="w-full bg-gray-800 hover:bg-gray-700 rounded-lg p-3 text-sm"
              >💾 Save Now</button>

              <button
                onClick={() => setShowImportExport(!showImportExport)}
                className="w-full bg-gray-800 hover:bg-gray-700 rounded-lg p-3 text-sm"
              >📦 Import / Export</button>

              {showImportExport && (
                <div className="bg-gray-900 rounded-lg p-3 space-y-2">
                  <button onClick={handleExport} className="w-full bg-blue-600 hover:bg-blue-500 rounded py-2 text-sm">
                    Export (copy to clipboard)
                  </button>
                  <textarea
                    value={importCode}
                    onChange={e => setImportCode(e.target.value)}
                    className="w-full bg-gray-800 rounded p-2 text-xs h-20"
                    placeholder="Paste save code here..."
                  />
                  <button onClick={handleImport} className="w-full bg-green-600 hover:bg-green-500 rounded py-2 text-sm">
                    Import
                  </button>
                </div>
              )}

              <button
                onClick={() => setShowResetConfirm(true)}
                className="w-full bg-red-900/30 hover:bg-red-900/50 border border-red-500/30 rounded-lg p-3 text-sm text-red-400"
              >🗑️ Hard Reset</button>

              {showResetConfirm && (
                <div className="bg-red-900/50 border border-red-500 rounded-lg p-3">
                  <div className="text-red-400 text-sm font-bold mb-2">Are you sure? This deletes EVERYTHING.</div>
                  <div className="flex gap-2">
                    <button onClick={() => setShowResetConfirm(false)} className="flex-1 bg-gray-700 rounded py-2 text-sm">Cancel</button>
                    <button onClick={handleHardReset} className="flex-1 bg-red-600 rounded py-2 text-sm font-bold">DELETE ALL</button>
                  </div>
                </div>
              )}

              {/* Dev mode entry */}
              {!state.devMode && (
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={devPasscode}
                    onChange={e => setDevPasscode(e.target.value)}
                    className="flex-1 bg-gray-800 rounded px-2 py-1 text-xs"
                    placeholder="Dev passcode"
                  />
                  <button onClick={handleDevPasscode} className="bg-gray-700 rounded px-3 text-xs">Go</button>
                </div>
              )}
            </div>
          </>
        )}

        {/* ===================== DEV TAB ===================== */}
        {state.activeTab === 'dev' && state.devMode && (
          <>
            <div className="text-center mb-3">
              <div className="text-2xl">🔧</div>
              <div className="text-sm text-red-400">Developer Mode</div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setState({ ...stateRef.current, mass: stateRef.current.mass + 1000000 })}
                className="bg-gray-800 hover:bg-gray-700 rounded p-2 text-xs">+1M Mass</button>
              <button onClick={() => setState({ ...stateRef.current, velocity: stateRef.current.velocity + 1000 })}
                className="bg-gray-800 hover:bg-gray-700 rounded p-2 text-xs">+1K Velocity</button>
              <button onClick={() => setState({ ...stateRef.current, energy: stateRef.current.energy + 10000 })}
                className="bg-gray-800 hover:bg-gray-700 rounded p-2 text-xs">+10K Energy</button>
              <button onClick={() => setState({ ...stateRef.current, currentShards: stateRef.current.currentShards + 100, lifetimeShards: stateRef.current.lifetimeShards + 100 })}
                className="bg-gray-800 hover:bg-gray-700 rounded p-2 text-xs">+100 Shards</button>
              <button onClick={() => {
                const s = stateRef.current;
                setState({ ...s, mass: s.mass + 1e12, totalMassEarned: s.totalMassEarned + 1e12, runMassEarned: s.runMassEarned + 1e12 });
              }} className="bg-gray-800 hover:bg-gray-700 rounded p-2 text-xs">+1T Mass (run)</button>
              <button onClick={() => setState({ ...stateRef.current, expulsionCooldown: 0 })}
                className="bg-gray-800 hover:bg-gray-700 rounded p-2 text-xs">Reset Cooldown</button>
              <button onClick={() => {
                const s = stateRef.current;
                const allUnlocked: Record<string, boolean> = {};
                TAB_UNLOCKS.forEach(t => allUnlocked[t.tabId] = true);
                setState({ ...s, unlockedTabs: { ...s.unlockedTabs, ...allUnlocked } });
              }} className="bg-gray-800 hover:bg-gray-700 rounded p-2 text-xs col-span-2">Unlock All Tabs</button>
            </div>
            <div className="text-gray-600 text-xs mt-3 text-center">v13.1 — Expulsion overhaul</div>
          </>
        )}
      </div>
    </div>
  );
}

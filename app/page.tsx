'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { GameState, TabName, BuyMode, FloatingNumber, AchievementPopup } from '@/lib/types';
import { defaultGameState, canPrestige, calcShards, getPrestigeResetState, PRESTIGE_TIERS } from '@/lib/prestige';
import { processClick, getClickValue, getMassPerSecond, getProduction, catchComet, purchaseBuilding, getCompositionDef, getUnlockedCompositions } from '@/lib/gameEngine';
import { METALS, DENSITY_ITEMS, VELOCITY_ITEMS, getBuildingCost, getBuildingCount, getMaxAffordable, getTotalCostForN, getDensity, MASS_PER_DENSITY, getEffectiveResource } from '@/lib/buildings';
import { ENERGY_UPGRADES, getEnergyUpgradeCost, canBuyEnergyUpgrade, getEnergyEffects } from '@/lib/energyUpgrades';
import { CONVERTERS, executeConversion, getConvertPresets } from '@/lib/converter';
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
  const [converterAmounts, setConverterAmounts] = useState<Record<string, number>>({});

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
      // Show comp picker if no composition selected
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
    // Combo system
    if (comboTimerRef.current) clearTimeout(comboTimerRef.current);
    const newCombo = clickCombo + 1;
    setClickCombo(newCombo);
    comboTimerRef.current = setTimeout(() => setClickCombo(0), 2000);

    const comboMult = 1 + Math.min(newCombo, 50) * 0.01;
    const clickVal = getClickValue(stateRef.current, comboMult);
    const newState = processClick(stateRef.current, comboMult);

    // Track max combo for achievement
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
          const def = [...METALS, ...DENSITY_ITEMS, ...VELOCITY_ITEMS].find(b => b.id === buildingId);
          if (!def) return 1;
          const owned = getBuildingCount(s, def);
          const available = getEffectiveResource(s, def.costResource);
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

  // Track last jettison message
  const [jettisonMsg, setJettisonMsg] = useState<string | null>(null);

  const handleConvert = useCallback((converterId: string) => {
    const s = stateRef.current;
    const conv = CONVERTERS.find(c => c.id === converterId);
    if (!conv) return;
    const amount = converterAmounts[converterId] || 0;
    if (amount <= 0) return;
    const result = executeConversion(s, conv, amount);
    if (result) {
      setState(result.state);
      if (result.massJettisoned > 0) {
        setJettisonMsg(`Jettisoned ${fmtKg(result.massJettisoned)} of mass`);
        setTimeout(() => setJettisonMsg(null), 3000);
      }
      setConverterAmounts(prev => ({ ...prev, [converterId]: 0 }));
    }
  }, [setState, converterAmounts]);

  const handleCatchComet = useCallback((cometId: number) => {
    const { state: newState, value } = catchComet(stateRef.current, cometId);
    if (value > 0) {
      setState(newState);
    }
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

    // Track fastest prestige
    if (s.runTime < newState.fastestPrestige) {
      newState.fastestPrestige = s.runTime;
    }

    // Check tier upgrades
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
      // Show comp picker if they have compositions to choose
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
    if (!importCode.trim()) return;
    const result = importSave(importCode.trim());
    if (result) {
      setState(result);
      saveGame(result);
      setShowImportExport(false);
      setImportCode('');
    }
  }, [importCode, setState]);

  // === COMPUTED VALUES ===
  const prod = getProduction(state);
  const clickVal = getClickValue(state);
  const tierDef = PRESTIGE_TIERS[state.currentTier];
  const canDoImpact = canPrestige(state);
  const shardEff = getShardEffects(state.shardUpgrades);
  const achieveEff = getAchievementEffects(state);
  const energyEff = getEnergyEffects(state);
  const bonusMult = shardEff.massMult * achieveEff.shardMult * (1 + (energyEff.shardMult - 1));
  const pendingShards = calcShards(state.runMassEarned, state.currentTier, bonusMult);

  // === TAB CONFIG ===
  const TAB_CONFIG: { id: TabName; label: string; emoji: string }[] = [
    { id: 'metals', label: 'Metals', emoji: '⛏️' },
    { id: 'density', label: 'Density', emoji: '🧊' },
    { id: 'velocity', label: 'Velocity', emoji: '💨' },
    { id: 'converter', label: 'Convert', emoji: '🔄' },
    { id: 'energy', label: 'Energy', emoji: '⚡' },
    { id: 'impact', label: 'Impact', emoji: '💥' },
    { id: 'achievements', label: 'Awards', emoji: '🏆' },
    { id: 'stats', label: 'Stats', emoji: '📊' },
  ];

  if (!loaded) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-white text-xl animate-pulse">Loading Impact...</div>
      </div>
    );
  }

  // === RENDER HELPERS ===

  function renderBuildingCard(def: typeof METALS[0], tab: 'metals' | 'density' | 'velocity') {
    const owned = getBuildingCount(state, def);
    const cost = getBuildingCost(def, owned);
    const resource = getEffectiveResource(state, def.costResource);
    const buyCount = state.buyMode === 'max' ? getMaxAffordable(def, owned, resource) : (state.buyMode as number);
    const totalCost = state.buyMode === 'max' ? (buyCount > 0 ? getTotalCostForN(def, owned, buyCount) : cost) : getTotalCostForN(def, owned, buyCount);
    const canAfford = resource >= totalCost && buyCount > 0;
    const costUnit = def.costResource === 'mass' ? 'Kg' : def.costResource;
    const displayCount = state.buyMode === 'max' ? (buyCount > 0 ? buyCount : 1) : buyCount;

    // For density costs, show the mass equivalent being jettisoned
    const isDensityCost = def.costResource === 'density';
    const massJettisoned = isDensityCost ? totalCost * MASS_PER_DENSITY : 0;

    return (
      <div key={def.id} className="bg-gray-800 rounded-lg p-3 mb-2">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-lg">{def.emoji}</span>
              <span className="text-white font-medium text-sm">{def.name}</span>
              <span className="text-gray-400 text-xs">x{owned}</span>
            </div>
            <p className="text-gray-400 text-xs mt-0.5">{def.desc}</p>
            <div className="text-green-400 text-xs mt-1">
              {def.produces.map((p, i) => (
                <span key={i}>
                  {i > 0 && ' + '}
                  +{fmt(p.baseAmount * owned)}/s {p.resource}
                </span>
              ))}
            </div>
            {isDensityCost && totalCost > 0 && (
              <div className="text-orange-400 text-[10px] mt-0.5">
                Jettisoning {fmtKg(massJettisoned)} of mass
              </div>
            )}
          </div>
          <button
            onClick={() => handleBuy(def.id)}
            disabled={!canAfford}
            className={`ml-2 px-3 py-2 rounded text-xs font-bold min-w-[80px] transition-colors ${
              canAfford
                ? 'bg-blue-600 hover:bg-blue-500 text-white'
                : 'bg-gray-700 text-gray-500 cursor-not-allowed'
            }`}
          >
            <div>Buy {displayCount > 1 ? `x${displayCount}` : ''}</div>
            <div className="text-[10px] opacity-80">{fmt(totalCost)} {costUnit}</div>
          </button>
        </div>
      </div>
    );
  }

  function renderTabBar() {
    return (
      <div className="flex overflow-x-auto gap-1 px-2 py-2 bg-gray-900 border-b border-gray-800 no-scrollbar">
        {TAB_CONFIG.map(tab => {
          const unlocked = isTabUnlocked(tab.id, state.unlockedTabs);
          const isActive = state.activeTab === tab.id;
          const unlockDef = TAB_UNLOCKS.find(t => t.tabId === tab.id);

          // Special: velocity tab with threshold-based unlock
          if (tab.id === 'velocity' && !unlocked && unlockDef?.unlockViaImpact) {
            const threshold = unlockDef.velocityThreshold || 50;
            const meetsThreshold = state.velocity >= threshold;
            return (
              <button
                key={tab.id}
                className="flex-shrink-0 px-3 py-1.5 rounded text-xs bg-gray-800 text-gray-600 border border-gray-700 relative"
                disabled
              >
                <span>{tab.emoji} {tab.label}</span>
                <div className="text-[9px] text-yellow-500">
                  {meetsThreshold
                    ? (state.velocityUnlockReady ? '⏳ Impact to unlock' : `✅ ${fmt(threshold)} vel reached`)
                    : `🔒 ${fmt(threshold)} vel`
                  }
                </div>
              </button>
            );
          }

          if (!unlocked) {
            return (
              <button
                key={tab.id}
                className="flex-shrink-0 px-3 py-1.5 rounded text-xs bg-gray-800 text-gray-600 border border-gray-700"
                disabled
              >
                <span>{tab.emoji} {tab.label}</span>
                {unlockDef && (
                  <div className="text-[9px] text-yellow-500">
                    🔒 {unlockDef.shardCost > 0 ? `${unlockDef.shardCost} shards` : `${unlockDef.requiresPrestige} impacts`}
                  </div>
                )}
              </button>
            );
          }

          return (
            <button
              key={tab.id}
              onClick={() => handleTabSwitch(tab.id)}
              className={`flex-shrink-0 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              {tab.emoji} {tab.label}
            </button>
          );
        })}
        {state.devMode && (
          <button
            onClick={() => handleTabSwitch('dev')}
            className={`flex-shrink-0 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              state.activeTab === 'dev' ? 'bg-red-600 text-white' : 'bg-gray-800 text-red-400 hover:bg-gray-700'
            }`}
          >
            🔧 Dev
          </button>
        )}
      </div>
    );
  }

  function renderHeader() {
    return (
      <div className="bg-gray-900 px-3 py-2 border-b border-gray-800">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <span className="text-lg">{tierDef.emoji}</span>
            <span className="text-white font-bold text-sm">{tierDef.name}</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-yellow-400">💎 {fmt(state.currentShards)}</span>
            {state.activeBoosts.velocityDouble.active && (
              <span className="text-green-400 animate-pulse">⚡2x Vel</span>
            )}
          </div>
        </div>
        <div className="grid grid-cols-4 gap-2 text-center">
          <div>
            <div className="text-gray-400 text-[10px]">Mass</div>
            <div className="text-white text-xs font-bold">{fmtKg(state.mass)}</div>
            <div className="text-green-400 text-[10px]">{fmtRate(prod.massPerSec)}</div>
          </div>
          <div>
            <div className="text-gray-400 text-[10px]">Density</div>
            <div className="text-cyan-300 text-xs font-bold">{fmt(getDensity(state))}</div>
            <div className="text-green-400 text-[10px]">{fmtRate(prod.densityPerSec)}</div>
          </div>
          <div>
            <div className="text-gray-400 text-[10px]">Velocity</div>
            <div className="text-purple-300 text-xs font-bold">{fmt(state.velocity)}</div>
            <div className="text-green-400 text-[10px]">{fmtRate(prod.velocityPerSec)}</div>
          </div>
          <div>
            <div className="text-gray-400 text-[10px]">Energy</div>
            <div className="text-yellow-300 text-xs font-bold">{fmt(state.energy)}</div>
            <div className="text-green-400 text-[10px]">{fmtRate(prod.energyPerSec)}</div>
          </div>
        </div>
      </div>
    );
  }

  function renderMetalsTab() {
    return (
      <div>
        {/* Click asteroid */}
        <div className="flex flex-col items-center py-4 relative select-none">
          <button
            onClick={handleClick}
            onTouchStart={handleClick}
            className="text-6xl active:scale-110 transition-transform cursor-pointer"
            style={{ WebkitTapHighlightColor: 'transparent' }}
          >
            {tierDef.emoji}
          </button>
          <div className="text-gray-400 text-xs mt-1">
            +{fmtKg(clickVal)} per click {clickCombo > 5 && <span className="text-yellow-400">x{clickCombo} combo!</span>}
          </div>
          {/* Floating numbers */}
          {floatingNums.map(f => (
            <div
              key={f.id}
              className="absolute text-yellow-400 font-bold text-sm pointer-events-none animate-float-up"
              style={{ left: f.x, top: f.y }}
            >
              +{fmtKg(f.value)}
            </div>
          ))}
        </div>

        {/* Buy mode selector */}
        <div className="flex gap-1 px-3 mb-2">
          {([1, 10, 100, 'max'] as BuyMode[]).map(mode => (
            <button
              key={mode}
              onClick={() => setState({ ...stateRef.current, buyMode: mode })}
              className={`flex-1 py-1 text-xs rounded font-medium ${
                state.buyMode === mode ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400'
              }`}
            >
              {mode === 'max' ? 'MAX' : `x${mode}`}
            </button>
          ))}
        </div>

        {/* Metal deposits */}
        <div className="px-3">
          {METALS.map(def => renderBuildingCard(def, 'metals'))}
        </div>
      </div>
    );
  }

  function renderDensityTab() {
    // Also show velocity unlock button if threshold met
    const velUnlockDef = TAB_UNLOCKS.find(t => t.tabId === 'velocity');
    const velThreshold = velUnlockDef?.velocityThreshold || 50;
    const meetsVelThreshold = state.velocity >= velThreshold;
    const showVelUnlockButton = velUnlockDef?.unlockViaImpact && !state.unlockedTabs['velocity'] && meetsVelThreshold && !state.velocityUnlockReady;

    return (
      <div>
        <div className="px-3 pt-2 pb-1 text-gray-400 text-xs">
          Spend density to build velocity. Density comes from your mass — spending density jettisons mass.
        </div>

        {/* Velocity unlock prompt */}
        {showVelUnlockButton && (
          <div className="mx-3 mb-2 bg-purple-900/50 border border-purple-500 rounded-lg p-3 text-center">
            <div className="text-purple-300 text-sm font-bold mb-1">💨 Velocity Research Available!</div>
            <div className="text-gray-400 text-xs mb-2">You've reached {fmt(velThreshold)} velocity. Unlock the Velocity tab through your next Impact!</div>
            <button
              onClick={handleVelocityUnlockReady}
              className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded font-bold text-sm"
            >
              Unlock Through Impact
            </button>
          </div>
        )}
        {state.velocityUnlockReady && !state.unlockedTabs['velocity'] && (
          <div className="mx-3 mb-2 bg-purple-900/30 border border-purple-700 rounded-lg p-2 text-center">
            <div className="text-purple-400 text-xs">⏳ Velocity tab will unlock after your next Impact!</div>
          </div>
        )}

        {/* Buy mode selector */}
        <div className="flex gap-1 px-3 mb-2">
          {([1, 10, 100, 'max'] as BuyMode[]).map(mode => (
            <button
              key={mode}
              onClick={() => setState({ ...stateRef.current, buyMode: mode })}
              className={`flex-1 py-1 text-xs rounded font-medium ${
                state.buyMode === mode ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400'
              }`}
            >
              {mode === 'max' ? 'MAX' : `x${mode}`}
            </button>
          ))}
        </div>

        <div className="px-3">
          {DENSITY_ITEMS.map(def => renderBuildingCard(def, 'density'))}
        </div>
      </div>
    );
  }

  function renderVelocityTab() {
    return (
      <div>
        <div className="px-3 pt-2 pb-1 text-gray-400 text-xs">
          Spend velocity to generate energy. Energy fuels expensive upgrades.
        </div>
        <div className="flex gap-1 px-3 mb-2">
          {([1, 10, 100, 'max'] as BuyMode[]).map(mode => (
            <button
              key={mode}
              onClick={() => setState({ ...stateRef.current, buyMode: mode })}
              className={`flex-1 py-1 text-xs rounded font-medium ${
                state.buyMode === mode ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400'
              }`}
            >
              {mode === 'max' ? 'MAX' : `x${mode}`}
            </button>
          ))}
        </div>
        <div className="px-3">
          {VELOCITY_ITEMS.map(def => renderBuildingCard(def, 'velocity'))}
        </div>
      </div>
    );
  }

  function renderConverterTab() {
    return (
      <div className="px-3 pt-2">
        <div className="text-gray-400 text-xs mb-3">Trade resources between mass, density, and velocity.</div>

        {/* Jettison notification */}
        {jettisonMsg && (
          <div className="bg-orange-900/50 border border-orange-500 rounded-lg p-2 mb-3 text-center">
            <div className="text-orange-300 text-xs font-bold">{jettisonMsg}</div>
          </div>
        )}

        {CONVERTERS.map(conv => {
          const fromVal = conv.from === 'mass' ? state.mass : conv.from === 'density' ? getDensity(state) : state.velocity;
          const amount = converterAmounts[conv.id] || 0;
          const gained = amount * conv.rate;
          const presets = getConvertPresets(fromVal);
          const isDensityFrom = conv.from === 'density';
          const massEquiv = isDensityFrom ? amount * MASS_PER_DENSITY : 0;

          return (
            <div key={conv.id} className="bg-gray-800 rounded-lg p-3 mb-2">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">{conv.emoji}</span>
                <span className="text-white font-medium text-sm">{conv.name}</span>
                <span className="text-gray-500 text-xs ml-auto">Rate: {conv.rate}</span>
              </div>
              <div className="text-gray-400 text-xs mb-1">
                Available: {fmt(fromVal)} {conv.from} → {amount > 0 ? `${fmt(gained)} ${conv.to}` : '...'}
              </div>
              {isDensityFrom && amount > 0 && (
                <div className="text-orange-400 text-[10px] mb-2">
                  Jettisoning {fmtKg(massEquiv)} of mass
                </div>
              )}
              <div className="flex gap-1 mb-2">
                {['10%', '25%', '50%', '100%'].map((label, i) => (
                  <button
                    key={label}
                    onClick={() => setConverterAmounts(prev => ({ ...prev, [conv.id]: presets[i] }))}
                    className="flex-1 py-1 text-xs rounded bg-gray-700 text-gray-300 hover:bg-gray-600"
                  >
                    {label}
                  </button>
                ))}
              </div>
              <button
                onClick={() => handleConvert(conv.id)}
                disabled={amount <= 0 || amount > fromVal}
                className={`w-full py-2 rounded text-sm font-bold ${
                  amount > 0 && amount <= fromVal
                    ? 'bg-green-600 hover:bg-green-500 text-white'
                    : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                }`}
              >
                Convert {amount > 0 ? fmt(amount) : '0'} {conv.from}
              </button>
            </div>
          );
        })}
      </div>
    );
  }

  function renderEnergyTab() {
    return (
      <div className="px-3 pt-2">
        <div className="text-gray-400 text-xs mb-2">Spend energy on powerful upgrades and automation.</div>
        <div className="text-yellow-300 text-xs mb-3">⚡ {fmt(state.energy)} energy available</div>

        {ENERGY_UPGRADES.map(def => {
          const level = state.energyUpgrades[def.id] || 0;
          const maxed = level >= def.maxLevel;
          const cost = getEnergyUpgradeCost(def, level);
          const canBuy = !maxed && state.energy >= cost;

          return (
            <div key={def.id} className="bg-gray-800 rounded-lg p-3 mb-2">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{def.emoji}</span>
                    <span className="text-white font-medium text-sm">{def.name}</span>
                    {def.isToggle ? (
                      <span className={`text-xs ${level > 0 ? 'text-green-400' : 'text-gray-500'}`}>
                        {level > 0 ? 'ON' : 'OFF'}
                      </span>
                    ) : (
                      <span className="text-gray-400 text-xs">Lv {level}/{def.maxLevel}</span>
                    )}
                  </div>
                  <p className="text-gray-400 text-xs mt-0.5">{def.desc}</p>
                  <div className="text-green-400 text-xs mt-1">{def.effect}</div>
                </div>
                <button
                  onClick={() => handleBuyEnergyUpgrade(def.id)}
                  disabled={!canBuy}
                  className={`ml-2 px-3 py-2 rounded text-xs font-bold min-w-[70px] transition-colors ${
                    maxed ? 'bg-gray-700 text-green-400' :
                    canBuy ? 'bg-yellow-600 hover:bg-yellow-500 text-white' :
                    'bg-gray-700 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  {maxed ? 'MAX' : `⚡ ${fmt(cost)}`}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  function renderImpactTab() {
    return (
      <div className="px-3 pt-2">
        {/* Prestige info */}
        <div className="bg-gray-800 rounded-lg p-4 mb-3 text-center">
          <div className="text-4xl mb-2">💥</div>
          <div className="text-white font-bold text-lg mb-1">Impact</div>
          <div className="text-gray-400 text-xs mb-3">
            Reset your resources and buildings to earn Impact Shards. Shards unlock tabs and permanent upgrades.
          </div>
          <div className="text-yellow-400 text-sm mb-1">
            Run Mass: {fmtKg(state.runMassEarned)}
          </div>
          <div className="text-yellow-300 text-lg font-bold mb-3">
            {canDoImpact ? `+${fmt(pendingShards)} shards` : 'Need 10,000 Kg mass this run'}
          </div>
          <button
            onClick={handleImpact}
            disabled={!canDoImpact}
            className={`w-full py-3 rounded-lg font-bold text-lg transition-colors ${
              canDoImpact
                ? 'bg-red-600 hover:bg-red-500 text-white'
                : 'bg-gray-700 text-gray-500 cursor-not-allowed'
            }`}
          >
            {canDoImpact ? '💥 IMPACT!' : '🔒 Keep Mining...'}
          </button>
        </div>

        {/* Tab unlocks */}
        <div className="text-gray-300 text-sm font-bold mb-2">Tab Unlocks</div>
        {TAB_UNLOCKS.map(def => {
          const unlocked = state.unlockedTabs[def.tabId];
          const canUnlock = !unlocked && state.currentShards >= def.shardCost && state.totalPrestigeCount >= def.requiresPrestige;

          // Special velocity tab unlock
          if (def.unlockViaImpact) {
            const threshold = def.velocityThreshold || 50;
            const met = state.velocity >= threshold;
            return (
              <div key={def.tabId} className={`bg-gray-800 rounded-lg p-3 mb-2 ${unlocked ? 'opacity-60' : ''}`}>
                <div className="flex items-center gap-2">
                  <span className="text-lg">{def.emoji}</span>
                  <span className="text-white font-medium text-sm">{def.name}</span>
                  {unlocked && <span className="text-green-400 text-xs ml-auto">✅ Unlocked</span>}
                  {!unlocked && state.velocityUnlockReady && <span className="text-purple-400 text-xs ml-auto">⏳ Next Impact</span>}
                  {!unlocked && !state.velocityUnlockReady && (
                    <span className="text-gray-500 text-xs ml-auto">
                      {met ? '✅ Ready' : `${fmt(threshold)} velocity needed`}
                    </span>
                  )}
                </div>
                <p className="text-gray-400 text-xs mt-1">{def.desc}</p>
              </div>
            );
          }

          return (
            <div key={def.tabId} className={`bg-gray-800 rounded-lg p-3 mb-2 ${unlocked ? 'opacity-60' : ''}`}>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{def.emoji}</span>
                  <span className="text-white font-medium text-sm">{def.name}</span>
                </div>
                {unlocked ? (
                  <span className="text-green-400 text-xs">✅ Unlocked</span>
                ) : (
                  <button
                    onClick={() => handleBuyTabUnlock(def.tabId)}
                    disabled={!canUnlock}
                    className={`px-3 py-1 rounded text-xs font-bold ${
                      canUnlock ? 'bg-yellow-600 text-white' : 'bg-gray-700 text-gray-500'
                    }`}
                  >
                    💎 {def.shardCost} ({def.requiresPrestige} impacts req)
                  </button>
                )}
              </div>
              <p className="text-gray-400 text-xs mt-1">{def.desc}</p>
            </div>
          );
        })}

        {/* Shard upgrades */}
        <div className="text-gray-300 text-sm font-bold mb-2 mt-4">Shard Upgrades (Permanent)</div>
        {SHARD_UPGRADES.map(def => {
          const level = state.shardUpgrades[def.id] || 0;
          const maxed = level >= def.maxLevel;
          const cost = getShardUpgradeCost(def, level);
          const canBuy = !maxed && state.currentShards >= cost;

          return (
            <div key={def.id} className="bg-gray-800 rounded-lg p-3 mb-2">
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2">
                    <span>{def.emoji}</span>
                    <span className="text-white text-sm">{def.name}</span>
                    <span className="text-gray-400 text-xs">Lv {level}/{def.maxLevel}</span>
                  </div>
                  <p className="text-gray-400 text-xs">{def.effect}</p>
                </div>
                <button
                  onClick={() => handleBuyShardUpgrade(def.id)}
                  disabled={!canBuy}
                  className={`ml-2 px-3 py-1 rounded text-xs font-bold ${
                    maxed ? 'bg-gray-700 text-green-400' :
                    canBuy ? 'bg-yellow-600 text-white' :
                    'bg-gray-700 text-gray-500'
                  }`}
                >
                  {maxed ? 'MAX' : `💎 ${fmt(cost)}`}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  function renderAchievementsTab() {
    const visible = ACHIEVEMENTS.filter(a => !a.hidden);
    const hidden = ACHIEVEMENTS.filter(a => a.hidden);
    const earned = state.achievements;

    return (
      <div className="px-3 pt-2">
        <div className="text-gray-400 text-xs mb-3">
          Earned: {earned.length}/{ACHIEVEMENTS.length} ({hidden.filter(h => earned.includes(h.id)).length} hidden found)
        </div>

        {visible.map(a => {
          const got = earned.includes(a.id);
          return (
            <div key={a.id} className={`bg-gray-800 rounded-lg p-3 mb-2 ${got ? '' : 'opacity-50'}`}>
              <div className="flex items-center gap-2">
                <span className="text-lg">{got ? a.emoji : '❓'}</span>
                <span className="text-white text-sm font-medium">{a.name}</span>
                {got && <span className="text-green-400 text-xs ml-auto">✅</span>}
              </div>
              <p className="text-gray-400 text-xs">{a.desc}</p>
              <p className="text-green-400 text-xs">{a.bonusDesc}</p>
            </div>
          );
        })}

        {/* Hidden achievements section */}
        <div className="text-gray-300 text-sm font-bold mt-4 mb-2">Hidden Achievements</div>
        {hidden.map(a => {
          const got = earned.includes(a.id);
          return (
            <div key={a.id} className={`bg-gray-800 rounded-lg p-3 mb-2`}>
              <div className="flex items-center gap-2">
                <span className="text-lg">{got ? a.emoji : '🔮'}</span>
                <span className="text-white text-sm font-medium">{got ? a.name : '???'}</span>
                {got && <span className="text-green-400 text-xs ml-auto">✅</span>}
              </div>
              <p className="text-gray-400 text-xs">{got ? a.desc : 'Do something special to discover this...'}</p>
              {got && <p className="text-green-400 text-xs">{a.bonusDesc}</p>}
            </div>
          );
        })}
      </div>
    );
  }

  function renderStatsTab() {
    const comp = state.composition ? getCompositionDef(state.composition) : null;

    return (
      <div className="px-3 pt-2">
        {/* Stats */}
        <div className="bg-gray-800 rounded-lg p-3 mb-3">
          <div className="text-white text-sm font-bold mb-2">Statistics</div>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between"><span className="text-gray-400">Total Mass Earned</span><span className="text-white">{fmtKg(state.totalMassEarned)}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">Highest Mass</span><span className="text-white">{fmtKg(state.highestMass)}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">Total Clicks</span><span className="text-white">{fmt(state.totalClicks)}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">Total Impacts</span><span className="text-white">{state.totalPrestigeCount}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">Lifetime Shards</span><span className="text-white">{fmt(state.lifetimeShards)}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">Comets Caught</span><span className="text-white">{state.cometsCaught}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">Total Play Time</span><span className="text-white">{fmtTime(state.totalPlayTime)}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">This Run</span><span className="text-white">{fmtTime(state.runTime)}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">Fastest Impact</span><span className="text-white">{state.fastestPrestige < Infinity ? fmtTime(state.fastestPrestige) : '--'}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">Tier</span><span className="text-white">{tierDef.emoji} {tierDef.name}</span></div>
            {comp && (
              <div className="flex justify-between"><span className="text-gray-400">Composition</span><span className="text-white">{comp.emoji} {comp.name}</span></div>
            )}
          </div>
        </div>

        {/* Composition */}
        {state.composition && comp && (
          <div className="bg-gray-800 rounded-lg p-3 mb-3">
            <div className="text-white text-sm font-bold mb-1">Composition: {comp.emoji} {comp.name}</div>
            <p className="text-gray-400 text-xs mb-1">{comp.desc}</p>
            <div className="text-xs space-y-0.5">
              {comp.massMult !== 1 && <div className={comp.massMult > 1 ? 'text-green-400' : 'text-red-400'}>Mass: {fmtPercent(comp.massMult)}</div>}
              {comp.densityMult !== 1 && <div className={comp.densityMult > 1 ? 'text-green-400' : 'text-red-400'}>Density: {fmtPercent(comp.densityMult)}</div>}
              {comp.velocityMult !== 1 && <div className={comp.velocityMult > 1 ? 'text-green-400' : 'text-red-400'}>Velocity: {fmtPercent(comp.velocityMult)}</div>}
              {comp.clickMult !== 1 && <div className={comp.clickMult > 1 ? 'text-green-400' : 'text-red-400'}>Click: {fmtPercent(comp.clickMult)}</div>}
              {comp.cometMult !== 1 && <div className={comp.cometMult > 1 ? 'text-green-400' : 'text-red-400'}>Comet: {fmtPercent(comp.cometMult)}</div>}
            </div>
          </div>
        )}

        {/* Settings */}
        <div className="bg-gray-800 rounded-lg p-3 mb-3">
          <div className="text-white text-sm font-bold mb-2">Settings</div>
          <div className="space-y-2">
            <button
              onClick={() => { saveGame(stateRef.current); }}
              className="w-full py-2 bg-blue-700 hover:bg-blue-600 text-white text-xs rounded font-medium"
            >
              💾 Save Game
            </button>
            <button
              onClick={() => setShowImportExport(true)}
              className="w-full py-2 bg-gray-700 hover:bg-gray-600 text-white text-xs rounded font-medium"
            >
              📦 Import / Export
            </button>
            <button
              onClick={() => setShowResetConfirm(true)}
              className="w-full py-2 bg-red-900 hover:bg-red-800 text-red-300 text-xs rounded font-medium"
            >
              ⚠️ Hard Reset
            </button>
          </div>
        </div>

        {/* Dev passcode */}
        {!state.devMode && (
          <div className="bg-gray-800 rounded-lg p-3 mb-3">
            <div className="flex gap-2">
              <input
                type="password"
                value={devPasscode}
                onChange={e => setDevPasscode(e.target.value)}
                placeholder="Dev code"
                className="flex-1 bg-gray-700 text-white text-xs px-2 py-1 rounded"
              />
              <button
                onClick={handleDevPasscode}
                className="bg-gray-600 text-gray-300 text-xs px-3 py-1 rounded"
              >
                Enter
              </button>
            </div>
          </div>
        )}

        <div className="text-center text-gray-600 text-[10px] pb-4">
          Impact v13.0
        </div>
      </div>
    );
  }

  function renderDevTab() {
    return (
      <div className="px-3 pt-2">
        <div className="text-red-400 text-sm font-bold mb-3">🔧 Developer Tools</div>
        <div className="space-y-2">
          <button onClick={() => setState({ ...stateRef.current, mass: stateRef.current.mass + 1000000 })} className="w-full py-2 bg-gray-800 text-white text-xs rounded">+1M Mass</button>
          <button onClick={() => setState({ ...stateRef.current, mass: stateRef.current.mass + 1000000000 })} className="w-full py-2 bg-gray-800 text-white text-xs rounded">+1B Mass</button>
          <button onClick={() => setState({ ...stateRef.current, density: stateRef.current.density + 10000 })} className="w-full py-2 bg-gray-800 text-cyan-300 text-xs rounded">+10K Density</button>
          <button onClick={() => setState({ ...stateRef.current, velocity: stateRef.current.velocity + 10000 })} className="w-full py-2 bg-gray-800 text-purple-300 text-xs rounded">+10K Velocity</button>
          <button onClick={() => setState({ ...stateRef.current, energy: stateRef.current.energy + 10000 })} className="w-full py-2 bg-gray-800 text-yellow-300 text-xs rounded">+10K Energy</button>
          <button onClick={() => setState({ ...stateRef.current, currentShards: stateRef.current.currentShards + 1000, lifetimeShards: stateRef.current.lifetimeShards + 1000 })} className="w-full py-2 bg-gray-800 text-yellow-400 text-xs rounded">+1K Shards</button>
          <button onClick={() => {
            const s = stateRef.current;
            setState({
              ...s,
              unlockedTabs: { density: true, velocity: true, converter: true, energy: true },
            });
          }} className="w-full py-2 bg-gray-800 text-green-400 text-xs rounded">Unlock All Tabs</button>
          <button onClick={() => setState({ ...stateRef.current, totalPrestigeCount: stateRef.current.totalPrestigeCount + 10 })} className="w-full py-2 bg-gray-800 text-red-400 text-xs rounded">+10 Impact Count</button>
        </div>

        <div className="mt-4 bg-gray-800 rounded-lg p-3">
          <div className="text-white text-xs font-bold mb-1">State Debug</div>
          <div className="text-gray-400 text-[10px] space-y-0.5">
            <div>Mass: {state.mass.toFixed(2)} | Density: {state.density.toFixed(4)} | Vel: {state.velocity.toFixed(4)} | Energy: {state.energy.toFixed(4)}</div>
            <div>Run Mass: {state.runMassEarned.toFixed(2)} | Shards: {state.currentShards}/{state.lifetimeShards}</div>
            <div>Tier: {state.currentTier} | Impacts: {state.totalPrestigeCount} | Comp: {state.composition || 'none'}</div>
            <div>Tabs: {JSON.stringify(state.unlockedTabs)}</div>
            <div>Metals: {JSON.stringify(state.metals)}</div>
            <div>VelUnlockReady: {String(state.velocityUnlockReady)}</div>
            <div>Comets: {state.activeComets.length} | Next: {state.nextCometIn.toFixed(1)}s</div>
            <div>Version: {state.version}</div>
          </div>
        </div>
      </div>
    );
  }

  function renderActiveTab() {
    switch (state.activeTab) {
      case 'metals': return renderMetalsTab();
      case 'density': return renderDensityTab();
      case 'velocity': return renderVelocityTab();
      case 'converter': return renderConverterTab();
      case 'energy': return renderEnergyTab();
      case 'impact': return renderImpactTab();
      case 'achievements': return renderAchievementsTab();
      case 'stats': return renderStatsTab();
      case 'dev': return renderDevTab();
      default: return renderMetalsTab();
    }
  }

  // === MAIN RENDER ===
  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col max-w-md mx-auto relative overflow-hidden" style={{ height: '100dvh' }}>
      {/* Header */}
      {renderHeader()}

      {/* Ad boost banners */}
      {state.shardAdAvailable && (
        <div
          onClick={handleShardAd}
          className="bg-yellow-900/80 border-b border-yellow-600 px-3 py-2 text-center cursor-pointer hover:bg-yellow-800/80 transition-colors"
        >
          <div className="text-yellow-300 text-xs font-bold">💎 Shard Bonus Available!</div>
          <div className="text-yellow-200 text-[10px]">Tap to earn {fmt(Math.max(1, Math.floor(state.lifetimeShards * 0.1)))} shards</div>
        </div>
      )}
      {state.velocityAdAvailable && (
        <div
          onClick={handleVelocityAd}
          className="bg-purple-900/80 border-b border-purple-600 px-3 py-2 text-center cursor-pointer hover:bg-purple-800/80 transition-colors"
        >
          <div className="text-purple-300 text-xs font-bold">⚡ Velocity Boost Available!</div>
          <div className="text-purple-200 text-[10px]">Tap to double velocity for 20 minutes</div>
        </div>
      )}

      {/* Tab bar */}
      {renderTabBar()}

      {/* Content area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto pb-4">
        {renderActiveTab()}
      </div>

      {/* Floating comets */}
      {state.activeComets.map(comet => (
        <div
          key={comet.id}
          onClick={() => handleCatchComet(comet.id)}
          className="absolute cursor-pointer animate-pulse z-50"
          style={{
            left: `${comet.x}%`,
            top: `${Math.min(comet.y + 20, 80)}%`,
            transform: 'translate(-50%, -50%)',
          }}
        >
          <div className="text-2xl">☄️</div>
          <div className="text-[10px] text-yellow-400 text-center whitespace-nowrap">
            +{fmtKg(comet.value)}
          </div>
          <div className="text-[8px] text-gray-500 text-center">{Math.ceil(comet.timeLeft)}s</div>
        </div>
      ))}

      {/* Achievement popup */}
      {achievementPopups.length > 0 && (
        <div
          onClick={() => setAchievementPopups(prev => prev.slice(1))}
          className="absolute top-16 left-1/2 -translate-x-1/2 z-50 bg-gray-800 border border-yellow-500 rounded-lg p-3 shadow-lg shadow-yellow-500/20 animate-bounce-in cursor-pointer max-w-[280px]"
        >
          <div className="text-center">
            <div className="text-2xl mb-1">{achievementPopups[0].emoji}</div>
            <div className="text-yellow-400 text-xs font-bold">Achievement Unlocked!</div>
            <div className="text-white text-sm font-bold">{achievementPopups[0].name}</div>
            <div className="text-gray-400 text-[10px]">{achievementPopups[0].desc}</div>
            <div className="text-green-400 text-[10px] mt-1">{achievementPopups[0].bonusDesc}</div>
            <div className="text-gray-600 text-[8px] mt-2">tap to dismiss</div>
          </div>
        </div>
      )}

      {/* Impact warning modal */}
      {showImpactWarning && (
        <div className="absolute inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-red-500 rounded-lg p-4 max-w-sm w-full">
            <div className="text-center mb-3">
              <div className="text-3xl mb-2">💥</div>
              <div className="text-red-400 font-bold text-lg">Impact Warning!</div>
            </div>
            <div className="mb-3">
              <div className="text-red-300 text-xs font-bold mb-1">Will be RESET:</div>
              <div className="text-gray-400 text-xs">Mass, Density, Velocity, Energy, All buildings, Energy upgrades, Composition</div>
            </div>
            <div className="mb-4">
              <div className="text-green-300 text-xs font-bold mb-1">Will be KEPT:</div>
              <div className="text-gray-400 text-xs">Shards (+{fmt(pendingShards)} new), Tab unlocks, Shard upgrades, Achievements, Tier progress</div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowImpactWarning(false)}
                className="flex-1 py-2 bg-gray-700 text-white rounded text-sm"
              >
                Cancel
              </button>
              <button
                onClick={confirmImpact}
                className="flex-1 py-2 bg-red-600 hover:bg-red-500 text-white rounded text-sm font-bold"
              >
                💥 IMPACT!
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Impact explosion animation */}
      {impactExploding && (
        <div className="absolute inset-0 z-[60] pointer-events-none">
          <div className="absolute inset-0 bg-white animate-impact-flash" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-20 h-20 border-4 border-orange-500 rounded-full animate-impact-ring" />
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-40 h-40 border-2 border-red-400 rounded-full animate-impact-ring" style={{ animationDelay: '0.2s' }} />
          </div>
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className="absolute w-2 h-2 bg-orange-400 rounded-full animate-impact-debris"
              style={{
                left: '50%',
                top: '50%',
                '--angle': `${i * 45}deg`,
              } as React.CSSProperties}
            />
          ))}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-white text-3xl font-black animate-impact-text">IMPACT!</div>
          </div>
        </div>
      )}

      {/* Composition picker modal */}
      {showCompPicker && (
        <div className="absolute inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 max-w-sm w-full">
            <div className="text-white font-bold text-lg mb-1 text-center">Choose Composition</div>
            <div className="text-gray-400 text-xs mb-3 text-center">This affects production for this run.</div>
            {getUnlockedCompositions(state.currentTier).map(comp => (
              <button
                key={comp.id}
                onClick={() => handleCompSelect(comp.id)}
                className="w-full bg-gray-800 hover:bg-gray-700 rounded-lg p-3 mb-2 text-left transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xl">{comp.emoji}</span>
                  <span className="text-white font-medium">{comp.name}</span>
                </div>
                <p className="text-gray-400 text-xs mt-1">{comp.desc}</p>
                <div className="text-xs mt-1 flex flex-wrap gap-2">
                  {comp.massMult !== 1 && <span className={comp.massMult > 1 ? 'text-green-400' : 'text-red-400'}>Mass {fmtPercent(comp.massMult)}</span>}
                  {comp.densityMult !== 1 && <span className={comp.densityMult > 1 ? 'text-green-400' : 'text-red-400'}>Density {fmtPercent(comp.densityMult)}</span>}
                  {comp.velocityMult !== 1 && <span className={comp.velocityMult > 1 ? 'text-green-400' : 'text-red-400'}>Velocity {fmtPercent(comp.velocityMult)}</span>}
                  {comp.cometMult !== 1 && <span className={comp.cometMult > 1 ? 'text-green-400' : 'text-red-400'}>Comet {fmtPercent(comp.cometMult)}</span>}
                </div>
              </button>
            ))}
            <button
              onClick={() => setShowCompPicker(false)}
              className="w-full py-2 text-gray-500 text-xs mt-1"
            >
              Skip (no bonus)
            </button>
          </div>
        </div>
      )}

      {/* Offline gains modal */}
      {offlineGains && (
        <div className="absolute inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 max-w-sm w-full text-center">
            <div className="text-2xl mb-2">🌙</div>
            <div className="text-white font-bold mb-1">Welcome Back!</div>
            <div className="text-gray-400 text-xs mb-2">You were away for {fmtTime(offlineGains.time)}</div>
            <div className="text-green-400 text-sm font-bold">+{fmtKg(offlineGains.mass)} mass earned</div>
            <button
              onClick={() => setOfflineGains(null)}
              className="mt-3 px-6 py-2 bg-blue-600 text-white rounded text-sm"
            >
              Nice!
            </button>
          </div>
        </div>
      )}

      {/* Import/Export modal */}
      {showImportExport && (
        <div className="absolute inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 max-w-sm w-full">
            <div className="text-white font-bold mb-3">Import / Export Save</div>
            <button
              onClick={handleExport}
              className="w-full py-2 bg-blue-700 text-white text-xs rounded mb-2"
            >
              📋 Copy Save to Clipboard
            </button>
            <textarea
              value={importCode}
              onChange={e => setImportCode(e.target.value)}
              placeholder="Paste save code here..."
              className="w-full bg-gray-800 text-white text-xs p-2 rounded mb-2 h-20"
            />
            <button
              onClick={handleImport}
              disabled={!importCode.trim()}
              className="w-full py-2 bg-green-700 text-white text-xs rounded mb-2"
            >
              📥 Import Save
            </button>
            <button
              onClick={() => { setShowImportExport(false); setImportCode(''); }}
              className="w-full py-2 bg-gray-700 text-gray-300 text-xs rounded"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Hard reset confirm */}
      {showResetConfirm && (
        <div className="absolute inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-red-500 rounded-lg p-4 max-w-sm w-full text-center">
            <div className="text-3xl mb-2">⚠️</div>
            <div className="text-red-400 font-bold text-lg mb-2">Hard Reset</div>
            <div className="text-gray-400 text-xs mb-4">This will DELETE ALL progress permanently. Are you sure?</div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="flex-1 py-2 bg-gray-700 text-white rounded text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleHardReset}
                className="flex-1 py-2 bg-red-600 text-white rounded text-sm font-bold"
              >
                DELETE ALL
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

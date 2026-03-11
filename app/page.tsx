'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { GameState, TabName, BuyMode, FloatingNumber } from '@/lib/types';
import { defaultGameState } from '@/lib/prestige';
import { processClick, buyProcess, activateOrbitalMechanic, getMassPerSecond, getClickValue, catchComet, activateElementalCharge } from '@/lib/gameEngine';
import { getProcessCost, getMaxAffordable, PROCESSES } from '@/lib/processes';
import { ORBITAL_MECHANICS, getUnlockedOM, getTotalEnergyDrain } from '@/lib/orbitalMechanics';
import { CORE_UPGRADES, canPurchaseUpgrade, getUpgradeCost } from '@/lib/upgrades';
import { COMPOSITIONS, getUnlockedCompositions } from '@/lib/compositions';
import { calcShards, canPrestige, getPrestigeResetState, PRESTIGE_TIERS } from '@/lib/prestige';
import { DISCOVERIES, checkDiscoveries, checkPrestigeDiscoveries } from '@/lib/discoveries';
import { getGravityMultiplier, getDensityMultiplier, getGravityZone, getDensityZone, getEnergyRegen, getMaxEnergy, getGravityOverloadMult, getDensityOverheatDrain } from '@/lib/resources';
import { fmt, fmtPct, fmtTime } from '@/lib/format';
import { saveGame, loadGame, calculateOfflineGains, hardReset, exportSave, importSave } from '@/lib/saveLoad';
import { useGameLoop } from '@/hooks/useGameLoop';
import SwipeableNotification, { NotificationData, NotificationType } from '@/components/SwipeableNotification';
import TutorialOverlay, { ContextualHint } from '@/components/TutorialOverlay';
import { WALKTHROUGH_STEPS, checkContextualHints, TutorialStep } from '@/lib/tutorial';
import BoostBar from '@/components/BoostBar';
import AdModal from '@/components/AdModal';
import { BoostType, applyBoost } from '@/lib/boosts';
import FeedbackButton from '@/components/FeedbackButton';
import FeedbackForm from '@/components/FeedbackForm';
import { initAdMob } from '@/lib/adMobBridge';
import { FORGE_RECIPES, getUnlockedForges, getForgeCost, canForge, purchaseForge, getForgeEffects } from '@/lib/forge';

export default function GamePage() {
  const [state, setStateRaw] = useState<GameState>(defaultGameState());
  const stateRef = useRef(state);
  const [floatingNums, setFloatingNums] = useState<FloatingNumber[]>([]);
  const [toasts, setToasts] = useState<NotificationData[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [offlineGains, setOfflineGains] = useState<{mass: number, time: number} | null>(null);
  const nextFloatId = useRef(0);
  const nextToastId = useRef(0);
  const [tutorialStep, setTutorialStep] = useState(-1);
  const [contextualHint, setContextualHint] = useState<TutorialStep | null>(null);
  const lastHintCheckRef = useRef(0);
  const [pendingBoost, setPendingBoost] = useState<BoostType | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [showCompInfo, setShowCompInfo] = useState(false);
  const [devPasscode, setDevPasscode] = useState('');
  const [showImpactWarning, setShowImpactWarning] = useState(false);
  const [impactExploding, setImpactExploding] = useState(false);

  // Click combo system
  const [clickCombo, setClickCombo] = useState(0);
  const comboTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Scroll state for mini asteroid
  const [isScrolled, setIsScrolled] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Draggable mini asteroid position
  const [miniPos, setMiniPos] = useState<{x: number, y: number}>({ x: 16, y: -1 }); // y=-1 means auto
  const isDragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  const setState = useCallback((s: GameState) => {
    stateRef.current = s;
    setStateRaw(s);
  }, []);

  // Ensure text size adjust on mobile
  useEffect(() => {
    document.documentElement.style.setProperty('-webkit-text-size-adjust', '100%');
  }, []);

  // Initialize AdMob on native platforms
  useEffect(() => {
    initAdMob();
  }, []);

  // Load saved mini-asteroid position
  useEffect(() => {
    try {
      const saved = localStorage.getItem('impact_mini_pos');
      if (saved) setMiniPos(JSON.parse(saved));
    } catch {}
  }, []);

  // Save mini-asteroid position when it changes
  useEffect(() => {
    try {
      localStorage.setItem('impact_mini_pos', JSON.stringify(miniPos));
    } catch {}
  }, [miniPos]);

  // Scroll listener for content area
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      setIsScrolled(el.scrollTop > 100);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [loaded]);

  // Mini asteroid drag handlers
  const handleDragStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    isDragging.current = true;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const el = (e.target as HTMLElement).closest('.mini-asteroid') as HTMLElement;
    if (el) {
      const rect = el.getBoundingClientRect();
      dragOffset.current = { x: clientX - rect.left, y: clientY - rect.top };
    }
    e.preventDefault();
  }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent | TouchEvent) => {
      if (!isDragging.current) return;
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      setMiniPos({
        x: Math.max(0, Math.min(window.innerWidth - 60, clientX - dragOffset.current.x)),
        y: Math.max(0, Math.min(window.innerHeight - 60, clientY - dragOffset.current.y)),
      });
    };
    const onEnd = () => { isDragging.current = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onEnd);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onEnd);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onEnd);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
    };
  }, []);

  // Load save on mount
  useEffect(() => {
    const saved = loadGame();
    if (saved) {
      const { state: restored, offlineTime } = calculateOfflineGains(saved);
      if (offlineTime > 5) {
        const offlineMass = restored.totalMassEarned - saved.totalMassEarned;
        setOfflineGains({ mass: offlineMass, time: offlineTime });
      }
      setState(restored);
    } else {
      setTutorialStep(0);
    }
    setLoaded(true);
  }, [setState]);

  // Game loop
  useGameLoop(stateRef, setState);

  // Check contextual hints periodically
  useEffect(() => {
    if (!loaded || tutorialStep >= 0) return;
    const interval = setInterval(() => {
      const s = stateRef.current;
      if (s.tutorialSkipped && s.tutorialCompleted.length === 0) return;
      const hints = checkContextualHints(s);
      if (hints.length > 0 && !contextualHint) {
        setContextualHint(hints[0]);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [loaded, tutorialStep, contextualHint]);

  const addToast = useCallback((message: string, emoji: string = '✨', type: NotificationType = 'toast') => {
    const id = nextToastId.current++;
    setToasts(prev => [...prev, { id, message, emoji, type }]);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // Tutorial handlers
  const handleTutorialNext = useCallback(() => {
    const nextStep = tutorialStep + 1;
    const currentStepDef = WALKTHROUGH_STEPS[tutorialStep];
    if (currentStepDef) {
      const s = stateRef.current;
      setState({
        ...s,
        tutorialCompleted: [...s.tutorialCompleted, currentStepDef.id],
      });
    }
    if (nextStep >= WALKTHROUGH_STEPS.length) {
      setTutorialStep(-1);
    } else {
      setTutorialStep(nextStep);
    }
  }, [tutorialStep, setState]);

  const handleTutorialSkip = useCallback(() => {
    setTutorialStep(-1);
    const s = stateRef.current;
    setState({ ...s, tutorialSkipped: true });
  }, [setState]);

  const handleDismissHint = useCallback(() => {
    if (contextualHint) {
      const s = stateRef.current;
      setState({
        ...s,
        tutorialCompleted: [...s.tutorialCompleted, contextualHint.id],
      });
      setContextualHint(null);
    }
  }, [contextualHint, setState]);

  // Boost handlers
  const handleActivateBoost = useCallback((type: BoostType) => {
    const s = stateRef.current;
    if (s.adsRemoved) {
      const result = applyBoost(type, s);
      if (result) {
        setState(result);
        addToast(`Boost activated!`, '⚡', 'reward');
      }
    } else {
      setPendingBoost(type);
    }
  }, [setState, addToast]);

  const handleAdComplete = useCallback(() => {
    if (pendingBoost) {
      const result = applyBoost(pendingBoost, stateRef.current);
      if (result) {
        setState(result);
        addToast(`Boost activated!`, '⚡', 'reward');
      }
      setPendingBoost(null);
    }
  }, [pendingBoost, setState, addToast]);

  const handleAdCancel = useCallback(() => {
    setPendingBoost(null);
  }, []);

  // Click handler with combo system
  const handleClick = useCallback((e: React.MouseEvent) => {
    setClickCombo(prev => {
      const newCombo = Math.min(prev + 1, 20);
      if (comboTimerRef.current) clearTimeout(comboTimerRef.current);
      comboTimerRef.current = setTimeout(() => setClickCombo(0), 1500);
      return newCombo;
    });
    const comboMult = 1 + (Math.min(clickCombo, 20) / 20) * 4;
    const newState = processClick(stateRef.current, comboMult);
    const clickValue = newState.mass - stateRef.current.mass;
    if (clickCombo > (newState.maxComboReached || 0)) {
      newState.maxComboReached = clickCombo;
    }
    setState(newState);
    const id = nextFloatId.current++;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setFloatingNums(prev => [...prev, { id, value: clickValue || 1, x, y, opacity: 1 }]);
    setTimeout(() => setFloatingNums(prev => prev.filter(f => f.id !== id)), 1000);
  }, [setState, clickCombo]);

  // Mini asteroid click — acts as clicking the asteroid (earns mass)
  const handleMiniClick = useCallback(() => {
    if (isDragging.current) return;
    // Same combo logic as main asteroid
    setClickCombo(prev => {
      const newCombo = Math.min(prev + 1, 20);
      if (comboTimerRef.current) clearTimeout(comboTimerRef.current);
      comboTimerRef.current = setTimeout(() => setClickCombo(0), 1500);
      return newCombo;
    });
    const comboMult = 1 + (Math.min(clickCombo, 20) / 20) * 4;
    const newState = processClick(stateRef.current, comboMult);
    if (clickCombo > (newState.maxComboReached || 0)) {
      newState.maxComboReached = clickCombo;
    }
    setState(newState);
  }, [setState, clickCombo]);

  // Buy info helper
  const getBuyInfo = useCallback((processDef: typeof PROCESSES[0], owned: number, mass: number, buyMode: BuyMode, hasDiscount: boolean) => {
    if (buyMode === 'max') {
      let affordable = 0;
      let totalCost = 0;
      let remaining = mass;
      for (let i = 0; i < 9999; i++) {
        let nextCost = getProcessCost(processDef, owned + i);
        if (hasDiscount) nextCost *= 0.5;
        if (remaining < nextCost) break;
        remaining -= nextCost;
        totalCost += nextCost;
        affordable++;
      }
      if (affordable === 0) {
        let singleCost = getProcessCost(processDef, owned);
        if (hasDiscount) singleCost *= 0.5;
        return { count: 0, totalCost: singleCost, canAfford: false, label: fmt(singleCost) };
      }
      return { count: affordable, totalCost, canAfford: true, label: `${fmt(totalCost)} (x${affordable})` };
    } else {
      const count = buyMode as number;
      let totalCost = 0;
      for (let i = 0; i < count; i++) {
        let nextCost = getProcessCost(processDef, owned + i);
        if (hasDiscount) nextCost *= 0.5;
        totalCost += nextCost;
      }
      const canAfford = mass >= totalCost;
      return { count, totalCost, canAfford, label: fmt(totalCost) };
    }
  }, []);

  // Buy process
  const handleBuy = useCallback((processId: string) => {
    const s = stateRef.current;
    const processDef = PROCESSES.find(p => p.id === processId);
    if (!processDef) return;
    const owned = s.processes[processId] || 0;
    const hasDiscount = s.omToggles?.['process_optimizer'] || false;
    const info = getBuyInfo(processDef, owned, s.mass, s.buyMode, hasDiscount);
    if (!info.canAfford || info.count <= 0) return;
    const newState = {
      ...s,
      mass: s.mass - info.totalCost,
      processes: { ...s.processes, [processId]: owned + info.count },
    };
    setState(newState);
  }, [setState, getBuyInfo]);

  const handleOM = useCallback((omId: string) => {
    const omDef = ORBITAL_MECHANICS.find(o => o.id === omId);
    if (!omDef) return;
    const currentState = stateRef.current;
    const result = activateOrbitalMechanic(omId, currentState);
    if (result) {
      result.omUsedThisRun = true;
      if (omDef.isToggle) {
        result.totalOrbitalToggles = (result.totalOrbitalToggles || 0) + 1;
      }
      setState(result);
      if (omDef.isToggle) {
        const wasOn = currentState.omToggles?.[omId] || false;
        addToast(`${omDef.name} ${wasOn ? 'OFF' : 'ON'}`, wasOn ? '🔴' : '🟢');
      } else {
        addToast(`Activated ${omDef.name}`, '🚀');
      }
    }
  }, [setState, addToast]);

  const handleUpgrade = useCallback((upgradeId: string) => {
    const s = stateRef.current;
    const def = CORE_UPGRADES.find(u => u.id === upgradeId);
    if (!def || !canPurchaseUpgrade(def, s)) return;
    const level = s.coreUpgrades[upgradeId] || 0;
    const cost = getUpgradeCost(def, level);
    setState({
      ...s,
      currentShards: s.currentShards - cost,
      coreUpgrades: { ...s.coreUpgrades, [upgradeId]: level + 1 },
    });
    addToast(`Upgraded ${def.name}!`, def.emoji);
  }, [setState, addToast]);

  const doPrestige = useCallback(() => {
    const s = stateRef.current;
    if (!canPrestige(s)) return;
    const prestigeDiscoveries = checkPrestigeDiscoveries(s);
    let updatedState = { ...s };
    if (prestigeDiscoveries.length > 0) {
      updatedState.discoveries = [...updatedState.discoveries, ...prestigeDiscoveries];
      for (const dId of prestigeDiscoveries) {
        const d = DISCOVERIES.find(dd => dd.id === dId);
        if (d) addToast(`${d.hidden ? '🔒 Secret: ' : ''}${d.name}!`, d.emoji, 'reward');
      }
    }
    if (s.runTime > 0 && s.runTime < (updatedState.fastestPrestige || Infinity)) {
      updatedState.fastestPrestige = s.runTime;
    }
    let shardMult = 1;
    if (updatedState.boosts.prestigeDouble.active && !updatedState.boosts.prestigeDouble.usedThisRun) {
      shardMult = 2;
    }
    const forgeShardMult = getForgeEffects(updatedState).shardMult;
    const shardsEarned = calcShards(updatedState.runMassEarned, updatedState.currentTier, shardMult, updatedState.discoveries, forgeShardMult);
    let newState = getPrestigeResetState(updatedState);
    if (shardMult === 2) {
      newState.boosts = {
        ...newState.boosts,
        prestigeDouble: { active: false, usedThisRun: true },
      };
    }
    newState.currentShards += shardsEarned;
    newState.lifetimeShards += shardsEarned;
    for (let i = updatedState.currentTier + 1; i <= 5; i++) {
      if (newState.lifetimeShards >= PRESTIGE_TIERS[i].shardReq) {
        newState.currentTier = i as any;
      }
    }
    setState(newState);
    const doubleText = shardMult === 2 ? ' (2x bonus!)' : '';
    addToast(`Impact! +${fmt(shardsEarned)} shards${doubleText}`, '💥');
  }, [setState, addToast]);

  const handlePrestige = useCallback(() => {
    setShowImpactWarning(false);
    setImpactExploding(true);
    // Play explosion animation for 1.5s, then do the actual prestige
    setTimeout(() => {
      doPrestige();
      // Keep explosion overlay briefly after reset
      setTimeout(() => {
        setImpactExploding(false);
      }, 500);
    }, 1500);
  }, [doPrestige]);

  const handleComposition = useCallback((id: string) => {
    setState({ ...stateRef.current, composition: id as any });
    addToast(`Composition: ${id}`, '🪨');
  }, [setState, addToast]);

  const handleCatchComet = useCallback((cometId: number) => {
    const { state: newState, value } = catchComet(stateRef.current, cometId);
    if (value > 0) {
      setState(newState);
      addToast(`Comet caught! +${fmt(value)} mass`, '☄️');
    }
  }, [setState, addToast]);

  const handleForge = useCallback((forgeId: string) => {
    const forgeDef = FORGE_RECIPES.find(f => f.id === forgeId);
    if (!forgeDef) return;
    const result = purchaseForge(forgeDef, stateRef.current);
    if (result) {
      setState(result);
      addToast(`Forged ${forgeDef.name}!`, forgeDef.emoji);
    }
  }, [setState, addToast]);

  const handleCharge = useCallback((processId: string) => {
    const result = activateElementalCharge(stateRef.current, processId);
    if (result) {
      setState(result);
      const pName = PROCESSES.find(p => p.id === processId)?.name || processId;
      addToast(`Charged ${pName}! +50% for 8s`, '💎');
    }
  }, [setState, addToast]);

  const setTab = useCallback((tab: TabName) => {
    setState({ ...stateRef.current, activeTab: tab });
  }, [setState]);

  const setBuyMode = useCallback((mode: BuyMode) => {
    setState({ ...stateRef.current, buyMode: mode });
  }, [setState]);

  if (!loaded) {
    return <div className="flex items-center justify-center h-screen bg-space"><span className="glow-cyan text-2xl">Loading Impact...</span></div>;
  }

  const { activeTab } = state;
  const hasAnyUpgrade = Object.values(state.coreUpgrades).some(v => v > 0);
  const tabs: { id: TabName; label: string; icon: string }[] = [
    { id: 'build', label: 'Build', icon: '🏗️' },
    { id: 'orbital', label: 'Orbital', icon: '🚀' },
    ...(hasAnyUpgrade ? [{ id: 'forge' as TabName, label: 'Forge', icon: '🔥' }] : []),
    { id: 'upgrades', label: 'Upgrades', icon: '⬆️' },
    { id: 'prestige', label: 'Impact', icon: '💥' },
    { id: 'discover', label: 'Discover', icon: '🔍' },
    { id: 'stats', label: 'Stats', icon: '📊' },
    ...(state.devMode ? [{ id: 'dev' as TabName, label: 'Dev', icon: '🛠️' }] : []),
  ];

  // Calculate display values
  const gravMult = getGravityMultiplier(state.gravity);
  const densMult = getDensityMultiplier(state.density);
  const gravZone = getGravityZone(state.gravity);
  const densZone = getDensityZone(state.density);
  const massPerSec = getMassPerSecond(state);
  const shardsOnPrestige = canPrestige(state) ? calcShards(state.runMassEarned, state.currentTier, 1, state.discoveries, getForgeEffects(state).shardMult) : 0;
  const currentTierDef = PRESTIGE_TIERS[state.currentTier];
  const nextTierDef = state.currentTier < 5 ? PRESTIGE_TIERS[state.currentTier + 1] : null;
  const unlockedComps = getUnlockedCompositions(state.currentTier);
  const unlockedOM = getUnlockedOM(state.currentTier);

  // Show mini asteroid whenever scrolled on build tab, or always on other tabs
  const showMiniAsteroid = activeTab !== 'build' || isScrolled;

  return (
    <div className="scanlines flex flex-col game-shell no-select safe-top">
      {/* Resource Header */}
      <div className="bg-space-light border-b border-gray-700 px-5 sm:px-6 py-2.5">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            <span className="glow-cyan font-bold text-base sm:text-xl truncate">{currentTierDef.emoji} {currentTierDef.name}</span>
            {state.composition && <button className="badge badge-purple cursor-pointer hover:brightness-125 active:scale-95 transition-all" onClick={() => setShowCompInfo(true)}>{COMPOSITIONS.find(c => c.id === state.composition)?.name} ⓘ</button>}
          </div>
          <div className="flex gap-2 shrink-0 items-center">
            <button className="btn-secondary text-sm px-2.5 py-1" onClick={() => saveGame(state)}>Save</button>
            <button className="btn-secondary text-sm px-2.5 py-1" onClick={() => setTab('stats')}>⚙</button>
            <span className="text-xs text-gray-600">v12.7</span>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2 sm:gap-3">
          {/* Mass */}
          <div>
            <div className="text-xs text-gray-400 uppercase tracking-wider">Mass</div>
            <div className="glow-cyan text-base font-bold">{fmt(state.mass)}</div>
            {massPerSec > 0 && <div className="text-sm text-green font-bold">+{fmt(massPerSec)}/s</div>}
          </div>
          {/* Gravity */}
          <div>
            <div className="text-xs text-gray-400 uppercase tracking-wider">Gravity <span className="text-white normal-case">{fmt(state.gravity, 0)}/300</span></div>
            <div className="resource-bar mt-1">
              <div className="resource-bar-fill" style={{width: `${(state.gravity / 300) * 100}%`, background: gravZone.color}} />
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-xs font-bold" style={{color: gravZone.color}}>{gravZone.label}</span>
              <span className="badge" style={{background: gravMult >= 1 ? 'rgba(0,255,136,0.15)' : 'rgba(255,51,102,0.15)', color: gravMult >= 1 ? 'var(--color-green)' : 'var(--color-red)', border: 'none', fontSize: '0.65rem'}}>{gravMult.toFixed(2)}x</span>
              {state.gravity > 250 && <span className="text-xs text-red font-bold animate-pulse">-{Math.round((1 - getGravityOverloadMult(state.gravity)) * 100)}% mass!</span>}
            </div>
          </div>
          {/* Density */}
          <div>
            <div className="text-xs text-gray-400 uppercase tracking-wider">Density <span className="text-white normal-case">{state.density.toFixed(1)}%</span></div>
            <div className="resource-bar mt-1">
              <div className="resource-bar-fill" style={{width: `${state.density}%`, background: densZone.color}} />
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-xs font-bold" style={{color: densZone.color}}>{densZone.label}</span>
              <span className="badge" style={{background: densMult >= 1 ? 'rgba(180,74,255,0.15)' : 'rgba(255,51,102,0.15)', color: densMult >= 1 ? 'var(--color-purple)' : 'var(--color-red)', border: 'none', fontSize: '0.65rem'}}>{densMult.toFixed(2)}x</span>
              {state.density > 85 && <span className="text-xs text-red font-bold animate-pulse">-{getDensityOverheatDrain(state.density).toFixed(1)} nrg!</span>}
            </div>
          </div>
          {/* Energy */}
          <div>
            <div className="text-xs text-gray-400 uppercase tracking-wider">Energy <span className="text-white normal-case">{Math.floor(state.energy)}/{getMaxEnergy(state)}</span></div>
            <div className="resource-bar mt-1">
              <div className="resource-bar-fill" style={{width: `${(state.energy / getMaxEnergy(state)) * 100}%`, background: 'var(--color-orange)'}} />
            </div>
            <div className="text-xs text-orange mt-0.5 font-bold">+{getEnergyRegen(state).toFixed(1)}/s</div>
          </div>
        </div>
      </div>

      {/* Boost Bar */}
      <BoostBar state={state} onActivateBoost={handleActivateBoost} />

      {/* Tab Navigation */}
      <div className="tab-bar border-b border-gray-700 bg-space-light px-3">
        {tabs.map(t => (
          <button key={t.id} className={`tab whitespace-nowrap flex-1 justify-center ${activeTab === t.id ? 'tab-active' : ''}`} onClick={() => setTab(t.id)}>
            <span className="sm:mr-1">{t.icon}</span><span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 sm:px-6 py-3 pb-16 safe-bottom">
        {/* Composition Picker */}
        {!state.composition && activeTab === 'build' && (
          <div className="mb-4">
            <div className="section-header"><h2 className="glow-cyan text-lg font-bold">Choose Your Composition</h2></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {unlockedComps.map(c => (
                <button key={c.id} className="card text-left hover:border-neon transition-colors" onClick={() => handleComposition(c.id)}>
                  <div className="font-bold text-base">{c.emoji} {c.name}</div>
                  <div className="text-sm text-gray-400 mt-1">{c.desc}</div>
                  <div className="glow-divider" />
                  <div className="text-sm text-purple">{c.specialName}: {c.specialDesc}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* BUILD TAB */}
        {activeTab === 'build' && (
          <div>
            {/* Click area */}
            <div className="flex justify-center mb-6 mt-1">
              <div className="relative cursor-pointer select-none" onClick={handleClick}>
                <div className={`w-28 h-28 sm:w-32 sm:h-32 rounded-full bg-gradient-to-br from-gray-600 to-gray-800 border-2 flex items-center justify-center text-4xl hover:scale-105 transition-all active:scale-95 ${clickCombo >= 15 ? 'border-yellow' : clickCombo >= 8 ? 'border-orange' : clickCombo >= 3 ? 'border-neon' : 'border-gray-500'}`} style={{boxShadow: `0 0 ${Math.min(30, Math.log10(state.mass + 1) * 3) + clickCombo * 1.5}px ${clickCombo >= 15 ? 'var(--color-yellow)' : clickCombo >= 8 ? 'var(--color-orange)' : 'var(--color-neon)'}`}}>
                  {currentTierDef.emoji}
                </div>
                <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-xs text-gray-400 whitespace-nowrap">
                  +{fmt(getClickValue(state, 1 + (Math.min(clickCombo, 20) / 20) * 4))}/click
                </div>
                {clickCombo >= 3 && (
                  <div className={`absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-bold px-2 py-0.5 rounded-full ${clickCombo >= 15 ? 'bg-yellow text-space' : clickCombo >= 8 ? 'bg-orange text-space' : 'bg-neon text-space'}`}>
                    {(1 + (Math.min(clickCombo, 20) / 20) * 4).toFixed(1)}x COMBO
                  </div>
                )}
                {floatingNums.map(f => (
                  <div key={f.id} className="float-up absolute text-neon font-bold pointer-events-none text-base" style={{left: f.x, top: f.y}}>
                    +{fmt(f.value)}
                  </div>
                ))}
              </div>
            </div>

            {/* Buy mode selector */}
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs text-gray-400 uppercase tracking-wider">Buy:</span>
              {([1, 5, 10, 100, 'max'] as BuyMode[]).map(m => (
                <button key={String(m)} className={`text-sm px-2.5 py-1.5 rounded-md min-h-[36px] transition-all ${state.buyMode === m ? 'bg-neon text-space font-bold shadow-[0_0_10px_rgba(0,240,255,0.3)]' : 'bg-space-lighter text-gray-400 hover:text-neon hover:border-neon border border-transparent'}`} onClick={() => setBuyMode(m)}>
                  {m === 'max' ? 'MAX' : `x${m}`}
                </button>
              ))}
            </div>

            {/* Process list */}
            <div className="space-y-2.5">
              {PROCESSES.map(p => {
                const owned = state.processes[p.id] || 0;
                const hasDiscount = state.omToggles?.['process_optimizer'] || false;
                const buyInfo = getBuyInfo(p, owned, state.mass, state.buyMode, hasDiscount);
                const unlocked = !p.unlockCondition ||
                  (p.unlockCondition.type === 'mass' && state.totalMassEarned >= p.unlockCondition.value) ||
                  (p.unlockCondition.type === 'tier' && state.currentTier >= p.unlockCondition.value) ||
                  (p.unlockCondition.type === 'gravity' && state.gravity >= p.unlockCondition.value);
                if (!unlocked && owned === 0) return null;

                const isCharged = state.chargedProcess === p.id && state.chargeCooldown > 0;
                return (
                  <div key={p.id} className={`card flex items-center justify-between ${isCharged ? 'border-purple shadow-[0_0_12px_rgba(180,74,255,0.3)]' : buyInfo.canAfford ? 'hover:border-neon' : 'opacity-60'}`}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-lg">{p.emoji}</span>
                        <span className="font-bold text-base">{p.name}</span>
                        <span className="badge badge-cyan">x{owned}</span>
                        {p.compositionBonus === state.composition && <span className="badge badge-purple">★ bonus</span>}
                        {isCharged && <span className="badge badge-yellow">⚡ {Math.ceil(state.chargeCooldown)}s</span>}
                      </div>
                      <div className="text-sm text-gray-400 mt-1">{p.desc}</div>
                      <div className="flex flex-wrap gap-2 mt-1.5">
                        <span className="badge badge-green">+{fmt(p.baseMPS)}/s mass</span>
                        {p.gravityPS > 0 && <span className="badge badge-orange">+{p.gravityPS}/s grav</span>}
                        {p.densityPS > 0 && <span className="badge badge-purple">+{fmtPct(p.densityPS)}/s dens</span>}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5 ml-3 shrink-0">
                      <button className="btn-primary text-xs min-w-[6rem] max-w-[8rem] text-center truncate" disabled={!buyInfo.canAfford} onClick={() => handleBuy(p.id)}>
                        {buyInfo.label}
                      </button>
                      {state.composition === 'carbonaceous' && owned > 0 && (
                        <button
                          className="text-xs px-2 py-1 rounded-md min-w-[5.5rem] text-center transition-all bg-purple/20 text-purple border border-purple/40 hover:bg-purple/30 disabled:opacity-40 disabled:cursor-not-allowed"
                          disabled={state.chargeCooldown > 0 || state.density < 5}
                          onClick={() => handleCharge(p.id)}
                        >
                          ⚡ Charge
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ORBITAL TAB */}
        {activeTab === 'orbital' && (() => {
          const totalDrain = getTotalEnergyDrain(state.omToggles || {});
          const energyRegen = getEnergyRegen(state);
          const maxEnergy = getMaxEnergy(state);
          const netEnergy = energyRegen - totalDrain;
          const isSustainable = netEnergy >= 0;
          const activeToggleCount = Object.values(state.omToggles || {}).filter(Boolean).length;
          const toggleOMs = unlockedOM.filter(om => om.isToggle);
          const oneShotOMs = unlockedOM.filter(om => !om.isToggle);

          return (
            <div>
              {/* Energy Status Header */}
              <div className={`card mb-4 ${isSustainable ? 'border-green' : 'border-red'}`} style={{borderWidth: '2px'}}>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-base">⚡ Energy</span>
                  <span className="text-base font-bold" style={{color: isSustainable ? 'var(--color-green)' : 'var(--color-red)'}}>
                    {Math.floor(state.energy)}/{maxEnergy}
                  </span>
                </div>
                <div className="resource-bar mb-2">
                  <div className="resource-bar-fill" style={{
                    width: `${(state.energy / maxEnergy) * 100}%`,
                    background: state.energy < 20 ? 'var(--color-red)' : isSustainable ? 'var(--color-green)' : 'var(--color-orange)'
                  }} />
                </div>
                <div className="flex justify-between text-sm flex-wrap gap-1">
                  <span className="badge badge-green">Regen +{energyRegen.toFixed(1)}/s</span>
                  <span className="badge badge-orange">Drain −{totalDrain.toFixed(1)}/s</span>
                  <span className="badge" style={{
                    background: isSustainable ? 'rgba(0,255,136,0.15)' : 'rgba(255,51,102,0.15)',
                    color: isSustainable ? 'var(--color-green)' : 'var(--color-red)',
                    border: `1px solid ${isSustainable ? 'rgba(0,255,136,0.3)' : 'rgba(255,51,102,0.3)'}`,
                  }}>
                    Net {netEnergy >= 0 ? '+' : ''}{netEnergy.toFixed(1)}/s
                  </span>
                </div>
                {activeToggleCount > 0 && (
                  <div className="text-xs text-gray-400 mt-1.5">{activeToggleCount} toggle{activeToggleCount !== 1 ? 's' : ''} active</div>
                )}
              </div>

              {/* Toggle Mechanics */}
              <div className="section-header"><h2 className="glow-purple text-lg font-bold">Toggles</h2></div>
              <div className="text-xs text-gray-400 mb-2 px-1">Click to turn ON/OFF. Drains energy while active.</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-4">
                {toggleOMs.map(om => {
                  const isOn = state.omToggles?.[om.id] || false;
                  const canAffordStartup = state.energy >= om.energyCost;
                  const canToggle = isOn || canAffordStartup;
                  return (
                    <button
                      key={om.id}
                      className={`card text-left relative transition-all ${
                        isOn
                          ? 'border-green box-glow-green'
                          : canToggle
                          ? 'hover:border-neon'
                          : 'opacity-50'
                      }`}
                      onClick={() => handleOM(om.id)}
                      disabled={!canToggle}
                    >
                      <div className={`absolute top-2 right-2 text-xs font-bold px-2 py-0.5 rounded-full ${
                        isOn ? 'bg-green text-space' : 'bg-gray-700 text-gray-400'
                      }`}>
                        {isOn ? 'ON' : 'OFF'}
                      </div>
                      <div className="flex items-center gap-2 pr-12">
                        <span className="text-lg">{om.emoji}</span>
                        <span className="font-bold text-sm">{om.name}</span>
                      </div>
                      <div className="text-sm text-gray-400 mt-1">{om.desc}</div>
                      <div className="flex gap-2 mt-2">
                        <span className="badge badge-orange">{om.energyCost}E start</span>
                        <span className="badge" style={{background: 'rgba(255,51,102,0.15)', color: 'var(--color-red)', border: '1px solid rgba(255,51,102,0.3)'}}>−{om.energyDrain}/s</span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* One-Shot Mechanics */}
              {oneShotOMs.length > 0 && (
                <>
                  <div className="section-header"><h2 className="glow-orange text-lg font-bold">One-Shots</h2></div>
                  <div className="text-xs text-gray-400 mb-2 px-1">Activate for a burst effect. Has cooldown.</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {oneShotOMs.map(om => {
                      const cd = state.omCooldowns[om.id] || 0;
                      const isActive = (state.omActive[om.id] || 0) > 0;
                      const canUse = state.energy >= om.energyCost && cd <= 0 && !(om.id === 'singularity_pull' && state.singularityUsed);
                      return (
                        <button
                          key={om.id}
                          className={`card text-left relative ${
                            isActive
                              ? 'border-purple box-glow-purple'
                              : canUse
                              ? 'hover:border-neon'
                              : 'opacity-50'
                          }`}
                          onClick={() => handleOM(om.id)}
                          disabled={!canUse}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{om.emoji}</span>
                            <span className="font-bold text-sm">{om.name}</span>
                          </div>
                          <div className="text-sm text-gray-400 mt-1">{om.desc}</div>
                          <div className="flex gap-2 mt-2 flex-wrap">
                            <span className="badge badge-orange">{om.energyCost}E</span>
                            <span className="badge badge-cyan">{om.duration > 0 ? `${om.duration}s` : 'Once/run'}</span>
                            <span className={`badge ${cd > 0 ? '' : 'badge-green'}`} style={cd > 0 ? {background: 'rgba(255,51,102,0.15)', color: 'var(--color-red)', border: '1px solid rgba(255,51,102,0.3)'} : undefined}>
                              {om.id === 'singularity_pull' && state.singularityUsed
                                ? 'Used'
                                : cd > 0
                                ? `${cd.toFixed(1)}s`
                                : 'Ready'}
                            </span>
                          </div>
                          {isActive && (
                            <div className="absolute top-2 right-2 badge badge-purple">
                              {state.omActive[om.id]?.toFixed(1)}s
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          );
        })()}

        {/* UPGRADES TAB */}
        {activeTab === 'upgrades' && (
          <div>
            <div className="section-header"><h2 className="glow-orange text-lg font-bold">Core Upgrades</h2></div>
            <div className="flex items-center gap-2 mb-3 px-1">
              <span className="text-sm text-gray-400">Shards:</span>
              <span className="badge badge-yellow text-sm">{fmt(state.currentShards)} 💎</span>
            </div>
            {(['foundation', 'synergy', 'density', 'energy'] as const).map(path => (
              <div key={path} className="mb-4">
                <div className="section-header">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">{path} Path</h3>
                </div>
                <div className="space-y-2">
                  {CORE_UPGRADES.filter(u => u.path === path).map(u => {
                    const level = state.coreUpgrades[u.id] || 0;
                    const maxed = level >= u.maxLevel;
                    const cost = maxed ? 0 : getUpgradeCost(u, level);
                    const canBuy = canPurchaseUpgrade(u, state);
                    return (
                      <div key={u.id} className={`card flex items-center justify-between ${maxed ? 'border-green opacity-70' : canBuy ? 'hover:border-orange' : 'opacity-40'}`}>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span>{u.emoji}</span>
                            <span className="font-bold text-sm">{u.name}</span>
                            <span className="badge badge-cyan">Lv.{level}/{u.maxLevel}</span>
                          </div>
                          <div className="text-sm text-gray-400 mt-0.5">{u.desc}</div>
                        </div>
                        {!maxed && (
                          <button className="btn-secondary text-sm ml-3 shrink-0" disabled={!canBuy} onClick={() => handleUpgrade(u.id)}>
                            {fmt(cost)} 💎
                          </button>
                        )}
                        {maxed && <span className="badge badge-green">MAX</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* IMPACT (PRESTIGE) TAB */}
        {activeTab === 'prestige' && (
          <div>
            <div className="section-header"><h2 className="glow-cyan text-lg font-bold">💥 Impact</h2></div>
            <div className="card mb-4">
              <div className="stat-row">
                <span className="text-sm text-gray-400">Current Tier</span>
                <span className="glow-cyan font-bold">{currentTierDef.emoji} {currentTierDef.name}</span>
              </div>
              <div className="stat-row">
                <span className="text-sm text-gray-400">Lifetime Shards</span>
                <span className="badge badge-yellow">{fmt(state.lifetimeShards)}</span>
              </div>
              <div className="stat-row">
                <span className="text-sm text-gray-400">Available Shards</span>
                <span className="badge badge-yellow">{fmt(state.currentShards)}</span>
              </div>
              <div className="stat-row">
                <span className="text-sm text-gray-400">Total Impacts</span>
                <span className="text-neon font-bold">{state.totalPrestigeCount}</span>
              </div>
              {nextTierDef && (
                <div className="mt-3 pt-2 border-t border-gray-700">
                  <div className="text-sm text-gray-400 mb-1">Next: <span className="font-bold text-white">{nextTierDef.emoji} {nextTierDef.name}</span> — {fmt(nextTierDef.shardReq)} lifetime shards</div>
                  <div className="resource-bar mt-1">
                    <div className="resource-bar-fill bg-yellow" style={{width: `${Math.min(100, (state.lifetimeShards / nextTierDef.shardReq) * 100)}%`}} />
                  </div>
                </div>
              )}
            </div>
            <div className="card mb-4">
              <div className="stat-row">
                <span className="text-sm text-gray-400">Run Mass</span>
                <span className="glow-cyan font-bold">{fmt(state.runMassEarned)}</span>
              </div>
              <div className="stat-row">
                <span className="text-sm text-gray-400">Shards on Impact</span>
                <span className="badge badge-yellow text-sm font-bold">{fmt(shardsOnPrestige)}</span>
              </div>
              <button className="btn-primary mt-3 w-full" disabled={!canPrestige(state)} onClick={() => setShowImpactWarning(true)}>
                {canPrestige(state) ? `Impact for ${fmt(shardsOnPrestige)} Shards` : 'Need more mass to impact'}
              </button>
              <div className="text-xs text-gray-400 mt-2 px-1">Impact resets mass, gravity, density, processes and orbital mechanics. Core upgrades, discoveries, and forge bonuses persist.</div>
            </div>
            {state.composition && (
              <div className="card">
                <div className="stat-row">
                  <span className="text-sm text-gray-400">Composition</span>
                  <span className="badge badge-purple">{COMPOSITIONS.find(c => c.id === state.composition)?.name}</span>
                </div>
                <div className="text-xs text-gray-400 mt-1 px-1">You can change composition when you impact.</div>
              </div>
            )}
          </div>
        )}

        {/* DISCOVER TAB */}
        {activeTab === 'discover' && (
          <div>
            <div className="section-header"><h2 className="glow-orange text-lg font-bold">Discoveries</h2></div>
            <div className="flex items-center gap-2 mb-3 px-1">
              <span className="text-sm text-gray-400">Found:</span>
              <span className="badge badge-orange">{state.discoveries.length}/{DISCOVERIES.length}</span>
            </div>
            <div className="space-y-2.5">
              {DISCOVERIES.filter(d => !d.hidden).map(d => {
                const found = state.discoveries.includes(d.id);
                return (
                  <div key={d.id} className={`card ${found ? 'border-orange' : 'opacity-40'}`}>
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{found ? d.emoji : '❓'}</span>
                      <span className="font-bold text-sm">{found ? d.name : '???'}</span>
                    </div>
                    <div className="text-sm text-gray-400 mt-1">{found ? d.desc : d.hint}</div>
                    {found && <div className="mt-1.5"><span className="badge badge-orange">{d.bonusDesc}</span></div>}
                  </div>
                );
              })}
            </div>
            <div className="glow-divider mt-4 mb-3" />
            <div className="section-header"><h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Hidden Achievements</h3></div>
            <div className="space-y-2.5">
              {DISCOVERIES.filter(d => d.hidden).map(d => {
                const found = state.discoveries.includes(d.id);
                if (!found) {
                  return (
                    <div key={d.id} className="card opacity-30">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">🔒</span>
                        <span className="font-bold text-sm">???</span>
                      </div>
                      <div className="text-sm text-gray-400 mt-1">Do something unexpected...</div>
                    </div>
                  );
                }
                return (
                  <div key={d.id} className="card border-purple box-glow-purple">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{d.emoji}</span>
                      <span className="font-bold text-sm">{d.name}</span>
                      <span className="badge badge-purple">SECRET</span>
                    </div>
                    <div className="text-sm text-gray-400 mt-1">{d.desc}</div>
                    <div className="mt-1.5"><span className="badge badge-purple">{d.bonusDesc}</span></div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* FORGE TAB */}
        {activeTab === 'forge' && (
          <div>
            <div className="section-header"><h2 className="glow-orange text-lg font-bold">Forge</h2></div>
            <div className="card mb-4">
              <div className="text-sm text-gray-300 px-1">
                Spend <span className="text-cyan font-bold">gravity</span> and <span className="text-purple font-bold">density</span> to forge permanent bonuses that persist through impact. Forging costs a LOT — you&#39;ll need to rebuild after each purchase. Watch out: gravity above 250 causes <span className="text-red font-bold">OVERLOAD</span> (mass penalty) and density above 85% causes <span className="text-red font-bold">OVERHEAT</span> (energy drain). Use Gravity Brake and Density Vent to stay in the safe zone!
              </div>
            </div>

            {/* Gravity Forges */}
            <div className="section-header mt-4"><h3 className="text-sm font-bold text-cyan uppercase tracking-wider">Gravity Forges</h3></div>
            <div className="text-xs text-gray-400 mb-2 px-1">Available: <span className="text-cyan font-bold">{fmt(state.gravity, 0)}</span> gravity</div>
            <div className="space-y-2.5 mb-4">
              {getUnlockedForges(state.currentTier).filter(f => f.resource === 'gravity').map(f => {
                const level = state.forgeLevels[f.id] || 0;
                const maxed = level >= f.maxLevel;
                const cost = maxed ? 0 : getForgeCost(f, level);
                const affordable = canForge(f, state);
                return (
                  <div key={f.id} className={`card flex items-center justify-between ${maxed ? 'border-yellow' : affordable ? 'hover:border-neon' : 'opacity-60'}`}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-lg">{f.emoji}</span>
                        <span className="font-bold text-base">{f.name}</span>
                        <span className="badge badge-cyan">{level}/{f.maxLevel}</span>
                      </div>
                      <div className="text-sm text-gray-400 mt-1">{f.desc}</div>
                      <div className="mt-1.5"><span className="badge badge-green">{f.effect}</span></div>
                    </div>
                    <button className="btn-primary text-sm ml-3 shrink-0 min-w-[5.5rem] text-center" disabled={!affordable || maxed} onClick={() => handleForge(f.id)}>
                      {maxed ? 'MAX' : `${fmt(cost, 0)} grav`}
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Density Forges */}
            <div className="section-header"><h3 className="text-sm font-bold text-purple uppercase tracking-wider">Density Forges</h3></div>
            <div className="text-xs text-gray-400 mb-2 px-1">Available: <span className="text-purple font-bold">{state.density.toFixed(1)}%</span> density</div>
            <div className="space-y-2.5 mb-4">
              {getUnlockedForges(state.currentTier).filter(f => f.resource === 'density').map(f => {
                const level = state.forgeLevels[f.id] || 0;
                const maxed = level >= f.maxLevel;
                const cost = maxed ? 0 : getForgeCost(f, level);
                const affordable = canForge(f, state);
                return (
                  <div key={f.id} className={`card flex items-center justify-between ${maxed ? 'border-yellow' : affordable ? 'hover:border-neon' : 'opacity-60'}`}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-lg">{f.emoji}</span>
                        <span className="font-bold text-base">{f.name}</span>
                        <span className="badge badge-purple">{level}/{f.maxLevel}</span>
                      </div>
                      <div className="text-sm text-gray-400 mt-1">{f.desc}</div>
                      <div className="mt-1.5"><span className="badge badge-green">{f.effect}</span></div>
                    </div>
                    <button className="btn-primary text-sm ml-3 shrink-0 min-w-[5.5rem] text-center" disabled={!affordable || maxed} onClick={() => handleForge(f.id)}>
                      {maxed ? 'MAX' : `${cost}% dens`}
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Active Forge Bonuses summary */}
            {Object.keys(state.forgeLevels).length > 0 && (
              <div className="card">
                <div className="section-header"><h3 className="text-sm font-bold text-yellow uppercase tracking-wider">Active Bonuses</h3></div>
                {(() => {
                  const eff = getForgeEffects(state);
                  return (
                    <div className="space-y-1">
                      {eff.massMult > 1 && <div className="stat-row"><span className="text-xs text-gray-400">Mass Production</span><span className="text-sm font-bold text-green">+{Math.round((eff.massMult - 1) * 100)}%</span></div>}
                      {eff.clickMult > 1 && <div className="stat-row"><span className="text-xs text-gray-400">Click Power</span><span className="text-sm font-bold text-green">+{Math.round((eff.clickMult - 1) * 100)}%</span></div>}
                      {eff.energyRegen > 0 && <div className="stat-row"><span className="text-xs text-gray-400">Energy Regen</span><span className="text-sm font-bold text-green">+{eff.energyRegen.toFixed(1)}/s</span></div>}
                      {eff.shardMult > 1 && <div className="stat-row"><span className="text-xs text-gray-400">Shard Generation</span><span className="text-sm font-bold text-green">+{Math.round((eff.shardMult - 1) * 100)}%</span></div>}
                      {eff.densityDecayReduction < 1 && <div className="stat-row"><span className="text-xs text-gray-400">Density Decay</span><span className="text-sm font-bold text-green">-{Math.round((1 - eff.densityDecayReduction) * 100)}%</span></div>}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        )}

        {/* STATS TAB */}
        {activeTab === 'stats' && (
          <div>
            <div className="section-header"><h2 className="glow-cyan text-lg font-bold">Statistics</h2></div>
            <div className="card mb-4">
              <div className="stat-row"><span className="text-sm text-gray-400">Total Mass Earned</span><span className="glow-cyan font-bold">{fmt(state.totalMassEarned)}</span></div>
              <div className="stat-row"><span className="text-sm text-gray-400">Highest Mass</span><span className="text-neon font-bold">{fmt(state.highestMass)}</span></div>
              <div className="stat-row"><span className="text-sm text-gray-400">Total Clicks</span><span className="text-neon font-bold">{fmt(state.totalClicks)}</span></div>
              <div className="stat-row"><span className="text-sm text-gray-400">Total Play Time</span><span className="text-neon">{fmtTime(state.totalPlayTime)}</span></div>
              <div className="stat-row"><span className="text-sm text-gray-400">Run Time</span><span className="text-neon">{fmtTime(state.runTime)}</span></div>
              <div className="stat-row"><span className="text-sm text-gray-400">Comets Caught</span><span className="text-neon font-bold">{state.cometsCaught}</span></div>
              <div className="stat-row"><span className="text-sm text-gray-400">Impact Count</span><span className="text-neon font-bold">{state.totalPrestigeCount}</span></div>
            </div>
            <div className="section-header"><h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Settings</h3></div>
            <div className="space-y-2">
              <button className="btn-secondary w-full text-sm" onClick={() => { saveGame(state); addToast('Game saved!', '💾'); }}>Manual Save</button>
              <button className="btn-secondary w-full text-sm" onClick={() => { const code = exportSave(state); navigator.clipboard.writeText(code); addToast('Save exported to clipboard!', '📋'); }}>Export Save</button>
              <button className="btn-secondary w-full text-sm" onClick={() => {
                const code = prompt('Paste save code:');
                if (code) {
                  const imported = importSave(code);
                  if (imported) { setState(imported); addToast('Save imported!', '📥'); }
                  else addToast('Invalid save code', '❌');
                }
              }}>Import Save</button>
              <button className="btn-danger w-full text-sm" onClick={() => {
                if (confirm('Are you sure? This deletes ALL progress!')) {
                  hardReset();
                  setState(defaultGameState());
                  setTutorialStep(0);
                  addToast('Game reset!', '🗑️');
                }
              }}>Hard Reset</button>
            </div>
            <div className="glow-divider mt-4 mb-3" />
            <div className="section-header"><h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Feedback</h3></div>
            <div className="card">
              <FeedbackForm
                state={state}
                inline={true}
                onSubmit={(success) => {
                  if (success) addToast('Feedback sent! Thanks!', '💬');
                  else addToast('Failed to send feedback', '❌');
                }}
              />
            </div>
            {/* Developer Mode Passcode */}
            {!state.devMode && (
              <div className="mt-4">
                <div className="glow-divider mb-3" />
                <div className="flex items-center gap-2">
                  <input
                    type="password"
                    placeholder="Dev passcode..."
                    className="flex-1 bg-space-lighter border border-gray-700 rounded-md px-3 py-1.5 text-sm text-white focus:border-neon focus:outline-none"
                    value={devPasscode}
                    onChange={(e) => setDevPasscode(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && devPasscode === '89116282') {
                        setState({ ...stateRef.current, devMode: true });
                        setDevPasscode('');
                        addToast('Developer mode unlocked!', '🛠️');
                      }
                    }}
                  />
                  <button className="btn-secondary text-sm px-3 py-1.5" onClick={() => {
                    if (devPasscode === '89116282') {
                      setState({ ...stateRef.current, devMode: true });
                      setDevPasscode('');
                      addToast('Developer mode unlocked!', '🛠️');
                    } else {
                      addToast('Invalid passcode', '❌');
                      setDevPasscode('');
                    }
                  }}>Unlock</button>
                </div>
              </div>
            )}
            {state.devMode && (
              <div className="mt-4">
                <div className="glow-divider mb-3" />
                <span className="badge badge-yellow">🛠️ Dev Mode Active</span>
              </div>
            )}
          </div>
        )}

        {/* DEV TAB */}
        {activeTab === 'dev' && state.devMode && (
          <div>
            <div className="section-header"><h2 className="text-lg font-bold text-yellow">🛠️ Developer Tools</h2></div>

            {/* Mass Controls */}
            <div className="card mb-3">
              <div className="text-sm font-bold text-cyan mb-2">Mass — Current: {fmt(state.mass)}</div>
              <div className="grid grid-cols-2 gap-2">
                <button className="btn-secondary text-xs py-2" onClick={() => setState({ ...stateRef.current, mass: stateRef.current.mass + 1000 })}>+1,000</button>
                <button className="btn-secondary text-xs py-2" onClick={() => setState({ ...stateRef.current, mass: stateRef.current.mass + 1000000 })}>+1M</button>
                <button className="btn-secondary text-xs py-2" onClick={() => setState({ ...stateRef.current, mass: stateRef.current.mass + 1000000000 })}>+1B</button>
                <button className="btn-secondary text-xs py-2" onClick={() => { const s = stateRef.current; setState({ ...s, mass: s.mass * 6, runMassEarned: s.runMassEarned + s.mass * 5, totalMassEarned: s.totalMassEarned + s.mass * 5 }); }}>+500% current</button>
              </div>
            </div>

            {/* Gravity Controls */}
            <div className="card mb-3">
              <div className="text-sm font-bold text-cyan mb-2">Gravity — Current: {fmt(state.gravity, 1)}</div>
              <div className="grid grid-cols-2 gap-2">
                <button className="btn-secondary text-xs py-2" onClick={() => setState({ ...stateRef.current, gravity: Math.min(300, stateRef.current.gravity + 25) })}>+25</button>
                <button className="btn-secondary text-xs py-2" onClick={() => setState({ ...stateRef.current, gravity: Math.min(300, stateRef.current.gravity + 100) })}>+100</button>
                <button className="btn-secondary text-xs py-2" onClick={() => setState({ ...stateRef.current, gravity: 300 })}>Max (300)</button>
                <button className="btn-secondary text-xs py-2" onClick={() => setState({ ...stateRef.current, gravity: 0 })}>Reset to 0</button>
              </div>
            </div>

            {/* Density Controls */}
            <div className="card mb-3">
              <div className="text-sm font-bold text-purple mb-2">Density — Current: {state.density.toFixed(1)}%</div>
              <div className="grid grid-cols-2 gap-2">
                <button className="btn-secondary text-xs py-2" onClick={() => setState({ ...stateRef.current, density: Math.min(100, stateRef.current.density + 10) })}>+10%</button>
                <button className="btn-secondary text-xs py-2" onClick={() => setState({ ...stateRef.current, density: Math.min(100, stateRef.current.density + 25) })}>+25%</button>
                <button className="btn-secondary text-xs py-2" onClick={() => setState({ ...stateRef.current, density: 100 })}>Max (100%)</button>
                <button className="btn-secondary text-xs py-2" onClick={() => setState({ ...stateRef.current, density: 0 })}>Reset to 0</button>
              </div>
            </div>

            {/* Energy Controls */}
            <div className="card mb-3">
              <div className="text-sm font-bold text-orange mb-2">Energy — Current: {Math.floor(state.energy)}/{getMaxEnergy(state)}</div>
              <div className="grid grid-cols-2 gap-2">
                <button className="btn-secondary text-xs py-2" onClick={() => setState({ ...stateRef.current, energy: getMaxEnergy(stateRef.current) })}>Fill Energy</button>
                <button className="btn-secondary text-xs py-2" onClick={() => setState({ ...stateRef.current, energy: 0 })}>Drain Energy</button>
              </div>
            </div>

            {/* Shards Controls */}
            <div className="card mb-3">
              <div className="text-sm font-bold text-yellow mb-2">Shards — Current: {fmt(state.currentShards)} ({fmt(state.lifetimeShards)} lifetime)</div>
              <div className="grid grid-cols-2 gap-2">
                <button className="btn-secondary text-xs py-2" onClick={() => setState({ ...stateRef.current, currentShards: stateRef.current.currentShards + 100, lifetimeShards: stateRef.current.lifetimeShards + 100 })}>+100</button>
                <button className="btn-secondary text-xs py-2" onClick={() => setState({ ...stateRef.current, currentShards: stateRef.current.currentShards + 1000, lifetimeShards: stateRef.current.lifetimeShards + 1000 })}>+1,000</button>
                <button className="btn-secondary text-xs py-2" onClick={() => setState({ ...stateRef.current, currentShards: stateRef.current.currentShards + 100000, lifetimeShards: stateRef.current.lifetimeShards + 100000 })}>+100K</button>
                <button className="btn-secondary text-xs py-2" onClick={() => setState({ ...stateRef.current, currentShards: stateRef.current.currentShards + 1000000, lifetimeShards: stateRef.current.lifetimeShards + 1000000 })}>+1M</button>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="card mb-3">
              <div className="text-sm font-bold text-green mb-2">Quick Actions</div>
              <div className="grid grid-cols-2 gap-2">
                <button className="btn-secondary text-xs py-2" onClick={() => { const s = stateRef.current; setState({ ...s, runMassEarned: s.runMassEarned + 10000000, totalMassEarned: s.totalMassEarned + 10000000 }); }}>+10M Run Mass</button>
                <button className="btn-secondary text-xs py-2" onClick={() => setState({ ...stateRef.current, cometsCaught: stateRef.current.cometsCaught + 50 })}>+50 Comets</button>
                <button className="btn-secondary text-xs py-2" onClick={() => setState({ ...stateRef.current, totalClicks: stateRef.current.totalClicks + 1000 })}>+1000 Clicks</button>
                <button className="btn-secondary text-xs py-2" onClick={() => { const s = stateRef.current; setState({ ...s, mass: s.mass * 6, gravity: Math.min(300, s.gravity + 100), density: Math.min(100, s.density + 30), currentShards: s.currentShards + 10000, lifetimeShards: s.lifetimeShards + 10000, runMassEarned: s.runMassEarned + s.mass * 5, totalMassEarned: s.totalMassEarned + s.mass * 5 }); }}>Boost Everything</button>
              </div>
            </div>

            {/* Disable Dev Mode */}
            <button className="btn-danger w-full text-sm mt-2" onClick={() => {
              setState({ ...stateRef.current, devMode: false });
              setTab('stats');
              addToast('Developer mode disabled', '🔒');
            }}>Disable Dev Mode</button>
          </div>
        )}
      </div>

      {/* Floating Mini Asteroid — appears when scrolled on Build tab */}
      {showMiniAsteroid && (
        <div
          className="mini-asteroid"
          style={{
            left: miniPos.x,
            top: miniPos.y === -1 ? 'calc(50vh - 28px)' : miniPos.y,
          }}
          onMouseDown={handleDragStart}
          onTouchStart={handleDragStart}
          onClick={handleMiniClick}
        >
          <div className="mini-asteroid-inner pulse-glow">{currentTierDef.emoji}</div>
          <div className="mini-asteroid-mass">+{fmt(getClickValue(state, 1))}/tap</div>
        </div>
      )}

      {/* Active Comets — tappable floating comets */}
      {state.activeComets && state.activeComets.map(comet => (
        <button
          key={comet.id}
          className="comet-button"
          style={{
            left: `${comet.x}%`,
            top: `${comet.y}%`,
            opacity: comet.timeLeft < 1.5 ? comet.timeLeft / 1.5 : 1,
          }}
          onClick={() => handleCatchComet(comet.id)}
        >
          <div className="comet-inner">
            <span className="comet-emoji">☄️</span>
            <span className="comet-value">+{fmt(comet.value)}</span>
          </div>
          <div className="comet-timer" style={{ width: `${(comet.timeLeft / 8) * 100}%` }} />
        </button>
      ))}

      {/* Toast notifications */}
      <div className="fixed top-2 right-3 sm:top-4 sm:right-4 z-50 space-y-2 max-w-[90vw]">
        {toasts.map(t => (
          <SwipeableNotification key={t.id} notification={t} onDismiss={dismissToast} />
        ))}
      </div>

      {/* Offline gains modal */}
      {offlineGains && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
          <div className="card max-w-sm w-full text-center mx-4" style={{borderColor: 'var(--color-neon)', borderWidth: '2px'}}>
            <h2 className="glow-cyan text-lg mb-2">Welcome Back!</h2>
            <div className="text-sm text-gray-400 mb-2">You were away for {fmtTime(offlineGains.time)}</div>
            <div className="text-xl glow-cyan font-bold mb-1">+{fmt(offlineGains.mass)} mass</div>
            <button className="btn-primary mt-4 w-full" onClick={() => setOfflineGains(null)}>Continue</button>
          </div>
        </div>
      )}

      {/* Composition Info Modal */}
      {showCompInfo && state.composition && (() => {
        const comp = COMPOSITIONS.find(c => c.id === state.composition)!;
        return (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4" onClick={() => setShowCompInfo(false)}>
            <div className="card max-w-sm w-full mx-4" style={{borderColor: 'var(--color-purple)', borderWidth: '2px'}} onClick={(e) => e.stopPropagation()}>
              <div className="text-center mb-3">
                <div className="text-3xl mb-1">{comp.emoji}</div>
                <h2 className="glow-purple text-lg font-bold">{comp.name}</h2>
                <div className="text-sm text-gray-400 italic">{comp.flavor}</div>
              </div>
              <div className="text-sm text-gray-300 mb-3 px-1">{comp.desc}</div>
              <div className="glow-divider" />
              <div className="text-xs text-gray-400 uppercase tracking-wider mb-2 mt-2">Stat Multipliers</div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mb-3">
                <div className="stat-row"><span className="text-xs text-gray-400">Mass Prod</span><span className={`text-sm font-bold ${comp.massProductionMult >= 1 ? 'text-green' : 'text-red'}`}>{comp.massProductionMult}x</span></div>
                <div className="stat-row"><span className="text-xs text-gray-400">Cost</span><span className={`text-sm font-bold ${comp.costMult <= 1 ? 'text-green' : 'text-red'}`}>{comp.costMult}x</span></div>
                <div className="stat-row"><span className="text-xs text-gray-400">Gravity</span><span className={`text-sm font-bold ${comp.gravityMult >= 1 ? 'text-green' : 'text-red'}`}>{comp.gravityMult}x</span></div>
                <div className="stat-row"><span className="text-xs text-gray-400">Density</span><span className={`text-sm font-bold ${comp.densityMult >= 1 ? 'text-green' : 'text-red'}`}>{comp.densityMult}x</span></div>
                <div className="stat-row"><span className="text-xs text-gray-400">Synergy</span><span className={`text-sm font-bold ${comp.synergyMult >= 1 ? 'text-green' : 'text-red'}`}>{comp.synergyMult}x</span></div>
                <div className="stat-row"><span className="text-xs text-gray-400">Click</span><span className={`text-sm font-bold ${comp.clickMult >= 1 ? 'text-green' : 'text-red'}`}>{comp.clickMult}x</span></div>
              </div>
              <div className="glow-divider" />
              <div className="mt-2 px-1">
                <div className="text-sm font-bold text-purple mb-1">✦ {comp.specialName}</div>
                <div className="text-sm text-gray-300">{comp.specialDesc}</div>
              </div>
              <button className="btn-secondary mt-4 w-full" onClick={() => setShowCompInfo(false)}>Got it</button>
            </div>
          </div>
        );
      })()}

      {/* Impact Warning Modal */}
      {showImpactWarning && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 px-4" onClick={() => setShowImpactWarning(false)}>
          <div className="card max-w-sm w-full mx-4" style={{borderColor: '#ff4444', borderWidth: '2px'}} onClick={(e) => e.stopPropagation()}>
            <div className="text-center mb-3">
              <div className="text-4xl mb-2">💥</div>
              <h2 className="text-xl font-bold text-red-400">Initiate Impact?</h2>
            </div>
            <div className="text-sm text-gray-300 mb-3 px-1">
              Your asteroid will collide and reform. This will <span className="text-red-400 font-bold">reset</span> the following:
            </div>
            <div className="bg-space-lighter rounded-lg p-3 mb-3 space-y-1.5">
              <div className="flex items-center gap-2 text-sm"><span className="text-red-400">✕</span> <span className="text-gray-300">Mass, Gravity, Density</span></div>
              <div className="flex items-center gap-2 text-sm"><span className="text-red-400">✕</span> <span className="text-gray-300">All Processes (buildings)</span></div>
              <div className="flex items-center gap-2 text-sm"><span className="text-red-400">✕</span> <span className="text-gray-300">Orbital Mechanics</span></div>
              <div className="flex items-center gap-2 text-sm"><span className="text-red-400">✕</span> <span className="text-gray-300">Energy (resets to base)</span></div>
              <div className="flex items-center gap-2 text-sm"><span className="text-red-400">✕</span> <span className="text-gray-300">Composition choice</span></div>
            </div>
            <div className="text-sm text-gray-300 mb-3 px-1">
              These will be <span className="text-green font-bold">kept</span>:
            </div>
            <div className="bg-space-lighter rounded-lg p-3 mb-4 space-y-1.5">
              <div className="flex items-center gap-2 text-sm"><span className="text-green">✓</span> <span className="text-gray-300">Core Upgrades (shard purchases)</span></div>
              <div className="flex items-center gap-2 text-sm"><span className="text-green">✓</span> <span className="text-gray-300">Discoveries & Achievements</span></div>
              <div className="flex items-center gap-2 text-sm"><span className="text-green">✓</span> <span className="text-gray-300">Forge Bonuses</span></div>
              <div className="flex items-center gap-2 text-sm"><span className="text-green">✓</span> <span className="text-gray-300">Shards (you gain +{fmt(shardsOnPrestige)} new)</span></div>
            </div>
            <div className="flex gap-3">
              <button className="btn-secondary flex-1" onClick={() => setShowImpactWarning(false)}>Cancel</button>
              <button className="btn-primary flex-1 bg-red-600 hover:bg-red-500 border-red-500" onClick={handlePrestige}>
                💥 Impact!
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Impact Explosion Animation Overlay */}
      {impactExploding && (
        <div className="impact-explosion-overlay">
          <div className="impact-flash" />
          <div className="impact-ring impact-ring-1" />
          <div className="impact-ring impact-ring-2" />
          <div className="impact-ring impact-ring-3" />
          {Array.from({length: 20}).map((_, i) => (
            <div
              key={i}
              className="impact-debris"
              style={{
                '--debris-angle': `${(i / 20) * 360}deg`,
                '--debris-distance': `${40 + Math.random() * 30}vw`,
                '--debris-size': `${4 + Math.random() * 8}px`,
                '--debris-delay': `${Math.random() * 0.3}s`,
              } as React.CSSProperties}
            />
          ))}
          <div className="impact-text">💥 IMPACT 💥</div>
        </div>
      )}

      {/* Floating Feedback Button */}
      <FeedbackButton onClick={() => setShowFeedback(true)} />

      {/* Feedback Modal */}
      {showFeedback && (
        <FeedbackForm
          state={state}
          onClose={() => setShowFeedback(false)}
          onSubmit={(success) => {
            if (success) {
              addToast('Feedback sent! Thanks!', '💬');
              setShowFeedback(false);
            } else {
              addToast('Failed to send feedback', '❌');
            }
          }}
        />
      )}

      {/* Ad Modal */}
      {pendingBoost && (
        <AdModal boostType={pendingBoost} onComplete={handleAdComplete} onCancel={handleAdCancel} />
      )}

      {/* Tutorial walkthrough overlay */}
      {tutorialStep >= 0 && (
        <TutorialOverlay
          currentStep={tutorialStep}
          onNext={handleTutorialNext}
          onSkip={handleTutorialSkip}
        />
      )}

      {/* Contextual hint */}
      {contextualHint && tutorialStep < 0 && (
        <ContextualHint step={contextualHint} onDismiss={handleDismissHint} />
      )}
    </div>
  );
}

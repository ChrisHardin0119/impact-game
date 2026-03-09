'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { GameState, TabName, BuyMode, FloatingNumber } from '@/lib/types';
import { defaultGameState } from '@/lib/prestige';
import { processClick, buyProcess, activateOrbitalMechanic, getMassPerSecond } from '@/lib/gameEngine';
import { getProcessCost, getMaxAffordable, PROCESSES } from '@/lib/processes';
import { ORBITAL_MECHANICS, getUnlockedOM } from '@/lib/orbitalMechanics';
import { CORE_UPGRADES, canPurchaseUpgrade, getUpgradeCost } from '@/lib/upgrades';
import { COMPOSITIONS, getUnlockedCompositions } from '@/lib/compositions';
import { calcShards, canPrestige, getPrestigeResetState, PRESTIGE_TIERS } from '@/lib/prestige';
import { DISCOVERIES } from '@/lib/discoveries';
import { getGravityMultiplier, getDensityMultiplier } from '@/lib/resources';
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

export default function GamePage() {
  const [state, setStateRaw] = useState<GameState>(defaultGameState());
  const stateRef = useRef(state);
  const [floatingNums, setFloatingNums] = useState<FloatingNumber[]>([]);
  const [toasts, setToasts] = useState<NotificationData[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [offlineGains, setOfflineGains] = useState<{mass: number, time: number} | null>(null);
  const nextFloatId = useRef(0);
  const nextToastId = useRef(0);
  const [tutorialStep, setTutorialStep] = useState(-1); // -1 = not showing walkthrough
  const [contextualHint, setContextualHint] = useState<TutorialStep | null>(null);
  const lastHintCheckRef = useRef(0);
  const [pendingBoost, setPendingBoost] = useState<BoostType | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);

  const setState = useCallback((s: GameState) => {
    stateRef.current = s;
    setStateRaw(s);
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
      // New player — start walkthrough tutorial
      setTutorialStep(0);
    }
    setLoaded(true);
  }, [setState]);

  // Game loop
  useGameLoop(stateRef, setState);

  // Check contextual hints periodically
  useEffect(() => {
    if (!loaded || tutorialStep >= 0) return; // Don't show hints during walkthrough
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
      setTutorialStep(-1); // Done
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
      // Free boost — apply directly
      const result = applyBoost(type, s);
      if (result) {
        setState(result);
        addToast(`Boost activated!`, '⚡', 'reward');
      }
    } else {
      // Show ad modal first
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

  // Click handler
  const handleClick = useCallback((e: React.MouseEvent) => {
    const newState = processClick(stateRef.current);
    setState(newState);
    // Add floating number
    const id = nextFloatId.current++;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setFloatingNums(prev => [...prev, { id, value: newState.mass - stateRef.current.mass + (newState.mass - stateRef.current.mass === 0 ? 1 : 0), x, y, opacity: 1 }]);
    setTimeout(() => setFloatingNums(prev => prev.filter(f => f.id !== id)), 1000);
  }, [setState]);

  // Buy process
  const handleBuy = useCallback((processId: string) => {
    const s = stateRef.current;
    const processDef = PROCESSES.find(p => p.id === processId);
    if (!processDef) return;

    let count = 1;
    const owned = s.processes[processId] || 0;
    if (s.buyMode === 'max') {
      count = getMaxAffordable(processDef, owned, s.mass);
    } else {
      count = s.buyMode as number;
    }
    if (count <= 0) return;

    // Calculate actual cost with scaling
    let totalCost = 0;
    for (let i = 0; i < count; i++) {
      totalCost += getProcessCost(processDef, owned + i);
    }

    // Apply cosmic expansion discount
    if (s.omActive['cosmic_expansion'] && s.omActive['cosmic_expansion'] > 0) {
      totalCost *= 0.5;
    }

    if (s.mass < totalCost) return;

    const newState = {
      ...s,
      mass: s.mass - totalCost,
      processes: { ...s.processes, [processId]: owned + count },
    };
    setState(newState);
  }, [setState]);

  // Activate orbital mechanic
  const handleOM = useCallback((omId: string) => {
    const result = activateOrbitalMechanic(omId, stateRef.current);
    if (result) {
      setState(result);
      addToast(`Activated ${ORBITAL_MECHANICS.find(o => o.id === omId)?.name}`, '🚀');
    }
  }, [setState, addToast]);

  // Buy core upgrade
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

  // Prestige
  const handlePrestige = useCallback(() => {
    const s = stateRef.current;
    if (!canPrestige(s)) return;
    let shardMult = 1;
    // Apply prestige double boost if active
    if (s.boosts.prestigeDouble.active && !s.boosts.prestigeDouble.usedThisRun) {
      shardMult = 2;
    }
    const shardsEarned = calcShards(s.runMassEarned, s.currentTier, shardMult);
    let newState = getPrestigeResetState(s);
    // Mark prestige double as used
    if (shardMult === 2) {
      newState.boosts = {
        ...newState.boosts,
        prestigeDouble: { active: false, usedThisRun: true },
      };
    }
    newState.currentShards += shardsEarned;
    newState.lifetimeShards += shardsEarned;
    // Check tier upgrades
    for (let i = s.currentTier + 1; i <= 5; i++) {
      if (newState.lifetimeShards >= PRESTIGE_TIERS[i].shardReq) {
        newState.currentTier = i as any;
      }
    }
    setState(newState);
    const doubleText = shardMult === 2 ? ' (2x bonus!)' : '';
    addToast(`Prestige! +${fmt(shardsEarned)} shards${doubleText}`, '💎');
  }, [setState, addToast]);

  // Choose composition
  const handleComposition = useCallback((id: string) => {
    setState({ ...stateRef.current, composition: id as any });
    addToast(`Composition: ${id}`, '🪨');
  }, [setState, addToast]);

  // Set tab
  const setTab = useCallback((tab: TabName) => {
    setState({ ...stateRef.current, activeTab: tab });
  }, [setState]);

  // Set buy mode
  const setBuyMode = useCallback((mode: BuyMode) => {
    setState({ ...stateRef.current, buyMode: mode });
  }, [setState]);

  if (!loaded) {
    return <div className="flex items-center justify-center h-screen bg-space"><span className="glow-cyan text-2xl">Loading Impact...</span></div>;
  }

  const { activeTab } = state;
  const tabs: { id: TabName; label: string; icon: string }[] = [
    { id: 'build', label: 'Build', icon: '🏗️' },
    { id: 'orbital', label: 'Orbital', icon: '🚀' },
    { id: 'upgrades', label: 'Upgrades', icon: '⬆️' },
    { id: 'prestige', label: 'Prestige', icon: '💎' },
    { id: 'discover', label: 'Discover', icon: '🔍' },
    { id: 'stats', label: 'Stats', icon: '📊' },
  ];

  // Calculate display values
  const gravMult = getGravityMultiplier(state.gravity);
  const densMult = getDensityMultiplier(state.density);
  const massPerSec = getMassPerSecond(state);
  const shardsOnPrestige = canPrestige(state) ? calcShards(state.runMassEarned, state.currentTier) : 0;
  const currentTierDef = PRESTIGE_TIERS[state.currentTier];
  const nextTierDef = state.currentTier < 5 ? PRESTIGE_TIERS[state.currentTier + 1] : null;
  const unlockedComps = getUnlockedCompositions(state.currentTier);
  const unlockedOM = getUnlockedOM(state.currentTier);

  return (
    <div className="scanlines flex flex-col h-screen max-h-screen no-select safe-top">
      {/* Resource Header */}
      <div className="bg-space-light border-b border-gray-700 px-2 sm:px-4 py-1.5 sm:py-2 safe-x">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            <span className="glow-cyan font-bold text-sm sm:text-lg truncate">{currentTierDef.emoji} {currentTierDef.name}</span>
            {state.composition && <span className="text-xs sm:text-sm text-gray-400 truncate">| {COMPOSITIONS.find(c => c.id === state.composition)?.name}</span>}
          </div>
          <div className="flex gap-1.5 sm:gap-2 shrink-0">
            <button className="btn-secondary text-xs px-2 py-1" onClick={() => saveGame(state)}>Save</button>
            <button className="btn-secondary text-xs px-2 py-1" onClick={() => setTab('stats')}>⚙</button>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
          {/* Mass */}
          <div>
            <div className="text-xs text-gray-400 flex justify-between"><span>Mass</span><span className="glow-cyan">{fmt(state.mass)}</span></div>
            {massPerSec > 0 && <div className="mass-per-sec">+{fmt(massPerSec)}/s</div>}
          </div>
          {/* Gravity */}
          <div>
            <div className="text-xs text-gray-400 flex justify-between"><span>Gravity</span><span>{fmt(state.gravity, 0)}/300</span></div>
            <div className="resource-bar mt-0.5">
              <div className="resource-bar-fill" style={{width: `${(state.gravity / 300) * 100}%`, background: gravMult >= 1 ? 'var(--color-green)' : 'var(--color-red)'}} />
            </div>
            <div className="text-xs" style={{color: gravMult >= 1 ? 'var(--color-green)' : 'var(--color-red)'}}>{gravMult.toFixed(2)}x</div>
          </div>
          {/* Density */}
          <div>
            <div className="text-xs text-gray-400 flex justify-between"><span>Density</span><span>{state.density.toFixed(1)}%</span></div>
            <div className="resource-bar mt-0.5">
              <div className="resource-bar-fill" style={{width: `${state.density}%`, background: densMult >= 1 ? 'var(--color-purple)' : 'var(--color-red)'}} />
            </div>
            <div className="text-xs" style={{color: densMult >= 1 ? 'var(--color-purple)' : 'var(--color-red)'}}>{densMult.toFixed(2)}x</div>
          </div>
          {/* Energy */}
          <div>
            <div className="text-xs text-gray-400 flex justify-between"><span>Energy</span><span>{Math.floor(state.energy)}/{state.maxEnergy}</span></div>
            <div className="resource-bar mt-0.5">
              <div className="resource-bar-fill" style={{width: `${(state.energy / state.maxEnergy) * 100}%`, background: 'var(--color-orange)'}} />
            </div>
          </div>
        </div>
      </div>

      {/* Boost Bar */}
      <BoostBar state={state} onActivateBoost={handleActivateBoost} />

      {/* Tab Navigation */}
      <div className="tab-bar border-b border-gray-700 bg-space-light px-2 safe-x">
        {tabs.map(t => (
          <button key={t.id} className={`tab whitespace-nowrap ${activeTab === t.id ? 'tab-active' : ''}`} onClick={() => setTab(t.id)}>
            <span className="mr-1">{t.icon}</span>{t.label}
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto px-2 sm:px-4 py-3 safe-bottom safe-x">
        {/* Composition Picker (shown if no composition selected) */}
        {!state.composition && activeTab === 'build' && (
          <div className="mb-4">
            <h2 className="glow-cyan text-lg mb-2">Choose Your Composition</h2>
            <div className="grid grid-cols-2 gap-2">
              {unlockedComps.map(c => (
                <button key={c.id} className="card text-left hover:border-neon transition-colors" onClick={() => handleComposition(c.id)}>
                  <div className="font-bold">{c.emoji} {c.name}</div>
                  <div className="text-xs text-gray-400 mt-1">{c.desc}</div>
                  <div className="text-xs text-purple mt-1">{c.specialName}: {c.specialDesc}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* BUILD TAB */}
        {activeTab === 'build' && (
          <div>
            {/* Click area */}
            <div className="flex justify-center mb-4">
              <div className="relative cursor-pointer select-none" onClick={handleClick}>
                <div className="w-32 h-32 rounded-full bg-gradient-to-br from-gray-600 to-gray-800 border-2 border-gray-500 flex items-center justify-center text-4xl hover:scale-105 transition-transform active:scale-95" style={{boxShadow: `0 0 ${Math.min(30, Math.log10(state.mass + 1) * 3)}px var(--color-neon)`}}>
                  🪨
                </div>
                <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-xs text-gray-400">Click for mass</div>
                {floatingNums.map(f => (
                  <div key={f.id} className="float-up absolute text-neon font-bold pointer-events-none text-sm" style={{left: f.x, top: f.y}}>
                    +{fmt(f.value)}
                  </div>
                ))}
              </div>
            </div>

            {/* Buy mode selector */}
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs text-gray-400">Buy:</span>
              {([1, 5, 10, 100, 'max'] as BuyMode[]).map(m => (
                <button key={String(m)} className={`text-xs px-2 py-0.5 rounded ${state.buyMode === m ? 'bg-neon text-space font-bold' : 'bg-space-lighter text-gray-400 hover:text-neon'}`} onClick={() => setBuyMode(m)}>
                  {m === 'max' ? 'MAX' : `x${m}`}
                </button>
              ))}
            </div>

            {/* Process list */}
            <div className="space-y-2">
              {PROCESSES.map(p => {
                const owned = state.processes[p.id] || 0;
                const cost = getProcessCost(p, owned);
                const canAfford = state.mass >= cost;
                const unlocked = !p.unlockCondition ||
                  (p.unlockCondition.type === 'mass' && state.totalMassEarned >= p.unlockCondition.value) ||
                  (p.unlockCondition.type === 'tier' && state.currentTier >= p.unlockCondition.value) ||
                  (p.unlockCondition.type === 'gravity' && state.gravity >= p.unlockCondition.value);

                if (!unlocked && owned === 0) return null;

                return (
                  <div key={p.id} className={`card flex items-center justify-between ${canAfford ? 'hover:border-neon' : 'opacity-60'}`}>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span>{p.emoji}</span>
                        <span className="font-bold text-sm">{p.name}</span>
                        <span className="text-xs text-gray-400">x{owned}</span>
                        {p.compositionBonus === state.composition && <span className="text-xs text-purple">★ bonus</span>}
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">{p.desc}</div>
                      <div className="text-xs text-neon-dim mt-0.5">+{fmt(p.baseMPS)}/s mass {p.gravityPS > 0 ? `| +${p.gravityPS}/s grav` : ''} {p.densityPS > 0 ? `| +${fmtPct(p.densityPS)}/s dens` : ''}</div>
                    </div>
                    <button className="btn-primary text-sm ml-2" disabled={!canAfford} onClick={() => handleBuy(p.id)}>
                      {fmt(cost)}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ORBITAL TAB */}
        {activeTab === 'orbital' && (
          <div>
            <h2 className="glow-purple text-lg mb-3">Orbital Mechanics</h2>
            <div className="grid grid-cols-2 gap-2">
              {unlockedOM.map(om => {
                const cd = state.omCooldowns[om.id] || 0;
                const isActive = (state.omActive[om.id] || 0) > 0;
                const canUse = state.energy >= om.energyCost && cd <= 0 && !(om.id === 'singularity_pull' && state.singularityUsed);
                return (
                  <button key={om.id} className={`card text-left relative ${isActive ? 'border-purple box-glow-purple' : canUse ? 'hover:border-neon' : 'opacity-50'}`} onClick={() => handleOM(om.id)} disabled={!canUse}>
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{om.emoji}</span>
                      <span className="font-bold text-sm">{om.name}</span>
                    </div>
                    <div className="text-xs text-gray-400 mt-1">{om.desc}</div>
                    <div className="flex justify-between mt-2 text-xs">
                      <span className="text-orange">{om.energyCost}E</span>
                      <span className="text-gray-400">{om.duration > 0 ? `${om.duration}s` : 'Instant'}</span>
                      <span className={cd > 0 ? 'text-red' : 'text-green'}>{cd > 0 ? `${cd.toFixed(1)}s` : 'Ready'}</span>
                    </div>
                    {isActive && <div className="absolute top-1 right-2 text-xs text-purple">{state.omActive[om.id]?.toFixed(1)}s</div>}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* UPGRADES TAB */}
        {activeTab === 'upgrades' && (
          <div>
            <h2 className="glow-orange text-lg mb-1">Core Upgrades</h2>
            <div className="text-sm text-gray-400 mb-3">Shards: <span className="text-yellow">{fmt(state.currentShards)}</span></div>
            {(['foundation', 'synergy', 'density', 'energy'] as const).map(path => (
              <div key={path} className="mb-4">
                <h3 className="text-sm font-bold text-gray-400 uppercase mb-2 tracking-wider">{path} Path</h3>
                <div className="space-y-1">
                  {CORE_UPGRADES.filter(u => u.path === path).map(u => {
                    const level = state.coreUpgrades[u.id] || 0;
                    const maxed = level >= u.maxLevel;
                    const cost = maxed ? 0 : getUpgradeCost(u, level);
                    const canBuy = canPurchaseUpgrade(u, state);
                    return (
                      <div key={u.id} className={`card flex items-center justify-between ${maxed ? 'border-green opacity-70' : canBuy ? 'hover:border-orange' : 'opacity-40'}`}>
                        <div>
                          <span>{u.emoji} <span className="font-bold text-sm">{u.name}</span> <span className="text-xs text-gray-400">Lv.{level}/{u.maxLevel}</span></span>
                          <div className="text-xs text-gray-400">{u.desc}</div>
                        </div>
                        {!maxed && (
                          <button className="btn-secondary text-xs ml-2" disabled={!canBuy} onClick={() => handleUpgrade(u.id)}>
                            {fmt(cost)} 💎
                          </button>
                        )}
                        {maxed && <span className="text-xs text-green">MAX</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* PRESTIGE TAB */}
        {activeTab === 'prestige' && (
          <div>
            <h2 className="glow-cyan text-lg mb-3">Prestige</h2>
            <div className="card mb-4">
              <div className="text-sm">Current Tier: <span className="glow-cyan font-bold">{currentTierDef.emoji} {currentTierDef.name}</span></div>
              <div className="text-sm mt-1">Lifetime Shards: <span className="text-yellow">{fmt(state.lifetimeShards)}</span></div>
              <div className="text-sm mt-1">Available Shards: <span className="text-yellow">{fmt(state.currentShards)}</span></div>
              <div className="text-sm mt-1">Total Prestiges: {state.totalPrestigeCount}</div>
              {nextTierDef && (
                <div className="mt-2">
                  <div className="text-xs text-gray-400">Next: {nextTierDef.emoji} {nextTierDef.name} — {fmt(nextTierDef.shardReq)} lifetime shards</div>
                  <div className="resource-bar mt-1">
                    <div className="resource-bar-fill bg-yellow" style={{width: `${Math.min(100, (state.lifetimeShards / nextTierDef.shardReq) * 100)}%`}} />
                  </div>
                </div>
              )}
            </div>
            <div className="card mb-4">
              <div className="text-sm">Run Mass: <span className="glow-cyan">{fmt(state.runMassEarned)}</span></div>
              <div className="text-sm mt-1">Shards on Prestige: <span className="text-yellow font-bold">{fmt(shardsOnPrestige)}</span></div>
              <button className="btn-primary mt-3 w-full" disabled={!canPrestige(state)} onClick={handlePrestige}>
                {canPrestige(state) ? `Prestige for ${fmt(shardsOnPrestige)} Shards` : 'Need more mass to prestige'}
              </button>
              <div className="text-xs text-gray-400 mt-2">Prestige resets mass, gravity, density, processes and orbital mechanics. Core upgrades and discoveries persist.</div>
            </div>
            {/* Composition selector for after prestige */}
            {state.composition && (
              <div className="card">
                <div className="text-sm mb-2">Current Composition: <span className="font-bold">{COMPOSITIONS.find(c => c.id === state.composition)?.name}</span></div>
                <div className="text-xs text-gray-400">You can change composition when you prestige.</div>
              </div>
            )}
          </div>
        )}

        {/* DISCOVER TAB */}
        {activeTab === 'discover' && (
          <div>
            <h2 className="glow-orange text-lg mb-3">Discoveries</h2>
            <div className="text-sm text-gray-400 mb-3">{state.discoveries.length}/{DISCOVERIES.length} discovered</div>
            <div className="space-y-2">
              {DISCOVERIES.map(d => {
                const found = state.discoveries.includes(d.id);
                return (
                  <div key={d.id} className={`card ${found ? 'border-orange' : 'opacity-40'}`}>
                    <div className="flex items-center gap-2">
                      <span>{found ? d.emoji : '❓'}</span>
                      <span className="font-bold text-sm">{found ? d.name : '???'}</span>
                    </div>
                    <div className="text-xs text-gray-400 mt-1">{found ? d.bonusDesc : d.hint}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* STATS TAB */}
        {activeTab === 'stats' && (
          <div>
            <h2 className="glow-cyan text-lg mb-3">Statistics</h2>
            <div className="card space-y-1 mb-4">
              <div className="text-sm">Total Mass Earned: <span className="text-neon">{fmt(state.totalMassEarned)}</span></div>
              <div className="text-sm">Highest Mass: <span className="text-neon">{fmt(state.highestMass)}</span></div>
              <div className="text-sm">Total Clicks: <span className="text-neon">{fmt(state.totalClicks)}</span></div>
              <div className="text-sm">Total Play Time: <span className="text-neon">{fmtTime(state.totalPlayTime)}</span></div>
              <div className="text-sm">Run Time: <span className="text-neon">{fmtTime(state.runTime)}</span></div>
              <div className="text-sm">Comets Caught: <span className="text-neon">{state.cometsCaught}</span></div>
              <div className="text-sm">Prestige Count: <span className="text-neon">{state.totalPrestigeCount}</span></div>
            </div>
            <h3 className="text-sm font-bold text-gray-400 mb-2">Settings</h3>
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
                  addToast('Game reset!', '🗑️');
                }
              }}>Hard Reset</button>
            </div>
            <h3 className="text-sm font-bold text-gray-400 mb-2 mt-4">Feedback</h3>
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
          </div>
        )}
      </div>

      {/* Toast notifications */}
      <div className="fixed top-2 right-2 sm:top-4 sm:right-4 z-50 space-y-2 max-w-[90vw]">
        {toasts.map(t => (
          <SwipeableNotification key={t.id} notification={t} onDismiss={dismissToast} />
        ))}
      </div>

      {/* Offline gains modal */}
      {offlineGains && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
          <div className="card max-w-sm w-full text-center mx-4">
            <h2 className="glow-cyan text-lg mb-2">Welcome Back!</h2>
            <div className="text-sm text-gray-400 mb-1">You were away for {fmtTime(offlineGains.time)}</div>
            <div className="text-lg text-neon font-bold">+{fmt(offlineGains.mass)} mass</div>
            <button className="btn-primary mt-4" onClick={() => setOfflineGains(null)}>Continue</button>
          </div>
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

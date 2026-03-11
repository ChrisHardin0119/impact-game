'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { GameState, TabName, BuyMode, FloatingNumber, AchievementPopup } from '@/lib/types';
import { defaultGameState, canPrestige, calcShards, getPrestigeResetState, PRESTIGE_TIERS } from '@/lib/prestige';
import { processClick, getClickValue, getMassPerSecond, getProduction, getBuildingProductionRate, catchComet, purchaseBuilding, getCompositionDef, getUnlockedCompositions } from '@/lib/gameEngine';
import { METALS, VELOCITY_ITEMS, getBuildingCost, getBuildingCount, getMaxAffordable, getTotalCostForN, getExpulsionRate, calculateExpulsion, getAccumulationRate, calculateAccumulation, EXPULSION_COOLDOWN, BASE_EXPULSION_RATE, BASE_ACCUMULATION_RATE } from '@/lib/buildings';
import { ENERGY_UPGRADES, getEnergyUpgradeCost, canBuyEnergyUpgrade, getEnergyEffects } from '@/lib/energyUpgrades';
import { ACHIEVEMENTS, getAchievementEffects } from '@/lib/achievements';
import { TAB_UNLOCKS, SHARD_UPGRADES, getShardUpgradeCost, isTabUnlocked, getShardEffects } from '@/lib/tabUnlocks';
import { fmt, fmtKg, fmtRate, fmtTime, fmtPercent } from '@/lib/format';
import { saveGame, loadGame, calculateOfflineGains, hardReset, exportSave, importSave } from '@/lib/saveLoad';
import { useGameLoop } from '@/hooks/useGameLoop';
import { resumeAudio, sfxClick, sfxBuy, sfxComet, sfxPrestige, sfxAchievement, sfxAdClaim, sfxExpulsion, sfxTabSwitch, startMusic, stopMusic } from '@/lib/sounds';

// Tutorial definitions
const TUTORIALS: { id: string; title: string; text: string; trigger: (s: GameState) => boolean }[] = [
  { id: 'welcome', title: 'Welcome to Impact!', text: 'Tap the floating asteroid to mine mass. Buy metal deposits to earn mass automatically.', trigger: () => true },
  { id: 'buy_modes', title: 'Buy Modes', text: 'Use x1, x10, x100, or MAX to buy buildings in bulk. MAX shows how many you can afford.', trigger: (s) => s.totalClicks >= 5 },
  { id: 'comets', title: 'Comets!', text: 'Comets appear every 1-2 minutes. Tap them before they disappear to collect bonus mass!', trigger: (s) => s.cometsCaught >= 1 },
  { id: 'impact', title: 'Impact (Prestige)', text: 'Once you earn 10,000 Kg in a run, you can Impact to reset but earn Shards — permanent currency for upgrades.', trigger: (s) => s.runMassEarned >= 5000 },
  { id: 'composition', title: 'Compositions', text: 'After your first Impact, choose an element composition. Each has strategic bonuses and penalties.', trigger: (s) => s.totalPrestigeCount >= 1 },
  { id: 'expulsion', title: 'Expulsion Tab', text: 'Jettison mass to gain velocity, or sacrifice velocity for mass. Unlock this with shards.', trigger: (s) => !!s.unlockedTabs['expulsion'] },
  { id: 'velocity', title: 'Velocity Tab', text: 'Spend velocity to produce energy. Reach 50 m/s and Impact to unlock this tab.', trigger: (s) => !!s.unlockedTabs['velocity'] },
  { id: 'energy', title: 'Energy Tab', text: 'Spend energy on powerful upgrades like auto-purchase and production multipliers.', trigger: (s) => !!s.unlockedTabs['energy'] },
  { id: 'shards', title: 'Unspent Shard Bonus', text: 'Each unspent shard gives +0.1% to all production. Consider saving some!', trigger: (s) => s.currentShards >= 10 },
  { id: 'impatient', title: 'Impatient Tab', text: 'Watch ads to skip ahead. Claim 30 min, 1 hr, then 90 min of production. Then a 90 min cooldown.', trigger: (s) => s.totalPrestigeCount >= 1 },
  { id: 'ads', title: 'Ad Boosts', text: 'Three floating buttons offer boosts: 2x Production, 2x Shards on Impact, and Mass Drops. Popup ads appear periodically too.', trigger: (s) => s.totalClicks >= 20 },
];

// Space dust floating particles background
function SpaceDust() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let animId: number;
    const particles: { x: number; y: number; size: number; speed: number; opacity: number; drift: number }[] = [];
    const resize = () => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight; };
    resize();
    window.addEventListener('resize', resize);
    // Spawn particles
    for (let i = 0; i < 60; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: 0.5 + Math.random() * 1.5,
        speed: 0.1 + Math.random() * 0.4,
        opacity: 0.15 + Math.random() * 0.35,
        drift: (Math.random() - 0.5) * 0.3,
      });
    }
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of particles) {
        p.y -= p.speed;
        p.x += p.drift;
        if (p.y < -5) { p.y = canvas.height + 5; p.x = Math.random() * canvas.width; }
        if (p.x < -5) p.x = canvas.width + 5;
        if (p.x > canvas.width + 5) p.x = -5;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(180, 200, 255, ${p.opacity})`;
        ctx.fill();
      }
      animId = requestAnimationFrame(animate);
    };
    animate();
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', resize); };
  }, []);
  return <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 0 }} />;
}

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
  const [adPopup, setAdPopup] = useState<string | null>(null); // 'production' | 'shard' | 'mass' | 'noads' | null
  const [showNoAdsPurchase, setShowNoAdsPurchase] = useState(false);

  // Feedback state
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackCategory, setFeedbackCategory] = useState<'bug' | 'suggestion' | 'praise'>('suggestion');
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [feedbackSent, setFeedbackSent] = useState(false);

  // Tutorial state
  const [activeTutorial, setActiveTutorial] = useState<string | null>(null);

  // Expulsion tab state
  const [expulsionPercent, setExpulsionPercent] = useState(10);
  const [accumulationAmount, setAccumulationAmount] = useState(1);
  const [expulsionMsg, setExpulsionMsg] = useState<string | null>(null);

  // Click combo
  const [clickCombo, setClickCombo] = useState(0);
  const comboTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Floating mini-asteroid position
  const [asteroidPos, setAsteroidPos] = useState({ x: -1, y: -1 });
  const draggingRef = useRef(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  // Scroll ref
  const scrollRef = useRef<HTMLDivElement>(null);

  const setState = useCallback((s: GameState) => {
    stateRef.current = s;
    setStateRaw(s);
  }, []);

  // Achievement callback
  const handleNewAchievements = useCallback((popups: AchievementPopup[]) => {
    setAchievementPopups(prev => [...prev, ...popups]);
    if (popups.length > 0 && stateRef.current.soundEnabled) sfxAchievement();
  }, []);

  // Auto-dismiss achievements after 4 seconds
  useEffect(() => {
    if (achievementPopups.length > 0) {
      const timer = setTimeout(() => {
        setAchievementPopups(prev => prev.slice(1));
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [achievementPopups]);

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

  // Set initial mini-asteroid position
  useEffect(() => {
    if (typeof window !== 'undefined' && asteroidPos.x === -1) {
      setAsteroidPos({ x: window.innerWidth - 70, y: window.innerHeight - 140 });
    }
  }, [asteroidPos.x]);

  // Text size fix for mobile
  useEffect(() => {
    document.documentElement.style.setProperty('-webkit-text-size-adjust', '100%');
  }, []);

  // Music toggle
  useEffect(() => {
    if (state.musicEnabled) { resumeAudio(); startMusic(); }
    else stopMusic();
    return () => stopMusic();
  }, [state.musicEnabled]);

  // Resume audio context on first interaction
  useEffect(() => {
    const handler = () => { resumeAudio(); window.removeEventListener('click', handler); };
    window.addEventListener('click', handler);
    return () => window.removeEventListener('click', handler);
  }, []);

  // Tutorial checker — show tutorials for newly triggered features
  useEffect(() => {
    if (!loaded || activeTutorial) return;
    for (const tut of TUTORIALS) {
      if (!state.tutorialCompleted.includes(tut.id) && !state.tutorialSkipped && tut.trigger(state)) {
        setActiveTutorial(tut.id);
        break;
      }
    }
  }, [loaded, state, activeTutorial]);

  // === COMBO MULTIPLIER (up to 5x) ===
  function getComboMult(combo: number): number {
    const clamped = Math.min(combo, 50);
    return 1 + (clamped / 50) * 4; // linear 1x to 5x
  }

  // === HANDLERS ===

  const handleClick = useCallback((e?: React.MouseEvent | React.TouchEvent) => {
    if (comboTimerRef.current) clearTimeout(comboTimerRef.current);
    const newCombo = clickCombo + 1;
    setClickCombo(newCombo);
    comboTimerRef.current = setTimeout(() => setClickCombo(0), 2000);

    const comboMult = getComboMult(newCombo);
    const clickVal = getClickValue(stateRef.current, comboMult);
    const newState = processClick(stateRef.current, comboMult);

    if (newCombo > newState.maxComboReached) {
      newState.maxComboReached = newCombo;
    }

    setState(newState);
    if (stateRef.current.soundEnabled) sfxClick();

    // Floating number near the asteroid
    const id = nextFloatId.current++;
    const fx = asteroidPos.x + 28 + (Math.random() - 0.5) * 40;
    const fy = asteroidPos.y - 10;
    setFloatingNums(prev => [...prev, { id, value: clickVal, x: fx, y: fy, opacity: 1 }]);
    setTimeout(() => setFloatingNums(prev => prev.filter(f => f.id !== id)), 1000);
  }, [clickCombo, setState, asteroidPos]);

  // Mini-asteroid drag handlers
  const handleAsteroidPointerDown = useCallback((e: React.PointerEvent) => {
    draggingRef.current = true;
    dragOffsetRef.current = { x: e.clientX - asteroidPos.x, y: e.clientY - asteroidPos.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [asteroidPos]);

  const handleAsteroidPointerMove = useCallback((e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    setAsteroidPos({
      x: Math.max(0, Math.min(window.innerWidth - 60, e.clientX - dragOffsetRef.current.x)),
      y: Math.max(0, Math.min(window.innerHeight - 60, e.clientY - dragOffsetRef.current.y)),
    });
  }, []);

  const handleAsteroidPointerUp = useCallback((e: React.PointerEvent) => {
    if (draggingRef.current) {
      draggingRef.current = false;
      const dx = Math.abs(e.clientX - (asteroidPos.x + dragOffsetRef.current.x));
      const dy = Math.abs(e.clientY - (asteroidPos.y + dragOffsetRef.current.y));
      if (dx < 5 && dy < 5) {
        handleClick();
      }
    }
  }, [asteroidPos, handleClick]);

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
    if (result) { setState(result); if (s.soundEnabled) sfxBuy(); }
  }, [setState]);

  const handleBuyEnergyUpgrade = useCallback((upgradeId: string) => {
    const s = stateRef.current;
    const def = ENERGY_UPGRADES.find(u => u.id === upgradeId);
    if (!def) return;
    const level = s.energyUpgrades[def.id] || 0;
    if (level >= def.maxLevel) return;
    const cost = getEnergyUpgradeCost(def, level);
    if (s.energy < cost) return;
    setState({ ...s, energy: s.energy - cost, energyUpgrades: { ...s.energyUpgrades, [def.id]: level + 1 } });
  }, [setState]);

  const handleExpulsion = useCallback(() => {
    const s = stateRef.current;
    if (s.expulsionCooldown > 0 || s.mass <= 0) return;
    const massToJ = s.mass * (expulsionPercent / 100);
    if (massToJ <= 0) return;
    const rate = getExpulsionRate(s.shardUpgrades);
    let effectiveRate = rate;
    if (s.composition) { const comp = getCompositionDef(s.composition); if (comp) effectiveRate *= comp.expulsionMult; }
    const achieveEff = getAchievementEffects(s);
    effectiveRate *= achieveEff.expulsionMult;
    const result = calculateExpulsion(massToJ, effectiveRate);
    setState({ ...s, mass: s.mass - result.massLost, velocity: s.velocity + result.velocityGained, expulsionCooldown: EXPULSION_COOLDOWN, totalExpulsions: s.totalExpulsions + 1 });
    if (s.soundEnabled) sfxExpulsion();
    setExpulsionMsg(`Jettisoned ${fmtKg(result.massLost)} → +${fmt(result.velocityGained)} m/s`);
    setTimeout(() => setExpulsionMsg(null), 3000);
  }, [expulsionPercent, setState]);

  const handleAccumulation = useCallback(() => {
    const s = stateRef.current;
    if (s.velocity < accumulationAmount || accumulationAmount <= 0) return;
    const rate = getAccumulationRate(s.shardUpgrades);
    const achieveEff = getAchievementEffects(s);
    const effectiveRate = rate * achieveEff.accumulationMult;
    const result = calculateAccumulation(accumulationAmount, effectiveRate);
    setState({ ...s, velocity: s.velocity - result.velocityLost, mass: s.mass + result.massGained, accumulationUseCount: s.accumulationUseCount + 1 });
    setExpulsionMsg(`Sacrificed ${fmt(result.velocityLost)} m/s → +${fmtKg(result.massGained)}`);
    setTimeout(() => setExpulsionMsg(null), 3000);
  }, [accumulationAmount, setState]);

  const handleCatchComet = useCallback((cometId: number) => {
    const { state: newState, value } = catchComet(stateRef.current, cometId);
    if (value > 0) { setState(newState); if (stateRef.current.soundEnabled) sfxComet(); }
  }, [setState]);

  const handleTabSwitch = useCallback((tab: TabName) => {
    const s = stateRef.current;
    if (!isTabUnlocked(tab, s.unlockedTabs) && tab !== 'dev') return;
    setState({ ...s, activeTab: tab, tabSwitchCount: s.tabSwitchCount + 1 });
    if (s.soundEnabled) sfxTabSwitch();
    setTimeout(() => {
      const el = document.getElementById(`tab-${tab}`);
      el?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }, 50);
  }, [setState]);

  const handleBuyTabUnlock = useCallback((tabId: string) => {
    const s = stateRef.current;
    const def = TAB_UNLOCKS.find(t => t.tabId === tabId);
    if (!def || s.unlockedTabs[tabId] || s.currentShards < def.shardCost || s.totalPrestigeCount < def.requiresPrestige) return;
    setState({ ...s, currentShards: s.currentShards - def.shardCost, unlockedTabs: { ...s.unlockedTabs, [tabId]: true }, activeTab: tabId as TabName });
  }, [setState]);

  const handleVelocityUnlockReady = useCallback(() => {
    setState({ ...stateRef.current, velocityUnlockReady: true });
  }, [setState]);

  const handleBuyShardUpgrade = useCallback((upgradeId: string) => {
    const s = stateRef.current;
    const def = SHARD_UPGRADES.find(u => u.id === upgradeId);
    if (!def) return;
    const level = s.shardUpgrades[def.id] || 0;
    if (level >= def.maxLevel) return;
    const cost = getShardUpgradeCost(def, level);
    if (s.currentShards < cost) return;
    setState({ ...s, currentShards: s.currentShards - cost, shardUpgrades: { ...s.shardUpgrades, [def.id]: level + 1 } });
  }, [setState]);

  const handleImpact = useCallback(() => { setShowImpactWarning(true); }, []);

  const confirmImpact = useCallback(() => {
    setShowImpactWarning(false);
    setImpactExploding(true);
    if (stateRef.current.soundEnabled) sfxPrestige();
    const s = stateRef.current;
    const shardEff = getShardEffects(s.shardUpgrades);
    const achieveEff = getAchievementEffects(s);
    const energyEff = getEnergyEffects(s);
    const shardDoubleMult = s.shardDoubleActive ? 2 : 1;
    const bonusMult = shardEff.massMult * achieveEff.shardMult * (1 + (energyEff.shardMult - 1)) * shardDoubleMult;
    const earnedShards = calcShards(s.runMassEarned, s.currentTier, bonusMult);
    let newState = getPrestigeResetState(s);
    newState.currentShards += earnedShards;
    newState.lifetimeShards += earnedShards;
    if (s.runTime < newState.fastestPrestige) newState.fastestPrestige = s.runTime;
    for (let t = 5; t >= 0; t--) {
      const tierDef = PRESTIGE_TIERS[t];
      if (tierDef && newState.lifetimeShards >= tierDef.shardReq && t > newState.currentTier) newState.currentTier = t as any;
    }
    setTimeout(() => {
      setState(newState);
      setImpactExploding(false);
      saveGame(newState);
      if (getUnlockedCompositions(newState.currentTier).length > 0) setShowCompPicker(true);
    }, 2000);
  }, [setState]);

  const handleCompSelect = useCallback((compId: string) => {
    setState({ ...stateRef.current, composition: compId });
    setShowCompPicker(false);
  }, [setState]);

  // === AD HANDLERS ===

  // FLOATING: 2x Production (30 min boost)
  const handleProductionAd = useCallback(() => {
    const s = stateRef.current;
    if (!s.productionAdAvailable) return;
    setState({
      ...s,
      activeBoosts: { ...s.activeBoosts, productionDouble: { active: true, endsAt: Date.now() + 30 * 60 * 1000 } },
      productionAdAvailable: false,
      nextProductionAdIn: 1800,
    });
    if (s.soundEnabled) sfxAdClaim();
    setAdPopup(null);
  }, [setState]);

  // FLOATING: 2x Shards on Next Impact
  const handleShardDoubleAd = useCallback(() => {
    const s = stateRef.current;
    if (!s.shardDoubleAdAvailable || s.shardDoubleActive) return;
    setState({ ...s, shardDoubleActive: true, shardDoubleAdAvailable: false });
    setAdPopup(null);
  }, [setState]);

  // FLOATING: Mass Drop (instant mass)
  const handleMassDropAd = useCallback(() => {
    const s = stateRef.current;
    if (!s.massDropAdAvailable) return;
    const mps = getMassPerSecond(s);
    const drop = Math.max(100, mps * 300);
    setState({
      ...s,
      mass: s.mass + drop,
      runMassEarned: s.runMassEarned + drop,
      totalMassEarned: s.totalMassEarned + drop,
      massDropAdAvailable: false,
      nextMassDropAdIn: 300 + Math.random() * 300,
    });
    setAdPopup(null);
  }, [setState]);

  // POPUP: +10% Shards
  const handleShardPopup = useCallback(() => {
    const s = stateRef.current;
    if (!s.shardPopupAvailable) return;
    const bonus = Math.max(1, Math.floor(s.lifetimeShards * 0.1));
    setState({
      ...s,
      currentShards: s.currentShards + bonus,
      lifetimeShards: s.lifetimeShards + bonus,
      shardPopupAvailable: false,
      nextShardPopupIn: 1200 + Math.random() * 1200,
      shardPopupExpiresIn: 0,
    });
  }, [setState]);

  // POPUP: 2x Velocity (20 min boost)
  const handleVelocityPopup = useCallback(() => {
    const s = stateRef.current;
    if (!s.velocityPopupAvailable) return;
    setState({
      ...s,
      activeBoosts: { ...s.activeBoosts, velocityDouble: { active: true, endsAt: Date.now() + 20 * 60 * 1000 } },
      velocityPopupAvailable: false,
      nextVelocityPopupIn: 1200 + Math.random() * 1200,
      velocityPopupExpiresIn: 0,
    });
  }, [setState]);

  const handleRemoveAds = useCallback(() => {
    const s = stateRef.current;
    setState({ ...s, adsRemoved: true });
    setShowNoAdsPurchase(false);
    setAdPopup(null);
  }, [setState]);

  // IMPATIENT TAB: tiered ad rewards
  const handleImpatientAd = useCallback(() => {
    const s = stateRef.current;
    if (s.impatientStep >= 3) return; // locked out
    const prod = getProduction(s);
    const minutesMap = [30, 60, 90]; // step 0=30min, step 1=60min, step 2=90min
    const minutes = minutesMap[s.impatientStep];
    const massDrop = prod.massPerSec * minutes * 60;
    const velDrop = prod.velocityPerSec * minutes * 60;
    const energyDrop = prod.energyPerSec * minutes * 60;
    const nextStep = s.impatientStep + 1;
    const isLockout = nextStep >= 3;
    setState({
      ...s,
      mass: s.mass + massDrop,
      velocity: s.velocity + velDrop,
      energy: s.energy + energyDrop,
      runMassEarned: s.runMassEarned + massDrop,
      totalMassEarned: s.totalMassEarned + massDrop,
      impatientStep: isLockout ? 3 : nextStep,
      impatientLockoutEndsAt: isLockout ? Date.now() + 90 * 60 * 1000 : 0,
    });
  }, [setState]);

  const handleDevPasscode = useCallback(() => {
    if (devPasscode === '89116282') { setState({ ...stateRef.current, devMode: true }); setDevPasscode(''); }
  }, [devPasscode, setState]);

  const handleHardReset = useCallback(() => {
    hardReset();
    setState(defaultGameState());
    setShowResetConfirm(false);
  }, [setState]);

  const handleExport = useCallback(() => {
    const code = exportSave(stateRef.current);
    navigator.clipboard?.writeText(code);
    setImportCode(code);
  }, []);

  const handleImport = useCallback(() => {
    const result = importSave(importCode);
    if (result) { setState(result); saveGame(result); setImportCode(''); setShowImportExport(false); }
  }, [importCode, setState]);

  const handleDismissTutorial = useCallback(() => {
    if (!activeTutorial) return;
    const s = stateRef.current;
    setState({ ...s, tutorialCompleted: [...s.tutorialCompleted, activeTutorial] });
    setActiveTutorial(null);
  }, [activeTutorial, setState]);

  const handleSkipAllTutorials = useCallback(() => {
    setState({ ...stateRef.current, tutorialSkipped: true });
    setActiveTutorial(null);
  }, [setState]);

  const handleDismissBeta = useCallback(() => {
    setState({ ...stateRef.current, betaDismissed: true });
  }, [setState]);

  const handleSubmitFeedback = useCallback(() => {
    if (!feedbackText.trim() || feedbackRating === 0) return;
    try {
      const existing = JSON.parse(localStorage.getItem('impact_feedback') || '[]');
      existing.push({ category: feedbackCategory, text: feedbackText.trim(), rating: feedbackRating, timestamp: Date.now(), tier: state.currentTier, shards: state.lifetimeShards, playTime: state.totalPlayTime });
      localStorage.setItem('impact_feedback', JSON.stringify(existing));
      setFeedbackText(''); setFeedbackRating(0); setFeedbackSent(true);
      setTimeout(() => setFeedbackSent(false), 3000);
    } catch {}
  }, [feedbackText, feedbackRating, feedbackCategory, state]);

  // === DERIVED VALUES ===
  const prod = getProduction(state);
  const currentTierDef = PRESTIGE_TIERS[state.currentTier];
  const nextTier = PRESTIGE_TIERS[state.currentTier + 1];
  const comboMult = getComboMult(clickCombo);
  const isProductionBoosted = state.activeBoosts.productionDouble.active && Date.now() < state.activeBoosts.productionDouble.endsAt;
  const boostTimeLeft = isProductionBoosted ? Math.max(0, (state.activeBoosts.productionDouble.endsAt - Date.now()) / 1000) : 0;
  const isVelocityBoosted = state.activeBoosts.velocityDouble.active && Date.now() < state.activeBoosts.velocityDouble.endsAt;
  const velBoostTimeLeft = isVelocityBoosted ? Math.max(0, (state.activeBoosts.velocityDouble.endsAt - Date.now()) / 1000) : 0;

  const expulsionRate = getExpulsionRate(state.shardUpgrades);
  let effectiveExpulsionRate = expulsionRate;
  if (state.composition) { const comp = getCompositionDef(state.composition); if (comp) effectiveExpulsionRate *= comp.expulsionMult; }
  const achieveEffE = getAchievementEffects(state);
  effectiveExpulsionRate *= achieveEffE.expulsionMult;
  const massToJettison = state.mass * (expulsionPercent / 100);
  const velocityFromExpulsion = massToJettison * effectiveExpulsionRate;
  const accRate = getAccumulationRate(state.shardUpgrades);
  const effectiveAccRate = accRate * achieveEffE.accumulationMult;
  const massFromAccumulation = accumulationAmount * effectiveAccRate;

  // Unspent shard bonus display
  const shardBonusPercent = state.currentShards * 0.1;

  const allTabs: { id: TabName; label: string; emoji: string }[] = [
    { id: 'metals', label: 'Metals', emoji: '🪨' },
    { id: 'expulsion', label: 'Expulsion', emoji: '💨' },
    { id: 'velocity', label: 'Velocity', emoji: '🚀' },
    { id: 'energy', label: 'Energy', emoji: '⚡' },
    { id: 'impact', label: 'Impact', emoji: '💥' },
    { id: 'achievements', label: 'Awards', emoji: '🏆' },
    { id: 'stats', label: 'Stats', emoji: '📊' },
    { id: 'impatient', label: 'Impatient', emoji: '⏩' },
  ];

  if (!loaded) {
    return (
      <div className="game-shell bg-[var(--color-space)] flex items-center justify-center">
        <div className="glow-cyan text-xl animate-pulse">Loading...</div>
      </div>
    );
  }

  return (
    <div className="game-shell scanlines bg-[var(--color-space)] text-[#e0e0ff] flex flex-col max-w-lg mx-auto relative overflow-hidden no-select safe-top safe-bottom">

      {/* === SPACE DUST BACKGROUND === */}
      {state.spaceDustEnabled && <SpaceDust />}

      {/* === FLOATING CLICK NUMBERS (fixed, over everything) === */}
      {floatingNums.map(f => (
        <div key={f.id} className="fixed pointer-events-none float-up glow-cyan"
          style={{ left: f.x, top: f.y, zIndex: 60, fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--color-green)' }}>
          +{fmtKg(f.value)}
        </div>
      ))}

      {/* === FLOATING MINI-ASTEROID (draggable click button) === */}
      {asteroidPos.x >= 0 && (
        <div className="mini-asteroid"
          style={{ left: asteroidPos.x, top: asteroidPos.y }}
          onPointerDown={handleAsteroidPointerDown}
          onPointerMove={handleAsteroidPointerMove}
          onPointerUp={handleAsteroidPointerUp}>
          <div className="mini-asteroid-inner">🪨</div>
          <div className="mini-asteroid-mass">+{fmtKg(getClickValue(state, comboMult))}</div>
          {clickCombo > 2 && (
            <div style={{
              position: 'absolute', top: -22, left: '50%', transform: 'translateX(-50%)',
              fontSize: '0.7rem', fontWeight: 'bold', whiteSpace: 'nowrap',
              color: comboMult >= 4 ? 'var(--color-orange)' : comboMult >= 2.5 ? 'var(--color-yellow)' : 'var(--color-neon)',
              textShadow: `0 0 8px ${comboMult >= 4 ? 'var(--color-orange)' : 'var(--color-neon)'}`,
              background: 'rgba(10,10,26,0.8)', padding: '1px 6px', borderRadius: '4px',
            }}>
              x{clickCombo} ({comboMult.toFixed(1)}x)
            </div>
          )}
        </div>
      )}

      {/* === COMETS (fixed position, no background block) === */}
      {state.activeComets && state.activeComets.map(comet => (
        <button key={comet.id} className="comet-button"
          style={{ left: `${comet.x}%`, top: `${Math.min(85, comet.y + 15)}%` }}
          onClick={() => handleCatchComet(comet.id)}>
          <div className="comet-inner">
            <span className="comet-emoji">☄️</span>
            <span className="comet-value">+{fmtKg(comet.value)}</span>
          </div>
          <div className="comet-timer" style={{ width: `${(comet.timeLeft / 10) * 100}%` }} />
        </button>
      ))}

      {/* === IMPACT EXPLOSION OVERLAY === */}
      {impactExploding && (
        <div className="impact-explosion-overlay">
          <div className="impact-flash" />
          <div className="impact-ring impact-ring-1" />
          <div className="impact-ring impact-ring-2" />
          <div className="impact-ring impact-ring-3" />
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="impact-debris" style={{
              '--debris-angle': `${i * 30}deg`, '--debris-distance': `${40 + Math.random() * 30}vw`,
              '--debris-delay': `${0.05 * i}s`, '--debris-size': `${4 + Math.random() * 6}px`,
            } as React.CSSProperties} />
          ))}
          <div className="impact-text">IMPACT!</div>
        </div>
      )}

      {/* === BETA DISCLAIMER === */}
      {loaded && !state.betaDismissed && (
        <div className="fixed inset-0 z-[55] bg-black/85 flex items-center justify-center p-4">
          <div className="card box-glow-cyan p-6 max-w-sm text-center" style={{ borderColor: 'var(--color-neon)' }}>
            <div className="text-3xl mb-2">🚀</div>
            <div className="text-lg font-bold mb-2 glow-cyan">Welcome to Impact Beta!</div>
            <div className="text-[var(--color-gray-400)] text-xs mb-3" style={{ lineHeight: '1.8' }}>
              This game is in active development. While we do our best to preserve your progress, major updates may occasionally require a save reset. Thank you for testing!
            </div>
            <div className="text-[var(--color-yellow)] text-xs mb-4">⚠️ Progress may be lost during major updates.</div>
            <button onClick={handleDismissBeta} className="btn-primary w-full">I Understand — Let&apos;s Play!</button>
          </div>
        </div>
      )}

      {/* === TUTORIAL POPUP === */}
      {activeTutorial && (() => {
        const tut = TUTORIALS.find(t => t.id === activeTutorial);
        if (!tut) return null;
        return (
          <div className="fixed inset-0 z-[52] bg-black/60 flex items-end justify-center p-4 pb-20">
            <div className="card box-glow-cyan p-4 max-w-sm w-full" style={{ borderColor: 'var(--color-neon)' }}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">💡</span>
                <span className="font-bold text-sm glow-cyan">{tut.title}</span>
              </div>
              <div className="text-[var(--color-gray-400)] text-xs mb-3" style={{ lineHeight: '1.6' }}>{tut.text}</div>
              <div className="flex gap-2">
                <button onClick={handleSkipAllTutorials} className="btn-secondary flex-1 text-xs">Skip All</button>
                <button onClick={handleDismissTutorial} className="btn-primary flex-1 text-xs">Got it!</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* === OFFLINE GAINS POPUP === */}
      {offlineGains && (
        <div className="fixed inset-0 z-40 bg-black/70 flex items-center justify-center p-4" onClick={() => setOfflineGains(null)}>
          <div className="card box-glow-cyan p-6 max-w-sm text-center">
            <div className="text-2xl mb-2">🌙</div>
            <div className="text-lg font-bold mb-2 glow-cyan">Welcome back!</div>
            <div className="text-[var(--color-gray-400)] mb-1">You were away for {fmtTime(offlineGains.time)}</div>
            <div className="font-bold" style={{ color: 'var(--color-green)' }}>+{fmtKg(offlineGains.mass)} mass earned</div>
            <div className="text-[var(--color-gray-500)] text-xs mt-3">Tap to dismiss</div>
          </div>
        </div>
      )}

      {/* === IMPACT WARNING MODAL === */}
      {showImpactWarning && (
        <div className="fixed inset-0 z-40 bg-black/80 flex items-center justify-center p-4">
          <div className="card box-glow-purple p-6 max-w-sm text-center" style={{ borderColor: 'var(--color-orange)' }}>
            <div className="text-3xl mb-2">💥</div>
            <div className="text-xl font-bold mb-2 glow-orange">Impact Warning!</div>
            <div className="text-[var(--color-gray-400)] mb-2 text-sm">This will RESET your mass, velocity, buildings, and energy upgrades.</div>
            <div className="font-bold mb-1" style={{ color: 'var(--color-green)' }}>+{fmt(calcShards(state.runMassEarned, state.currentTier, state.shardDoubleActive ? 2 : 1))} Shards</div>
            {state.shardDoubleActive && <div className="text-xs mb-3 badge badge-yellow" style={{ display: 'inline-block' }}>💎 2x ACTIVE</div>}
            <div className="flex gap-3">
              <button onClick={() => setShowImpactWarning(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={confirmImpact} className="btn-primary flex-1">Impact!</button>
            </div>
          </div>
        </div>
      )}

      {/* === COMPOSITION PICKER === */}
      {showCompPicker && (
        <div className="fixed inset-0 z-40 bg-black/80 flex items-center justify-center p-4">
          <div className="card box-glow-purple p-6 max-w-sm" style={{ borderColor: 'var(--color-purple)' }}>
            <div className="text-center mb-4">
              <div className="text-2xl mb-1">🌌</div>
              <div className="text-lg font-bold gradient-text">Choose Composition</div>
              <div className="text-[var(--color-gray-400)] text-xs">This affects your bonuses for this run</div>
            </div>
            <div className="space-y-2">
              {getUnlockedCompositions(state.currentTier).map(comp => (
                <button key={comp.id} onClick={() => handleCompSelect(comp.id)}
                  className="card w-full text-left hover:border-[var(--color-neon)] transition-colors cursor-pointer">
                  <div className="flex items-center gap-2 mb-1">
                    <span>{comp.emoji}</span><span className="font-bold text-sm">{comp.name}</span>
                  </div>
                  <div className="text-[var(--color-gray-400)] text-xs">{comp.desc}</div>
                  <div className="text-[var(--color-gray-500)] text-xs mt-1 italic">{comp.flavor}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* === ACHIEVEMENT POPUP (top-right, non-blocking, auto-dismiss) === */}
      {achievementPopups.length > 0 && (
        <div className="fixed top-3 right-3 z-50 animate-bounce-in" style={{ maxWidth: '260px' }}>
          <div className="card" style={{ borderColor: 'var(--color-yellow)', background: 'rgba(40,30,10,0.95)' }}>
            <button onClick={() => setAchievementPopups(prev => prev.slice(1))}
              className="absolute top-1 right-2 text-[var(--color-gray-500)] hover:text-white text-sm">✕</button>
            <div className="flex items-center gap-2">
              <span className="text-2xl">{achievementPopups[0].emoji}</span>
              <div>
                <div className="font-bold text-sm" style={{ color: 'var(--color-yellow)' }}>{achievementPopups[0].name}</div>
                <div className="text-[var(--color-gray-400)] text-xs">{achievementPopups[0].desc}</div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--color-green)' }}>{achievementPopups[0].bonusDesc}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* === RESOURCE HEADER === */}
      <div className="border-b border-[var(--color-gray-700)] px-3 py-2 sticky top-0 z-30" style={{ background: 'rgba(10,10,26,0.95)' }}>
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1.5">
            <span className="text-sm">{currentTierDef?.emoji}</span>
            <span className="text-xs text-[var(--color-gray-400)]">{currentTierDef?.name}</span>
            {state.composition && <span className="text-xs ml-1">{getCompositionDef(state.composition)?.emoji}</span>}
          </div>
          <div className="flex items-center gap-2">
            {isProductionBoosted && <span className="badge badge-green">2x {fmtTime(boostTimeLeft)}</span>}
            {isVelocityBoosted && <span className="badge badge-purple">🚀2x {fmtTime(velBoostTimeLeft)}</span>}
            {state.shardDoubleActive && <span className="badge badge-yellow">💎2x</span>}
            {state.currentShards > 0 && <span className="badge badge-orange">💎 {fmt(state.currentShards)}</span>}
            {!state.adsRemoved && (
              <button className="no-ads-btn" onClick={() => setShowNoAdsPurchase(true)} title="Remove Ads">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  {/* Play triangle (ad symbol) */}
                  <path d="M8 6.5v11l9-5.5-9-5.5z" fill="white" opacity="0.9"/>
                  {/* Red diagonal line (no symbol) */}
                  <line x1="3" y1="3" x2="21" y2="21" stroke="#ff3366" strokeWidth="3" strokeLinecap="round"/>
                </svg>
              </button>
            )}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="card" style={{ padding: '4px 8px' }}>
            <div className="text-[10px] text-[var(--color-gray-500)]">Mass</div>
            <div className="text-sm font-bold glow-cyan">{fmtKg(state.mass)}</div>
            <div className="text-[10px] mass-per-sec">{fmtRate(prod.massPerSec)}</div>
          </div>
          <div className="card" style={{ padding: '4px 8px' }}>
            <div className="text-[10px] text-[var(--color-gray-500)]">Velocity</div>
            <div className="text-sm font-bold glow-purple">{fmt(state.velocity)} m/s</div>
            <div className="text-[10px] mass-per-sec">{fmtRate(prod.velocityPerSec)}</div>
          </div>
          <div className="card" style={{ padding: '4px 8px' }}>
            <div className="text-[10px] text-[var(--color-gray-500)]">Energy</div>
            <div className="text-sm font-bold glow-orange">{fmt(state.energy)} J</div>
            <div className="text-[10px] mass-per-sec">{fmtRate(prod.energyPerSec)}</div>
          </div>
        </div>
      </div>

      {/* === 3 FLOATING AD BUTTONS (right edge, persist until claimed) === */}
      {state.productionAdAvailable && (
        <div className="ad-float-btn ad-float-btn-production" style={{ right: 6, top: '32%' }}
          onClick={() => adPopup === 'production' ? handleProductionAd() : setAdPopup('production')}>
          <span style={{ fontSize: '0.95rem', fontWeight: 900 }}>2x</span>
          <span style={{ fontSize: '0.45rem' }}>✦✦✦</span>
        </div>
      )}
      {state.shardDoubleAdAvailable && !state.shardDoubleActive && (
        <div className="ad-float-btn ad-float-btn-shard" style={{ right: 6, top: '46%' }}
          onClick={() => adPopup === 'shardDouble' ? handleShardDoubleAd() : setAdPopup('shardDouble')}>
          <span style={{ fontSize: '0.7rem', fontWeight: 900 }}>💎2x</span>
        </div>
      )}
      {state.massDropAdAvailable && (
        <div className="ad-float-btn ad-float-btn-mass" style={{ right: 6, top: '60%' }}
          onClick={() => adPopup === 'mass' ? handleMassDropAd() : setAdPopup('mass')}>
          <span style={{ fontSize: '1rem' }}>📦</span>
        </div>
      )}

      {/* === 2 POPUP ADS (appear periodically, 60s timer) === */}
      {state.shardPopupAvailable && (
        <button className="comet-button" style={{ left: '20%', top: '40%' }}
          onClick={handleShardPopup}>
          <div className="comet-inner" style={{
            borderColor: 'var(--color-orange)',
            background: 'radial-gradient(ellipse at center, rgba(255,107,43,0.25), rgba(255,60,0,0.1), transparent 70%)',
            boxShadow: '0 0 20px rgba(255,107,43,0.4), 0 0 40px rgba(255,60,0,0.2), inset 0 0 12px rgba(255,107,43,0.15)',
          }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 900, color: 'var(--color-orange)' }}>+10%</span>
            <span style={{ fontSize: '0.9rem' }}>💎</span>
          </div>
          <div className="comet-timer" style={{ width: `${(state.shardPopupExpiresIn / 60) * 100}%` }} />
        </button>
      )}
      {state.velocityPopupAvailable && (
        <button className="comet-button" style={{ left: '75%', top: '35%' }}
          onClick={handleVelocityPopup}>
          <div className="comet-inner" style={{
            borderColor: 'var(--color-purple)',
            background: 'radial-gradient(ellipse at center, rgba(180,74,255,0.25), rgba(120,30,200,0.1), transparent 70%)',
            boxShadow: '0 0 20px rgba(180,74,255,0.4), 0 0 40px rgba(120,30,200,0.2), inset 0 0 12px rgba(180,74,255,0.15)',
          }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 900, color: 'var(--color-purple)' }}>2x</span>
            <span style={{ fontSize: '0.9rem' }}>🚀</span>
          </div>
          <div className="comet-timer" style={{ width: `${(state.velocityPopupExpiresIn / 60) * 100}%`, background: 'linear-gradient(90deg, var(--color-purple), var(--color-purple-dim))' }} />
        </button>
      )}

      {/* === FLOATING AD INFO POPUP === */}
      {adPopup && (
        <div className="absolute inset-0 z-[49]" onClick={() => setAdPopup(null)}>
          <div className="ad-popup" style={{ right: 64, top: adPopup === 'production' ? '31%' : adPopup === 'shardDouble' ? '45%' : '59%' }}
            onClick={e => e.stopPropagation()}>
            {adPopup === 'production' && <>
              <div className="font-bold text-sm mb-1" style={{ color: '#ffcc00' }}>⭐ 2x Production</div>
              <div className="text-xs text-[var(--color-gray-400)] mb-2">Doubles ALL production (mass, velocity, energy) for 30 minutes!</div>
              <button onClick={handleProductionAd} className="btn-primary w-full text-xs">{state.adsRemoved ? 'Activate!' : '📺 Watch Ad'}</button>
            </>}
            {adPopup === 'shardDouble' && <>
              <div className="font-bold text-sm mb-1" style={{ color: 'var(--color-orange)' }}>💎 2x Shards</div>
              <div className="text-xs text-[var(--color-gray-400)] mb-2">Doubles your shard reward on the NEXT Impact! Resets after use.</div>
              <button onClick={handleShardDoubleAd} className="btn-primary w-full text-xs">{state.adsRemoved ? 'Activate!' : '📺 Watch Ad'}</button>
            </>}
            {adPopup === 'mass' && <>
              <div className="font-bold text-sm mb-1" style={{ color: 'var(--color-neon)' }}>📦 Mass Drop</div>
              <div className="text-xs text-[var(--color-gray-400)] mb-2">Instant +{fmtKg(Math.max(100, getMassPerSecond(state) * 300))} mass (5 min of production)!</div>
              <button onClick={handleMassDropAd} className="btn-primary w-full text-xs">{state.adsRemoved ? 'Collect!' : '📺 Watch Ad'}</button>
            </>}
          </div>
        </div>
      )}

      {/* === FLOATING FEEDBACK BUTTON === */}
      <button className="fixed bottom-4 left-4 z-40 w-10 h-10 rounded-full flex items-center justify-center text-lg shadow-lg"
        style={{ background: 'var(--color-space-lighter)', border: '1px solid var(--color-gray-700)' }}
        onClick={() => { setShowFeedback(true); handleTabSwitch('stats'); }}
        title="Send Feedback">💬</button>

      {/* === NO ADS PURCHASE MODAL === */}
      {showNoAdsPurchase && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setShowNoAdsPurchase(false)}>
          <div className="card box-glow-purple p-6 max-w-sm text-center" onClick={e => e.stopPropagation()}>
            <div className="text-3xl mb-2">🚫📺</div>
            <div className="text-lg font-bold mb-2 glow-cyan">Remove Ads — $5</div>
            <div className="text-[var(--color-gray-400)] text-xs mb-3" style={{ lineHeight: '1.6' }}>
              All 5 ad bonuses still appear on the same schedule, but you collect them instantly with a single tap — no ads to watch!
            </div>
            <div className="space-y-1 text-left text-xs mb-4" style={{ color: 'var(--color-green)' }}>
              <div>✅ 2x Production (30 min) — instant</div>
              <div>✅ 2x Shards on Next Impact — instant</div>
              <div>✅ Mass Drops — instant</div>
              <div>✅ +10% Shard Popups — instant</div>
              <div>✅ 2x Velocity Popups — instant</div>
              <div>✅ No expiry timer pressure</div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowNoAdsPurchase(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={handleRemoveAds} className="btn-primary flex-1"
                style={{ background: 'linear-gradient(135deg, #006644, var(--color-green))', borderColor: 'var(--color-green)' }}>Buy $5</button>
            </div>
          </div>
        </div>
      )}

      {/* === TAB BAR === */}
      <div className="flex border-b border-[var(--color-gray-700)]" style={{ background: 'rgba(10,10,26,0.8)' }}>
        <button className="tab-arrow" onClick={() => { const el = document.getElementById('tab-scroll'); if (el) el.scrollBy({ left: -120, behavior: 'smooth' }); }}>◀</button>
        <div id="tab-scroll" className="tab-bar flex-1">
          {allTabs.map(tab => {
            const unlocked = isTabUnlocked(tab.id, state.unlockedTabs);
            const active = state.activeTab === tab.id;
            return (
              <button key={tab.id} id={`tab-${tab.id}`}
                onClick={() => handleTabSwitch(tab.id)}
                className={`tab ${active ? 'tab-active' : ''} ${!unlocked ? 'opacity-30 cursor-not-allowed' : ''}`}
                disabled={!unlocked && tab.id !== 'dev'}>
                {tab.emoji} {tab.label}
                {!unlocked && tab.id !== 'impact' && tab.id !== 'achievements' && tab.id !== 'stats' && tab.id !== 'impatient' && ' 🔒'}
              </button>
            );
          })}
          {state.devMode && (
            <button id="tab-dev" onClick={() => handleTabSwitch('dev')}
              className={`tab ${state.activeTab === 'dev' ? 'tab-active' : ''}`}
              style={{ color: 'var(--color-red)' }}>🔧 Dev</button>
          )}
        </div>
        <button className="tab-arrow" onClick={() => { const el = document.getElementById('tab-scroll'); if (el) el.scrollBy({ left: 120, behavior: 'smooth' }); }}>▶</button>
      </div>

      {/* === MAIN CONTENT === */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3" style={{ paddingBottom: '80px' }}>

        {/* ===================== METALS TAB ===================== */}
        {state.activeTab === 'metals' && (
          <>
            <div className="flex gap-2 justify-center">
              {([1, 10, 100, 'max'] as BuyMode[]).map(mode => (
                <button key={mode} onClick={() => setState({ ...state, buyMode: mode })}
                  className={state.buyMode === mode ? 'btn-primary' : 'btn-secondary'}
                  style={{ minWidth: '48px', fontSize: '0.8rem' }}>{mode === 'max' ? 'MAX' : `x${mode}`}</button>
              ))}
            </div>
            {METALS.map(def => {
              const owned = getBuildingCount(state, def);
              const count = state.buyMode === 'max' ? Math.max(1, getMaxAffordable(def, owned, state.mass)) : (state.buyMode as number);
              const cost = getTotalCostForN(def, owned, count);
              const canAfford = state.mass >= cost;
              const currentRate = getBuildingProductionRate(state, def.id);
              return (
                <button key={def.id} onClick={() => handleBuy(def.id)} disabled={!canAfford}
                  className={`card w-full text-left transition-colors cursor-pointer ${canAfford ? 'hover:border-[var(--color-neon)]' : 'opacity-40'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{def.emoji}</span>
                      <div>
                        <div className="text-sm font-bold">{def.name} <span className="text-[var(--color-gray-500)] font-normal text-xs">({owned})</span></div>
                        <div className="text-[var(--color-gray-400)] text-xs">{def.desc}</div>
                        {owned > 0 && <div className="text-[10px] mass-per-sec">Producing: {fmtRate(currentRate)}/s</div>}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-xs font-bold ${canAfford ? 'text-[var(--color-green)]' : 'text-[var(--color-red)]'}`}>{fmtKg(cost)}</div>
                      {state.buyMode === 'max' && <div className="text-[var(--color-neon)] text-[10px] font-bold">Buy {count}</div>}
                      <div className="text-[var(--color-gray-500)] text-[10px]">+{fmtRate(def.produces[0].baseAmount * count)} mass</div>
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
            <div className="card">
              <div className="section-header"><span className="text-lg">💨</span><span className="font-bold">Mass Expulsion</span></div>
              <div className="text-[var(--color-gray-400)] text-xs mb-3">Jettison mass to gain velocity</div>
              <div className="mb-3">
                <div className="flex justify-between text-xs text-[var(--color-gray-400)] mb-1">
                  <span>Jettison {expulsionPercent}% of mass</span><span>{fmtKg(massToJettison)}</span>
                </div>
                <input type="range" min="1" max="100" value={expulsionPercent}
                  onChange={(e) => setExpulsionPercent(Number(e.target.value))} className="w-full accent-[var(--color-neon)]" />
              </div>
              <div className="card mb-3" style={{ background: 'var(--color-space)' }}>
                <div className="flex justify-between items-center">
                  <div><div className="text-[10px] text-[var(--color-gray-500)]">You lose</div><div className="text-[var(--color-red)] font-bold text-sm">{fmtKg(massToJettison)}</div></div>
                  <div className="text-[var(--color-gray-600)]">→</div>
                  <div className="text-right"><div className="text-[10px] text-[var(--color-gray-500)]">You gain</div><div className="text-[var(--color-green)] font-bold text-sm">+{fmt(velocityFromExpulsion)} m/s</div></div>
                </div>
              </div>
              {state.expulsionCooldown > 0 ? (
                <div className="relative">
                  <button disabled className="btn-secondary w-full opacity-60">Cooldown: {state.expulsionCooldown.toFixed(1)}s</button>
                  <div className="resource-bar mt-1"><div className="resource-bar-fill" style={{ width: `${(1 - state.expulsionCooldown / EXPULSION_COOLDOWN) * 100}%`, background: 'var(--color-neon)' }} /></div>
                </div>
              ) : (
                <button onClick={handleExpulsion} disabled={state.mass <= 0}
                  className={`w-full ${state.mass > 0 ? 'btn-primary' : 'btn-secondary opacity-40'}`}>🚀 Jettison Mass</button>
              )}
            </div>
            <div className="glow-divider" />
            <div className="card">
              <div className="section-header"><span className="text-lg">🔄</span><span className="font-bold">Accumulation</span></div>
              <div className="text-[var(--color-gray-400)] text-xs mb-3">Sacrifice velocity to regain mass (worse rate)</div>
              <div className="mb-3">
                <div className="flex justify-between text-xs text-[var(--color-gray-400)] mb-1">
                  <span>Sacrifice velocity</span><span>Available: {fmt(state.velocity)} m/s</span>
                </div>
                <input type="range" min="1" max={Math.max(1, Math.floor(state.velocity))}
                  value={Math.min(accumulationAmount, Math.max(1, Math.floor(state.velocity)))}
                  onChange={(e) => setAccumulationAmount(Number(e.target.value))} className="w-full accent-[var(--color-purple)]" />
              </div>
              <div className="card mb-3" style={{ background: 'var(--color-space)' }}>
                <div className="flex justify-between items-center">
                  <div><div className="text-[10px] text-[var(--color-gray-500)]">You lose</div><div className="text-[var(--color-red)] font-bold text-sm">{fmt(accumulationAmount)} m/s</div></div>
                  <div className="text-[var(--color-gray-600)]">→</div>
                  <div className="text-right"><div className="text-[10px] text-[var(--color-gray-500)]">You gain</div><div className="text-[var(--color-green)] font-bold text-sm">+{fmtKg(massFromAccumulation)}</div></div>
                </div>
              </div>
              <button onClick={handleAccumulation} disabled={state.velocity < accumulationAmount || accumulationAmount <= 0}
                className={`w-full ${state.velocity >= accumulationAmount && accumulationAmount > 0 ? 'btn-primary' : 'btn-secondary opacity-40'}`}
                style={state.velocity >= accumulationAmount ? { background: 'linear-gradient(135deg, var(--color-purple-dim), var(--color-purple))', borderColor: 'var(--color-purple)' } : {}}>
                🔄 Sacrifice Velocity
              </button>
            </div>
            {expulsionMsg && (
              <div className="card text-center text-sm toast-enter" style={{ borderColor: 'var(--color-green)', color: 'var(--color-green)' }}>{expulsionMsg}</div>
            )}
            <div className="card text-xs text-[var(--color-gray-500)]" style={{ lineHeight: '1.6' }}>
              Expulsion rate: {fmt(effectiveExpulsionRate, 6)} vel/Kg{effectiveExpulsionRate > BASE_EXPULSION_RATE && <span className="text-[var(--color-green)]"> (boosted!)</span>}<br/>
              Accumulation rate: {fmt(effectiveAccRate)} Kg/vel{effectiveAccRate > BASE_ACCUMULATION_RATE && <span className="text-[var(--color-green)]"> (boosted!)</span>}<br/>
              Cooldown: {EXPULSION_COOLDOWN}s | Total expulsions: {state.totalExpulsions}
            </div>
          </>
        )}

        {/* ===================== VELOCITY TAB ===================== */}
        {state.activeTab === 'velocity' && (
          <>
            <div className="text-center mb-2"><div className="text-2xl">🚀</div><div className="text-sm text-[var(--color-gray-400)]">Spend velocity to produce energy</div></div>
            <div className="flex gap-2 justify-center">
              {([1, 10, 100, 'max'] as BuyMode[]).map(mode => (
                <button key={mode} onClick={() => setState({ ...state, buyMode: mode })}
                  className={state.buyMode === mode ? 'btn-primary' : 'btn-secondary'}
                  style={{ minWidth: '48px', fontSize: '0.8rem' }}>{mode === 'max' ? 'MAX' : `x${mode}`}</button>
              ))}
            </div>
            {VELOCITY_ITEMS.map(def => {
              const owned = getBuildingCount(state, def);
              const count = state.buyMode === 'max' ? Math.max(1, getMaxAffordable(def, owned, state.velocity)) : (state.buyMode as number);
              const cost = getTotalCostForN(def, owned, count);
              const canAfford = state.velocity >= cost;
              const currentRate = getBuildingProductionRate(state, def.id);
              return (
                <button key={def.id} onClick={() => handleBuy(def.id)} disabled={!canAfford}
                  className={`card w-full text-left transition-colors cursor-pointer ${canAfford ? 'hover:border-[var(--color-neon)]' : 'opacity-40'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{def.emoji}</span>
                      <div>
                        <div className="text-sm font-bold">{def.name} <span className="text-[var(--color-gray-500)] font-normal text-xs">({owned})</span></div>
                        <div className="text-[var(--color-gray-400)] text-xs">{def.desc}</div>
                        {owned > 0 && <div className="text-[10px] mass-per-sec">Producing: {fmtRate(currentRate)}/s</div>}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-xs font-bold ${canAfford ? 'text-[var(--color-green)]' : 'text-[var(--color-red)]'}`}>{fmt(cost)} m/s</div>
                      {state.buyMode === 'max' && <div className="text-[var(--color-neon)] text-[10px] font-bold">Buy {count}</div>}
                      <div className="text-[var(--color-gray-500)] text-[10px]">+{fmtRate(def.produces[0].baseAmount * count)} energy</div>
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
            <div className="text-center mb-2"><div className="text-2xl">⚡</div><div className="text-sm text-[var(--color-gray-400)]">Spend energy on permanent upgrades</div></div>
            {ENERGY_UPGRADES.map(def => {
              const level = state.energyUpgrades[def.id] || 0;
              const maxed = level >= def.maxLevel;
              const cost = getEnergyUpgradeCost(def, level);
              const canAfford = state.energy >= cost && !maxed;
              return (
                <button key={def.id} onClick={() => handleBuyEnergyUpgrade(def.id)} disabled={!canAfford}
                  className={`card w-full text-left transition-colors cursor-pointer ${canAfford ? 'hover:border-[var(--color-neon)]' : 'opacity-40'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{def.emoji}</span>
                      <div>
                        <div className="text-sm font-bold">{def.name} <span className="text-[var(--color-gray-500)] font-normal text-xs ml-1">
                          {maxed ? '(MAX)' : def.isToggle ? (level > 0 ? '(ON)' : '(OFF)') : `(Lv ${level}/${def.maxLevel})`}</span></div>
                        <div className="text-[var(--color-gray-400)] text-xs">{def.effect}</div>
                      </div>
                    </div>
                    {!maxed && <div className={`text-xs font-bold ${canAfford ? 'text-[var(--color-green)]' : 'text-[var(--color-red)]'}`}>{fmt(cost)} J</div>}
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
              <div className="text-lg font-bold gradient-text">{currentTierDef?.name}</div>
              {nextTier && <div className="text-[var(--color-gray-400)] text-xs">Next: {nextTier.emoji} {nextTier.name} ({fmt(nextTier.shardReq)} shards)</div>}
            </div>
            <div className="card box-glow-purple text-center mb-3" style={{ borderColor: 'var(--color-orange)' }}>
              <div className="text-2xl font-bold glow-orange mb-1">💎 {fmt(state.currentShards)}</div>
              <div className="text-[var(--color-gray-400)] text-xs">Lifetime: {fmt(state.lifetimeShards)} shards</div>
              {state.currentShards > 0 && (
                <div className="text-xs mt-1" style={{ color: 'var(--color-green)' }}>
                  Unspent bonus: +{shardBonusPercent.toFixed(1)}% all production
                </div>
              )}
            </div>
            {/* Explain what Impact/Shards are before first impact */}
            {state.totalPrestigeCount === 0 && (
              <div className="card mb-3 text-xs text-[var(--color-gray-400)]" style={{ lineHeight: '1.7', borderColor: 'var(--color-purple)' }}>
                <div className="font-bold text-sm mb-1 glow-purple">What is Impact?</div>
                Impact resets your mass, velocity, buildings, and energy upgrades — but rewards you with 💎 <span style={{ color: 'var(--color-orange)' }}>Shards</span>, a permanent currency.
                Use shards to unlock new tabs, buy permanent upgrades, and reach higher tiers. The more mass you earn in a run, the more shards you get!
              </div>
            )}
            <div className="card text-center mb-3">
              <div className="text-sm text-[var(--color-gray-400)] mb-2">Run mass earned: {fmtKg(state.runMassEarned)}</div>
              {canPrestige(state) ? (
                <>
                  <div className="font-bold mb-2" style={{ color: 'var(--color-green)' }}>+{fmt(calcShards(state.runMassEarned, state.currentTier))} Shards</div>
                  <button onClick={handleImpact} className="btn-primary text-lg px-6 py-3 pulse-glow"
                    style={{ background: 'linear-gradient(135deg, var(--color-orange-dim), var(--color-orange))', borderColor: 'var(--color-orange)' }}>
                    💥 IMPACT!</button>
                </>
              ) : (
                <>
                  <div className="text-[var(--color-gray-500)] text-sm mb-1">Need {fmtKg(10000)} run mass to Impact<br/>(have {fmtKg(state.runMassEarned)})</div>
                  {state.runMassEarned > 0 && (
                    <div className="text-xs" style={{ color: 'var(--color-orange)' }}>
                      Would earn: ~{fmt(calcShards(Math.max(state.runMassEarned, 10000), state.currentTier))} shards
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="section-header"><span className="text-sm text-[var(--color-gray-400)]">Tab Unlocks</span></div>
            {TAB_UNLOCKS.map(unlock => {
              const isUnlocked = state.unlockedTabs[unlock.tabId];
              const canBuy = !isUnlocked && state.currentShards >= unlock.shardCost && state.totalPrestigeCount >= unlock.requiresPrestige && !unlock.unlockViaImpact;
              const isVelocitySpecial = unlock.unlockViaImpact;
              const meetsVelocityThreshold = (unlock.velocityThreshold || 0) <= state.velocity;
              return (
                <div key={unlock.tabId} className={`card mb-2 ${isUnlocked ? 'opacity-50' : ''}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span>{unlock.emoji}</span>
                      <div>
                        <div className="text-sm font-bold">{unlock.name} {isUnlocked && '✅'}</div>
                        <div className="text-[var(--color-gray-400)] text-xs">{unlock.desc}</div>
                      </div>
                    </div>
                    {!isUnlocked && (
                      <div className="text-right">
                        {isVelocitySpecial ? (
                          meetsVelocityThreshold && !state.velocityUnlockReady ? (
                            <button onClick={handleVelocityUnlockReady} className="btn-primary text-xs">Ready!</button>
                          ) : state.velocityUnlockReady ? (
                            <span className="badge badge-green">Unlocks on Impact</span>
                          ) : (
                            <span className="text-[var(--color-gray-500)] text-xs">{fmt(state.velocity)}/{fmt(unlock.velocityThreshold || 0)} m/s</span>
                          )
                        ) : canBuy ? (
                          <button onClick={() => handleBuyTabUnlock(unlock.tabId)} className="btn-primary text-xs">💎 {fmt(unlock.shardCost)}</button>
                        ) : (
                          <div className="text-[var(--color-gray-500)] text-xs text-right" style={{ lineHeight: '1.5' }}>
                            {state.totalPrestigeCount < unlock.requiresPrestige && (
                              <div>{state.totalPrestigeCount}/{unlock.requiresPrestige} impacts</div>
                            )}
                            {unlock.shardCost > 0 && (
                              <div className={state.currentShards >= unlock.shardCost ? 'text-[var(--color-green)]' : ''}>💎 {fmt(unlock.shardCost)} shards</div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            <div className="section-header mt-4"><span className="text-sm text-[var(--color-gray-400)]">Shard Upgrades</span></div>
            {SHARD_UPGRADES.map(def => {
              const level = state.shardUpgrades[def.id] || 0;
              const maxed = level >= def.maxLevel;
              const cost = getShardUpgradeCost(def, level);
              const canBuy = !maxed && state.currentShards >= cost;
              return (
                <button key={def.id} onClick={() => handleBuyShardUpgrade(def.id)} disabled={!canBuy}
                  className={`card w-full text-left mb-2 cursor-pointer ${canBuy ? 'hover:border-[var(--color-neon)]' : 'opacity-40'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span>{def.emoji}</span>
                      <div>
                        <div className="text-sm font-bold">{def.name} <span className="text-[var(--color-gray-500)] font-normal text-xs ml-1">{maxed ? '(MAX)' : `(Lv ${level}/${def.maxLevel})`}</span></div>
                        <div className="text-[var(--color-gray-400)] text-xs">{def.effect}</div>
                      </div>
                    </div>
                    {!maxed && <div className={`text-xs font-bold ${canBuy ? 'glow-orange' : 'text-[var(--color-gray-500)]'}`}>💎 {fmt(cost)}</div>}
                  </div>
                </button>
              );
            })}
          </>
        )}

        {/* ===================== ACHIEVEMENTS TAB ===================== */}
        {state.activeTab === 'achievements' && (
          <>
            <div className="text-center mb-3"><div className="text-2xl">🏆</div><div className="text-sm text-[var(--color-gray-400)]">{state.achievements.length}/{ACHIEVEMENTS.length} unlocked</div></div>
            {ACHIEVEMENTS.filter(a => !a.hidden || state.achievements.includes(a.id)).map(def => {
              const unlocked = state.achievements.includes(def.id);
              return (
                <div key={def.id} className={`card mb-2 ${unlocked ? '' : 'opacity-30'}`}>
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{unlocked ? def.emoji : '❓'}</span>
                    <div>
                      <div className="text-sm font-bold">{unlocked ? def.name : '???'}</div>
                      <div className="text-[var(--color-gray-400)] text-xs">{unlocked ? def.desc : 'Hidden achievement'}</div>
                      {unlocked && <div className="text-xs" style={{ color: 'var(--color-green)' }}>{def.bonusDesc}</div>}
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
            <div className="text-center mb-3"><div className="text-2xl">📊</div></div>
            <div className="card" style={{ lineHeight: '2' }}>
              <div className="stat-row"><span className="text-[var(--color-gray-400)]">Total Mass Earned</span><span>{fmtKg(state.totalMassEarned)}</span></div>
              <div className="stat-row"><span className="text-[var(--color-gray-400)]">Highest Mass</span><span>{fmtKg(state.highestMass)}</span></div>
              <div className="stat-row"><span className="text-[var(--color-gray-400)]">Total Clicks</span><span>{fmt(state.totalClicks)}</span></div>
              <div className="stat-row"><span className="text-[var(--color-gray-400)]">Comets Caught</span><span>{fmt(state.cometsCaught)}</span></div>
              <div className="stat-row"><span className="text-[var(--color-gray-400)]">Total Impacts</span><span>{state.totalPrestigeCount}</span></div>
              <div className="stat-row"><span className="text-[var(--color-gray-400)]">Total Expulsions</span><span>{state.totalExpulsions}</span></div>
              <div className="stat-row"><span className="text-[var(--color-gray-400)]">Accumulations</span><span>{state.accumulationUseCount}</span></div>
              <div className="stat-row"><span className="text-[var(--color-gray-400)]">Lifetime Shards</span><span>{fmt(state.lifetimeShards)}</span></div>
              <div className="stat-row"><span className="text-[var(--color-gray-400)]">Play Time</span><span>{fmtTime(state.totalPlayTime)}</span></div>
              <div className="stat-row"><span className="text-[var(--color-gray-400)]">Run Time</span><span>{fmtTime(state.runTime)}</span></div>
              {state.fastestPrestige < Infinity && <div className="stat-row"><span className="text-[var(--color-gray-400)]">Fastest Impact</span><span>{fmtTime(state.fastestPrestige)}</span></div>}
              <div className="stat-row"><span className="text-[var(--color-gray-400)]">Best Combo</span><span>x{fmt(state.maxComboReached)}</span></div>
            </div>
            <div className="card mt-4">
              <div className="section-header"><span className="text-sm">⚙️</span><span className="font-bold text-sm">Settings</span></div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-sm text-[var(--color-gray-400)]">🎵 Music</span>
                <button onClick={() => setState({ ...state, musicEnabled: !state.musicEnabled })}
                  className={`text-xs px-3 py-1 rounded ${state.musicEnabled ? 'btn-primary' : 'btn-secondary'}`}>
                  {state.musicEnabled ? 'ON' : 'OFF'}
                </button>
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-sm text-[var(--color-gray-400)]">🔊 Sound Effects</span>
                <button onClick={() => setState({ ...state, soundEnabled: !state.soundEnabled })}
                  className={`text-xs px-3 py-1 rounded ${state.soundEnabled ? 'btn-primary' : 'btn-secondary'}`}>
                  {state.soundEnabled ? 'ON' : 'OFF'}
                </button>
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-sm text-[var(--color-gray-400)]">✨ Space Dust</span>
                <button onClick={() => setState({ ...state, spaceDustEnabled: !state.spaceDustEnabled })}
                  className={`text-xs px-3 py-1 rounded ${state.spaceDustEnabled ? 'btn-primary' : 'btn-secondary'}`}>
                  {state.spaceDustEnabled ? 'ON' : 'OFF'}
                </button>
              </div>
            </div>
            <div className="card mt-3">
              <div className="section-header"><span className="text-sm">💬</span><span className="font-bold text-sm">Feedback</span></div>
              <div className="flex gap-2 mt-2 mb-2">
                {([['bug', '🐛 Bug'], ['suggestion', '💡 Idea'], ['praise', '🎉 Praise']] as const).map(([cat, label]) => (
                  <button key={cat} onClick={() => setFeedbackCategory(cat as any)}
                    className={`flex-1 text-xs py-1 rounded ${feedbackCategory === cat ? 'btn-primary' : 'btn-secondary'}`}>{label}</button>
                ))}
              </div>
              <textarea value={feedbackText} onChange={e => setFeedbackText(e.target.value)}
                className="w-full rounded p-2 text-xs h-16 mb-2" style={{ background: 'var(--color-space)', border: '1px solid var(--color-gray-700)', color: '#e0e0ff' }}
                placeholder="Tell us what you think..." />
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs text-[var(--color-gray-400)]">Rating:</span>
                {[1,2,3,4,5].map(r => (
                  <button key={r} onClick={() => setFeedbackRating(r)}
                    className="text-sm" style={{ color: r <= feedbackRating ? 'var(--color-yellow)' : 'var(--color-gray-600)' }}>★</button>
                ))}
              </div>
              <button onClick={handleSubmitFeedback} className="btn-primary w-full text-xs" disabled={!feedbackText.trim() || feedbackRating === 0}>
                {feedbackSent ? '✅ Sent! Thanks!' : '📨 Send Feedback'}
              </button>
            </div>
            <div className="space-y-2 mt-4">
              <button onClick={() => saveGame(stateRef.current)} className="btn-secondary w-full">💾 Save Now</button>
              <button onClick={() => setShowImportExport(!showImportExport)} className="btn-secondary w-full">📦 Import / Export</button>
              {showImportExport && (
                <div className="card space-y-2">
                  <button onClick={handleExport} className="btn-primary w-full">Export (copy to clipboard)</button>
                  <textarea value={importCode} onChange={e => setImportCode(e.target.value)}
                    className="w-full rounded p-2 text-xs h-20" style={{ background: 'var(--color-space)', border: '1px solid var(--color-gray-700)', color: '#e0e0ff' }}
                    placeholder="Paste save code here..." />
                  <button onClick={handleImport} className="btn-primary w-full" style={{ background: 'linear-gradient(135deg, #006644, var(--color-green))', borderColor: 'var(--color-green)' }}>Import</button>
                </div>
              )}
              <button onClick={() => setShowResetConfirm(true)} className="btn-danger w-full">🗑️ Hard Reset</button>
              {showResetConfirm && (
                <div className="card" style={{ borderColor: 'var(--color-red)' }}>
                  <div className="text-[var(--color-red)] text-sm font-bold mb-2">Are you sure? This deletes EVERYTHING.</div>
                  <div className="flex gap-2">
                    <button onClick={() => setShowResetConfirm(false)} className="btn-secondary flex-1">Cancel</button>
                    <button onClick={handleHardReset} className="btn-danger flex-1">DELETE ALL</button>
                  </div>
                </div>
              )}
              {!state.devMode && (
                <div className="flex gap-2">
                  <input type="password" value={devPasscode} onChange={e => setDevPasscode(e.target.value)}
                    className="flex-1 rounded px-2 py-1 text-xs" style={{ background: 'var(--color-space-lighter)', border: '1px solid var(--color-gray-700)', color: '#e0e0ff' }}
                    placeholder="Dev passcode" />
                  <button onClick={handleDevPasscode} className="btn-secondary text-xs">Go</button>
                </div>
              )}
            </div>
          </>
        )}

        {/* ===================== IMPATIENT TAB ===================== */}
        {state.activeTab === 'impatient' && (
          <>
            <div className="text-center mb-3">
              <div className="text-3xl mb-1">⏩</div>
              <div className="text-lg font-bold gradient-text">Impatient</div>
              <div className="text-[var(--color-gray-400)] text-xs">Can&apos;t wait? Skip ahead with ads.</div>
            </div>
            {state.currentShards > 0 && (
              <div className="card mb-3 text-center text-xs" style={{ borderColor: 'var(--color-green)' }}>
                <span style={{ color: 'var(--color-green)' }}>💎 Unspent Shard Bonus: +{shardBonusPercent.toFixed(1)}% all production</span>
                <div className="text-[var(--color-gray-500)] mt-1">({fmt(state.currentShards)} shards × 0.1% each — consider saving!)</div>
              </div>
            )}
            {(() => {
              const isLockedOut = state.impatientStep >= 3;
              const lockoutRemaining = isLockedOut ? Math.max(0, (state.impatientLockoutEndsAt - Date.now()) / 1000) : 0;
              const steps = [
                { label: '30 Minutes', minutes: 30, emoji: '⏱️', desc: 'Get 30 min of current production instantly.' },
                { label: '1 Hour', minutes: 60, emoji: '⏰', desc: 'Get 1 hour of current production instantly.' },
                { label: '90 Minutes', minutes: 90, emoji: '🕐', desc: 'Get 90 min of current production instantly.' },
              ];
              return (
                <div className="space-y-3">
                  {steps.map((step, i) => {
                    const isCurrentStep = state.impatientStep === i;
                    const isDone = state.impatientStep > i && !isLockedOut;
                    const isLocked = i > state.impatientStep || isLockedOut;
                    const massDrop = prod.massPerSec * step.minutes * 60;
                    const velDrop = prod.velocityPerSec * step.minutes * 60;
                    const energyDrop = prod.energyPerSec * step.minutes * 60;
                    return (
                      <div key={i} className={`card ${isCurrentStep ? 'box-glow-cyan' : isDone ? 'opacity-40' : isLocked ? 'opacity-30' : ''}`}
                        style={isCurrentStep ? { borderColor: 'var(--color-neon)' } : {}}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">{step.emoji}</span>
                            <div>
                              <div className="text-sm font-bold">{step.label} {isDone && '✅'}</div>
                              <div className="text-[var(--color-gray-400)] text-xs">{step.desc}</div>
                            </div>
                          </div>
                          {isDone && <span className="badge badge-green">Claimed</span>}
                          {isLocked && !isDone && !isLockedOut && <span className="text-[var(--color-gray-500)] text-xs">🔒 Claim previous first</span>}
                        </div>
                        {isCurrentStep && (
                          <div>
                            <div className="text-xs text-[var(--color-gray-400)] mb-2" style={{ lineHeight: '1.6' }}>
                              {massDrop > 0 && <span>+{fmtKg(massDrop)} mass </span>}
                              {velDrop > 0 && <span>+{fmt(velDrop)} vel </span>}
                              {energyDrop > 0 && <span>+{fmt(energyDrop)} energy</span>}
                            </div>
                            <button onClick={handleImpatientAd} className="btn-primary w-full">
                              {state.adsRemoved ? '⏩ Collect!' : '📺 Watch Ad'}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {isLockedOut && (
                    <div className="card text-center" style={{ borderColor: 'var(--color-red)' }}>
                      <div className="text-lg mb-1">🔒</div>
                      <div className="text-sm font-bold" style={{ color: 'var(--color-red)' }}>Locked — Cooldown Active</div>
                      <div className="text-[var(--color-gray-400)] text-xs mt-1">Resets in {fmtTime(lockoutRemaining)}</div>
                      <div className="resource-bar mt-2" style={{ height: '6px' }}>
                        <div className="resource-bar-fill" style={{ width: `${Math.max(0, 100 - (lockoutRemaining / (90 * 60)) * 100)}%`, background: 'var(--color-red)' }} />
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </>
        )}

        {/* ===================== DEV TAB ===================== */}
        {state.activeTab === 'dev' && state.devMode && (
          <>
            <div className="text-center mb-3"><div className="text-2xl">🔧</div><div className="text-sm" style={{ color: 'var(--color-red)' }}>Developer Mode</div></div>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setState({ ...stateRef.current, mass: stateRef.current.mass + 1000000 })} className="btn-secondary text-xs">+1M Mass</button>
              <button onClick={() => setState({ ...stateRef.current, velocity: stateRef.current.velocity + 1000 })} className="btn-secondary text-xs">+1K Velocity</button>
              <button onClick={() => setState({ ...stateRef.current, energy: stateRef.current.energy + 10000 })} className="btn-secondary text-xs">+10K Energy</button>
              <button onClick={() => setState({ ...stateRef.current, currentShards: stateRef.current.currentShards + 100, lifetimeShards: stateRef.current.lifetimeShards + 100 })} className="btn-secondary text-xs">+100 Shards</button>
              <button onClick={() => { const s = stateRef.current; setState({ ...s, mass: s.mass + 1e12, totalMassEarned: s.totalMassEarned + 1e12, runMassEarned: s.runMassEarned + 1e12 }); }} className="btn-secondary text-xs">+1T Mass (run)</button>
              <button onClick={() => setState({ ...stateRef.current, expulsionCooldown: 0 })} className="btn-secondary text-xs">Reset Cooldown</button>
              <button onClick={() => { const s = stateRef.current; const all: Record<string, boolean> = {}; TAB_UNLOCKS.forEach(t => all[t.tabId] = true); setState({ ...s, unlockedTabs: { ...s.unlockedTabs, ...all } }); }} className="btn-secondary text-xs col-span-2">Unlock All Tabs</button>
              <button onClick={() => { const s = stateRef.current; setState({ ...s, productionAdAvailable: true, shardDoubleAdAvailable: true, shardDoubleActive: false, massDropAdAvailable: true, shardPopupAvailable: true, shardPopupExpiresIn: 60, velocityPopupAvailable: true, velocityPopupExpiresIn: 60 }); }} className="btn-secondary text-xs col-span-2">Force All Ads</button>
              <button onClick={() => setState({ ...stateRef.current, adsRemoved: !stateRef.current.adsRemoved })} className="btn-secondary text-xs col-span-2">Toggle No Ads ({stateRef.current.adsRemoved ? 'ON' : 'OFF'})</button>
            </div>
            <div className="text-[var(--color-gray-600)] text-xs mt-3 text-center">v13.4 — 5-ad system</div>
          </>
        )}
      </div>
    </div>
  );
}

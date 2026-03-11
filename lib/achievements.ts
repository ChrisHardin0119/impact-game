import { AchievementDef, GameState } from './types';
import { getDensity } from './buildings';

export const ACHIEVEMENTS: AchievementDef[] = [
  // === VISIBLE ACHIEVEMENTS ===
  {
    id: 'first_steps',
    name: 'First Steps',
    emoji: '👣',
    desc: 'Mine your first 100 Kg of mass.',
    bonusDesc: '+1% mass production',
    hidden: false,
    check: (s) => s.totalMassEarned >= 100,
  },
  {
    id: 'heavy_metal',
    name: 'Heavy Metal',
    emoji: '🎸',
    desc: 'Own 10 Iron Fragment deposits.',
    bonusDesc: '+2% metal production',
    hidden: false,
    check: (s) => (s.metals['iron_fragments'] || 0) >= 10,
  },
  {
    id: 'getting_dense',
    name: 'Getting Dense',
    emoji: '🧊',
    desc: 'Reach 100 density.',
    bonusDesc: '+1% density rate',
    hidden: false,
    check: (s) => getDensity(s) >= 100,
  },
  {
    id: 'getting_moving',
    name: 'Getting Moving',
    emoji: '💨',
    desc: 'Reach 10 velocity.',
    bonusDesc: '+1% velocity production',
    hidden: false,
    check: (s) => s.velocity >= 10,
  },
  {
    id: 'powered_up',
    name: 'Powered Up',
    emoji: '⚡',
    desc: 'Earn your first energy.',
    bonusDesc: '+1% energy production',
    hidden: false,
    check: (s) => s.energy >= 1,
  },
  {
    id: 'millionaire',
    name: 'Millionaire',
    emoji: '💰',
    desc: 'Accumulate 1,000,000 Kg of mass.',
    bonusDesc: '+1% click power',
    hidden: false,
    check: (s) => s.mass >= 1000000,
  },
  {
    id: 'speed_demon',
    name: 'Speed Demon',
    emoji: '🏎️',
    desc: 'Reach 1,000 velocity.',
    bonusDesc: '+2% velocity production',
    hidden: false,
    check: (s) => s.velocity >= 1000,
  },
  {
    id: 'dense_core',
    name: 'Dense Core',
    emoji: '🌑',
    desc: 'Reach 10,000 density.',
    bonusDesc: '+2% density rate',
    hidden: false,
    check: (s) => getDensity(s) >= 10000,
  },
  {
    id: 'impact_survivor',
    name: 'Impact Survivor',
    emoji: '💥',
    desc: 'Complete your first Impact.',
    bonusDesc: '+5% shard gain',
    hidden: false,
    check: (s) => s.totalPrestigeCount >= 1,
  },
  {
    id: 'serial_impactor',
    name: 'Serial Impactor',
    emoji: '💥💥',
    desc: 'Complete 10 Impacts.',
    bonusDesc: '+10% shard gain',
    hidden: false,
    check: (s) => s.totalPrestigeCount >= 10,
  },
  {
    id: 'energy_mogul',
    name: 'Energy Mogul',
    emoji: '🔋',
    desc: 'Accumulate 1,000 energy.',
    bonusDesc: '+2% energy production',
    hidden: false,
    check: (s) => s.energy >= 1000,
  },
  {
    id: 'click_master',
    name: 'Click Master',
    emoji: '👆',
    desc: 'Click 1,000 times.',
    bonusDesc: '+3% click power',
    hidden: false,
    check: (s) => s.totalClicks >= 1000,
  },
  {
    id: 'comet_catcher',
    name: 'Comet Catcher',
    emoji: '☄️',
    desc: 'Catch 50 comets.',
    bonusDesc: '+5% comet value',
    hidden: false,
    check: (s) => s.cometsCaught >= 50,
  },
  {
    id: 'marathon_runner',
    name: 'Marathon Runner',
    emoji: '🏃',
    desc: 'Play for 1 hour total.',
    bonusDesc: '+1% all production',
    hidden: false,
    check: (s) => s.totalPlayTime >= 3600,
  },
  {
    id: 'converter_pro',
    name: 'Converter Pro',
    emoji: '🔄',
    desc: 'Use the converter 25 times.',
    bonusDesc: '+3% conversion rate',
    hidden: false,
    check: (s) => s.converterUseCount >= 25,
  },

  // === HIDDEN / SILLY ACHIEVEMENTS ===
  {
    id: 'double_tap',
    name: 'Double Tap',
    emoji: '⚡',
    desc: 'Click 50 times in 10 seconds.',
    bonusDesc: '+1% click speed',
    hidden: true,
    check: (s) => s.maxComboReached >= 50,
  },
  {
    id: 'broke',
    name: 'Broke',
    emoji: '🫠',
    desc: 'Have exactly 0 mass after your first Impact.',
    bonusDesc: 'Bragging rights (+0.1% mass)',
    hidden: true,
    check: (s) => s.mass === 0 && s.totalPrestigeCount >= 1,
  },
  {
    id: 'tab_surfer',
    name: 'Tab Surfer',
    emoji: '🏄',
    desc: 'Switch tabs 100 times in one session.',
    bonusDesc: '+0.5% all production',
    hidden: true,
    check: (s) => s.tabSwitchCount >= 100,
  },
  {
    id: 'patience',
    name: 'Patience',
    emoji: '🧘',
    desc: 'Wait 5 minutes without clicking.',
    bonusDesc: '+2% idle production',
    hidden: true,
    check: (s) => s.idleStreak >= 300,
  },
  {
    id: 'all_in',
    name: 'All In',
    emoji: '🎲',
    desc: 'Convert all of one resource to another.',
    bonusDesc: '+3% conversion rate',
    hidden: true,
    check: (s) => s.converterUseCount > 0 && (s.mass === 0 || s.velocity === 0),
  },
  {
    id: 'billionaire',
    name: 'Billionaire',
    emoji: '🤑',
    desc: 'Accumulate 1 billion Kg of mass.',
    bonusDesc: '+2% all production',
    hidden: true,
    check: (s) => s.mass >= 1000000000,
  },
];

// Get achievement bonus multipliers
export function getAchievementEffects(state: GameState): {
  massMult: number;
  densityMult: number;
  velocityMult: number;
  energyMult: number;
  clickMult: number;
  shardMult: number;
  cometMult: number;
  conversionMult: number;
  allMult: number;
} {
  const a = state.achievements;
  let mass = 1, density = 1, velocity = 1, energy = 1, click = 1, shard = 1, comet = 1, conversion = 1, all = 1;

  if (a.includes('first_steps'))     mass *= 1.01;
  if (a.includes('heavy_metal'))     mass *= 1.02;
  if (a.includes('getting_dense'))   density *= 1.01;
  if (a.includes('getting_moving'))  velocity *= 1.01;
  if (a.includes('powered_up'))      energy *= 1.01;
  if (a.includes('millionaire'))     click *= 1.01;
  if (a.includes('speed_demon'))     velocity *= 1.02;
  if (a.includes('dense_core'))      density *= 1.02;
  if (a.includes('impact_survivor')) shard *= 1.05;
  if (a.includes('serial_impactor')) shard *= 1.10;
  if (a.includes('energy_mogul'))    energy *= 1.02;
  if (a.includes('click_master'))    click *= 1.03;
  if (a.includes('comet_catcher'))   comet *= 1.05;
  if (a.includes('marathon_runner')) all *= 1.01;
  if (a.includes('converter_pro'))   conversion *= 1.03;
  if (a.includes('double_tap'))      click *= 1.01;
  if (a.includes('broke'))           mass *= 1.001;
  if (a.includes('tab_surfer'))      all *= 1.005;
  if (a.includes('patience'))        all *= 1.02;
  if (a.includes('all_in'))          conversion *= 1.03;
  if (a.includes('billionaire'))     all *= 1.02;

  return { massMult: mass, densityMult: density, velocityMult: velocity, energyMult: energy, clickMult: click, shardMult: shard, cometMult: comet, conversionMult: conversion, allMult: all };
}

// Check all achievements and return newly unlocked ones
export function checkAchievements(state: GameState): AchievementDef[] {
  const newAchievements: AchievementDef[] = [];
  for (const def of ACHIEVEMENTS) {
    if (!state.achievements.includes(def.id) && def.check(state)) {
      newAchievements.push(def);
    }
  }
  return newAchievements;
}

import { GameState } from './types';

export interface TutorialStep {
  id: string;
  title: string;
  message: string;
  emoji: string;
  phase: 'walkthrough' | 'contextual';
  // For walkthrough: step order
  order?: number;
  // For contextual: condition to trigger
  condition?: (state: GameState) => boolean;
  // Which element to highlight (CSS selector or area name)
  highlight?: string;
}

// Phase 1: Guided walkthrough for new players
export const WALKTHROUGH_STEPS: TutorialStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to Impact!',
    message: 'You are a cosmic force guiding an asteroid through space. Grow it from a humble rock into a black hole! Let\'s learn the basics.',
    emoji: '🌟',
    phase: 'walkthrough',
    order: 0,
  },
  {
    id: 'mass_intro',
    title: 'This is Mass',
    message: 'Mass is your main resource. You need it to buy everything. Click the asteroid or buy processes to generate mass automatically.',
    emoji: '🪨',
    phase: 'walkthrough',
    order: 1,
    highlight: 'mass',
  },
  {
    id: 'gravity_intro',
    title: 'Gravity Powers You Up',
    message: 'Gravity acts as a multiplier on your production. From 0-50 it goes from 0.5x to 1.0x, and above 100 it climbs to 2.0x. Processes generate gravity over time.',
    emoji: '🌌',
    phase: 'walkthrough',
    order: 2,
    highlight: 'gravity',
  },
  {
    id: 'density_intro',
    title: 'Density is Stability',
    message: 'Density also multiplies your output but it slowly decays! Keep it high with processes that generate density. Above 50% gives a bonus, below 50% is a penalty.',
    emoji: '💎',
    phase: 'walkthrough',
    order: 3,
    highlight: 'density',
  },
  {
    id: 'click_intro',
    title: 'Click to Mine',
    message: 'Click the asteroid to earn mass! Each click grows stronger as you progress. You\'ll try it once we finish the tutorial.',
    emoji: '👆',
    phase: 'walkthrough',
    order: 4,
    highlight: 'asteroid',
  },
  {
    id: 'composition_intro',
    title: 'Choose Your Composition',
    message: 'Compositions define your playstyle. Silicate boosts synergies, Iron is aggressive with strong gravity, Ice gives comet events, and Carbonaceous is flexible. Pick one that sounds fun!',
    emoji: '🧬',
    phase: 'walkthrough',
    order: 5,
    highlight: 'composition',
  },
  {
    id: 'process_intro',
    title: 'Buy Processes',
    message: 'Processes automatically generate mass, gravity, and density every second. Some have synergy bonuses — buy related processes together for extra power!',
    emoji: '⚙️',
    phase: 'walkthrough',
    order: 6,
    highlight: 'processes',
  },
  {
    id: 'multipliers_intro',
    title: 'Watch Your Multipliers',
    message: 'The gravity and density multipliers show as colored numbers (green = bonus, red = penalty). Keep both high for maximum mass/s! You\'re ready to grow.',
    emoji: '📈',
    phase: 'walkthrough',
    order: 7,
    highlight: 'multipliers',
  },
];

// Phase 2: Contextual hints triggered by milestones
export const CONTEXTUAL_HINTS: TutorialStep[] = [
  {
    id: 'hint_first_orbital',
    title: 'Orbital Mechanics Unlocked!',
    message: 'You can now use active abilities that cost energy. Check the Orbital tab — Gravitational Focus gives 50% more mass and gravity for 15 seconds!',
    emoji: '🚀',
    phase: 'contextual',
    condition: (state) => state.energy >= 20 && Object.keys(state.processes).length >= 2,
  },
  {
    id: 'hint_first_prestige',
    title: 'Prestige Available!',
    message: 'You can prestige to earn shards! Shards buy permanent upgrades that persist through resets. The more mass you earn before prestiging, the more shards you get.',
    emoji: '💎',
    phase: 'contextual',
    condition: (state) => state.runMassEarned >= 1000000,
  },
  {
    id: 'hint_first_upgrade',
    title: 'Core Upgrades',
    message: 'You have shards to spend! Check the Upgrades tab for permanent bonuses. Start with the Foundation path for the best early boost.',
    emoji: '⬆️',
    phase: 'contextual',
    condition: (state) => state.currentShards >= 10,
  },
  {
    id: 'hint_density_warning',
    title: 'Density Dropping!',
    message: 'Your density is below 25% — that\'s hurting your production! Buy processes that generate density, or use Density Compression from the Orbital tab.',
    emoji: '⚠️',
    phase: 'contextual',
    condition: (state) => state.density < 25 && state.density > 0 && Object.keys(state.processes).length >= 3,
  },
  {
    id: 'hint_discovery',
    title: 'Discoveries Await!',
    message: 'There are hidden discoveries to find. Check the Discover tab for hints. Combining certain processes or abilities unlocks permanent bonuses!',
    emoji: '🔍',
    phase: 'contextual',
    condition: (state) => state.totalPlayTime > 300 && state.discoveries.length === 0,
  },
];

export const ALL_TUTORIAL_STEPS = [...WALKTHROUGH_STEPS, ...CONTEXTUAL_HINTS];

/**
 * Check which contextual hints should trigger
 */
export function checkContextualHints(state: GameState): TutorialStep[] {
  if (state.tutorialSkipped) return [];

  return CONTEXTUAL_HINTS.filter(
    hint =>
      !state.tutorialCompleted.includes(hint.id) &&
      hint.condition &&
      hint.condition(state),
  );
}

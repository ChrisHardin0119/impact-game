import { ConverterDef, GameState } from './types';
import { DENSITY_RATIO, MASS_PER_DENSITY, getDensity } from './buildings';

export const CONVERTERS: ConverterDef[] = [
  {
    id: 'mass_to_velocity',
    from: 'mass',
    to: 'velocity',
    name: 'Mass → Velocity',
    emoji: '🪨➡️💨',
    rate: 0.0001, // 10,000 mass = 1 velocity
  },
  {
    id: 'density_to_velocity',
    from: 'density',
    to: 'velocity',
    name: 'Density → Velocity',
    emoji: '🧊➡️💨',
    rate: 2, // 1 density = 2 velocity (but costs 1000 mass)
  },
  {
    id: 'velocity_to_mass',
    from: 'velocity',
    to: 'mass',
    name: 'Velocity → Mass',
    emoji: '💨➡️🪨',
    rate: 5000, // 1 velocity = 5,000 mass
  },
];

function getResourceValue(state: GameState, resource: 'mass' | 'density' | 'velocity'): number {
  if (resource === 'mass') return state.mass;
  if (resource === 'density') return getDensity(state); // derived from mass
  return state.velocity;
}

// Convert a given amount of one resource to another
// Returns: { newState, massJettisoned } where massJettisoned shows how much mass was really spent
export function executeConversion(
  state: GameState,
  converter: ConverterDef,
  amount: number,
): { state: GameState; massJettisoned: number } | null {
  const available = getResourceValue(state, converter.from);
  if (amount <= 0 || amount > available) return null;

  const gained = amount * converter.rate;
  const newState = { ...state, converterUseCount: state.converterUseCount + 1 };
  let massJettisoned = 0;

  // Deduct from source
  if (converter.from === 'mass') {
    newState.mass -= amount;
    massJettisoned = amount;
  } else if (converter.from === 'density') {
    // Spending density = spending mass (same pool)
    const massCost = amount * MASS_PER_DENSITY;
    newState.mass -= massCost;
    massJettisoned = massCost;
  } else {
    newState.velocity -= amount;
  }

  // Add to destination
  if (converter.to === 'mass') {
    newState.mass += gained;
  } else if (converter.to === 'velocity') {
    newState.velocity += gained;
  }

  // Clamp
  newState.mass = Math.max(0, newState.mass);
  newState.velocity = Math.max(0, newState.velocity);

  // Sync density from mass
  newState.density = newState.mass * DENSITY_RATIO;

  return { state: newState, massJettisoned };
}

export function getConvertPresets(available: number): number[] {
  return [
    Math.floor(available * 0.1),
    Math.floor(available * 0.25),
    Math.floor(available * 0.5),
    Math.floor(available),
  ];
}

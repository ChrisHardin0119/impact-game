'use client';

import { GameState } from '@/lib/types';
import { BOOST_DEFS, BoostType, isBoostActive, getBoostTimeRemaining, getMassDropCooldown } from '@/lib/boosts';
import { fmtTime } from '@/lib/format';

interface Props {
  state: GameState;
  onActivateBoost: (type: BoostType) => void;
}

export default function BoostBar({ state, onActivateBoost }: Props) {
  return (
    <div className="flex gap-2 px-3 sm:px-4 py-2 bg-space-light border-b border-gray-700 safe-x">
      {BOOST_DEFS.map(boost => {
        const active = isBoostActive(boost.id, state);
        const timeLeft = getBoostTimeRemaining(boost.id, state);
        const cooldown = boost.id === 'massDrop' ? getMassDropCooldown(state) : 0;
        const canUse = !active && cooldown <= 0 && !(boost.id === 'prestigeDouble' && state.boosts.prestigeDouble.active);
        const label = state.adsRemoved ? boost.freeLabel : boost.adLabel;

        return (
          <button
            key={boost.id}
            className={`flex-1 rounded px-2 py-2 text-sm border transition-all min-h-[52px] ${
              active
                ? 'border-purple bg-purple/20 text-purple'
                : canUse
                  ? 'border-gray-700 bg-space-lighter text-gray-300 hover:border-neon hover:text-neon'
                  : 'border-gray-700 bg-space-lighter text-gray-600 opacity-50'
            }`}
            onClick={() => canUse && onActivateBoost(boost.id)}
            disabled={!canUse}
          >
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-sm">{boost.emoji}</span>
              <span className="font-bold text-xs leading-tight">{boost.name}</span>
              {active && timeLeft > 0 && (
                <span className="text-xs text-purple">{fmtTime(timeLeft)}</span>
              )}
              {active && boost.id === 'prestigeDouble' && (
                <span className="text-xs text-purple">Queued</span>
              )}
              {cooldown > 0 && (
                <span className="text-xs text-red">{fmtTime(cooldown)}</span>
              )}
              {!active && cooldown <= 0 && (
                <span className="text-xs text-gray-500">{label}</span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

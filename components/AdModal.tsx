'use client';

import { useState, useEffect, useRef } from 'react';
import { BoostType, BOOST_DEFS } from '@/lib/boosts';
import { isNativePlatform, showRewardedAd } from '@/lib/adMobBridge';

interface Props {
  boostType: BoostType;
  onComplete: () => void;
  onCancel: () => void;
}

export default function AdModal({ boostType, onComplete, onCancel }: Props) {
  const [countdown, setCountdown] = useState(5);
  const [nativeAdState, setNativeAdState] = useState<'loading' | 'showing' | 'done'>('loading');
  const boost = BOOST_DEFS.find(b => b.id === boostType);
  const attemptedNative = useRef(false);

  // On native platforms, show a real AdMob rewarded ad
  useEffect(() => {
    if (!isNativePlatform() || attemptedNative.current) return;
    attemptedNative.current = true;

    setNativeAdState('showing');
    showRewardedAd().then((rewarded) => {
      setNativeAdState('done');
      if (rewarded) {
        onComplete();
      } else {
        onCancel();
      }
    });
  }, [onComplete, onCancel]);

  // On web, use the countdown placeholder
  useEffect(() => {
    if (isNativePlatform()) return;
    if (countdown <= 0) {
      onComplete();
      return;
    }
    const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown, onComplete]);

  if (!boost) return null;

  // On native, show a minimal loading screen while ad loads
  if (isNativePlatform()) {
    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 px-4">
        <div className="card max-w-sm w-full text-center mx-4">
          <div className="text-4xl mb-2">{boost.emoji}</div>
          <div className="text-sm text-gray-400 mb-4">
            {nativeAdState === 'loading' ? 'Loading ad...' : 'Playing ad...'}
          </div>
          <div className="text-xs text-gray-500 animate-pulse">
            Complete the ad to earn your boost!
          </div>
        </div>
      </div>
    );
  }

  // Web placeholder UI
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 px-4">
      <div className="card max-w-sm w-full text-center mx-4">
        <div className="text-xs text-gray-500 mb-2">AD PLACEHOLDER</div>
        <div className="bg-space-lighter border border-gray-700 rounded p-6 mb-4">
          <div className="text-4xl mb-2">{boost.emoji}</div>
          <div className="text-sm text-gray-400">
            Watch to earn: <span className="text-neon font-bold">{boost.name}</span>
          </div>
          <div className="text-xs text-gray-500 mt-1">{boost.desc}</div>
        </div>
        <div className="text-lg font-bold glow-cyan mb-4">
          {countdown > 0 ? `${countdown}s remaining...` : 'Reward ready!'}
        </div>
        <div className="resource-bar mb-4">
          <div
            className="resource-bar-fill bg-neon"
            style={{ width: `${((5 - countdown) / 5) * 100}%` }}
          />
        </div>
        <button
          className="text-xs text-gray-600 hover:text-gray-400"
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

'use client';

import { useState, useCallback } from 'react';
import { WALKTHROUGH_STEPS, TutorialStep } from '@/lib/tutorial';

interface Props {
  currentStep: number;
  onNext: () => void;
  onSkip: () => void;
}

export default function TutorialOverlay({ currentStep, onNext, onSkip }: Props) {
  const step = WALKTHROUGH_STEPS[currentStep];
  if (!step) return null;

  const isLast = currentStep >= WALKTHROUGH_STEPS.length - 1;
  const progress = ((currentStep + 1) / WALKTHROUGH_STEPS.length) * 100;

  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center pointer-events-none">
      {/* Dark overlay */}
      <div className="absolute inset-0 bg-black/60 pointer-events-auto" onClick={onNext} />

      {/* Tutorial card */}
      <div className="relative z-50 mx-4 mb-4 sm:mb-0 max-w-md w-full pointer-events-auto">
        <div className="bg-space-light border border-neon rounded-lg p-4 shadow-lg box-glow-cyan">
          {/* Progress bar */}
          <div className="w-full h-1 bg-gray-700 rounded mb-3">
            <div
              className="h-1 bg-neon rounded transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Step content */}
          <div className="flex items-start gap-3">
            <span className="text-2xl shrink-0">{step.emoji}</span>
            <div className="flex-1 min-w-0">
              <h3 className="glow-cyan font-bold text-sm">{step.title}</h3>
              <p className="text-xs text-gray-300 mt-1 leading-relaxed">{step.message}</p>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-between mt-4">
            <button
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
              onClick={onSkip}
            >
              Skip Tutorial
            </button>
            <button
              className="btn-primary text-sm"
              onClick={onNext}
            >
              {isLast ? 'Start Playing!' : 'Next'}
            </button>
          </div>

          {/* Step counter */}
          <div className="text-center text-xs text-gray-500 mt-2">
            {currentStep + 1} / {WALKTHROUGH_STEPS.length}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Smaller contextual hint component for milestone-triggered tips
 */
export function ContextualHint({
  step,
  onDismiss,
}: {
  step: TutorialStep;
  onDismiss: () => void;
}) {
  return (
    <div className="fixed bottom-16 left-3 right-3 sm:left-auto sm:right-4 sm:bottom-4 sm:w-80 z-40">
      <div className="bg-space-lighter border border-orange rounded-lg p-3 shadow-lg">
        <div className="flex items-start gap-2">
          <span className="text-lg shrink-0">{step.emoji}</span>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-bold text-orange">{step.title}</h4>
            <p className="text-sm text-gray-300 mt-1 leading-relaxed">{step.message}</p>
          </div>
          <button
            className="text-gray-400 hover:text-gray-200 text-2xl shrink-0 leading-none min-w-[32px] min-h-[32px] flex items-center justify-center"
            onClick={onDismiss}
          >
            ×
          </button>
        </div>
      </div>
    </div>
  );
}

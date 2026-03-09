'use client';

import { useState } from 'react';
import { FeedbackCategory, FeedbackPayload, submitFeedback, buildGameSnapshot } from '@/lib/feedback';
import { GameState } from '@/lib/types';

interface Props {
  state: GameState;
  onClose?: () => void;
  onSubmit: (success: boolean) => void;
  inline?: boolean; // true = in Stats tab (no close button)
}

const CATEGORIES: { id: FeedbackCategory; label: string; emoji: string }[] = [
  { id: 'bug', label: 'Bug', emoji: '🐛' },
  { id: 'suggestion', label: 'Suggestion', emoji: '💡' },
  { id: 'praise', label: 'Praise', emoji: '🎉' },
];

export default function FeedbackForm({ state, onClose, onSubmit, inline = false }: Props) {
  const [category, setCategory] = useState<FeedbackCategory>('suggestion');
  const [text, setText] = useState('');
  const [rating, setRating] = useState(0);
  const [includeGameInfo, setIncludeGameInfo] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!text.trim() || rating === 0) return;
    setSubmitting(true);
    const payload: FeedbackPayload = {
      text: text.trim(),
      rating,
      category,
      timestamp: Date.now(),
    };
    if (includeGameInfo) {
      payload.gameSnapshot = buildGameSnapshot(state);
    }
    const success = await submitFeedback(payload);
    setSubmitting(false);
    onSubmit(success);
    if (success) {
      setText('');
      setRating(0);
    }
  };

  const content = (
    <div className={inline ? '' : 'p-4'}>
      {!inline && (
        <div className="flex justify-between items-center mb-3">
          <h3 className="glow-cyan font-bold text-sm">Send Feedback</h3>
          <button className="text-gray-500 hover:text-gray-300 text-lg" onClick={onClose}>×</button>
        </div>
      )}

      {/* Category */}
      <div className="flex gap-1.5 mb-3">
        {CATEGORIES.map(c => (
          <button
            key={c.id}
            className={`flex-1 text-xs py-1.5 rounded border transition-colors ${
              category === c.id
                ? 'border-neon bg-neon/10 text-neon'
                : 'border-gray-700 text-gray-400 hover:border-gray-500'
            }`}
            onClick={() => setCategory(c.id)}
          >
            {c.emoji} {c.label}
          </button>
        ))}
      </div>

      {/* Text area */}
      <textarea
        className="w-full bg-space-lighter border border-gray-700 rounded p-2 text-sm text-white placeholder-gray-600 resize-none focus:border-neon focus:outline-none"
        rows={3}
        placeholder="Tell us what you think..."
        value={text}
        onChange={e => setText(e.target.value)}
        maxLength={500}
      />
      <div className="text-xs text-gray-600 text-right mt-0.5">{text.length}/500</div>

      {/* Star rating */}
      <div className="flex items-center gap-1 my-2">
        <span className="text-xs text-gray-400 mr-1">Rating:</span>
        {[1, 2, 3, 4, 5].map(star => (
          <button
            key={star}
            className={`text-lg transition-colors ${star <= rating ? 'text-yellow' : 'text-gray-700'}`}
            onClick={() => setRating(star)}
          >
            ★
          </button>
        ))}
      </div>

      {/* Include game info toggle */}
      <label className="flex items-center gap-2 text-xs text-gray-400 mb-3 cursor-pointer">
        <input
          type="checkbox"
          checked={includeGameInfo}
          onChange={e => setIncludeGameInfo(e.target.checked)}
          className="accent-neon"
        />
        Include game info (helps us debug)
      </label>

      {/* Submit */}
      <button
        className="btn-primary w-full text-sm"
        disabled={!text.trim() || rating === 0 || submitting}
        onClick={handleSubmit}
      >
        {submitting ? 'Sending...' : 'Submit Feedback'}
      </button>
    </div>
  );

  if (inline) return content;

  // Modal version
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
      <div className="card max-w-sm w-full mx-4">
        {content}
      </div>
    </div>
  );
}

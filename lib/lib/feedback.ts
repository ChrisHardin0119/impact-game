import { GameState } from './types';

export type FeedbackCategory = 'bug' | 'suggestion' | 'praise';

export interface FeedbackPayload {
  text: string;
  rating: number; // 1-5
  category: FeedbackCategory;
  gameSnapshot?: {
    tier: number;
    composition: string | null;
    mass: number;
    playtime: number;
    version: number;
  };
  timestamp: number;
}

/**
 * Build a game snapshot for feedback context
 */
export function buildGameSnapshot(state: GameState) {
  return {
    tier: state.currentTier,
    composition: state.composition,
    mass: state.mass,
    playtime: state.totalPlayTime,
    version: state.version,
  };
}

/**
 * Submit feedback. Currently stores locally.
 * Can be updated to POST to a Google Form endpoint or API.
 */
export async function submitFeedback(payload: FeedbackPayload): Promise<boolean> {
  try {
    // Store feedback locally for now
    const existing = JSON.parse(localStorage.getItem('impact_feedback') || '[]');
    existing.push(payload);
    localStorage.setItem('impact_feedback', JSON.stringify(existing));

    // TODO: When Google Form is set up, POST to the form endpoint:
    // const formUrl = 'https://docs.google.com/forms/d/e/YOUR_FORM_ID/formResponse';
    // const formData = new FormData();
    // formData.append('entry.XXXXXXX', payload.text);
    // formData.append('entry.XXXXXXX', String(payload.rating));
    // formData.append('entry.XXXXXXX', payload.category);
    // formData.append('entry.XXXXXXX', JSON.stringify(payload.gameSnapshot));
    // await fetch(formUrl, { method: 'POST', body: formData, mode: 'no-cors' });

    return true;
  } catch {
    return false;
  }
}

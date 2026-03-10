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
 * ============================================================
 * SUPABASE CONFIGURATION
 * ============================================================
 * Replace these with your actual Supabase project values.
 *
 * 1. Go to your Supabase project dashboard
 * 2. Go to Settings > API
 * 3. Copy the "URL" and "anon/public" key
 *
 * Then in Supabase SQL Editor, create the feedback table:
 *
 *   CREATE TABLE feedback (
 *     id BIGSERIAL PRIMARY KEY,
 *     created_at TIMESTAMPTZ DEFAULT NOW(),
 *     text TEXT NOT NULL,
 *     rating INT CHECK (rating >= 1 AND rating <= 5),
 *     category TEXT CHECK (category IN ('bug', 'suggestion', 'praise')),
 *     tier INT,
 *     composition TEXT,
 *     mass FLOAT,
 *     playtime FLOAT,
 *     game_version INT
 *   );
 *
 *   -- Enable Row Level Security but allow anonymous inserts
 *   ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;
 *   CREATE POLICY "Allow anonymous inserts"
 *     ON feedback FOR INSERT
 *     TO anon
 *     WITH CHECK (true);
 *
 *   -- Optional: allow yourself to read all feedback
 *   CREATE POLICY "Allow authenticated reads"
 *     ON feedback FOR SELECT
 *     TO authenticated
 *     USING (true);
 *
 * ============================================================
 */
const SUPABASE_URL = ''; // e.g., 'https://abc123.supabase.co'
const SUPABASE_ANON_KEY = ''; // e.g., 'eyJ...'

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
 * Submit feedback to Supabase (or localStorage as fallback).
 */
export async function submitFeedback(payload: FeedbackPayload): Promise<boolean> {
  try {
    // Always store locally as backup
    const existing = JSON.parse(localStorage.getItem('impact_feedback') || '[]');
    existing.push(payload);
    localStorage.setItem('impact_feedback', JSON.stringify(existing));

    // If Supabase is configured, send to the database
    if (SUPABASE_URL && SUPABASE_ANON_KEY) {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({
          text: payload.text,
          rating: payload.rating,
          category: payload.category,
          tier: payload.gameSnapshot?.tier ?? null,
          composition: payload.gameSnapshot?.composition ?? null,
          mass: payload.gameSnapshot?.mass ?? null,
          playtime: payload.gameSnapshot?.playtime ?? null,
          game_version: payload.gameSnapshot?.version ?? null,
        }),
      });

      if (!response.ok) {
        console.warn('Supabase feedback failed:', response.status, await response.text());
        // Still return true since we saved locally
      }
    }

    return true;
  } catch (err) {
    console.warn('Feedback submission error:', err);
    return false;
  }
}

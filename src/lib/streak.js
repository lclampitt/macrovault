import { supabase } from '../supabaseClient';

// Simple in-memory cache: userId → { streak, expiresAt }
const cache = new Map();
const TTL_MS = 5 * 60 * 1000; // 5 minutes

function fmt(date) {
  return date.toISOString().slice(0, 10);
}

/**
 * Returns the user's current activity streak (integer).
 * A streak day = any day with at least one workout, progress entry, or food log.
 * Counts consecutive days ending today; if nothing logged today, counts from yesterday.
 */
export async function getStreak(userId) {
  if (!userId) return 0;

  const hit = cache.get(userId);
  if (hit && Date.now() < hit.expiresAt) return hit.streak;

  // Fetch distinct active dates from all three tables in parallel
  const [{ data: workouts }, { data: progress }, { data: foodLogs }] = await Promise.all([
    supabase.from('workouts').select('workout_date').eq('user_id', userId),
    supabase.from('progress').select('date').eq('user_id', userId),
    supabase.from('food_logs').select('logged_date').eq('user_id', userId),
  ]);

  const activeDates = new Set();
  (workouts  || []).forEach((r) => activeDates.add(r.workout_date));
  (progress  || []).forEach((r) => activeDates.add(r.date));
  (foodLogs  || []).forEach((r) => activeDates.add(r.logged_date));

  // Start from today; fall back to yesterday if today has no activity
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);

  if (!activeDates.has(fmt(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
    if (!activeDates.has(fmt(cursor))) {
      cache.set(userId, { streak: 0, expiresAt: Date.now() + TTL_MS });
      return 0;
    }
  }

  let streak = 0;
  while (activeDates.has(fmt(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }

  cache.set(userId, { streak, expiresAt: Date.now() + TTL_MS });
  return streak;
}

/** Call after any write to workouts, progress, or food_logs to bust the cache. */
export function invalidateStreakCache(userId) {
  cache.delete(userId);
}

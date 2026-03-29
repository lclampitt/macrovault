-- ============================================================
-- Gainlytics v2 — Daily Checklist Table Migration
-- Run this in your Supabase SQL Editor:
--   https://supabase.com/dashboard → SQL Editor → New query
-- ============================================================

-- One row per user per day, auto-populated from activity tables.
-- The dashboard reads directly from workouts/food_logs/progress,
-- so this table is an optional cache — kept for analytics/history.

CREATE TABLE IF NOT EXISTS daily_checklist (
  id                UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id           UUID        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date              DATE        NOT NULL DEFAULT CURRENT_DATE,
  workout_logged    BOOLEAN     NOT NULL DEFAULT false,
  nutrition_logged  BOOLEAN     NOT NULL DEFAULT false,
  progress_updated  BOOLEAN     NOT NULL DEFAULT false,
  created_at        TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, date)
);

-- RLS
ALTER TABLE daily_checklist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own daily checklist"
  ON daily_checklist
  FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

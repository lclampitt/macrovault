-- ============================================================
-- Gainlytics v2 — Food Logs Table Migration
-- Run this in your Supabase SQL Editor:
--   https://supabase.com/dashboard → SQL Editor → New query
-- ============================================================

CREATE TABLE IF NOT EXISTS food_logs (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  logged_date DATE        NOT NULL DEFAULT CURRENT_DATE,
  meal_name   TEXT,
  calories    INTEGER     NOT NULL DEFAULT 0,
  protein_g   DECIMAL     NOT NULL DEFAULT 0,
  carbs_g     DECIMAL     NOT NULL DEFAULT 0,
  fat_g       DECIMAL     NOT NULL DEFAULT 0,
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Fast per-user, per-date lookups (used by dashboard + logger)
CREATE INDEX IF NOT EXISTS food_logs_user_date_idx
  ON food_logs (user_id, logged_date);

-- Row-level security: users can only touch their own rows
ALTER TABLE food_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own food logs"
  ON food_logs
  FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Enable real-time so the dashboard and logger subscriptions work
ALTER PUBLICATION supabase_realtime ADD TABLE food_logs;

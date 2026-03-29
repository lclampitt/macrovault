-- ============================================================
-- Gainlytics v2 — Add muscle_group column to workouts table
-- Run this in your Supabase SQL Editor:
--   https://supabase.com/dashboard → SQL Editor → New query
-- ============================================================

ALTER TABLE workouts
  ADD COLUMN IF NOT EXISTS muscle_group TEXT;

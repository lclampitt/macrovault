-- ============================================================
-- Gainlytics v2 — profiles privilege-escalation lockdown
-- ============================================================
-- Context:
--   The existing RLS policies on `profiles` correctly scope reads
--   and writes to the row owner (auth.uid() = id) but do NOT
--   restrict WHICH COLUMNS the owner can write. That means a
--   logged-in user can self-promote their `subscription_tier`
--   to 'pro' or 'pro_plus' from the browser using the anon key
--   plus their auth token:
--
--     await supabase.from('profiles')
--       .update({ subscription_tier: 'pro_plus' })
--       .eq('id', myUserId);   //  <-- currently succeeds
--
--   They can also reset their own monthly usage counters
--   (analyzer / ai_suggestions) to bypass free-tier limits.
--
-- Fix:
--   Replace the table-level UPDATE/INSERT grants on `authenticated`
--   with column-level grants that whitelist only the columns the
--   frontend legitimately writes. Postgres will NOT subtract a
--   column-level REVOKE from a pre-existing table-level grant,
--   so we must REVOKE at the table level first, then GRANT on
--   the allowed columns explicitly.
--
--   Service-role bypasses table grants entirely, so the FastAPI
--   backend (Stripe webhook + can_use_*() helpers in main.py)
--   continues to write the protected columns unchanged via
--   supabase_admin.
--
--   SELECT is left intact: the frontend still reads
--   subscription_tier (App.fetchTier, useTheme, useUsage, etc.)
--   and the monthly counters (usage UI).
--
-- Allowed-write columns on profiles (frontend writes these):
--   display_name, units_preference, date_format, height_in,
--   onboarding_completed, accent_theme, theme_mode, ui_mode
--   (and `id` for INSERT only — primary key on upsert path)
--
-- Protected columns (backend / Stripe-only):
--   subscription_tier,
--   analyzer_uses_this_month, analyzer_month,
--   ai_suggestions_this_month, ai_suggestions_month,
--   stripe_customer_id, stripe_subscription_id
--
-- Apply:
--   Supabase SQL Editor → New query → paste → Run.
-- ============================================================

-- 1) Strip blanket table-level write privileges from frontend roles.
--    `anon` should never write profiles at all (no signed-in JWT).
REVOKE UPDATE ON public.profiles FROM authenticated;
REVOKE INSERT ON public.profiles FROM authenticated;
REVOKE UPDATE ON public.profiles FROM anon;
REVOKE INSERT ON public.profiles FROM anon;

-- 2) Re-grant UPDATE only on the columns the frontend legitimately edits.
GRANT UPDATE (
  display_name,
  units_preference,
  date_format,
  height_in,
  onboarding_completed,
  accent_theme,
  theme_mode,
  ui_mode
) ON public.profiles TO authenticated;

-- 3) Re-grant INSERT only on the columns the frontend uses on first
--    profile creation (upsert path through OnboardingWizard / settings).
--    `id` is required because PostgREST sends it in the INSERT column
--    list; without INSERT(id) the upsert fails outright.
GRANT INSERT (
  id,
  display_name,
  units_preference,
  date_format,
  height_in,
  onboarding_completed,
  accent_theme,
  theme_mode,
  ui_mode
) ON public.profiles TO authenticated;

-- ============================================================
-- Verification (run after the GRANTs above):
-- ============================================================
-- Expect: ZERO rows for any of the 7 protected columns under
-- authenticated/anon for INSERT or UPDATE.
--
--   SELECT grantee, privilege_type, column_name
--   FROM information_schema.column_privileges
--   WHERE table_schema = 'public'
--     AND table_name   = 'profiles'
--     AND column_name IN (
--       'subscription_tier','analyzer_uses_this_month','analyzer_month',
--       'ai_suggestions_this_month','ai_suggestions_month',
--       'stripe_customer_id','stripe_subscription_id'
--     )
--     AND grantee IN ('authenticated','anon')
--     AND privilege_type IN ('UPDATE','INSERT')
--   ORDER BY column_name, grantee, privilege_type;
--
-- Functional verification (browser console, signed in as a
-- non-pro user):
--
--   const u = (await supabase.auth.getUser()).data.user.id;
--   await supabase.from('profiles')
--     .update({ subscription_tier: 'pro_plus' })
--     .eq('id', u);
--   //  → { error: { code: '42501', message: 'permission denied ...' } }
--
--   // Confirm allowed write still works:
--   await supabase.from('profiles')
--     .update({ display_name: 'Test' })
--     .eq('id', u);
--   //  → { error: null }
-- ============================================================

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project shape

Two services in one repo, both deployed separately:

- **Frontend** — Create React App at the repo root. Entry: `src/index.js` → `src/app.jsx`. React 19 + react-router-dom 7 + framer-motion 12 + Supabase JS. The in-product name is "MacroVault"; the project name "Gainlytics" only appears in URLs and marketing.
- **Backend** — FastAPI + scikit-learn at `backend/`. Entry: `backend/main.py`. Hosted on Render at `https://gainlytics-1.onrender.com`; frontend talks to it via `REACT_APP_API_BASE` (falls back to the hosted URL).

Supabase is the system of record (auth + `profiles`, `workouts`, `workout_templates`, `food_logs`, `daily_checklists`, etc.). The FastAPI service uses the **service-role key** for admin operations (usage gating, Stripe webhook writes) — never expose that key to the browser. All direct user-initiated reads/writes go through `src/supabaseClient.js` using the anon key.

## Commands

### Frontend (repo root)
```bash
npm start                 # dev server on :3000
npm run build             # CI=false react-scripts build (already set in package.json)
npm test                  # Jest watch mode
npm test -- --watchAll=false --testPathPattern=Foo   # run a single test file once
```

On Windows cmd, `CI=false react-scripts build` from package.json fails because `CI=false` is a POSIX env-var syntax. From git-bash/WSL it works as-is. From PowerShell or cmd, run `npx react-scripts build` with `$env:CI="false"` or `set CI=false` first.

### Backend (`cd backend/`)
```bash
python -m venv venv && source venv/bin/activate   # (Windows: venv\Scripts\activate)
pip install -r requirements.txt
python train_bodyfat.py                           # regenerate models/bodyfat_model.pkl from bodyfat_training.csv
uvicorn main:app --reload --port 8000
```

### Supabase migrations
SQL files at repo root (`supabase_*_migration.sql`) are applied **manually** in the Supabase SQL editor. There is no migration runner. When adding a column the frontend uses, write the migration file first and document it.

## Architecture that requires reading multiple files

### Routing and auth gating (`src/app.jsx`)
`App` owns the session and tier state. It fetches `profiles.subscription_tier` + `profiles.onboarding_completed` on auth change and threads `isPro` / `isProPlus` into every protected route via a `protect()` wrapper that composes `<ProtectedRoute>` + `<AppShell>`. There are three route types:
- `PublicRoute` — only renders when **not** signed in (landing redirects to `/home`)
- `ProtectedRoute` — requires session, redirects to `/auth`
- Raw routes — auth-agnostic (terms, privacy, reset-password)

The onboarding wizard shows only when `onboarding_completed === false` explicitly. If the column is missing (migration not yet run), it defaults to hidden — this is deliberate so partial deploys don't spam existing users.

### Plan gating is enforced in three places, not one
1. **Backend** (`backend/main.py`) — `/analyze-measurements`, `/workouts/save`, `/meal-planner/suggest*` call `can_use_analyzer()` / `can_log_workout()` / `can_use_ai_suggestions()` and return HTTP 403 with `{"detail": {"error": "limit_reached"}}` when over limit. Monthly counters live on the `profiles` row (`analyzer_uses_this_month` + `analyzer_month`, etc.) and auto-reset when `_current_month()` differs.
2. **Frontend usage fetch** — `src/hooks/useUsage.js` calls `GET /usage/:user_id`. Returns `{ analyzerUsed, analyzerLimit, workoutCount, workoutLimit, plan }` with `null` limits for paid tiers.
3. **Upgrade UX** — `src/context/UpgradeContext.jsx` owns a global `UpgradeModal`. Any component catches a 403 and calls `triggerUpgrade('analyzer' | 'workouts' | 'meal_planner')` to open the modal with feature-specific copy. Free-tier limits are currently: 3 analyzer runs/month, 7 total workouts, 0 AI meal suggestions. Pro gets 20 AI workout generations/month. Pro_plus gets 50 AI meal suggestions/month.

### Theming is three orthogonal dimensions (`src/hooks/useTheme.js`)
- `mode`: `dark` | `light`
- `accent`: `teal` (default, free) plus Pro-only accents `blue`, `violet`, `orange`, `rose`, `crimson`, `xp-aqua`, `myspace`, `y2k-chrome`, `spectrum`
- `uiMode`: `modern` | `y2k` (y2k is Pro-only)

Each writes to localStorage **and** to `document.documentElement` as a `data-*` attribute — all CSS reads `[data-theme]`, `[data-accent]`, `[data-ui-mode]` selectors in `src/styles/theme.css`. Values are also persisted to `profiles` so they follow the user across devices.

Cross-component sync uses custom events (`macrovault-mode-change`, `macrovault-accent-change`, `macrovault-ui-mode-change`) because `storage` events don't fire in the originating tab. Free users who land in with a Pro-only accent or Y2K UI are **silently reset to teal/modern** on load, both in state and in Supabase.

### Toasts must go through the wrapper (`src/utils/toast.js`)
Do **not** import Sonner's `toast` directly. Import `appToast` from `src/utils/toast.js`. The wrapper checks whether Y2K mode is active (via `[data-ui-mode]` or localStorage) and routes to `Y2KToast` instead of Sonner so the toast style matches the UI chrome.

### Active workout persistence (`src/hooks/useActiveWorkout.js`)
In-progress workouts survive navigation and tab switches via localStorage at key `macrovault_active_workout`. A 4-hour `RECOVERY_WINDOW_MS` auto-clears stale snapshots on read. Subscribers use both the native `storage` event (cross-tab) and a custom `macrovault:active-workout` event (same-tab). `ActiveWorkoutBanner` (rendered in `AppShell`) surfaces the snapshot on every route except `/workouts`, and the sidebar log icon shows a pulsing dot when `hasActive` is true.

### Mobile vs desktop breakpoint
Mobile is `max-width: 767px` (**not** 768). Detect at runtime with `window.matchMedia('(max-width: 767px)').matches`. For framer-motion variants that differ between viewports inside `<AnimatePresence>`, use an IIFE so the variants are recomputed per-open (e.g. the end-workout confirm sheet in `WorkoutLogger.jsx`). Mobile sheets use `padding-bottom: env(safe-area-inset-bottom, 0px)` and `touch-action: manipulation` to avoid iOS flick-to-tap misfires.

`WorkoutLogger.jsx` is ~2800 lines and contains **both** desktop and mobile implementations of the entire workout flow in one file. Do not extract without a strong reason.

### Body-fat / BMR pipeline (`/analyze-measurements`)
1. `calculate_tdee()` picks Katch-McArdle when a `bodyfat_pct` is provided (BMR = 370 + 21.6·LBM), otherwise falls back to Mifflin-St Jeor. The response includes a `formula: "katch" | "mifflin"` field so the UI can show the right disclaimer.
2. The ML model (`backend/models/bodyfat_model.pkl`) is a Random Forest trained on NHANES 2017–2018. If it fails to load on startup the endpoint 500s — rerun `python train_bodyfat.py` to regenerate.
3. The same Katch/Mifflin logic is duplicated in `src/calculators/MacroCalculator.js` for the offline macro calculator — keep them in sync.

### Stripe
`/stripe/checkout`, `/stripe/checkout-pro-plus`, `/stripe/portal`, `/stripe/webhook` all live in `backend/main.py`. The webhook is the single writer of `profiles.subscription_tier`; the frontend never writes tier directly. Env vars: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID_PRO`, `STRIPE_PRICE_ID_PRO_PLUS`, `FRONTEND_URL`.

### Analytics and errors
- PostHog: initialized in `src/lib/posthog.js`, imported at the top of `src/index.js` so it boots before `<App />`. `posthog.identify(userId, { email })` runs in `App.fetchTier()`. Server-side tracking uses the `posthog` Python package gated on `POSTHOG_KEY`.
- Sentry: initialized in `src/index.js`. `Sentry.setUser({ id, email })` mirrors PostHog identify; `Sentry.setUser(null)` runs on logout.

## Design system

- **Background:** `#0f1117`
- **Surface/card:** `#151820`
- **Teal accent:** `#1D9E75`
- **Teal light:** `#5DCAA5`
- **Border:** `rgba(255,255,255,0.07)` default, `rgba(29,158,117,0.25)` teal accent
- **Text primary:** `#ffffff`
- **Text muted:** `rgba(255,255,255,0.5)`
- **Text hint:** `rgba(255,255,255,0.3)`
- **Border radius:** 12px cards, 8px inputs, 20px pills
- **Icons:** Lucide React only — never use emoji as icons
- **Fonts:** system font stack, no external font imports
- Never hardcode colors inline — always use CSS variables
  from `src/styles/theme.css`
- Never add gradients, drop shadows, blur, or glow
  effects unless they already exist in the design system
- Landing page uses `lp-*` / `--lp-*` prefix —
  do not mix with app theme tokens

## Rules

- **Never commit or push anything** unless explicitly
  told to with the words "commit this" or "push this."
  Make the changes and stop — do not auto-commit.
- **Never commit directly to main** under any
  circumstances. All commits go on a new branch.
- **Never push to any branch** without explicit
  instruction.
- **Never delete files** without confirming with
  the user first.
- **Never modify the database schema** (Supabase
  tables, columns, RLS policies) without first
  showing the exact SQL, writing it to a
  `supabase_*_migration.sql` file at the repo root,
  and waiting for explicit confirmation before
  applying anything.
- **Never expose the service-role key** to the
  browser or any frontend file.
- **Never import Sonner toast directly.** Always
  use `appToast` from `src/utils/toast.js`.
- **Never write subscription tier from the frontend.**
  Stripe webhook is the only writer of
  `profiles.subscription_tier`.
- **Never extract WorkoutLogger.jsx** into smaller
  files without explicit instruction — it is
  intentionally monolithic at ~2800 lines.
- **Always use mobile breakpoint of 767px** not 768px.
- **Always add `touch-action: manipulation`** to
  interactive elements in mobile workout flows.
- **AI meal suggestion limit is 50/month** for Pro+.
  Do not change this without being explicitly asked.
- **AI workout generation limit is 20/month** for
  Pro, unlimited for Pro+.
- When making CSS changes always verify both dark
  and light mode, and at least one Pro accent color
  to confirm theming still works correctly.
- When adding a new page or route confirm whether
  it should be PublicRoute, ProtectedRoute, or raw
  before wiring it up.
- Stage only files relevant to the current task
  when committing — the working tree often has
  unrelated in-progress work from other sessions.

## Workflow

Run tasks autonomously without asking questions
unless something is genuinely ambiguous or
destructive (schema changes, file deletions,
Stripe config changes). Make all the changes,
test what you can locally, then stop and summarize
what was done including:
- Files changed and why
- Any SQL migrations needed (written to file,
  not applied — wait for confirmation)
- Anything that needs manual testing on mobile
- Any known edge cases or follow-up work

Do not commit or push after completing a task
unless explicitly instructed to do so.

## File-layout conventions

- `src/pages/<name>.jsx` for simple pages
  (e.g. `dashboard.jsx`). Feature-pages get a
  folder: `src/pages/Workouts/WorkoutLogger.jsx`,
  `src/pages/MealPlanner/MealPlanner.jsx`.
- CSS is never co-located; it lives in
  `src/styles/<name>.css` and is imported by
  the component that owns it.
- The landing page (`src/pages/LandingPage.jsx`)
  and its CSS (`src/styles/landing.css`) use the
  `lp-*` prefix and `--lp-*` CSS variables — a
  self-contained design system that deliberately
  does not pick up theme tokens, so marketing
  visuals stay stable across theme modes.
- `src/calculators/` holds standalone calculator
  routes; do not confuse with
  `src/pages/calculators.jsx` which is the index
  page listing them.

## Commit style

Conventional commits: `feat:`, `fix:`, `chore:`.
Subject under ~70 chars, body describes the "why."
Stage specific files by name — the working tree
often has half-finished experiments from other
sessions that should not ship together. Every
non-trivial commit on this repo is signed with
a `Co-Authored-By: Claude ...` trailer.

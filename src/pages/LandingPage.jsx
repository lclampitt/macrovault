import React, { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Ruler,
  Target,
  Zap,
  TrendingUp,
  CalendarDays,
  BookOpen,
  Check,
  Lock,
  Play,
  Home,
  UtensilsCrossed,
  Dumbbell,
  Bookmark,
  Copy,
  Trash2,
  Sparkles,
  Calculator,
  ChartPie,
  Trophy,
  Crown,
  LogOut,
} from 'lucide-react';
import { supabase } from '../supabaseClient';
import '../styles/landing.css';
import '../styles/legal.css';

/* ------------------------------------------------------------------ */
/* Hooks                                                              */
/* ------------------------------------------------------------------ */

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const onChange = (e) => setReduced(e.matches);
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else mq.addListener(onChange);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', onChange);
      else mq.removeListener(onChange);
    };
  }, []);
  return reduced;
}

function useScrollPosition(threshold = 20) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > threshold);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [threshold]);
  return scrolled;
}

/* ------------------------------------------------------------------ */
/* Data                                                               */
/* ------------------------------------------------------------------ */

const FEATURES = [
  {
    icon: Ruler,
    title: 'Measurements',
    desc: 'Log body measurements and track composition changes over time.',
  },
  {
    icon: Target,
    title: 'Goal Planner',
    desc: 'Set weight, strength, and body goals and follow the path to hitting them.',
  },
  {
    icon: Zap,
    title: 'Workout Logger',
    desc: 'Log sets, reps, and weight for every session. Build real training history.',
  },
  {
    icon: TrendingUp,
    title: 'Progress Charts',
    desc: 'Visualize weight, strength, and measurement trends in clean charts.',
  },
  {
    icon: CalendarDays,
    title: 'Consistency Calendar',
    desc: 'Mark active days and build streaks that keep you accountable.',
  },
  {
    icon: BookOpen,
    title: 'Exercise Library',
    desc: 'Browse hundreds of exercises with instructions, muscles worked, and more.',
  },
];

const FEATURE_STRIP = [
  { label: 'Meal planner', desc: 'AI-powered weekly meal suggestions' },
  { label: 'Macro calculator', desc: 'Full TDEE + macro breakdown' },
  { label: 'Workout tracking', desc: 'Log sessions, track PRs, view charts' },
];

const STATS = [
  { value: 'Free', label: 'to get started' },
  { value: '96+', label: 'exercises tracked' },
  { value: '5 min', label: 'to set up' },
];

const FREE_FEATURES = [
  '10 workout logs per month',
  'Goal Planner & Progress Charts',
  'Consistency Calendar',
  'Exercise Library',
];

const PRO_FEATURES = [
  'Everything in Free',
  'Unlimited measurements',
  'Unlimited workout logs',
  'Advanced progress charts',
  'Priority support',
  'Data export (CSV)',
];

const PRO_PLUS_FEATURES = [
  'Everything in Pro',
  'AI Meal Suggestions (300/mo)',
  'AI-powered nutrition planning',
  'Personalized macro-fit meals',
];

/* ------------------------------------------------------------------ */
/* Navbar                                                             */
/* ------------------------------------------------------------------ */

function Navbar() {
  const scrolled = useScrollPosition(20);
  return (
    <nav className={`lp-nav ${scrolled ? 'lp-nav--scrolled' : ''}`}>
      <Link to="/" className="lp-nav__logo">
        <span className="lp-nav__logo-icon"><Lock size={14} /></span>
        <span className="lp-nav__logo-name">MacroVault</span>
      </Link>

      <div className="lp-nav__links">
        <a href="#features" className="lp-nav__link">Features</a>
        <a href="#pricing" className="lp-nav__link">Pricing</a>
        <Link to="/about" className="lp-nav__link">About</Link>
      </div>

      <div className="lp-nav__actions">
        <Link to="/auth" className="lp-nav__signin">Sign in</Link>
        <Link to="/auth" className="lp-nav__cta">Get started</Link>
      </div>
    </nav>
  );
}

/* ------------------------------------------------------------------ */
/* Hero                                                               */
/* ------------------------------------------------------------------ */

function Hero() {
  const navigate = useNavigate();
  const reduced = usePrefersReducedMotion();

  const fadeUp = (delay) =>
    reduced
      ? { initial: false, animate: { opacity: 1, y: 0 } }
      : {
          initial: { opacity: 0, y: 24 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.7, ease: [0.4, 0, 0.2, 1], delay },
        };

  return (
    <section className="lp-hero" id="hero">
      {/* Background orbs */}
      <motion.div
        className="lp-hero__orb lp-hero__orb--1"
        aria-hidden
        animate={reduced ? {} : { x: [0, 20, 0], y: [0, 12, 0] }}
        transition={reduced ? {} : { duration: 8, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="lp-hero__orb lp-hero__orb--2"
        aria-hidden
        animate={reduced ? {} : { x: [0, -16, 0], y: [0, -10, 0] }}
        transition={reduced ? {} : { duration: 10, repeat: Infinity, ease: 'easeInOut' }}
      />

      <div className="lp-hero__grid">
        {/* LEFT COLUMN */}
        <div className="lp-hero__left">
          <motion.div className="lp-hero__badge" {...fadeUp(0.1)}>
            <span className="lp-hero__badge-dot" />
            Track smarter. Train harder.
          </motion.div>

          <motion.h1 className="lp-hero__heading" {...fadeUp(0.25)}>
            <span>Data-driven fitness,</span>
            <br />
            <span className="lp-hero__heading--accent">without the guesswork.</span>
          </motion.h1>

          <motion.p className="lp-hero__sub" {...fadeUp(0.4)}>
            Track workouts, estimate your body composition and hit your goals all in one place.
            Built for people who want real data, not just motivation.
          </motion.p>

          <motion.div className="lp-hero__ctas" {...fadeUp(0.55)}>
            <button
              className="lp-hero__cta-primary"
              onClick={() => navigate('/auth')}
            >
              Start for free
            </button>
            <a
              href="#live-demo"
              className="lp-hero__cta-secondary"
              onClick={(e) => {
                const el = document.getElementById('live-demo');
                if (el) {
                  e.preventDefault();
                  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
              }}
            >
              <Play size={12} />
              See how it works
            </a>
          </motion.div>

          <motion.div className="lp-hero__stats-wrap" {...fadeUp(0.7)}>
            <div className="lp-hero__stats-divider" />
            <div className="lp-hero__stats">
              {STATS.map((s, i) => (
                <React.Fragment key={s.value}>
                  {i > 0 && <div className="lp-hero__stat-sep" />}
                  <div className="lp-hero__stat">
                    <div className="lp-hero__stat-value">{s.value}</div>
                    <div className="lp-hero__stat-label">{s.label}</div>
                  </div>
                </React.Fragment>
              ))}
            </div>
          </motion.div>
        </div>

        {/* RIGHT COLUMN — dashboard preview */}
        <div className="lp-hero__right">
          <DashboardPreview reduced={reduced} />
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Dashboard preview mockup                                           */
/* ------------------------------------------------------------------ */

function DashboardPreview({ reduced }) {
  const today = useMemo(() => {
    const d = new Date();
    return d.toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
  }, []);

  const floatAnim = reduced
    ? {}
    : { y: [0, -12, 0] };
  const floatTrans = reduced
    ? {}
    : { duration: 5, repeat: Infinity, ease: 'easeInOut' };

  return (
    <motion.div
      className="lp-preview"
      animate={floatAnim}
      transition={floatTrans}
    >
      <div className="lp-preview__frame">
        {/* Browser header */}
        <div className="lp-preview__header">
          <div className="lp-preview__dots">
            <span className="lp-preview__dot" style={{ background: '#ff5f57' }} />
            <span className="lp-preview__dot" style={{ background: '#febc2e' }} />
            <span className="lp-preview__dot" style={{ background: '#28c840' }} />
          </div>
          <div className="lp-preview__url">macro-vault.com/dashboard</div>
        </div>

        {/* Dashboard body */}
        <div className="lp-preview__body">
          <div className="lp-preview__greet-row">
            <span className="lp-preview__eyebrow">GOOD MORNING</span>
            <span className="lp-preview__date">{today}</span>
          </div>

          {/* 2x2 stat grid */}
          <div className="lp-preview__stats">
            <div className="lp-preview__stat-card">
              <div className="lp-preview__stat-label">CALORIES</div>
              <div className="lp-preview__stat-value">1,640</div>
              <div className="lp-preview__stat-sub lp-preview__stat-sub--teal">540 kcal remaining</div>
            </div>
            <div className="lp-preview__stat-card">
              <div className="lp-preview__stat-label">PROTEIN</div>
              <div className="lp-preview__stat-value">120g</div>
              <div className="lp-preview__stat-sub lp-preview__stat-sub--teal">on track for goal</div>
            </div>
            <div className="lp-preview__stat-card">
              <div className="lp-preview__stat-label">WORKOUTS</div>
              <div className="lp-preview__stat-value">3</div>
              <div className="lp-preview__stat-sub">this week</div>
            </div>
            <div className="lp-preview__stat-card">
              <div className="lp-preview__stat-label">STREAK</div>
              <div className="lp-preview__stat-value">11d</div>
              <div className="lp-preview__stat-sub lp-preview__stat-sub--teal">keep it going</div>
            </div>
          </div>

          {/* Macro split */}
          <div className="lp-preview__card">
            <div className="lp-preview__card-title">MACRO SPLIT</div>
            <div className="lp-preview__bars">
              <div className="lp-preview__bar-row">
                <span className="lp-preview__bar-label">Protein</span>
                <div className="lp-preview__bar-track">
                  <motion.div
                    className="lp-preview__bar-fill"
                    style={{ background: '#7f77dd' }}
                    initial={reduced ? { width: '100%' } : { width: 0 }}
                    whileInView={{ width: '100%' }}
                    viewport={{ once: true }}
                    transition={reduced ? { duration: 0 } : { duration: 1.2, delay: 0.6, ease: [0.4, 0, 0.2, 1] }}
                  />
                </div>
              </div>
              <div className="lp-preview__bar-row">
                <span className="lp-preview__bar-label">Carbs</span>
                <div className="lp-preview__bar-track">
                  <motion.div
                    className="lp-preview__bar-fill"
                    style={{ background: '#1D9E75' }}
                    initial={reduced ? { width: '65%' } : { width: 0 }}
                    whileInView={{ width: '65%' }}
                    viewport={{ once: true }}
                    transition={reduced ? { duration: 0 } : { duration: 1.2, delay: 0.8, ease: [0.4, 0, 0.2, 1] }}
                  />
                </div>
              </div>
              <div className="lp-preview__bar-row">
                <span className="lp-preview__bar-label">Fat</span>
                <div className="lp-preview__bar-track">
                  <motion.div
                    className="lp-preview__bar-fill"
                    style={{ background: '#f59e0b' }}
                    initial={reduced ? { width: '70%' } : { width: 0 }}
                    whileInView={{ width: '70%' }}
                    viewport={{ once: true }}
                    transition={reduced ? { duration: 0 } : { duration: 1.2, delay: 1.0, ease: [0.4, 0, 0.2, 1] }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Meal plan */}
          <div className="lp-preview__card">
            <div className="lp-preview__card-title">TODAY&apos;S MEAL PLAN</div>
            <div className="lp-preview__meal-row">
              <span className="lp-preview__meal-name">Protein Smoothie Bowl</span>
              <span className="lp-preview__meal-kcal">580 kcal</span>
            </div>
            <div className="lp-preview__meal-row">
              <span className="lp-preview__meal-name">Chicken Rice Bowl</span>
              <span className="lp-preview__meal-kcal">600 kcal</span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* Feature strip                                                      */
/* ------------------------------------------------------------------ */

function FeatureStrip() {
  return (
    <section className="lp-strip">
      <div className="lp-strip__inner">
        {FEATURE_STRIP.map((f, i) => (
          <React.Fragment key={f.label}>
            {i > 0 && <div className="lp-strip__sep" />}
            <div className="lp-strip__item">
              <div className="lp-strip__label">{f.label}</div>
              <div className="lp-strip__desc">{f.desc}</div>
            </div>
          </React.Fragment>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Features                                                           */
/* ------------------------------------------------------------------ */

function Features() {
  const reduced = usePrefersReducedMotion();
  return (
    <section className="lp-features" id="features">
      <div className="lp-features__header">
        <span className="lp-features__eyebrow">FEATURES</span>
        <h2 className="lp-features__heading">
          <span>Everything you need</span>
          <br />
          <span className="lp-features__heading--accent">to reach your goals</span>
        </h2>
        <p className="lp-features__sub">
          A complete fitness toolkit for body measurements, workout logging and goal tracking.
        </p>
      </div>

      <div className="lp-features__grid">
        {FEATURES.map(({ icon: Icon, title, desc }, i) => (
          <motion.div
            key={title}
            className="lp-feat-card"
            initial={reduced ? false : { opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.25 }}
            transition={reduced ? { duration: 0 } : { duration: 0.5, delay: i * 0.05, ease: [0.4, 0, 0.2, 1] }}
          >
            <div className="lp-feat-card__icon">
              <Icon size={22} />
            </div>
            <div className="lp-feat-card__title">{title}</div>
            <div className="lp-feat-card__desc">{desc}</div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Live Demo — interactive, non-editable walkthrough of Pro+ features */
/* ------------------------------------------------------------------ */

const DEMO_NAV = [
  { id: 'home',         label: 'Home',         icon: Home },
  { id: 'progress',     label: 'Progress',     icon: TrendingUp },
  { id: 'measurements', label: 'Measurements', icon: Ruler },
  { id: 'calculators',  label: 'Calculators',  icon: Calculator },
  { id: 'meal',         label: 'Meal Planner', icon: UtensilsCrossed },
  { id: 'goal',         label: 'Goal Planner', icon: Target },
  { id: 'workouts',     label: 'Workouts',     icon: Dumbbell },
];

/* Theme dot palette mirrors the app sidebar's quick themes */
const DEMO_THEME_DOTS = [
  { id: 'teal',    color: '#1D9E75' },
  { id: 'blue',    color: '#3B82F6' },
  { id: 'violet',  color: '#8B5CF6' },
  { id: 'orange', color: '#F97316' },
  { id: 'rose',    color: '#F43F5E' },
  { id: 'crimson', color: '#DC2626' },
];

/* Swallow every interaction inside the demo (except sidebar/pill tab switches) */
function preventClick(e) {
  e.preventDefault();
  e.stopPropagation();
}

/* Wrapper: renders children + a CSS-only tooltip on hover/focus */
function Locked({ children, tip = 'Sign up to use this feature' }) {
  return (
    <span
      className="lp-demo__locked"
      tabIndex={0}
      onClick={preventClick}
      onKeyDown={preventClick}
    >
      {children}
      <span className="lp-demo__locked-tip" role="tooltip">
        <Lock size={11} />
        {tip}
      </span>
    </span>
  );
}

/* ---------- 1. Home ---------- */
const HOME_CAL_DAYS = [
  /* April 2026 starts on Wednesday → 3 empty slots first */
  null, null, null,
  { n: 1,  state: 'both' },
  { n: 2,  state: 'partial' },
  { n: 3,  state: 'partial' },
  { n: 4,  state: 'partial' },
  { n: 5,  state: 'missed' },
  { n: 6,  state: 'partial' },
  { n: 7,  state: 'both' },
  { n: 8,  state: 'both' },
  { n: 9,  state: 'partial' },
  { n: 10, state: 'both' },
  { n: 11, state: 'both' },
  { n: 12, state: 'both' },
  { n: 13, state: 'missed' },
  { n: 14, state: 'partial' },
  { n: 15, state: 'partial' },
  { n: 16, state: 'partial' },
  { n: 17, state: 'both' },
  { n: 18, state: 'partial' },
  { n: 19, state: 'missed' },
  { n: 20, state: 'both' },
  { n: 21, state: 'both' },
  { n: 22, state: 'today' },
  { n: 23, state: 'future' },
  { n: 24, state: 'future' },
  { n: 25, state: 'future' },
  { n: 26, state: 'future' },
  { n: 27, state: 'future' },
  { n: 28, state: 'future' },
  { n: 29, state: 'future' },
  { n: 30, state: 'future' },
];

function DemoHome() {
  /* Gauge math — half circle of radius 80 */
  const halfCirc = Math.PI * 80;
  const pPct = 0.22; // protein share of kcal
  const cPct = 0.53; // carbs share of kcal
  const fPct = 0.25; // fat share of kcal
  const pLen = halfCirc * pPct;
  const cLen = halfCirc * cPct;
  const fLen = halfCirc * fPct;

  return (
    <div className="lp-demo__panel">
      {/* Greeting */}
      <div className="lp-demo__home-head">
        <h3 className="lp-demo__home-greeting">Good morning</h3>
        <p className="lp-demo__home-date">Wednesday, April 22</p>
      </div>

      {/* 4-stat row */}
      <div className="lp-demo__stat-grid">
        <div className="lp-demo__stat">
          <div className="lp-demo__stat-label">
            <span className="lp-demo__stat-dot" /> CALORIES
          </div>
          <div className="lp-demo__stat-value">2,180</div>
          <div className="lp-demo__stat-sub lp-demo__stat-sub--teal">0 kcal remaining</div>
        </div>
        <div className="lp-demo__stat">
          <div className="lp-demo__stat-label">
            <span className="lp-demo__stat-dot" /> PROTEIN
          </div>
          <div className="lp-demo__stat-value">120g</div>
          <div className="lp-demo__stat-sub lp-demo__stat-sub--teal">on track for goal</div>
        </div>
        <div className="lp-demo__stat">
          <div className="lp-demo__stat-label">
            <span className="lp-demo__stat-dot" /> WORKOUTS
          </div>
          <div className="lp-demo__stat-value">0</div>
          <div className="lp-demo__stat-sub">this week</div>
        </div>
        <div className="lp-demo__stat">
          <div className="lp-demo__stat-label">
            <span className="lp-demo__stat-dot" /> STREAK
          </div>
          <div className="lp-demo__stat-value">2d</div>
          <div className="lp-demo__stat-sub">day streak</div>
        </div>
      </div>

      {/* Macro split + consistency row */}
      <div className="lp-demo__home-split">
        {/* Macro split */}
        <div className="lp-demo__card">
          <div className="lp-demo__macro-split-head">
            <h4 className="lp-demo__card-heading">Macro split</h4>
            <div className="lp-demo__macro-tabs">
              <button type="button" className="lp-demo__macro-tab is-active" onClick={preventClick}>Today</button>
              <button type="button" className="lp-demo__macro-tab" onClick={preventClick}>7D</button>
              <button type="button" className="lp-demo__macro-tab" onClick={preventClick}>30D</button>
              <Locked>
                <button type="button" className="lp-demo__macro-tab is-primary">Log nutrition</button>
              </Locked>
            </div>
          </div>

          <div className="lp-demo__home-gauge-wrap">
            <svg viewBox="0 0 200 120" className="lp-demo__home-gauge" aria-hidden="true">
              {/* Background track */}
              <path
                d="M 20 100 A 80 80 0 0 1 180 100"
                fill="none"
                stroke="rgba(255,255,255,0.08)"
                strokeWidth="12"
                strokeLinecap="round"
              />
              {/* Fat (orange) — only the last slice, round cap at 100% mark */}
              <path
                d="M 20 100 A 80 80 0 0 1 180 100"
                fill="none"
                stroke="#f59e0b"
                strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray={`${fLen} ${halfCirc}`}
                strokeDashoffset={-(pLen + cLen)}
              />
              {/* Carbs (teal) — draws 0 to (pLen+cLen), butt caps keep seams clean */}
              <path
                d="M 20 100 A 80 80 0 0 1 180 100"
                fill="none"
                stroke="#1d9e75"
                strokeWidth="12"
                strokeLinecap="butt"
                strokeDasharray={`${pLen + cLen} ${halfCirc}`}
              />
              {/* Protein (purple) — drawn last so it sits at the "start" with round left cap */}
              <path
                d="M 20 100 A 80 80 0 0 1 180 100"
                fill="none"
                stroke="#7f77dd"
                strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray={`${pLen} ${halfCirc}`}
              />
            </svg>
            <div className="lp-demo__home-gauge-center">
              <div className="lp-demo__home-gauge-value">2,180</div>
              <div className="lp-demo__home-gauge-label">kcal today</div>
            </div>
          </div>

          <div className="lp-demo__home-macros">
            <div className="lp-demo__home-macro-row">
              <span className="lp-demo__home-macro-dot" style={{ background: '#7f77dd' }} />
              <span className="lp-demo__home-macro-name">Protein</span>
              <span className="lp-demo__home-macro-pct">22%</span>
              <span className="lp-demo__home-macro-val">120 / 120g</span>
            </div>
            <div className="lp-demo__home-macro-row">
              <span className="lp-demo__home-macro-dot" style={{ background: '#1d9e75' }} />
              <span className="lp-demo__home-macro-name">Carbs</span>
              <span className="lp-demo__home-macro-pct">53%</span>
              <span className="lp-demo__home-macro-val">288 / 288g</span>
            </div>
            <div className="lp-demo__home-macro-row">
              <span className="lp-demo__home-macro-dot" style={{ background: '#f59e0b' }} />
              <span className="lp-demo__home-macro-name">Fat</span>
              <span className="lp-demo__home-macro-pct">25%</span>
              <span className="lp-demo__home-macro-val">61 / 61g</span>
            </div>
          </div>

          <div className="lp-demo__home-remaining">
            <span className="lp-demo__home-macro-dot" style={{ background: '#f59e0b' }} />
            <span className="lp-demo__home-macro-name">Remaining</span>
            <span className="lp-demo__home-remaining-val">
              0 <small>kcal left</small>
            </span>
          </div>
        </div>

        {/* Consistency calendar */}
        <div className="lp-demo__card">
          <div className="lp-demo__calendar-head">
            <h4 className="lp-demo__card-heading">Consistency</h4>
            <span className="lp-demo__calendar-month">‹ April 2026</span>
          </div>

          <div className="lp-demo__calendar-grid">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
              <span key={`h-${i}`} className="lp-demo__calendar-dow">{d}</span>
            ))}
            {HOME_CAL_DAYS.map((d, i) =>
              d === null ? (
                <span key={i} className="lp-demo__calendar-cell lp-demo__calendar-cell--empty" />
              ) : (
                <span
                  key={i}
                  className={`lp-demo__calendar-cell lp-demo__calendar-cell--${d.state}`}
                >
                  {d.n}
                </span>
              ),
            )}
          </div>

          <div className="lp-demo__calendar-legend">
            <span><span className="lp-demo__cal-dot lp-demo__cal-dot--both" /> Both</span>
            <span><span className="lp-demo__cal-dot lp-demo__cal-dot--partial" /> Partial</span>
            <span><span className="lp-demo__cal-dot lp-demo__cal-dot--missed" /> Missed</span>
            <span className="lp-demo__cal-pct">23% this month</span>
          </div>
        </div>
      </div>

      {/* Today's meal plan */}
      <div className="lp-demo__card">
        <div className="lp-demo__meal-plan-head">
          <h4 className="lp-demo__card-heading">Today&apos;s Meal Plan</h4>
          <Locked>
            <button type="button" className="lp-demo__link-btn">View full plan →</button>
          </Locked>
        </div>

        <div className="lp-demo__meal-plan-grid">
          <div className="lp-demo__plan-meal">
            <div className="lp-demo__plan-slot">BREAKFAST</div>
            <div className="lp-demo__plan-name">
              Greek Yogurt Parfait with Berries and Granola
            </div>
            <div className="lp-demo__plan-macros">
              <span>Cal: <b>380</b></span>
              <span>P: <b>16g</b></span>
              <span>C: <b>54g</b></span>
              <span>F: <b>10g</b></span>
            </div>
            <div className="lp-demo__plan-log lp-demo__plan-log--logged">
              <Check size={13} /> Logged
            </div>
          </div>
          <div className="lp-demo__plan-meal">
            <div className="lp-demo__plan-slot">LUNCH</div>
            <div className="lp-demo__plan-name">
              Tuna Salad with Whole Grain Crackers
            </div>
            <div className="lp-demo__plan-macros">
              <span>Cal: <b>580</b></span>
              <span>P: <b>42g</b></span>
              <span>C: <b>48g</b></span>
              <span>F: <b>22g</b></span>
            </div>
            <div className="lp-demo__plan-log lp-demo__plan-log--logged">
              <Check size={13} /> Logged
            </div>
          </div>
          <div className="lp-demo__plan-meal">
            <div className="lp-demo__plan-slot">DINNER</div>
            <div className="lp-demo__plan-name">
              Baked Chicken Thighs with Quinoa and Roasted Vegetables
            </div>
            <div className="lp-demo__plan-macros">
              <span>Cal: <b>1220</b></span>
              <span>P: <b>62g</b></span>
              <span>C: <b>186g</b></span>
              <span>F: <b>29g</b></span>
            </div>
            <div className="lp-demo__plan-log lp-demo__plan-log--logged">
              <Check size={13} /> Logged
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- 2. Progress ---------- */
function DemoProgress() {
  /* Data points: day-offset from Apr 5, weight (lbs), body fat %, label */
  const data = [
    { day: 0,  w: 180.0, bf: 22.2, date: 'Apr 5'  },
    { day: 2,  w: 178.2, bf: 22.0, date: 'Apr 7'  },
    { day: 3,  w: 177.5, bf: 22.0, date: 'Apr 8'  },
    { day: 6,  w: 175.8, bf: 21.9, date: 'Apr 11' },
    { day: 10, w: 173.4, bf: 21.5, date: 'Apr 15' },
    { day: 15, w: 172.2, bf: 21.8, date: 'Apr 20' },
    { day: 20, w: 173.8, bf: 22.0, date: 'Apr 25' },
    { day: 24, w: 170.0, bf: 21.0, date: 'Apr 29' },
  ];

  const w = 720;
  const h = 230;
  const padL = 42;
  const padR = 48;
  const padT = 16;
  const padB = 36;
  const chartW = w - padL - padR;
  const chartH = h - padT - padB;

  const wMin = 165, wMax = 185;
  const weightY = (v) => padT + ((wMax - v) / (wMax - wMin)) * chartH;

  const bfMin = 19, bfMax = 24;
  const bfYFn = (v) => padT + ((bfMax - v) / (bfMax - bfMin)) * chartH;

  const totalDays = data[data.length - 1].day;
  const xFor = (day) => padL + (day / totalDays) * chartW;

  const weightPts = data.map((d) => [xFor(d.day), weightY(d.w)]);
  const bfPts     = data.map((d) => [xFor(d.day), bfYFn(d.bf)]);

  const weightPath = 'M ' + weightPts.map((p) => p.join(' ')).join(' L ');
  const bfPath     = 'M ' + bfPts.map((p) => p.join(' ')).join(' L ');

  const last = weightPts[weightPts.length - 1];
  const areaPath = `${weightPath} L ${last[0]} ${padT + chartH} L ${weightPts[0][0]} ${padT + chartH} Z`;

  const yTicksLeft  = [165, 170, 175, 180, 185];
  const yTicksRight = [19, 20, 21, 22, 23, 24];

  const ranges = ['2W', '1M', '3M', '6M', 'All'];

  return (
    <div className="lp-demo__panel">
      <h3 className="lp-demo__progress-head">
        <span className="lp-demo__progress-dot" />
        Progress
      </h3>

      <div className="lp-demo__stat-grid lp-demo__progress-stats">
        <div className="lp-demo__stat">
          <div className="lp-demo__stat-value lp-demo__stat-value--teal">+170.0 lbs</div>
          <div className="lp-demo__stat-sub">Current weight</div>
        </div>
        <div className="lp-demo__stat">
          <div className="lp-demo__stat-value lp-demo__stat-value--teal">+21.0%</div>
          <div className="lp-demo__stat-sub">Body fat %</div>
        </div>
        <div className="lp-demo__stat">
          <div className="lp-demo__stat-value lp-demo__stat-value--teal">-10.0 lbs</div>
          <div className="lp-demo__stat-sub">Weight change</div>
        </div>
        <div className="lp-demo__stat">
          <div className="lp-demo__stat-value lp-demo__stat-value--teal">-1.0%</div>
          <div className="lp-demo__stat-sub">BF% change</div>
        </div>
      </div>

      <div className="lp-demo__card">
        <svg
          viewBox={`0 0 ${w} ${h}`}
          className="lp-demo__chart-full"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="lpProgArea" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#1d9e75" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#1d9e75" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Horizontal gridlines aligned to weight ticks */}
          {yTicksLeft.map((tv) => (
            <line
              key={`g-${tv}`}
              x1={padL}
              x2={w - padR}
              y1={weightY(tv)}
              y2={weightY(tv)}
              stroke="rgba(255,255,255,0.05)"
              strokeDasharray="3 4"
            />
          ))}

          {/* Left Y-axis labels (weight) */}
          {yTicksLeft.map((tv) => (
            <text
              key={`l-${tv}`}
              x={padL - 8}
              y={weightY(tv) + 3}
              textAnchor="end"
              fontSize="10"
              fill="rgba(255,255,255,0.42)"
            >
              {tv}
            </text>
          ))}

          {/* Right Y-axis labels (BF%) */}
          {yTicksRight.map((tv) => (
            <text
              key={`r-${tv}`}
              x={w - padR + 8}
              y={bfYFn(tv) + 3}
              textAnchor="start"
              fontSize="10"
              fill="rgba(255,255,255,0.42)"
            >
              {tv}%
            </text>
          ))}

          {/* X-axis date labels */}
          {data.map((d) => (
            <text
              key={`x-${d.date}`}
              x={xFor(d.day)}
              y={padT + chartH + 18}
              textAnchor="middle"
              fontSize="10"
              fill="rgba(255,255,255,0.42)"
            >
              {d.date}
            </text>
          ))}

          {/* Weight area fill */}
          <path d={areaPath} fill="url(#lpProgArea)" />

          {/* Weight line (solid) */}
          <path
            d={weightPath}
            fill="none"
            stroke="#5dcaa5"
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {weightPts.map(([px, py], i) => (
            <circle
              key={`wpt-${i}`}
              cx={px}
              cy={py}
              r="3"
              fill="#0a0d12"
              stroke="#5dcaa5"
              strokeWidth="2"
            />
          ))}

          {/* BF% line (dashed) */}
          <path
            d={bfPath}
            fill="none"
            stroke="#5dcaa5"
            strokeWidth="1.8"
            strokeLinejoin="round"
            strokeLinecap="round"
            strokeDasharray="4 4"
          />
          {bfPts.map(([px, py], i) => (
            <circle
              key={`bpt-${i}`}
              cx={px}
              cy={py}
              r="2.5"
              fill="#0a0d12"
              stroke="#5dcaa5"
              strokeWidth="1.6"
            />
          ))}
        </svg>

        <div className="lp-demo__chart-legend">
          <span className="lp-demo__chart-legend-item">
            <span className="lp-demo__chart-legend-marker lp-demo__chart-legend-marker--dashed" />
            BF%
          </span>
          <span className="lp-demo__chart-legend-item">
            <span className="lp-demo__chart-legend-marker lp-demo__chart-legend-marker--solid" />
            Weight (lbs)
          </span>
        </div>

        <div className="lp-demo__range-pills">
          {ranges.map((r) => (
            <button
              key={r}
              type="button"
              className={`lp-demo__range-pill ${r === '1M' ? 'is-active' : ''}`}
              onClick={preventClick}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <div className="lp-demo__card">
        <h4 className="lp-demo__card-heading">Add entry</h4>
        <div className="lp-demo__progress-add">
          <div className="lp-demo__field">
            <label>Date</label>
            <input readOnly value="04/22/2026" tabIndex={-1} />
          </div>
          <div className="lp-demo__field">
            <label>Weight (lbs)</label>
            <input readOnly placeholder="e.g. 180" tabIndex={-1} />
          </div>
          <div className="lp-demo__field">
            <label>Body Fat %</label>
            <input readOnly placeholder="e.g. 16.8" tabIndex={-1} />
          </div>
          <Locked>
            <button type="button" className="lp-demo__ghost-btn lp-demo__progress-save">
              Save
            </button>
          </Locked>
        </div>
        <p className="lp-demo__form-caption">
          Entries are unique per date — saves will overwrite that day.
        </p>
      </div>

      <div className="lp-demo__card">
        <h4 className="lp-demo__card-heading">History</h4>
        <div className="lp-demo__history">
          <div className="lp-demo__history-head">
            <span>Date</span>
            <span>Weight (lbs)</span>
            <span>Body Fat %</span>
            <span />
          </div>
          <div className="lp-demo__history-row">
            <span>2026-04-29</span>
            <span>170</span>
            <span>21</span>
            <Locked>
              <button
                type="button"
                className="lp-demo__history-del"
                aria-label="Delete entry"
              >
                <Trash2 size={13} />
              </button>
            </Locked>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- 3. Meal Planner ---------- */
function DemoMealPlanner() {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const meals = [
    { slot: 'BREAKFAST', name: 'Protein Smoothie Bowl', kcal: 580, p: 42, c: 62, f: 18 },
    { slot: 'LUNCH',     name: 'Chicken Rice Bowl',     kcal: 720, p: 55, c: 78, f: 16 },
    { slot: 'DINNER',    name: 'Salmon & Roasted Veg',  kcal: 640, p: 48, c: 40, f: 30 },
    { slot: 'SNACK',     name: 'Greek Yogurt + Berries',kcal: 200, p: 20, c: 18, f: 4 },
  ];

  return (
    <div className="lp-demo__panel">
      <div className="lp-demo__panel-header">
        <div>
          <div className="lp-demo__eyebrow">MEAL PLANNER</div>
          <h3 className="lp-demo__title">Weekly AI meal plan</h3>
        </div>
        <Locked>
          <button type="button" className="lp-demo__cta-btn">
            <Sparkles size={13} /> Generate new meals
          </button>
        </Locked>
      </div>

      <div className="lp-demo__day-pills">
        {days.map((d) => (
          <button
            key={d}
            type="button"
            className={`lp-demo__day-pill ${d === 'Thu' ? 'is-active' : ''}`}
            onClick={preventClick}
          >
            {d}
          </button>
        ))}
      </div>

      <div className="lp-demo__meals">
        {meals.map((m) => (
          <div key={m.slot} className="lp-demo__meal-card">
            <div className="lp-demo__meal-head">
              <span className="lp-demo__meal-slot">{m.slot}</span>
              <span className="lp-demo__meal-kcal">{m.kcal} kcal</span>
            </div>
            <div className="lp-demo__meal-name">{m.name}</div>
            <div className="lp-demo__meal-macros">
              <span><b>{m.p}</b>g protein</span>
              <span><b>{m.c}</b>g carbs</span>
              <span><b>{m.f}</b>g fat</span>
            </div>
            <div className="lp-demo__meal-actions">
              <Locked>
                <button type="button" className="lp-demo__icon-btn" aria-label="Save meal">
                  <Bookmark size={12} />
                </button>
              </Locked>
              <Locked>
                <button type="button" className="lp-demo__icon-btn" aria-label="Duplicate meal">
                  <Copy size={12} />
                </button>
              </Locked>
              <Locked>
                <button type="button" className="lp-demo__icon-btn" aria-label="Remove meal">
                  <Trash2 size={12} />
                </button>
              </Locked>
            </div>
          </div>
        ))}
      </div>

      <div className="lp-demo__meals-summary">
        <span>DAILY TOTAL</span>
        <span className="lp-demo__meals-total">2,140 kcal</span>
        <span className="lp-demo__meals-goal">/ 2,180 goal</span>
      </div>
    </div>
  );
}

/* ---------- 4. Goal Planner ---------- */
function DemoGoalPlanner() {
  return (
    <div className="lp-demo__panel">
      <div className="lp-demo__panel-header">
        <div>
          <div className="lp-demo__eyebrow">GOAL PLANNER</div>
          <h3 className="lp-demo__title">Your active phase</h3>
        </div>
      </div>

      {/* Top phase card */}
      <div className="lp-demo__phase-card">
        <div className="lp-demo__phase-head">
          <div>
            <div className="lp-demo__phase-title">Cutting Phase</div>
            <div className="lp-demo__phase-meta">5 weeks · 2180 kcal/day</div>
          </div>
          <span className="lp-demo__phase-active">Active</span>
        </div>

        <div className="lp-demo__phase-bars">
          <div className="lp-demo__phase-bar-row">
            <span className="lp-demo__phase-bar-label">Protein</span>
            <div className="lp-demo__phase-bar-track">
              <div className="lp-demo__phase-bar-fill" style={{ width: '42%' }} />
            </div>
            <span className="lp-demo__phase-bar-val">120g</span>
          </div>
          <div className="lp-demo__phase-bar-row">
            <span className="lp-demo__phase-bar-label">Carbs</span>
            <div className="lp-demo__phase-bar-track">
              <div className="lp-demo__phase-bar-fill" style={{ width: '100%' }} />
            </div>
            <span className="lp-demo__phase-bar-val">288g</span>
          </div>
          <div className="lp-demo__phase-bar-row">
            <span className="lp-demo__phase-bar-label">Fat</span>
            <div className="lp-demo__phase-bar-track">
              <div className="lp-demo__phase-bar-fill" style={{ width: '21%' }} />
            </div>
            <span className="lp-demo__phase-bar-val">61g</span>
          </div>
        </div>

        <div className="lp-demo__phase-footer">
          <Locked>
            <button type="button" className="lp-demo__ghost-btn">Edit goal</button>
          </Locked>
        </div>
      </div>

      {/* Timeline + Targets row */}
      <div className="lp-demo__goal-split">
        <div className="lp-demo__card">
          <div className="lp-demo__card-title">GOAL TIMELINE</div>
          <div className="lp-demo__timeline-head">
            Week 3 <span className="lp-demo__timeline-of">of 5</span>
          </div>
          <div className="lp-demo__goal-bar">
            <div className="lp-demo__goal-bar-fill" style={{ width: '40%' }} />
          </div>
          <div className="lp-demo__timeline-meta">
            <span>40% complete</span>
            <span>21 days left</span>
          </div>
          <p className="lp-demo__timeline-tip">
            <em>Stay consistent — every deficit counts.</em>
          </p>
        </div>

        <div className="lp-demo__card">
          <div className="lp-demo__card-title">MACRO TARGETS</div>
          <div className="lp-demo__targets-grid">
            <div className="lp-demo__target">
              <span className="lp-demo__target-val">
                2180<small>kcal</small>
              </span>
              <span className="lp-demo__target-lbl">Calories</span>
            </div>
            <div className="lp-demo__target">
              <span className="lp-demo__target-val">
                120<small>g</small>
              </span>
              <span className="lp-demo__target-lbl">Protein</span>
            </div>
            <div className="lp-demo__target">
              <span className="lp-demo__target-val">
                288<small>g</small>
              </span>
              <span className="lp-demo__target-lbl">Carbs</span>
            </div>
            <div className="lp-demo__target">
              <span className="lp-demo__target-val">
                61<small>g</small>
              </span>
              <span className="lp-demo__target-lbl">Fat</span>
            </div>
          </div>
        </div>
      </div>

      {/* Log + Today's log row */}
      <div className="lp-demo__goal-split">
        <div className="lp-demo__card">
          <div className="lp-demo__card-title">LOG TODAY&apos;S NUTRITION</div>
          <div className="lp-demo__log-tabs">
            <button
              type="button"
              className="lp-demo__log-tab is-active"
              onClick={preventClick}
            >
              Manual Entry
            </button>
            <button
              type="button"
              className="lp-demo__log-tab"
              onClick={preventClick}
            >
              Food Search
            </button>
          </div>
          <div className="lp-demo__log-grid">
            <div className="lp-demo__field">
              <label>Calories (kcal)</label>
              <input readOnly value="0" tabIndex={-1} />
            </div>
            <div className="lp-demo__field">
              <label>Protein (g)</label>
              <input readOnly value="0" tabIndex={-1} />
            </div>
            <div className="lp-demo__field">
              <label>Carbs (g)</label>
              <input readOnly value="0" tabIndex={-1} />
            </div>
            <div className="lp-demo__field">
              <label>Fat (g)</label>
              <input readOnly value="0" tabIndex={-1} />
            </div>
          </div>
          <div className="lp-demo__field lp-demo__field--full">
            <input
              readOnly
              placeholder="e.g. Breakfast, Lunch, Snack"
              tabIndex={-1}
            />
          </div>
        </div>

        <div className="lp-demo__card">
          <div className="lp-demo__card-title">TODAY&apos;S LOG</div>
          <div className="lp-demo__empty">
            No entries yet. Log your first meal above.
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- 7. Calculators ---------- */
function DemoCalculators() {
  return (
    <div className="lp-demo__panel">
      <div className="lp-demo__panel-header">
        <div>
          <div className="lp-demo__eyebrow">CALCULATORS</div>
          <h3 className="lp-demo__title">Quick fitness calculators</h3>
        </div>
      </div>

      <div className="lp-demo__calc-grid">
        <Locked>
          <div className="lp-demo__calc-card">
            <span
              className="lp-demo__calc-icon"
              style={{ background: 'rgba(124, 58, 237, 0.14)', color: '#a78bfa' }}
            >
              <ChartPie size={20} />
            </span>
            <div className="lp-demo__calc-copy">
              <div className="lp-demo__calc-title">Macro Calculator</div>
              <div className="lp-demo__calc-sub">Nutrition &amp; macros</div>
              <p className="lp-demo__calc-desc">
                Personalized daily calorie target with a full protein, carbs, and fat
                breakdown for your body and goal.
              </p>
            </div>
          </div>
        </Locked>

        <Locked>
          <div className="lp-demo__calc-card">
            <span
              className="lp-demo__calc-icon"
              style={{ background: 'rgba(29, 158, 117, 0.14)', color: '#5dcaa5' }}
            >
              <Trophy size={20} />
            </span>
            <div className="lp-demo__calc-copy">
              <div className="lp-demo__calc-title">1RM Calculator</div>
              <div className="lp-demo__calc-sub">Strength estimation</div>
              <p className="lp-demo__calc-desc">
                Estimate your one-rep max with Epley, Brzycki, and Lombardi
                formulas side-by-side.
              </p>
            </div>
          </div>
        </Locked>
      </div>

      <div className="lp-demo__card">
        <div className="lp-demo__card-title">MACRO CALCULATOR · SAMPLE RESULT</div>
        <div className="lp-demo__calc-inputs">
          <span className="lp-demo__calc-pill">Male · 28</span>
          <span className="lp-demo__calc-pill">5&apos;10&quot; · 178 lb</span>
          <span className="lp-demo__calc-pill">Moderately active</span>
          <span className="lp-demo__calc-pill">Cut (−500 kcal)</span>
        </div>
        <div className="lp-demo__tdee-chips">
          <div className="lp-demo__tdee">
            <span className="lp-demo__tdee-val">2,180</span>
            <span className="lp-demo__tdee-lbl">Target (kcal)</span>
          </div>
          <div className="lp-demo__tdee">
            <span className="lp-demo__tdee-val">218g</span>
            <span className="lp-demo__tdee-lbl">Protein</span>
          </div>
          <div className="lp-demo__tdee">
            <span className="lp-demo__tdee-val">218g</span>
            <span className="lp-demo__tdee-lbl">Carbs</span>
          </div>
          <div className="lp-demo__tdee">
            <span className="lp-demo__tdee-val">48g</span>
            <span className="lp-demo__tdee-lbl">Fat</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- 5. Workouts ---------- */
function DemoWorkouts() {
  const exercises = [
    {
      name: 'Bench Press',
      sets: [
        { w: 145, r: 12 },
        { w: 155, r: 10 },
        { w: 155, r: 8 },
        { w: 155, r: 8 },
      ],
    },
    {
      name: 'Incline Chest Machine',
      sets: [
        { w: 45, r: 12 },
        { w: 55, r: 12 },
        { w: 55, r: 12 },
      ],
    },
    {
      name: 'Decline Chest Machine',
      sets: [
        { w: 60, r: 10 },
        { w: 60, r: 10 },
        { w: 60, r: 10 },
      ],
    },
    {
      name: 'Pull-Up Assist',
      sets: [
        { w: 40, r: 10 },
        { w: 40, r: 10 },
        { w: 40, r: 8 },
      ],
    },
    {
      name: 'Seated Row',
      sets: [
        { w: 100, r: 12 },
        { w: 110, r: 10 },
        { w: 110, r: 10 },
      ],
    },
  ];

  return (
    <div className="lp-demo__panel">
      <h3 className="lp-demo__progress-head">
        <span className="lp-demo__progress-dot" />
        Workouts
      </h3>

      {/* Log a workout card */}
      <div className="lp-demo__card lp-demo__workout-log-card">
        <h4 className="lp-demo__workout-log-title">Log a workout</h4>
        <Locked>
          <button type="button" className="lp-demo__new-workout-btn">
            + New workout
          </button>
        </Locked>
      </div>

      {/* History / Templates tabs */}
      <div className="lp-demo__workout-tabs">
        <button
          type="button"
          className="lp-demo__workout-tab is-active"
          onClick={preventClick}
        >
          History
        </button>
        <button
          type="button"
          className="lp-demo__workout-tab"
          onClick={preventClick}
        >
          Templates
        </button>
      </div>

      {/* Workout entry header */}
      <div className="lp-demo__workout-entry">
        <div className="lp-demo__workout-entry-head">
          <div className="lp-demo__workout-entry-title">
            <div className="lp-demo__workout-name">Upper Body (Chest &amp; Back)</div>
            <div className="lp-demo__workout-date">Apr 18, 2026</div>
          </div>
          <div className="lp-demo__workout-actions">
            <span className="lp-demo__workout-count">5 exercises</span>
            <Locked>
              <button type="button" className="lp-demo__workout-edit">
                Edit
              </button>
            </Locked>
            <Locked>
              <button
                type="button"
                className="lp-demo__workout-icon-btn"
                aria-label="Save as template"
              >
                <Bookmark size={14} />
              </button>
            </Locked>
            <Locked>
              <button
                type="button"
                className="lp-demo__workout-icon-btn"
                aria-label="Duplicate workout"
              >
                <Copy size={14} />
              </button>
            </Locked>
            <Locked>
              <button
                type="button"
                className="lp-demo__workout-icon-btn lp-demo__workout-icon-btn--danger"
                aria-label="Delete workout"
              >
                <Trash2 size={14} />
              </button>
            </Locked>
          </div>
        </div>
      </div>

      {/* Exercise tables */}
      <div className="lp-demo__card lp-demo__exercise-tables">
        {exercises.map((ex) => (
          <div key={ex.name} className="lp-demo__exercise-block">
            <h5 className="lp-demo__exercise-header">{ex.name}</h5>
            <div className="lp-demo__set-table-head">
              <span>Set</span>
              <span>Weight</span>
              <span>Reps</span>
              <span>Notes</span>
            </div>
            {ex.sets.map((s, i) => (
              <div key={i} className="lp-demo__set-table-row">
                <span>{i + 1}</span>
                <span>{s.w}</span>
                <span>{s.r}</span>
                <span />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- 6. Measurements ---------- */
function DemoMeasurements() {
  return (
    <div className="lp-demo__panel">
      <div className="lp-demo__panel-header">
        <div>
          <div className="lp-demo__eyebrow">MEASUREMENTS</div>
          <h3 className="lp-demo__title">Body composition analyzer</h3>
        </div>
      </div>

      <div className="lp-demo__card">
        <div className="lp-demo__form-grid">
          <div className="lp-demo__field">
            <label>Gender</label>
            <input readOnly value="Male" tabIndex={-1} />
          </div>
          <div className="lp-demo__field">
            <label>Age</label>
            <input readOnly value="28" tabIndex={-1} />
          </div>
          <div className="lp-demo__field">
            <label>Height</label>
            <input readOnly value={`5' 10"`} tabIndex={-1} />
          </div>
          <div className="lp-demo__field">
            <label>Weight</label>
            <input readOnly value="178 lb" tabIndex={-1} />
          </div>
          <div className="lp-demo__field">
            <label>Waist</label>
            <input readOnly value="32 in" tabIndex={-1} />
          </div>
          <div className="lp-demo__field">
            <label>Hip</label>
            <input readOnly value="38 in" tabIndex={-1} />
          </div>
          <div className="lp-demo__field">
            <label>Activity level</label>
            <input readOnly value="Moderately active" tabIndex={-1} />
          </div>
          <div className="lp-demo__field">
            <label>Goal</label>
            <input readOnly value="Cut (−500 kcal)" tabIndex={-1} />
          </div>
        </div>
        <div className="lp-demo__form-footer">
          <Locked>
            <button type="button" className="lp-demo__cta-btn">Analyze measurements</button>
          </Locked>
        </div>
      </div>

      <div className="lp-demo__card">
        <div className="lp-demo__card-title">RESULTS</div>
        <div className="lp-demo__result-row">
          <strong>Estimated body fat:</strong>&nbsp;16.2%
        </div>
        <div className="lp-demo__result-row">
          <strong>Body type:</strong>&nbsp;<span className="lp-demo__badge">Athletic</span>
        </div>
        <div className="lp-demo__tdee-chips">
          <div className="lp-demo__tdee">
            <span className="lp-demo__tdee-val">1,742</span>
            <span className="lp-demo__tdee-lbl">BMR (kcal)</span>
          </div>
          <div className="lp-demo__tdee">
            <span className="lp-demo__tdee-val">2,700</span>
            <span className="lp-demo__tdee-lbl">TDEE (kcal)</span>
          </div>
          <div className="lp-demo__tdee">
            <span className="lp-demo__tdee-val">2,180</span>
            <span className="lp-demo__tdee-lbl">Target (kcal)</span>
          </div>
          <div className="lp-demo__tdee">
            <span className="lp-demo__tdee-val" style={{ color: '#f87171' }}>−500</span>
            <span className="lp-demo__tdee-lbl">Deficit</span>
          </div>
        </div>
        <p className="lp-demo__disclaimer">
          Calculated using your body composition data for a more personalized estimate.
        </p>
      </div>
    </div>
  );
}

/* ---------- Shell ---------- */
function LiveDemo() {
  const [tab, setTab] = useState('home');

  let Panel;
  switch (tab) {
    case 'measurements': Panel = DemoMeasurements; break;
    case 'progress':     Panel = DemoProgress;     break;
    case 'calculators':  Panel = DemoCalculators;  break;
    case 'meal':         Panel = DemoMealPlanner;  break;
    case 'goal':         Panel = DemoGoalPlanner;  break;
    case 'workouts':     Panel = DemoWorkouts;     break;
    case 'home':
    default:             Panel = DemoHome;         break;
  }

  return (
    <section className="lp-demo" id="live-demo">
      <div className="lp-demo__header">
        <span className="lp-demo__section-eyebrow">LIVE DEMO</span>
        <h2 className="lp-demo__section-heading">See the app before you sign up</h2>
        <p className="lp-demo__section-sub">
          Click through a full walkthrough of MacroVault&apos;s Pro+ features. Every screen below
          is loaded with sample data so you can explore without signing in.
        </p>
      </div>

      <div className="lp-demo__shell">
        {/* Floating Demo mode badge — anchored to the top-right of the demo box */}
        <div className="lp-demo__shell-badge" aria-label="Demo mode">
          <span className="lp-demo__sidebar-badge-dot" />
          Demo mode
        </div>

        {/* Desktop sidebar */}
        <aside className="lp-demo__sidebar">
          <div className="lp-demo__brand">
            <span className="lp-demo__brand-icon"><Lock size={12} /></span>
            <span className="lp-demo__brand-name">MacroVault</span>
          </div>

          <nav className="lp-demo__nav" aria-label="Demo sections">
            {DEMO_NAV.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                className={`lp-demo__nav-btn ${tab === id ? 'is-active' : ''}`}
                onClick={() => setTab(id)}
              >
                <Icon size={15} />
                <span>{label}</span>
              </button>
            ))}
          </nav>

          {/* Spacer pushes user card + theme dots to the bottom */}
          <div className="lp-demo__sidebar-spacer" />

          {/* User card — mirrors app sidebar's user row (locked in demo) */}
          <div className="lp-demo__user-card">
            <div className="lp-demo__user-avatar" aria-hidden="true" />
            <div className="lp-demo__user-info">
              <span className="lp-demo__user-name">User</span>
              <span className="lp-demo__user-badge">
                <Crown size={10} /> Pro+
              </span>
            </div>
            <Locked tip="Sign up to manage your account">
              <button
                type="button"
                className="lp-demo__user-logout"
                aria-label="Sign out"
              >
                <LogOut size={14} />
              </button>
            </Locked>
          </div>

          {/* Theme color dots — matches app's quick theme switcher */}
          <div className="lp-demo__theme-dots" aria-label="Color theme">
            {DEMO_THEME_DOTS.map((t) => (
              <Locked key={t.id} tip="Sign up to change themes">
                <span
                  className={`lp-demo__theme-dot ${t.id === 'teal' ? 'is-active' : ''}`}
                  style={{ background: t.color }}
                  role="button"
                  aria-label={`${t.id} theme`}
                />
              </Locked>
            ))}
            <span className="lp-demo__theme-more" aria-hidden="true">
              <span /><span /><span />
            </span>
          </div>
        </aside>

        {/* Mobile horizontal pill tabs */}
        <div className="lp-demo__pills" role="tablist" aria-label="Demo sections (mobile)">
          {DEMO_NAV.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              className={`lp-demo__pill ${tab === id ? 'is-active' : ''}`}
              onClick={() => setTab(id)}
            >
              <Icon size={13} />
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="lp-demo__main">
          <Panel />
        </div>
      </div>

      {/* Bottom CTA */}
      <div className="lp-demo__cta-banner">
        <div className="lp-demo__cta-copy">
          <h3 className="lp-demo__cta-heading">Ready to track your own stats?</h3>
          <p className="lp-demo__cta-sub">
            Create a free account and start logging in under 60 seconds.
          </p>
        </div>
        <Link to="/auth" className="lp-demo__cta-primary">
          Create free account
        </Link>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Pricing                                                            */
/* ------------------------------------------------------------------ */

function Pricing() {
  const navigate = useNavigate();

  return (
    <section className="lp-pricing" id="pricing">
      <div className="lp-pricing__header">
        <span className="lp-pricing__eyebrow">PRICING</span>
        <h2 className="lp-pricing__heading">Simple, transparent pricing</h2>
        <p className="lp-pricing__sub">Start free, upgrade when you&apos;re ready. No hidden fees.</p>
      </div>

      <div className="lp-pricing__cards">
        {/* Free */}
        <div className="lp-price-card">
          <div className="lp-price-card__tier">FREE</div>
          <div className="lp-price-card__price">
            <span className="lp-price-card__amount">$0</span>
          </div>
          <div className="lp-price-card__tag">
            Everything you need to get started.
          </div>
          <div className="lp-price-card__divider" />
          <ul className="lp-price-card__list">
            {FREE_FEATURES.map((f) => (
              <li key={f} className="lp-price-card__item">
                <Check size={14} className="lp-price-card__check" />
                {f}
              </li>
            ))}
          </ul>
          <button
            className="lp-price-card__cta lp-price-card__cta--outline"
            onClick={() => navigate('/auth')}
          >
            Get started
          </button>
        </div>

        {/* Pro */}
        <div className="lp-price-card lp-price-card--featured">
          <div className="lp-price-card__badge lp-price-card__badge--popular">MOST POPULAR</div>
          <div className="lp-price-card__tier lp-price-card__tier--accent">PRO</div>
          <div className="lp-price-card__price">
            <span className="lp-price-card__amount">$4.99</span>
            <span className="lp-price-card__period">/mo</span>
          </div>
          <div className="lp-price-card__tag">
            Unlock the full MacroVault experience with no limits.
          </div>
          <div className="lp-price-card__divider" />
          <ul className="lp-price-card__list">
            {PRO_FEATURES.map((f) => (
              <li key={f} className="lp-price-card__item">
                <Check size={14} className="lp-price-card__check" />
                {f}
              </li>
            ))}
          </ul>
          <button
            className="lp-price-card__cta lp-price-card__cta--solid"
            onClick={() => navigate('/auth')}
          >
            Upgrade to Pro
          </button>
        </div>

        {/* Pro+ */}
        <div className="lp-price-card">
          <div className="lp-price-card__badge lp-price-card__badge--value">BEST VALUE</div>
          <div className="lp-price-card__tier">PRO+</div>
          <div className="lp-price-card__price">
            <span className="lp-price-card__amount">$9.99</span>
            <span className="lp-price-card__period">/mo</span>
          </div>
          <div className="lp-price-card__tag">
            Everything in Pro plus AI-powered meal planning.
          </div>
          <div className="lp-price-card__divider" />
          <ul className="lp-price-card__list">
            {PRO_PLUS_FEATURES.map((f) => (
              <li key={f} className="lp-price-card__item">
                <Check size={14} className="lp-price-card__check" />
                {f}
              </li>
            ))}
          </ul>
          <button
            className="lp-price-card__cta lp-price-card__cta--solid"
            onClick={() => navigate('/auth')}
          >
            Upgrade to Pro+
          </button>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Final CTA                                                          */
/* ------------------------------------------------------------------ */

function FinalCTA() {
  const navigate = useNavigate();
  return (
    <section className="lp-cta">
      <span className="lp-cta__eyebrow">READY TO START?</span>
      <h2 className="lp-cta__heading">
        <span>Stop guessing. </span>
        <span className="lp-cta__heading--accent">Start tracking.</span>
      </h2>
      <p className="lp-cta__sub">Free forever. No credit card required.</p>
      <button className="lp-cta__btn" onClick={() => navigate('/auth')}>
        Create your free account
      </button>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Footer (preserved)                                                 */
/* ------------------------------------------------------------------ */

function Footer() {
  return (
    <footer className="lp-footer">
      <div className="lp-footer__inner">
        <div className="lp-footer__top">
          <div className="lp-footer__brand">
            <Link to="/" className="lp-footer__logo">
              <span className="lp-footer__logo-icon"><Lock size={14} /></span>
              <span className="lp-footer__logo-name">MacroVault</span>
            </Link>
            <p className="lp-footer__tagline">Data-driven fitness for everyone.</p>
          </div>

          <div className="lp-footer__links">
            <Link to="/about" className="lp-footer__link">About</Link>
            <Link to="/help" className="lp-footer__link">Contact</Link>
            <a href="#pricing" className="lp-footer__link">Pricing</a>
          </div>
        </div>

      </div>
    </footer>
  );
}

/* ------------------------------------------------------------------ */
/* Legal footer — copyright + Terms / Privacy links                   */
/* ------------------------------------------------------------------ */

function LegalFooter() {
  return (
    <div className="legal-footer legal-footer--landing">
      <p className="legal-footer__copy">
        &copy; 2026 MacroVault. All rights reserved.
      </p>
      <div className="legal-footer__links">
        <Link to="/terms" className="legal-footer__link">Terms of Service</Link>
        <span className="legal-footer__sep" aria-hidden="true">·</span>
        <Link to="/privacy" className="legal-footer__link">Privacy Policy</Link>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                               */
/* ------------------------------------------------------------------ */

export default function LandingPage() {
  const navigate = useNavigate();

  // Redirect authenticated users to /home (preserved)
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data?.session) navigate('/home', { replace: true });
    });
  }, [navigate]);

  return (
    <div className="lp-page">
      <Navbar />
      <main>
        <Hero />
        <FeatureStrip />
        <Features />
        <LiveDemo />
        <Pricing />
        <FinalCTA />
      </main>
      <Footer />
      <LegalFooter />
    </div>
  );
}

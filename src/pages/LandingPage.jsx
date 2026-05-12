import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  motion,
  useReducedMotion,
  useMotionValue,
  useSpring,
  useTransform,
} from 'framer-motion';
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

/* Hero display headline, split per-word for the entrance stagger.
   A line can flag `italic: true` to wrap each word in <em> (unused in
   current copy but kept for future headings), or `accent: true` to
   apply `.lp-display__accent` (teal) to every word in the line. */
const HEADLINE_LINES = [
  { words: ['Made', 'for', 'people'], italic: false },
  { words: ['who', 'track'], italic: false },
  { words: ['everything.'], italic: false, accent: true },
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

  /* Cursor-tracked spotlight on the hero background. Writes the
     cursor position (as a percentage of the hero's bounding box)
     to --lp-spotlight-x / --lp-spotlight-y CSS custom properties.
     Updates are throttled via requestAnimationFrame so we update
     at most once per paint. Reduced-motion is handled in CSS
     (the spotlight layers are display:none in that media query),
     so this listener stays attached either way — it just has
     nothing visible to drive. */
  useEffect(() => {
    const hero = document.querySelector('.lp-hero');
    if (!hero) return;

    let rafId = null;
    let pendingX = null;
    let pendingY = null;

    const updateSpotlight = () => {
      if (pendingX !== null && pendingY !== null) {
        hero.style.setProperty('--lp-spotlight-x', pendingX + '%');
        hero.style.setProperty('--lp-spotlight-y', pendingY + '%');
      }
      rafId = null;
    };

    const handleMove = (e) => {
      const rect = hero.getBoundingClientRect();
      pendingX = ((e.clientX - rect.left) / rect.width) * 100;
      pendingY = ((e.clientY - rect.top) / rect.height) * 100;
      if (rafId === null) {
        rafId = requestAnimationFrame(updateSpotlight);
      }
    };

    hero.addEventListener('mousemove', handleMove);
    return () => {
      hero.removeEventListener('mousemove', handleMove);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <section className="lp-hero" id="hero">
      {/* Decorative background layers — render first so they sit
          behind all hero content. Spotlight x/y are driven by the
          mousemove useEffect above; ambient-drift is CSS-animated. */}
      <div className="lp-hero__spotlight-bright-grid" aria-hidden="true" />
      <div className="lp-hero__spotlight-glow" aria-hidden="true" />
      <div className="lp-hero__ambient-drift" aria-hidden="true" />
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
          <motion.div className="lp-kicker" {...fadeUp(0.1)}>
            <span className="lp-kicker__dot" />
            <span>Lift. Eat. Track. Repeat.</span>
          </motion.div>

          <h1 className="lp-display">
            {HEADLINE_LINES.map((line, lineIdx) => (
              <span key={lineIdx} style={{ display: 'block' }}>
                {line.words.map((word, wordIdx) => {
                  const globalIdx = HEADLINE_LINES
                    .slice(0, lineIdx)
                    .reduce((acc, l) => acc + l.words.length, 0) + wordIdx;
                  const wordEl = (
                    <motion.span
                      key={wordIdx}
                      className={line.accent ? 'lp-display__accent' : undefined}
                      style={{ display: 'inline-block', marginRight: '0.25em' }}
                      initial={reduced ? false : { opacity: 0, y: 24 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        delay: reduced ? 0 : globalIdx * 0.05,
                        duration: 0.7,
                        ease: [0.22, 1, 0.36, 1],
                      }}
                    >
                      {word}
                    </motion.span>
                  );
                  return line.italic ? <em key={wordIdx}>{wordEl}</em> : wordEl;
                })}
              </span>
            ))}
          </h1>

          <motion.p className="lp-lead" {...fadeUp(0.4)}>
            Most fitness apps optimize for motivation. MacroVault optimizes for the spreadsheet underneath it. Track macros, log lifts, model body comp.
          </motion.p>

          <motion.div className="lp-hero__ctas" {...fadeUp(0.55)}>
            <motion.button
              className="lp-hero__cta-primary"
              whileHover={reduced ? {} : { y: -1, boxShadow: '0 12px 28px -10px rgba(29, 158, 117, 0.55)' }}
              whileTap={reduced ? {} : { scale: 0.97 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              onClick={() => navigate('/auth')}
            >
              Start tracking
            </motion.button>
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
              Open the live demo
            </a>
          </motion.div>

          <motion.div className="lp-hero__stats-wrap" {...fadeUp(0.7)}>
            <div className="lp-hero__stats">
              <div className="lp-hero__stat">
                <div className="lp-hero__stat-index">01</div>
                <div className="lp-hero__stat-label">Log lifts</div>
                <div className="lp-hero__stat-detail">sets, reps, weight</div>
              </div>
              <div className="lp-vrule" />
              <div className="lp-hero__stat">
                <div className="lp-hero__stat-index">02</div>
                <div className="lp-hero__stat-label">Track progress</div>
                <div className="lp-hero__stat-detail">weight & body comp</div>
              </div>
              <div className="lp-vrule" />
              <div className="lp-hero__stat">
                <div className="lp-hero__stat-index">03</div>
                <div className="lp-hero__stat-label">Plan meals with AI</div>
                <div className="lp-hero__stat-detail">macro-fit suggestions</div>
              </div>
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
/* Cursor-tracked perspective tilt wrapper for the dashboard frame    */
/* ------------------------------------------------------------------ */

function TiltedPreviewFrame({ children }) {
  const reduceMotion = useReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotateY = useSpring(useTransform(x, [-0.5, 0.5], [-14, -2]), { stiffness: 150, damping: 20 });
  const rotateX = useSpring(useTransform(y, [-0.5, 0.5], [10, -2]), { stiffness: 150, damping: 20 });

  if (reduceMotion) {
    return <div className="lp-preview__frame">{children}</div>;
  }

  const handleMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    x.set((e.clientX - rect.left) / rect.width - 0.5);
    y.set((e.clientY - rect.top) / rect.height - 0.5);
  };

  const handleLeave = () => { x.set(0); y.set(0); };

  return (
    <motion.div
      className="lp-preview__frame"
      style={{ rotateX, rotateY, transformPerspective: 1800 }}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
    >
      {children}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* Dashboard preview mockup                                           */
/* ------------------------------------------------------------------ */

function DashboardPreview({ reduced }) {
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
      <TiltedPreviewFrame>
        {/* Action-first dashboard snapshot — mirrors the shipped
            .hd-desktop layout (greeting / 3 action cards / nutrition /
            status row). All values are intentional marketing copy. */}
        <div className="lp-preview__body lp-preview-v2-body">
          {/* Greeting bar */}
          <div className="lp-preview-v2-greeting">
            <div className="lp-preview-v2-greeting__left">
              <div className="lp-preview-v2-kicker">
                <span className="lp-preview-v2-kicker__dot" />
                <span>MONDAY · 2:47 PM</span>
              </div>
              <div className="lp-preview-v2-heading">Afternoon.</div>
              <div className="lp-preview-v2-sub">
                You're <span className="lp-preview-v2-sub__accent">540 kcal under</span>. Lunch is the next big window.
              </div>
            </div>
            <div className="lp-preview-v2-streak-pill">
              <span aria-hidden="true">🔥</span>
              <span className="lp-preview-v2-streak-pill__num">11</span>
              <span className="lp-preview-v2-streak-pill__label">day streak</span>
            </div>
          </div>

          {/* Three action cards */}
          <div className="lp-preview-v2-actions">
            <div className="lp-preview-v2-action lp-preview-v2-action--primary">
              <div className="lp-preview-v2-action__kicker">LOG A MEAL</div>
              <div className="lp-preview-v2-action__row">
                <span className="lp-preview-v2-action__title">Lunch</span>
                <span className="lp-preview-v2-action__arrow">→</span>
              </div>
              <div className="lp-preview-v2-action__sub">scan, search, or pick from your plan</div>
            </div>
            <div className="lp-preview-v2-action">
              <div className="lp-preview-v2-action__kicker">LOG A WORKOUT</div>
              <div className="lp-preview-v2-action__row">
                <span className="lp-preview-v2-action__title">Push day</span>
                <span className="lp-preview-v2-action__arrow">→</span>
              </div>
              <div className="lp-preview-v2-action__sub">on your schedule · 8 exercises</div>
            </div>
            <div className="lp-preview-v2-action">
              <div className="lp-preview-v2-action__kicker">LOG WEIGHT</div>
              <div className="lp-preview-v2-action__row">
                <span className="lp-preview-v2-action__title">Daily</span>
                <span className="lp-preview-v2-action__arrow">→</span>
              </div>
              <div className="lp-preview-v2-action__sub">last logged 1d ago · 174 lb</div>
            </div>
          </div>

          {/* Today's nutrition */}
          <div className="lp-preview-v2-nutrition">
            <div className="lp-preview-v2-nutrition__head">
              <div>
                <div className="lp-preview-v2-nutrition__label">TODAY'S NUTRITION</div>
                <div className="lp-preview-v2-nutrition__kcal">
                  <span className="lp-preview-v2-nutrition__kcal-current">1,640</span>
                  <span className="lp-preview-v2-nutrition__kcal-target">/ 2,180 kcal</span>
                </div>
              </div>
              <div className="lp-preview-v2-nutrition__pills">
                <span className="lp-preview-v2-nutrition__pill lp-preview-v2-nutrition__pill--active">Today</span>
                <span className="lp-preview-v2-nutrition__pill">7D</span>
                <span className="lp-preview-v2-nutrition__pill">30D</span>
              </div>
            </div>
            <div className="lp-preview-v2-bars">
              <div className="lp-preview-v2-bar">
                <div className="lp-preview-v2-bar__head">
                  <span className="lp-preview-v2-bar__label">
                    <span className="lp-preview-v2-bar__dot lp-preview-v2-bar__dot--protein" />Protein
                  </span>
                  <span className="lp-preview-v2-bar__num">120 / 145g</span>
                </div>
                <div className="lp-preview-v2-bar__track">
                  <motion.div
                    className="lp-preview-v2-bar__fill lp-preview-v2-bar__fill--protein"
                    initial={reduced ? { width: '82%' } : { width: 0 }}
                    whileInView={{ width: '82%' }}
                    viewport={{ once: true }}
                    transition={reduced ? { duration: 0 } : { duration: 1.0, delay: 0.5, ease: [0.4, 0, 0.2, 1] }}
                  />
                </div>
              </div>
              <div className="lp-preview-v2-bar">
                <div className="lp-preview-v2-bar__head">
                  <span className="lp-preview-v2-bar__label">
                    <span className="lp-preview-v2-bar__dot lp-preview-v2-bar__dot--carbs" />Carbs
                  </span>
                  <span className="lp-preview-v2-bar__num">152 / 218g</span>
                </div>
                <div className="lp-preview-v2-bar__track">
                  <motion.div
                    className="lp-preview-v2-bar__fill lp-preview-v2-bar__fill--carbs"
                    initial={reduced ? { width: '70%' } : { width: 0 }}
                    whileInView={{ width: '70%' }}
                    viewport={{ once: true }}
                    transition={reduced ? { duration: 0 } : { duration: 1.0, delay: 0.7, ease: [0.4, 0, 0.2, 1] }}
                  />
                </div>
              </div>
              <div className="lp-preview-v2-bar">
                <div className="lp-preview-v2-bar__head">
                  <span className="lp-preview-v2-bar__label">
                    <span className="lp-preview-v2-bar__dot lp-preview-v2-bar__dot--fat" />Fat
                  </span>
                  <span className="lp-preview-v2-bar__num">42 / 61g</span>
                </div>
                <div className="lp-preview-v2-bar__track">
                  <motion.div
                    className="lp-preview-v2-bar__fill lp-preview-v2-bar__fill--fat"
                    initial={reduced ? { width: '69%' } : { width: 0 }}
                    whileInView={{ width: '69%' }}
                    viewport={{ once: true }}
                    transition={reduced ? { duration: 0 } : { duration: 1.0, delay: 0.9, ease: [0.4, 0, 0.2, 1] }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Status row — This week + Weight trend */}
          <div className="lp-preview-v2-status">
            <div className="lp-preview-v2-status__card">
              <div className="lp-preview-v2-status__head">
                <span className="lp-preview-v2-status__label">THIS WEEK</span>
                <span className="lp-preview-v2-status__badge">on track</span>
              </div>
              <div className="lp-preview-v2-status__big">
                <span className="lp-preview-v2-status__num">3</span>
                <span className="lp-preview-v2-status__bigSub">of 4 workouts</span>
              </div>
              <div className="lp-preview-v2-status__strip">
                <div className="lp-preview-v2-status__strip-cell lp-preview-v2-status__strip-cell--filled" />
                <div className="lp-preview-v2-status__strip-cell lp-preview-v2-status__strip-cell--filled" />
                <div className="lp-preview-v2-status__strip-cell lp-preview-v2-status__strip-cell--filled" />
                <div className="lp-preview-v2-status__strip-cell" />
                <div className="lp-preview-v2-status__strip-cell" />
                <div className="lp-preview-v2-status__strip-cell" />
                <div className="lp-preview-v2-status__strip-cell" />
              </div>
            </div>
            <div className="lp-preview-v2-status__card">
              <div className="lp-preview-v2-status__head">
                <span className="lp-preview-v2-status__label">WEIGHT TREND</span>
                <span className="lp-preview-v2-status__badge">−2.1 lb / 30d</span>
              </div>
              <div className="lp-preview-v2-status__big">
                <span className="lp-preview-v2-status__num">
                  174.2<span className="lp-preview-v2-status__unit"> lb</span>
                </span>
              </div>
              <svg className="lp-preview-v2-status__spark" viewBox="0 0 240 30" preserveAspectRatio="none" aria-hidden="true">
                <polyline points="0,18 30,16 60,12 90,14 120,10 150,8 180,12 210,10 240,8" fill="none" stroke="var(--lp-teal-light)" strokeWidth="1.5" />
              </svg>
            </div>
          </div>
        </div>
      </TiltedPreviewFrame>
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
        <div className="lp-strip__item">
          <div className="lp-strip__label">Track macros</div>
          <div className="lp-strip__desc">Full TDEE + macro breakdown</div>
        </div>
        <div className="lp-strip__sep" />
        <div className="lp-strip__item">
          <div className="lp-strip__label">Log lifts</div>
          <div className="lp-strip__desc">Sets, reps, weight, rest timer</div>
        </div>
        <div className="lp-strip__sep" />
        <div className="lp-strip__item">
          <div className="lp-strip__label">Model body comp</div>
          <div className="lp-strip__desc">NHANES-trained ML estimates</div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Features                                                           */
/* ------------------------------------------------------------------ */

function Features() {
  return (
    <section className="lp-features" id="features">
      <div className="lp-features__header">
        <div className="lp-kicker">
          <span className="lp-kicker__dot" />
          <span>Built for the long game</span>
        </div>
        <h2 className="lp-features__heading">
          Seven tools.<br/>
          <span style={{ fontWeight: 300, fontStyle: 'italic', color: 'var(--lp-muted)' }}>One feedback loop.</span>
        </h2>
      </div>

      <div className="lp-features__grid">

        <div className="lp-bento-card lp-bento-card--hero">
          <div className="lp-bento-card__glow" />
          <div className="lp-bento-card__head">
            <span className="lp-bento-card__icon"><Dumbbell size={18} strokeWidth={2} /></span>
            <span className="lp-bento-card__kicker">Workouts</span>
          </div>
          <h3 className="lp-bento-card__title">Log 3 sets in 4 taps.</h3>
          <p className="lp-bento-card__desc">Built for one hand mid-set. Tap reps, swipe weight, done. Your training history compounds session by session.</p>

          <div className="lp-bento-card__workout-frame">
            <div className="lp-bento-card__workout-head">
              <div>
                <div className="lp-bento-card__workout-meta-label">Push day · Week 3</div>
                <div className="lp-bento-card__workout-status">In progress · 32 min</div>
              </div>
              <div className="lp-bento-card__workout-rest">
                <span className="lp-bento-card__workout-rest-label">Rest</span>
                <span className="lp-bento-card__workout-rest-time">1:24</span>
              </div>
            </div>

            <div className="lp-bento-card__workout-sets">
              <div className="lp-bento-card__workout-row lp-bento-card__workout-row--active">
                <span className="lp-bento-card__workout-name">Bench press</span>
                <span className="lp-bento-card__workout-data">Set 3/4</span>
                <span className="lp-bento-card__workout-data">8 reps</span>
                <span className="lp-bento-card__workout-data lp-bento-card__workout-data--accent">185 lb</span>
              </div>
              <div className="lp-bento-card__workout-row lp-bento-card__workout-row--pending">
                <span className="lp-bento-card__workout-name">Incline DB press</span>
                <span className="lp-bento-card__workout-data">Set 2/3</span>
                <span className="lp-bento-card__workout-data">10 reps</span>
                <span className="lp-bento-card__workout-data">65 lb</span>
              </div>
              <div className="lp-bento-card__workout-row lp-bento-card__workout-row--upcoming">
                <span className="lp-bento-card__workout-name">Cable fly</span>
                <span className="lp-bento-card__workout-data">Set —</span>
                <span className="lp-bento-card__workout-data">— reps</span>
                <span className="lp-bento-card__workout-data">— lb</span>
              </div>
            </div>
          </div>

          <div className="lp-bento-card__workout-meta-row">
            <span>4-tap entry</span>
            <span className="lp-bento-card__workout-meta-sep">·</span>
            <span>Rest timer built in</span>
            <span className="lp-bento-card__workout-meta-sep">·</span>
            <span>Cardio + drag-to-reorder</span>
          </div>
        </div>

        <div className="lp-bento-card lp-bento-card--medium">
          <div className="lp-bento-card__head">
            <span className="lp-bento-card__icon"><TrendingUp size={18} strokeWidth={2} /></span>
            <span className="lp-bento-card__kicker">Progress</span>
          </div>
          <h3 className="lp-bento-card__title">Trend, not snapshot.</h3>
          <p className="lp-bento-card__desc">Weight and body comp in dual-axis charts. See what&apos;s actually changing.</p>
          <div className="lp-bento-card__meta">2W · 1M · 3M · 6M · All</div>
        </div>

        <div className="lp-bento-card lp-bento-card--medium">
          <div className="lp-bento-card__head">
            <span className="lp-bento-card__icon"><Calculator size={18} strokeWidth={2} /></span>
            <span className="lp-bento-card__kicker">Calculators</span>
          </div>
          <h3 className="lp-bento-card__title">TDEE, macros, the math.</h3>
          <p className="lp-bento-card__desc">6-step setup. Recalculate anytime your body changes.</p>
          <div className="lp-bento-card__meta">katch + mifflin · ~90s</div>
        </div>

        <div className="lp-bento-card lp-bento-card--small">
          <div className="lp-bento-card__head">
            <span className="lp-bento-card__icon"><Target size={18} strokeWidth={2} /></span>
            <span className="lp-bento-card__kicker">Goal planner</span>
          </div>
          <h3 className="lp-bento-card__title">Set the target.</h3>
          <p className="lp-bento-card__desc">Weight, strength, body comp.</p>
        </div>

        <div className="lp-bento-card lp-bento-card--small">
          <div className="lp-bento-card__head">
            <span className="lp-bento-card__icon"><UtensilsCrossed size={18} strokeWidth={2} /></span>
            <span className="lp-bento-card__kicker">Meal planner</span>
          </div>
          <h3 className="lp-bento-card__title">AI-fit meals.</h3>
          <p className="lp-bento-card__desc">Macros, hit. 300/mo on Pro+.</p>
        </div>

        <div className="lp-bento-card lp-bento-card--small">
          <div className="lp-bento-card__head">
            <span className="lp-bento-card__icon"><Ruler size={18} strokeWidth={2} /></span>
            <span className="lp-bento-card__kicker">Measurements</span>
          </div>
          <h3 className="lp-bento-card__title">Track every inch.</h3>
          <p className="lp-bento-card__desc">Chest, waist, arms, more.</p>
        </div>

        <div className="lp-bento-card lp-bento-card--small">
          <div className="lp-bento-card__head">
            <span className="lp-bento-card__icon"><BookOpen size={18} strokeWidth={2} /></span>
            <span className="lp-bento-card__kicker">Exercise library</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '4px' }}>
            <h3 className="lp-bento-card__title" style={{ margin: 0 }}>Illustrated.</h3>
            <span className="lp-bento-card__count">96</span>
          </div>
          <p className="lp-bento-card__desc">Muscle maps, form cues.</p>
        </div>

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
  return (
    <div className="lp-demo__panel lp-demo__home-v2">
      {/* Greeting bar */}
      <div className="lp-demo__home-v2-greeting">
        <div className="lp-demo__home-v2-greeting-left">
          <div className="lp-demo__home-v2-kicker">
            <span className="lp-demo__home-v2-kicker-dot" />
            <span>MONDAY · 2:47 PM</span>
          </div>
          <h3 className="lp-demo__home-v2-heading">Afternoon.</h3>
          <p className="lp-demo__home-v2-sub">
            You&apos;re <span className="lp-demo__home-v2-sub-accent">540 kcal under</span>. Lunch is the next big window.
          </p>
        </div>
        <div className="lp-demo__home-v2-streak">
          <span aria-hidden="true">🔥</span>
          <span className="lp-demo__home-v2-streak-num">11</span>
          <span className="lp-demo__home-v2-streak-label">day streak</span>
        </div>
      </div>

      {/* Three action cards */}
      <div className="lp-demo__home-v2-actions">
        <Locked>
          <div className="lp-demo__home-v2-action lp-demo__home-v2-action--primary" role="button" tabIndex={0}>
            <div className="lp-demo__home-v2-action-kicker">LOG A MEAL</div>
            <div className="lp-demo__home-v2-action-row">
              <span className="lp-demo__home-v2-action-title">Lunch</span>
              <span className="lp-demo__home-v2-action-arrow">→</span>
            </div>
            <div className="lp-demo__home-v2-action-sub">scan, search, or pick from your plan</div>
          </div>
        </Locked>
        <Locked>
          <div className="lp-demo__home-v2-action" role="button" tabIndex={0}>
            <div className="lp-demo__home-v2-action-kicker">LOG A WORKOUT</div>
            <div className="lp-demo__home-v2-action-row">
              <span className="lp-demo__home-v2-action-title">Push day</span>
              <span className="lp-demo__home-v2-action-arrow">→</span>
            </div>
            <div className="lp-demo__home-v2-action-sub">on your schedule · 8 exercises</div>
          </div>
        </Locked>
        <Locked>
          <div className="lp-demo__home-v2-action" role="button" tabIndex={0}>
            <div className="lp-demo__home-v2-action-kicker">LOG WEIGHT</div>
            <div className="lp-demo__home-v2-action-row">
              <span className="lp-demo__home-v2-action-title">Daily</span>
              <span className="lp-demo__home-v2-action-arrow">→</span>
            </div>
            <div className="lp-demo__home-v2-action-sub">last logged 1d ago · 174 lb</div>
          </div>
        </Locked>
      </div>

      {/* Today's nutrition */}
      <div className="lp-demo__home-v2-nutrition">
        <div className="lp-demo__home-v2-nutrition-head">
          <div>
            <div className="lp-demo__home-v2-nutrition-label">TODAY&apos;S NUTRITION</div>
            <div className="lp-demo__home-v2-nutrition-kcal">
              <span className="lp-demo__home-v2-nutrition-kcal-current">1,640</span>
              <span className="lp-demo__home-v2-nutrition-kcal-target">/ 2,180 kcal</span>
            </div>
          </div>
          <div className="lp-demo__home-v2-nutrition-pills">
            <button type="button" className="lp-demo__home-v2-nutrition-pill is-active" onClick={preventClick}>Today</button>
            <button type="button" className="lp-demo__home-v2-nutrition-pill" onClick={preventClick}>7D</button>
            <button type="button" className="lp-demo__home-v2-nutrition-pill" onClick={preventClick}>30D</button>
          </div>
        </div>

        <div className="lp-demo__home-v2-bars">
          <div className="lp-demo__home-v2-bar">
            <div className="lp-demo__home-v2-bar-head">
              <span className="lp-demo__home-v2-bar-label">
                <span className="lp-demo__home-v2-bar-dot" style={{ background: '#A78BFA' }} />Protein
              </span>
              <span className="lp-demo__home-v2-bar-num">120 / 145g</span>
            </div>
            <div className="lp-demo__home-v2-bar-track">
              <div className="lp-demo__home-v2-bar-fill" style={{ width: '82%', background: '#A78BFA' }} />
            </div>
          </div>
          <div className="lp-demo__home-v2-bar">
            <div className="lp-demo__home-v2-bar-head">
              <span className="lp-demo__home-v2-bar-label">
                <span className="lp-demo__home-v2-bar-dot" style={{ background: '#1d9e75' }} />Carbs
              </span>
              <span className="lp-demo__home-v2-bar-num">152 / 218g</span>
            </div>
            <div className="lp-demo__home-v2-bar-track">
              <div className="lp-demo__home-v2-bar-fill" style={{ width: '70%', background: '#1d9e75' }} />
            </div>
          </div>
          <div className="lp-demo__home-v2-bar">
            <div className="lp-demo__home-v2-bar-head">
              <span className="lp-demo__home-v2-bar-label">
                <span className="lp-demo__home-v2-bar-dot" style={{ background: '#FCA130' }} />Fat
              </span>
              <span className="lp-demo__home-v2-bar-num">42 / 61g</span>
            </div>
            <div className="lp-demo__home-v2-bar-track">
              <div className="lp-demo__home-v2-bar-fill" style={{ width: '69%', background: '#FCA130' }} />
            </div>
          </div>
        </div>
      </div>

      {/* Status row — This week + Weight trend */}
      <div className="lp-demo__home-v2-status">
        <div className="lp-demo__home-v2-status-card">
          <div className="lp-demo__home-v2-status-head">
            <span className="lp-demo__home-v2-status-label">THIS WEEK</span>
            <span className="lp-demo__home-v2-status-badge">on track</span>
          </div>
          <div className="lp-demo__home-v2-status-big">
            <span className="lp-demo__home-v2-status-num">3</span>
            <span className="lp-demo__home-v2-status-bigsub">of 4 workouts</span>
          </div>
          <div className="lp-demo__home-v2-status-strip">
            <div className="lp-demo__home-v2-status-strip-cell is-filled" />
            <div className="lp-demo__home-v2-status-strip-cell is-filled" />
            <div className="lp-demo__home-v2-status-strip-cell is-filled" />
            <div className="lp-demo__home-v2-status-strip-cell" />
            <div className="lp-demo__home-v2-status-strip-cell" />
            <div className="lp-demo__home-v2-status-strip-cell" />
            <div className="lp-demo__home-v2-status-strip-cell" />
          </div>
        </div>
        <div className="lp-demo__home-v2-status-card">
          <div className="lp-demo__home-v2-status-head">
            <span className="lp-demo__home-v2-status-label">WEIGHT TREND</span>
            <span className="lp-demo__home-v2-status-badge">−2.1 lb / 30d</span>
          </div>
          <div className="lp-demo__home-v2-status-big">
            <span className="lp-demo__home-v2-status-num">
              174.2<span className="lp-demo__home-v2-status-unit"> lb</span>
            </span>
          </div>
          <svg className="lp-demo__home-v2-status-spark" viewBox="0 0 240 30" preserveAspectRatio="none" aria-hidden="true">
            <polyline points="0,18 30,16 60,12 90,14 120,10 150,8 180,12 210,10 240,8" fill="none" stroke="#5dcaa5" strokeWidth="1.5" />
          </svg>
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
        <div className="lp-kicker" style={{ justifyContent: 'center', marginBottom: 20 }}>
          <span className="lp-kicker__dot" />
          <span>Click around. Nothing&apos;s locked.</span>
        </div>
        <h2 className="lp-demo__section-heading">
          The whole app,<br/>
          <span style={{ fontWeight: 300, fontStyle: 'italic', color: 'var(--lp-muted)' }}>before the sign-up wall.</span>
        </h2>
        <p className="lp-demo__section-sub">Pre-filled with sample data so you can poke around every screen. No card, no email, no commitment.</p>
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
      <div className="lp-kicker" style={{ justifyContent: 'center', marginBottom: 20 }}>
        <span className="lp-kicker__dot" />
        <span>Free. Forever. No card.</span>
      </div>
      <h2 className="lp-cta__heading">
        Start with the calculator.<br/>
        <span style={{ fontWeight: 300, fontStyle: 'italic', color: 'var(--lp-muted)' }}>The rest follows.</span>
      </h2>
      <p className="lp-cta__sub">Six tools, free forever. Upgrade only when you outgrow them.</p>
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
              <span className="lp-footer__version">v2.4</span>
            </Link>
            <p className="lp-footer__tagline">Made in California by one person who lifts.</p>
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

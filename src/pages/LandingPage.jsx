import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Ruler,
  Target,
  Dumbbell,
  BarChart2,
  CalendarDays,
  BookOpen,
  Check,
  Zap,
  Sun,
  Moon,
  Lock,
} from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useTheme } from '../hooks/useTheme';
import '../styles/landing.css';

/* -- Animation variants -- */
const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show:   { opacity: 1, y: 0 },
};

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1 } },
};

/* -- Data -- */
const FEATURES = [
  {
    icon: Ruler,
    title: 'Measurements',
    desc: 'Enter your measurements to estimate body fat % and get personalized calorie targets.',
  },
  {
    icon: Target,
    title: 'Goal Planner',
    desc: 'Set weight, strength, and body goals then track your path to hitting them.',
  },
  {
    icon: Dumbbell,
    title: 'Workout Logger',
    desc: 'Log sets, reps, and weight for every session. Build your training history.',
  },
  {
    icon: BarChart2,
    title: 'Progress Charts',
    desc: 'Visualize your weight, strength, and measurement trends over time.',
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
  'Early access to new features',
  'No usage limits — ever',
];

const PRO_PLUS_FEATURES = [
  'Everything in Pro',
  'AI Meal Suggestions (300/mo)',
  'AI-powered nutrition planning',
  'Personalized macro-fit meals',
];

const FEATURE_ROW = [
  { title: 'Meal planner', desc: 'AI-powered meal suggestions and a full Monday\u2013Friday meal plan grid built around your macro targets.' },
  { title: 'Macro calculator', desc: 'Full TDEE calculation plus a complete protein, carbs and fat breakdown based on your goals.' },
  { title: 'Workout + progress tracking', desc: 'Log every session, track PRs and watch your body composition change over time in charts.' },
];

const STATS = [
  { value: 'Free', label: 'to get started' },
  { value: '96+', label: 'exercises tracked' },
  { value: '5 min', label: 'to set up' },
];

/* -- Navbar -- */
function Navbar() {
  const { isDark, toggle } = useTheme();
  return (
    <motion.nav
      className="lp-nav"
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <Link to="/" className="lp-nav__logo">
        <span className="lp-nav__logo-icon"><Lock size={16} /></span>
        <span className="lp-nav__logo-name">MacroVault</span>
      </Link>

      <div className="lp-nav__links">
        <a href="#features" className="lp-nav__link">Features</a>
        <a href="#pricing" className="lp-nav__link">Pricing</a>
        <Link to="/about" className="lp-nav__link">About</Link>
      </div>

      <div className="lp-nav__actions">
        <button className="lp-theme-toggle" onClick={toggle} aria-label="Toggle theme">
          {isDark ? <Sun size={16} /> : <Moon size={16} />}
        </button>
        <Link to="/auth" className="lp-nav__signin">Sign in</Link>
        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
          <Link to="/auth" className="lp-nav__cta">Get started</Link>
        </motion.div>
      </div>
    </motion.nav>
  );
}

/* -- Hero -- */
function Hero() {
  const navigate = useNavigate();
  return (
    <section className="lp-hero" id="hero">
      {/* Tag badge */}
      <motion.div
        className="lp-hero__tag"
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.25, delay: 0.1 }}
      >
        <Zap size={10} />
        Track smarter. Train harder.
      </motion.div>

      {/* Headline */}
      <h1 className="lp-hero__heading">
        <motion.span
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.15 }}
        >
          Data-driven fitness,
        </motion.span>
        <br />
        <motion.span
          className="lp-hero__heading--accent"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.22 }}
        >
          without the guesswork.
        </motion.span>
      </h1>

      {/* Subheading */}
      <motion.p
        className="lp-hero__sub"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.28 }}
      >
        Track workouts, measure your body and hit your goals all in one place.
        Built for people who want real data, not just motivation.
      </motion.p>

      {/* CTA row */}
      <motion.div
        className="lp-hero__ctas"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.35 }}
      >
        <motion.button
          className="lp-hero__cta-primary"
          onClick={() => navigate('/auth')}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
        >
          Start for free
        </motion.button>
        <a href="#features" className="lp-hero__cta-secondary">See how it works</a>
      </motion.div>

      {/* Stat strip */}
      <div className="lp-hero__stats">
        {STATS.map((s, i) => (
          <React.Fragment key={s.value}>
            {i > 0 && <div className="lp-hero__stat-divider" />}
            <motion.div
              className="lp-hero__stat"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.42 + i * 0.06 }}
            >
              <div className="lp-hero__stat-value">{s.value}</div>
              <div className="lp-hero__stat-label">{s.label}</div>
            </motion.div>
          </React.Fragment>
        ))}
      </div>
    </section>
  );
}

/* -- Feature Row -- */
function FeatureRow() {
  return (
    <section className="lp-feature-row">
      {FEATURE_ROW.map(({ title, desc }, i) => (
        <motion.div
          key={title}
          className={`lp-feature-row__cell${i > 0 ? ' lp-feature-row__cell--bordered' : ''}`}
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.3, delay: i * 0.08 }}
        >
          <div className="lp-feature-row__title">{title}</div>
          <div className="lp-feature-row__desc">{desc}</div>
        </motion.div>
      ))}
    </section>
  );
}

/* -- Features -- */
function Features() {
  return (
    <section className="lp-features" id="features">
      <div className="lp-features__header">
        <motion.span
          className="lp-features__label"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.3 }}
        >
          FEATURES
        </motion.span>

        <motion.h2
          className="lp-features__heading"
          variants={fadeUp}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.5 }}
        >
          Everything you need to reach your goals
        </motion.h2>

        <motion.p
          className="lp-features__sub"
          variants={fadeUp}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          A complete fitness toolkit for body measurements, workout logging and goal tracking.
        </motion.p>
      </div>

      <motion.div
        className="lp-features-grid"
        variants={stagger}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.15 }}
      >
        {FEATURES.map(({ icon: Icon, title, desc }, i) => (
          <motion.div
            key={title}
            className="lp-feature-card"
            variants={fadeUp}
            transition={{ duration: 0.4, delay: i * 0.06 }}
          >
            <div className="lp-feature-card__icon"><Icon size={20} /></div>
            <div className="lp-feature-card__title">{title}</div>
            <div className="lp-feature-card__desc">{desc}</div>
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
}

/* -- Pricing -- */
function Pricing() {
  const navigate = useNavigate();
  return (
    <section className="lp-pricing" id="pricing">
      <div className="lp-pricing__header">
        <motion.span
          className="lp-pricing__label"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.3 }}
        >
          PRICING
        </motion.span>

        <motion.h2
          className="lp-pricing__heading"
          variants={fadeUp}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.5 }}
        >
          Simple, transparent pricing
        </motion.h2>

        <motion.p
          className="lp-pricing__sub"
          variants={fadeUp}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          Start free, upgrade when you're ready. No hidden fees.
        </motion.p>
      </div>

      <motion.div
        className="lp-pricing-cards"
        variants={stagger}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.2 }}
      >
        {/* Free */}
        <motion.div
          className="lp-pricing-card"
          variants={fadeUp}
          transition={{ duration: 0.45 }}
        >
          <div className="lp-pricing-card__tier">Free</div>
          <div className="lp-pricing-card__price">
            <span className="lp-pricing-card__amount">$0</span>
          </div>
          <div className="lp-pricing-card__tagline">
            Everything you need to get started — no credit card required.
          </div>
          <div className="lp-pricing-card__divider" />
          <ul className="lp-pricing-card__features">
            {FREE_FEATURES.map((f) => (
              <li key={f} className="lp-pricing-card__feature">
                <Check size={14} className="lp-pricing-card__check" />
                {f}
              </li>
            ))}
          </ul>
          <button
            className="lp-pricing-card__cta lp-pricing-card__cta--outline"
            onClick={() => navigate('/auth')}
          >
            Get started
          </button>
        </motion.div>

        {/* Pro */}
        <motion.div
          className="lp-pricing-card lp-pricing-card--pro"
          variants={fadeUp}
          transition={{ duration: 0.45, delay: 0.1 }}
        >
          <div className="lp-pricing-card__badge">Most popular</div>
          <div className="lp-pricing-card__tier">Pro</div>
          <div className="lp-pricing-card__price">
            <span className="lp-pricing-card__amount">$4.99</span>
            <span className="lp-pricing-card__period">/mo</span>
          </div>
          <div className="lp-pricing-card__tagline">
            Unlock the full MacroVault experience with no limits.
          </div>
          <div className="lp-pricing-card__divider" />
          <ul className="lp-pricing-card__features">
            {PRO_FEATURES.map((f) => (
              <li key={f} className="lp-pricing-card__feature">
                <Check size={14} className="lp-pricing-card__check" />
                {f}
              </li>
            ))}
          </ul>
          <button
            className="lp-pricing-card__cta lp-pricing-card__cta--teal"
            onClick={() => navigate('/auth')}
          >
            Upgrade to Pro
          </button>
        </motion.div>

        {/* Pro+ */}
        <motion.div
          className="lp-pricing-card lp-pricing-card--pro"
          variants={fadeUp}
          transition={{ duration: 0.45, delay: 0.2 }}
        >
          <div className="lp-pricing-card__badge">Best value</div>
          <div className="lp-pricing-card__tier">Pro+</div>
          <div className="lp-pricing-card__price">
            <span className="lp-pricing-card__amount">$9.99</span>
            <span className="lp-pricing-card__period">/mo</span>
          </div>
          <div className="lp-pricing-card__tagline">
            Everything in Pro plus AI-powered meal planning.
          </div>
          <div className="lp-pricing-card__divider" />
          <ul className="lp-pricing-card__features">
            {PRO_PLUS_FEATURES.map((f) => (
              <li key={f} className="lp-pricing-card__feature">
                <Check size={14} className="lp-pricing-card__check" />
                {f}
              </li>
            ))}
          </ul>
          <button
            className="lp-pricing-card__cta lp-pricing-card__cta--teal"
            onClick={() => navigate('/auth')}
          >
            Upgrade to Pro+
          </button>
        </motion.div>
      </motion.div>
    </section>
  );
}

/* -- Footer -- */
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
            <p className="lp-footer__tagline">
              Data-driven fitness for everyone.
            </p>
          </div>

          <div className="lp-footer__links">
            <Link to="/about" className="lp-footer__link">About</Link>
            <Link to="/help" className="lp-footer__link">Contact</Link>
            <a href="#pricing" className="lp-footer__link">Pricing</a>
          </div>
        </div>

        <div className="lp-footer__bottom">
          <span className="lp-footer__copy">
            &copy; {new Date().getFullYear()} MacroVault. All rights reserved.
          </span>
          <div className="lp-footer__links">
            {/* eslint-disable-next-line jsx-a11y/anchor-is-valid */}
            <a href="#" className="lp-footer__link">Privacy</a>
            {/* eslint-disable-next-line jsx-a11y/anchor-is-valid */}
            <a href="#" className="lp-footer__link">Terms</a>
          </div>
        </div>
      </div>
    </footer>
  );
}

/* -- Page -- */
export default function LandingPage() {
  const navigate = useNavigate();

  // Redirect authenticated users to /home
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
        <FeatureRow />
        <Features />
        <Pricing />
      </main>
      <Footer />
    </div>
  );
}

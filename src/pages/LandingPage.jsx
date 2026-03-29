import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ScanLine,
  Target,
  Dumbbell,
  BarChart2,
  CalendarDays,
  BookOpen,
  Check,
  Zap,
} from 'lucide-react';
import { supabase } from '../supabaseClient';
import '../styles/landing.css';

/* ── Animation variants ── */
const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show:   { opacity: 1, y: 0 },
};

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1 } },
};

/* ── Feature data ── */
const FEATURES = [
  {
    icon: ScanLine,
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

/* ── Navbar ── */
function Navbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <motion.nav
      className={`lp-nav${scrolled ? ' lp-nav--scrolled' : ''}`}
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
    >
      {/* Logo */}
      <Link to="/" className="lp-nav__logo">
        <div className="lp-nav__logo-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
            <path d="M6 20V10M12 20V4M18 20v-6" />
          </svg>
        </div>
        <span className="lp-nav__logo-name">Gainlytics</span>
      </Link>

      {/* Center links */}
      <div className="lp-nav__links">
        <a href="#features" className="lp-nav__link">Features</a>
        <a href="#pricing"  className="lp-nav__link">Pricing</a>
        <Link to="/about"   className="lp-nav__link">About</Link>
      </div>

      {/* Actions */}
      <div className="lp-nav__actions">
        <Link to="/auth" className="lp-btn lp-btn--ghost">Sign in</Link>
        <Link to="/auth" className="lp-btn lp-btn--teal">Get started</Link>
      </div>
    </motion.nav>
  );
}

/* ── Hero ── */
function Hero() {
  const navigate = useNavigate();
  return (
    <section className="lp-hero lp-section" id="hero">
      <div className="lp-hero__glow" aria-hidden="true" />

      <motion.div
        className="lp-hero__eyebrow"
        variants={fadeUp}
        initial="hidden"
        animate="show"
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <Zap size={12} />
        Track smarter. Train harder.
      </motion.div>

      <motion.h1
        className="lp-hero__heading"
        variants={fadeUp}
        initial="hidden"
        animate="show"
        transition={{ duration: 0.55, delay: 0.2 }}
      >
        Data-driven fitness,{' '}
        <em>without the guesswork.</em>
      </motion.h1>

      <motion.p
        className="lp-hero__sub"
        variants={fadeUp}
        initial="hidden"
        animate="show"
        transition={{ duration: 0.55, delay: 0.32 }}
      >
        Track workouts, measure your body and hit your goals all in one place.
      </motion.p>

      <motion.div
        className="lp-hero__ctas"
        variants={fadeUp}
        initial="hidden"
        animate="show"
        transition={{ duration: 0.5, delay: 0.44 }}
      >
        <button
          className="lp-btn lp-btn--teal lp-btn--lg"
          onClick={() => navigate('/auth')}
        >
          Start for free
        </button>
        <a href="#features" className="lp-btn lp-btn--outline lp-btn--lg">
          See how it works
        </a>
      </motion.div>
    </section>
  );
}

/* ── Features ── */
function Features() {
  return (
    <section className="lp-features lp-section" id="features">
      <div className="lp-section-label">
        <div className="lp-section-label__line" />
        <span className="lp-section-label__text">Features</span>
        <div className="lp-section-label__line" />
      </div>

      <motion.h2
        className="lp-section-heading"
        variants={fadeUp}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.4 }}
        transition={{ duration: 0.5 }}
      >
        Everything you need to reach your goals
      </motion.h2>

      <motion.p
        className="lp-section-sub"
        variants={fadeUp}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.4 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        A complete fitness toolkit for body measurements, workout logging and goal tracking.
      </motion.p>

      <motion.div
        className="lp-features-grid"
        variants={stagger}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.15 }}
      >
        {FEATURES.map(({ icon: Icon, title, desc }) => (
          <motion.div
            key={title}
            className="lp-feature-card"
            variants={fadeUp}
            transition={{ duration: 0.4 }}
          >
            <div className="lp-feature-card__icon">
              <Icon size={20} />
            </div>
            <div className="lp-feature-card__title">{title}</div>
            <div className="lp-feature-card__desc">{desc}</div>
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
}

/* ── Pricing ── */
function Pricing() {
  const navigate = useNavigate();
  return (
    <section className="lp-pricing lp-section" id="pricing">
      <div className="lp-section-label">
        <div className="lp-section-label__line" />
        <span className="lp-section-label__text">Pricing</span>
        <div className="lp-section-label__line" />
      </div>

      <motion.h2
        className="lp-section-heading"
        variants={fadeUp}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.4 }}
        transition={{ duration: 0.5 }}
      >
        Simple, transparent pricing
      </motion.h2>

      <motion.p
        className="lp-section-sub"
        variants={fadeUp}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.4 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        Start free, upgrade when you're ready. No hidden fees.
      </motion.p>

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
            Unlock the full Gainlytics experience with no limits.
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
      </motion.div>
    </section>
  );
}

/* ── Footer ── */
function Footer() {
  return (
    <footer className="lp-footer">
      <div className="lp-footer__inner">
        <div className="lp-footer__top">
          <div className="lp-footer__brand">
            <Link to="/" className="lp-footer__logo">
              <div className="lp-footer__logo-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
                  <path d="M6 20V10M12 20V4M18 20v-6" />
                </svg>
              </div>
              <span className="lp-footer__logo-name">Gainlytics</span>
            </Link>
            <p className="lp-footer__tagline">
              Data-driven fitness for everyone.
            </p>
          </div>

          <div className="lp-footer__links">
            <Link to="/about"  className="lp-footer__link">About</Link>
            <Link to="/help"   className="lp-footer__link">Contact</Link>
            <a href="#pricing" className="lp-footer__link">Pricing</a>
          </div>
        </div>

        <div className="lp-footer__bottom">
          <span className="lp-footer__copy">
            © {new Date().getFullYear()} Gainlytics. All rights reserved.
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

/* ── Page ── */
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
        <Features />
        <Pricing />
      </main>
      <Footer />
    </div>
  );
}

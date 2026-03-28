import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Heart, Zap, Shield } from 'lucide-react';
import '../styles/landing.css';
import '../styles/about.css';

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show:   { opacity: 1, y: 0 },
};

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12 } },
};

const VALUES = [
  {
    icon: Zap,
    title: 'Clarity over complexity',
    desc: 'We strip away the noise. Every feature exists to give you a clear, honest picture of your progress — nothing more.',
  },
  {
    icon: Heart,
    title: 'Built for consistency',
    desc: 'The best workout plan is one you actually stick to. Gainlytics is designed to keep you accountable, day after day.',
  },
  {
    icon: Shield,
    title: 'Your data, your privacy',
    desc: 'We never sell your data. Your fitness journey is personal — we treat it that way.',
  },
];

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
      <Link to="/" className="lp-nav__logo">
        <div className="lp-nav__logo-icon">G</div>
        <span className="lp-nav__logo-name">Gainlytics</span>
      </Link>

      <div className="lp-nav__links">
        <a href="/#features" className="lp-nav__link">Features</a>
        <a href="/#pricing"  className="lp-nav__link">Pricing</a>
        <Link to="/about"    className="lp-nav__link" style={{ color: 'var(--text-primary)' }}>About</Link>
      </div>

      <div className="lp-nav__actions">
        <Link to="/auth" className="lp-btn lp-btn--ghost">Sign in</Link>
        <Link to="/auth" className="lp-btn lp-btn--teal">Get started</Link>
      </div>
    </motion.nav>
  );
}

export default function About() {
  return (
    <div className="lp-page about-lp">
      <Navbar />

      <main>
        {/* ── Hero ── */}
        <section className="lp-hero lp-section" style={{ paddingBottom: 64 }}>
          <div className="lp-hero__glow" aria-hidden="true" />

          <motion.div
            className="lp-hero__eyebrow"
            variants={fadeUp}
            initial="hidden"
            animate="show"
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            Our story
          </motion.div>

          <motion.h1
            className="lp-hero__heading"
            variants={fadeUp}
            initial="hidden"
            animate="show"
            transition={{ duration: 0.55, delay: 0.2 }}
            style={{ fontSize: 'clamp(32px, 5vw, 52px)' }}
          >
            Built for people who take <em>their fitness seriously.</em>
          </motion.h1>

          <motion.p
            className="lp-hero__sub"
            variants={fadeUp}
            initial="hidden"
            animate="show"
            transition={{ duration: 0.55, delay: 0.32 }}
          >
            Gainlytics was born from a simple frustration — fitness apps were either too simple
            to be useful, or too cluttered to be enjoyable. We built something in between.
          </motion.p>
        </section>

        {/* ── Mission ── */}
        <section className="lp-section about-mission">
          <div className="lp-section-label">
            <div className="lp-section-label__line" />
            <span className="lp-section-label__text">Mission</span>
            <div className="lp-section-label__line" />
          </div>

          <motion.div
            className="about-mission__body"
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.2 }}
          >
            <motion.p className="about-mission__text" variants={fadeUp} transition={{ duration: 0.5 }}>
              Gainlytics was built to bring <strong>clarity to fitness</strong>. No more guessing.
              Our mission is to combine clean UI, data insights, and practicality to help you reach
              your goals faster.
            </motion.p>
            <motion.p className="about-mission__text" variants={fadeUp} transition={{ duration: 0.5 }}>
              Whether you're analyzing your physique, planning a goal, tracking your progress,
              or logging workouts — Gainlytics brings everything into one seamless experience.
            </motion.p>
            <motion.p className="about-mission__text" variants={fadeUp} transition={{ duration: 0.5 }}>
              Built for those who want to stay <strong>consistent</strong>, stay <strong>informed</strong>,
              and stay <strong>improving</strong>.
            </motion.p>
          </motion.div>
        </section>

        {/* ── Values ── */}
        <section className="lp-section">
          <div className="lp-section-label">
            <div className="lp-section-label__line" />
            <span className="lp-section-label__text">Values</span>
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
            What we stand for
          </motion.h2>

          <motion.div
            className="lp-features-grid"
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.15 }}
            style={{ marginTop: 40 }}
          >
            {VALUES.map(({ icon: Icon, title, desc }) => (
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

        {/* ── CTA ── */}
        <section className="lp-section about-cta">
          <motion.div
            className="about-cta__card"
            variants={fadeUp}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="about-cta__heading">Ready to start your journey?</h2>
            <p className="about-cta__sub">
              Join Gainlytics for free — no credit card required.
            </p>
            <Link to="/auth" className="lp-btn lp-btn--teal lp-btn--lg">
              Get started free
            </Link>
          </motion.div>
        </section>
      </main>

      {/* ── Footer ── */}
      <footer className="lp-footer">
        <div className="lp-footer__inner">
          <div className="lp-footer__top">
            <div className="lp-footer__brand">
              <Link to="/" className="lp-footer__logo">
                <div className="lp-footer__logo-icon">G</div>
                <span className="lp-footer__logo-name">Gainlytics</span>
              </Link>
              <p className="lp-footer__tagline">
                Data-driven fitness for everyone.
              </p>
            </div>
            <div className="lp-footer__links">
              <Link to="/about" className="lp-footer__link">About</Link>
              <Link to="/help"  className="lp-footer__link">Contact</Link>
              <a href="/#pricing" className="lp-footer__link">Pricing</a>
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
    </div>
  );
}

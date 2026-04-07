import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, Crown, Lock, Loader, Sparkles } from 'lucide-react';
import posthog from '../../lib/posthog';
import { supabase } from '../../supabaseClient';
import './UpgradeModal.css';

const API_BASE = process.env.REACT_APP_API_BASE || 'https://gainlytics-1.onrender.com';

const PRO_FEATURES = [
  'Everything in Free',
  'Unlimited workout logs',
  'Goal Planner',
  'Meal Planner',
  'Progress Charts',
  'Daily nutrition tracking',
];

const PRO_PLUS_FEATURES = [
  'Everything in Pro',
  'AI Meal Suggestions (300/mo)',
  'AI-powered nutrition planning',
  'Personalized macro-fit meals',
];

const FREE_FEATURES = [
  'Dashboard',
  'Measurements',
  'All Calculators',
  'Exercise Library',
  '10 workout logs',
];

// Feature-specific headlines shown below the modal title
const FEATURE_HEADLINES = {
  workouts: "You've reached 10 workout logs on the free plan",
  goals:    "Goal Planner is a Pro feature",
  meals:    "Meal Planner is a Pro feature",
  progress: "Progress Charts is a Pro feature",
  default:  "Unlock everything with Gainlytics Pro",
};

const PRO_PLUS_HEADLINES = {
  ai_meals:  "AI meal suggestions require Pro+",
  ai_week:   "AI weekly meal plans require Pro+",
  default:   "Unlock AI features with Pro+",
};

export default function UpgradeModal({ isOpen, onClose, feature = null, tier = 'pro' }) {
  const [working, setWorking] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');

  const headline = tier === 'pro_plus'
    ? (PRO_PLUS_HEADLINES[feature] ?? PRO_PLUS_HEADLINES.default)
    : (FEATURE_HEADLINES[feature] ?? FEATURE_HEADLINES.default);

  async function handleUpgrade() {
    setCheckoutError('');
    setWorking(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error('Please sign in to upgrade.');

      const res = await fetch(`${API_BASE}/stripe/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: session.user.id,
          email:   session.user.email,
        }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.detail || 'Checkout failed. Please try again.');
      }

      const { url } = await res.json();
      posthog.capture('upgrade_clicked', { feature, tier: 'pro' });
      window.location.href = url;  // redirect to Stripe Checkout
    } catch (err) {
      setCheckoutError(err.message);
      setWorking(false);
    }
  }

  async function handleUpgradeProPlus() {
    setCheckoutError('');
    setWorking(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error('Please sign in to upgrade.');

      const res = await fetch(`${API_BASE}/stripe/checkout-pro-plus`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: session.user.id,
          email:   session.user.email,
        }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.detail || 'Checkout failed. Please try again.');
      }

      const { url } = await res.json();
      posthog.capture('upgrade_clicked', { feature, tier: 'pro_plus' });
      window.location.href = url;
    } catch (err) {
      setCheckoutError(err.message);
      setWorking(false);
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="upgrade-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Centering positioner */}
          <div className="upgrade-modal-positioner">
            <motion.div
              className="upgrade-modal"
              initial={{ opacity: 0, scale: 0.94, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 20 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
            >
              {/* Close */}
              <button className="upgrade-modal__close" onClick={onClose} aria-label="Close">
                <X size={18} />
              </button>

              {/* Header */}
              <div className="upgrade-modal__header">
                <div className="upgrade-modal__lock-icon">
                  {tier === 'pro_plus' ? <Sparkles size={22} /> : <Lock size={22} />}
                </div>
                <h2 className="upgrade-modal__title">
                  {tier === 'pro_plus' ? 'Upgrade to Pro+' : 'Unlock Pro Features'}
                </h2>
                <p className="upgrade-modal__subtitle">{headline}</p>
              </div>

              {tier === 'pro_plus' ? (
                /* ─── Pro+ focused view (for users already on Pro) ─── */
                <>
                  <div className="upgrade-modal__proplus-card">
                    <div className="upgrade-modal__proplus-badge">
                      <Crown size={12} /> Pro+
                    </div>
                    <div className="tier-card__price" style={{ marginBottom: 16 }}>
                      $9.99<span>/mo</span>
                    </div>
                    <ul className="tier-card__features">
                      {PRO_PLUS_FEATURES.map((f) => (
                        <li key={f}>
                          <Check size={13} className="tier-card__check" />
                          {f}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {checkoutError && (
                    <p className="upgrade-modal__error">{checkoutError}</p>
                  )}
                  <button
                    className="upgrade-modal__cta"
                    onClick={handleUpgradeProPlus}
                    disabled={working}
                  >
                    {working ? (
                      <span className="upgrade-modal__cta-inner">
                        <Loader size={15} className="upgrade-modal__spinner" />
                        Redirecting…
                      </span>
                    ) : (
                      'Upgrade to Pro+ — $9.99/mo'
                    )}
                  </button>
                  <p className="upgrade-modal__cancel-note">Cancel anytime. No commitment.</p>
                </>
              ) : (
                /* ─── Standard 3-tier view (for free users) ─── */
                <>
                  <div className="upgrade-modal__tiers">
                    {/* Free */}
                    <div className="tier-card">
                      <div className="tier-card__name">Free</div>
                      <div className="tier-card__price">$0<span>/mo</span></div>
                      <ul className="tier-card__features">
                        {FREE_FEATURES.map((f) => (
                          <li key={f}>
                            <Check size={13} className="tier-card__check tier-card__check--muted" />
                            {f}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Pro */}
                    <div className="tier-card tier-card--pro">
                      <div className="tier-card__pro-label">
                        <Crown size={11} /> Most Popular
                      </div>
                      <div className="tier-card__name">Pro</div>
                      <div className="tier-card__price">$4.99<span>/mo</span></div>
                      <ul className="tier-card__features">
                        {PRO_FEATURES.map((f) => (
                          <li key={f}>
                            <Check size={13} className="tier-card__check" />
                            {f}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Pro+ */}
                    <div className="tier-card tier-card--pro">
                      <div className="tier-card__pro-label">
                        <Crown size={11} /> Best Value
                      </div>
                      <div className="tier-card__name">Pro+</div>
                      <div className="tier-card__price">$9.99<span>/mo</span></div>
                      <ul className="tier-card__features">
                        {PRO_PLUS_FEATURES.map((f) => (
                          <li key={f}>
                            <Check size={13} className="tier-card__check" />
                            {f}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {checkoutError && (
                    <p className="upgrade-modal__error">{checkoutError}</p>
                  )}
                  <div style={{ display: 'flex', gap: 8, width: '100%' }}>
                    <button
                      className="upgrade-modal__cta"
                      style={{ flex: 1 }}
                      onClick={handleUpgrade}
                      disabled={working}
                    >
                      {working ? (
                        <span className="upgrade-modal__cta-inner">
                          <Loader size={15} className="upgrade-modal__spinner" />
                          Redirecting…
                        </span>
                      ) : (
                        'Upgrade to Pro — $4.99/mo'
                      )}
                    </button>
                    <button
                      className="upgrade-modal__cta upgrade-modal__cta--secondary"
                      style={{ flex: 1 }}
                      onClick={handleUpgradeProPlus}
                      disabled={working}
                    >
                      {working ? (
                        <span className="upgrade-modal__cta-inner">
                          <Loader size={15} className="upgrade-modal__spinner" />
                          Redirecting…
                        </span>
                      ) : (
                        'Upgrade to Pro+ — $9.99/mo'
                      )}
                    </button>
                  </div>
                  <p className="upgrade-modal__cancel-note">Cancel anytime. No commitment.</p>
                </>
              )}
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

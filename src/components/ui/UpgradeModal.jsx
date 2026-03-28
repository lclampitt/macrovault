import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, Crown, Lock, Loader } from 'lucide-react';
import posthog from '../../lib/posthog';
import { supabase } from '../../supabaseClient';
import './UpgradeModal.css';

const API_BASE = process.env.REACT_APP_API_BASE || 'https://gainlytics-1.onrender.com';

const PRO_FEATURES = [
  'AI Body Analyzer (measurements + photo)',
  'All Calculators (TDEE, Protein, 1RM)',
  'Advanced Progress Charts',
  'Unlimited Workout Logs',
  'Goal Planner',
];

const FREE_FEATURES = [
  'Dashboard',
  'Exercise Library',
  'Basic Workout Logging',
];

// Feature-specific headlines shown below the modal title
const FEATURE_HEADLINES = {
  analyzer: "You've used all 3 free analyses this month",
  workouts: "You've reached 10 workout logs on the free plan",
  goals:    "You've reached the goal limit on the free plan",
  default:  "Unlock everything with Gainlytics Pro",
};

export default function UpgradeModal({ isOpen, onClose, feature = null }) {
  const [working, setWorking] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');

  const headline = FEATURE_HEADLINES[feature] ?? FEATURE_HEADLINES.default;

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
      posthog.capture('upgrade_clicked', { feature });
      window.location.href = url;  // redirect to Stripe Checkout
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
                  <Lock size={22} />
                </div>
                <h2 className="upgrade-modal__title">Unlock Pro Features</h2>
                <p className="upgrade-modal__subtitle">{headline}</p>
              </div>

              {/* Tier cards */}
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
              </div>

              {/* CTA — calls Stripe checkout */}
              {checkoutError && (
                <p className="upgrade-modal__error">{checkoutError}</p>
              )}
              <button
                className="upgrade-modal__cta"
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
              <p className="upgrade-modal__cancel-note">Cancel anytime. No commitment.</p>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

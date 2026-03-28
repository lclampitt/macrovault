import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, Crown, Lock } from 'lucide-react';
import './UpgradeModal.css';

const PRO_FEATURES = [
  'AI Body Analyzer',
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

export default function UpgradeModal({ isOpen, onClose }) {
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

          {/* Modal */}
          <motion.div
            className="upgrade-modal"
            initial={{ opacity: 0, scale: 0.94, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 20 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
          >
            {/* Close */}
            <button className="upgrade-modal__close" onClick={onClose}>
              <X size={18} />
            </button>

            {/* Header */}
            <div className="upgrade-modal__header">
              <div className="upgrade-modal__lock-icon">
                <Lock size={22} />
              </div>
              <h2 className="upgrade-modal__title">Unlock Pro Features</h2>
              <p className="upgrade-modal__subtitle">
                This feature requires a Gainlytics Pro subscription.
              </p>
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

            {/* CTA */}
            <button className="upgrade-modal__cta">
              Upgrade to Pro — $4.99/mo
            </button>
            <p className="upgrade-modal__cancel-note">Cancel anytime. No commitment.</p>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ChevronRight } from 'lucide-react';
import posthog from '../../lib/posthog';
import { supabase } from '../../supabaseClient';
import '../../styles/OnboardingWizard.css';

const TOTAL_STEPS = 4;

const GOALS = [
  { key: 'Cutting',     emoji: '🔥', title: 'Cutting',     desc: 'Lose fat while preserving muscle mass' },
  { key: 'Bulking',     emoji: '💪', title: 'Bulking',     desc: 'Build muscle and gain strength' },
  { key: 'Maintenance', emoji: '⚖️', title: 'Maintenance', desc: 'Stay balanced and maintain your current physique' },
];

const CHECKLIST = [
  { num: 1, label: 'Add measurements or a body photo' },
  { num: 2, label: 'Set a goal in the Goal Planner' },
  { num: 3, label: 'Log your first workout' },
  { num: 4, label: 'Update your progress entry' },
];

/* ── Slide variants ── */
const slideVariants = {
  enter: (dir) => ({ x: dir > 0 ? '60%' : '-60%', opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit:  (dir) => ({ x: dir > 0 ? '-60%' : '60%', opacity: 0 }),
};

const transition = { duration: 0.28, ease: [0.25, 0.46, 0.45, 0.94] };

/* ── Progress dots ── */
function Dots({ step }) {
  return (
    <div className="ob-dots">
      {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
        <div
          key={i}
          className={`ob-dot ${i === step ? 'ob-dot--active' : i < step ? 'ob-dot--done' : ''}`}
        />
      ))}
      <span className="ob-step-label">Step {step + 1} of {TOTAL_STEPS}</span>
    </div>
  );
}

/* ── Step 1: Welcome ── */
function StepWelcome({ data, onChange }) {
  return (
    <div className="ob-step">
      <div>
        <h2 className="ob-step__title">Welcome to MacroVault</h2>
        <p className="ob-step__subtitle">Let's set up your profile in 3 quick steps.</p>
      </div>

      <div className="ob-fields">
        <div className="ob-field">
          <label className="ob-label">Display name</label>
          <input
            className="ob-input"
            type="text"
            placeholder="What should we call you?"
            value={data.displayName}
            onChange={(e) => onChange('displayName', e.target.value)}
          />
        </div>

        <div className="ob-field">
          <label className="ob-label">Units preference</label>
          <div className="ob-units-toggle">
            {['lbs', 'kg'].map((u) => (
              <button
                key={u}
                type="button"
                className={`ob-units-toggle__btn${data.units === u ? ' ob-units-toggle__btn--active' : ''}`}
                onClick={() => onChange('units', u)}
              >
                {u.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Step 2: Goal ── */
function StepGoal({ data, onChange }) {
  return (
    <div className="ob-step">
      <div>
        <h2 className="ob-step__title">What's your current goal?</h2>
        <p className="ob-step__subtitle">We'll use this to personalise your experience.</p>
      </div>

      <div className="ob-goal-cards">
        {GOALS.map(({ key, emoji, title, desc }) => {
          const selected = data.goalType === key;
          return (
            <motion.button
              key={key}
              type="button"
              className={`ob-goal-card${selected ? ' ob-goal-card--selected' : ''}`}
              onClick={() => onChange('goalType', key)}
              whileTap={{ scale: 0.98 }}
            >
              <span className="ob-goal-card__icon">{emoji}</span>
              <div className="ob-goal-card__body">
                <div className="ob-goal-card__title">{title}</div>
                <div className="ob-goal-card__desc">{desc}</div>
              </div>
              <div className="ob-goal-card__check">
                {selected && <Check size={13} strokeWidth={3} />}
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

/* ── Step 3: Stats ── */
function StepStats({ data, onChange }) {
  return (
    <div className="ob-step">
      <div>
        <h2 className="ob-step__title">Enter your starting measurements</h2>
        <p className="ob-step__subtitle">You can update these any time in Progress.</p>
      </div>

      <div className="ob-stats-grid">
        <div className="ob-field ob-field--full">
          <label className="ob-label">Current weight ({data.units})</label>
          <input
            className="ob-input"
            type="number"
            placeholder={data.units === 'lbs' ? 'e.g. 175' : 'e.g. 80'}
            value={data.weight}
            onChange={(e) => onChange('weight', e.target.value)}
          />
        </div>

        <div className="ob-field">
          <label className="ob-label">Body fat % <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></label>
          <input
            className="ob-input"
            type="number"
            placeholder="e.g. 18"
            value={data.bodyFat}
            onChange={(e) => onChange('bodyFat', e.target.value)}
          />
        </div>

        <div className="ob-field">
          <label className="ob-label">Height (in) <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></label>
          <input
            className="ob-input"
            type="number"
            placeholder="e.g. 70"
            value={data.height}
            onChange={(e) => onChange('height', e.target.value)}
          />
        </div>
      </div>

      <p className="ob-hint">
        <span style={{ color: 'var(--accent-light)' }}>ℹ</span>
        All fields optional — skip and add these later from Progress.
      </p>
    </div>
  );
}

/* ── Step 4: All Set ── */
function StepReady() {
  return (
    <div className="ob-step">
      <div>
        <h2 className="ob-step__title">You're ready! 🎉</h2>
        <p className="ob-step__subtitle">Your dashboard is set up. Here's what to do first.</p>
      </div>

      <div className="ob-checklist">
        {CHECKLIST.map(({ num, label }) => (
          <motion.div
            key={num}
            className="ob-checklist__item"
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: num * 0.08 }}
          >
            <div className="ob-checklist__num">{num}</div>
            <span className="ob-checklist__label">{label}</span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

/* ── Main Wizard ── */
export default function OnboardingWizard({ session, onComplete }) {
  const [step, setStep]       = useState(0);
  const [direction, setDir]   = useState(1);
  const [saving, setSaving]   = useState(false);

  const emailName = session?.user?.email?.split('@')[0] ?? '';

  const [data, setData] = useState({
    displayName: emailName,
    units:       'lbs',
    goalType:    '',
    weight:      '',
    bodyFat:     '',
    height:      '',
  });

  const onChange = (key, val) => setData((d) => ({ ...d, [key]: val }));

  const go = (next) => {
    setDir(next > step ? 1 : -1);
    setStep(next);
  };

  const skip = () => go(TOTAL_STEPS - 1);

  /* Save everything and complete */
  const handleComplete = async () => {
    setSaving(true);
    const uid = session.user.id;
    const today = new Date().toISOString().slice(0, 10);

    try {
      // 1 — update profile
      await supabase.from('profiles').upsert({
        id:                   uid,
        onboarding_completed: true,
        display_name:         data.displayName.trim() || null,
        units_preference:     data.units,
        height_in:            data.height !== '' ? Number(data.height) : null,
      }, { onConflict: 'id' });

      // 2 — save goal type (only if selected)
      if (data.goalType) {
        await supabase.from('goals').upsert(
          {
            user_id:        uid,
            goal:           data.goalType,
            calories:       0,
            protein:        0,
            carbs:          0,
            fat:            0,
            timeframe_weeks: 0,
          },
          { onConflict: 'user_id' }
        );
      }

      // 3 — save starting stats (only if weight was provided)
      if (data.weight !== '') {
        let weightVal = Number(data.weight);
        // Convert to lbs for storage (progress table stores as lbs)
        if (data.units === 'kg') weightVal = Math.round(weightVal * 2.20462 * 10) / 10;

        await supabase.from('progress').upsert(
          {
            user_id:      uid,
            date:         today,
            weight_kg:    weightVal,
            body_fat_pct: data.bodyFat !== '' ? Number(data.bodyFat) : null,
          },
          { onConflict: ['user_id', 'date'] }
        );
      }
    } catch (err) {
      console.error('Onboarding save error:', err);
    } finally {
      posthog.capture('onboarding_completed', {
        goal_type: data.goalType || null,
        units: data.units,
      });
      setSaving(false);
      onComplete();
    }
  };

  const isLast = step === TOTAL_STEPS - 1;

  const stepComponents = [
    <StepWelcome key="welcome" data={data} onChange={onChange} />,
    <StepGoal    key="goal"    data={data} onChange={onChange} />,
    <StepStats   key="stats"   data={data} onChange={onChange} />,
    <StepReady   key="ready" />,
  ];

  return (
    <AnimatePresence>
      <motion.div
        className="ob-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
      >
        <motion.div
          className="ob-card"
          initial={{ opacity: 0, scale: 0.96, y: 24 }}
          animate={{ opacity: 1, scale: 1,    y: 0 }}
          exit={{ opacity: 0, scale: 0.96,    y: 24 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
        >
          {/* Header with dots */}
          <div className="ob-header">
            <Dots step={step} />
          </div>

          {/* Sliding step content */}
          <div className="ob-steps-viewport">
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={step}
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={transition}
              >
                {stepComponents[step]}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Footer */}
          <div className="ob-footer">
            {!isLast && (
              <button className="ob-skip" onClick={skip}>
                Skip for now
              </button>
            )}

            <div className="ob-btn-row">
              {step > 0 && !isLast && (
                <button className="ob-btn ob-btn--ghost" onClick={() => go(step - 1)}>
                  Back
                </button>
              )}

              {isLast ? (
                <motion.button
                  className="ob-btn ob-btn--teal"
                  onClick={handleComplete}
                  disabled={saving}
                  whileTap={{ scale: 0.97 }}
                >
                  {saving ? 'Saving…' : 'Go to dashboard'}
                </motion.button>
              ) : (
                <motion.button
                  className="ob-btn ob-btn--teal"
                  onClick={() => go(step + 1)}
                  whileTap={{ scale: 0.97 }}
                >
                  Continue <ChevronRight size={15} />
                </motion.button>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '../../supabaseClient';
import '../../styles/goalplanner.css';

/* Stagger container for card entrance */
const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};
const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } },
};

/* Macro progress bar */
function MacroBar({ label, value, max, color }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="gp-macro-bar">
      <div className="gp-macro-bar__top">
        <span className="gp-macro-bar__label">{label}</span>
        <span className="gp-macro-bar__value">{value}g</span>
      </div>
      <div className="gp-macro-bar__track">
        <motion.div
          className="gp-macro-bar__fill"
          style={{ background: color }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}

const emptyMacros = { calories: 0, protein: 0, carbs: 0, fat: 0 };

export default function GoalPlanner({ compact = false }) {
  // Auth / data state
  const [userId, setUserId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Current goal row from the 'goals' table
  const [rowId, setRowId] = useState(null);
  const [goal, setGoal] = useState('');
  const [macros, setMacros] = useState(emptyMacros);
  const [timeframe, setTimeframe] = useState(0);
  const [createdAt, setCreatedAt] = useState(null);

  // UI state for edit/view/delete
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // --------------------------------------
  // AUTH + INITIAL FETCH
  // --------------------------------------
  useEffect(() => {
    let mounted = true;

    (async () => {
      setLoading(true);
      setError('');
      setMessage('');

      // 1) Check if the user is logged in via Supabase Auth
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (!mounted) return;

      if (userError || !userData?.user) {
        // No logged-in user → show friendly message and stop
        setError('Please log in to manage your goal.');
        setLoading(false);
        return;
      }

      const uid = userData.user.id;
      setUserId(uid);

      // 2) Fetch existing goal for this user (if any)
      const { data, error } = await supabase
        .from('goals')
        .select('*')
        .eq('user_id', uid)
        .maybeSingle();

      if (!mounted) return;

      // PGRST116 = "No rows found", which is fine for a first-time user
      if (error && error.code !== 'PGRST116') {
        setError('Could not fetch your goal.');
      } else if (data) {
        // Existing goal found → populate state and start in view mode
        setRowId(data.id ?? null);
        setGoal(data.goal ?? '');
        setMacros({
          calories: Number(data.calories) || 0,
          protein: Number(data.protein) || 0,
          carbs: Number(data.carbs) || 0,
          fat: Number(data.fat) || 0,
        });
        setTimeframe(Number(data.timeframe_weeks) || 0);
        setCreatedAt(data.created_at ?? null);
        setEditing(false);
      } else {
        // No goal yet → start in editing mode so user sees the form immediately
        setEditing(true);
      }

      setLoading(false);
    })();

    // Cleanup flag to avoid setting state on unmounted component
    return () => {
      mounted = false;
    };
  }, []);

  // Derived flag: do we have enough data to consider this a "complete" goal?
  const hasGoal = useMemo(
    () => !!goal && timeframe > 0 && macros.calories > 0,
    [goal, timeframe, macros]
  );

  // Timeline derived values
  const timeline = useMemo(() => {
    const weeksElapsed = createdAt
      ? Math.floor((Date.now() - new Date(createdAt)) / (7 * 24 * 60 * 60 * 1000))
      : 0;
    const currentWeek = Math.min(weeksElapsed + 1, timeframe || 1);
    const pct = timeframe > 0 ? Math.min((weeksElapsed / timeframe) * 100, 100) : 0;
    const daysLeft = timeframe > 0 ? Math.max(timeframe * 7 - weeksElapsed * 7, 0) : 0;
    const motivations = {
      Cutting:     'Stay consistent — every deficit counts.',
      Bulking:     'Keep eating and lifting — progress takes time.',
      Maintenance: 'Consistency is key. You\'re doing great.',
    };
    return { currentWeek, pct, daysLeft, motivation: motivations[goal] ?? 'Keep going — you\'ve got this.' };
  }, [createdAt, timeframe, goal]);

  // --------------------------------------
  // SAVE / UPSERT
  // --------------------------------------
  async function handleSave() {
    setError('');
    setMessage('');

    // Basic validation to prevent saving obviously incomplete rows
    if (!goal) return setError('Please select a goal.');
    if (macros.calories <= 0) return setError('Calories must be greater than 0.');
    if (timeframe <= 0) return setError('Timeframe (weeks) must be greater than 0.');

    setSaving(true);

    // Payload mirrors the columns of the 'goals' table
    const payload = {
      user_id: userId,
      goal,
      calories: Number(macros.calories) || 0,
      protein: Number(macros.protein) || 0,
      carbs: Number(macros.carbs) || 0,
      fat: Number(macros.fat) || 0,
      timeframe_weeks: Number(timeframe) || 0,
    };

    // upsert + onConflict ensures "one goal per user" behavior
    const { data, error } = await supabase
      .from('goals')
      .upsert(payload, { onConflict: ['user_id'] })
      .select('*')
      .maybeSingle();

    if (error) {
      setError(`Error saving goal: ${error.message}`);
    } else {
      // Ensure we keep track of the row id after first insert
      setRowId(data?.id ?? rowId);
      setMessage('Goal saved successfully!');
      // After saving, switch to read-only view mode
      setEditing(false);
    }

    setSaving(false);
  }

  // --------------------------------------
  // DELETE
  // --------------------------------------
  async function handleDelete() {
    if (!userId) return;
    setDeleting(true);
    setError('');
    setMessage('');

    // Delete the user's row from the 'goals' table
    const { error } = await supabase
      .from('goals')
      .delete()
      .eq('user_id', userId);

    if (error) {
      setError(`Error deleting goal: ${error.message}`);
    } else {
      // Reset local state after successful deletion
      setRowId(null);
      setGoal('');
      setMacros(emptyMacros);
      setTimeframe(0);
      setMessage('Goal deleted.');
      // Show blank form so user can create a new goal
      setEditing(true);
    }
    setDeleting(false);
    setConfirmDelete(false);
  }

  // --------------------------------------
  // RENDER
  // --------------------------------------

  /* Total macros for bar sizing */
  const totalMacroG = macros.protein + macros.carbs + macros.fat || 1;

  return (
    <div className={`gp-container ${compact ? "gp-container--compact" : ""}`}>

      {/* Status + feedback messages */}
      {loading && <p className="gp-loading">Loading…</p>}
      {!loading && error && <p className="gp-error">{error}</p>}
      {!loading && message && (
        <p className={`gp-message ${message.includes('saved') || message.includes('deleted') ? 'gp-message--success' : ''}`}>
          {message}
        </p>
      )}

      {/* ── EDIT / CREATE FORM ── */}
      {!loading && editing && (
        <motion.div
          className="gp-form-card"
          variants={stagger}
          initial="hidden"
          animate="show"
        >
          {/* Goal type pills */}
          <motion.div variants={fadeUp} className="gp-section-label">Goal type</motion.div>
          <motion.div variants={fadeUp} className="gp-pills">
            {['Cutting', 'Bulking', 'Maintenance'].map((g) => (
              <motion.button
                key={g}
                onClick={() => setGoal(g)}
                className={`gp-pill ${goal === g ? 'gp-pill--active' : ''}`}
                whileTap={{ scale: 0.97 }}
              >
                {g}
              </motion.button>
            ))}
          </motion.div>

          {/* Macro grid */}
          <motion.div variants={fadeUp} className="gp-section-label" style={{ marginTop: 16 }}>
            Macronutrients
          </motion.div>
          <motion.div variants={fadeUp} className="gp-macro-grid">
            {[
              { key: 'calories', label: 'Calories', unit: 'kcal/day' },
              { key: 'protein',  label: 'Protein',  unit: 'g/day' },
              { key: 'carbs',    label: 'Carbs',    unit: 'g/day' },
              { key: 'fat',      label: 'Fat',      unit: 'g/day' },
            ].map(({ key, label, unit }) => (
              <div key={key} className="gp-field">
                <label className="gp-field__label">{label}</label>
                <input
                  type="number"
                  className="input"
                  value={macros[key]}
                  onChange={(e) => setMacros({ ...macros, [key]: parseInt(e.target.value, 10) || 0 })}
                />
                <span className="gp-field__unit">{unit}</span>
              </div>
            ))}
          </motion.div>

          {/* Timeframe */}
          <motion.div variants={fadeUp} className="gp-field gp-field--full" style={{ marginTop: 12 }}>
            <label className="gp-field__label">Timeframe (weeks)</label>
            <input
              type="number"
              className="input"
              style={{ maxWidth: 160 }}
              value={timeframe}
              onChange={(e) => setTimeframe(parseInt(e.target.value, 10) || 0)}
            />
          </motion.div>

          {/* Actions */}
          <motion.div variants={fadeUp} className="gp-actions">
            <motion.button
              className="btn btn-primary"
              onClick={handleSave}
              disabled={saving}
              whileTap={{ scale: 0.97 }}
            >
              {saving ? 'Saving…' : 'Save Goal'}
            </motion.button>
            {rowId && (
              <motion.button
                className="btn btn-destructive"
                onClick={() => setConfirmDelete(true)}
                disabled={deleting}
                whileTap={{ scale: 0.97 }}
              >
                {deleting ? 'Deleting…' : 'Delete Goal'}
              </motion.button>
            )}
          </motion.div>

          {/* Confirm delete */}
          {confirmDelete && (
            <motion.div
              className="gp-confirm"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <span>Delete your current goal permanently?</span>
              <div className="gp-confirm__actions">
                <motion.button
                  className="btn btn-destructive"
                  onClick={handleDelete}
                  disabled={deleting}
                  whileTap={{ scale: 0.97 }}
                >
                  Yes, delete
                </motion.button>
                <motion.button
                  className="btn btn-primary"
                  onClick={() => setConfirmDelete(false)}
                  whileTap={{ scale: 0.97 }}
                >
                  Cancel
                </motion.button>
              </div>
            </motion.div>
          )}
        </motion.div>
      )}

      {/* ── READ-ONLY VIEW ── */}
      {!loading && hasGoal && !editing && (
        <>
          {/* Summary card */}
          <motion.div
            className="gp-view-card"
            variants={stagger}
            initial="hidden"
            animate="show"
          >
            {/* Top row: badge + active pill */}
            <motion.div variants={fadeUp} className="gp-view-top">
              <div>
                <span className="gp-goal-badge">{goal} phase</span>
                <p className="gp-view-sub">{timeframe} weeks · {macros.calories} kcal/day</p>
              </div>
              <span className="gp-active-pill">Active</span>
            </motion.div>

            {/* Macro bars */}
            <motion.div variants={fadeUp} className="gp-macro-bars">
              <MacroBar label="Protein" value={macros.protein} max={totalMacroG} color="#1D9E75" />
              <MacroBar label="Carbs"   value={macros.carbs}   max={totalMacroG} color="#5DCAA5" />
              <MacroBar label="Fat"     value={macros.fat}     max={totalMacroG} color="#0F6E56" />
            </motion.div>

            {/* Actions */}
            {!compact && (
              <motion.div variants={fadeUp} className="gp-actions">
                <motion.button
                  className="btn btn-primary"
                  onClick={() => setEditing(true)}
                  whileTap={{ scale: 0.97 }}
                >
                  Edit goal
                </motion.button>
              </motion.div>
            )}
          </motion.div>

          {/* 2-col grid: timeline + macro chips */}
          {!compact && (
            <div className="gp-grid">
              {/* Timeline card */}
              <motion.div
                className="gp-timeline-card"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.06, ease: 'easeOut' }}
              >
                <p className="gp-timeline-title">Goal timeline</p>
                <div className="gp-timeline-week">
                  Week {timeline.currentWeek}
                  <span>of {timeframe}</span>
                </div>
                <div className="gp-timeline-bar__track">
                  <motion.div
                    className="gp-timeline-bar__fill"
                    initial={{ width: 0 }}
                    animate={{ width: `${timeline.pct}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                  />
                </div>
                <div className="gp-timeline-meta">
                  <span>{Math.round(timeline.pct)}% complete</span>
                  <span>{timeline.daysLeft} days left</span>
                </div>
                <p className="gp-timeline-motivation">{timeline.motivation}</p>
              </motion.div>

              {/* Macro chips card */}
              <motion.div
                className="gp-macro-chips-card"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.12, ease: 'easeOut' }}
              >
                <p className="gp-macro-chips-title">Macro targets</p>
                <div className="gp-macro-chips-grid">
                  {[
                    { label: 'Calories', value: macros.calories, unit: 'kcal' },
                    { label: 'Protein',  value: macros.protein,  unit: 'g' },
                    { label: 'Carbs',    value: macros.carbs,    unit: 'g' },
                    { label: 'Fat',      value: macros.fat,      unit: 'g' },
                  ].map(({ label, value, unit }) => (
                    <div key={label} className="gp-macro-chip">
                      <span className="gp-macro-chip__value">{value}<span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 2 }}>{unit}</span></span>
                      <span className="gp-macro-chip__label">{label}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>
          )}
        </>
      )}

      {/* No goal yet + not in edit mode */}
      {!loading && !hasGoal && !editing && (
        <motion.div
          className="gp-empty"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <p>No goal set yet.</p>
          {userId && (
            <motion.button
              className="btn btn-primary"
              onClick={() => setEditing(true)}
              whileTap={{ scale: 0.97 }}
            >
              Add Goal
            </motion.button>
          )}
        </motion.div>
      )}
    </div>
  );
}

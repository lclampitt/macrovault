import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, Target } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import posthog from '../../lib/posthog';
import { supabase } from '../../supabaseClient';
import { useUpgrade } from '../../context/UpgradeContext';
import { useTheme } from '../../hooks/useTheme';
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

/* ── TOTALS ROW (count-up on change) ──────────────────── */
function TotalsRow({ totals }) {
  const [disp, setDisp] = useState({ calories: 0, protein: 0, carbs: 0, fat: 0 });

  useEffect(() => {
    const keys = ['calories', 'protein', 'carbs', 'fat'];
    const steps = 24;
    let step = 0;
    const timer = setInterval(() => {
      step++;
      const t = Math.min(step / steps, 1);
      const ease = 1 - Math.pow(1 - t, 2);
      const next = {};
      keys.forEach((k) => { next[k] = Math.round(totals[k] * ease); });
      setDisp(next);
      if (step >= steps) clearInterval(timer);
    }, 20);
    return () => clearInterval(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totals.calories, totals.protein, totals.carbs, totals.fat]);

  return (
    <div className="gp-log-totals">
      <span className="gp-log-totals__label">Today's total</span>
      <span>
        {disp.calories} kcal · {disp.protein}g protein · {disp.carbs}g carbs · {disp.fat}g fat
      </span>
    </div>
  );
}

/* ── NUTRITION LOGGER ─────────────────────────────────── */
function NutritionLogger({ userId }) {
  const today = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  const [entries,     setEntries]     = useState([]);
  const [form,        setForm]        = useState({ calories: '', protein: '', carbs: '', fat: '', meal_name: '' });
  const [submitting,  setSubmitting]  = useState(false);
  const [deletingId,  setDeletingId]  = useState(null);

  useEffect(() => {
    if (!userId) return;

    async function load() {
      const { data } = await supabase
        .from('food_logs')
        .select('*')
        .eq('user_id', userId)
        .eq('logged_date', today)
        .order('created_at', { ascending: false });
      if (data) setEntries(data);
    }

    load();

    const channel = supabase
      .channel(`nl_${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'food_logs', filter: `user_id=eq.${userId}` }, load)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId, today]);

  async function handleAdd(e) {
    e.preventDefault();
    const cal = parseFloat(form.calories) || 0;
    const pro = parseFloat(form.protein)  || 0;
    if (cal === 0 && pro === 0) { toast.error('Enter at least calories or protein.'); return; }
    setSubmitting(true);
    const { error } = await supabase.from('food_logs').insert({
      user_id:    userId,
      logged_date: today,
      meal_name:  form.meal_name.trim() || null,
      calories:   cal,
      protein_g:  pro,
      carbs_g:    parseFloat(form.carbs) || 0,
      fat_g:      parseFloat(form.fat)   || 0,
    });
    setSubmitting(false);
    if (error) { toast.error('Failed to log entry.'); return; }
    toast.success('Entry logged');
    setForm({ calories: '', protein: '', carbs: '', fat: '', meal_name: '' });
  }

  async function handleDelete(id) {
    setDeletingId(id);
    const { error } = await supabase.from('food_logs').delete().eq('id', id);
    setDeletingId(null);
    if (error) { toast.error('Failed to remove entry.'); return; }
    setEntries((prev) => prev.filter((e) => e.id !== id));
    toast.success('Entry removed');
  }

  const totals = useMemo(() => entries.reduce((acc, e) => ({
    calories: acc.calories + (Number(e.calories)  || 0),
    protein:  acc.protein  + (Number(e.protein_g) || 0),
    carbs:    acc.carbs    + (Number(e.carbs_g)   || 0),
    fat:      acc.fat      + (Number(e.fat_g)     || 0),
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 }), [entries]);

  return (
    <div className="gp-grid">
      {/* Card 1 — Log form */}
      <div className="gp-log-card">
        <p className="gp-section-label">Log today's nutrition</p>
        <form onSubmit={handleAdd} className="gp-log-form">
          <div className="gp-macro-grid">
            {[
              { key: 'calories', label: 'Calories (kcal)' },
              { key: 'protein',  label: 'Protein (g)' },
              { key: 'carbs',    label: 'Carbs (g)' },
              { key: 'fat',      label: 'Fat (g)' },
            ].map(({ key, label }) => (
              <div key={key} className="gp-field">
                <label className="gp-field__label">{label}</label>
                <input
                  type="number"
                  className="input gp-log-input"
                  min="0"
                  step="any"
                  placeholder="0"
                  value={form[key]}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                />
              </div>
            ))}
          </div>
          <input
            type="text"
            className="input gp-log-input gp-log-meal-input"
            placeholder="e.g. Breakfast, Lunch, Snack"
            value={form.meal_name}
            onChange={(e) => setForm((f) => ({ ...f, meal_name: e.target.value }))}
            maxLength={80}
          />
          <motion.button
            type="submit"
            className="btn gp-log-btn"
            disabled={submitting}
            whileTap={{ scale: 0.97 }}
          >
            {submitting ? 'Logging…' : 'Add entry'}
          </motion.button>
        </form>
      </div>

      {/* Card 2 — Today's log */}
      <div className="gp-log-card">
        <p className="gp-section-label">Today's log</p>
        <div className="gp-log-entries">
          {entries.length === 0 ? (
            <p className="gp-log-empty">No entries yet. Log your first meal above.</p>
          ) : (
            <AnimatePresence initial={false}>
              {entries.map((entry, i) => (
                <motion.div
                  key={entry.id}
                  className="gp-log-entry"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0, marginBottom: 0, overflow: 'hidden' }}
                  transition={{ duration: 0.25, delay: i * 0.05 }}
                  layout
                >
                  <div className="gp-log-entry__left">
                    <span className="gp-log-entry__label">
                      {entry.meal_name || `Entry ${entries.length - i}`}
                    </span>
                    <span className="gp-log-entry__time">
                      {new Date(entry.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="gp-log-entry__right">
                    <span className="gp-log-entry__cal">{entry.calories} kcal</span>
                    <span className="gp-log-entry__macros">
                      {entry.protein_g}g · {entry.carbs_g}g · {entry.fat_g}g
                    </span>
                  </div>
                  <motion.button
                    className="gp-log-entry__del"
                    onClick={() => handleDelete(entry.id)}
                    disabled={deletingId === entry.id}
                    whileTap={{ scale: 0.9 }}
                    aria-label="Remove entry"
                  >
                    <X size={14} />
                  </motion.button>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>
        {entries.length > 0 && <TotalsRow totals={totals} />}
      </div>
    </div>
  );
}

function GoalPlannerGate() {
  const { triggerUpgrade } = useUpgrade();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: '80px 24px', textAlign: 'center' }}>
      <Target size={48} style={{ color: 'var(--accent)', opacity: 0.6 }} />
      <h2 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Goal Planner</h2>
      <p style={{ color: 'var(--text-muted)', fontSize: 14, margin: 0, maxWidth: 320, lineHeight: 1.6 }}>
        Set calorie and macro goals, track your daily nutrition, and plan your progress. A Pro feature.
      </p>
      <button
        onClick={() => triggerUpgrade('goals')}
        style={{
          marginTop: 4, width: '100%', maxWidth: 320,
          background: 'var(--accent)', color: '#fff',
          fontSize: 14, fontWeight: 500, padding: '13px',
          borderRadius: 'var(--radius-md)', border: 'none', cursor: 'pointer',
          fontFamily: 'inherit',
          transition: 'background 0.15s ease',
        }}
        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--accent-dark)'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'var(--accent)'}
      >
        Upgrade to Pro — $4.99/mo
      </button>
      <button
        onClick={() => triggerUpgrade('goals')}
        style={{
          color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer',
          background: 'none', border: 'none', fontFamily: 'inherit',
          textDecoration: 'underline', textUnderlineOffset: 2,
          transition: 'color 0.15s ease', padding: 0,
        }}
        onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
        onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
      >
        See what's included
      </button>
    </div>
  );
}

function GoalPlannerContent({ compact = false }) {
  const { isSpectrum } = useTheme();

  // Spotlight via query param
  const [searchParams, setSearchParams] = useSearchParams();
  const nutritionRef = useRef(null);
  const [spotlight, setSpotlight] = useState(false);

  useEffect(() => {
    if (searchParams.get('spotlight') === 'nutrition') {
      setSpotlight(true);
      // Remove the param from URL so it doesn't persist on refresh
      searchParams.delete('spotlight');
      setSearchParams(searchParams, { replace: true });

      // Auto-scroll after a brief delay to let the DOM render
      const timer = setTimeout(() => {
        nutritionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 400);

      // Fade out spotlight after 3 seconds
      const fadeTimer = setTimeout(() => setSpotlight(false), 3000);
      return () => { clearTimeout(timer); clearTimeout(fadeTimer); };
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        // Existing goal found → populate state
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

        // If macros are set but timeframe is missing (e.g. saved from Macro Calculator),
        // go straight to edit mode so the user can complete the goal
        const isComplete = !!data.goal && (Number(data.timeframe_weeks) || 0) > 0 && (Number(data.calories) || 0) > 0;
        setEditing(!isComplete);
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
      posthog.capture('goal_created');
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
              <MacroBar label="Protein" value={macros.protein} max={totalMacroG} color={isSpectrum ? 'var(--color-protein)' : 'var(--accent)'} />
              <MacroBar label="Carbs"   value={macros.carbs}   max={totalMacroG} color={isSpectrum ? 'var(--color-carbs)' : 'var(--accent-light)'} />
              <MacroBar label="Fat"     value={macros.fat}     max={totalMacroG} color={isSpectrum ? 'var(--color-fat)' : 'var(--accent-dark)'} />
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
                    { label: 'Calories', value: macros.calories, unit: 'kcal', spectrumColor: 'var(--color-calories)' },
                    { label: 'Protein',  value: macros.protein,  unit: 'g',    spectrumColor: 'var(--color-protein)' },
                    { label: 'Carbs',    value: macros.carbs,    unit: 'g',    spectrumColor: 'var(--color-carbs)' },
                    { label: 'Fat',      value: macros.fat,      unit: 'g',    spectrumColor: 'var(--color-fat)' },
                  ].map(({ label, value, unit, spectrumColor }) => (
                    <div key={label} className="gp-macro-chip">
                      <span className="gp-macro-chip__value" style={isSpectrum ? { color: spectrumColor } : undefined}>{value}<span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 2 }}>{unit}</span></span>
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

      {/* Nutrition Logger — always visible on full page when logged in */}
      {!loading && userId && !compact && (
        <div ref={nutritionRef} className={spotlight ? 'gp-spotlight' : ''}>
          <NutritionLogger userId={userId} />
        </div>
      )}
    </div>
  );
}

export default function GoalPlanner({ compact = false, isPro = false }) {
  if (!isPro) return <GoalPlannerGate />;
  return <GoalPlannerContent compact={compact} />;
}

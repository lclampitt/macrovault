import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, Plus, X, ChevronDown, Check, Loader, Search } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import { useTheme } from '../../hooks/useTheme';
import localExercises from '../../data/exercises.json';
import '../../styles/ExerciseLibrary.css';

/* Get today's date in LOCAL timezone as YYYY-MM-DD (avoids UTC off-by-one) */
function getLocalDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const SPECTRUM_MUSCLE_COLORS = {
  'chest':     '#EA580C',
  'back':      '#2563EB',
  'shoulders': '#7C3AED',
  'arms':      '#DB2777',
  'legs':      '#1D9E75',
  'core':      '#EF9F27',
  'cardio':    '#60A5FA',
  'full body': '#5DCAA5',
};

const PAGE_SIZE = 30;

const BODY_PARTS  = ['All', 'Chest', 'Back', 'Shoulders', 'Arms', 'Legs', 'Core', 'Full Body'];
const EQUIPMENTS  = ['All', 'Barbell', 'Dumbbell', 'Cable', 'Machine', 'Bodyweight', 'Resistance Band', 'Kettlebell'];
const DIFFICULTIES = ['All', 'Beginner', 'Intermediate', 'Advanced'];

/* ── Helpers ──────────────────────────────────────────────── */
function displayBodyPart(bp = '') {
  const n = bp.toLowerCase();
  if (n === 'chest')                         return 'Chest';
  if (n === 'back')                          return 'Back';
  if (n === 'shoulders')                     return 'Shoulders';
  if (n === 'upper arms' || n === 'arms')    return 'Arms';
  if (n === 'lower arms')                    return 'Forearms';
  if (n === 'upper legs' || n === 'legs')    return 'Legs';
  if (n === 'lower legs')                    return 'Calves';
  if (n === 'waist' || n === 'core')         return 'Core';
  if (n === 'full body')                     return 'Full Body';
  if (n === 'cardio')                        return 'Cardio';
  if (n === 'neck')                          return 'Neck';
  return bp.charAt(0).toUpperCase() + bp.slice(1);
}

function titleCase(str = '') {
  return str.replace(/\b\w/g, (c) => c.toUpperCase());
}

function spectrumColorForBodyPart(bp = '') {
  const n = bp.toLowerCase();
  if (n === 'chest')                         return SPECTRUM_MUSCLE_COLORS['chest'];
  if (n === 'back')                          return SPECTRUM_MUSCLE_COLORS['back'];
  if (n === 'shoulders')                     return SPECTRUM_MUSCLE_COLORS['shoulders'];
  if (n === 'upper arms' || n === 'arms')    return SPECTRUM_MUSCLE_COLORS['arms'];
  if (n === 'lower arms')                    return SPECTRUM_MUSCLE_COLORS['arms'];
  if (n === 'upper legs' || n === 'legs')    return SPECTRUM_MUSCLE_COLORS['legs'];
  if (n === 'lower legs')                    return SPECTRUM_MUSCLE_COLORS['legs'];
  if (n === 'waist' || n === 'core')         return SPECTRUM_MUSCLE_COLORS['core'];
  if (n === 'full body')                     return SPECTRUM_MUSCLE_COLORS['full body'];
  if (n === 'cardio')                        return SPECTRUM_MUSCLE_COLORS['cardio'];
  return SPECTRUM_MUSCLE_COLORS['chest']; // fallback
}

function difficultyStyle(d) {
  if (d === 'beginner')     return { bg: 'rgba(151, 196, 89, 0.12)', text: '#97C459' };
  if (d === 'intermediate') return { bg: 'rgba(239, 159, 39, 0.12)', text: '#EF9F27' };
  if (d === 'advanced')     return { bg: 'rgba(240, 149, 149, 0.12)', text: '#F09595' };
  return { bg: 'var(--border)', text: 'var(--text-muted)' };
}

/* ── Dropdown ─────────────────────────────────────────────── */
function Dropdown({ label, options, value, onChange, isSpectrum, spectrumColorMap }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const fn = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  // Spectrum styling for the active button when a specific muscle group is selected
  const activeSpectrumColor = isSpectrum && spectrumColorMap && value !== 'All'
    ? spectrumColorMap[value.toLowerCase()] : null;
  const btnStyle = activeSpectrumColor
    ? { borderColor: activeSpectrumColor, color: activeSpectrumColor }
    : undefined;

  return (
    <div className="el-dropdown" ref={ref}>
      <button className="el-dropdown__btn" style={btnStyle} onClick={() => setOpen((o) => !o)}>
        {value === 'All' ? label : value}
        <ChevronDown size={14} className={`el-dropdown__chevron ${open ? 'el-dropdown__chevron--open' : ''}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            className="el-dropdown__menu"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
          >
            {options.map((o) => {
              const isActive = value === o;
              const itemColor = isSpectrum && spectrumColorMap && isActive && o !== 'All'
                ? spectrumColorMap[o.toLowerCase()] : null;
              return (
                <button
                  key={o}
                  className={`el-dropdown__item ${isActive ? 'el-dropdown__item--active' : ''}`}
                  style={itemColor ? { color: itemColor } : undefined}
                  onClick={() => { onChange(o); setOpen(false); }}
                >
                  {o}
                  {isActive && <Check size={12} />}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Exercise Card ────────────────────────────────────────── */
function ExerciseCard({ exercise, isFavorited, onFavorite, onView, onAdd, index, isSpectrum, isY2K }) {
  const { bg, text } = difficultyStyle(exercise.difficulty);
  const muscleColor = isSpectrum ? spectrumColorForBodyPart(exercise.body_part) : null;
  return (
    <motion.div
      className="el-card"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.04, ease: 'easeOut' }}
      onClick={() => onView(exercise)}
      whileHover={{ y: -2 }}
    >
      {/* Typography panel */}
      <div className="el-card__illustration">
        <div className="el-card__illus-bar" style={muscleColor ? { background: muscleColor } : undefined} />
        <p className="el-card__illus-group" style={muscleColor ? { color: muscleColor } : undefined}>{displayBodyPart(exercise.body_part)}</p>
        <p className="el-card__illus-muscle" style={muscleColor ? { color: muscleColor, opacity: 0.7 } : undefined}>{titleCase(exercise.target_muscle)}</p>
      </div>

      {/* Info panel */}
      <div className="el-card__info">
        <p className="el-card__name">{exercise.name}</p>
        <div className="el-card__tags">
          <span
            className="el-tag el-tag--accent"
            style={muscleColor ? { background: `${muscleColor}1A`, color: muscleColor } : undefined}
          >
            {exercise.target_muscle}
          </span>
          <span className="el-tag el-tag--gray">{exercise.equipment}</span>
          <span className="el-tag" style={{ background: bg, color: text }}>{exercise.difficulty}</span>
        </div>
        <div className="el-card__actions" onClick={(e) => e.stopPropagation()}>
          <button className="el-card__view-btn" onClick={() => onView(exercise)}>{isY2K ? '[ View Details ]' : 'View Details'}</button>
          <button
            className={`el-card__icon-btn ${isFavorited ? 'el-card__icon-btn--favorited' : ''}`}
            onClick={() => onFavorite(exercise.id)}
            title={isFavorited ? 'Remove favorite' : 'Add favorite'}
          >
            <Heart size={15} fill={isFavorited ? 'currentColor' : 'none'} />
          </button>
          <button className="el-card__icon-btn" onClick={() => onAdd(exercise)} title="Add to workout">
            <Plus size={15} />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

/* ── Detail Sheet ─────────────────────────────────────────── */
function DetailSheet({ exercise, isFavorited, onFavorite, onAdd, onClose, userGoal, isSpectrum }) {
  const { bg, text } = difficultyStyle(exercise.difficulty);
  const isMobile = window.innerWidth < 768;
  const muscleColor = isSpectrum ? spectrumColorForBodyPart(exercise.body_part) : null;

  return createPortal(
    <AnimatePresence>
      <motion.div
        className="el-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        className={`el-sheet ${isMobile ? 'el-sheet--mobile' : 'el-sheet--desktop'}`}
        initial={isMobile ? { y: '100%' } : { x: '100%' }}
        animate={isMobile ? { y: 0 } : { x: 0 }}
        exit={isMobile ? { y: '100%' } : { x: '100%' }}
        transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
        onClick={(e) => e.stopPropagation()}
      >
        {isMobile && <div className="el-sheet__handle" />}

        {/* Header */}
        <div className="el-sheet__header">
          <h2 className="el-sheet__title">{exercise.name}</h2>
          <div className="el-sheet__header-actions">
            <button
              className={`el-sheet__icon-btn ${isFavorited ? 'el-sheet__icon-btn--favorited' : ''}`}
              onClick={() => onFavorite(exercise.id)}
            >
              <Heart size={18} fill={isFavorited ? 'currentColor' : 'none'} />
            </button>
            <button className="el-sheet__icon-btn" onClick={onClose}>
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="el-sheet__body">
          {/* Typography panel */}
          <div className="el-sheet__illustration el-sheet__illustration--typo">
            <div className="el-sheet__illus-bar" style={muscleColor ? { background: muscleColor } : undefined} />
            <p className="el-sheet__illus-group" style={muscleColor ? { color: muscleColor } : undefined}>{displayBodyPart(exercise.body_part)}</p>
            <p className="el-sheet__illus-muscle" style={muscleColor ? { color: muscleColor, opacity: 0.7 } : undefined}>{titleCase(exercise.target_muscle)}</p>
          </div>

          {/* Tags */}
          <div className="el-sheet__tags">
            <span className="el-tag" style={{ background: bg, color: text }}>{exercise.difficulty}</span>
            <span className="el-tag el-tag--gray">{exercise.equipment}</span>
          </div>

          {/* Instructions */}
          {exercise.instructions?.length > 0 && (
            <div className="el-sheet__section">
              <p className="el-sheet__section-title">How to perform</p>
              <ol className="el-sheet__steps">
                {exercise.instructions.map((step, i) => (
                  <li key={i} className="el-sheet__step">
                    <span className="el-sheet__step-num">{i + 1}</span>
                    <span className="el-sheet__step-text">{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Form cues */}
          {exercise.form_cues?.length > 0 && (
            <div className="el-sheet__section">
              <p className="el-sheet__section-title">Form cues</p>
              <ul className="el-sheet__cues">
                {exercise.form_cues.map((c, i) => (
                  <li key={i} className="el-sheet__cue el-sheet__cue--green">{c}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Common mistakes */}
          {exercise.common_mistakes?.length > 0 && (
            <div className="el-sheet__section">
              <p className="el-sheet__section-title">Avoid these mistakes</p>
              <ul className="el-sheet__cues">
                {exercise.common_mistakes.map((m, i) => (
                  <li key={i} className="el-sheet__cue el-sheet__cue--red">{m}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Sets & reps guidance */}
          {exercise.sets_reps_guidance && (
            <div className="el-sheet__section">
              <p className="el-sheet__section-title">Recommended sets / reps</p>
              <div className="el-sheet__guidance">
                {['cutting', 'bulking', 'maintenance'].map((goal) => (
                  <div
                    key={goal}
                    className={`el-sheet__guidance-row ${userGoal === goal ? 'el-sheet__guidance-row--active' : ''}`}
                  >
                    <span className="el-sheet__guidance-label">{goal.charAt(0).toUpperCase() + goal.slice(1)}</span>
                    <span className="el-sheet__guidance-value">{exercise.sets_reps_guidance[goal]}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ height: 80 }} />
        </div>

        {/* Fixed CTA */}
        <div className="el-sheet__cta">
          <button className="el-sheet__add-btn" onClick={() => onAdd(exercise)}>
            Add to today's workout
          </button>
        </div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}

/* ── Session naming helpers ───────────────────────────────── */
const SMART_NAMES = {
  chest: 'Chest Day', back: 'Back Day', legs: 'Leg Day',
  shoulders: 'Shoulder Day', arms: 'Arm Day', core: 'Core Day', 'full body': 'Full Body',
};
const SUGGESTION_PILLS = {
  chest:       ['Chest Day', 'Push Day', 'Chest & Tris', 'Upper Body'],
  back:        ['Back Day', 'Pull Day', 'Back & Bis', 'Upper Body'],
  legs:        ['Leg Day', 'Lower Body', 'Legs & Glutes', 'Squats Day'],
  shoulders:   ['Shoulder Day', 'Push Day', 'Upper Body', 'Shoulders & Arms'],
  arms:        ['Arm Day', 'Bis & Tris', 'Push/Pull', 'Upper Body'],
  core:        ['Core Day', 'Abs Day', 'Full Body', 'Core & Cardio'],
  'full body': ['Full Body', 'Total Body', 'Compound Day', 'Functional'],
};
const DEFAULT_PILLS = ["Today's Workout", 'Full Body', 'Strength Day', 'Training'];

/* ── Add to Workout Sheet ─────────────────────────────────── */
function AddWorkoutSheet({ exercise, userId, onClose, onToast }) {
  const [sets, setSets]   = useState(3);
  const [reps, setReps]   = useState(10);
  const [weight, setWeight] = useState('');
  const [rpe, setRpe]     = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Multi-step state
  const [step, setStep] = useState('form'); // 'form' | 'naming' | 'picker'
  const [todayWorkouts, setTodayWorkouts] = useState([]);
  const [pendingEntry, setPendingEntry] = useState(null);

  // Naming modal state
  const bp = (exercise.body_part || '').toLowerCase();
  const smartName = SMART_NAMES[bp] || "Today's Workout";
  const pills = SUGGESTION_PILLS[bp] || DEFAULT_PILLS;
  const [sessionName, setSessionName] = useState(smartName);
  const nameInputRef = useRef(null);

  useEffect(() => {
    if (step === 'naming' && nameInputRef.current) {
      setTimeout(() => nameInputRef.current?.focus(), 80);
    }
  }, [step]);

  const buildEntry = () => ({
    name: exercise.name,
    sets: Array.from({ length: sets }, () => ({
      reps: String(reps),
      weight: weight || '',
      notes: [rpe ? `RPE ${rpe}` : '', notes].filter(Boolean).join(' — ') || '',
    })),
  });

  const appendToWorkout = async (workoutId, existingExercises, entry) => {
    const { error } = await supabase
      .from('workouts')
      .update({ exercises: [...(existingExercises || []), entry] })
      .eq('id', workoutId);
    if (error) throw new Error(error.message);
  };

  const createWorkout = async (name, entry) => {
    const today = getLocalDateString();
    const { error } = await supabase.from('workouts').insert({
      user_id: userId,
      workout_date: today,
      workout_name: name,
      muscle_group: exercise.body_part,
      exercises: [entry],
    });
    if (error) throw new Error(error.message);
  };

  // Called when user clicks "Add to today's workout" in the form step
  const handleFormSubmit = async () => {
    if (!userId) return;
    setSaving(true);
    setSaveError('');
    const today = getLocalDateString();
    const entry = buildEntry();

    try {
      const { data: existing, error: fetchErr } = await supabase
        .from('workouts')
        .select('id, workout_name, exercises')
        .eq('user_id', userId)
        .eq('workout_date', today)
        .order('created_at', { ascending: true });
      if (fetchErr) throw new Error(fetchErr.message);

      const workouts = existing || [];
      setPendingEntry(entry);

      if (workouts.length === 0) {
        // Case A — no workout today, ask for a name
        setSessionName(smartName);
        setStep('naming');
      } else if (workouts.length === 1) {
        // Case B — one workout, append silently
        await appendToWorkout(workouts[0].id, workouts[0].exercises, entry);
        onToast(`Added to "${workouts[0].workout_name}"`);
        onClose();
      } else {
        // Case C — multiple workouts, let user pick
        setTodayWorkouts(workouts);
        setStep('picker');
      }
    } catch (err) {
      setSaveError(err.message || 'Something went wrong.');
    } finally {
      setSaving(false);
    }
  };

  // Case A — save with chosen name
  const handleNameSave = async (name) => {
    setSaving(true);
    try {
      await createWorkout(name || 'Workout', pendingEntry);
      onToast(`Workout started — "${name || 'Workout'}"`);
      onClose();
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  };

  // Case C — append to chosen existing workout
  const handlePickSession = async (workout) => {
    setSaving(true);
    try {
      await appendToWorkout(workout.id, workout.exercises, pendingEntry);
      onToast(`Added to "${workout.workout_name}"`);
      onClose();
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <AnimatePresence>
      {/* Overlay */}
      <motion.div
        key="add-overlay"
        className="el-overlay el-overlay--add"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
      />

      {/* ── FORM STEP ─────────────────────────────────────── */}
      {step === 'form' && (
        <motion.div
          key="add-form"
          className="el-add-sheet"
          initial={{ opacity: 0, scale: 0.96, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 8 }}
          transition={{ duration: 0.2 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="el-add-sheet__header">
            <p className="el-add-sheet__title">Add to workout</p>
            <button className="el-sheet__icon-btn" onClick={onClose}><X size={16} /></button>
          </div>
          <p className="el-add-sheet__exercise-name">{exercise.name}</p>
          <div className="el-add-sheet__fields">
            <div className="el-add-sheet__field">
              <label>Sets</label>
              <input type="number" value={sets} min={1} onChange={(e) => setSets(Number(e.target.value))} className="input" />
            </div>
            <div className="el-add-sheet__field">
              <label>Reps</label>
              <input type="number" value={reps} min={1} onChange={(e) => setReps(Number(e.target.value))} className="input" />
            </div>
            <div className="el-add-sheet__field">
              <label>Weight (optional)</label>
              <input type="number" value={weight} placeholder="lbs or kg" onChange={(e) => setWeight(e.target.value)} className="input" />
            </div>
            <div className="el-add-sheet__field">
              <label>RPE (optional)</label>
              <input type="number" value={rpe} min={1} max={10} placeholder="1–10" onChange={(e) => setRpe(e.target.value)} className="input" />
            </div>
          </div>
          <div className="el-add-sheet__field el-add-sheet__field--full">
            <label>Notes (optional)</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="input el-add-sheet__textarea" placeholder="Any additional notes..." />
          </div>
          {saveError && <p className="el-add-sheet__error">{saveError}</p>}
          <button className="el-add-sheet__submit" onClick={handleFormSubmit} disabled={saving}>
            {saving ? <Loader size={16} className="el-spin" /> : "Add to today's workout"}
          </button>
        </motion.div>
      )}

      {/* ── NAMING MODAL (Case A) ──────────────────────────── */}
      {step === 'naming' && (
        <motion.div
          key="naming-modal"
          className="el-naming-modal"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          onClick={(e) => e.stopPropagation()}
        >
          <p className="el-naming-modal__title">Name today's session</p>
          <p className="el-naming-modal__sub">Give this workout a name so it's easy to find in your history.</p>
          <input
            ref={nameInputRef}
            className="input el-naming-modal__input"
            value={sessionName}
            onChange={(e) => setSessionName(e.target.value)}
            placeholder="e.g. Chest Day"
          />
          <div className="el-naming-modal__pills">
            {pills.map((p, i) => (
              <motion.button
                key={p}
                className={`el-naming-pill ${sessionName === p ? 'el-naming-pill--active' : ''}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => setSessionName(p)}
              >
                {p}
              </motion.button>
            ))}
          </div>
          {saveError && <p className="el-add-sheet__error">{saveError}</p>}
          <div className="el-naming-modal__actions">
            <button
              className="el-add-sheet__submit"
              style={{ flex: 1 }}
              onClick={() => handleNameSave(sessionName)}
              disabled={saving}
            >
              {saving ? <Loader size={16} className="el-spin" /> : 'Save & log exercise'}
            </button>
            <button
              className="el-naming-modal__skip"
              onClick={() => handleNameSave('Workout')}
              disabled={saving}
            >
              Skip naming
            </button>
          </div>
        </motion.div>
      )}

      {/* ── SESSION PICKER (Case C) ────────────────────────── */}
      {step === 'picker' && (
        <motion.div
          key="picker-sheet"
          className="el-picker-sheet"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="el-add-sheet__header">
            <p className="el-add-sheet__title">Add to which session today?</p>
            <button className="el-sheet__icon-btn" onClick={onClose}><X size={16} /></button>
          </div>
          <div className="el-picker-sheet__list">
            {todayWorkouts.map((w) => (
              <button key={w.id} className="el-picker-sheet__row" onClick={() => handlePickSession(w)} disabled={saving}>
                <span className="el-picker-sheet__name">{w.workout_name}</span>
                <span className="el-picker-sheet__count">{(w.exercises || []).length} exercise{(w.exercises || []).length !== 1 ? 's' : ''}</span>
              </button>
            ))}
            <div className="el-picker-sheet__divider" />
            <button
              className="el-picker-sheet__new"
              onClick={() => { setSessionName(smartName); setStep('naming'); }}
              disabled={saving}
            >
              <Plus size={15} /> Start a new session
            </button>
          </div>
          {saveError && <p className="el-add-sheet__error" style={{ padding: '0 16px 12px' }}>{saveError}</p>}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

/* ══════════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════════ */
export default function ExerciseLibrary() {
  const { isSpectrum, isY2K } = useTheme();
  const [searchParams, setSearchParams] = useSearchParams();

  // Filter state from URL
  const search     = searchParams.get('q') || '';
  const bodyPart   = searchParams.get('bp') || 'All';
  const equipment  = searchParams.get('eq') || 'All';
  const difficulty = searchParams.get('diff') || 'All';

  const [tab, setTab]         = useState('all');
  const [allExercises, setAllExercises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage]       = useState(1);
  const [userId, setUserId]   = useState(null);
  const [favorites, setFavorites] = useState(new Set());
  const [recentlyUsed, setRecentlyUsed] = useState([]);
  const [selectedExercise, setSelectedExercise] = useState(null);
  const [addingExercise, setAddingExercise]     = useState(null);
  const [userGoal, setUserGoal] = useState(null);
  const [toast, setToast] = useState(null);

  const debounceRef = useRef(null);

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

  /* Load user + exercises + favorites + recently used */
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const uid = session?.user?.id;
      setUserId(uid);

      // Load all exercises — fall back to local JSON if Supabase returns nothing
      const { data: exData } = await supabase
        .from('exercises')
        .select('*')
        .order('name', { ascending: true });

      const exercises = (exData && exData.length > 0)
        ? exData
        : localExercises.map((e) => ({
            ...e,
            body_part: e.bodyPart,
            target_muscle: e.targetMuscle,
            secondary_muscles: e.secondaryMuscles,
            sets_reps_guidance: e.setsRepsGuidance,
            form_cues: e.formCues,
            common_mistakes: e.commonMistakes,
          }));
      setAllExercises(exercises);
      setLoading(false);

      if (uid) {
        // Favorites
        const { data: favData } = await supabase
          .from('user_favorites')
          .select('exercise_id')
          .eq('user_id', uid);
        setFavorites(new Set((favData || []).map((f) => f.exercise_id)));

        // Recently used from workouts
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const { data: workoutData } = await supabase
          .from('workouts')
          .select('exercises')
          .eq('user_id', uid)
          .gte('workout_date', thirtyDaysAgo)
          .order('workout_date', { ascending: false });

        if (workoutData) {
          const usedNames = new Set();
          workoutData.forEach((w) => {
            (w.exercises || []).forEach((e) => {
              if (e.name) usedNames.add(e.name.toLowerCase());
            });
          });
          const matched = exercises.filter((ex) => usedNames.has(ex.name.toLowerCase())).slice(0, 10);
          setRecentlyUsed(matched);
        }

        // User goal from goal planner
        const { data: goalData } = await supabase
          .from('goal_plans')
          .select('goal_type')
          .eq('user_id', uid)
          .maybeSingle();
        if (goalData?.goal_type) setUserGoal(goalData.goal_type.toLowerCase());
      }
    })();
  }, []);

  /* Filtered exercises */
  const filtered = useMemo(() => {
    let list = allExercises;
    if (search)     list = list.filter((e) => e.name.toLowerCase().includes(search.toLowerCase()));
    if (bodyPart  !== 'All') list = list.filter((e) => e.body_part.toLowerCase() === bodyPart.toLowerCase());
    if (equipment !== 'All') list = list.filter((e) => e.equipment.toLowerCase() === equipment.toLowerCase());
    if (difficulty !== 'All') list = list.filter((e) => e.difficulty.toLowerCase() === difficulty.toLowerCase());
    return list;
  }, [allExercises, search, bodyPart, equipment, difficulty]);

  /* Displayed list based on active tab */
  const displayList = useMemo(() => {
    if (tab === 'favorites') return allExercises.filter((e) => favorites.has(e.id));
    if (tab === 'recent')    return recentlyUsed;
    return filtered;
  }, [tab, allExercises, favorites, filtered, recentlyUsed]);

  const paginated = displayList.slice(0, page * PAGE_SIZE);
  const hasMore   = paginated.length < displayList.length;

  /* Search debounce */
  const handleSearch = (val) => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearchParams((prev) => {
        const p = new URLSearchParams(prev);
        if (val) p.set('q', val); else p.delete('q');
        return p;
      });
      setPage(1);
    }, 400);
  };

  const setFilter = (key, val) => {
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      if (val === 'All') p.delete(key); else p.set(key, val);
      return p;
    });
    setPage(1);
  };

  /* Favorites toggle */
  const handleFavorite = useCallback(async (exerciseId) => {
    if (!userId) return;
    const isFav = favorites.has(exerciseId);
    setFavorites((prev) => {
      const next = new Set(prev);
      if (isFav) next.delete(exerciseId); else next.add(exerciseId);
      return next;
    });
    if (isFav) {
      await supabase.from('user_favorites').delete().eq('user_id', userId).eq('exercise_id', exerciseId);
    } else {
      await supabase.from('user_favorites').insert({ user_id: userId, exercise_id: exerciseId });
    }
  }, [userId, favorites]);

  if (loading) {
    return (
      <div className="el">
        <p className="el-title">Exercise Library</p>
        <div className="el-grid">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="el-skeleton-card">
              <div className="el-skeleton-card__img" />
              <div className="el-skeleton-card__body">
                <div className="el-skeleton-card__line el-skeleton-card__line--title" />
                <div className="el-skeleton-card__line" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="el">
      <p className="el-title">Exercise Library</p>

      {/* Tabs */}
      <motion.div className="el-tabs" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
        {[['all', 'All Exercises'], ['favorites', '\u2665 Favorites'], ['recent', 'Recently Used']].map(([key, label]) => {
          const isActive = tab === key;
          const spectrumTabStyle = isSpectrum && isActive && key === 'all'
            ? { background: '#1a0d30', border: '1px solid #7C3AED', color: '#A78BFA' }
            : undefined;
          return (
            <button
              key={key}
              className={`el-tab ${isActive ? 'el-tab--active' : ''}`}
              style={spectrumTabStyle}
              onClick={() => { setTab(key); setPage(1); }}
            >
              {label}
            </button>
          );
        })}
      </motion.div>

      {/* Filters — only show on "All Exercises" tab */}
      {tab === 'all' && (
        <motion.div className="el-filters" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
          <div className="el-search-wrap">
            <Search size={14} className="el-search-icon" />
            <input
              className="el-search"
              placeholder="Search exercises..."
              defaultValue={search}
              onChange={(e) => handleSearch(e.target.value)}
            />
          </div>
          <Dropdown label="Muscle Group" options={BODY_PARTS}   value={bodyPart}   onChange={(v) => setFilter('bp', v)} isSpectrum={isSpectrum} spectrumColorMap={SPECTRUM_MUSCLE_COLORS} />
          <Dropdown label="Equipment"    options={EQUIPMENTS}   value={equipment}  onChange={(v) => setFilter('eq', v)} />
          <Dropdown label="Difficulty"   options={DIFFICULTIES} value={difficulty} onChange={(v) => setFilter('diff', v)} />
        </motion.div>
      )}

      {/* Results count */}
      {tab === 'all' && (
        <p className="el-count">{isY2K ? `[${Math.min(paginated.length, displayList.length)}] of [${displayList.length}] exercises` : `Showing ${Math.min(paginated.length, displayList.length)} of ${displayList.length} exercises`}</p>
      )}

      {/* Empty state */}
      {displayList.length === 0 && (
        <div className="el-empty">
          {tab === 'favorites'
            ? 'No favorites yet. Tap the ♥ on any exercise to save it.'
            : tab === 'recent'
            ? 'Log your first workout to see recently used exercises here.'
            : 'No exercises found. Try adjusting your filters.'}
        </div>
      )}

      {/* Grid */}
      <div className="el-grid">
        <AnimatePresence>
          {paginated.map((ex, i) => (
            <ExerciseCard
              key={ex.id}
              exercise={ex}
              index={i % PAGE_SIZE}
              isFavorited={favorites.has(ex.id)}
              onFavorite={handleFavorite}
              onView={setSelectedExercise}
              onAdd={setAddingExercise}
              isSpectrum={isSpectrum}
              isY2K={isY2K}
            />
          ))}
        </AnimatePresence>
      </div>

      {/* Load more */}
      {hasMore && (
        <div className="el-load-more">
          <button className="el-load-more__btn" onClick={() => setPage((p) => p + 1)}>
            {isY2K ? '[ Load More ]' : 'Load more'}
          </button>
        </div>
      )}

      {/* Detail sheet */}
      {selectedExercise && (
        <DetailSheet
          exercise={selectedExercise}
          isFavorited={favorites.has(selectedExercise.id)}
          onFavorite={handleFavorite}
          onAdd={(ex) => { setAddingExercise(ex); }}
          onClose={() => setSelectedExercise(null)}
          userGoal={userGoal}
          isSpectrum={isSpectrum}
        />
      )}

      {/* Add to workout sheet */}
      {addingExercise && (
        <AddWorkoutSheet
          exercise={addingExercise}
          userId={userId}
          onClose={() => setAddingExercise(null)}
          onToast={showToast}
        />
      )}

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            className="el-toast"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.2 }}
          >
            <Check size={14} />
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Trash2, Dumbbell } from 'lucide-react';
import posthog from '../../lib/posthog';
import { supabase } from '../../supabaseClient';
import { useUpgrade } from '../../context/UpgradeContext';
import { usePlan } from '../../hooks/usePlan';
import { useTheme } from '../../hooks/useTheme';
import '../../styles/WorkoutLogger.css';

const API_BASE = process.env.REACT_APP_API_BASE || 'https://gainlytics-1.onrender.com';


/* Format date string: "2025-12-12" → "Dec 12, 2025" */
function formatDate(dateStr = '') {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// eslint-disable-next-line no-unused-vars
const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } },
};

export default function WorkoutLogger() {
  const { triggerUpgrade } = useUpgrade();
  const { plan, isPro } = usePlan();
  const { isSpectrum, isY2K } = useTheme();

  const MUSCLE_GROUPS = ['Upper Body', 'Lower Body', 'Legs', 'Full Body', 'Core', 'Cardio'];

  // Form state for creating/editing a workout
  const [workoutDate, setWorkoutDate] = useState(new Date().toISOString().split('T')[0]);
  const [workoutName, setWorkoutName] = useState('');
  const [muscleGroup, setMuscleGroup] = useState('');
  const [exercises, setExercises] = useState([]);
  const [newExercise, setNewExercise] = useState('');
  const [message, setMessage] = useState('');
  const [userId, setUserId] = useState(null);
  const [editingWorkoutId, setEditingWorkoutId] = useState(null);

  // History and UI state
  const [workoutHistory, setWorkoutHistory] = useState([]);
  const [expanded, setExpanded] = useState({});
  const [formOpen, setFormOpen] = useState(false);

  // Scroll to top when opening the logger
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Get the logged-in user from Supabase
  useEffect(() => {
    async function fetchUser() {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data?.user) {
        setMessage('Please log in to save or view workouts.');
        return;
      }
      setUserId(data.user.id);
    }
    fetchUser();
  }, []);

  // Once we know the user, load their saved workouts
  useEffect(() => {
    if (!userId) return;
    fetchWorkouts();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Fetch all workouts for the current user
  const fetchWorkouts = async () => {
    const { data, error } = await supabase
      .from('workouts')
      .select('*')
      .eq('user_id', userId)
      .order('workout_date', { ascending: false });

    if (error) console.error('Fetch error:', error);
    else setWorkoutHistory(data);
  };

  // Delete a workout from history
  const deleteWorkout = async (id) => {
    const { error } = await supabase.from('workouts').delete().eq('id', id);
    if (error) console.error('Delete error:', error);
    else setWorkoutHistory((prev) => prev.filter((w) => w.id !== id));
  };

  // Add a new exercise row to the current workout
  const addExercise = () => {
    if (!newExercise.trim()) return;
    setExercises([
      ...exercises,
      { name: newExercise.trim(), sets: [{ weight: '', reps: '', notes: '' }] },
    ]);
    setNewExercise('');
  };

  // Add an additional set to an existing exercise
  const addSet = (i) => {
    const updated = [...exercises];
    updated[i].sets.push({ weight: '', reps: '', notes: '' });
    setExercises(updated);
  };

  // Update a single field of a single set for an exercise
  const handleSetChange = (exerciseIndex, setIndex, field, value) => {
    const updated = [...exercises];
    updated[exerciseIndex].sets[setIndex][field] = value;
    setExercises(updated);
  };

  // Remove an exercise from the current workout
  const deleteExercise = (i) => {
    const updated = exercises.filter((_, idx) => idx !== i);
    setExercises(updated);
  };

  // Save new workout or update an existing one in Supabase
  const saveWorkout = async () => {
    if (!workoutName.trim() || exercises.length === 0) {
      setMessage('Please enter a workout name and add at least one exercise.');
      return;
    }
    if (!userId) {
      setMessage('Please log in first.');
      return;
    }

    const workoutData = {
      user_id: userId,
      workout_date: workoutDate,
      workout_name: workoutName.trim(),
      muscle_group: muscleGroup || null,
      exercises,
    };

    let error;

    // If editingWorkoutId exists, update the existing row (no limit check needed for edits)
    if (editingWorkoutId) {
      ({ error } = await supabase
        .from('workouts')
        .update(workoutData)
        .eq('id', editingWorkoutId));
      if (!error) {
        setMessage('Workout updated successfully!');
        setEditingWorkoutId(null);
      }
    } else {
      // New workout — route through backend to enforce free-tier limit
      try {
        const res = await fetch(`${API_BASE}/workouts/save`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(workoutData),
        });
        if (res.status === 403) {
          triggerUpgrade('workouts');
          return;
        }
        if (!res.ok) {
          const txt = await res.text();
          throw new Error(txt);
        }
        posthog.capture('workout_logged', { exercise_count: exercises.length });
        setMessage('Workout saved successfully!');
      } catch (err) {
        console.error('Save error:', err);
        setMessage(`Error saving workout: ${err.message}`);
        return;
      }
    }

    if (error) {
      console.error('Save error:', error);
      setMessage(`Error saving workout: ${error.message}`);
    } else {
      // Reset form and refresh history
      setWorkoutName('');
      setMuscleGroup('');
      setExercises([]);
      setFormOpen(false);
      fetchWorkouts();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Load a workout from history into the editor
  const editWorkout = (workout) => {
    setWorkoutDate(workout.workout_date);
    setWorkoutName(workout.workout_name);
    setMuscleGroup(workout.muscle_group || '');
    setExercises(workout.exercises || []);
    setEditingWorkoutId(workout.id);
    setFormOpen(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setMessage('Editing workout...');
  };

  // Expand/collapse a workout in the history list
  const toggleExpand = (id) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const atLimit = !isPro && workoutHistory.length >= 10;

  return (
    <div className="wl">

      {/* ── Y2K FREE TIER USAGE COUNTER ── */}
      {isY2K && !isPro && workoutHistory.length > 0 && (
        <div className="wl-y2k-usage">
          <div className="wl-y2k-usage__bar-track">
            <div
              className="wl-y2k-usage__bar-fill"
              style={{
                width: `${Math.min((workoutHistory.length / 10) * 100, 100)}%`,
                background: workoutHistory.length >= 8
                  ? 'linear-gradient(180deg, #FFD700, #CC9900)'
                  : `linear-gradient(180deg, var(--accent-light), var(--accent))`,
              }}
            />
          </div>
          <span className={`wl-y2k-usage__text ${workoutHistory.length >= 8 ? 'wl-y2k-usage__text--warn' : ''}`}>
            {workoutHistory.length >= 8
              ? `WARNING: [${workoutHistory.length}] / 10 logs used. Upgrade to Pro for unlimited.`
              : `[${workoutHistory.length}] / 10 free workout logs used`}
          </span>
        </div>
      )}

      {/* ── LOG SECTION ── */}
      <motion.div
        className="wl-log-card"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
      >
        {/* Y2K gradient title bar */}
        {isY2K && (
          <div className="wl-y2k-titlebar">
            <Dumbbell width={10} height={10} stroke="var(--accent-light)" strokeWidth={2} fill="none" />
            <span>LOG WORKOUT</span>
          </div>
        )}

        {/* Header row: title + expand toggle */}
        <div className="wl-log-header">
          <div>
            <p className="wl-section-title">Log a workout</p>
            {!isPro && !isY2K && workoutHistory.length > 0 && (
              <p style={{
                fontSize: 11,
                color: workoutHistory.length >= 8 ? '#EF9F27' : 'var(--text-muted)',
                margin: '2px 0 0',
              }}>
                {workoutHistory.length} / 10 free workout logs used
              </p>
            )}
          </div>
          {!atLimit && (
            <motion.button
              className="btn btn-primary wl-toggle-btn"
              onClick={() => setFormOpen((o) => !o)}
              whileTap={{ scale: 0.97 }}
              style={isSpectrum ? { border: '1px solid #1D9E75', color: '#5DCAA5', background: '#0a1a0f' } : undefined}
            >
              {formOpen ? (isY2K ? '[ Cancel ]' : 'Cancel') : (isY2K ? '[ + New workout ]' : '+ New workout')}
            </motion.button>
          )}
        </div>

        {/* Locked banner when free user hits limit */}
        {atLimit && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 0 4px' }}>
            <Lock size={16} style={{ color: 'var(--accent-light)', flexShrink: 0 }} />
            <div>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
                You've reached 10 workout logs on the free plan.
              </p>
              <button
                onClick={() => triggerUpgrade('workouts')}
                style={{ fontSize: 12, color: 'var(--accent-light)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginTop: 4, textDecoration: 'underline' }}
              >
                Upgrade to Pro for unlimited logging
              </button>
            </div>
          </div>
        )}

        {/* Collapsible form */}
        <AnimatePresence initial={false}>
          {formOpen && (
            <motion.div
              key="log-form"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              style={{ overflow: 'hidden' }}
            >
              <div className="wl-form-inner">
                {/* Y2K form section label */}
                {isY2K && <div className="wl-y2k-form-label">NEW WORKOUT ENTRY</div>}

                {/* Date + Name row */}
                <div className="wl-top-row">
                  <div className="wl-field">
                    <label className="wl-label">Date</label>
                    <input
                      type="date"
                      className="input"
                      value={workoutDate}
                      onChange={(e) => setWorkoutDate(e.target.value)}
                    />
                  </div>
                  <div className="wl-field wl-field--grow">
                    <label className="wl-label">Workout name</label>
                    <input
                      type="text"
                      className="input"
                      value={workoutName}
                      onChange={(e) => setWorkoutName(e.target.value)}
                      placeholder="e.g. Push Day, Lower Body, Full Body"
                    />
                  </div>
                </div>

                {/* Muscle group selector */}
                <div className="wl-field">
                  <label className="wl-label">Muscle group</label>
                  <div className="wl-mg-pills">
                    {MUSCLE_GROUPS.map((g) => (
                      <motion.button
                        key={g}
                        type="button"
                        className={`wl-mg-pill ${muscleGroup === g ? 'wl-mg-pill--active' : ''}`}
                        onClick={() => setMuscleGroup(muscleGroup === g ? '' : g)}
                        whileTap={{ scale: 0.95 }}
                      >
                        {g}
                      </motion.button>
                    ))}
                  </div>
                </div>

                {/* Add exercise row */}
                <div className="wl-adder">
                  <input
                    type="text"
                    className="input"
                    value={newExercise}
                    onChange={(e) => setNewExercise(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addExercise()}
                    placeholder="Add an exercise…"
                  />
                  <motion.button className="btn btn-primary" onClick={addExercise} whileTap={{ scale: 0.97 }}>
                    {isY2K ? '[ Add ]' : 'Add'}
                  </motion.button>
                </div>

                {/* Exercise blocks */}
                {exercises.map((ex, i) => (
                  <motion.div
                    key={i}
                    className="wl-exercise-block"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="wl-exercise-header">
                      <span className="wl-exercise-name">{ex.name}</span>
                      <motion.button
                        className="btn btn-destructive"
                        onClick={() => deleteExercise(i)}
                        whileTap={{ scale: 0.97 }}
                      >
                        {isY2K ? '[ Remove ]' : 'Remove'}
                      </motion.button>
                    </div>

                    <table className="wl-sets-table">
                      <thead>
                        <tr>
                          <th>Set</th>
                          <th>Weight (lbs)</th>
                          <th>Reps</th>
                          <th>Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ex.sets.map((set, j) => (
                          <tr key={j}>
                            <td className="wl-set-num">{j + 1}</td>
                            <td><input type="number" className="input wl-set-input" value={set.weight} onChange={(e) => handleSetChange(i, j, 'weight', e.target.value)} /></td>
                            <td><input type="number" className="input wl-set-input" value={set.reps}   onChange={(e) => handleSetChange(i, j, 'reps',   e.target.value)} /></td>
                            <td><input type="text"   className="input wl-set-input" value={set.notes}  onChange={(e) => handleSetChange(i, j, 'notes',  e.target.value)} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    <motion.button className="btn btn-primary wl-add-set" onClick={() => addSet(i)} whileTap={{ scale: 0.97 }}>
                      {isY2K ? '[ + Add Set ]' : '+ Add Set'}
                    </motion.button>
                  </motion.div>
                ))}

                {/* Feedback message */}
                {message && <p className="wl-message">{message}</p>}

                {/* Save / Cancel row */}
                <div className="wl-save-row">
                  {isY2K && (
                    <motion.button
                      className="btn wl-y2k-cancel-btn"
                      onClick={() => { setFormOpen(false); setEditingWorkoutId(null); }}
                      whileTap={{ scale: 0.97 }}
                    >
                      [ Cancel ]
                    </motion.button>
                  )}
                  <motion.button className="btn btn-primary" onClick={saveWorkout} whileTap={{ scale: 0.97 }}>
                    {isY2K
                      ? (editingWorkoutId ? '[ Update Workout ]' : '[ Save Workout ]')
                      : (editingWorkoutId ? 'Update Workout' : 'Save Workout')}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* ── HISTORY SECTION ── */}
      {isY2K ? (
        <div className="wl-y2k-history-heading">
          <div className="wl-y2k-history-heading__bar" />
          <span className="wl-y2k-history-heading__text">Workout History</span>
          {workoutHistory.length > 0 && (
            <span className="wl-y2k-history-heading__count">[{workoutHistory.length}] workouts logged</span>
          )}
        </div>
      ) : (
        <p className="wl-history-title" style={isSpectrum ? { color: '#1D9E75' } : undefined}>Workout history</p>
      )}

      {workoutHistory.length === 0 && (
        isY2K ? (
          <div className="wl-y2k-empty">
            <div className="wl-y2k-empty__icon">
              <Dumbbell size={32} stroke="#334466" strokeWidth={1.5} fill="none" />
            </div>
            <span className="wl-y2k-empty__primary">NO WORKOUTS LOGGED</span>
            <span className="wl-y2k-empty__secondary">Click [ + New workout ] to log your first session.</span>
            <span className="wl-y2k-empty__deco">--- [ MacroVault Workout Tracker ] ---</span>
          </div>
        ) : (
          <p className="wl-empty">No workouts logged yet.</p>
        )
      )}

      <div className={`wl-history-list ${isY2K ? 'wl-history-list--y2k' : ''}`}>
        {workoutHistory.map((workout, idx) => (
          <React.Fragment key={workout.id}>
            <motion.div
              className={`wl-history-row ${isY2K ? (idx % 2 === 0 ? 'wl-history-row--y2k-odd' : 'wl-history-row--y2k-even') : ''}`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: idx * 0.04, ease: 'easeOut' }}
              whileHover={isY2K ? undefined : { scale: 1.01 }}
              onClick={() => toggleExpand(workout.id)}
            >
              <div className="wl-history-row__left">
                {isY2K && (
                  <div className="wl-y2k-row-icon">
                    <Dumbbell size={14} stroke="var(--accent-light)" strokeWidth={1.5} fill="none" />
                  </div>
                )}
                <div className="wl-history-row__text">
                  <span className="wl-history-name" style={isSpectrum ? { color: '#5DCAA5' } : undefined}>{workout.workout_name}</span>
                  <span className="wl-history-date">{formatDate(workout.workout_date)}</span>
                </div>
              </div>
              <div className="wl-history-row__right">
                {(workout.exercises || []).length > 0 && (
                  <span className={`wl-exercise-count ${isY2K ? 'wl-exercise-count--y2k' : ''}`}>
                    {isY2K ? `[${workout.exercises.length}] exercise${workout.exercises.length !== 1 ? 's' : ''}` : `${workout.exercises.length} exercise${workout.exercises.length !== 1 ? 's' : ''}`}
                  </span>
                )}
                <motion.button
                  className={`btn btn-primary wl-btn-sm ${isY2K ? 'wl-btn-sm--y2k-edit' : ''}`}
                  onClick={(e) => { e.stopPropagation(); editWorkout(workout); }}
                  whileTap={{ scale: 0.97 }}
                  style={isSpectrum ? { border: '1px solid #1D9E75', color: '#5DCAA5' } : undefined}
                >
                  {isY2K ? '[ Edit ]' : 'Edit'}
                </motion.button>
                <motion.button
                  className={`btn btn-destructive wl-btn-sm wl-btn-icon ${isY2K ? 'wl-btn-sm--y2k-delete' : ''}`}
                  onClick={(e) => { e.stopPropagation(); deleteWorkout(workout.id); }}
                  whileTap={{ scale: 0.97 }}
                  title="Delete workout"
                >
                  <Trash2 size={14} />
                </motion.button>
              </div>
            </motion.div>
            <AnimatePresence>
              {expanded[workout.id] && (
                <motion.div
                  className="wl-exercise-detail"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.25 }}
                >
                  {workout.exercises?.map((ex, exIdx) => (
                    <div key={exIdx} className="history-exercise">
                      <h4>{ex.name}</h4>
                      <table>
                        <thead><tr><th>Set</th><th>Weight</th><th>Reps</th><th>Notes</th></tr></thead>
                        <tbody>
                          {ex.sets.map((set, j) => (
                            <tr key={j}>
                              <td>{j + 1}</td><td>{set.weight}</td><td>{set.reps}</td><td>{set.notes}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

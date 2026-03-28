import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import posthog from '../../lib/posthog';
import { supabase } from '../../supabaseClient';
import { useUpgrade } from '../../context/UpgradeContext';
import '../../styles/WorkoutLogger.css';

const API_BASE = process.env.REACT_APP_API_BASE || 'https://gainlytics-1.onrender.com';

/* Infer a muscle group tag from the workout name */
function inferMuscleGroup(name = '') {
  const n = name.toLowerCase();
  if (n.includes('push') || n.includes('chest') || n.includes('shoulder') || n.includes('tricep')) return 'Upper body';
  if (n.includes('pull') || n.includes('back') || n.includes('bicep') || n.includes('row')) return 'Upper body';
  if (n.includes('leg') || n.includes('squat') || n.includes('lower') || n.includes('glute') || n.includes('hamstring')) return 'Lower body';
  if (n.includes('full') || n.includes('total')) return 'Full body';
  if (n.includes('core') || n.includes('abs')) return 'Core';
  if (n.includes('cardio') || n.includes('run') || n.includes('bike')) return 'Cardio';
  return 'General';
}

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

  // Form state for creating/editing a workout
  const [workoutDate, setWorkoutDate] = useState(new Date().toISOString().split('T')[0]);
  const [workoutName, setWorkoutName] = useState('');
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
    setExercises(workout.exercises || []);
    setEditingWorkoutId(workout.id);
    setFormOpen(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setMessage('✏️ Editing workout...');
  };

  // Expand/collapse a workout in the history list
  const toggleExpand = (id) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="wl">

      {/* ── LOG SECTION ── */}
      <motion.div
        className="wl-log-card"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
      >
        {/* Header row: title + expand toggle */}
        <div className="wl-log-header">
          <p className="wl-section-title">Log a workout</p>
          <motion.button
            className="btn btn-primary wl-toggle-btn"
            onClick={() => setFormOpen((o) => !o)}
            whileTap={{ scale: 0.97 }}
          >
            {formOpen ? 'Cancel' : '+ New workout'}
          </motion.button>
        </div>

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
                    Add
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
                        Remove
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
                      + Add Set
                    </motion.button>
                  </motion.div>
                ))}

                {/* Feedback message */}
                {message && <p className="wl-message">{message}</p>}

                {/* Save button — right aligned */}
                <div className="wl-save-row">
                  <motion.button className="btn btn-primary" onClick={saveWorkout} whileTap={{ scale: 0.97 }}>
                    {editingWorkoutId ? 'Update Workout' : 'Save Workout'}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* ── HISTORY SECTION ── */}
      <p className="wl-history-title">Workout history</p>

      {workoutHistory.length === 0 && (
        <p className="wl-empty">No workouts logged yet.</p>
      )}

      <div className="wl-history-list">
        {workoutHistory.map((workout, idx) => (
          <motion.div
            key={workout.id}
            className="wl-history-row"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: idx * 0.04, ease: 'easeOut' }}
            whileHover={{ scale: 1.01 }}
            onClick={() => toggleExpand(workout.id)}
          >
            <div className="wl-history-row__left">
              <span className="wl-history-name">{workout.workout_name}</span>
              <span className="wl-history-date">{formatDate(workout.workout_date)}</span>
            </div>
            <div className="wl-history-row__right">
              <span className="wl-muscle-tag">{inferMuscleGroup(workout.workout_name)}</span>
              <motion.button
                className="btn btn-primary wl-btn-sm"
                onClick={(e) => { e.stopPropagation(); editWorkout(workout); }}
                whileTap={{ scale: 0.97 }}
              >
                Edit
              </motion.button>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Expandable exercise detail */}
      {workoutHistory.map((workout) =>
        expanded[workout.id] ? (
          <AnimatePresence key={workout.id}>
            <motion.div
              className="wl-exercise-detail"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25 }}
            >
              {workout.exercises?.map((ex, idx) => (
                <div key={idx} className="history-exercise">
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
          </AnimatePresence>
        ) : null
      )}
    </div>
  );
}

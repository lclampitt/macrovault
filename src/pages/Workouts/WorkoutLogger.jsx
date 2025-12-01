import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import '../../styles/WorkoutLogger.css';

export default function WorkoutLogger() {
  const [workoutDate, setWorkoutDate] = useState(new Date().toISOString().split('T')[0]);
  const [workoutName, setWorkoutName] = useState('');
  const [exercises, setExercises] = useState([]);
  const [newExercise, setNewExercise] = useState('');
  const [message, setMessage] = useState('');
  const [userId, setUserId] = useState(null);
  const [editingWorkoutId, setEditingWorkoutId] = useState(null); // 🧠 NEW state

  const [workoutHistory, setWorkoutHistory] = useState([]);
  const [expanded, setExpanded] = useState({});

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    async function fetchUser() {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data?.user) {
        setMessage('⚠️ Please log in to save or view workouts.');
        return;
      }
      setUserId(data.user.id);
    }
    fetchUser();
  }, []);

  useEffect(() => {
    if (!userId) return;
    fetchWorkouts();
  }, [userId]);

  const fetchWorkouts = async () => {
    const { data, error } = await supabase
      .from('workouts')
      .select('*')
      .eq('user_id', userId)
      .order('workout_date', { ascending: false });

    if (error) console.error('Fetch error:', error);
    else setWorkoutHistory(data);
  };

  const addExercise = () => {
    if (!newExercise.trim()) return;
    setExercises([
      ...exercises,
      { name: newExercise.trim(), sets: [{ weight: '', reps: '', rpe: '', notes: '' }] },
    ]);
    setNewExercise('');
  };

  const addSet = (i) => {
    const updated = [...exercises];
    updated[i].sets.push({ weight: '', reps: '', rpe: '', notes: '' });
    setExercises(updated);
  };

  const handleSetChange = (exerciseIndex, setIndex, field, value) => {
    const updated = [...exercises];
    updated[exerciseIndex].sets[setIndex][field] = value;
    setExercises(updated);
  };

  const deleteExercise = (i) => {
    const updated = exercises.filter((_, idx) => idx !== i);
    setExercises(updated);
  };

  // ✅ Save or Update workout
  const saveWorkout = async () => {
    if (!workoutName.trim() || exercises.length === 0) {
      setMessage('⚠️ Please enter a workout name and add at least one exercise.');
      return;
    }
    if (!userId) {
      setMessage('⚠️ Please log in first.');
      return;
    }

    const workoutData = {
      user_id: userId,
      workout_date: workoutDate,
      workout_name: workoutName.trim(),
      exercises,
    };

    let error;

    if (editingWorkoutId) {
      // ✏️ Update existing workout
      ({ error } = await supabase
        .from('workouts')
        .update(workoutData)
        .eq('id', editingWorkoutId));
      if (!error) {
        setMessage('✅ Workout updated successfully!');
        setEditingWorkoutId(null);
      }
    } else {
      // 💾 Insert new workout
      ({ error } = await supabase.from('workouts').insert([workoutData]));
      if (!error) setMessage('✅ Workout saved successfully!');
    }

    if (error) {
      console.error('Save error:', error);
      setMessage(`❌ Error saving workout: ${error.message}`);
    } else {
      setWorkoutName('');
      setExercises([]);
      fetchWorkouts();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // 🧠 Load existing workout into editor
  const editWorkout = (workout) => {
    setWorkoutDate(workout.workout_date);
    setWorkoutName(workout.workout_name);
    setExercises(workout.exercises || []);
    setEditingWorkoutId(workout.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setMessage('✏️ Editing workout...');
  };

  const toggleExpand = (id) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="workout-logger">
      <h1 className="workout-title">Workout Logger</h1>
      <p className="workout-subtext">
        Track sets, reps, weight, and RPE for your training sessions.
      </p>

      <div className="workout-header">
        <div>
          <label>Date:</label>
          <input
            type="date"
            value={workoutDate}
            onChange={(e) => setWorkoutDate(e.target.value)}
          />
        </div>
        <div>
          <label>Workout Name:</label>
          <input
            type="text"
            value={workoutName}
            onChange={(e) => setWorkoutName(e.target.value)}
            placeholder="e.g. Push Day, Lower Body, Full Body"
          />
        </div>
      </div>

      <div className="exercise-adder">
        <input
          type="text"
          value={newExercise}
          onChange={(e) => setNewExercise(e.target.value)}
          placeholder="Add an exercise..."
        />
        <button onClick={addExercise}>Add</button>
      </div>

      {exercises.map((ex, i) => (
        <div key={i} className="exercise-block">
          <div className="exercise-header">
            <h3>{ex.name}</h3>
            <button className="trash-btn" onClick={() => deleteExercise(i)}>Trash</button>

          </div>

          <table className="sets-table">
            <thead>
              <tr>
                <th>Set</th>
                <th>Weight (lbs)</th>
                <th>Reps</th>
                <th>RPE</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {ex.sets.map((set, j) => (
                <tr key={j}>
                  <td>{j + 1}</td>
                  <td>
                    <input
                      type="number"
                      value={set.weight}
                      onChange={(e) => handleSetChange(i, j, 'weight', e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      value={set.reps}
                      onChange={(e) => handleSetChange(i, j, 'reps', e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      value={set.rpe}
                      onChange={(e) => handleSetChange(i, j, 'rpe', e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      value={set.notes}
                      onChange={(e) => handleSetChange(i, j, 'notes', e.target.value)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <button className="add-set-btn" onClick={() => addSet(i)}>+ Add Set</button>
        </div>
      ))}

      {message && <p className="workout-message">{message}</p>}

      <button className="save-btn" onClick={saveWorkout}>
        {editingWorkoutId ? 'Update Workout' : 'Save Workout'}
      </button>

      <h2 className="history-title">Workout History</h2>
      {workoutHistory.length === 0 && (
        <p style={{ color: '#999', textAlign: 'center' }}>No workouts logged yet.</p>
      )}

      {workoutHistory.map((workout) => (
        <div key={workout.id} className="history-card">
          <div className="history-header" onClick={() => toggleExpand(workout.id)}>
            <span>
              📅 {workout.workout_date} — <strong>{workout.workout_name}</strong>
            </span>
            <div>
              <button
                className="edit-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  editWorkout(workout);
                }}
              >
                Edit
              </button>
              <span>{expanded[workout.id] ? '▲' : '▼'}</span>
            </div>
          </div>

          {expanded[workout.id] && (
            <div className="history-body">
              {workout.exercises?.map((ex, idx) => (
                <div key={idx} className="history-exercise">
                  <h4>{ex.name}</h4>
                  <table>
                    <thead>
                      <tr>
                        <th>Set</th><th>Weight</th><th>Reps</th><th>RPE</th><th>Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ex.sets.map((set, j) => (
                        <tr key={j}>
                          <td>{j + 1}</td>
                          <td>{set.weight}</td>
                          <td>{set.reps}</td>
                          <td>{set.rpe}</td>
                          <td>{set.notes}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

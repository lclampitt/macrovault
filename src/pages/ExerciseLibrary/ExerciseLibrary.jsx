import React, { useState } from 'react';
import '../../styles/ExerciseLibrary.css';
import { Link } from 'react-router-dom';

// Temporary dataset (replace later with Supabase)
const EXERCISES = [
  { id: 1, name: 'Barbell Bench Press', muscle: 'Chest', equipment: 'Barbell', difficulty: 'Intermediate' },
  { id: 2, name: 'Squat', muscle: 'Legs', equipment: 'Barbell', difficulty: 'Intermediate' },
  { id: 3, name: 'Deadlift', muscle: 'Back', equipment: 'Barbell', difficulty: 'Advanced' },
  { id: 4, name: 'Bicep Curl', muscle: 'Arms', equipment: 'Dumbbell', difficulty: 'Beginner' },
  { id: 5, name: 'Tricep Pushdown', muscle: 'Arms', equipment: 'Cable', difficulty: 'Beginner' },
  { id: 6, name: 'Shoulder Press', muscle: 'Shoulders', equipment: 'Dumbbell', difficulty: 'Intermediate' },
  { id: 7, name: 'Lat Pulldown', muscle: 'Back', equipment: 'Machine', difficulty: 'Beginner' },
  { id: 8, name: 'Leg Press', muscle: 'Legs', equipment: 'Machine', difficulty: 'Beginner' },
  { id: 9, name: 'Plank', muscle: 'Core', equipment: 'Bodyweight', difficulty: 'Beginner' },
  { id: 10, name: 'Pull-Up', muscle: 'Back', equipment: 'Bodyweight', difficulty: 'Intermediate' },
];

export default function ExerciseLibrary() {
  const [search, setSearch] = useState('');
  const [muscle, setMuscle] = useState('');
  const [equipment, setEquipment] = useState('');
  const [difficulty, setDifficulty] = useState('');

  const filtered = EXERCISES.filter((ex) =>
    ex.name.toLowerCase().includes(search.toLowerCase()) &&
    (muscle ? ex.muscle === muscle : true) &&
    (equipment ? ex.equipment === equipment : true) &&
    (difficulty ? ex.difficulty === difficulty : true)
  );

  return (
    <div className="exercise-library">
      <h1 className="library-title">Exercise Library</h1>

      <div className="filter-bar">
        <input
          type="text"
          placeholder="Search exercises..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <select value={muscle} onChange={(e) => setMuscle(e.target.value)}>
          <option value="">Muscle Group</option>
          <option>Chest</option>
          <option>Back</option>
          <option>Legs</option>
          <option>Arms</option>
          <option>Shoulders</option>
          <option>Core</option>
        </select>

        <select value={equipment} onChange={(e) => setEquipment(e.target.value)}>
          <option value="">Equipment</option>
          <option>Barbell</option>
          <option>Dumbbell</option>
          <option>Machine</option>
          <option>Cable</option>
          <option>Bodyweight</option>
        </select>

        <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
          <option value="">Difficulty</option>
          <option>Beginner</option>
          <option>Intermediate</option>
          <option>Advanced</option>
        </select>
      </div>

      <div className="exercise-grid">
        {filtered.length > 0 ? (
          filtered.map((ex) => (
            <div key={ex.id} className="exercise-card">
              {/* Image removed */}
              <h3>{ex.name}</h3>
              <p><strong>Muscle:</strong> {ex.muscle}</p>
              <p><strong>Equipment:</strong> {ex.equipment}</p>
              <p><strong>Difficulty:</strong> {ex.difficulty}</p>
              <Link to={`/exercises/${ex.id}`} className="exercise-btn">
                View Details
              </Link>
            </div>
          ))
        ) : (
          <p className="no-results">No exercises found</p>
        )}
      </div>
    </div>
  );
}

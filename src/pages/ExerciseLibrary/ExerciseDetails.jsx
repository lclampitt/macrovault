import React from 'react';
import { useParams, Link } from 'react-router-dom';
import '../../styles/ExerciseLibrary.css';

export default function ExerciseDetails() {
  const { id } = useParams();

  // Eventually pull from Supabase or reuse EXERCISES array
  const exercise = {
    name: 'Barbell Bench Press',
    description: 'A classic chest exercise that targets the pectorals, shoulders, and triceps.',
    instructions: [
      'Lie flat on a bench and grip the bar slightly wider than shoulder width.',
      'Lower the bar slowly to your chest.',
      'Press the bar upward until arms are fully extended.'
    ],
    image: '/images/benchpress.jpg'
  };

  return (
    <div className="exercise-detail">
      <Link to="/exercises" className="back-btn">← Back</Link>
      <h2>{exercise.name}</h2>
      <img src={exercise.image} alt={exercise.name} />
      <p>{exercise.description}</p>

      <h3>Form Cues</h3>
      <ul>
        {exercise.instructions.map((step, i) => (
          <li key={i}>{step}</li>
        ))}
      </ul>
    </div>
  );
}

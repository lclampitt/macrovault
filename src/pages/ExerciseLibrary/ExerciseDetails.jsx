import React from 'react';
import { useParams, Link } from 'react-router-dom';
import '../../styles/ExerciseLibrary.css';

const EXERCISE_DETAILS = {
  1: {
    name: 'Barbell Bench Press',
    description:
      'A compound chest exercise that primarily targets the pectorals while also working the shoulders and triceps.',
    cues: [
      'Lie flat on a bench with your feet planted firmly on the floor.',
      'Grip the bar slightly wider than shoulder width.',
      'Unrack the bar and lower it under control to the mid-chest.',
      'Press the bar back up, keeping your elbows slightly tucked.',
    ],
  },
  2: {
    name: 'Squat',
    description:
      'A foundational lower-body movement that targets the quads, glutes, and hamstrings while engaging your core.',
    cues: [
      'Stand with feet about shoulder width apart and the bar resting across your upper back.',
      'Brace your core and keep your chest up.',
      'Sit your hips back and down until thighs are at least parallel to the floor.',
      'Drive through your mid-foot and stand back up to the starting position.',
    ],
  },
  3: {
    name: 'Deadlift',
    description:
      'A powerful posterior-chain exercise targeting the glutes, hamstrings, and lower back while training full-body strength.',
    cues: [
      'Stand with feet hip-width apart with the bar over the middle of your feet.',
      'Hinge at the hips and grip the bar just outside your legs.',
      'Brace your core, keep your back flat, and pull the bar up by driving through your legs.',
      'Lock out by standing tall with your shoulders back and hips fully extended.',
    ],
  },
  4: {
    name: 'Bicep Curl',
    description:
      'An isolation movement that targets the biceps to build arm size and strength.',
    cues: [
      'Stand tall holding dumbbells at your sides with palms facing forward.',
      'Keep your elbows pinned close to your torso.',
      'Curl the weights up toward your shoulders without swinging your body.',
      'Lower the dumbbells under control back to the starting position.',
    ],
  },
  5: {
    name: 'Tricep Pushdown',
    description:
      'A cable exercise that isolates the triceps, helping to build pressing strength and arm definition.',
    cues: [
      'Stand facing the cable machine with a straight bar or rope attachment.',
      'Grip the handle and tuck your elbows close to your sides.',
      'Push the handle down by extending your elbows until your arms are straight.',
      'Control the handle back up without letting your elbows drift forward.',
    ],
  },
  6: {
    name: 'Shoulder Press',
    description:
      'An overhead pressing movement that targets the shoulders and triceps, improving upper-body strength.',
    cues: [
      'Sit or stand with dumbbells at shoulder height, palms facing forward.',
      'Brace your core and keep your ribcage down.',
      'Press the dumbbells overhead until your arms are fully extended.',
      'Lower the weights back to shoulder level with control.',
    ],
  },
  7: {
    name: 'Lat Pulldown',
    description:
      'A vertical pulling exercise that targets the latissimus dorsi and upper back muscles.',
    cues: [
      'Sit at the pulldown machine with your thighs secured under the pad.',
      'Grip the bar slightly wider than shoulder width.',
      'Pull the bar down toward your upper chest, keeping your chest up and shoulders back.',
      'Control the bar back up until your arms are fully extended.',
    ],
  },
  8: {
    name: 'Leg Press',
    description:
      'A machine-based compound movement that targets the quads, glutes, and hamstrings.',
    cues: [
      'Sit in the leg press machine with your back flat against the pad.',
      'Place your feet about shoulder width apart on the platform.',
      'Unlock the sled and lower it by bending your knees until they reach roughly 90 degrees.',
      'Press the platform away by driving through your heels without locking your knees.',
    ],
  },
  9: {
    name: 'Plank',
    description:
      'A core stability exercise that strengthens the abs, lower back, and shoulders.',
    cues: [
      'Start on your forearms and toes with your body in a straight line.',
      'Keep your elbows under your shoulders and your gaze toward the floor.',
      'Brace your core and squeeze your glutes.',
      'Hold this position without letting your hips sag or rise.',
    ],
  },
  10: {
    name: 'Pull-Up',
    description:
      'A bodyweight pulling movement that targets the lats, upper back, and biceps.',
    cues: [
      'Grip the pull-up bar with palms facing away, slightly wider than shoulder width.',
      'Start from a dead hang with arms fully extended.',
      'Pull your chest toward the bar by driving your elbows down.',
      'Lower yourself back to a full hang under control.',
    ],
  },
};

export default function ExerciseDetails() {
  const { id } = useParams();
  const numericId = Number(id);
  const exercise = EXERCISE_DETAILS[numericId];

  if (!exercise) {
    return (
      <div className="exercise-detail">
        <div className="exercise-detail-inner">
          <Link to="/exercises" className="back-btn">← Back</Link>
          <div className="exercise-detail-card">
            <h2>Exercise not found</h2>
            <p>We couldn’t find that exercise. Please go back to the library.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="exercise-detail">
      <div className="exercise-detail-inner">
        <Link to="/exercises" className="back-btn">← Back</Link>

        <div className="exercise-detail-card">
          <h2>{exercise.name}</h2>
          <p className="exercise-detail-description">{exercise.description}</p>

          <h3>Form Cues</h3>
          <ul>
            {exercise.cues.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

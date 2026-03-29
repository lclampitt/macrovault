import React, { useState } from 'react';
import '../styles/ProteinCalculator.css';
import Dropdown from '../components/ui/Dropdown';

function ProteinCalculator() {
  // Core input state
  const [weight, setWeight] = useState('');
  const [ageRange, setAgeRange] = useState('18-39');
  const [bodyFat, setBodyFat] = useState('');
  const [workoutHours, setWorkoutHours] = useState('0-1');
  const [isPlantBased, setIsPlantBased] = useState('No');
  const [gender, setGender] = useState('Male');

  // Calculated grams per day (min / max / optimal) + adjustment notes
  const [results, setResults] = useState(null);

  // Main protein estimation logic
  const calculateProtein = () => {
    const lbWeight = parseFloat(weight);
    if (isNaN(lbWeight)) return;

    // If user provides body fat, estimate lean mass; otherwise assume 0% bf (conservative)
    const bf = parseFloat(bodyFat) || 0;
    const leanMass = lbWeight * (1 - bf / 100);

    // Base range: 0.6–1.0 g per lb of lean body mass
    let min = leanMass * 0.6;
    let max = leanMass * 1.0;
    let optimal = leanMass * 0.88;

    // Training multiplier — applied to all three values
    let trainingMult = 1.0;
    if (workoutHours === '4-6') trainingMult = 1.1;
    if (workoutHours === '7+')  trainingMult = 1.2;

    // Plant-based diets benefit from slightly higher protein for amino acid quality
    const plantMult = isPlantBased === 'Yes' ? 1.1 : 1.0;
    const combinedTrainingMult = trainingMult * plantMult;

    min     *= combinedTrainingMult;
    optimal *= combinedTrainingMult;
    max     *= combinedTrainingMult;

    // Age multiplier — accounts for anabolic resistance and sarcopenia risk
    // Applied after training multipliers
    const ageMults = { '18-39': 1.0, '40-49': 1.08, '50-59': 1.15, '60+': 1.20 };
    const ageMult = ageMults[ageRange] ?? 1.0;

    min     *= ageMult;
    optimal *= ageMult;
    max     *= ageMult;

    // Build adjustment notes for display
    const notes = [];
    if (ageMult > 1.0) {
      notes.push(`Age adjustment applied (+${Math.round((ageMult - 1) * 100)}%)`);
    }
    if (trainingMult > 1.0) {
      notes.push(`Training adjustment applied (+${Math.round((trainingMult - 1) * 100)}%)`);
    }
    if (gender === 'Female') {
      notes.push(
        'Women may benefit from slightly higher protein intake during menstrual phases or pregnancy. These values are for general fitness.'
      );
    }

    setResults({
      min:     Math.round(min * 10) / 10,
      max:     Math.round(max * 10) / 10,
      optimal: Math.round(optimal * 10) / 10,
      notes,
    });
  };

  return (
    <div className="calculator-container">
      <h2>Protein Calculator</h2>

      {/* Simple demographic inputs – hooks for future refinements */}
      <Dropdown
        label="Gender*"
        value={gender}
        onChange={setGender}
        options={[
          { label: 'Male',   value: 'Male' },
          { label: 'Female', value: 'Female' },
        ]}
      />

      <label>Weight (lbs)*</label>
      <input type="number" value={weight} onChange={e => setWeight(e.target.value)} />

      <Dropdown
        label="Age Range*"
        value={ageRange}
        onChange={setAgeRange}
        options={[
          { label: '18–39', value: '18-39' },
          { label: '40–49', value: '40-49' },
          { label: '50–59', value: '50-59' },
          { label: '60+',   value: '60+' },
        ]}
      />

      {/* Optional body fat input helps narrow in on lean mass */}
      <label>Body Fat % (Optional)</label>
      <input type="number" value={bodyFat} onChange={e => setBodyFat(e.target.value)} />

      <Dropdown
        label="Workout Hours Per Week*"
        value={workoutHours}
        onChange={setWorkoutHours}
        options={[
          { label: '0–1 hrs/week', value: '0-1' },
          { label: '1–3 hrs/week', value: '1-3' },
          { label: '4–6 hrs/week', value: '4-6' },
          { label: '7+ hrs/week',  value: '7+' },
        ]}
      />

      <Dropdown
        label="Mostly Plant-Based Diet?*"
        value={isPlantBased}
        onChange={setIsPlantBased}
        options={[
          { label: 'No',  value: 'No' },
          { label: 'Yes', value: 'Yes' },
        ]}
      />

      {/* Triggers the calculation and updates results state */}
      <button onClick={calculateProtein}>Calculate</button>

      {/* Results card: presents daily protein targets in g/day */}
      {results && (
        <div className="results">
          <p><strong>Minimum:</strong> {results.min} g/day</p>
          <p><strong>Maximum:</strong> {results.max} g/day</p>
          <p><strong>Optimal:</strong> {results.optimal} g/day</p>
          {results.notes.length > 0 && (
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 3 }}>
              {results.notes.map((note, i) => (
                <p key={i} style={{ fontSize: 11, color: '#888', margin: 0 }}>{note}</p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ABOUT SECTION – explains how to interpret the protein targets */}
      <div className="tdee-info-section">
        <h2>About This Calculator</h2>
        <p>
          This calculator estimates your daily <strong>protein intake</strong> based on lean body mass,
          training frequency, and dietary preferences.
        </p>
        <p>Use it to fine-tune your nutrition for performance and recovery:</p>
        <ul>
          <li>Support <strong>muscle growth</strong> with optimal protein</li>
          <li>Maintain lean mass while <strong>cutting calories</strong></li>
          <li>Adjust for <strong>plant-based diets</strong> if needed</li>
        </ul>
      </div>
    </div>
  );
}

export default ProteinCalculator;

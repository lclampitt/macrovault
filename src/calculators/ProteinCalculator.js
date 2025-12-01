import React, { useState } from 'react';
import '../styles/ProteinCalculator.css';

function ProteinCalculator() {
  const [weight, setWeight] = useState('');
  const [ageRange, setAgeRange] = useState('<34');
  const [bodyFat, setBodyFat] = useState('');
  const [workoutHours, setWorkoutHours] = useState('0-1');
  const [isPlantBased, setIsPlantBased] = useState('No');
  const [gender, setGender] = useState('Male');
  const [results, setResults] = useState(null);

  const calculateProtein = () => {
    const lbWeight = parseFloat(weight);
    if (isNaN(lbWeight)) return;

    const bf = parseFloat(bodyFat) || 0;
    const leanMass = lbWeight * (1 - bf / 100);
    let min = leanMass * 0.6;
    let max = leanMass * 1.0;
    let optimal = leanMass * 0.88;

    if (workoutHours === '4-6') optimal *= 1.1;
    if (workoutHours === '7+') optimal *= 1.2;
    if (isPlantBased === 'Yes') optimal *= 1.1;

    setResults({
      min: Math.round(min),
      max: Math.round(max),
      optimal: Math.round(optimal),
    });
  };

  return (
    <div className="calculator-container">
      <h2>Protein Calculator</h2>

      <label>Gender*</label>
      <select value={gender} onChange={e => setGender(e.target.value)}>
        <option>Male</option>
        <option>Female</option>
      </select>

      <label>Weight (lbs)*</label>
      <input type="number" value={weight} onChange={e => setWeight(e.target.value)} />

      <label>Age Range*</label>
      <select value={ageRange} onChange={e => setAgeRange(e.target.value)}>
        <option value="<34">&lt;34</option>
        <option value="35-60">35–60</option>
        <option value="61+">61+</option>
      </select>

      <label>Body Fat % (Optional)</label>
      <input type="number" value={bodyFat} onChange={e => setBodyFat(e.target.value)} />

      <label>Workout Hours Per Week*</label>
      <select value={workoutHours} onChange={e => setWorkoutHours(e.target.value)}>
        <option>0-1</option>
        <option>1-3</option>
        <option>4-6</option>
        <option>7+</option>
      </select>

      <label>Mostly Plant-Based Diet?*</label>
      <select value={isPlantBased} onChange={e => setIsPlantBased(e.target.value)}>
        <option>No</option>
        <option>Yes</option>
      </select>

      <button onClick={calculateProtein}>Calculate</button>

      {results && (
        <div className="results">
          <p><strong>Minimum:</strong> {results.min} g/day</p>
          <p><strong>Maximum:</strong> {results.max} g/day</p>
          <p><strong>Optimal:</strong> {results.optimal} g/day</p>
        </div>
      )}

      {/* ABOUT SECTION */}
      <div className="tdee-info-section">
        <h2>💡 About This Calculator</h2>
        <p>
          This calculator estimates your daily <strong>protein intake</strong> based on lean body mass,
          training frequency, and dietary preferences.
        </p>
        <p>Use it to fine-tune your nutrition for performance and recovery:</p>
        <ul>
          <li>💪 Support <strong>muscle growth</strong> with optimal protein</li>
          <li>⚖️ Maintain lean mass while <strong>cutting calories</strong></li>
          <li>🌿 Adjust for <strong>plant-based diets</strong> if needed</li>
        </ul>
      </div>
    </div>
  );
}

export default ProteinCalculator;

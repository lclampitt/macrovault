import React, { useState } from 'react';
import '../styles/OneRepMaxCalculator.css';

function OneRepMaxCalculator() {
  // Unit toggle: lets the user view results in lbs or kg
  const [unit, setUnit] = useState('lbs');
  // Raw input from the user (weight they lifted and how many reps)
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');

  // Percentages of 1RM for reps 1–16 (classic strength training table)
  const repMaxPercentages = [
    1.00, 0.95, 0.93, 0.90, 0.87, 0.85, 0.83, 0.80,
    0.77, 0.75, 0.73, 0.70, 0.65, 0.60, 0.55, 0.50
  ];

  // Core formula: Epley-style 1RM estimate based on weight & reps
  const calculateOneRepMax = () => {
    const w = parseFloat(weight);
    const r = parseInt(reps);
    if (!w || !r || r <= 0) return '';
    return Math.round(w / (1.0278 - 0.0278 * r));
  };

  const oneRepMax = calculateOneRepMax();

  return (
    <div className="calculator-container">
      <h2>One-Rep Max Calculator</h2>
      <p>Estimate your 1-rep max and training weights for strength programming.</p>

      {/* Unit toggle buttons (visual only, we assume input is entered in the chosen unit) */}
      <div className="unit-toggle">
        <button onClick={() => setUnit('lbs')} className={unit === 'lbs' ? 'active' : ''}>Pounds</button>
        <button onClick={() => setUnit('kg')} className={unit === 'kg' ? 'active' : ''}>Kilograms</button>
      </div>

      {/* Core inputs: weight and reps from the user's last set */}
      <div className="input-group">
        <label>Weight Lifted*</label>
        <input
          type="number"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          placeholder={`Enter weight in ${unit}`}
        />
      </div>

      <div className="input-group">
        <label>Reps</label>
        <input
          type="number"
          value={reps}
          onChange={(e) => setReps(e.target.value)}
          placeholder="e.g. 5"
        />
      </div>

      {/* Only show results when we have enough data to calculate 1RM */}
      {oneRepMax && (
        <>
          {/* Highlighted 1RM estimate */}
          <div className="result">
            <h3>1-Rep Max:</h3>
            <p>{oneRepMax} {unit}</p>
          </div>

          {/* Full 1RM table: shows estimated weights at different rep ranges */}
          <h3>1-RM Table</h3>
          <table className="result-table">
            <thead>
              <tr>
                <th>Weight</th>
                <th>Reps</th>
                <th>% of 1RM</th>
              </tr>
            </thead>
            <tbody>
              {repMaxPercentages.map((percent, idx) => {
                const repWeight = Math.round(oneRepMax * percent);
                return (
                  <tr key={idx}>
                    <td>{repWeight} {unit}</td>
                    <td>{idx + 1 <= 12 ? idx + 1 : '-'}</td>
                    <td>{Math.round(percent * 100)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}

      {/* ABOUT SECTION – explains purpose and how to use this calculator in programs */}
      <div className="tdee-info-section">
        <h2>About This Calculator</h2>
        <p>
          This tool estimates your <strong>One-Rep Max (1RM)</strong> — the maximum weight you can lift
          for one repetition for a given exercise.
        </p>
        <p>Use it to guide strength training and progressive overload:</p>
        <ul>
          <li>Determine <strong>training weights</strong> for 70–90% of your 1RM</li>
          <li>Track <strong>strength progress</strong> over time</li>
          <li>Compare lifts and plan <strong>periodized programs</strong></li>
        </ul>
      </div>
    </div>
  );
}

export default OneRepMaxCalculator;

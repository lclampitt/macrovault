import React, { useState } from 'react';
import '../styles/OneRepMaxCalculator.css';

function OneRepMaxCalculator() {
  const [unit, setUnit] = useState('lbs');
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');

  const repMaxPercentages = [
    1.00, 0.95, 0.93, 0.90, 0.87, 0.85, 0.83, 0.80,
    0.77, 0.75, 0.73, 0.70, 0.65, 0.60, 0.55, 0.50
  ];

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

      <div className="unit-toggle">
        <button onClick={() => setUnit('lbs')} className={unit === 'lbs' ? 'active' : ''}>Pounds</button>
        <button onClick={() => setUnit('kg')} className={unit === 'kg' ? 'active' : ''}>Kilograms</button>
      </div>

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

      {oneRepMax && (
        <>
          <div className="result">
            <h3>1-Rep Max:</h3>
            <p>{oneRepMax} {unit}</p>
          </div>

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

      {/* ABOUT SECTION */}
      <div className="tdee-info-section">
        <h2>💡 About This Calculator</h2>
        <p>
          This tool estimates your <strong>One-Rep Max (1RM)</strong> — the maximum weight you can lift
          for one repetition for a given exercise.
        </p>
        <p>Use it to guide strength training and progressive overload:</p>
        <ul>
          <li>🏋️‍♂️ Determine <strong>training weights</strong> for 70–90% of your 1RM</li>
          <li>📈 Track <strong>strength progress</strong> over time</li>
          <li>🔁 Compare lifts and plan <strong>periodized programs</strong></li>
        </ul>
      </div>
    </div>
  );
}

export default OneRepMaxCalculator;

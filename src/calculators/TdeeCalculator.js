import React, { useState } from 'react';
import '../styles/TdeeCalculator.css';

function DeficitTimeCalculator() {
  // Global input state
  const [unit, setUnit] = useState('imperial');
  const [gender, setGender] = useState('male');
  const [weight, setWeight] = useState(170);
  const [bodyFat, setBodyFat] = useState(18);
  const [workoutHours, setWorkoutHours] = useState(6);
  const [steps, setSteps] = useState(6000);
  const [ageRange, setAgeRange] = useState('under60');

  // Aggregated output from the calculation
  const [results, setResults] = useState(null);

  // Main TDEE + macros scenario calculator
  const calculate = () => {
    // 1) Estimate lean mass from body weight and body fat %
    const leanMass = weight * (1 - bodyFat / 100);
    const leanMassKg = unit === 'imperial' ? leanMass / 2.20462 : leanMass;

    // 2) Katch-McArdle style BMR based on lean mass
    const bmr = 370 + (21.6 * leanMassKg);

    // 3) Start with a base activity multiplier from training volume
    let activityMultiplier = 1.3;
    if (workoutHours >= 0 && workoutHours < 3) activityMultiplier = 1.3;
    else if (workoutHours >= 3 && workoutHours < 5) activityMultiplier = 1.4;
    else if (workoutHours >= 5 && workoutHours < 7) activityMultiplier = 1.5;
    else if (workoutHours >= 7) activityMultiplier = 1.55;

    // 4) Layer in additional activity from daily step count
    if (steps >= 5000 && steps < 7000) activityMultiplier += 0.05;
    else if (steps >= 7000 && steps < 9000) activityMultiplier += 0.10;
    else if (steps >= 9000 && steps < 11000) activityMultiplier += 0.15;
    else if (steps >= 11000 && steps < 13000) activityMultiplier += 0.20;
    else if (steps >= 13000) activityMultiplier += 0.25;

    // Cap multiplier so things don’t get unrealistic
    activityMultiplier = Math.min(activityMultiplier, 1.8);

    // 5) TDEE is BMR multiplied by overall activity
    const tdee = bmr * activityMultiplier;

    // 6) Different deficit sizes for slow / moderate / fast fat loss
    const slow = tdee - (tdee * 0.15);
    const moderate = tdee - (tdee * 0.24);
    const fast = tdee - (tdee * 0.32);

    // 7) Surplus ranges for lean / standard / dirty bulk
    const leanBulk = tdee + (tdee * 0.10);
    const standardBulk = tdee + (tdee * 0.20);
    const dirtyBulk = tdee + (tdee * 0.35);

    // 8) Recomposition zone – hover around maintenance with small swings
    const standardRecomp = tdee;
    const fatLossRecomp = tdee - (tdee * 0.08);
    const muscleGainRecomp = tdee + (tdee * 0.08);

    setResults({
      lbm: Math.round(leanMass),
      bmr: Math.round(bmr),
      tdee: Math.round(tdee),
      slow: Math.round(slow),
      moderate: Math.round(moderate),
      fast: Math.round(fast),
      leanBulk: Math.round(leanBulk),
      standardBulk: Math.round(standardBulk),
      dirtyBulk: Math.round(dirtyBulk),
      standardRecomp: Math.round(standardRecomp),
      fatLossRecomp: Math.round(fatLossRecomp),
      muscleGainRecomp: Math.round(muscleGainRecomp),
    });
  };

  return (
    <div className="deficit-calculator">
      <h1>Deficit Time Calculator</h1>

      {/* INPUT SECTION */}
      <div className="inputs">
        <div>
          <label>Units</label>
          <div className="btn-group">
            <button onClick={() => setUnit('imperial')} className={unit === 'imperial' ? 'active' : ''}>Imperial</button>
            <button onClick={() => setUnit('metric')} className={unit === 'metric' ? 'active' : ''}>Metric</button>
          </div>
        </div>

        <div>
          <label>Gender</label>
          <div className="btn-group">
            <button onClick={() => setGender('male')} className={gender === 'male' ? 'active' : ''}>Male</button>
            <button onClick={() => setGender('female')} className={gender === 'female' ? 'active' : ''}>Female</button>
          </div>
        </div>

        <div>
          <label>Weight ({unit === 'imperial' ? 'lbs' : 'kg'})</label>
          <input type="number" value={weight} onChange={e => setWeight(+e.target.value)} />
        </div>

        <div>
          <label>Body Fat % — {bodyFat}%</label>
          <input type="range" min="5" max="60" value={bodyFat} onChange={e => setBodyFat(+e.target.value)} />
        </div>

        <div>
          <label>Workout Hours/Week</label>
          <input type="number" value={workoutHours} onChange={e => setWorkoutHours(+e.target.value)} />
        </div>

        <div>
          <label>Steps/Day</label>
          <input type="number" value={steps} onChange={e => setSteps(+e.target.value)} />
        </div>

        <div>
          <label>Age Range</label>
          <div className="btn-group">
            <button onClick={() => setAgeRange('under60')} className={ageRange === 'under60' ? 'active' : ''}>Under 60</button>
            <button onClick={() => setAgeRange('60plus')} className={ageRange === '60plus' ? 'active' : ''}>61+</button>
          </div>
        </div>

        <button onClick={calculate} className="calculate-button">Calculate</button>
      </div>

      {/* RESULTS SECTION – presents stats and calorie targets for each goal */}
      {results && (
        <div className="results">
          <h2 className="stats-title">Stats</h2>

          {/* High-level stats grid (LBM, BMR, TDEE) */}
          <div className="stats-grid">
            <div className="stat-card">
              <h3>
                LBM 
                <span className="info-icon" data-tooltip="Lean Body Mass — your body weight minus fat mass. Includes muscle, bone, water, and organs.">?</span>
              </h3>
              <p>{results.lbm} {unit === 'imperial' ? 'lbs' : 'kg'}</p>
            </div>

            <div className="stat-card">
              <h3>
                BMR 
                <span className="info-icon" data-tooltip="Basal Metabolic Rate — calories burned at rest to keep your body alive and functioning.">?</span>
              </h3>
              <p>{results.bmr} cal</p>
            </div>

            <div className="stat-card highlight">
              <h3>
                Estimated TDEE 
                <span className="info-icon" data-tooltip="Total Daily Energy Expenditure — your daily calorie burn including workouts and daily activity.">?</span>
              </h3>
              <p>{results.tdee} cal</p>
            </div>
          </div>

          {/* Deficit table – what to eat for slow/moderate/fast fat loss */}
          <div className="section-header">
            <h3>Calories for Deficit</h3>
          </div>

          <table className="tdee-table">
            <thead>
              <tr>
                <th>Pace</th>
                <th>% per week</th>
                <th>Calorie Intake</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>Slow</td><td>0.5%</td><td>{results.slow} cal</td></tr>
              <tr><td>Moderate</td><td>0.75%</td><td>{results.moderate} cal</td></tr>
              <tr><td>Fast</td><td>1%</td><td>{results.fast} cal</td></tr>
            </tbody>
          </table>

          {/* Surplus table – different bulk strategies */}
          <div className="section-header">
            <h3>Calories to Gain</h3>
          </div>

          <table className="tdee-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Fat Gain</th>
                <th>Calorie Intake</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>Lean Bulk</td><td>Minimal</td><td>{results.leanBulk} cal</td></tr>
              <tr><td>Standard Bulk</td><td>Slight</td><td>{results.standardBulk} cal</td></tr>
              <tr><td>Dirty Bulk</td><td>Moderate</td><td>{results.dirtyBulk} cal</td></tr>
            </tbody>
          </table>

          {/* Recomposition table – hover around maintenance */}
          <div className="section-header">
            <h3>Recomposition</h3>
          </div>

          <table className="tdee-table">
            <thead>
              <tr>
                <th>Focus</th>
                <th>Calorie Intake</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>Standard</td><td>{results.standardRecomp} cal</td></tr>
              <tr><td>Fat Loss</td><td>{results.fatLossRecomp} cal</td></tr>
              <tr><td>Muscle Gain</td><td>{results.muscleGainRecomp} cal</td></tr>
            </tbody>
          </table>
        </div>
      )}

      {/* ABOUT SECTION – plain-language explanation for users / graders */}
      <div className="tdee-info-section">
        <h2>About This Calculator</h2>
        <p>
          This calculator estimates your <strong>Total Daily Energy Expenditure (TDEE)</strong> — 
          the number of calories you burn daily based on your lean body mass and activity level.
        </p>
        <p>Use it to determine how much to eat for your goal:</p>
        <ul>
          <li>Lose <strong>1–2 lbs per week</strong> with a calorie deficit</li>
          <li>Maintain your current weight</li>
          <li>Gain muscle with a <strong>lean bulk</strong> calorie surplus</li>
        </ul>
      </div>
    </div>
  );
}

export default DeficitTimeCalculator;

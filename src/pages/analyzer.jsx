import React, { useState } from 'react';
import Dropdown from '../components/ui/Dropdown';
import '../styles/analyzer.css';
import posthog from '../lib/posthog';
import { supabase } from '../supabaseClient';
import { useUpgrade } from '../context/UpgradeContext';

// Use env var in production, fall back to hosted backend URL
const API_BASE = process.env.REACT_APP_API_BASE || 'https://gainlytics-1.onrender.com';

export default function Analyzer() {
  return <AnalyzerContent />;
}

function AnalyzerContent() {
  const { triggerUpgrade } = useUpgrade();

  // Measurement form state
  const [gender, setGender] = useState('male');
  const [age, setAge] = useState('');
  const [heightFt, setHeightFt] = useState('');
  const [heightIn, setHeightIn] = useState('');
  const [weightLbs, setWeightLbs] = useState('');
  const [waistIn, setWaistIn] = useState('');
  const [hipIn, setHipIn] = useState('');
  const [activityLevel, setActivityLevel] = useState('moderate');
  const [goal, setGoal] = useState('maintain');

  // Result + loading/error states
  const [result, setResult] = useState(null);
  const [measureError, setMeasureError] = useState('');
  const [loadingMeasure, setLoadingMeasure] = useState(false);

  /* ============ FUNCTIONAL REQUIREMENT: FR-5 / FR-6 / FR-7 ============ */
  /* System shall validate measurement input, call /analyze-measurements, and display results. */
  const handleAnalyzeMeasurements = async () => {
    setMeasureError('');
    setResult(null);

    // Basic required-field check
    if (!gender || !age || !heightFt || heightIn === '' || !weightLbs || !waistIn || !hipIn) {
      setMeasureError('Please fill out all measurement fields.');
      return;
    }

    const hFtNum  = Number(heightFt);
    const hInNum  = Number(heightIn);
    const wLbsNum = Number(weightLbs);
    const waistNum = Number(waistIn);
    const hipNum  = Number(hipIn);

    if ([hFtNum, hInNum, wLbsNum, waistNum, hipNum].some((v) => Number.isNaN(v) || v <= 0)) {
      setMeasureError('All measurements must be positive numbers.');
      return;
    }

    /* Gender is mapped to numeric for the ML model: male=0, female=1. */
    const genderNumeric = gender === 'male' ? 0 : 1;

    // Convert imperial inputs to metric for backend model
    const totalInches = hFtNum * 12 + hInNum;
    const height_cm = totalInches * 2.54;
    const weight_kg = wLbsNum * 0.453592;
    const waist_cm  = waistNum * 2.54;
    const hip_cm    = hipNum * 2.54;

    const { data: { session: currentSession } } = await supabase.auth.getSession();
    const userId = currentSession?.user?.id ?? null;

    const payload = {
      gender: genderNumeric,
      age: Number(age),
      height_cm,
      weight_kg,
      waist_cm,
      hip_cm,
      activity_level: activityLevel,
      goal,
      user_id: userId,
    };

    setLoadingMeasure(true);
    try {
      const res = await fetch(`${API_BASE}/analyze-measurements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.status === 403) {
        const json = await res.json();
        if (json.detail?.error === 'limit_reached') {
          triggerUpgrade('analyzer');
          return;
        }
      }

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Server error (${res.status}): ${text}`);
      }

      const data = await res.json();
      posthog.capture('analyzer_used', { type: 'measurements' });
      setResult(data);
    } catch (err) {
      console.error(err);
      setMeasureError(err.message || 'Something went wrong while analyzing your measurements.');
    } finally {
      setLoadingMeasure(false);
    }
  };

  return (
    <div className="analyzer-container">
      <h1 className="analyzer-title">Measurements</h1>
      <p className="analyzer-subtext">
        Enter your measurements to estimate body fat % and get calorie targets.
      </p>

      {/* ===== Measurements card ===== */}
      <div className="measurement-card">
        <p className="measurement-intro">
          Enter a few simple measurements. These are sent to a machine-learning
          model trained on real body fat data to estimate your body fat % and give
          practical calorie targets.
        </p>

        <div className="measurement-grid">
          <div className="field-group">
            <Dropdown
              label="Gender"
              value={gender}
              onChange={setGender}
              options={[
                { label: 'Male',   value: 'male' },
                { label: 'Female', value: 'female' },
              ]}
            />
          </div>

          <div className="field-group">
            <label className="field-label">Age</label>
            <input
              type="number"
              min="0"
              className="field-input"
              value={age}
              onChange={(e) => setAge(e.target.value)}
            />
          </div>

          <div className="field-group">
            <label className="field-label">Height</label>
            <div className="height-row">
              <input
                type="number"
                min="0"
                className="field-input"
                placeholder="ft"
                value={heightFt}
                onChange={(e) => setHeightFt(e.target.value)}
              />
              <input
                type="number"
                min="0"
                className="field-input"
                placeholder="in"
                value={heightIn}
                onChange={(e) => setHeightIn(e.target.value)}
              />
            </div>
          </div>

          <div className="field-group">
            <label className="field-label">Weight (lbs)</label>
            <input
              type="number"
              min="0"
              className="field-input"
              value={weightLbs}
              onChange={(e) => setWeightLbs(e.target.value)}
            />
          </div>

          <div className="field-group">
            <label className="field-label">Waist (at navel) (inches)</label>
            <input
              type="number"
              min="0"
              className="field-input"
              value={waistIn}
              onChange={(e) => setWaistIn(e.target.value)}
            />
          </div>

          <div className="field-group">
            <label className="field-label">Hip (inches)</label>
            <input
              type="number"
              min="0"
              className="field-input"
              value={hipIn}
              onChange={(e) => setHipIn(e.target.value)}
            />
          </div>

          <div className="field-group">
            <Dropdown
              label="Activity Level"
              value={activityLevel}
              onChange={setActivityLevel}
              options={[
                { label: 'Sedentary (little/no exercise)',        value: 'sedentary' },
                { label: 'Lightly active (1–3 days/week)',        value: 'light' },
                { label: 'Moderately active (3–5 days/week)',     value: 'moderate' },
                { label: 'Very active (6–7 days/week)',           value: 'active' },
                { label: 'Extra active (physical job / 2×/day)', value: 'extra' },
              ]}
            />
          </div>

          <div className="field-group">
            <Dropdown
              label="Goal"
              value={goal}
              onChange={setGoal}
              options={[
                { label: 'Aggressive cut (−750 kcal/day)',  value: 'aggressive_cut' },
                { label: 'Cut – lose fat (−500 kcal/day)',  value: 'cut' },
                { label: 'Maintenance',                      value: 'maintain' },
                { label: 'Lean bulk (+300 kcal/day)',        value: 'bulk' },
                { label: 'Aggressive bulk (+500 kcal/day)', value: 'aggressive_bulk' },
              ]}
            />
          </div>
        </div>

        <div className="button-row">
          <button
            className="analyze-btn"
            onClick={handleAnalyzeMeasurements}
            disabled={loadingMeasure}
          >
            {loadingMeasure ? 'Analyzing…' : 'Analyze Measurements'}
          </button>
        </div>

        {measureError && <div className="error-text">{measureError}</div>}
        {loadingMeasure && <div className="loading-spinner">Calculating your estimate…</div>}
      </div>

      {/* ===== Results ===== */}
      {result && (
        <>
          <div className="analysis-results">
            <h2 className="result-title">Results</h2>

            <div className="result-item">
              <strong>Estimated Body Fat:</strong>{' '}
              {typeof result.bodyfat === 'number'
                ? `${result.bodyfat.toFixed(1)}%`
                : `${result.bodyfat}%`}
            </div>

            <div className="result-item">
              <strong>Body Type:</strong>
              <span className="bodytype-badge">{result.category}</span>
            </div>

            {result.tdee != null && (
              <div className="tdee-chips">
                <div className="tdee-chip">
                  <span className="tdee-chip__value">{result.bmr?.toLocaleString()}</span>
                  <span className="tdee-chip__label">BMR (kcal at rest)</span>
                </div>
                <div className="tdee-chip">
                  <span className="tdee-chip__value">{result.tdee?.toLocaleString()}</span>
                  <span className="tdee-chip__label">TDEE (kcal/day)</span>
                </div>
                <div className="tdee-chip">
                  <span className="tdee-chip__value">{result.suggested_calories?.toLocaleString()}</span>
                  <span className="tdee-chip__label">Target (kcal/day)</span>
                </div>
                <div className="tdee-chip">
                  <span className="tdee-chip__value" style={{
                    color: result.deficit_or_surplus < 0 ? '#f87171' : result.deficit_or_surplus > 0 ? 'var(--accent-light)' : 'var(--text-muted)',
                  }}>
                    {result.deficit_or_surplus > 0 ? '+' : ''}{result.deficit_or_surplus?.toLocaleString()}
                  </span>
                  <span className="tdee-chip__label">
                    {result.deficit_or_surplus < 0
                      ? 'Deficit (kcal/day)'
                      : result.deficit_or_surplus > 0
                        ? 'Surplus (kcal/day)'
                        : 'Balance (maintenance)'}
                  </span>
                </div>
              </div>
            )}

            {result.goal_suggestion && (
              <div className="result-item">
                <strong>Goal Suggestion:</strong> {result.goal_suggestion}
              </div>
            )}

            {Array.isArray(result.notes) && result.notes.length > 0 && (
              <div className="result-item">
                <strong>Next Steps:</strong>
                <ul>
                  {result.notes.map((tip, idx) => (
                    <li key={idx}>{tip}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="about-calculator">
            <h3>How these estimates work</h3>
            <p>
              This analyzer uses a Random Forest model trained on the NHANES 2017-2018
              dataset — a nationally representative sample of thousands of U.S. adults,
              with DXA-measured body fat as the ground truth. Use the results as practical
              guidance for training and nutrition, not as a medical diagnosis.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

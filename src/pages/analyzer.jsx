import React, { useState } from 'react';
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
  // Which mode is active: "measurements" or "photo"
  const [mode, setMode] = useState('measurements');

  // Measurement form state
  const [gender, setGender] = useState('male'); // male/female
  const [age, setAge] = useState('');
  const [heightFt, setHeightFt] = useState('');
  const [heightIn, setHeightIn] = useState('');
  const [weightLbs, setWeightLbs] = useState('');
  const [waistIn, setWaistIn] = useState('');
  const [hipIn, setHipIn] = useState('');
  const [neckIn, setNeckIn] = useState('');

  // Image upload state
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);

  // Shared result + loading/error states
  const [result, setResult] = useState(null);
  const [measureError, setMeasureError] = useState('');
  const [imageError, setImageError] = useState('');
  const [loadingMeasure, setLoadingMeasure] = useState(false);
  const [loadingImage, setLoadingImage] = useState(false);

  // ----- Measurement-based analysis -----
  /* ============ FUNCTIONAL REQUIREMENT: FR-5 / FR-6 / FR-7 ============ */
  /* System shall validate measurement input, call /analyze-measurements, and display results. */
  const handleAnalyzeMeasurements = async () => {
    setMeasureError('');
    setResult(null);

    // Basic required-field check
    if (
      !gender ||
      !age ||
      !heightFt ||
      heightIn === '' ||
      !weightLbs ||
      !waistIn ||
      !hipIn ||
      !neckIn
    ) {
      setMeasureError('Please fill out all measurement fields.');
      return;
    }

    // Parse inputs as numbers
    const hFtNum = Number(heightFt);
    const hInNum = Number(heightIn);
    const wLbsNum = Number(weightLbs);
    const waistNum = Number(waistIn);
    const hipNum = Number(hipIn);
    const neckNum = Number(neckIn);

    if (
      [hFtNum, hInNum, wLbsNum, waistNum, hipNum, neckNum].some(
        (v) => Number.isNaN(v) || v <= 0
      )
    ) {
      setMeasureError('All measurements must be positive numbers.');
      return;
    }


    /* ============ FUNCTIONAL REQUIREMENT: FR-5 ============ */
    /* Gender is mapped to numeric for the ML model: male=0, female=1. */
    const genderNumeric = gender === 'male' ? 0 : 1;

    // Convert imperial inputs to metric for backend model
    const totalInches = hFtNum * 12 + hInNum;
    const height_cm = totalInches * 2.54;
    const weight_kg = wLbsNum * 0.453592;
    const waist_cm = waistNum * 2.54;
    const hip_cm = hipNum * 2.54;
    const neck_cm = neckNum * 2.54;

    // Get the current user's ID for usage tracking
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    const userId = currentSession?.user?.id ?? null;

    const payload = {
      gender: genderNumeric,
      age: Number(age),
      height_cm,
      weight_kg,
      waist_cm,
      hip_cm,
      neck_cm,
      user_id: userId,
    };

    setLoadingMeasure(true);
    try {
      // Call FastAPI /analyze-measurements
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

      /* ============ FUNCTIONAL REQUIREMENT: FR-7 ============ */
      /* System shall render body fat %, category, and calorie guidance returned by the API. */
      posthog.capture('analyzer_used', { type: 'measurements' });
      setResult(data);
    } catch (err) {
      console.error(err);
      setMeasureError(
        err.message || 'Something went wrong while analyzing your measurements.'
      );
    } finally {
      setLoadingMeasure(false);
    }
  };

  /* ============ FUNCTIONAL REQUIREMENT: FR-8 / FR-9 ============ */
  /* System shall accept a user image and send it to /analyze-image for experimental analysis. */
  const handleFileChange = (e) => {
    const f = e.target.files[0];
    setFile(f || null);
    setImageError('');
    setResult(null);

    // Show a live preview of the uploaded image
    if (f) {
      setPreview(URL.createObjectURL(f));
    } else {
      setPreview(null);
    }
  };

  const handleAnalyzeImage = async () => {
    setImageError('');
    setResult(null);

    if (!file) {
      setImageError('Please upload a photo first.');
      return;
    }

    // Get the current user's ID for usage tracking
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    const userId = currentSession?.user?.id ?? null;

    // Build multipart/form-data body for the image upload
    const formData = new FormData();
    formData.append('file', file);
    if (userId) formData.append('user_id', userId);

    setLoadingImage(true);
    try {
      // Call FastAPI /analyze-image
      const res = await fetch(`${API_BASE}/analyze-image`, {
        method: 'POST',
        body: formData,
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
      posthog.capture('analyzer_used', { type: 'image' });
      setResult(data);
    } catch (err) {
      console.error(err);
      setImageError(
        err.message || 'Something went wrong while analyzing the image.'
      );
    } finally {
      setLoadingImage(false);
    }
  };

  return (
    <div className="analyzer-container">
      <h1 className="analyzer-title">AI Body Analyzer</h1>
      <p className="analyzer-subtext">
        Choose a method below. For best accuracy, use your measurements.
      </p>

      {/* Mode toggle pills */}
      <div className="analyzer-mode-toggle-container">
        <div className="mode-pill-group">
          <button
            className={`mode-pill ${mode === 'measurements' ? 'active' : ''}`}
            onClick={() => setMode('measurements')}
          >
            Measurements (Recommended)
          </button>
          <button
            className={`mode-pill ${mode === 'photo' ? 'active' : ''}`}
            onClick={() => setMode('photo')}
          >
            Photo (Experimental)
          </button>
        </div>
      </div>

      {/* ===== Measurements card ===== */}
      {mode === 'measurements' && (
        <div className="measurement-card">
          <p className="measurement-intro">
            Enter a few simple measurements. These are sent to a machine-learning
            model trained on real body fat data to estimate your body fat % and give
            practical calorie targets.
          </p>

          {/* Measurement input grid */}
          <div className="measurement-grid">
            <div className="field-group">
              <label className="field-label">Gender</label>
              <select
                className="field-input"
                value={gender}
                onChange={(e) => setGender(e.target.value)}
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
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
              <label className="field-label">Neck (inches)</label>
              <input
                type="number"
                min="0"
                className="field-input"
                value={neckIn}
                onChange={(e) => setNeckIn(e.target.value)}
              />
            </div>
          </div>

          {/* Trigger measurement analysis */}
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
          {loadingMeasure && (
            <div className="loading-spinner">Calculating your estimate…</div>
          )}
        </div>
      )}

      {/* ===== Photo card ===== */}
      {mode === 'photo' && (
        <div className="upload-card">
          <p className="upload-subtext">
            Upload a clear full-body photo (front or slight angle) with good
            lighting and a simple background. The AI estimates your body fat % from
            your silhouette. This mode is experimental.
          </p>

          {/* File input with custom label */}
          <label className="upload-label">
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="upload-input"
            />
            {file ? 'Change Photo' : 'Choose Photo'}
          </label>

          {/* Live preview of selected image */}
          {preview && (
            <div className="image-preview">
              <img src={preview} alt="Body preview" />
            </div>
          )}

          <div className="button-row">
            <button
              className="analyze-btn outline"
              onClick={handleAnalyzeImage}
              disabled={loadingImage}
            >
              {loadingImage ? 'Analyzing…' : 'Analyze Image'}
            </button>
          </div>

          {imageError && <div className="error-text">{imageError}</div>}
          {loadingImage && (
            <div className="loading-spinner">Analyzing your photo…</div>
          )}
        </div>
      )}

      {/* ===== Shared Results ===== */}
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

            <div className="result-item">
              <strong>Suggested Calories:</strong>{' '}
              {result.suggested_calories?.toLocaleString?.() ??
                result.suggested_calories}{' '}
              kcal/day
            </div>

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

          {/* Explanation of how the calculators work */}
          <div className="about-calculator">
            <h3>How these estimates work</h3>
            <p>
              The measurement-based analyzer uses a Random Forest model trained on
              the NHANES 2017-2018 dataset — a nationally representative sample of
              thousands of U.S. adults of both sexes, with DXA-measured body fat as
              the ground truth. The photo analyzer is experimental and uses a
              separate rule-based silhouette estimator. Use the results as practical
              guidance for training and nutrition, not as a medical diagnosis.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

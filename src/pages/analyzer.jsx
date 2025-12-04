import React, { useState } from 'react';
import '../styles/analyzer.css';

// Use env var in production, fall back to local dev backend
const API_BASE = process.env.REACT_APP_API_BASE || 'https://gainlytics-1.onrender.com';

export default function Analyzer() {
  // Which mode is active: "measurements" or "photo"
  const [mode, setMode] = useState('measurements');

  // Measurement state
  const [gender, setGender] = useState('male'); // male/female
  const [age, setAge] = useState('');
  const [heightFt, setHeightFt] = useState('');
  const [heightIn, setHeightIn] = useState('');
  const [weightLbs, setWeightLbs] = useState('');
  const [waistIn, setWaistIn] = useState('');
  const [hipIn, setHipIn] = useState('');
  const [neckIn, setNeckIn] = useState('');

  // Image state
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);

  // Shared result + loading/error
  const [result, setResult] = useState(null);
  const [measureError, setMeasureError] = useState('');
  const [imageError, setImageError] = useState('');
  const [loadingMeasure, setLoadingMeasure] = useState(false);
  const [loadingImage, setLoadingImage] = useState(false);

  // ----- Measurement-based analysis -----
  const handleAnalyzeMeasurements = async () => {
    setMeasureError('');
    setResult(null);

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

    const genderNumeric = gender === 'male' ? 1 : 0;

    // Convert to metric for backend
    const totalInches = hFtNum * 12 + hInNum;
    const height_cm = totalInches * 2.54;
    const weight_kg = wLbsNum * 0.453592;
    const waist_cm = waistNum * 2.54;
    const hip_cm = hipNum * 2.54;
    const neck_cm = neckNum * 2.54;

    const payload = {
      gender: genderNumeric,
      height_cm,
      weight_kg,
      waist_cm,
      hip_cm,
      neck_cm,
      // age is collected for UX but not used by the current model
    };

    setLoadingMeasure(true);
    try {
      const res = await fetch(`${API_BASE}/analyze-measurements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Server error (${res.status}): ${text}`);
      }

      const data = await res.json();
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

  // ----- Image-based analysis (experimental) -----
  const handleFileChange = (e) => {
    const f = e.target.files[0];
    setFile(f || null);
    setImageError('');
    setResult(null);

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

    const formData = new FormData();
    formData.append('file', file);

    setLoadingImage(true);
    try {
      const res = await fetch(`${API_BASE}/analyze-image`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Server error (${res.status}): ${text}`);
      }

      const data = await res.json();
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

          <label className="upload-label">
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="upload-input"
            />
            {file ? 'Change Photo' : 'Choose Photo'}
          </label>

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

          <div className="about-calculator">
            <h3>How these estimates work</h3>
            <p>
              The measurement-based analyzer uses a machine learning model trained
              on a real dataset of body measurements and body fat %. The photo
              analyzer is experimental and blends simple silhouette features with
              the same model. Use the results as practical guidance for training and
              nutrition, not as a medical diagnosis.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

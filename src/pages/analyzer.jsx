import React, { useState } from 'react';
import '../styles/analyzer.css';

const API_BASE = 'https://gainlytics-1.onrender.com';

export default function Analyzer() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleFileChange = (e) => {
    const f = e.target.files[0];
    setFile(f);
    setResult(null);
    setError('');

    if (f) {
      setPreview(URL.createObjectURL(f));
    } else {
      setPreview(null);
    }
  };

  const handleAnalyze = async () => {
    if (!file) {
      setError('Please upload a photo first.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('file', file);

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
      setError(err.message || 'Something went wrong while analyzing the image.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="analyzer-container">
      <h1 className="analyzer-title">AI Body Analyzer</h1>
      <p className="analyzer-subtext">
        Upload a full-body photo to get an estimated body fat %, body type, and simple
        recommendations. Images are processed temporarily and not stored.
        <br />
        <span style={{ color: '#7bdfff', fontSize: '14px' }}>
          Tip: For best accuracy, use a clear photo with good lighting and a simple or
          transparent background so the AI can detect your silhouette more easily.
        </span>
      </p>

      {/* Upload & preview */}
      <div className="upload-box">
        <label className="upload-label">
          <input
            type="file"
            accept="image/*"
            onChange={handleFileChange}
          />
          {file ? 'Change photo' : 'Choose a photo'}
        </label>

        {preview && (
          <div className="image-preview">
            <img src={preview} alt="Body preview" />
          </div>
        )}

        {/* Center the Analyze button */}
        <div
          style={{
            marginTop: '20px',
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          <button
            className="analyze-btn"
            onClick={handleAnalyze}
            disabled={loading}
          >
            {loading ? 'Analyzing…' : 'Analyze Image'}
          </button>
        </div>

        {error && (
          <div style={{ marginTop: '12px', color: '#ff7676' }}>
            {error}
          </div>
        )}

        {loading && (
          <div className="loading-spinner">
            Analyzing your photo…
          </div>
        )}
      </div>

      {/* Results */}
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
              <span className="bodytype-badge">
                {result.category}
              </span>
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
            <h3>How this estimate works</h3>
            <p>
              The AI Body Analyzer combines a machine-learning model with visual
              analysis of your body silhouette. It looks at your proportions and how
              much of the frame you fill, then blends that with a trained model to
              estimate body fat % and give simple, practical recommendations. This
              is an approximation and not a medical diagnosis.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

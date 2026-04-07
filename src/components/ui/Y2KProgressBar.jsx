import React from 'react';
import './Y2KProgressBar.css';

export default function Y2KProgressBar({ label, progress = null, subLabel }) {
  const isDeterminate = progress !== null && progress !== undefined;

  return (
    <div className="y2k-progress">
      {/* Label row */}
      <div className="y2k-progress__label-row">
        <span className="y2k-progress__label">{label}</span>
        {isDeterminate && (
          <span className="y2k-progress__pct">{Math.round(progress)}%</span>
        )}
      </div>

      {/* Track */}
      <div className="y2k-progress__track">
        <div
          className={`y2k-progress__fill ${isDeterminate ? '' : 'y2k-progress__fill--indeterminate'}`}
          style={isDeterminate ? { width: `${Math.min(progress, 100)}%` } : undefined}
        />
      </div>

      {/* Sub-label */}
      {subLabel && (
        <span className="y2k-progress__sub">{subLabel}</span>
      )}
    </div>
  );
}

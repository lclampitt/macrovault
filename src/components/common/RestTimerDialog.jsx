import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './RestTimerDialog.css';

const PRESETS = [30, 60, 90, 120, 180];

const formatSec = (s) => (s < 60 ? `${s}s` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`);

export default function RestTimerDialog({ open, exerciseName, onStart, onCancel }) {
  const [custom, setCustom] = useState('');

  useEffect(() => {
    if (!open) setCustom('');
  }, [open]);

  const submitCustom = () => {
    const secs = parseInt(custom, 10);
    if (!isFinite(secs) || secs < 5) return;
    onStart(Math.min(3600, secs));
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="rt-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onCancel}
          role="presentation"
        >
          <motion.div
            className="rt-dialog"
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.92 }}
            transition={{ duration: 0.15 }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Rest timer"
          >
            <h4 className="rt-title">Rest timer</h4>
            {exerciseName && <p className="rt-subtitle">{exerciseName}</p>}
            <div className="rt-pills">
              {PRESETS.map((sec) => (
                <button
                  key={sec}
                  type="button"
                  className="rt-pill"
                  onClick={() => onStart(sec)}
                  style={{ touchAction: 'manipulation' }}
                >
                  {formatSec(sec)}
                </button>
              ))}
            </div>
            <div className="rt-custom">
              <label htmlFor="rt-custom-input" className="rt-custom-label">Custom (seconds)</label>
              <input
                id="rt-custom-input"
                type="number"
                inputMode="numeric"
                min={5}
                max={3600}
                placeholder="e.g. 75"
                className="rt-custom-input"
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') submitCustom(); }}
              />
            </div>
            <div className="rt-actions">
              <motion.button
                type="button"
                className="rt-primary"
                onClick={submitCustom}
                disabled={!custom || parseInt(custom, 10) < 5}
                whileTap={{ scale: 0.97 }}
              >
                Start
              </motion.button>
              <motion.button
                type="button"
                className="rt-secondary"
                onClick={onCancel}
                whileTap={{ scale: 0.97 }}
              >
                Cancel
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

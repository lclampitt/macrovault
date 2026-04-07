import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../supabaseClient';
import '../styles/auth.css';

export default function ResetPassword() {
  const [password, setPassword]         = useState('');
  const [confirmPassword, setConfirm]   = useState('');
  const [message, setMessage]           = useState('');
  const [status, setStatus]             = useState(null);
  const [busy, setBusy]                 = useState(false);
  const [done, setDone]                 = useState(false);
  const navigate = useNavigate();

  const handleReset = async (e) => {
    e.preventDefault();
    setMessage('');
    setStatus(null);

    if (password.length < 6) {
      setStatus('error');
      setMessage('Password must be at least 6 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setStatus('error');
      setMessage('Passwords do not match.');
      return;
    }

    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      setStatus('success');
      setMessage('Password updated successfully! Redirecting...');
      setDone(true);

      setTimeout(() => navigate('/home', { replace: true }), 2000);
    } catch (err) {
      setStatus('error');
      setMessage(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-grid" aria-hidden="true" />
      <div className="auth-glow" aria-hidden="true" />

      <motion.div
        className="auth-logo"
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
      >
        <img src="/images/gainlyticslogo.png" alt="MacroVault" className="auth-logo__icon" />
        <span className="auth-logo__name">MacroVault</span>
      </motion.div>

      <motion.div
        className="auth-card"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1, ease: 'easeOut' }}
      >
        <h2 className="auth-title">Set new password</h2>
        <p className="auth-subtitle">
          Enter your new password below.
        </p>

        <motion.form
          className="auth-form"
          onSubmit={handleReset}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <input
            type="password"
            placeholder="New password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            autoComplete="new-password"
          />
          <input
            type="password"
            placeholder="Confirm new password"
            value={confirmPassword}
            onChange={(e) => setConfirm(e.target.value)}
            required
            minLength={6}
            autoComplete="new-password"
          />
          <button type="submit" disabled={busy || done}>
            {busy ? 'Updating...' : done ? 'Done!' : 'Update password'}
          </button>
        </motion.form>

        <AnimatePresence>
          {message && (
            <motion.p
              className={`auth-message ${status === 'error' ? 'error' : 'success'}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              {message}
            </motion.p>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

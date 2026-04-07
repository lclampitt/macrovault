import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import '../styles/auth.css';

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show:   { opacity: 1, y: 0 },
};

function AuthPage() {
  const [email, setEmail]           = useState('');
  const [password, setPassword]     = useState('');
  const [isLogin, setIsLogin]       = useState(true);
  const [isForgot, setIsForgot]     = useState(false);
  const [message, setMessage]       = useState('');
  const [status, setStatus]         = useState(null); // 'error' | 'success' | null
  const [busy, setBusy]             = useState(false);
  const navigate = useNavigate();

  const handleAuth = async (e) => {
    e.preventDefault();
    setMessage('');
    setStatus(null);
    setBusy(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        setStatus('success');
        setMessage('Logged in successfully.');
        navigate('/home', { replace: true });
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setStatus('success');
        setMessage('Account created! Please check your email to confirm.');
      }
    } catch (err) {
      setStatus('error');
      setMessage(`${err.message}`);
    } finally {
      setBusy(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    if (!email.trim()) {
      setStatus('error');
      setMessage('Please enter your email address.');
      return;
    }
    setMessage('');
    setStatus(null);
    setBusy(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth`,
      });
      if (error) throw error;
      setStatus('success');
      setMessage('Password reset link sent! Check your email.');
    } catch (err) {
      setStatus('error');
      setMessage(err.message);
    } finally {
      setBusy(false);
    }
  };

  const toggleMode = () => {
    setIsLogin((prev) => !prev);
    setIsForgot(false);
    setMessage('');
    setStatus(null);
  };

  const goToForgot = () => {
    setIsForgot(true);
    setMessage('');
    setStatus(null);
  };

  const backToLogin = () => {
    setIsForgot(false);
    setMessage('');
    setStatus(null);
  };

  return (
    <div className="auth-page">
      {/* Grid background */}
      <div className="auth-grid" aria-hidden="true" />
      {/* Radial glow */}
      <div className="auth-glow" aria-hidden="true" />

      {/* Logo */}
      <motion.div
        className="auth-logo"
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
      >
        <div className="auth-logo__icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 20V10M12 20V4M18 20v-6" />
          </svg>
        </div>
        <span className="auth-logo__name">Gainlytics</span>
      </motion.div>

      {/* Card */}
      <motion.div
        className="auth-card"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1, ease: 'easeOut' }}
      >
        {/* Title — animates when mode switches */}
        <AnimatePresence mode="wait">
          <motion.div
            key={isForgot ? 'forgot-head' : isLogin ? 'login-head' : 'register-head'}
            variants={fadeUp}
            initial="hidden"
            animate="show"
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25 }}
          >
            <h2 className="auth-title">
              {isForgot ? 'Reset password' : isLogin ? 'Sign in' : 'Create account'}
            </h2>
            <p className="auth-subtitle">
              {isForgot
                ? "Enter your email and we'll send you a link to reset your password."
                : isLogin
                  ? 'Welcome back! Sign in to access your analysis, goals, and progress.'
                  : 'Start using Gainlytics to track your body analysis, goals, and workouts.'}
            </p>
          </motion.div>
        </AnimatePresence>

        {/* Form */}
        <AnimatePresence mode="wait">
          {isForgot ? (
            <motion.form
              key="forgot-form"
              className="auth-form"
              onSubmit={handleForgotPassword}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
            >
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <button type="submit" disabled={busy}>
                {busy ? 'Sending…' : 'Send reset link'}
              </button>
            </motion.form>
          ) : (
            <motion.form
              key="auth-form"
              className="auth-form"
              onSubmit={handleAuth}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
            >
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete={isLogin ? 'current-password' : 'new-password'}
              />
              <button type="submit" disabled={busy}>
                {busy
                  ? (isLogin ? 'Signing in…' : 'Creating account…')
                  : (isLogin ? 'Sign In' : 'Register')}
              </button>
            </motion.form>
          )}
        </AnimatePresence>

        {/* Forgot password link (only on sign in) */}
        {isLogin && !isForgot && (
          <p className="auth-forgot" onClick={goToForgot}>
            Forgot password?
          </p>
        )}

        {/* Mode toggle */}
        {isForgot ? (
          <p className="switch-text" onClick={backToLogin}>
            <span>Back to sign in</span>
          </p>
        ) : (
          <p className="switch-text" onClick={toggleMode}>
            {isLogin ? (
              <>No account? <span>Register here</span></>
            ) : (
              <>Already have an account? <span>Sign in</span></>
            )}
          </p>
        )}

        {/* Feedback */}
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

export default AuthPage;

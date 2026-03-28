import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import '../styles/auth.css';

function AuthPage() {
  // Local form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // isLogin controls whether we're in "sign in" or "register" mode
  const [isLogin, setIsLogin] = useState(true);
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState(null); // 'error' | 'success' | null
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  /* ============ FUNCTIONAL REQUIREMENT: FR-2 / FR-3 ============ */
  /* System shall allow users to register and sign in using Supabase Auth. */
  const handleAuth = async (e) => {
    e.preventDefault();       // allows Enter to submit
    setMessage('');
    setStatus(null);
    setBusy(true);

    try {
      if (isLogin) {
        /* ============ FUNCTIONAL REQUIREMENT: FR-3 ============ */
        /* System shall authenticate valid credentials and establish a session. */
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;

        setStatus('success');
        setMessage('Logged in successfully.');
        // On successful login, go to the home/dashboard
        navigate('/', { replace: true });
      } else {
        /* ============ FUNCTIONAL REQUIREMENT: FR-2 ============ */
        /* System shall create a new user account in Supabase Auth. */
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;

        setStatus('success');
        setMessage('Account created! Please check your email to confirm.');
      }
    } catch (err) {
      // Show Supabase error if something fails
      setStatus('error');
      setMessage(`${err.message}`);
    } finally {
      setBusy(false);
    }
  };

  // Switch between login and register modes
  const toggleMode = () => {
    setIsLogin((prev) => !prev);
    setMessage('');
    setStatus(null);
  };

  return (
    <div className="auth-page">
      {/* Brand logo above card */}
      <div className="auth-logo">
        <div className="auth-logo__icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 20V10M12 20V4M18 20v-6" />
          </svg>
        </div>
        <span className="auth-logo__name">Gainlytics</span>
      </div>

      <div className="auth-card">
        <h2 className="auth-title">{isLogin ? 'Sign in' : 'Create account'}</h2>
        <p className="auth-subtitle">
          {isLogin
            ? 'Welcome back! Sign in to access your analysis, goals, and progress.'
            : 'Start using Gainlytics to track your body analysis, goals, and workouts.'}
        </p>

        {/* Main auth form */}
        <form className="auth-form" onSubmit={handleAuth}>
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
            {busy ? (isLogin ? 'Signing in…' : 'Creating account…') : isLogin ? 'Sign In' : 'Register'}
          </button>
        </form>

        {/* Mode switch text link */}
        <p className="switch-text" onClick={toggleMode}>
          {isLogin ? (
            <>
              No account? <span>Register here</span>
            </>
          ) : (
            <>
              Already have an account? <span>Sign in</span>
            </>
          )}
        </p>

        {/* Feedback message below form */}
        {message && (
          <p className={`auth-message ${status === 'error' ? 'error' : 'success'}`}>
            {message}
          </p>
        )}
      </div>
    </div>
  );
}

export default AuthPage;

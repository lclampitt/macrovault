import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

function AuthForm({ isRegistering, onLogin }) {
  // Local form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  // Handle login or registration submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    setBusy(true);

    try {
      if (isRegistering) {
        // Register a new user with Supabase email/password auth
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;

        // After sign up, send them back to the auth page (login)
        // Optional: query param can show a "account created" banner
        navigate('/auth?registered=1', { replace: true });
      } else {
        // Sign in existing user with Supabase
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;

        // Notify parent (if provided) and route to the main dashboard
        onLogin?.();
        navigate('/dashboard', { replace: true });
      }
    } catch (err) {
      // Show any Supabase error message to the user
      setMessage(`${err.message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <h3>{isRegistering ? 'Register' : 'Sign In'}</h3>

      {/* Email input */}
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        required
      />
      {/* Password input */}
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={e => setPassword(e.target.value)}
        required
      />

      {/* Submit button with loading state */}
      <button type="submit" disabled={busy}>
        {busy ? (isRegistering ? 'Creating…' : 'Signing in…') : (isRegistering ? 'Register' : 'Sign In')}
      </button>

      {/* Error/success message from Supabase */}
      {message && <p style={{ color: 'white' }}>{message}</p>}
    </form>
  );
}

export default AuthForm;

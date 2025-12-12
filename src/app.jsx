import React, { useEffect, useState } from 'react';
import { Routes, Route, useNavigate, Navigate } from 'react-router-dom';
import { supabase } from './supabaseClient';

// Layout
import Header from './components/header';
import Footer from './components/footer';

// Pages
import Dashboard from './pages/dashboard';
import Analyzer from './pages/analyzer';
import Calculators from './pages/calculators';
import ProgressPage from './pages/progress';
import AuthPage from './pages/auth';
import Contact from './pages/Contact';
import About from './pages/About';

// Features / sub-pages
import GoalPlanner from './components/GoalPlanner/goalplanner';

// Calculators
import TdeeCalculator from './calculators/TdeeCalculator';
import ProteinCalculator from './calculators/ProteinCalculator';
import OneRepMaxCalculator from './calculators/OneRepMaxCalculator';

// Exercises
import ExerciseLibrary from './pages/ExerciseLibrary/ExerciseLibrary';
import ExerciseDetails from './pages/ExerciseLibrary/ExerciseDetails';

// Workouts
import WorkoutLogger from './pages/Workouts/WorkoutLogger';


/* ============ FUNCTIONAL REQUIREMENT: FR-3 / FR-4 ============ */
/* System shall protect private pages and redirect unauthenticated users to /auth. */
function ProtectedRoute({ session, loading, children }) {
  // While we don't yet know the session, show a simple loading state
  if (loading) {
    return (
      <div
        style={{
          color: '#9aa0a6',
          textAlign: 'center',
          marginTop: '100px',
        }}
      >
        Loading...
      </div>
    );
  }

  // If there is no active session, redirect to /auth
  if (!session) return <Navigate to="/auth" replace />;

  // Otherwise, render the protected content
  return children;
}

function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  // kept for future use if you want to toggle login/register flows
  const [, setIsRegistering] = useState(false);
  const navigate = useNavigate();

  /* ============ FUNCTIONAL REQUIREMENT: FR-3 ============ */
  /* System shall load and persist a Supabase session for authenticated access. */
  useEffect(() => {
    const getSession = async () => {
      const { data } = await supabase.auth.getSession();
      setSession(data?.session ?? null);
      setLoading(false);
    };
    getSession();

    // Listen for login/logout events from Supabase
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setLoading(false);
      }
    );

    // Clean up the listener on unmount
    return () => listener.subscription.unsubscribe();
  }, []);

  /* ============ FUNCTIONAL REQUIREMENT: FR-3 (Logout) ============ */
  /* System shall allow users to sign out and clear their active session. */
  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    navigate('/');
  };

  return (
    <div>
      {/* Header gets the current session to show/hide Sign Out */}
      <Header onLogout={handleLogout} session={session} />
      <main>
        <Routes>
          {/* ============ FUNCTIONAL REQUIREMENT: FR-1 / FR-2 / FR-3 ============ */}
          {/* Public routes include authentication + informational pages. */}
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/about" element={<About />} />
          <Route path="/help" element={<Contact />} />
          <Route path="/calculators" element={<Calculators />} />
          <Route path="/calculators/tdee" element={<TdeeCalculator />} />
          <Route path="/calculators/protein" element={<ProteinCalculator />} />
          <Route path="/calculators/1rm" element={<OneRepMaxCalculator />} />
          <Route path="/exercises" element={<ExerciseLibrary />} />
          <Route path="/exercises/:id" element={<ExerciseDetails />} />

          {/* ============ FUNCTIONAL REQUIREMENT: FR-4 ============ */}
          {/* Protected dashboard + core tools require an active session. */}
          <Route
            path="/"
            element={
              <ProtectedRoute session={session} loading={loading}>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/analyzer"
            element={
              <ProtectedRoute session={session} loading={loading}>
                <Analyzer />
              </ProtectedRoute>
            }
          />
          <Route
            path="/goalplanner"
            element={
              <ProtectedRoute session={session} loading={loading}>
                <GoalPlanner />
              </ProtectedRoute>
            }
          />
          <Route
            path="/progress"
            element={
              <ProtectedRoute session={session} loading={loading}>
                <ProgressPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/workouts"
            element={
              <ProtectedRoute session={session} loading={loading}>
                <WorkoutLogger />
              </ProtectedRoute>
            }
          />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}

export default App;

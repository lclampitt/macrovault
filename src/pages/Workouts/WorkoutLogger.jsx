import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Lock, Trash2, Dumbbell, Bookmark, BookmarkCheck, Copy, Pencil,
  BookmarkPlus, X, Star, Play, Clock, Search, Check, Plus, ChevronRight,
} from 'lucide-react';
import posthog from '../../lib/posthog';
import { supabase } from '../../supabaseClient';
import { useUpgrade } from '../../context/UpgradeContext';
import { usePlan } from '../../hooks/usePlan';
import { useTheme } from '../../hooks/useTheme';
import { appToast as toast } from '../../utils/toast';
import exerciseDB from '../../data/exercises.json';
import '../../styles/WorkoutLogger.css';

const API_BASE = process.env.REACT_APP_API_BASE || 'https://gainlytics-1.onrender.com';


/* Format date string: "2025-12-12" → "Dec 12, 2025" */
function formatDate(dateStr = '') {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// eslint-disable-next-line no-unused-vars
const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } },
};

export default function WorkoutLogger() {
  const { triggerUpgrade } = useUpgrade();
  const { plan, isPro } = usePlan();
  const { isSpectrum, isY2K } = useTheme();

  const MUSCLE_GROUPS = ['Upper Body', 'Lower Body', 'Legs', 'Full Body', 'Core', 'Cardio'];

  // Form state for creating/editing a workout
  const [workoutDate, setWorkoutDate] = useState(new Date().toISOString().split('T')[0]);
  const [workoutName, setWorkoutName] = useState('');
  const [muscleGroup, setMuscleGroup] = useState('');
  const [exercises, setExercises] = useState([]);
  const [newExercise, setNewExercise] = useState('');
  const [message, setMessage] = useState('');
  const [userId, setUserId] = useState(null);
  const [editingWorkoutId, setEditingWorkoutId] = useState(null);

  // History and UI state
  const [workoutHistory, setWorkoutHistory] = useState([]);
  const [expanded, setExpanded] = useState({});
  const [formOpen, setFormOpen] = useState(false);

  // ── Template state ──────────────────────────
  const [templates, setTemplates] = useState([]);
  const [historyTab, setHistoryTab] = useState('history'); // 'history' | 'templates'
  const [saveTemplatePopover, setSaveTemplatePopover] = useState(null); // workout id or null
  const [templateName, setTemplateName] = useState('');
  const [templateNameMap, setTemplateNameMap] = useState({}); // workout_name → template_id
  const [loadedTemplateName, setLoadedTemplateName] = useState(null);
  const [loadedTemplateId, setLoadedTemplateId] = useState(null);
  const [copyPopover, setCopyPopover] = useState(null); // workout id or null
  const [copyDate, setCopyDate] = useState(new Date().toISOString().split('T')[0]);
  const formRef = useRef(null);

  // ── Mobile state ──────────────────────────
  const [mobileView, setMobileView] = useState('home'); // 'home' | 'session'
  const [sessionExercises, setSessionExercises] = useState([]);
  const [sessionName, setSessionName] = useState('');
  const [sessionMuscleGroup, setSessionMuscleGroup] = useState('');
  const [sessionTimer, setSessionTimer] = useState(0);
  const [sessionStartTime, setSessionStartTime] = useState(null);
  const [exerciseSearchOpen, setExerciseSearchOpen] = useState(false);
  const [exerciseSearchQuery, setExerciseSearchQuery] = useState('');
  const [exerciseBodyPartFilter, setExerciseBodyPartFilter] = useState('all');
  const [completedSets, setCompletedSets] = useState({});
  const [templatePreview, setTemplatePreview] = useState(null);
  const [sessionFromTemplateId, setSessionFromTemplateId] = useState(null);
  const [mobileExpanded, setMobileExpanded] = useState({});

  // Scroll to top when opening the logger
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Get the logged-in user from Supabase
  useEffect(() => {
    async function fetchUser() {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data?.user) {
        setMessage('Please log in to save or view workouts.');
        return;
      }
      setUserId(data.user.id);
    }
    fetchUser();
  }, []);

  // Once we know the user, load their saved workouts
  useEffect(() => {
    if (!userId) return;
    fetchWorkouts();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Fetch all workouts for the current user
  const fetchWorkouts = async () => {
    const { data, error } = await supabase
      .from('workouts')
      .select('*')
      .eq('user_id', userId)
      .order('workout_date', { ascending: false });

    if (error) console.error('Fetch error:', error);
    else setWorkoutHistory(data);
  };

  // ── Template CRUD ──────────────────────────
  const fetchTemplates = useCallback(async () => {
    if (!userId) return;
    const { data, error } = await supabase
      .from('workout_templates')
      .select('*')
      .eq('user_id', userId)
      .order('use_count', { ascending: false });

    if (error) { console.error('Template fetch error:', error); return; }
    setTemplates(data || []);
    // Build name → template_id map
    const map = {};
    (data || []).forEach((t) => { map[t.name] = t.id; });
    setTemplateNameMap(map);
  }, [userId]);

  useEffect(() => {
    if (userId) fetchTemplates();
  }, [userId, fetchTemplates]);

  const saveAsTemplate = async (workout) => {
    if (!userId) return;
    const name = templateName.trim() || workout.workout_name;
    const exerciseData = (workout.exercises || []).map((ex) => ({
      name: ex.name,
      sets: ex.sets?.length || 3,
      reps: ex.sets?.[0]?.reps || '',
      weight: ex.sets?.[0]?.weight || '',
    }));

    const { error } = await supabase.from('workout_templates').insert({
      user_id: userId,
      name,
      muscle_group: workout.muscle_group || '',
      exercises: exerciseData,
    });

    if (error) {
      toast.error(`Failed to save template: ${error.message}`);
      return;
    }
    toast.success(`${name} saved as template`);
    setSaveTemplatePopover(null);
    setTemplateName('');
    fetchTemplates();
  };

  const deleteTemplate = async (templateId) => {
    const { error } = await supabase.from('workout_templates').delete().eq('id', templateId);
    if (error) { toast.error('Failed to delete template'); return; }
    toast.success('Template deleted');
    fetchTemplates();
  };

  const removeTemplateByName = async (workoutName) => {
    const tid = templateNameMap[workoutName];
    if (!tid) return;
    await deleteTemplate(tid);
  };

  const loadTemplate = (template) => {
    setWorkoutName(template.name);
    setMuscleGroup(template.muscle_group || '');
    const exs = (template.exercises || []).map((ex) => ({
      name: ex.name,
      sets: Array.from({ length: ex.sets || 3 }, () => ({
        weight: ex.weight || '',
        reps: ex.reps || '',
        notes: '',
      })),
    }));
    setExercises(exs);
    setLoadedTemplateName(template.name);
    setLoadedTemplateId(template.id);
    setFormOpen(true);
    setHistoryTab('history');
    // Scroll to form
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const incrementTemplateUseCount = async (templateId) => {
    if (!templateId) return;
    const tpl = templates.find((t) => t.id === templateId);
    const currentCount = tpl?.use_count || 0;
    await supabase
      .from('workout_templates')
      .update({ use_count: currentCount + 1, updated_at: new Date().toISOString() })
      .eq('id', templateId);
  };

  const updateTemplateWeights = async (templateId, exerciseList) => {
    if (!templateId) return;
    const exerciseData = exerciseList.map((ex) => ({
      name: ex.name,
      sets: ex.sets?.length || 3,
      reps: ex.sets?.[0]?.reps || '',
      weight: ex.sets?.[0]?.weight || '',
    }));
    await supabase
      .from('workout_templates')
      .update({ exercises: exerciseData, updated_at: new Date().toISOString() })
      .eq('id', templateId);
  };

  // Copy workout to a new date
  const copyWorkoutToDate = async (workout) => {
    if (!userId) return;
    const workoutData = {
      user_id: userId,
      workout_date: copyDate,
      workout_name: workout.workout_name,
      muscle_group: workout.muscle_group || null,
      exercises: workout.exercises || [],
    };
    try {
      const res = await fetch(`${API_BASE}/workouts/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(workoutData),
      });
      if (res.status === 403) { triggerUpgrade('workouts'); return; }
      if (!res.ok) throw new Error(await res.text());
      toast.success(`${workout.workout_name} logged for ${formatDate(copyDate)}`);
      setCopyPopover(null);
      fetchWorkouts();
    } catch (err) {
      toast.error(`Failed to copy workout: ${err.message}`);
    }
  };

  // Delete a workout from history
  const deleteWorkout = async (id) => {
    const { error } = await supabase.from('workouts').delete().eq('id', id);
    if (error) console.error('Delete error:', error);
    else setWorkoutHistory((prev) => prev.filter((w) => w.id !== id));
  };

  // Add a new exercise row to the current workout
  const addExercise = () => {
    if (!newExercise.trim()) return;
    setExercises([
      ...exercises,
      { name: newExercise.trim(), sets: [{ weight: '', reps: '', notes: '' }] },
    ]);
    setNewExercise('');
  };

  // Add an additional set to an existing exercise
  const addSet = (i) => {
    const updated = [...exercises];
    updated[i].sets.push({ weight: '', reps: '', notes: '' });
    setExercises(updated);
  };

  // Update a single field of a single set for an exercise
  const handleSetChange = (exerciseIndex, setIndex, field, value) => {
    const updated = [...exercises];
    updated[exerciseIndex].sets[setIndex][field] = value;
    setExercises(updated);
  };

  // Remove an exercise from the current workout
  const deleteExercise = (i) => {
    const updated = exercises.filter((_, idx) => idx !== i);
    setExercises(updated);
  };

  // Save new workout or update an existing one in Supabase
  const saveWorkout = async () => {
    if (!workoutName.trim() || exercises.length === 0) {
      setMessage('Please enter a workout name and add at least one exercise.');
      return;
    }
    if (!userId) {
      setMessage('Please log in first.');
      return;
    }

    const workoutData = {
      user_id: userId,
      workout_date: workoutDate,
      workout_name: workoutName.trim(),
      muscle_group: muscleGroup || null,
      exercises,
    };

    let error;

    // If editingWorkoutId exists, update the existing row (no limit check needed for edits)
    if (editingWorkoutId) {
      ({ error } = await supabase
        .from('workouts')
        .update(workoutData)
        .eq('id', editingWorkoutId));
      if (!error) {
        setMessage('Workout updated successfully!');
        setEditingWorkoutId(null);
      }
    } else {
      // New workout — route through backend to enforce free-tier limit
      try {
        const res = await fetch(`${API_BASE}/workouts/save`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(workoutData),
        });
        if (res.status === 403) {
          triggerUpgrade('workouts');
          return;
        }
        if (!res.ok) {
          const txt = await res.text();
          throw new Error(txt);
        }
        posthog.capture('workout_logged', { exercise_count: exercises.length });
        setMessage('Workout saved successfully!');
      } catch (err) {
        console.error('Save error:', err);
        setMessage(`Error saving workout: ${err.message}`);
        return;
      }
    }

    if (error) {
      console.error('Save error:', error);
      setMessage(`Error saving workout: ${error.message}`);
    } else {
      // If loaded from a template, update use_count and weights
      if (loadedTemplateId) {
        incrementTemplateUseCount(loadedTemplateId);
        updateTemplateWeights(loadedTemplateId, exercises);
        fetchTemplates();
      }
      // Reset form and refresh history
      setWorkoutName('');
      setMuscleGroup('');
      setExercises([]);
      setFormOpen(false);
      setLoadedTemplateName(null);
      setLoadedTemplateId(null);
      fetchWorkouts();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // ── Session timer ──────────────────────────
  useEffect(() => {
    if (!sessionStartTime) return;
    const interval = setInterval(() => {
      setSessionTimer(Math.floor((Date.now() - sessionStartTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [sessionStartTime]);

  // ── iOS keyboard offset (visualViewport API) ──
  useEffect(() => {
    if (!window.visualViewport) return;
    const handleResize = () => {
      const kbHeight = window.innerHeight - window.visualViewport.height;
      document.documentElement.style.setProperty('--keyboard-height', `${kbHeight}px`);
    };
    window.visualViewport.addEventListener('resize', handleResize);
    window.visualViewport.addEventListener('scroll', handleResize);
    return () => {
      window.visualViewport.removeEventListener('resize', handleResize);
      window.visualViewport.removeEventListener('scroll', handleResize);
      document.documentElement.style.setProperty('--keyboard-height', '0px');
    };
  }, []);

  // ── Scroll focused input into view above keyboard ──
  const handleInputFocus = useCallback(() => {
    setTimeout(() => {
      const el = document.activeElement;
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 300);
  }, []);

  // ── Dismiss keyboard on tap outside inputs ──
  const dismissKeyboard = useCallback((e) => {
    if (e.target === e.currentTarget) {
      document.activeElement?.blur();
    }
  }, []);

  // ── Blur input on Enter (numeric keyboard "Done") ──
  const handleInputKeyDown = useCallback((e) => {
    if (e.key === 'Enter' || e.key === 'Done') {
      e.currentTarget.blur();
    }
  }, []);

  // ── Mobile helper functions ───────────────
  const formatDuration = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    if (m >= 60) {
      const h = Math.floor(m / 60);
      const rm = m % 60;
      return `${h}h ${rm}m`;
    }
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const startBlankSession = () => {
    setSessionExercises([]);
    setSessionName('');
    setSessionMuscleGroup('');
    setCompletedSets({});
    setSessionStartTime(Date.now());
    setSessionTimer(0);
    setSessionFromTemplateId(null);
    setMobileView('session');
  };

  const startSessionFromTemplate = (template) => {
    const exs = (template.exercises || []).map((ex) => ({
      name: ex.name,
      sets: Array.from({ length: ex.sets || 3 }, () => ({
        weight: ex.weight || '',
        reps: ex.reps || '',
        notes: '',
      })),
    }));
    setSessionExercises(exs);
    setSessionName(template.name);
    setSessionMuscleGroup(template.muscle_group || '');
    setCompletedSets({});
    setSessionStartTime(Date.now());
    setSessionTimer(0);
    setSessionFromTemplateId(template.id);
    setTemplatePreview(null);
    setMobileView('session');
  };

  const addExerciseToSession = (exercise) => {
    setSessionExercises((prev) => [
      ...prev,
      { name: exercise.name, sets: [{ weight: '', reps: '', notes: '' }] },
    ]);
    setExerciseSearchOpen(false);
    setExerciseSearchQuery('');
  };

  const addSetToSession = (exIdx) => {
    setSessionExercises((prev) => {
      const updated = [...prev];
      updated[exIdx] = {
        ...updated[exIdx],
        sets: [...updated[exIdx].sets, { weight: '', reps: '', notes: '' }],
      };
      return updated;
    });
  };

  const updateSessionSet = (exIdx, setIdx, field, value) => {
    setSessionExercises((prev) => {
      const updated = [...prev];
      updated[exIdx] = { ...updated[exIdx], sets: [...updated[exIdx].sets] };
      updated[exIdx].sets[setIdx] = { ...updated[exIdx].sets[setIdx], [field]: value };
      return updated;
    });
  };

  const toggleSetComplete = (exIdx, setIdx) => {
    const key = `${exIdx}-${setIdx}`;
    setCompletedSets((prev) => {
      const next = { ...prev };
      if (next[key]) {
        delete next[key];
      } else {
        next[key] = true;
      }
      return next;
    });
  };

  const removeSessionExercise = (exIdx) => {
    setSessionExercises((prev) => prev.filter((_, i) => i !== exIdx));
    setCompletedSets((prev) => {
      const next = {};
      Object.keys(prev).forEach((key) => {
        const [ei, si] = key.split('-').map(Number);
        if (ei < exIdx) next[key] = true;
        if (ei > exIdx) next[`${ei - 1}-${si}`] = true;
      });
      return next;
    });
  };

  const finishSession = async () => {
    if (sessionExercises.length === 0) {
      toast.error('Add at least one exercise before finishing.');
      return;
    }
    const name = sessionName.trim() || 'Quick Workout';
    const duration = sessionTimer;
    const workoutData = {
      user_id: userId,
      workout_date: new Date().toISOString().split('T')[0],
      workout_name: name,
      muscle_group: sessionMuscleGroup || null,
      exercises: sessionExercises,
    };
    try {
      const res = await fetch(`${API_BASE}/workouts/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(workoutData),
      });
      if (res.status === 403) { triggerUpgrade('workouts'); return; }
      if (!res.ok) throw new Error(await res.text());
      posthog.capture('workout_logged', { exercise_count: sessionExercises.length, duration_seconds: duration });
      if (sessionFromTemplateId) {
        incrementTemplateUseCount(sessionFromTemplateId);
        updateTemplateWeights(sessionFromTemplateId, sessionExercises);
        fetchTemplates();
      }
      toast.success(`${name} saved! ${formatDuration(duration)}`);
      setMobileView('home');
      setSessionStartTime(null);
      fetchWorkouts();
    } catch (err) {
      toast.error(`Error: ${err.message}`);
    }
  };

  const discardSession = () => {
    if (sessionExercises.length > 0 && !window.confirm('Discard this workout?')) return;
    setMobileView('home');
    setSessionStartTime(null);
    setSessionExercises([]);
    setCompletedSets({});
  };

  // ── Exercise search data ──────────────────
  const bodyParts = useMemo(() => {
    const parts = new Set(exerciseDB.map((ex) => ex.bodyPart));
    return ['all', ...Array.from(parts).sort()];
  }, []);

  const filteredExercises = useMemo(() => {
    let list = exerciseDB;
    if (exerciseBodyPartFilter !== 'all') {
      list = list.filter((ex) => ex.bodyPart === exerciseBodyPartFilter);
    }
    if (exerciseSearchQuery.trim()) {
      const q = exerciseSearchQuery.toLowerCase().trim();
      list = list.filter((ex) => ex.name.toLowerCase().includes(q));
    }
    return list;
  }, [exerciseSearchQuery, exerciseBodyPartFilter]);

  const groupedExercises = useMemo(() => {
    const groups = {};
    filteredExercises.forEach((ex) => {
      const letter = ex.name[0].toUpperCase();
      if (!groups[letter]) groups[letter] = [];
      groups[letter].push(ex);
    });
    return groups;
  }, [filteredExercises]);

  // Load a workout from history into the editor
  const editWorkout = (workout) => {
    setWorkoutDate(workout.workout_date);
    setWorkoutName(workout.workout_name);
    setMuscleGroup(workout.muscle_group || '');
    setExercises(workout.exercises || []);
    setEditingWorkoutId(workout.id);
    setFormOpen(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setMessage('Editing workout...');
  };

  // Expand/collapse a workout in the history list
  const toggleExpand = (id) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const atLimit = !isPro && workoutHistory.length >= 10;

  return (
    <div className="wl">

      {/* ═══════════ DESKTOP ═══════════ */}
      <div className="wl-desktop">

      {/* ── Y2K FREE TIER USAGE COUNTER ── */}
      {isY2K && !isPro && workoutHistory.length > 0 && (
        <div className="wl-y2k-usage">
          <div className="wl-y2k-usage__bar-track">
            <div
              className="wl-y2k-usage__bar-fill"
              style={{
                width: `${Math.min((workoutHistory.length / 10) * 100, 100)}%`,
                background: workoutHistory.length >= 8
                  ? 'linear-gradient(180deg, #FFD700, #CC9900)'
                  : `linear-gradient(180deg, var(--accent-light), var(--accent))`,
              }}
            />
          </div>
          <span className={`wl-y2k-usage__text ${workoutHistory.length >= 8 ? 'wl-y2k-usage__text--warn' : ''}`}>
            {workoutHistory.length >= 8
              ? `WARNING: [${workoutHistory.length}] / 10 logs used. Upgrade to Pro for unlimited.`
              : `[${workoutHistory.length}] / 10 free workout logs used`}
          </span>
        </div>
      )}

      {/* ── LOG SECTION ── */}
      <motion.div
        className="wl-log-card"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
      >
        {/* Y2K gradient title bar */}
        {isY2K && (
          <div className="wl-y2k-titlebar">
            <Dumbbell width={10} height={10} stroke="var(--accent-light)" strokeWidth={2} fill="none" />
            <span>LOG WORKOUT</span>
          </div>
        )}

        {/* Header row: title + expand toggle */}
        <div className="wl-log-header">
          <div>
            <p className="wl-section-title">Log a workout</p>
            {!isPro && !isY2K && workoutHistory.length > 0 && (
              <p style={{
                fontSize: 11,
                color: workoutHistory.length >= 8 ? '#EF9F27' : 'var(--text-muted)',
                margin: '2px 0 0',
              }}>
                {workoutHistory.length} / 10 free workout logs used
              </p>
            )}
          </div>
          {!atLimit && (
            <motion.button
              className="btn btn-primary wl-toggle-btn"
              onClick={() => setFormOpen((o) => !o)}
              whileTap={{ scale: 0.97 }}
              style={isSpectrum ? { border: '1px solid #1D9E75', color: '#5DCAA5', background: '#0a1a0f' } : undefined}
            >
              {formOpen ? (isY2K ? '[ Cancel ]' : 'Cancel') : (isY2K ? '[ + New workout ]' : '+ New workout')}
            </motion.button>
          )}
        </div>

        {/* Locked banner when free user hits limit */}
        {atLimit && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 0 4px' }}>
            <Lock size={16} style={{ color: 'var(--accent-light)', flexShrink: 0 }} />
            <div>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
                You've reached 10 workout logs on the free plan.
              </p>
              <button
                onClick={() => triggerUpgrade('workouts')}
                style={{ fontSize: 12, color: 'var(--accent-light)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginTop: 4, textDecoration: 'underline' }}
              >
                Upgrade to Pro for unlimited logging
              </button>
            </div>
          </div>
        )}

        {/* Collapsible form */}
        <AnimatePresence initial={false}>
          {formOpen && (
            <motion.div
              key="log-form"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              style={{ overflow: 'hidden' }}
            >
              <div className="wl-form-inner" ref={formRef}>
                {/* Y2K form section label */}
                {isY2K && <div className="wl-y2k-form-label">NEW WORKOUT ENTRY</div>}

                {/* ── Template picker row ──────────── */}
                {!editingWorkoutId && (
                  <div className="wl-template-picker">
                    <span className="wl-template-picker__label">Start from template:</span>
                    {templates.length === 0 ? (
                      <span className="wl-template-picker__empty">No templates yet — save a workout from History first</span>
                    ) : (
                      <div className="wl-template-picker__chips">
                        {templates.map((t) => (
                          <motion.button
                            key={t.id}
                            className="wl-template-chip"
                            onClick={() => loadTemplate(t)}
                            whileTap={{ scale: 0.95 }}
                          >
                            {t.name}
                          </motion.button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Loaded from template banner */}
                {loadedTemplateName && (
                  <div className="wl-template-banner">
                    <BookmarkCheck size={12} />
                    <span>Loaded from <strong>{loadedTemplateName}</strong> template — edit as needed</span>
                    <button className="wl-template-banner__dismiss" onClick={() => setLoadedTemplateName(null)}>
                      <X size={12} />
                    </button>
                  </div>
                )}

                {/* Date + Name row */}
                <div className="wl-top-row">
                  <div className="wl-field">
                    <label className="wl-label">Date</label>
                    <input
                      type="date"
                      className="input"
                      value={workoutDate}
                      onChange={(e) => setWorkoutDate(e.target.value)}
                    />
                  </div>
                  <div className="wl-field wl-field--grow">
                    <label className="wl-label">Workout name</label>
                    <input
                      type="text"
                      className="input"
                      value={workoutName}
                      onChange={(e) => setWorkoutName(e.target.value)}
                      placeholder="e.g. Push Day, Lower Body, Full Body"
                    />
                  </div>
                </div>

                {/* Muscle group selector */}
                <div className="wl-field">
                  <label className="wl-label">Muscle group</label>
                  <div className="wl-mg-pills">
                    {MUSCLE_GROUPS.map((g) => (
                      <motion.button
                        key={g}
                        type="button"
                        className={`wl-mg-pill ${muscleGroup === g ? 'wl-mg-pill--active' : ''}`}
                        onClick={() => setMuscleGroup(muscleGroup === g ? '' : g)}
                        whileTap={{ scale: 0.95 }}
                      >
                        {g}
                      </motion.button>
                    ))}
                  </div>
                </div>

                {/* Exercise blocks */}
                {exercises.map((ex, i) => (
                  <motion.div
                    key={i}
                    className="wl-exercise-block"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="wl-exercise-header">
                      <span className="wl-exercise-name">{ex.name}</span>
                      <motion.button
                        className="btn btn-destructive"
                        onClick={() => deleteExercise(i)}
                        whileTap={{ scale: 0.97 }}
                      >
                        {isY2K ? '[ Remove ]' : 'Remove'}
                      </motion.button>
                    </div>

                    <table className="wl-sets-table">
                      <thead>
                        <tr>
                          <th>Set</th>
                          <th>Weight (lbs)</th>
                          <th>Reps</th>
                          <th>Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ex.sets.map((set, j) => (
                          <tr key={j}>
                            <td className="wl-set-num">{j + 1}</td>
                            <td><input type="number" className="input wl-set-input" value={set.weight} onChange={(e) => handleSetChange(i, j, 'weight', e.target.value)} /></td>
                            <td><input type="number" className="input wl-set-input" value={set.reps}   onChange={(e) => handleSetChange(i, j, 'reps',   e.target.value)} /></td>
                            <td><input type="text"   className="input wl-set-input" value={set.notes}  onChange={(e) => handleSetChange(i, j, 'notes',  e.target.value)} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    <motion.button className="btn btn-primary wl-add-set" onClick={() => addSet(i)} whileTap={{ scale: 0.97 }}>
                      {isY2K ? '[ + Add Set ]' : '+ Add Set'}
                    </motion.button>
                  </motion.div>
                ))}

                {/* Add exercise row — placed after exercises so user doesn't scroll back up */}
                <div className="wl-adder">
                  <input
                    type="text"
                    className="input"
                    value={newExercise}
                    onChange={(e) => setNewExercise(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addExercise()}
                    placeholder="Add an exercise…"
                  />
                  <motion.button className="btn btn-primary" onClick={addExercise} whileTap={{ scale: 0.97 }}>
                    {isY2K ? '[ Add ]' : 'Add'}
                  </motion.button>
                </div>

                {/* Feedback message */}
                {message && <p className="wl-message">{message}</p>}

                {/* Save / Cancel row */}
                <div className="wl-save-row">
                  {isY2K && (
                    <motion.button
                      className="btn wl-y2k-cancel-btn"
                      onClick={() => { setFormOpen(false); setEditingWorkoutId(null); }}
                      whileTap={{ scale: 0.97 }}
                    >
                      [ Cancel ]
                    </motion.button>
                  )}
                  <motion.button className="btn btn-primary" onClick={saveWorkout} whileTap={{ scale: 0.97 }}>
                    {isY2K
                      ? (editingWorkoutId ? '[ Update Workout ]' : '[ Save Workout ]')
                      : (editingWorkoutId ? 'Update Workout' : 'Save Workout')}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* ── TABS: HISTORY / TEMPLATES ── */}
      <div className="wl-tabs">
        <button
          className={`wl-tabs__tab ${historyTab === 'history' ? 'wl-tabs__tab--active' : ''}`}
          onClick={() => setHistoryTab('history')}
        >
          History
        </button>
        <button
          className={`wl-tabs__tab ${historyTab === 'templates' ? 'wl-tabs__tab--active' : ''}`}
          onClick={() => setHistoryTab('templates')}
        >
          Templates
        </button>
      </div>

      {/* ── HISTORY TAB ── */}
      {historyTab === 'history' && (
        <>
          {workoutHistory.length === 0 && (
            isY2K ? (
              <div className="wl-y2k-empty">
                <div className="wl-y2k-empty__icon">
                  <Dumbbell size={32} stroke="#334466" strokeWidth={1.5} fill="none" />
                </div>
                <span className="wl-y2k-empty__primary">NO WORKOUTS LOGGED</span>
                <span className="wl-y2k-empty__secondary">Click [ + New workout ] to log your first session.</span>
                <span className="wl-y2k-empty__deco">--- [ MacroVault Workout Tracker ] ---</span>
              </div>
            ) : (
              <p className="wl-empty">No workouts logged yet.</p>
            )
          )}

          <div className={`wl-history-list ${isY2K ? 'wl-history-list--y2k' : ''}`}>
            {workoutHistory.map((workout, idx) => {
              const isSavedAsTemplate = !!templateNameMap[workout.workout_name];

              return (
                <React.Fragment key={workout.id}>
                  <motion.div
                    className={`wl-history-row ${isY2K ? (idx % 2 === 0 ? 'wl-history-row--y2k-odd' : 'wl-history-row--y2k-even') : ''}`}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: idx * 0.04, ease: 'easeOut' }}
                    whileHover={isY2K ? undefined : { scale: 1.01 }}
                    onClick={() => toggleExpand(workout.id)}
                  >
                    <div className="wl-history-row__left">
                      {isY2K && (
                        <div className="wl-y2k-row-icon">
                          <Dumbbell size={14} stroke="var(--accent-light)" strokeWidth={1.5} fill="none" />
                        </div>
                      )}
                      <div className="wl-history-row__text">
                        <span className="wl-history-name" style={isSpectrum ? { color: '#5DCAA5' } : undefined}>{workout.workout_name}</span>
                        <span className="wl-history-date">{formatDate(workout.workout_date)}</span>
                      </div>
                    </div>
                    <div className="wl-history-row__right">
                      {(workout.exercises || []).length > 0 && (
                        <span className={`wl-exercise-count ${isY2K ? 'wl-exercise-count--y2k' : ''}`}>
                          {isY2K ? `[${workout.exercises.length}] exercise${workout.exercises.length !== 1 ? 's' : ''}` : `${workout.exercises.length} exercise${workout.exercises.length !== 1 ? 's' : ''}`}
                        </span>
                      )}
                      <motion.button
                        className={`btn btn-primary wl-btn-sm ${isY2K ? 'wl-btn-sm--y2k-edit' : ''}`}
                        onClick={(e) => { e.stopPropagation(); editWorkout(workout); }}
                        whileTap={{ scale: 0.97 }}
                        style={isSpectrum ? { border: '1px solid #1D9E75', color: '#5DCAA5' } : undefined}
                      >
                        {isY2K ? '[ Edit ]' : 'Edit'}
                      </motion.button>

                      {/* Save / unsave template */}
                      <motion.button
                        className={`wl-btn-sm wl-btn-icon wl-btn-template ${isSavedAsTemplate ? 'wl-btn-template--saved' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isSavedAsTemplate) {
                            removeTemplateByName(workout.workout_name);
                          } else {
                            setTemplateName(workout.workout_name);
                            setSaveTemplatePopover(saveTemplatePopover === workout.id ? null : workout.id);
                          }
                        }}
                        whileTap={{ scale: 0.97 }}
                        title={isSavedAsTemplate ? 'Saved as template' : 'Save as template'}
                      >
                        {isSavedAsTemplate ? <BookmarkCheck size={14} /> : <Bookmark size={14} />}
                      </motion.button>

                      {/* Copy to today */}
                      <motion.button
                        className="wl-btn-sm wl-btn-icon wl-btn-copy"
                        onClick={(e) => {
                          e.stopPropagation();
                          setCopyDate(new Date().toISOString().split('T')[0]);
                          setCopyPopover(copyPopover === workout.id ? null : workout.id);
                        }}
                        whileTap={{ scale: 0.97 }}
                        title="Log again today"
                      >
                        <Copy size={14} />
                      </motion.button>

                      <motion.button
                        className={`btn btn-destructive wl-btn-sm wl-btn-icon ${isY2K ? 'wl-btn-sm--y2k-delete' : ''}`}
                        onClick={(e) => { e.stopPropagation(); deleteWorkout(workout.id); }}
                        whileTap={{ scale: 0.97 }}
                        title="Delete workout"
                      >
                        <Trash2 size={14} />
                      </motion.button>
                    </div>
                  </motion.div>

                  {/* Save template popover */}
                  <AnimatePresence>
                    {saveTemplatePopover === workout.id && (
                      <motion.div
                        className="wl-popover"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <div className="wl-popover__inner">
                          <label className="wl-popover__label">Template name</label>
                          <input
                            type="text"
                            className="input wl-popover__input"
                            value={templateName}
                            onChange={(e) => setTemplateName(e.target.value)}
                            placeholder={workout.workout_name}
                            autoFocus
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); saveAsTemplate(workout); } }}
                          />
                          <div className="wl-popover__btns">
                            <button className="wl-popover__btn wl-popover__btn--save" onClick={(e) => { e.stopPropagation(); saveAsTemplate(workout); }}>
                              Save template
                            </button>
                            <button className="wl-popover__btn wl-popover__btn--cancel" onClick={(e) => { e.stopPropagation(); setSaveTemplatePopover(null); }}>
                              Cancel
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Copy popover */}
                  <AnimatePresence>
                    {copyPopover === workout.id && (
                      <motion.div
                        className="wl-popover"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <div className="wl-popover__inner">
                          <p className="wl-popover__title">Log <strong>{workout.workout_name}</strong> again?</p>
                          <label className="wl-popover__label">Date</label>
                          <input
                            type="date"
                            className="input wl-popover__input"
                            value={copyDate}
                            onChange={(e) => setCopyDate(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <div className="wl-popover__btns">
                            <button className="wl-popover__btn wl-popover__btn--save" onClick={(e) => { e.stopPropagation(); copyWorkoutToDate(workout); }}>
                              Yes, log it
                            </button>
                            <button className="wl-popover__btn wl-popover__btn--cancel" onClick={(e) => { e.stopPropagation(); setCopyPopover(null); }}>
                              Cancel
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Expanded exercise detail */}
                  <AnimatePresence>
                    {expanded[workout.id] && (
                      <motion.div
                        className="wl-exercise-detail"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.25 }}
                      >
                        {workout.exercises?.map((ex, exIdx) => (
                          <div key={exIdx} className="history-exercise">
                            <h4>{ex.name}</h4>
                            <table>
                              <thead><tr><th>Set</th><th>Weight</th><th>Reps</th><th>Notes</th></tr></thead>
                              <tbody>
                                {ex.sets.map((set, j) => (
                                  <tr key={j}>
                                    <td>{j + 1}</td><td>{set.weight}</td><td>{set.reps}</td><td>{set.notes}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </React.Fragment>
              );
            })}
          </div>
        </>
      )}

      {/* ── TEMPLATES TAB ── */}
      {historyTab === 'templates' && (
        <>
          {templates.length === 0 ? (
            <div className="wl-templates-empty">
              <BookmarkPlus size={32} style={{ color: 'var(--border-light, #444)' }} />
              <h4 className="wl-templates-empty__title">No templates yet</h4>
              <p className="wl-templates-empty__desc">
                Save any workout from your history as a template to reuse it in one tap.
              </p>
              <p className="wl-templates-empty__hint">
                Click the <Bookmark size={12} style={{ verticalAlign: '-2px' }} /> bookmark icon on any workout in History to save it as a template.
              </p>
            </div>
          ) : (
            <div className="wl-template-list">
              {templates.map((tpl, idx) => (
                <motion.div
                  key={tpl.id}
                  className="wl-tpl-row"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: idx * 0.04 }}
                >
                  <div className="wl-tpl-row__icon">
                    <Dumbbell size={18} />
                  </div>
                  <div className="wl-tpl-row__info">
                    <span className="wl-tpl-row__name">{tpl.name}</span>
                    <span className="wl-tpl-row__meta">
                      {(tpl.exercises || []).length} exercise{(tpl.exercises || []).length !== 1 ? 's' : ''}
                      {tpl.muscle_group ? ` · ${tpl.muscle_group}` : ''}
                      {tpl.use_count > 0 ? ` · Used ${tpl.use_count} time${tpl.use_count !== 1 ? 's' : ''}` : ''}
                    </span>
                    {tpl.use_count > 5 && (
                      <span className="wl-tpl-row__badge"><Star size={10} /> Most used</span>
                    )}
                  </div>
                  <div className="wl-tpl-row__actions">
                    <motion.button
                      className="wl-tpl-row__use-btn"
                      onClick={() => loadTemplate(tpl)}
                      whileTap={{ scale: 0.97 }}
                    >
                      Use template
                    </motion.button>
                    <motion.button
                      className="wl-tpl-row__action-btn"
                      onClick={() => deleteTemplate(tpl.id)}
                      whileTap={{ scale: 0.97 }}
                      title="Delete template"
                    >
                      <Trash2 size={14} />
                    </motion.button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </>
      )}
      </div>{/* end .wl-desktop */}

      {/* ═══════════ MOBILE ═══════════ */}
      <div className="wl-mobile">

        {/* ── MOBILE HOME ── */}
        {mobileView === 'home' && (
          <div className="wlm-home">
            {/* Quick Start */}
            <motion.button
              className="wlm-quick-start"
              onClick={startBlankSession}
              whileTap={{ scale: 0.97 }}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
            >
              <div className="wlm-quick-start__icon"><Play size={20} /></div>
              <div className="wlm-quick-start__text">
                <span className="wlm-quick-start__title">Quick Start</span>
                <span className="wlm-quick-start__sub">Start an empty workout</span>
              </div>
              <ChevronRight size={18} className="wlm-quick-start__arrow" />
            </motion.button>

            {/* Free tier usage */}
            {!isPro && workoutHistory.length > 0 && (
              <div className="wlm-usage-bar">
                <div className="wlm-usage-bar__track">
                  <div
                    className="wlm-usage-bar__fill"
                    style={{ width: `${Math.min((workoutHistory.length / 10) * 100, 100)}%` }}
                  />
                </div>
                <span className="wlm-usage-bar__text">
                  {workoutHistory.length} / 10 free workouts
                </span>
              </div>
            )}

            {/* Templates */}
            {templates.length > 0 && (
              <motion.div
                className="wlm-section"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: 0.05 }}
              >
                <h3 className="wlm-section__title">Templates</h3>
                <div className="wlm-template-grid">
                  {templates.map((tpl) => (
                    <motion.button
                      key={tpl.id}
                      className="wlm-template-card"
                      onClick={() => setTemplatePreview(tpl)}
                      whileTap={{ scale: 0.97 }}
                    >
                      <div className="wlm-template-card__icon"><Dumbbell size={16} /></div>
                      <span className="wlm-template-card__name">{tpl.name}</span>
                      <span className="wlm-template-card__meta">
                        {(tpl.exercises || []).length} exercise{(tpl.exercises || []).length !== 1 ? 's' : ''}
                        {tpl.muscle_group ? ` · ${tpl.muscle_group}` : ''}
                      </span>
                      {tpl.use_count >= 5 && (
                        <span className="wlm-template-card__badge"><Star size={9} /> Favorite</span>
                      )}
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Recent Workouts */}
            <motion.div
              className="wlm-section"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: 0.1 }}
            >
              <h3 className="wlm-section__title">Recent Workouts</h3>
              {workoutHistory.length === 0 ? (
                <p className="wlm-empty">No workouts yet. Tap Quick Start to begin!</p>
              ) : (
                <div className="wlm-recent-list">
                  {workoutHistory.slice(0, 8).map((w, idx) => (
                    <React.Fragment key={w.id}>
                      <motion.div
                        className="wlm-recent-row"
                        onClick={() => setMobileExpanded((p) => ({ ...p, [w.id]: !p[w.id] }))}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: idx * 0.03 }}
                      >
                        <div className="wlm-recent-row__left">
                          <span className="wlm-recent-row__name">{w.workout_name}</span>
                          <span className="wlm-recent-row__date">
                            {formatDate(w.workout_date)}
                            {w.muscle_group ? ` · ${w.muscle_group}` : ''}
                          </span>
                        </div>
                        <span className="wlm-recent-row__count">
                          {(w.exercises || []).length} ex
                        </span>
                      </motion.div>
                      <AnimatePresence>
                        {mobileExpanded[w.id] && (
                          <motion.div
                            className="wlm-recent-detail"
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            {(w.exercises || []).map((ex, exIdx) => (
                              <div key={exIdx} className="wlm-recent-detail__exercise">
                                <span className="wlm-recent-detail__name">{ex.name}</span>
                                <span className="wlm-recent-detail__sets">
                                  {(ex.sets || []).length} set{(ex.sets || []).length !== 1 ? 's' : ''}
                                  {ex.sets?.[0]?.weight ? ` @ ${ex.sets[0].weight} lbs` : ''}
                                </span>
                              </div>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </React.Fragment>
                  ))}
                </div>
              )}
            </motion.div>
          </div>
        )}

        {/* ── TEMPLATE PREVIEW SHEET ── */}
        <AnimatePresence>
          {templatePreview && (
            <motion.div
              className="wlm-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setTemplatePreview(null)}
            >
              <motion.div
                className="wlm-sheet"
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 28, stiffness: 320 }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="wlm-sheet__handle" />
                <div className="wlm-sheet__header">
                  <div>
                    <h3 className="wlm-sheet__title">{templatePreview.name}</h3>
                    <div className="wlm-sheet__meta">
                      {templatePreview.muscle_group && <span>{templatePreview.muscle_group}</span>}
                      <span>{(templatePreview.exercises || []).length} exercises</span>
                      {templatePreview.use_count > 0 && <span>Used {templatePreview.use_count}x</span>}
                    </div>
                  </div>
                  <button className="wlm-sheet__close" onClick={() => setTemplatePreview(null)}>
                    <X size={20} />
                  </button>
                </div>
                <div className="wlm-sheet__exercises">
                  {(templatePreview.exercises || []).map((ex, i) => (
                    <div key={i} className="wlm-sheet__exercise">
                      <span className="wlm-sheet__exercise-name">{ex.name}</span>
                      <span className="wlm-sheet__exercise-detail">
                        {ex.sets || 3} sets{ex.reps ? ` × ${ex.reps}` : ''}
                        {ex.weight ? ` @ ${ex.weight} lbs` : ''}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="wlm-sheet__footer">
                  <motion.button
                    className="wlm-sheet__start-btn"
                    onClick={() => startSessionFromTemplate(templatePreview)}
                    whileTap={{ scale: 0.97 }}
                  >
                    <Play size={16} /> Start Workout
                  </motion.button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── ACTIVE SESSION ── */}
        {mobileView === 'session' && (
          <div className="wlm-session">
            {/* Session header bar */}
            <div className="wlm-session__header">
              <div className="wlm-session__timer">
                <Clock size={14} />
                <span>{formatDuration(sessionTimer)}</span>
              </div>
              <input
                className="wlm-session__name-input"
                value={sessionName}
                onChange={(e) => setSessionName(e.target.value)}
                onFocus={handleInputFocus}
                onKeyDown={handleInputKeyDown}
                placeholder="Workout name…"
              />
              <motion.button
                className="wlm-session__finish-btn"
                onClick={finishSession}
                whileTap={{ scale: 0.97 }}
              >
                Finish
              </motion.button>
            </div>

            {/* Muscle group pills */}
            <div className="wlm-session__mg-row">
              {MUSCLE_GROUPS.map((g) => (
                <button
                  key={g}
                  className={`wlm-mg-pill ${sessionMuscleGroup === g ? 'wlm-mg-pill--active' : ''}`}
                  onClick={() => setSessionMuscleGroup(sessionMuscleGroup === g ? '' : g)}
                >
                  {g}
                </button>
              ))}
            </div>

            {/* Exercise blocks */}
            <div className="wlm-session__body" onClick={dismissKeyboard}>
              {sessionExercises.length === 0 && (
                <div className="wlm-session__empty">
                  <Dumbbell size={28} style={{ color: 'var(--text-muted)', opacity: 0.4 }} />
                  <p>Tap "Add Exercise" to get started</p>
                </div>
              )}
              {sessionExercises.map((ex, exIdx) => (
                <motion.div
                  key={exIdx}
                  className="wlm-ex-block"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="wlm-ex-block__header">
                    <span className="wlm-ex-block__name">{ex.name}</span>
                    <button className="wlm-ex-block__remove" onClick={() => removeSessionExercise(exIdx)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div className="wlm-ex-block__table">
                    <div className="wlm-ex-block__thead">
                      <span className="wlm-ex-col wlm-ex-col--set">SET</span>
                      <span className="wlm-ex-col wlm-ex-col--weight">LBS</span>
                      <span className="wlm-ex-col wlm-ex-col--reps">REPS</span>
                      <span className="wlm-ex-col wlm-ex-col--check" />
                    </div>
                    {ex.sets.map((set, setIdx) => {
                      const isDone = !!completedSets[`${exIdx}-${setIdx}`];
                      return (
                        <div key={setIdx} className={`wlm-ex-row ${isDone ? 'wlm-ex-row--done' : ''}`}>
                          <span className="wlm-ex-col wlm-ex-col--set">{setIdx + 1}</span>
                          <input
                            type="number"
                            inputMode="decimal"
                            className="wlm-ex-input"
                            value={set.weight}
                            onChange={(e) => updateSessionSet(exIdx, setIdx, 'weight', e.target.value)}
                            onFocus={handleInputFocus}
                            onKeyDown={handleInputKeyDown}
                            placeholder="—"
                          />
                          <input
                            type="number"
                            inputMode="numeric"
                            className="wlm-ex-input"
                            value={set.reps}
                            onChange={(e) => updateSessionSet(exIdx, setIdx, 'reps', e.target.value)}
                            onFocus={handleInputFocus}
                            onKeyDown={handleInputKeyDown}
                            placeholder="—"
                          />
                          <button
                            className={`wlm-check-btn ${isDone ? 'wlm-check-btn--done' : ''}`}
                            onClick={() => toggleSetComplete(exIdx, setIdx)}
                          >
                            <Check size={16} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  <button className="wlm-ex-block__add-set" onClick={() => addSetToSession(exIdx)}>
                    + Add Set
                  </button>
                </motion.div>
              ))}

              {/* Add Exercise button */}
              <motion.button
                className="wlm-add-exercise-btn"
                onClick={() => { setExerciseSearchOpen(true); setExerciseSearchQuery(''); setExerciseBodyPartFilter('all'); }}
                whileTap={{ scale: 0.97 }}
              >
                <Plus size={18} /> Add Exercise
              </motion.button>

              {/* Discard button */}
              <button className="wlm-discard-btn" onClick={discardSession}>
                Discard Workout
              </button>
            </div>

          </div>
        )}

        {/* ── EXERCISE SEARCH SHEET ── */}
        <AnimatePresence>
          {exerciseSearchOpen && (
            <motion.div
              className="wlm-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className="wlm-search"
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              >
                <div className="wlm-search__header">
                  <h3>Add Exercise</h3>
                  <button onClick={() => setExerciseSearchOpen(false)}><X size={20} /></button>
                </div>
                <div className="wlm-search__input-row">
                  <Search size={16} />
                  <input
                    type="text"
                    value={exerciseSearchQuery}
                    onChange={(e) => setExerciseSearchQuery(e.target.value)}
                    onFocus={handleInputFocus}
                    onKeyDown={handleInputKeyDown}
                    placeholder="Search exercises…"
                    autoFocus
                  />
                </div>
                <div className="wlm-search__filters">
                  {bodyParts.map((bp) => (
                    <button
                      key={bp}
                      className={`wlm-bp-pill ${exerciseBodyPartFilter === bp ? 'wlm-bp-pill--active' : ''}`}
                      onClick={() => setExerciseBodyPartFilter(bp)}
                    >
                      {bp === 'all' ? 'All' : bp.charAt(0).toUpperCase() + bp.slice(1)}
                    </button>
                  ))}
                </div>
                <div className="wlm-search__list">
                  {Object.keys(groupedExercises).sort().map((letter) => (
                    <div key={letter} className="wlm-letter-group">
                      <div className="wlm-letter-group__label">{letter}</div>
                      {groupedExercises[letter].map((ex) => (
                        <button
                          key={ex.id}
                          className="wlm-exercise-item"
                          onClick={() => addExerciseToSession(ex)}
                        >
                          <div className="wlm-exercise-item__info">
                            <span className="wlm-exercise-item__name">{ex.name}</span>
                            <span className="wlm-exercise-item__meta">{ex.targetMuscle} · {ex.equipment}</span>
                          </div>
                          <Plus size={16} className="wlm-exercise-item__add" />
                        </button>
                      ))}
                    </div>
                  ))}
                  {filteredExercises.length === 0 && (
                    <p className="wlm-search__empty-msg">No exercises found</p>
                  )}
                </div>
                {/* Custom exercise fallback */}
                {exerciseSearchQuery.trim() && (
                  <div className="wlm-search__custom">
                    <button
                      className="wlm-search__custom-btn"
                      onClick={() => addExerciseToSession({ name: exerciseSearchQuery.trim() })}
                    >
                      <Plus size={14} /> Add "{exerciseSearchQuery.trim()}" as custom exercise
                    </button>
                  </div>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>{/* end .wl-mobile */}

    </div>
  );
}

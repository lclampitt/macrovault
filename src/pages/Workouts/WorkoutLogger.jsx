import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, Reorder, useDragControls } from 'framer-motion';
import {
  Lock, Trash2, Dumbbell, Bookmark, BookmarkCheck, Copy,
  BookmarkPlus, X, Star, Play, Clock, Search, Check, Plus, ChevronRight, ChevronLeft,
  GripVertical,
} from 'lucide-react';
import posthog from '../../lib/posthog';
import { supabase } from '../../supabaseClient';
import { useUpgrade } from '../../context/UpgradeContext';
import { usePlan } from '../../hooks/usePlan';
import { useTheme } from '../../hooks/useTheme';
import { appToast as toast } from '../../utils/toast';
import exerciseDB from '../../data/exercises.json';
import '../../styles/WorkoutLogger.css';

/* Unique id generator for session exercises. Used to give each row a
   stable identity so drag-to-reorder can remap per-exercise state
   (completedSets) without relying on mutable array indexes. */
let _exUidCounter = 0;
const newExId = () => `ex-${Date.now()}-${++_exUidCounter}`;

/**
 * One exercise card rendered as a Framer Motion Reorder.Item. Drag is
 * gated to the grip handle via `dragListener={false}` + useDragControls
 * so tapping the weight/reps inputs never starts a drag.
 */
function ReorderableExerciseBlock({
  ex,
  exIdx,
  completedSets,
  updateSessionSet,
  toggleSetComplete,
  addSetToSession,
  removeSessionExercise,
  handleInputFocus,
  handleInputKeyDown,
}) {
  const controls = useDragControls();
  return (
    <Reorder.Item
      value={ex}
      dragListener={false}
      dragControls={controls}
      as="div"
      className="wlm-ex-block"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div className="wlm-ex-block__header">
        <button
          type="button"
          className="wlm-ex-block__drag"
          aria-label="Drag to reorder"
          onPointerDown={(e) => controls.start(e)}
          /* Touch-action none prevents iOS scrolling while the user
             long-presses the handle. */
          style={{ touchAction: 'none' }}
        >
          <GripVertical size={16} />
        </button>
        <span className="wlm-ex-block__name">{ex.name}</span>
        <button
          type="button"
          className="wlm-ex-block__remove"
          onClick={() => removeSessionExercise(exIdx)}
        >
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
                type="button"
                className={`wlm-check-btn ${isDone ? 'wlm-check-btn--done' : ''}`}
                onClick={() => toggleSetComplete(exIdx, setIdx)}
              >
                <Check size={16} />
              </button>
            </div>
          );
        })}
      </div>
      <button
        type="button"
        className="wlm-ex-block__add-set"
        onClick={() => addSetToSession(exIdx)}
      >
        + Add Set
      </button>
    </Reorder.Item>
  );
}

const API_BASE = process.env.REACT_APP_API_BASE || 'https://gainlytics-1.onrender.com';


/* Format date string: "2025-12-12" → "Dec 12, 2025" */
function formatDate(dateStr = '') {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/* Get today's date in LOCAL timezone as YYYY-MM-DD (avoids UTC off-by-one) */
function getLocalDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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
  const [workoutDate, setWorkoutDate] = useState(getLocalDateString());
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
  const [copyDate, setCopyDate] = useState(getLocalDateString());
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
  const [sessionOriginalTemplate, setSessionOriginalTemplate] = useState(null);
  const [templateUpdateSheet, setTemplateUpdateSheet] = useState(null); // { templateId, templateName, changes, exerciseData }
  const [saveNewTplMode, setSaveNewTplMode] = useState(false);
  const [saveNewTplName, setSaveNewTplName] = useState('');
  const [isFinishing, setIsFinishing] = useState(false);
  const finishInFlight = useRef(false);
  const [saveNewTplError, setSaveNewTplError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [workoutDetailSheet, setWorkoutDetailSheet] = useState(null);

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
      sets: (ex.sets || []).map((s, idx) => ({
        set_number: idx + 1,
        weight: s.weight || '',
        reps: s.reps || '',
      })),
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
      sets: Array.isArray(ex.sets)
        ? ex.sets.map((s) => ({ weight: s.weight || '', reps: s.reps || '', notes: '' }))
        : Array.from({ length: ex.sets || 3 }, () => ({ weight: ex.weight || '', reps: ex.reps || '', notes: '' })),
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
      sets: (ex.sets || []).map((s, idx) => ({
        set_number: idx + 1,
        weight: s.weight || '',
        reps: s.reps || '',
      })),
    }));
    await supabase
      .from('workout_templates')
      .update({ exercises: exerciseData, updated_at: new Date().toISOString() })
      .eq('id', templateId);
  };

  // Detect changes between finished workout and original template
  const detectTemplateChanges = (finishedExercises, originalTemplate) => {
    if (!originalTemplate?.exercises) return [];
    const changes = [];
    const templateExs = originalTemplate.exercises;
    const finishedNames = finishedExercises.map((e) => e.name);
    const templateNames = templateExs.map((e) => e.name);

    // Exercises added
    finishedNames.forEach((name) => {
      if (!templateNames.includes(name)) changes.push({ type: 'added', name });
    });
    // Exercises removed
    templateNames.forEach((name) => {
      if (!finishedNames.includes(name)) changes.push({ type: 'removed', name });
    });
    // Weight/rep changes
    finishedExercises.forEach((fEx) => {
      const tEx = templateExs.find((t) => t.name === fEx.name);
      if (!tEx) return;
      const tSets = Array.isArray(tEx.sets) ? tEx.sets : [];
      (fEx.sets || []).forEach((s, si) => {
        const ts = tSets[si];
        if (!ts) return;
        if (String(s.weight || '') !== String(ts.weight || '') || String(s.reps || '') !== String(ts.reps || '')) {
          changes.push({
            type: 'changed',
            name: fEx.name,
            set: si + 1,
            from: { weight: ts.weight || '—', reps: ts.reps || '—' },
            to: { weight: s.weight || '—', reps: s.reps || '—' },
          });
        }
      });
      // Extra sets added
      if ((fEx.sets || []).length > tSets.length) {
        changes.push({ type: 'sets_added', name: fEx.name, count: (fEx.sets || []).length - tSets.length });
      }
    });
    return changes;
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

  /* Lock page scroll while the exercise-search sheet is open so the
     sheet opens at the top (not scrolled to wherever the session was
     scrolled). We also scroll the window to 0 so iOS reveals the
     fresh sheet's search bar instead of the page's prior position. */
  useEffect(() => {
    if (!exerciseSearchOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.scrollTo(0, 0);
    return () => {
      document.body.style.overflow = prev;
    };
  }, [exerciseSearchOpen]);

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
      _id: newExId(),
      name: ex.name,
      sets: Array.isArray(ex.sets)
        ? ex.sets.map((s) => ({ weight: s.weight || '', reps: s.reps || '', notes: '' }))
        : Array.from({ length: ex.sets || 3 }, () => ({ weight: ex.weight || '', reps: ex.reps || '', notes: '' })),
    }));
    setSessionExercises(exs);
    setSessionName(template.name);
    setSessionMuscleGroup(template.muscle_group || '');
    setCompletedSets({});
    setSessionStartTime(Date.now());
    setSessionTimer(0);
    setSessionFromTemplateId(template.id);
    setSessionOriginalTemplate(template);
    setTemplatePreview(null);
    setMobileView('session');
  };

  const addExerciseToSession = (exercise) => {
    setSessionExercises((prev) => [
      ...prev,
      { _id: newExId(), name: exercise.name, sets: [{ weight: '', reps: '', notes: '' }] },
    ]);
    setExerciseSearchOpen(false);
    setExerciseSearchQuery('');
  };

  /* Drag-to-reorder handler. Because completedSets is keyed by the
     old exercise index (`${exIdx}-${setIdx}`), we remap those keys to
     the new indexes using each row's stable `_id`. */
  const handleReorderExercises = (newOrder) => {
    const newIndexById = new Map(newOrder.map((ex, i) => [ex._id, i]));
    setCompletedSets((prev) => {
      const remapped = {};
      Object.entries(prev).forEach(([key, val]) => {
        const [ei, si] = key.split('-').map(Number);
        const oldEx = sessionExercises[ei];
        if (!oldEx) return;
        const newEi = newIndexById.get(oldEx._id);
        if (newEi != null) remapped[`${newEi}-${si}`] = val;
      });
      return remapped;
    });
    setSessionExercises(newOrder);
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
    /* iOS quirk: when an input is focused (weight/reps), tapping the
       Finish button blurs the input, dismisses the keyboard, and the
       resulting reflow can cancel the synthetic click. We also guard
       via a ref+state so double-taps and the simultaneous
       onTouchEnd+onClick wiring can't submit twice. */
    if (finishInFlight.current) return;
    if (sessionExercises.length === 0) {
      toast.error('Add at least one exercise before finishing.');
      return;
    }
    finishInFlight.current = true;
    setIsFinishing(true);
    // Blur any focused input so iOS dismisses the keyboard predictably
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    const name = sessionName.trim() || 'Quick Workout';
    const duration = sessionTimer;
    const workoutData = {
      user_id: userId,
      workout_date: getLocalDateString(),
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
      if (res.status === 403) { triggerUpgrade('workouts'); finishInFlight.current = false; setIsFinishing(false); return; }
      if (!res.ok) throw new Error(await res.text());
      posthog.capture('workout_logged', { exercise_count: sessionExercises.length, duration_seconds: duration });

      // Template update logic
      if (sessionFromTemplateId && sessionOriginalTemplate) {
        incrementTemplateUseCount(sessionFromTemplateId);
        const templatePref = localStorage.getItem('template_auto_update') || 'ask';
        const changes = detectTemplateChanges(sessionExercises, sessionOriginalTemplate);

        if (changes.length > 0 && templatePref === 'always') {
          updateTemplateWeights(sessionFromTemplateId, sessionExercises);
          toast.success('Template updated automatically');
          fetchTemplates();
        } else if (changes.length > 0 && templatePref === 'ask') {
          const exerciseData = sessionExercises.map((ex) => ({
            name: ex.name,
            sets: (ex.sets || []).map((s, idx) => ({
              set_number: idx + 1,
              weight: s.weight || '',
              reps: s.reps || '',
            })),
          }));
          setTemplateUpdateSheet({
            templateId: sessionFromTemplateId,
            templateName: sessionOriginalTemplate.name,
            changes,
            exerciseData,
          });
          fetchTemplates();
        } else {
          fetchTemplates();
        }
      }

      toast.success(`${name} saved! ${formatDuration(duration)}`);
      setMobileView('home');
      setSessionStartTime(null);
      setSessionOriginalTemplate(null);
      fetchWorkouts();
    } catch (err) {
      toast.error(`Error: ${err.message}`);
    } finally {
      finishInFlight.current = false;
      setIsFinishing(false);
    }
  };

  const discardSession = () => {
    if (sessionExercises.length > 0 && !window.confirm('Discard this workout?')) return;
    setMobileView('home');
    setSessionStartTime(null);
    setSessionExercises([]);
    setCompletedSets({});
    setSessionOriginalTemplate(null);
  };

  const handleConfirmDelete = async () => {
    if (!confirmDelete) return;
    if (confirmDelete.type === 'template') {
      await deleteTemplate(confirmDelete.id);
      if (templatePreview?.id === confirmDelete.id) setTemplatePreview(null);
      toast.success(`${confirmDelete.name} deleted`);
    } else {
      await deleteWorkout(confirmDelete.id);
      if (workoutDetailSheet?.id === confirmDelete.id) setWorkoutDetailSheet(null);
      toast.success('Workout deleted');
    }
    setConfirmDelete(null);
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

  const WORKOUT_LIMIT = 7;
  const atLimit = !isPro && workoutHistory.length >= WORKOUT_LIMIT;
  const nearLimit = !isPro && workoutHistory.length >= 5 && workoutHistory.length < WORKOUT_LIMIT;

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
                width: `${Math.min((workoutHistory.length / WORKOUT_LIMIT) * 100, 100)}%`,
                background: nearLimit || atLimit
                  ? 'linear-gradient(180deg, #FFD700, #CC9900)'
                  : `linear-gradient(180deg, var(--accent-light), var(--accent))`,
              }}
            />
          </div>
          <span className={`wl-y2k-usage__text ${nearLimit || atLimit ? 'wl-y2k-usage__text--warn' : ''}`}>
            {nearLimit || atLimit
              ? `WARNING: [${workoutHistory.length}] / ${WORKOUT_LIMIT} logs used. Upgrade to Pro for unlimited.`
              : `[${workoutHistory.length}] / ${WORKOUT_LIMIT} free workout logs used`}
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
                color: nearLimit || atLimit ? '#EF9F27' : 'var(--text-muted)',
                margin: '2px 0 0',
              }}>
                {workoutHistory.length} / {WORKOUT_LIMIT} free workout logs used
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
                You've reached {WORKOUT_LIMIT} workout logs on the free plan.
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
                          setCopyDate(getLocalDateString());
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
            {atLimit ? (
              <motion.button
                className="wlm-quick-start wlm-quick-start--locked"
                onClick={() => triggerUpgrade('workouts')}
                whileTap={{ scale: 0.97 }}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
              >
                <div className="wlm-quick-start__icon wlm-quick-start__icon--locked"><Lock size={20} /></div>
                <div className="wlm-quick-start__text">
                  <span className="wlm-quick-start__title">Upgrade to Pro</span>
                  <span className="wlm-quick-start__sub">Unlock unlimited workout logging</span>
                </div>
                <ChevronRight size={18} className="wlm-quick-start__arrow" />
              </motion.button>
            ) : (
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
            )}

            {/* Free tier usage counter */}
            {!isPro && workoutHistory.length > 0 && (
              <div className={`wlm-usage-banner${nearLimit ? ' wlm-usage-banner--warn' : ''}${atLimit ? ' wlm-usage-banner--locked' : ''}`}>
                <div className="wlm-usage-banner__top">
                  <span className="wlm-usage-banner__count">
                    {atLimit ? (
                      <><Lock size={12} /> Limit reached</>
                    ) : (
                      <>{workoutHistory.length} / {WORKOUT_LIMIT} free workouts</>
                    )}
                  </span>
                  {(nearLimit || atLimit) && (
                    <button className="wlm-usage-banner__upgrade" onClick={() => triggerUpgrade('workouts')}>
                      Upgrade
                    </button>
                  )}
                </div>
                <div className="wlm-usage-banner__track">
                  <div
                    className={`wlm-usage-banner__fill${nearLimit ? ' wlm-usage-banner__fill--warn' : ''}${atLimit ? ' wlm-usage-banner__fill--locked' : ''}`}
                    style={{ width: `${Math.min((workoutHistory.length / WORKOUT_LIMIT) * 100, 100)}%` }}
                  />
                </div>
                {atLimit && (
                  <p className="wlm-usage-banner__msg">
                    Upgrade to Pro for unlimited workout logging
                  </p>
                )}
              </div>
            )}

            {/* Templates */}
            <motion.div
              className="wlm-section"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: 0.05 }}
            >
              <h3 className="wlm-section__title">Templates</h3>
              {templates.length === 0 ? (
                <div className="wlm-empty-placeholder">
                  <BookmarkPlus size={20} className="wlm-empty-placeholder__icon" />
                  <span className="wlm-empty-placeholder__text">No templates yet — complete a workout and press Finish to save it as a template</span>
                </div>
              ) : (
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
              )}
            </motion.div>

            {/* Recent Workouts */}
            <motion.div
              className="wlm-section"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: 0.1 }}
            >
              <h3 className="wlm-section__title">Recent Workouts</h3>
              {workoutHistory.length === 0 ? (
                <div className="wlm-empty-state">
                  <Dumbbell size={28} className="wlm-empty-state__icon" />
                  <p className="wlm-empty-state__text">No workouts logged yet</p>
                  <p className="wlm-empty-state__sub">Tap Quick Start to begin</p>
                </div>
              ) : (
                <div className="wlm-recent-list">
                  {workoutHistory.slice(0, 8).map((w, idx) => (
                    <motion.div
                      key={w.id}
                      className="wlm-recent-row"
                      onClick={() => setWorkoutDetailSheet(w)}
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
                        {Array.isArray(ex.sets) ? `${ex.sets.length} sets` : `${ex.sets || 3} sets`}
                        {Array.isArray(ex.sets) && ex.sets[0]?.reps ? ` × ${ex.sets[0].reps}` : (ex.reps ? ` × ${ex.reps}` : '')}
                        {Array.isArray(ex.sets) && ex.sets[0]?.weight ? ` @ ${ex.sets[0].weight} lbs` : (ex.weight ? ` @ ${ex.weight} lbs` : '')}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="wlm-sheet__footer wlm-sheet__footer--multi">
                  <motion.button
                    className="wlm-sheet__start-btn"
                    onClick={() => startSessionFromTemplate(templatePreview)}
                    whileTap={{ scale: 0.97 }}
                  >
                    <Play size={16} /> Start Workout
                  </motion.button>
                  <motion.button
                    className="wlm-sheet__delete-btn"
                    onClick={() => setConfirmDelete({ type: 'template', id: templatePreview.id, name: templatePreview.name })}
                    whileTap={{ scale: 0.97 }}
                  >
                    <Trash2 size={16} /> Delete template
                  </motion.button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── WORKOUT DETAIL SHEET ── */}
        <AnimatePresence>
          {workoutDetailSheet && (
            <motion.div
              className="wlm-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setWorkoutDetailSheet(null)}
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
                    <h3 className="wlm-sheet__title">{workoutDetailSheet.workout_name}</h3>
                    <div className="wlm-sheet__meta">
                      <span>{formatDate(workoutDetailSheet.workout_date)}</span>
                      {workoutDetailSheet.muscle_group && <span>{workoutDetailSheet.muscle_group}</span>}
                      <span>{(workoutDetailSheet.exercises || []).length} exercises</span>
                    </div>
                  </div>
                  <button className="wlm-sheet__close" onClick={() => setWorkoutDetailSheet(null)}>
                    <X size={20} />
                  </button>
                </div>
                <div className="wlm-sheet__exercises">
                  {(workoutDetailSheet.exercises || []).map((ex, i) => (
                    <div key={i} className="wlm-sheet__exercise-block">
                      <span className="wlm-sheet__exercise-name">{ex.name}</span>
                      <div className="wlm-sheet__sets-list">
                        {(ex.sets || []).map((s, si) => (
                          <div key={si} className="wlm-sheet__set-row">
                            <span className="wlm-sheet__set-num">Set {si + 1}</span>
                            <span className="wlm-sheet__set-data">
                              {s.weight ? `${s.weight} lbs` : '—'}
                              {' × '}
                              {s.reps || '—'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="wlm-sheet__footer wlm-sheet__footer--multi">
                  <motion.button
                    className="wlm-sheet__action-btn wlm-sheet__action-btn--save"
                    onClick={() => {
                      const w = workoutDetailSheet;
                      setWorkoutDetailSheet(null);
                      setSaveTemplatePopover(w.id);
                      setTemplateName(w.workout_name);
                    }}
                    whileTap={{ scale: 0.97 }}
                  >
                    <BookmarkPlus size={16} /> Save as Template
                  </motion.button>
                  <motion.button
                    className="wlm-sheet__delete-btn"
                    onClick={() => setConfirmDelete({
                      type: 'workout',
                      id: workoutDetailSheet.id,
                      name: workoutDetailSheet.workout_name,
                      date: workoutDetailSheet.workout_date,
                    })}
                    whileTap={{ scale: 0.97 }}
                  >
                    <Trash2 size={16} /> Delete workout log
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
                type="button"
                className="wlm-session__finish-btn"
                onClick={finishSession}
                onTouchEnd={(e) => { e.preventDefault(); finishSession(); }}
                disabled={isFinishing}
                whileTap={{ scale: 0.97 }}
              >
                {isFinishing ? 'Saving…' : 'Finish'}
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
              <Reorder.Group
                axis="y"
                values={sessionExercises}
                onReorder={handleReorderExercises}
                as="div"
                className="wlm-session__ex-list"
              >
                {sessionExercises.map((ex, exIdx) => (
                  <ReorderableExerciseBlock
                    key={ex._id}
                    ex={ex}
                    exIdx={exIdx}
                    completedSets={completedSets}
                    updateSessionSet={updateSessionSet}
                    toggleSetComplete={toggleSetComplete}
                    addSetToSession={addSetToSession}
                    removeSessionExercise={removeSessionExercise}
                    handleInputFocus={handleInputFocus}
                    handleInputKeyDown={handleInputKeyDown}
                  />
                ))}
              </Reorder.Group>

              {/* Add Exercise button */}
              <motion.button
                className="wlm-add-exercise-btn"
                onClick={() => { setExerciseSearchOpen(true); setExerciseSearchQuery(''); setExerciseBodyPartFilter('all'); }}
                whileTap={{ scale: 0.97 }}
              >
                <Plus size={18} /> Add Exercise
              </motion.button>

              {/* Bottom Finish button — fires on touchend (before iOS's
                  focus-blur reflow can cancel the subsequent click) and
                  also on click for mouse/keyboard users. finishSession
                  is idempotent via the finishInFlight ref guard. */}
              <motion.button
                type="button"
                className="wlm-finish-btn-bottom"
                onClick={finishSession}
                onTouchEnd={(e) => { e.preventDefault(); finishSession(); }}
                disabled={isFinishing}
                whileTap={{ scale: 0.97 }}
              >
                {isFinishing ? 'Saving…' : 'Finish Workout'}
              </motion.button>

              {/* Discard button */}
              <button className="wlm-discard-btn" onClick={discardSession}>
                Discard Workout
              </button>
            </div>

          </div>
        )}

        {/* ── EXERCISE SEARCH SHEET ──
            Portaled to document.body so the fixed-position overlay
            escapes the app shell's transform/containing-block and
            actually covers the mobile topbar. Same pattern used for
            the meal planner slot panel. */}
        {createPortal(
        <AnimatePresence>
          {exerciseSearchOpen && (
            <motion.div
              className="wlm-overlay wlm-overlay--search"
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
                  <button
                    type="button"
                    className="wlm-search__back"
                    onClick={() => setExerciseSearchOpen(false)}
                    aria-label="Back"
                  >
                    <ChevronLeft size={24} />
                  </button>
                  <h3>Add Exercise</h3>
                  <button className="wlm-search__close" onClick={() => setExerciseSearchOpen(false)}><X size={20} /></button>
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
        </AnimatePresence>,
        document.body)}

        {/* ── TEMPLATE UPDATE SHEET ── */}
        <AnimatePresence>
          {templateUpdateSheet && (
            <motion.div
              className="wlm-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setTemplateUpdateSheet(null)}
            >
              <motion.div
                className="wlm-tpl-update-sheet"
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 28, stiffness: 320 }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="wlm-sheet__handle" />
                <div className="wlm-tpl-update__header">
                  <BookmarkCheck size={24} className="wlm-tpl-update__icon" />
                  <h3 className="wlm-tpl-update__title">Update template?</h3>
                  <p className="wlm-tpl-update__subtitle">
                    Your workout differed from the "{templateUpdateSheet.templateName}" template. Save the new values?
                  </p>
                </div>

                {/* Changes list */}
                <div className="wlm-tpl-update__changes">
                  {templateUpdateSheet.changes.slice(0, 4).map((c, i) => (
                    <div key={i} className="wlm-tpl-update__change">
                      {c.type === 'added' && (
                        <span className="wlm-tpl-update__change--add">+ {c.name} added</span>
                      )}
                      {c.type === 'removed' && (
                        <span className="wlm-tpl-update__change--remove">- {c.name} removed</span>
                      )}
                      {c.type === 'changed' && (
                        <span className="wlm-tpl-update__change--edit">
                          {c.name} set {c.set}: {c.from.weight}lbs×{c.from.reps} → {c.to.weight}lbs×{c.to.reps}
                        </span>
                      )}
                      {c.type === 'sets_added' && (
                        <span className="wlm-tpl-update__change--add">+ {c.count} set{c.count > 1 ? 's' : ''} added to {c.name}</span>
                      )}
                    </div>
                  ))}
                  {templateUpdateSheet.changes.length > 4 && (
                    <span className="wlm-tpl-update__more">and {templateUpdateSheet.changes.length - 4} more changes...</span>
                  )}
                </div>

                {/* Buttons */}
                <motion.button
                  className="wlm-tpl-update__btn-primary"
                  onClick={async () => {
                    await supabase
                      .from('workout_templates')
                      .update({ exercises: templateUpdateSheet.exerciseData, updated_at: new Date().toISOString() })
                      .eq('id', templateUpdateSheet.templateId);
                    toast.success('Template updated');
                    fetchTemplates();
                    setTemplateUpdateSheet(null);
                    setSaveNewTplMode(false);
                  }}
                  whileTap={{ scale: 0.97 }}
                >
                  Update template
                </motion.button>

                {/* Save as new template */}
                <AnimatePresence mode="wait">
                  {!saveNewTplMode ? (
                    <motion.button
                      key="save-new-btn"
                      className="wlm-tpl-update__btn-new"
                      onClick={() => {
                        setSaveNewTplName(templateUpdateSheet.templateName || '');
                        setSaveNewTplError('');
                        setSaveNewTplMode(true);
                      }}
                      whileTap={{ scale: 0.97 }}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <BookmarkPlus size={16} /> Save as new template
                    </motion.button>
                  ) : (
                    <motion.div
                      key="save-new-input"
                      className="wlm-tpl-update__new-row"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <div className="wlm-tpl-update__new-input-row">
                        <input
                          type="text"
                          className="wlm-tpl-update__new-input"
                          value={saveNewTplName}
                          onChange={(e) => setSaveNewTplName(e.target.value)}
                          placeholder="Template name..."
                          autoFocus
                        />
                        <motion.button
                          className="wlm-tpl-update__new-save"
                          onClick={async () => {
                            const name = saveNewTplName.trim();
                            if (!name) { setSaveNewTplError('Name cannot be empty'); return; }
                            setSaveNewTplError('');
                            const { error } = await supabase.from('workout_templates').insert({
                              user_id: userId,
                              name,
                              muscle_group: sessionMuscleGroup || '',
                              exercises: templateUpdateSheet.exerciseData,
                            });
                            if (error) { setSaveNewTplError("Couldn't save template, please try again"); return; }
                            toast.success(`${name} saved as new template`);
                            fetchTemplates();
                            setTemplateUpdateSheet(null);
                            setSaveNewTplMode(false);
                          }}
                          whileTap={{ scale: 0.97 }}
                        >
                          Save
                        </motion.button>
                      </div>
                      {saveNewTplError && (
                        <span className="wlm-tpl-update__new-error">{saveNewTplError}</span>
                      )}
                      <button
                        className="wlm-tpl-update__new-cancel"
                        onClick={() => { setSaveNewTplMode(false); setSaveNewTplError(''); }}
                      >
                        Cancel
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>

                <motion.button
                  className="wlm-tpl-update__btn-secondary"
                  onClick={() => { setTemplateUpdateSheet(null); setSaveNewTplMode(false); }}
                  whileTap={{ scale: 0.97 }}
                >
                  Keep original
                </motion.button>
                <button
                  className="wlm-tpl-update__dont-ask"
                  onClick={() => {
                    localStorage.setItem('template_auto_update', 'never');
                    setTemplateUpdateSheet(null);
                    setSaveNewTplMode(false);
                  }}
                >
                  Don't ask again
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── CONFIRM DELETE DIALOG ── */}
        <AnimatePresence>
          {confirmDelete && (
            <motion.div
              className="wlm-overlay wlm-overlay--confirm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setConfirmDelete(null)}
            >
              <motion.div
                className="wlm-confirm"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                transition={{ duration: 0.15 }}
                onClick={(e) => e.stopPropagation()}
              >
                <h4 className="wlm-confirm__title">
                  Delete {confirmDelete.type === 'template' ? 'template' : 'workout'}?
                </h4>
                <p className="wlm-confirm__message">
                  {confirmDelete.type === 'template'
                    ? (<>Delete &ldquo;{confirmDelete.name}&rdquo;? This cannot be undone.</>)
                    : (<>{confirmDelete.name} on {formatDate(confirmDelete.date)} will be permanently removed.</>)
                  }
                </p>
                <div className="wlm-confirm__actions">
                  <motion.button
                    className="wlm-confirm__cancel"
                    onClick={() => setConfirmDelete(null)}
                    whileTap={{ scale: 0.97 }}
                  >
                    Cancel
                  </motion.button>
                  <motion.button
                    className="wlm-confirm__delete"
                    onClick={handleConfirmDelete}
                    whileTap={{ scale: 0.97 }}
                  >
                    Delete
                  </motion.button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>{/* end .wl-mobile */}

    </div>
  );
}

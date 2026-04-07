import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  UtensilsCrossed,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Trash2,
  Plus,
  X,
  RefreshCw,
  Search,
  Loader,
  Heart,
  Check,
  ClipboardCheck,
  Copy,
  Cookie,
  ArrowRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import { useUpgrade } from '../../context/UpgradeContext';
import { useTheme } from '../../hooks/useTheme';
import '../../styles/mealplanner.css';

const API_BASE = process.env.REACT_APP_API_BASE || 'https://gainlytics-1.onrender.com';

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const MEAL_TYPES = ['Breakfast', 'Lunch', 'Dinner'];

/* ── Helpers ──────────────────────────────────────── */

function getMonday(d) {
  const date = new Date(d);
  const day = date.getDay(); // 0=Sun
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(date);
  monday.setDate(diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function addDays(d, n) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function fmtShort(d) {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function fmtDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function isSameDay(a, b) {
  return fmtDate(a) === fmtDate(b);
}

function fmtNumber(n) {
  return n.toLocaleString('en-US');
}

/* ── Cell stagger animation ──────────────────────── */
const cellVariants = {
  hidden: { opacity: 0, y: 6 },
  show: (i) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.03, duration: 0.25, ease: 'easeOut' },
  }),
};

/* ────────────────────────────────────────────────────
   PRO GATE
   ──────────────────────────────────────────────────── */
function MealPlannerGate() {
  const { triggerUpgrade } = useUpgrade();
  return (
    <div className="mp-gate">
      <UtensilsCrossed size={48} style={{ color: 'var(--accent)', opacity: 0.6 }} />
      <h2 className="mp-gate__heading">Meal Planner is a Pro feature</h2>
      <p className="mp-gate__subtext">
        Plan your weekly meals and macros with AI-powered suggestions. Track
        calories, protein, carbs, and fat across every meal.
      </p>
      <button className="mp-gate__btn" onClick={() => triggerUpgrade('meals')}>
        Upgrade to Pro — $4.99/mo
      </button>
      <button className="mp-gate__link" onClick={() => triggerUpgrade('meals')}>
        See what's included
      </button>
    </div>
  );
}

/* ────────────────────────────────────────────────────
   SLOT PANEL (slide-in)
   ──────────────────────────────────────────────────── */
function SlotPanel({
  slot,
  onClose,
  onAddMeal,
  weekStart,
  entries,
  isProPlus = false,
}) {
  const { triggerUpgrade } = useUpgrade();
  const { isSpectrum } = useTheme();
  const [tab, setTab] = useState(isProPlus ? 'ai' : 'manual');
  const [suggestions, setSuggestions] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [savedMeals, setSavedMeals] = useState([]);
  const [savedSearch, setSavedSearch] = useState('');
  const [loadingSaved, setLoadingSaved] = useState(false);

  // Manual form
  const [form, setForm] = useState({
    meal_name: '',
    ingredients: '',
    calories: '',
    protein: '',
    carbs: '',
    fat: '',
    saveToMeals: false,
  });
  const [submitting, setSubmitting] = useState(false);

  const dayDate = addDays(weekStart, DAY_NAMES.indexOf(slot.day));
  const dayLabel = `${slot.day}, ${fmtShort(dayDate)}`;

  // Remaining macros for the day
  const dayEntries = entries.filter(
    (e) => e.day_of_week === DAY_NAMES.indexOf(slot.day)
  );
  const dayTotals = dayEntries.reduce(
    (acc, e) => ({
      calories: acc.calories + (Number(e.calories) || 0),
      protein: acc.protein + (Number(e.protein) || 0),
      carbs: acc.carbs + (Number(e.carbs) || 0),
      fat: acc.fat + (Number(e.fat) || 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  /* ── AI Suggest ──────────────────────────── */
  const fetchSuggestions = useCallback(async () => {
    setLoadingSuggestions(true);
    setSuggestions([]);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Fetch user goal for context
      const { data: goalData } = await supabase
        .from('goals')
        .select('goal, calories, protein, carbs, fat')
        .eq('user_id', user.id)
        .maybeSingle();

      const body = {
        user_id: user.id,
        day: slot.day,
        meal_type: slot.mealType,
        remaining_calories: Math.max((goalData?.calories || 2000) - dayTotals.calories, 0),
        remaining_protein: Math.max((goalData?.protein || 150) - dayTotals.protein, 0),
        remaining_carbs: Math.max((goalData?.carbs || 250) - dayTotals.carbs, 0),
        remaining_fat: Math.max((goalData?.fat || 65) - dayTotals.fat, 0),
        goal: goalData?.goal || 'Maintenance',
      };

      const res = await fetch(`${API_BASE}/meal-planner/suggest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error('Failed to get suggestions');

      const data = await res.json();
      const remaining = body.remaining_calories;
      const tagged = (data.suggestions || []).map((s) => ({
        ...s,
        fit: s.calories <= remaining * 1.1 ? 'good' : 'ok',
      }));
      setSuggestions(tagged);
    } catch (err) {
      console.error('AI suggest error:', err);
      toast.error('Could not generate suggestions. The AI endpoint may not be available yet.');
      // Provide fallback placeholder suggestions
      setSuggestions([
        {
          meal_name: 'Grilled Chicken Salad',
          ingredients: 'Chicken breast, mixed greens, cherry tomatoes, cucumber, olive oil dressing',
          calories: 420,
          protein: 38,
          carbs: 15,
          fat: 22,
          fit: 'good',
        },
        {
          meal_name: 'Salmon with Quinoa',
          ingredients: 'Atlantic salmon fillet, quinoa, steamed broccoli, lemon',
          calories: 520,
          protein: 42,
          carbs: 35,
          fat: 24,
          fit: 'good',
        },
        {
          meal_name: 'Greek Yogurt Bowl',
          ingredients: 'Greek yogurt, mixed berries, granola, honey, chia seeds',
          calories: 350,
          protein: 25,
          carbs: 42,
          fat: 10,
          fit: 'ok',
        },
      ]);
    } finally {
      setLoadingSuggestions(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slot.day, slot.mealType, dayTotals]);

  // Fetch suggestions on mount for AI tab (only for Pro+ users)
  useEffect(() => {
    if (tab === 'ai' && isProPlus && suggestions.length === 0 && !loadingSuggestions) {
      fetchSuggestions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, isProPlus]);

  /* ── Saved Meals ─────────────────────────── */
  useEffect(() => {
    if (tab !== 'saved') return;
    let cancelled = false;

    (async () => {
      setLoadingSaved(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;

      const { data } = await supabase
        .from('saved_meals')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (!cancelled) {
        setSavedMeals(data || []);
        setLoadingSaved(false);
      }
    })();

    return () => { cancelled = true; };
  }, [tab]);

  const filteredSaved = savedMeals.filter((m) =>
    m.meal_name?.toLowerCase().includes(savedSearch.toLowerCase())
  );

  /* ── Manual Entry Submit ─────────────────── */
  async function handleManualSubmit(e) {
    e.preventDefault();
    if (!form.meal_name.trim()) {
      toast.error('Please enter a meal name.');
      return;
    }
    const cal = parseFloat(form.calories) || 0;
    if (cal <= 0) {
      toast.error('Please enter calories.');
      return;
    }

    setSubmitting(true);
    try {
      const meal = {
        meal_name: form.meal_name.trim(),
        ingredients: form.ingredients.trim(),
        calories: cal,
        protein: parseFloat(form.protein) || 0,
        carbs: parseFloat(form.carbs) || 0,
        fat: parseFloat(form.fat) || 0,
      };

      // Optionally save to saved_meals
      if (form.saveToMeals) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase.from('saved_meals').insert({
            user_id: user.id,
            meal_name: meal.meal_name,
            ingredients: meal.ingredients,
            calories: meal.calories,
            protein: meal.protein,
            carbs: meal.carbs,
            fat: meal.fat,
          });
        }
      }

      await onAddMeal(meal);
      toast.success('Meal added to plan');
      onClose();
    } catch (err) {
      toast.error('Failed to add meal.');
    } finally {
      setSubmitting(false);
    }
  }

  /* ── Add from suggestion / saved ─────────── */
  async function handleAddFromCard(meal) {
    try {
      await onAddMeal({
        meal_name: meal.meal_name,
        ingredients: meal.ingredients || '',
        calories: Number(meal.calories) || 0,
        protein: Number(meal.protein) || 0,
        carbs: Number(meal.carbs) || 0,
        fat: Number(meal.fat) || 0,
      });
      toast.success('Meal added to plan');
      onClose();
    } catch (err) {
      toast.error('Failed to add meal.');
    }
  }

  return (
    <>
      {/* Overlay */}
      <motion.div
        className="mp-panel__overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />

      {/* Panel */}
      <motion.div
        className="mp-panel"
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
      >
        {/* Header */}
        <div className="mp-panel__header">
          <h3 className="mp-panel__title">
            {dayLabel} — {slot.mealType}
          </h3>
          <button className="mp-panel__close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="mp-panel__body">
          {/* Tabs */}
          <div className="mp-tabs">
            {[
              { key: 'ai', label: 'AI Suggest' },
              { key: 'saved', label: 'Saved Meals' },
              { key: 'manual', label: 'Manual Entry' },
            ].map(({ key, label }) => (
              <button
                key={key}
                className={`mp-tabs__tab ${tab === key ? 'mp-tabs__tab--active' : ''}`}
                onClick={() => setTab(key)}
              >
                {label}
              </button>
            ))}
          </div>

          {/* ─── AI Suggest Tab ─── */}
          {tab === 'ai' && (
            !isProPlus ? (
              <div className="mp-ai-gate">
                <Sparkles size={32} style={{ color: 'var(--accent-light)', marginBottom: 12 }} />
                <h4>AI Suggestions require Pro+</h4>
                <p>Get personalized meal suggestions powered by AI that fit your macro targets.</p>
                <button className="mp-ai-gate__btn" onClick={() => triggerUpgrade('ai_meals', 'pro_plus')}>
                  Upgrade to Pro+ — $9.99/mo
                </button>
              </div>
            ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Remaining macros */}
              <div className="mp-remaining-macros">
                <div className="mp-remaining-chip">
                  Cal: <span>{Math.max(2000 - dayTotals.calories, 0)}</span>
                </div>
                <div className="mp-remaining-chip">
                  P: <span>{Math.max(150 - dayTotals.protein, 0)}g</span>
                </div>
                <div className="mp-remaining-chip">
                  C: <span>{Math.max(250 - dayTotals.carbs, 0)}g</span>
                </div>
                <div className="mp-remaining-chip">
                  F: <span>{Math.max(65 - dayTotals.fat, 0)}g</span>
                </div>
              </div>

              {loadingSuggestions ? (
                <>
                  {[0, 1, 2].map((i) => (
                    <motion.div
                      key={i}
                      className="mp-skeleton"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.08 }}
                    >
                      <div className="mp-skeleton__line mp-skeleton__line--short" />
                      <div className="mp-skeleton__line mp-skeleton__line--medium" />
                      <div className="mp-skeleton__line" />
                    </motion.div>
                  ))}
                  <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                    Generating suggestions...
                  </p>
                </>
              ) : (
                <>
                  <AnimatePresence>
                    {suggestions.map((s, i) => (
                      <motion.div
                        key={`${s.meal_name}-${i}`}
                        className="mp-suggestion-card"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ delay: i * 0.06, duration: 0.25 }}
                      >
                        <div className="mp-suggestion-card__header">
                          <span
                            className={`mp-suggestion-card__dot ${
                              s.fit === 'good'
                                ? 'mp-suggestion-card__dot--good'
                                : 'mp-suggestion-card__dot--ok'
                            }`}
                          />
                          <span className="mp-suggestion-card__name">
                            {s.meal_name}
                          </span>
                        </div>
                        {s.ingredients && (
                          <p className="mp-suggestion-card__ingredients">
                            {s.ingredients}
                          </p>
                        )}
                        <div className="mp-suggestion-card__macros">
                          <span className="mp-macro-chip" style={isSpectrum ? { color: 'var(--color-calories-light)', background: 'var(--color-calories-bg)' } : undefined}>Cal: {s.calories}</span>
                          <span className="mp-macro-chip" style={isSpectrum ? { color: 'var(--color-protein-light)', background: 'var(--color-protein-bg)' } : undefined}>P: {s.protein}g</span>
                          <span className="mp-macro-chip" style={isSpectrum ? { color: 'var(--color-carbs-light)', background: 'var(--color-carbs-bg)' } : undefined}>C: {s.carbs}g</span>
                          <span className="mp-macro-chip" style={isSpectrum ? { color: 'var(--color-fat-light)', background: 'var(--color-fat-bg)' } : undefined}>F: {s.fat}g</span>
                        </div>
                        <button
                          className="mp-suggestion-card__add-btn"
                          onClick={() => handleAddFromCard(s)}
                        >
                          <Plus size={14} /> Add to plan
                        </button>
                      </motion.div>
                    ))}
                  </AnimatePresence>

                  {suggestions.length > 0 && (
                    <button
                      className="mp-retry-btn"
                      onClick={fetchSuggestions}
                      disabled={loadingSuggestions}
                    >
                      <RefreshCw size={14} /> Try different suggestions
                    </button>
                  )}
                </>
              )}
            </div>
            )
          )}

          {/* ─── Saved Meals Tab ─── */}
          {tab === 'saved' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="mp-search">
                <Search size={14} className="mp-search__icon" />
                <input
                  type="text"
                  className="input mp-search__input"
                  placeholder="Search saved meals..."
                  value={savedSearch}
                  onChange={(e) => setSavedSearch(e.target.value)}
                />
              </div>

              {loadingSaved ? (
                <p className="mp-empty-state">Loading saved meals...</p>
              ) : filteredSaved.length === 0 ? (
                <div className="mp-empty-state">
                  {savedSearch ? (
                    <p>No meals match your search.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                      <Heart size={24} style={{ color: '#2a3548' }} />
                      <p style={{ margin: 0 }}>
                        No saved meals yet. Heart any meal in the planner to save it here for quick re-use.
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <AnimatePresence>
                  {filteredSaved.map((m, i) => (
                    <motion.div
                      key={m.id}
                      className="mp-saved-meal"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }}
                    >
                      <div className="mp-saved-meal__info">
                        <div className="mp-saved-meal__name">{m.meal_name}</div>
                        <div className="mp-saved-meal__macros">
                          {m.calories} kcal | P: {m.protein}g | C: {m.carbs}g | F:{' '}
                          {m.fat}g
                        </div>
                      </div>
                      <button
                        className="mp-saved-meal__add-btn"
                        onClick={() => handleAddFromCard(m)}
                      >
                        <Plus size={12} /> Add
                      </button>
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}
            </div>
          )}

          {/* ─── Manual Entry Tab ─── */}
          {tab === 'manual' && (
            <form className="mp-form" onSubmit={handleManualSubmit}>
              <div className="mp-form__field">
                <label className="mp-form__label">Meal name</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. Grilled Chicken Salad"
                  value={form.meal_name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, meal_name: e.target.value }))
                  }
                  maxLength={120}
                />
              </div>

              <div className="mp-form__field">
                <label className="mp-form__label">Ingredients</label>
                <textarea
                  className="input"
                  rows={3}
                  placeholder="Chicken breast, lettuce, tomato..."
                  value={form.ingredients}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, ingredients: e.target.value }))
                  }
                  style={{ resize: 'vertical' }}
                />
              </div>

              <div className="mp-form__macro-grid">
                {[
                  { key: 'calories', label: 'Calories (kcal)' },
                  { key: 'protein', label: 'Protein (g)' },
                  { key: 'carbs', label: 'Carbs (g)' },
                  { key: 'fat', label: 'Fat (g)' },
                ].map(({ key, label }) => (
                  <div key={key} className="mp-form__field">
                    <label className="mp-form__label">{label}</label>
                    <input
                      type="number"
                      className="input"
                      min="0"
                      step="any"
                      placeholder="0"
                      value={form[key]}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, [key]: e.target.value }))
                      }
                    />
                  </div>
                ))}
              </div>

              <label className="mp-form__checkbox">
                <input
                  type="checkbox"
                  checked={form.saveToMeals}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, saveToMeals: e.target.checked }))
                  }
                />
                Save to my meals
              </label>

              <button
                type="submit"
                className="mp-form__submit"
                disabled={submitting}
              >
                {submitting ? 'Adding...' : 'Add to plan'}
              </button>
            </form>
          )}
        </div>
      </motion.div>
    </>
  );
}

/* ────────────────────────────────────────────────────
   SNACK QUICK-ADD SHEET
   ──────────────────────────────────────────────────── */
function SnackSheet({ userId, onClose }) {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', calories: '', protein: '', carbs: '', fat: '' });
  const [dateStr, setDateStr] = useState(() => fmtDate(new Date()));
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    const cal = parseFloat(form.calories) || 0;
    if (!form.name.trim()) { toast.error('Enter a snack name'); return; }
    if (cal === 0) { toast.error('Enter at least calories'); return; }

    setSubmitting(true);
    const { error } = await supabase.from('food_logs').insert({
      user_id: userId,
      logged_date: dateStr,
      meal_name: form.name.trim(),
      calories: cal,
      protein_g: parseFloat(form.protein) || 0,
      carbs_g: parseFloat(form.carbs) || 0,
      fat_g: parseFloat(form.fat) || 0,
      notes: 'Snack',
    });
    setSubmitting(false);

    if (error) { toast.error('Failed to log snack'); return; }
    toast.success('Snack logged!');
    onClose();
  }

  return (
    <>
      <motion.div
        className="mp-snack-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        className="mp-snack-sheet"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 320 }}
      >
        <div className="mp-snack-sheet__handle" />

        <div className="mp-snack-sheet__header">
          <h3 className="mp-snack-sheet__title">
            <Cookie size={16} /> Quick-add snack
          </h3>
          <button className="mp-panel__close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form className="mp-snack-sheet__body" onSubmit={handleSubmit}>
          <div className="mp-form__field">
            <label className="mp-form__label">Snack name</label>
            <input
              type="text"
              className="input"
              placeholder="e.g. Protein bar, Apple, Trail mix"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              maxLength={80}
              autoFocus
            />
          </div>

          <div className="mp-form__macro-grid">
            {[
              { key: 'calories', label: 'Calories (kcal)' },
              { key: 'protein', label: 'Protein (g)' },
              { key: 'carbs', label: 'Carbs (g)' },
              { key: 'fat', label: 'Fat (g)' },
            ].map(({ key, label }) => (
              <div key={key} className="mp-form__field">
                <label className="mp-form__label">{label}</label>
                <input
                  type="number"
                  className="input"
                  min="0"
                  step="any"
                  placeholder="0"
                  value={form[key]}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                />
              </div>
            ))}
          </div>

          <div className="mp-form__field">
            <label className="mp-form__label">Date</label>
            <input
              type="date"
              className="input"
              value={dateStr}
              onChange={(e) => setDateStr(e.target.value)}
            />
          </div>

          <button type="submit" className="mp-form__submit" disabled={submitting}>
            {submitting ? 'Logging...' : 'Log snack'}
          </button>
        </form>

        <button
          className="mp-snack-sheet__goto"
          onClick={() => {
            onClose();
            navigate('/goalplanner?spotlight=nutrition');
          }}
        >
          Go to Goal Planner <ArrowRight size={14} />
        </button>
      </motion.div>
    </>
  );
}

/* ────────────────────────────────────────────────────
   MAIN MEAL PLANNER CONTENT
   ──────────────────────────────────────────────────── */
function MealPlannerContent({ isProPlus = false }) {
  const { triggerUpgrade } = useUpgrade();
  const { isSpectrum } = useTheme();
  const [userId, setUserId] = useState(null);
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()));
  const [planId, setPlanId] = useState(null);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [aiWeekLoading, setAiWeekLoading] = useState(false);
  const [clearing, setClearing] = useState(false);

  /* ── NEW STATE: goals, expanded slot, favorites, snack sheet ── */
  const [goalData, setGoalData] = useState(null);
  const [expandedSlot, setExpandedSlot] = useState(null);
  const [favoriteIds, setFavoriteIds] = useState(new Set());
  const [favoriteNameMap, setFavoriteNameMap] = useState({}); // meal_name -> saved_meals id
  const [snackOpen, setSnackOpen] = useState(false);

  const today = useMemo(() => new Date(), []);

  /* ── Fetch goal data ────────────────────────── */
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    (async () => {
      const { data } = await supabase
        .from('goals')
        .select('calories, protein, carbs, fat')
        .eq('user_id', userId)
        .maybeSingle();

      if (!cancelled) {
        setGoalData(data || null);
      }
    })();

    return () => { cancelled = true; };
  }, [userId]);

  /* ── Fetch favorites (saved_meals) on mount ──── */
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    (async () => {
      const { data } = await supabase
        .from('saved_meals')
        .select('id, meal_name')
        .eq('user_id', userId);

      if (!cancelled && data) {
        const ids = new Set(data.map((m) => m.id));
        const nameMap = {};
        data.forEach((m) => {
          nameMap[m.meal_name] = m.id;
        });
        setFavoriteIds(ids);
        setFavoriteNameMap(nameMap);
      }
    })();

    return () => { cancelled = true; };
  }, [userId]);

  /* ── Fetch plan & entries ────────────────── */
  const loadPlan = useCallback(
    async (uid, ws) => {
      setLoading(true);
      try {
        const weekStr = fmtDate(ws);

        // Upsert meal_plans row
        const { data: plan, error: planErr } = await supabase
          .from('meal_plans')
          .upsert(
            { user_id: uid, week_start: weekStr },
            { onConflict: 'user_id,week_start' }
          )
          .select('id')
          .single();

        if (planErr) {
          // If upsert fails, try to select existing
          const { data: existing } = await supabase
            .from('meal_plans')
            .select('id')
            .eq('user_id', uid)
            .eq('week_start', weekStr)
            .maybeSingle();

          if (existing) {
            setPlanId(existing.id);
            const { data: ent } = await supabase
              .from('meal_plan_entries')
              .select('*')
              .eq('plan_id', existing.id)
              .order('day_of_week', { ascending: true });
            setEntries(ent || []);
          } else {
            // Insert new plan
            const { data: newPlan } = await supabase
              .from('meal_plans')
              .insert({ user_id: uid, week_start: weekStr })
              .select('id')
              .single();
            if (newPlan) setPlanId(newPlan.id);
            setEntries([]);
          }
        } else {
          setPlanId(plan.id);
          const { data: ent } = await supabase
            .from('meal_plan_entries')
            .select('*')
            .eq('plan_id', plan.id)
            .order('day_of_week', { ascending: true });
          setEntries(ent || []);
        }
      } catch (err) {
        console.error('Load plan error:', err);
        toast.error('Failed to load meal plan.');
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    let mounted = true;

    (async () => {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();
      if (!mounted) return;

      if (error || !user) {
        setLoading(false);
        return;
      }

      setUserId(user.id);
      await loadPlan(user.id, weekStart);
    })();

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reload when weekStart changes
  useEffect(() => {
    if (!userId) return;
    loadPlan(userId, weekStart);
  }, [userId, weekStart, loadPlan]);

  /* ── Week navigation ─────────────────────── */
  const goWeek = (dir) => {
    setWeekStart((prev) => addDays(prev, dir * 7));
  };

  const weekEnd = addDays(weekStart, 4); // Friday
  const weekLabel = `${fmtShort(weekStart)} – ${fmtShort(weekEnd)}`;

  /* ── Weekly macro totals ─────────────────── */
  const weekTotals = useMemo(
    () =>
      entries.reduce(
        (acc, e) => ({
          calories: acc.calories + (Number(e.calories) || 0),
          protein: acc.protein + (Number(e.protein) || 0),
          carbs: acc.carbs + (Number(e.carbs) || 0),
          fat: acc.fat + (Number(e.fat) || 0),
        }),
        { calories: 0, protein: 0, carbs: 0, fat: 0 }
      ),
    [entries]
  );

  /* ── Daily macro totals (per column) ─────── */
  const dailyTotals = useMemo(() => {
    return DAY_NAMES.map((_, dayIdx) => {
      const dayEntries = entries.filter((e) => e.day_of_week === dayIdx);
      return dayEntries.reduce(
        (acc, e) => ({
          calories: acc.calories + (Number(e.calories) || 0),
          protein: acc.protein + (Number(e.protein) || 0),
          carbs: acc.carbs + (Number(e.carbs) || 0),
          fat: acc.fat + (Number(e.fat) || 0),
        }),
        { calories: 0, protein: 0, carbs: 0, fat: 0 }
      );
    });
  }, [entries]);

  /* ── Get entry for a specific slot ───────── */
  function getEntry(dayIdx, mealType) {
    return entries.find(
      (e) =>
        e.day_of_week === dayIdx &&
        e.meal_type?.toLowerCase() === mealType.toLowerCase()
    );
  }

  /* ── Add meal to slot ────────────────────── */
  async function handleAddMeal(meal) {
    if (!planId || !selectedSlot) return;

    const dayIdx = DAY_NAMES.indexOf(selectedSlot.day);
    const mealType = selectedSlot.mealType;

    // Check if entry already exists for this slot
    const existing = getEntry(dayIdx, mealType);

    if (existing) {
      // Update existing entry
      const { error } = await supabase
        .from('meal_plan_entries')
        .update({
          meal_name: meal.meal_name,
          ingredients: meal.ingredients,
          calories: meal.calories,
          protein: meal.protein,
          carbs: meal.carbs,
          fat: meal.fat,
        })
        .eq('id', existing.id);

      if (error) throw error;
    } else {
      // Insert new entry
      const { error } = await supabase.from('meal_plan_entries').insert({
        plan_id: planId,
        day_of_week: dayIdx,
        meal_type: mealType,
        meal_name: meal.meal_name,
        ingredients: meal.ingredients,
        calories: meal.calories,
        protein: meal.protein,
        carbs: meal.carbs,
        fat: meal.fat,
      });

      if (error) throw error;
    }

    // Refresh entries
    const { data: ent } = await supabase
      .from('meal_plan_entries')
      .select('*')
      .eq('plan_id', planId)
      .order('day_of_week', { ascending: true });
    setEntries(ent || []);
  }

  /* ── Delete single entry ─────────────────── */
  async function handleDeleteEntry(entryId) {
    const { error } = await supabase
      .from('meal_plan_entries')
      .delete()
      .eq('id', entryId);

    if (error) {
      toast.error('Failed to remove meal.');
      return;
    }

    setEntries((prev) => prev.filter((e) => e.id !== entryId));
    toast.success('Meal removed');
  }

  /* ── Refresh (re-suggest) a single slot ──── */
  function handleRefreshSlot(dayIdx, mealType) {
    setSelectedSlot({ day: DAY_NAMES[dayIdx], mealType });
  }

  /* ── Clear entire week ───────────────────── */
  async function handleClearWeek() {
    if (!planId) return;
    setClearing(true);

    const { error } = await supabase
      .from('meal_plan_entries')
      .delete()
      .eq('plan_id', planId);

    if (error) {
      toast.error('Failed to clear week.');
    } else {
      setEntries([]);
      toast.success('Week cleared');
    }
    setClearing(false);
  }

  /* ── AI Suggest entire week ──────────────── */
  async function handleAiWeek() {
    if (!planId || !userId) return;
    setAiWeekLoading(true);

    try {
      // Fetch user goal for context
      const { data: goalData } = await supabase
        .from('goals')
        .select('goal, calories, protein, carbs, fat')
        .eq('user_id', userId)
        .maybeSingle();

      const body = {
        user_id: userId,
        plan_id: planId,
        goal: goalData?.goal || 'Maintenance',
        daily_targets: {
          calories: goalData?.calories || 2000,
          protein: goalData?.protein || 150,
          carbs: goalData?.carbs || 250,
          fat: goalData?.fat || 65,
        },
      };

      const res = await fetch(`${API_BASE}/meal-planner/suggest-week`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error('AI week suggestion failed');

      const data = await res.json();

      if (data.entries && Array.isArray(data.entries)) {
        // Clear existing entries first
        await supabase
          .from('meal_plan_entries')
          .delete()
          .eq('plan_id', planId);

        // Insert new entries
        const rows = data.entries.map((e) => ({
          plan_id: planId,
          day_of_week: e.day_of_week,
          meal_type: e.meal_type,
          meal_name: e.meal_name,
          ingredients: e.ingredients || '',
          calories: e.calories || 0,
          protein: e.protein || 0,
          carbs: e.carbs || 0,
          fat: e.fat || 0,
        }));

        await supabase.from('meal_plan_entries').insert(rows);
      }

      // Refresh
      const { data: ent } = await supabase
        .from('meal_plan_entries')
        .select('*')
        .eq('plan_id', planId)
        .order('day_of_week', { ascending: true });
      setEntries(ent || []);
      toast.success('AI meal plan generated!');
    } catch (err) {
      console.error('AI week error:', err);
      toast.error(
        'Could not generate week plan. The AI endpoint may not be available yet.'
      );
    } finally {
      setAiWeekLoading(false);
    }
  }

  /* ── Heart / Favorite toggle ─────────────── */
  async function handleToggleFavorite(entry, e) {
    e.stopPropagation();
    if (!userId || !entry.meal_name) return;

    const mealName = entry.meal_name;
    const existingId = favoriteNameMap[mealName];

    if (existingId) {
      // Remove from saved_meals
      const { error } = await supabase
        .from('saved_meals')
        .delete()
        .eq('id', existingId);

      if (error) {
        toast.error('Failed to remove from saved meals.');
        return;
      }

      setFavoriteIds((prev) => {
        const next = new Set(prev);
        next.delete(existingId);
        return next;
      });
      setFavoriteNameMap((prev) => {
        const next = { ...prev };
        delete next[mealName];
        return next;
      });
      toast.success('Removed from saved meals', { duration: 2000 });
    } else {
      // Add to saved_meals
      const { data, error } = await supabase
        .from('saved_meals')
        .insert({
          user_id: userId,
          meal_name: mealName,
          ingredients: entry.ingredients || '',
          calories: Number(entry.calories) || 0,
          protein: Number(entry.protein) || 0,
          carbs: Number(entry.carbs) || 0,
          fat: Number(entry.fat) || 0,
        })
        .select('id')
        .single();

      if (error) {
        toast.error('Failed to save meal.');
        return;
      }

      setFavoriteIds((prev) => new Set(prev).add(data.id));
      setFavoriteNameMap((prev) => ({ ...prev, [mealName]: data.id }));
      toast.success('Saved to meals', { duration: 2000 });
    }
  }

  /* ── Quick actions: Log day ──────────────── */
  const [loggedDays, setLoggedDays] = useState(new Set());

  // On mount / entries change — check which days already have food_logs
  useEffect(() => {
    if (!userId || !weekStart) return;
    (async () => {
      const dates = DAY_NAMES.map((_, i) => fmtDate(addDays(weekStart, i)));
      const { data } = await supabase
        .from('food_logs')
        .select('logged_date')
        .eq('user_id', userId)
        .in('logged_date', dates);
      if (data) {
        const logged = new Set();
        data.forEach((r) => {
          const idx = dates.indexOf(r.logged_date);
          if (idx >= 0) logged.add(idx);
        });
        setLoggedDays(logged);
      }
    })();
  }, [userId, weekStart, entries]);

  async function handleLogDay(dayIdx) {
    const dayDate = addDays(weekStart, dayIdx);
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);
    if (dayDate > todayDate) return;

    const isLogged = loggedDays.has(dayIdx);
    const dateStr = fmtDate(dayDate);

    // Unlog — remove meal planner entries for this day
    if (isLogged) {
      try {
        await supabase
          .from('food_logs')
          .delete()
          .eq('user_id', userId)
          .eq('logged_date', dateStr)
          .eq('notes', 'From meal planner');

        setLoggedDays((prev) => {
          const next = new Set(prev);
          next.delete(dayIdx);
          return next;
        });
        toast.success(`${DAY_NAMES[dayIdx]} unlogged`);
      } catch (err) {
        console.error('Unlog day error:', err);
        toast.error('Failed to unlog day');
      }
      return;
    }

    // Log — insert entries
    const dayEntries = entries.filter((e) => e.day_of_week === dayIdx);
    const filledMeals = MEAL_TYPES.filter((mt) =>
      dayEntries.some((e) => e.meal_type?.toLowerCase() === mt.toLowerCase())
    );

    if (filledMeals.length < 3) {
      toast.error('Fill all meals to log this day');
      return;
    }

    try {
      const rows = dayEntries.map((e) => ({
        user_id: userId,
        logged_date: dateStr,
        meal_name: e.meal_name,
        calories: Number(e.calories) || 0,
        protein_g: Number(e.protein) || 0,
        carbs_g: Number(e.carbs) || 0,
        fat_g: Number(e.fat) || 0,
        notes: 'From meal planner',
      }));

      // Delete existing meal-planner entries for this day to avoid duplicates
      await supabase
        .from('food_logs')
        .delete()
        .eq('user_id', userId)
        .eq('logged_date', dateStr)
        .eq('notes', 'From meal planner');

      const { error } = await supabase.from('food_logs').insert(rows);
      if (error) throw error;

      setLoggedDays((prev) => new Set(prev).add(dayIdx));
      toast.success(`${DAY_NAMES[dayIdx]} logged to food diary`);
    } catch (err) {
      console.error('Log day error:', err);
      toast.error('Failed to log day');
    }
  }

  /* ── Collapsible ingredient helpers ─────── */
  function toggleExpandSlot(key, e) {
    e.stopPropagation();
    setExpandedSlot((prev) => (prev === key ? null : key));
  }

  /* ── Render ──────────────────────────────── */
  if (loading) {
    return (
      <div className="mp-container">
        <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Loading...</p>
      </div>
    );
  }

  /* ── Weekly goal calculations ───────────── */
  const weeklyGoal = goalData
    ? {
        calories: goalData.calories * 5,
        protein: goalData.protein * 5,
        carbs: goalData.carbs * 5,
        fat: goalData.fat * 5,
      }
    : null;

  const macroBarData = weeklyGoal
    ? [
        {
          label: 'Calories',
          actual: weekTotals.calories,
          goal: weeklyGoal.calories,
          unit: 'kcal',
          color: isSpectrum ? 'var(--color-calories)' : 'var(--accent)',
        },
        {
          label: 'Protein',
          actual: weekTotals.protein,
          goal: weeklyGoal.protein,
          unit: 'g',
          color: isSpectrum ? 'var(--color-protein)' : 'var(--accent-light)',
        },
        {
          label: 'Carbs',
          actual: weekTotals.carbs,
          goal: weeklyGoal.carbs,
          unit: 'g',
          color: isSpectrum ? 'var(--color-carbs)' : 'var(--accent-dark)',
        },
        {
          label: 'Fat',
          actual: weekTotals.fat,
          goal: weeklyGoal.fat,
          unit: 'g',
          color: isSpectrum ? 'var(--color-fat)' : 'rgba(var(--accent-rgb),0.6)',
        },
      ]
    : null;

  /* ── Daily calorie color helper ──────────── */
  function getDayCalColor(dayCal) {
    if (!goalData) return '#888';
    const ratio = dayCal / goalData.calories;
    if (ratio < 0.8) return '#888';
    if (ratio <= 1.1) return 'var(--accent)';
    return '#EF9F27';
  }

  return (
    <div className="mp-container">
      {/* Week Nav */}
      <div className="mp-week-nav">
        <div className="mp-week-nav__left">
          <button className="mp-week-nav__arrow" onClick={() => goWeek(-1)}>
            <ChevronLeft size={16} />
          </button>
          <span className="mp-week-nav__label">{weekLabel}</span>
          <button className="mp-week-nav__arrow" onClick={() => goWeek(1)}>
            <ChevronRight size={16} />
          </button>
        </div>
        <div className="mp-week-nav__right">
          <button
            className="mp-week-nav__ai-btn"
            onClick={isProPlus ? handleAiWeek : () => triggerUpgrade('ai_week', 'pro_plus')}
            disabled={aiWeekLoading}
          >
            <Sparkles size={14} />
            {aiWeekLoading ? 'Generating...' : 'AI suggest week'}
          </button>
          {entries.length > 0 && (
            <button
              className="mp-week-nav__clear-btn"
              onClick={handleClearWeek}
              disabled={clearing}
            >
              <Trash2 size={14} />
              {clearing ? 'Clearing...' : 'Clear week'}
            </button>
          )}
        </div>
      </div>

      {/* ── Weekly Macro Comparison Bar ──────── */}
      <div className="mp-summary-bar">
        <span className="mp-summary-bar__label">
          Week of {fmtShort(weekStart)} &ndash; {fmtShort(weekEnd)}
        </span>

        {macroBarData ? (
          <div className="mp-summary-bar__bars">
            {macroBarData.map((m) => {
              const pct = m.goal > 0 ? (m.actual / m.goal) * 100 : 0;
              const isOver = pct > 100;
              const fillColor = isOver ? '#EF9F27' : m.color;
              const fillWidth = Math.min(pct, 100);

              return (
                <div key={m.label} className="mp-macro-row">
                  <span className="mp-macro-row__label">{m.label}</span>
                  <div className="mp-macro-bar">
                    <div
                      className="mp-macro-bar__fill"
                      style={{
                        width: `${fillWidth}%`,
                        background: fillColor,
                      }}
                    />
                  </div>
                  <span className="mp-macro-row__value">
                    <span style={{ color: isOver ? '#EF9F27' : '#fff', fontWeight: 500 }}>
                      {fmtNumber(Math.round(m.actual))}
                    </span>
                    <span style={{ color: '#555' }}>
                      {' / '}
                      {fmtNumber(Math.round(m.goal))} {m.unit}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <span style={{ fontSize: 12, color: '#555' }}>
            Set a goal to see targets
          </span>
        )}
      </div>

      {/* Meal Grid */}
      <div className="mp-grid">
        {/* Header row: corner + day headers */}
        <div className="mp-grid-corner" />
        {DAY_NAMES.map((day, i) => {
          const d = addDays(weekStart, i);
          const isToday = isSameDay(d, today);
          return (
            <div
              key={day}
              className={`mp-day-header ${isToday ? 'mp-day-header--today' : ''}`}
            >
              <span className="mp-day-header__name">{day}</span>
              <span className="mp-day-header__date">{d.getDate()}</span>
            </div>
          );
        })}

        {/* ── Daily Macro Totals Row ──────────── */}
        <div className="mp-grid-corner" />
        {DAY_NAMES.map((day, dayIdx) => {
          const dt = dailyTotals[dayIdx];
          const calColor = getDayCalColor(dt.calories);
          const pct = goalData && goalData.calories > 0
            ? (dt.calories / goalData.calories) * 100
            : 0;
          const barWidth = Math.min(pct, 100);

          return (
            <div key={`daily-${day}`} className="mp-daily-summary">
              <div className="mp-daily-summary__top">
                <span
                  className="mp-daily-summary__cal"
                  style={{ color: calColor }}
                >
                  {Math.round(dt.calories)} kcal
                </span>
                <span className="mp-daily-summary__pills">
                  P: {Math.round(dt.protein)}g&nbsp;&nbsp;C: {Math.round(dt.carbs)}g&nbsp;&nbsp;F: {Math.round(dt.fat)}g
                </span>
              </div>
              <div className="mp-daily-bar">
                <div
                  className="mp-daily-bar__fill"
                  style={{
                    width: `${barWidth}%`,
                    background: calColor,
                  }}
                />
              </div>
            </div>
          );
        })}

        {/* Meal rows */}
        {MEAL_TYPES.map((mealType, rowIdx) => (
          <React.Fragment key={mealType}>
            {/* Row label */}
            <div className="mp-row-label">{mealType}</div>

            {/* Slots for each day */}
            {DAY_NAMES.map((day, colIdx) => {
              const cellIndex = rowIdx * 5 + colIdx;
              const entry = getEntry(colIdx, mealType);
              const slotKey = `${colIdx}-${mealType}`;
              const isExpanded = expandedSlot === slotKey;
              const isFav = entry ? !!favoriteNameMap[entry.meal_name] : false;

              return entry ? (
                <motion.div
                  key={`${mealType}-${day}`}
                  className="mp-slot mp-slot--filled"
                  custom={cellIndex}
                  variants={cellVariants}
                  initial="hidden"
                  animate="show"
                  onClick={() =>
                    setSelectedSlot({ day, mealType })
                  }
                  layout
                >
                  <div className="mp-slot__actions">
                    {/* Heart / Favorite button */}
                    <motion.button
                      className={`mp-slot__action-btn mp-slot__heart ${isFav ? 'mp-slot__heart--active' : ''}`}
                      title={isFav ? 'Remove from saved meals' : 'Save to meals'}
                      onClick={(e) => handleToggleFavorite(entry, e)}
                      whileTap={{ scale: 0.85 }}
                    >
                      <Heart
                        size={11}
                        fill={isFav ? 'var(--accent)' : 'none'}
                        stroke={isFav ? 'var(--accent)' : '#444'}
                      />
                    </motion.button>
                    <button
                      className="mp-slot__action-btn"
                      title="Replace meal"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRefreshSlot(colIdx, mealType);
                      }}
                    >
                      <RefreshCw size={11} />
                    </button>
                    <button
                      className="mp-slot__action-btn mp-slot__action-btn--delete"
                      title="Remove meal"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteEntry(entry.id);
                      }}
                    >
                      <X size={11} />
                    </button>
                  </div>
                  <span className="mp-slot__name">{entry.meal_name}</span>

                  <div className="mp-slot__macros">
                    <span className="mp-macro-chip" style={isSpectrum ? { color: 'var(--color-calories-light)', background: 'var(--color-calories-bg)' } : undefined}>
                      Cal: {entry.calories}
                    </span>
                    <span className="mp-macro-chip" style={isSpectrum ? { color: 'var(--color-protein-light)', background: 'var(--color-protein-bg)' } : undefined}>
                      P: {entry.protein}g
                    </span>
                    <span className="mp-macro-chip" style={isSpectrum ? { color: 'var(--color-carbs-light)', background: 'var(--color-carbs-bg)' } : undefined}>
                      C: {entry.carbs}g
                    </span>
                    <span className="mp-macro-chip" style={isSpectrum ? { color: 'var(--color-fat-light)', background: 'var(--color-fat-bg)' } : undefined}>
                      F: {entry.fat}g
                    </span>
                  </div>

                  {/* Expand / collapse ingredients button */}
                  {entry.ingredients && entry.ingredients.split(',').length > 2 && (
                    <button
                      className="mp-slot__expand-btn"
                      onClick={(e) => toggleExpandSlot(slotKey, e)}
                    >
                      {isExpanded ? (
                        <>
                          <ChevronUp size={12} />
                          <span>Hide ingredients</span>
                        </>
                      ) : (
                        <>
                          <ChevronDown size={12} />
                          <span>Show ingredients</span>
                        </>
                      )}
                    </button>
                  )}

                  {/* Expanded ingredient list with animation */}
                  <AnimatePresence>
                    {isExpanded && entry.ingredients && (
                      <motion.div
                        className="mp-slot__ingredient-list"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25, ease: 'easeOut' }}
                      >
                        {entry.ingredients.split(',').map((ing, idx) => (
                          <div key={idx} className="mp-slot__ingredient-item">
                            <span className="mp-slot__ingredient-dot" />
                            <span>{ing.trim()}</span>
                          </div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ) : (
                <motion.div
                  key={`${mealType}-${day}`}
                  className="mp-slot mp-slot--empty"
                  custom={cellIndex}
                  variants={cellVariants}
                  initial="hidden"
                  animate="show"
                  onClick={() =>
                    setSelectedSlot({ day, mealType })
                  }
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Plus size={16} />
                  <span>Add meal</span>
                </motion.div>
              );
            })}
          </React.Fragment>
        ))}

        {/* ── Quick Actions Row ──────────────── */}
        <div className="mp-row-label" />
        {DAY_NAMES.map((day, dayIdx) => {
          const dayDate = addDays(weekStart, dayIdx);
          const todayDate = new Date();
          todayDate.setHours(0, 0, 0, 0);
          const isFuture = dayDate > todayDate;
          const isLogged = loggedDays.has(dayIdx);

          return (
            <div key={`actions-${day}`} className="mp-day-actions">
              <button
                className={`mp-day-action-btn ${isLogged ? 'mp-day-action-btn--logged' : 'mp-day-action-btn--teal'} ${isFuture ? 'mp-day-action-btn--disabled' : ''}`}
                onClick={() => !isFuture && handleLogDay(dayIdx)}
                disabled={isFuture}
              >
                {isLogged ? <Check size={12} /> : <ClipboardCheck size={12} />}
                {isLogged ? 'Logged' : 'Log day'}
              </button>
              <button
                className="mp-day-action-btn mp-day-action-btn--muted"
                onClick={() => toast('Swap coming soon')}
              >
                <RefreshCw size={12} />
                Swap
              </button>
              <button
                className="mp-day-action-btn mp-day-action-btn--muted"
                onClick={() => toast('Copy coming soon')}
                title="Copy day"
              >
                <Copy size={12} />
              </button>
            </div>
          );
        })}
      </div>

      {/* ── Snack Quick-Add Button ────────────── */}
      <motion.button
        className="mp-snack-btn"
        onClick={() => setSnackOpen(true)}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.98 }}
      >
        <Cookie size={16} />
        Anything else to add? Quick-log a snack
      </motion.button>

      {/* Snack Sheet */}
      <AnimatePresence>
        {snackOpen && userId && (
          <SnackSheet userId={userId} onClose={() => setSnackOpen(false)} />
        )}
      </AnimatePresence>

      {/* Slot Panel */}
      <AnimatePresence>
        {selectedSlot && (
          <SlotPanel
            slot={selectedSlot}
            onClose={() => setSelectedSlot(null)}
            onAddMeal={handleAddMeal}
            weekStart={weekStart}
            entries={entries}
            isProPlus={isProPlus}
          />
        )}
      </AnimatePresence>

      {/* AI Week Loading Overlay */}
      <AnimatePresence>
        {aiWeekLoading && (
          <motion.div
            className="mp-ai-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="mp-ai-overlay__card"
              initial={{ opacity: 0, scale: 0.94, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 20 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
            >
              <Loader size={32} className="mp-ai-overlay__spinner" />
              <p className="mp-ai-overlay__text">
                Generating your weekly meal plan...
              </p>
              <p
                style={{
                  fontSize: 12,
                  color: 'var(--text-muted)',
                  margin: 0,
                }}
              >
                This may take a moment
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ────────────────────────────────────────────────────
   EXPORT
   ──────────────────────────────────────────────────── */
export default function MealPlanner({ isPro = false, isProPlus = false }) {
  if (!isPro) return <MealPlannerGate />;
  return <MealPlannerContent isProPlus={isProPlus} />;
}

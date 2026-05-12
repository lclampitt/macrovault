import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  TrendingUp, ChevronLeft, ChevronRight,
  UtensilsCrossed, Dumbbell, Check, Scale,
} from 'lucide-react';
import posthog from '../lib/posthog';
import { getStreak, invalidateStreakCache } from '../lib/streak';
import { usePlan } from '../hooks/usePlan';
import { useUpgrade } from '../context/UpgradeContext';
import { supabase } from '../supabaseClient';
import { useTheme } from '../hooks/useTheme';
import '../styles/dashboard.css';

/* ── Helpers ──────────────────────────────────────────────── */

function fmtDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getGreeting(hour) {
  if (hour >= 5 && hour < 12) return 'Good morning';
  if (hour >= 12 && hour < 17) return 'Good afternoon';
  if (hour >= 17 && hour < 21) return 'Good evening';
  return 'Good night';
}

/* Action-first dashboard helper — time-of-day meal label for the
   primary "Log a meal" card. Mirrors the windows the user spec'd:
     5-10am   Breakfast
     10-2pm   Lunch
     2-5pm    Snack
     5-9pm    Dinner
     9pm+     Tomorrow's Breakfast
*/
function getNextMealLabel() {
  const h = new Date().getHours();
  if (h >= 5 && h < 10) return 'Breakfast';
  if (h >= 10 && h < 14) return 'Lunch';
  if (h >= 14 && h < 17) return 'Snack';
  if (h >= 17 && h < 21) return 'Dinner';
  return "Tomorrow's Breakfast";
}

/* Format a "how long ago" string from a YYYY-MM-DD date. */
function fmtAgo(dateStr) {
  if (!dateStr) return '';
  const dt = new Date(dateStr + 'T00:00:00');
  const days = Math.floor((Date.now() - dt.getTime()) / (1000 * 60 * 60 * 24));
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} wk ago`;
  return `${Math.floor(days / 30)} mo ago`;
}

/** Animate a number from 0 → target. */
function useCountUp(target, duration = 600) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!target || target === 0) { setVal(0); return; }
    let start = 0;
    const step = target / (duration / 16);
    const t = setInterval(() => {
      start += step;
      if (start >= target) { setVal(target); clearInterval(t); }
      else setVal(Math.round(start));
    }, 16);
    return () => clearInterval(t);
  }, [target, duration]);
  return val;
}

/* Monday-based week start/end for "this week" workout count */
function getWeekRange() {
  const now = new Date();
  const day = now.getDay();
  const diffToMon = (day === 0 ? -6 : 1) - day;
  const mon = new Date(now);
  mon.setDate(now.getDate() + diffToMon);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  return { start: fmtDate(mon), end: fmtDate(sun) };
}

function formatChartDate(dateStr, rangeInDays) {
  const d = new Date(dateStr + 'T00:00:00');
  if (rangeInDays > 60) return d.toLocaleDateString('en-US', { month: 'short' });
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/* ── Stagger variants ────────────────────────────────────── */
const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

/* ============================================================
   STAT CARD
   ============================================================ */
function StatCard({ label, rawValue, formatted, delta, deltaColor }) {
  const animVal = useCountUp(rawValue);
  const display = typeof formatted === 'function' ? formatted(animVal) : `${animVal.toLocaleString()}`;
  return (
    <motion.div className="hd-stat" variants={itemVariants}>
      <div className="hd-stat__label">
        <span className="hd-stat__dot" />
        <span>{label}</span>
      </div>
      <div className="hd-stat__value">{display}</div>
      {delta && (
        <div className="hd-stat__delta" style={{ color: `var(${deltaColor || '--text-muted'})` }}>
          {delta}
        </div>
      )}
    </motion.div>
  );
}

/* ============================================================
   TIME RANGE PILLS
   ============================================================ */
function TimePills({ options, active, onChange }) {
  return (
    <div className="hd-pills">
      {options.map((o) => (
        <button
          key={o.key}
          className={`hd-pill ${active === o.key ? 'hd-pill--active' : ''}`}
          onClick={() => onChange(o.key)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ============================================================
   TODAY'S MEAL PLAN
   ============================================================ */
const MEAL_TYPES = ['breakfast', 'lunch', 'dinner'];

function TodayMealPlan({ userId, onLogged }) {
  const navigate = useNavigate();
  const [meals, setMeals] = useState(null); // null = loading, [] = empty
  const [logged, setLogged] = useState(new Set()); // set of meal_types already logged
  const [logging, setLogging] = useState(null); // meal_type currently being logged
  const [planId, setPlanId] = useState(null);

  // Reusable fetch — also used by realtime subscription + focus refetch
  const fetchTodayMeals = useCallback(async () => {
    if (!userId) return;
    const today = new Date();
    const dow = today.getDay();
    const dayIdx = dow === 0 ? -1 : dow === 6 ? -1 : dow - 1;

    if (dayIdx < 0) { setMeals([]); return; }

    const { data: plans } = await supabase
      .from('meal_plans')
      .select('id, week_start')
      .eq('user_id', userId)
      .order('week_start', { ascending: false })
      .limit(5);

    if (!plans?.length) { setMeals([]); setPlanId(null); return; }

    const todayStr = fmtDate(today);
    const plan = plans.find((p) => {
      const ws = p.week_start;
      const wsDate = new Date(ws + 'T00:00:00');
      const weDate = new Date(wsDate);
      weDate.setDate(weDate.getDate() + 4);
      const weStr = fmtDate(weDate);
      return todayStr >= ws && todayStr <= weStr;
    });

    if (!plan) { setMeals([]); setPlanId(null); return; }

    setPlanId(plan.id);

    const { data: entries } = await supabase
      .from('meal_plan_entries')
      .select('meal_type, meal_name, calories, protein, carbs, fat')
      .eq('plan_id', plan.id)
      .eq('day_of_week', dayIdx);

    // Normalize meal_type to lowercase so downstream comparisons are
    // reliable regardless of how the row was originally inserted.
    const normalized = (entries || []).map((e) => ({
      ...e,
      meal_type: (e.meal_type || '').toLowerCase(),
    }));

    setMeals(normalized);

    // Check which meals are already logged today
    if (normalized.length) {
      const { data: logs } = await supabase
        .from('food_logs')
        .select('meal_name')
        .eq('user_id', userId)
        .eq('logged_date', todayStr)
        .eq('notes', 'From meal planner');

      const loggedNames = new Set((logs || []).map((l) => l.meal_name));
      const alreadyLogged = new Set();
      normalized.forEach((e) => { if (loggedNames.has(e.meal_name)) alreadyLogged.add(e.meal_type); });
      setLogged(alreadyLogged);
    } else {
      setLogged(new Set());
    }
  }, [userId]);

  // Initial load
  useEffect(() => {
    if (!userId) return;
    fetchTodayMeals();
  }, [userId, fetchTodayMeals]);

  // Realtime subscription on meal_plan_entries — refetch on any change
  // meal_plan_entries has no user_id column (linked via plan_id), so we
  // filter by the current plan_id once we know it.
  useEffect(() => {
    if (!userId || !planId) return;
    const channel = supabase
      .channel(`meal_plan_entries_dashboard_${planId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'meal_plan_entries', filter: `plan_id=eq.${planId}` },
        () => { fetchTodayMeals(); }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId, planId, fetchTodayMeals]);

  // Also subscribe to meal_plans for this user so if a new plan is created
  // (e.g. a new week), we pick it up.
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`meal_plans_dashboard_${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'meal_plans', filter: `user_id=eq.${userId}` },
        () => { fetchTodayMeals(); }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId, fetchTodayMeals]);

  // Safety net: refetch when the tab becomes visible again. Handles the
  // common case of navigating to meal planner and coming back.
  useEffect(() => {
    if (!userId) return;
    function onVisible() {
      if (document.visibilityState === 'visible') fetchTodayMeals();
    }
    window.addEventListener('focus', fetchTodayMeals);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('focus', fetchTodayMeals);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [userId, fetchTodayMeals]);

  const handleLog = async (entry) => {
    if (logged.has(entry.meal_type) || logging) return;
    setLogging(entry.meal_type);

    try {
      const todayStr = fmtDate(new Date());

      // Remove any existing meal-planner log for this specific meal today
      await supabase
        .from('food_logs')
        .delete()
        .eq('user_id', userId)
        .eq('logged_date', todayStr)
        .eq('meal_name', entry.meal_name)
        .eq('notes', 'From meal planner');

      const { error } = await supabase.from('food_logs').insert({
        user_id: userId,
        logged_date: todayStr,
        meal_name: entry.meal_name,
        calories: Number(entry.calories) || 0,
        protein_g: Number(entry.protein) || 0,
        carbs_g: Number(entry.carbs) || 0,
        fat_g: Number(entry.fat) || 0,
        notes: 'From meal planner',
      });

      if (error) throw error;
      setLogged((prev) => new Set(prev).add(entry.meal_type));
      if (onLogged) onLogged();
    } catch (err) {
      console.error('Log meal error:', err);
    } finally {
      setLogging(null);
    }
  };

  if (meals === null) return null;

  return (
    <motion.div className="hd-card" variants={itemVariants}>
      <div className="hd-card__head">
        <span className="hd-card__title">Today's Meal Plan</span>
        <button className="hd-link-btn" onClick={() => navigate('/meal-planner')}>
          View full plan →
        </button>
      </div>

      <div className="hd-meal-row">
        {MEAL_TYPES.map((type) => {
          // meal_type is normalized to lowercase in fetchTodayMeals, so
          // this strict equality is safe regardless of how the row was
          // stored in the database.
          const entry = meals.find((m) => m.meal_type === type);
          const isLogged = logged.has(type);
          const isLogging = logging === type;
          return (
            <div
              key={type}
              className={`hd-meal-cell ${!entry ? 'hd-meal-cell--empty' : ''}`}
              onClick={!entry ? () => navigate('/meal-planner') : undefined}
            >
              <span className="hd-meal-label">{type.toUpperCase()}</span>
              {entry ? (
                <>
                  <span className="hd-meal-name">{entry.meal_name}</span>
                  <div className="hd-meal-macros">
                    <span className="hd-meal-macro">Cal: {entry.calories ?? 0}</span>
                    <span className="hd-meal-macro">P: {entry.protein ?? 0}g</span>
                    <span className="hd-meal-macro">C: {entry.carbs ?? 0}g</span>
                    <span className="hd-meal-macro">F: {entry.fat ?? 0}g</span>
                  </div>
                  <button
                    className={`hd-meal-log-btn ${isLogged ? 'hd-meal-log-btn--logged' : ''}`}
                    onClick={() => handleLog(entry)}
                    disabled={isLogged || isLogging}
                  >
                    {isLogged ? (
                      <><Check size={12} /> Logged</>
                    ) : isLogging ? (
                      'Logging...'
                    ) : (
                      'Log'
                    )}
                  </button>
                </>
              ) : (
                <div className="hd-meal-add">
                  <span className="hd-meal-add__icon">+</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

/* ============================================================
   MACRO SPLIT DONUT
   ============================================================ */
const MACRO_RANGES = [
  { key: 'today', label: 'Today' },
  { key: '7d', label: '7D' },
  { key: '30d', label: '30D' },
];

function MacroDonut({ userId, todayNutrition, goalPlan }) {
  const navigate = useNavigate();
  const [range, setRange] = useState('today');
  const [avgData, setAvgData] = useState(null);
  const [donutTip, setDonutTip] = useState(null);
  const [activeIdx, setActiveIdx] = useState(null);

  useEffect(() => {
    if (!userId || range === 'today') { setAvgData(null); return; }
    const days = range === '7d' ? 7 : 30;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutStr = fmtDate(cutoff);

    (async () => {
      const { data } = await supabase
        .from('food_logs')
        .select('calories, protein_g, carbs_g, fat_g')
        .eq('user_id', userId)
        .gte('logged_date', cutStr);
      if (data && data.length) {
        const totals = data.reduce((a, r) => ({
          cal: a.cal + (r.calories || 0),
          pro: a.pro + (r.protein_g || 0),
          carb: a.carb + (r.carbs_g || 0),
          fat: a.fat + (r.fat_g || 0),
        }), { cal: 0, pro: 0, carb: 0, fat: 0 });
        // Get number of unique days to compute daily avg
        const uniqueDays = new Set(data.map((_, i) => data[i].logged_date || i)).size;
        const divisor = Math.max(uniqueDays, 1);
        setAvgData({
          calories: Math.round(totals.cal / divisor),
          protein: Math.round(totals.pro / divisor),
          carbs: Math.round(totals.carb / divisor),
          fat: Math.round(totals.fat / divisor),
        });
      } else {
        setAvgData({ calories: 0, protein: 0, carbs: 0, fat: 0 });
      }
    })();
  }, [userId, range]);

  const src = range === 'today' ? todayNutrition : avgData;
  const cal = src?.calories || 0;
  const pro = src?.protein || 0;
  const carbs = src?.carbs || 0;
  const fat = src?.fat || 0;
  const goalCal = goalPlan?.calories || 2000;

  const proKcal = pro * 4;
  const carbKcal = carbs * 4;
  const fatKcal = fat * 9;
  const remaining = Math.max(0, goalCal - cal);
  const isOver = cal > goalCal;

  const donutData = [
    { name: 'Protein', value: proKcal, grams: pro, goal: goalPlan?.protein, color: 'var(--color-protein, #7F77DD)', pct: Math.round(proKcal / Math.max(cal, 1) * 100) },
    { name: 'Carbs', value: carbKcal, grams: carbs, goal: goalPlan?.carbs, color: 'var(--color-carbs, var(--accent))', pct: Math.round(carbKcal / Math.max(cal, 1) * 100) },
    { name: 'Fat', value: fatKcal, grams: fat, goal: goalPlan?.fat, color: 'var(--color-fat, #D85A30)', pct: Math.round(fatKcal / Math.max(cal, 1) * 100) },
    { name: 'Remaining', value: remaining || 1, color: 'rgba(255,255,255,0.07)', isRemaining: true, remainingKcal: remaining },
  ].filter((s) => s.value > 0);

  const handleSegmentEnter = (index) => {
    setActiveIdx(index);
    const d = donutData[index];
    setDonutTip({
      visible: true,
      name: d.name,
      value: d.isRemaining ? `${d.remainingKcal} kcal` : `${d.grams}g`,
      sub: d.isRemaining ? 'remaining' : d.goal ? `of ${d.goal}g goal \u00b7 ${d.pct}%` : `${d.pct}%`,
      color: d.isRemaining ? 'var(--warning, #EF9F27)' : d.color,
      x: 0, y: 0,
    });
  };

  const handleGaugeLeave = () => {
    setActiveIdx(null);
    setDonutTip(null);
  };

  const handleGaugeMouseMove = (e) => {
    setDonutTip((prev) => prev ? { ...prev, x: e.clientX + 12, y: e.clientY - 12 } : null);
  };

  const centerLabel = range === 'today' ? 'kcal today' : 'kcal avg/day';

  /* Hovered-segment data drives the center cross-fade */
  const activeSlice = activeIdx != null ? donutData[activeIdx] : null;
  const activeCenterVal = activeSlice
    ? (activeSlice.isRemaining ? `${activeSlice.remainingKcal}` : `${activeSlice.grams}g`)
    : '';
  const activeCenterLabel = activeSlice
    ? (activeSlice.isRemaining ? 'kcal remaining' : activeSlice.name)
    : '';
  const activeCenterColor = activeSlice
    ? (activeSlice.isRemaining ? 'var(--warning, #EF9F27)' : activeSlice.color)
    : undefined;

  /* ── Half-circle gauge geometry ──────────────────────────────
     We draw a 180° arc from (cx-r, cy) on the left, over the top,
     to (cx+r, cy) on the right. Each macro takes an angular slice
     proportional to its share of total kcal, with small gaps in
     between. Stroke-dasharray/offset drives the draw-on animation;
     keying the inner <g> on `range` remounts the paths so the
     animation replays on tab switch. */
  const GAUGE_CX = 120;
  const GAUGE_CY = 110;
  const GAUGE_R = 90;
  const GAUGE_STROKE = 20;
  const GAUGE_GAP_DEG = 2.5;

  const segments = useMemo(() => {
    const total = donutData.reduce((s, d) => s + d.value, 0);
    if (total <= 0) return [];
    const gapCount = Math.max(donutData.length - 1, 0);
    const availableAngle = Math.max(180 - gapCount * GAUGE_GAP_DEG, 0);
    let cursor = 180; // start at the left end (x = cx - r)
    return donutData.map((d) => {
      const span = (d.value / total) * availableAngle;
      const startDeg = cursor;
      const endDeg = cursor - span;
      cursor = endDeg - GAUGE_GAP_DEG;
      const sRad = (startDeg * Math.PI) / 180;
      const eRad = (endDeg * Math.PI) / 180;
      const sx = GAUGE_CX + GAUGE_R * Math.cos(sRad);
      const sy = GAUGE_CY - GAUGE_R * Math.sin(sRad);
      const ex = GAUGE_CX + GAUGE_R * Math.cos(eRad);
      const ey = GAUGE_CY - GAUGE_R * Math.sin(eRad);
      const largeArc = span > 180 ? 1 : 0;
      const pathD = `M ${sx.toFixed(3)} ${sy.toFixed(3)} A ${GAUGE_R} ${GAUGE_R} 0 ${largeArc} 1 ${ex.toFixed(3)} ${ey.toFixed(3)}`;
      const length = GAUGE_R * (span * Math.PI) / 180;
      return { ...d, d: pathD, length };
    });
  }, [donutData]);

  return (
    <motion.div className="hd-card" variants={itemVariants}>
      <div className="hd-card__head">
        <span className="hd-card__title">Macro split</span>
        <div className="hd-pills">
          {MACRO_RANGES.map((o) => (
            <button
              key={o.key}
              className={`hd-pill ${range === o.key ? 'hd-pill--active' : ''}`}
              onClick={() => setRange(o.key)}
            >
              {o.label}
            </button>
          ))}
          <button
            className="hd-pill hd-pill--accent"
            onClick={() => navigate('/goalplanner', { state: { spotlight: 'nutrition' } })}
          >
            Log nutrition
          </button>
        </div>
      </div>
      <div className="hd-donut-wrap" onMouseMove={handleGaugeMouseMove} onMouseLeave={handleGaugeLeave}>
        <div className="hd-gauge">
          <svg
            className="hd-gauge__svg"
            viewBox="10 0 220 120"
            preserveAspectRatio="xMidYMid meet"
            aria-hidden="true"
          >
            <g key={range}>
              {segments.map((seg, i) => (
                <path
                  key={seg.name}
                  d={seg.d}
                  stroke={seg.color}
                  strokeWidth={GAUGE_STROKE}
                  strokeLinecap="butt"
                  fill="none"
                  className={`hd-gauge__segment ${
                    activeIdx != null && activeIdx !== i ? 'hd-gauge__segment--dim' : ''
                  }`}
                  style={{
                    '--dash-length': seg.length.toFixed(3),
                    '--draw-delay': `${i * 60}ms`,
                  }}
                  onMouseEnter={() => handleSegmentEnter(i)}
                />
              ))}
            </g>
          </svg>
          <div className="hd-donut-center">
            <div
              className={`hd-donut-center__layer ${
                activeIdx == null ? 'hd-donut-center__layer--visible' : ''
              }`}
            >
              <span
                className="hd-donut-center__val"
                style={isOver ? { color: 'var(--warning, #EF9F27)' } : undefined}
              >
                {cal.toLocaleString()}
              </span>
              <span className="hd-donut-center__label">{centerLabel}</span>
            </div>
            <div
              className={`hd-donut-center__layer ${
                activeIdx != null ? 'hd-donut-center__layer--visible' : ''
              }`}
              aria-hidden={activeIdx == null}
            >
              <span
                className="hd-donut-center__val"
                style={activeCenterColor ? { color: activeCenterColor } : undefined}
              >
                {activeCenterVal}
              </span>
              <span className="hd-donut-center__label">{activeCenterLabel}</span>
            </div>
          </div>
        </div>
        <div className="hd-macro-legend">
          {[
            { name: 'Protein', g: pro, goal: goalPlan?.protein, color: 'var(--color-protein, #7F77DD)' },
            { name: 'Carbs', g: carbs, goal: goalPlan?.carbs, color: 'var(--color-carbs, var(--accent))' },
            { name: 'Fat', g: fat, goal: goalPlan?.fat, color: 'var(--color-fat, #D85A30)' },
          ].map(({ name, g, goal, color }) => (
            <div key={name} className="hd-macro-legend__row">
              <span className="hd-macro-legend__left">
                <span className="hd-macro-legend__swatch" style={{ background: color }} />
                {name}
              </span>
              <span className="hd-macro-legend__right">
                <strong>{Math.round((name === 'Fat' ? g * 9 : g * 4) / Math.max(cal, 1) * 100)}%</strong>
                <span className="hd-macro-legend__sub">{g}{goal ? ` / ${goal}g` : 'g'}</span>
              </span>
            </div>
          ))}
          <div className="hd-macro-legend__divider" />
          <div className="hd-macro-legend__row">
            <span className="hd-macro-legend__left">
              <span className="hd-macro-legend__swatch" style={{ background: 'var(--warning, #EF9F27)' }} />
              Remaining
            </span>
            <span className="hd-macro-legend__right">
              <strong style={{ color: 'var(--warning, #EF9F27)' }}>{remaining}</strong>
              <span className="hd-macro-legend__sub">kcal left</span>
            </span>
          </div>
        </div>
      </div>
      <div
        className={`hd-donut-tooltip ${donutTip && donutTip.x ? 'hd-donut-tooltip--visible' : ''}`}
        style={{ left: donutTip?.x ?? 0, top: donutTip?.y ?? 0 }}
      >
        <div className="hd-donut-tooltip__name">{donutTip?.name}</div>
        <div className="hd-donut-tooltip__val" style={{ color: donutTip?.color }}>{donutTip?.value}</div>
        {donutTip?.sub && <div className="hd-donut-tooltip__sub">{donutTip.sub}</div>}
      </div>
    </motion.div>
  );
}

/* ============================================================
   CONSISTENCY CARD (bottom row)
   ============================================================ */
function ConsistencyCard({ userId, streak }) {
  const today = new Date();
  const todayKey = fmtDate(today);
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [nutritionDays, setNutritionDays] = useState({});
  const [workoutDays, setWorkoutDays] = useState({});
  const [tooltip, setTooltip] = useState(null);
  const tooltipTimer = useRef(null);

  useEffect(() => {
    if (!userId) return;
    const mm = String(viewMonth + 1).padStart(2, '0');
    const last = new Date(viewYear, viewMonth + 1, 0).getDate();
    const first = `${viewYear}-${mm}-01`;
    const end = `${viewYear}-${mm}-${String(last).padStart(2, '0')}`;
    (async () => {
      const [{ data: foods }, { data: workouts }] = await Promise.all([
        supabase.from('food_logs').select('logged_date, calories')
          .eq('user_id', userId).gte('logged_date', first).lte('logged_date', end),
        supabase.from('workouts').select('workout_date, workout_name')
          .eq('user_id', userId).gte('workout_date', first).lte('workout_date', end),
      ]);
      const nMap = {};
      (foods || []).forEach((f) => {
        if (!nMap[f.logged_date]) nMap[f.logged_date] = { calories: 0 };
        nMap[f.logged_date].calories += Number(f.calories) || 0;
      });
      setNutritionDays(nMap);
      // Multiple workouts can share a date (e.g. cardio + lift). Keep all of
      // them so the tooltip lists each one instead of silently overwriting.
      const wMap = {};
      (workouts || []).forEach((w) => {
        const name = w.workout_name || 'Workout';
        if (!wMap[w.workout_date]) wMap[w.workout_date] = [];
        wMap[w.workout_date].push(name);
      });
      setWorkoutDays(wMap);
    })();
  }, [userId, viewMonth, viewYear]);

  const goBack = () => {
    if (viewMonth === 0) { setViewYear((y) => y - 1); setViewMonth(11); }
    else setViewMonth((m) => m - 1);
  };
  const goForward = () => {
    if (viewYear === today.getFullYear() && viewMonth === today.getMonth()) return;
    if (viewMonth === 11) { setViewYear((y) => y + 1); setViewMonth(0); }
    else setViewMonth((m) => m + 1);
  };
  const isCurrentMonth = viewYear === today.getFullYear() && viewMonth === today.getMonth();

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const startWeekday = new Date(viewYear, viewMonth, 1).getDay();
  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleString('default', { month: 'long', year: 'numeric' });

  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const getDayClass = (day) => {
    const key = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const isToday = key === todayKey;
    const isFuture = new Date(viewYear, viewMonth, day) > today;
    const hasN = !!nutritionDays[key];
    const hasW = !!workoutDays[key];
    if (isFuture) return 'cw-day--future';
    if (isToday && hasN && hasW) return 'cw-day--today cw-day--both';
    if (isToday && (hasN || hasW)) return 'cw-day--today cw-day--partial';
    if (isToday) return 'cw-day--today';
    if (hasN && hasW) return 'cw-day--both';
    if (hasN) return 'cw-day--nutrition';
    if (hasW) return 'cw-day--workout';
    return 'cw-day--empty';
  };

  const getDayIndicator = (day) => {
    const key = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const hasN = !!nutritionDays[key];
    const hasW = !!workoutDays[key];
    if (hasN && hasW) return 'both';
    if (hasN) return 'nutrition';
    if (hasW) return 'workout';
    return null;
  };

  const showTooltip = (day, e) => {
    clearTimeout(tooltipTimer.current);
    const key = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const hasN = !!nutritionDays[key];
    const hasW = !!workoutDays[key];
    if (!hasN && !hasW) { setTooltip(null); return; }
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltip({
      x: rect.left + rect.width / 2,
      y: rect.top - 4,
      date: new Date(viewYear, viewMonth, day).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
      cal: hasN ? Math.round(nutritionDays[key].calories) : null,
      workout: hasW ? workoutDays[key] : null,
    });
  };

  const hideTooltip = () => {
    clearTimeout(tooltipTimer.current);
    tooltipTimer.current = setTimeout(() => setTooltip(null), 200);
  };

  let bothCount = 0, workoutCount = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    if (nutritionDays[key] && workoutDays[key]) bothCount++;
    if (workoutDays[key]) workoutCount++;
  }
  const daysElapsed = isCurrentMonth ? today.getDate() : daysInMonth;
  const completionPct = daysElapsed > 0 ? Math.round((bothCount / daysElapsed) * 100) : 0;

  return (
    <>
      <motion.div className="hd-card" variants={itemVariants}>
        <div className="hd-card__head">
          <span className="hd-card__title">Consistency</span>
          <div className="cw__nav">
            <button onClick={goBack}><ChevronLeft size={14} /></button>
            <span className="cw__month-label">{monthLabel}</span>
            <button onClick={goForward} disabled={isCurrentMonth} style={isCurrentMonth ? { opacity: 0.3 } : undefined}>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
        <div className="cw__weekdays">{['S','M','T','W','T','F','S'].map((d,i) => <span key={i}>{d}</span>)}</div>
        <div className="cw__grid">
          {cells.map((day, i) => {
            if (!day) return <div key={i} className="cw-day cw-day--blank" />;
            const cls = getDayClass(day);
            const indicator = getDayIndicator(day);
            return (
              <div key={i} className={`cw-day ${cls}`} onMouseEnter={(e) => showTooltip(day, e)} onMouseLeave={hideTooltip} onClick={(e) => showTooltip(day, e)}>
                <span className="cw-day__num">{day}</span>
                {indicator === 'both' && <div className="cw-day__dots"><span className="cw-day__indicator" /><span className="cw-day__indicator" /></div>}
                {(indicator === 'nutrition' || indicator === 'workout') && <span className="cw-day__indicator cw-day__indicator--single" />}
              </div>
            );
          })}
        </div>
        <div className="cw__legend">
          <div className="cw__legend-items">
            <span className="cw__legend-item"><span className="cw__legend-dot cw__legend-dot--full" />Both</span>
            <span className="cw__legend-item"><span className="cw__legend-dot cw__legend-dot--half" />Partial</span>
            <span className="cw__legend-item"><span className="cw__legend-dot cw__legend-dot--none" />Missed</span>
          </div>
          <span className="cw__legend-stat">{completionPct}% this month</span>
        </div>
      </motion.div>
      {tooltip && (
        <div className="cw__tooltip" style={{ top: tooltip.y, left: tooltip.x, transform: 'translate(-50%, -100%)' }}>
          <div className="cw__tooltip-date">{tooltip.date}</div>
          {tooltip.cal != null ? (
            <div className="cw__tooltip-row"><UtensilsCrossed size={10} /> {tooltip.cal.toLocaleString()} kcal</div>
          ) : (
            <div className="cw__tooltip-row cw__tooltip-row--muted">Not logged</div>
          )}
          {Array.isArray(tooltip.workout) && tooltip.workout.length > 0 ? (
            tooltip.workout.map((name, i) => (
              <div key={i} className="cw__tooltip-row"><Dumbbell size={10} /> {name}</div>
            ))
          ) : (
            <div className="cw__tooltip-row cw__tooltip-row--muted">Not logged</div>
          )}
        </div>
      )}
    </>
  );
}

/* ============================================================
   DASHBOARD — main export
   ============================================================ */
export default function Dashboard() {
  const navigate = useNavigate();
  const { plan, isPro } = usePlan();
  const { isSpectrum, isRetro } = useTheme();
  const now = new Date();
  const hour = now.getHours();
  const todayStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const greeting = getGreeting(hour);

  const [session, setSession] = useState(null);
  const [streak, setStreak] = useState(0);
  const [displayName, setDisplayName] = useState('');

  // Nutrition state
  const [todayNutrition, setTodayNutrition] = useState({ calories: 0, protein: 0, carbs: 0, fat: 0 });
  const [goalPlan, setGoalPlan] = useState(null);

  // Workout count this week
  const [weekWorkouts, setWeekWorkouts] = useState(0);

  // ── Action-first desktop state (additive, no impact on mobile) ──
  // Last 30 days of `progress` rows for the weight-trend card.
  const [progressRows, setProgressRows] = useState([]);
  // Time-range pill for the macro bars (Today / 7D-avg / 30D-avg).
  // Mirrors MacroDonut's internal range/avgData pattern.
  const [macroRange, setMacroRange] = useState('today');
  const [macroAvgData, setMacroAvgData] = useState(null);


  // Session
  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      const sess = data?.session ?? null;
      setSession(sess);
      if (sess?.user?.id) {
        const s = await getStreak(sess.user.id);
        if (mounted) setStreak(s);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const userId = session?.user?.id;

  // Fetch profile display_name for the greeting
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    supabase.from('profiles').select('display_name').eq('id', userId).maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setDisplayName(data?.display_name?.trim() || '');
      });
    return () => { cancelled = true; };
  }, [userId]);

  // Fetch goals + today's food totals
  useEffect(() => {
    if (!userId) return;
    const todayDate = fmtDate(new Date());

    async function load() {
      const [{ data: goal }, { data: logs }] = await Promise.all([
        supabase.from('goals').select('calories, protein, carbs, fat').eq('user_id', userId).maybeSingle(),
        supabase.from('food_logs').select('calories, protein_g, carbs_g, fat_g').eq('user_id', userId).eq('logged_date', todayDate),
      ]);

      setGoalPlan(goal || null);
      if (logs && logs.length) {
        setTodayNutrition({
          calories: Math.round(logs.reduce((s, r) => s + (r.calories || 0), 0)),
          protein: Math.round(logs.reduce((s, r) => s + (r.protein_g || 0), 0)),
          carbs: Math.round(logs.reduce((s, r) => s + (r.carbs_g || 0), 0)),
          fat: Math.round(logs.reduce((s, r) => s + (r.fat_g || 0), 0)),
        });
      }
    }

    load();

    // Realtime subscription for live updates
    const channel = supabase
      .channel(`food_logs_dashboard_${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'food_logs', filter: `user_id=eq.${userId}` }, () => {
        load();
        invalidateStreakCache(userId);
        getStreak(userId).then(setStreak);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  // Fetch this week's workout count
  useEffect(() => {
    if (!userId) return;
    const { start, end } = getWeekRange();
    (async () => {
      const { data } = await supabase
        .from('workouts')
        .select('id')
        .eq('user_id', userId)
        .gte('workout_date', start)
        .lte('workout_date', end);
      setWeekWorkouts(data?.length || 0);
    })();
  }, [userId]);

  /* Additive: progress rows for the desktop Weight trend card.
     Last 30 days, desc. weight_kg is stored as lbs (DB naming
     quirk acknowledged in ProgressCharts.jsx). */
  useEffect(() => {
    if (!userId) return;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    (async () => {
      const { data } = await supabase
        .from('progress')
        .select('date, weight_kg')
        .eq('user_id', userId)
        .gte('date', fmtDate(cutoff))
        .order('date', { ascending: false })
        .limit(30);
      setProgressRows(data || []);
    })();
  }, [userId]);

  /* Additive: macro 7D / 30D averages, computed only when the
     corresponding pill is active. Direct port of MacroDonut's
     avg fetch — same query, same averaging. Today uses the
     existing todayNutrition state (no extra round-trip). */
  useEffect(() => {
    if (!userId || macroRange === 'today') { setMacroAvgData(null); return; }
    const days = macroRange === '7d' ? 7 : 30;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    (async () => {
      const { data } = await supabase
        .from('food_logs')
        .select('logged_date, calories, protein_g, carbs_g, fat_g')
        .eq('user_id', userId)
        .gte('logged_date', fmtDate(cutoff));
      if (data && data.length) {
        const totals = data.reduce((a, r) => ({
          cal: a.cal + (r.calories || 0),
          pro: a.pro + (r.protein_g || 0),
          carb: a.carb + (r.carbs_g || 0),
          fat: a.fat + (r.fat_g || 0),
        }), { cal: 0, pro: 0, carb: 0, fat: 0 });
        const uniqueDays = new Set(data.map((r) => r.logged_date)).size;
        const divisor = Math.max(uniqueDays, 1);
        setMacroAvgData({
          calories: Math.round(totals.cal / divisor),
          protein: Math.round(totals.pro / divisor),
          carbs: Math.round(totals.carb / divisor),
          fat: Math.round(totals.fat / divisor),
        });
      } else {
        setMacroAvgData({ calories: 0, protein: 0, carbs: 0, fat: 0 });
      }
    })();
  }, [userId, macroRange]);


  // Stat card computations
  const calGoal = goalPlan?.calories;
  const proGoal = goalPlan?.protein;
  const calDelta = calGoal != null
    ? todayNutrition.calories <= calGoal
      ? { text: `${(calGoal - todayNutrition.calories).toLocaleString()} kcal remaining`, color: '--accent-light' }
      : { text: `${(todayNutrition.calories - calGoal).toLocaleString()} kcal over`, color: '--warning' }
    : null;

  const proPct = proGoal ? todayNutrition.protein / proGoal : 0;
  const proDelta = proGoal
    ? proPct >= 0.9
      ? { text: 'on track for goal', color: '--accent-light' }
      : proPct >= 0.6
        ? { text: `${proGoal - todayNutrition.protein}g to go`, color: '--warning' }
        : { text: `${proGoal - todayNutrition.protein}g remaining`, color: '--text-muted' }
    : null;

  // Get user first name — prefer profiles.display_name, fall back to
  // auth user_metadata so users who set their name during signup still
  // see it before the profile fetch settles.
  const firstName = (displayName && displayName.split(' ')[0])
    || session?.user?.user_metadata?.first_name
    || session?.user?.user_metadata?.full_name?.split(' ')[0]
    || '';

  /* ── Action-first desktop derived data ──
     Computed inline at render so the food_logs realtime push
     (which mutates todayNutrition) automatically re-derives the
     greeting subtitle, action card subtitles, and macro bars. */

  // Smart greeting: data-driven subtitle. Priority order:
  //   1. no calorie goal set → onboarding nudge
  //   2. nothing logged today → fresh-day copy with next-meal window
  //   3. day complete (cal >= goal) → "Day logged"
  //   4. within 300 kcal of target → "Within range" (any time of day, priority)
  //   5. evening + within 400 kcal of target → "Within range… before bed"
  //   6. otherwise → "X kcal under, next-meal is next window"
  const greetingCtx = (() => {
    let g;
    if (hour >= 5 && hour < 12) g = 'Morning';
    else if (hour >= 12 && hour < 17) g = 'Afternoon';
    else if (hour >= 17 && hour < 21) g = 'Evening';
    else g = 'Night owl';

    const cal = todayNutrition.calories;
    const gl = goalPlan?.calories;
    const remaining = gl ? gl - cal : null;
    const nextMeal = getNextMealLabel();

    // The kcal phrase ("930 kcal", "540 kcal under", etc.) renders in
    // teal via `.hd-d-greeting__sub-accent`. The surrounding sentence
    // stays in the default muted color. Mobile uses its own
    // `.hd-m-nutrition__remaining-value` for the same effect.
    const accent = (text) => <span className="hd-d-greeting__sub-accent">{text}</span>;

    let sub;
    if (!gl) {
      sub = 'Pick a calorie goal to get started.';
    } else if (cal === 0) {
      sub = <>Fresh day. {accent(`${gl.toLocaleString()} kcal`)} to spend. {nextMeal} is your first window.</>;
    } else if (cal >= gl) {
      sub = 'Day logged. Nice work.';
    } else if (remaining < 300 && remaining > 0) {
      // Priority: midday near-target. Triggers any time of day.
      sub = <>Within range. {accent(`${remaining} kcal`)} left for the rest of the day.</>;
    } else if (remaining < 400 && hour >= 17) {
      sub = <>Within range. {accent(`${remaining} kcal`)} left before bed.</>;
    } else if (remaining > 0) {
      sub = <>You're {accent(`${remaining.toLocaleString()} kcal under`)}. {nextMeal} is the next big window.</>;
    } else {
      sub = 'Day logged. Nice work.';
    }
    return { greeting: g, sub };
  })();

  /* Macro display: pick today or the active 7D/30D avg. */
  const macroSrc = macroRange === 'today' ? todayNutrition : (macroAvgData || { calories: 0, protein: 0, carbs: 0, fat: 0 });
  const macroPro = macroSrc.protein || 0;
  const macroCarb = macroSrc.carbs || 0;
  const macroFat = macroSrc.fat || 0;
  const macroCal = macroSrc.calories || 0;
  const macroProGoal = goalPlan?.protein || 0;
  const macroCarbGoal = goalPlan?.carbs || 0;
  const macroFatGoal = goalPlan?.fat || 0;

  /* Weight trend: latest, 30-day delta, sparkline points. */
  const weightSeries = progressRows
    .filter((r) => r.weight_kg != null && r.weight_kg !== '')
    .map((r) => ({ date: r.date, weight: Number(r.weight_kg) })); // desc
  const currentWeight = weightSeries[0]?.weight ?? null;
  const oldestWeight = weightSeries[weightSeries.length - 1]?.weight ?? null;
  const weightDelta30 = currentWeight != null && oldestWeight != null && weightSeries.length >= 2
    ? currentWeight - oldestWeight
    : null;
  const lastWeightAgo = weightSeries[0]?.date ? fmtAgo(weightSeries[0].date) : null;
  // Sparkline points (oldest → newest, for left-to-right SVG)
  const sparkAscending = weightSeries.slice().reverse();

  /* Helpers for desktop JSX (kept inline so they have closure
     access to derived state above). */
  const formatTime = () => {
    const h12 = ((now.getHours() + 11) % 12) + 1;
    const mm = String(now.getMinutes()).padStart(2, '0');
    const ampm = now.getHours() >= 12 ? 'PM' : 'AM';
    return `${h12}:${mm} ${ampm}`;
  };
  const dayName = now.toLocaleDateString('en-US', { weekday: 'long' });

  const macroProPct = macroProGoal > 0 ? Math.min(100, Math.round((macroPro / macroProGoal) * 100)) : 0;
  const macroCarbPct = macroCarbGoal > 0 ? Math.min(100, Math.round((macroCarb / macroCarbGoal) * 100)) : 0;
  const macroFatPct = macroFatGoal > 0 ? Math.min(100, Math.round((macroFat / macroFatGoal) * 100)) : 0;

  // 7-cell weekly progress strip — fill first N cells (day-specific
  // accuracy is a follow-up phase per user direction).
  const weekCells = Array.from({ length: 7 }, (_, i) => i < weekWorkouts);

  // Weight-trend sparkline path. Normalize y-values to viewBox.
  const spark = (() => {
    if (sparkAscending.length < 2) return null;
    const weights = sparkAscending.map((p) => p.weight);
    const min = Math.min(...weights);
    const max = Math.max(...weights);
    const range = max - min || 1;
    const stepX = 240 / (sparkAscending.length - 1);
    return sparkAscending
      .map((p, i) => `${(i * stepX).toFixed(1)},${(25 - ((p.weight - min) / range) * 20).toFixed(1)}`)
      .join(' ');
  })();

  /* Mobile variants — same data, smaller viewBox + freshness flag. */
  const isRecentWeight = weightSeries[0]?.date
    ? (Date.now() - new Date(weightSeries[0].date + 'T00:00:00').getTime()) / (1000 * 60 * 60 * 24) <= 7
    : false;

  const sparkMobile = (() => {
    if (sparkAscending.length < 2) return null;
    const weights = sparkAscending.map((p) => p.weight);
    const min = Math.min(...weights);
    const max = Math.max(...weights);
    const range = max - min || 1;
    const stepX = 120 / (sparkAscending.length - 1);
    return sparkAscending
      .map((p, i) => `${(i * stepX).toFixed(1)},${(13 - ((p.weight - min) / range) * 11).toFixed(1)}`)
      .join(' ');
  })();

  return (
    <div className="hd">
      {/* ============================================================
          DESKTOP: action-first layout (visible at ≥768px via CSS)
          ============================================================ */}
      <div className="hd-desktop">
        {/* Section 1: Greeting bar */}
        <div className="hd-d-greeting">
          <div>
            <div className="hd-d-greeting__kicker">
              <span className="hd-d-greeting__kicker-dot" />
              <span>{dayName} · {formatTime()}</span>
            </div>
            <h1 className="hd-d-greeting__name">
              {greetingCtx.greeting}{firstName ? `, ${firstName}` : ''}.
            </h1>
            <p className="hd-d-greeting__sub">{greetingCtx.sub}</p>
          </div>
          {streak > 0 && (
            <div className="hd-d-greeting__streak-pill" title={`${streak} day streak`}>
              <span className="hd-d-greeting__streak-flame" aria-hidden="true">🔥</span>
              <span className="hd-d-greeting__streak-num">{streak}</span>
              <span className="hd-d-greeting__streak-label">day streak</span>
            </div>
          )}
        </div>

        {/* Section 2: Three action cards */}
        <div className="hd-d-actions">
          <button
            type="button"
            className="hd-d-action hd-d-action--primary"
            onClick={() => navigate('/goalplanner', { state: { spotlight: 'nutrition' } })}
          >
            <div className="hd-d-action__head">
              <span className="hd-d-action__icon"><UtensilsCrossed size={20} /></span>
              <span className="hd-d-action__kicker">Log a meal</span>
            </div>
            <div className="hd-d-action__row">
              <h3 className="hd-d-action__title">{getNextMealLabel()}</h3>
              <span className="hd-d-action__arrow">→</span>
            </div>
            <p className="hd-d-action__sub">scan, search, or pick from your plan</p>
          </button>

          <button
            type="button"
            className="hd-d-action"
            onClick={() => navigate('/workouts')}
          >
            <div className="hd-d-action__head">
              <span className="hd-d-action__icon"><Dumbbell size={20} /></span>
              <span className="hd-d-action__kicker">Log a workout</span>
            </div>
            <div className="hd-d-action__row">
              <h3 className="hd-d-action__title">Workout</h3>
              <span className="hd-d-action__arrow">→</span>
            </div>
            <p className="hd-d-action__sub">pick a template or start fresh</p>
          </button>

          <button
            type="button"
            className="hd-d-action"
            onClick={() => navigate('/progress')}
          >
            <div className="hd-d-action__head">
              <span className="hd-d-action__icon"><Scale size={20} /></span>
              <span className="hd-d-action__kicker">Log weight</span>
            </div>
            <div className="hd-d-action__row">
              <h3 className="hd-d-action__title">Daily</h3>
              <span className="hd-d-action__arrow">→</span>
            </div>
            <p className="hd-d-action__sub">
              {lastWeightAgo && currentWeight != null
                ? `last logged ${lastWeightAgo} · ${currentWeight.toFixed(1)} lb`
                : 'no entries yet'}
            </p>
          </button>
        </div>

        {/* Section 3: Today's nutrition card */}
        <div className="hd-d-nutrition">
          <div className="hd-d-nutrition__head">
            <div>
              <div className="hd-d-nutrition__label">
                {macroRange === 'today' ? "Today's nutrition" : macroRange === '7d' ? '7-day average' : '30-day average'}
              </div>
              <div className="hd-d-nutrition__kcal">
                <span className="hd-d-nutrition__kcal-current">
                  {macroCal === 0 && macroRange === 'today' ? '—' : macroCal.toLocaleString()}
                </span>
                <span className="hd-d-nutrition__kcal-target">
                  / {calGoal ? calGoal.toLocaleString() : '—'} kcal
                </span>
              </div>
            </div>
            <div className="hd-d-nutrition__pills">
              {['today', '7d', '30d'].map((k) => (
                <button
                  key={k}
                  type="button"
                  className={`hd-d-nutrition__pill ${macroRange === k ? 'hd-d-nutrition__pill--active' : ''}`}
                  onClick={() => setMacroRange(k)}
                >
                  {k === 'today' ? 'Today' : k === '7d' ? '7D' : '30D'}
                </button>
              ))}
            </div>
          </div>

          <div className="hd-d-nutrition__bars">
            {/* Protein */}
            <div className="hd-d-macro-bar">
              <div className="hd-d-macro-bar__head">
                <span className="hd-d-macro-bar__label">
                  <span className={`hd-d-macro-bar__dot hd-d-macro-bar__dot--protein ${macroPro === 0 ? 'hd-d-macro-bar__dot--empty' : ''}`} />
                  Protein
                </span>
                <span className="hd-d-macro-bar__num">{macroPro} / {macroProGoal}g</span>
              </div>
              <div className="hd-d-macro-bar__track">
                <div className="hd-d-macro-bar__fill hd-d-macro-bar__fill--protein" style={{ width: `${macroProPct}%` }} />
              </div>
            </div>
            {/* Carbs */}
            <div className="hd-d-macro-bar">
              <div className="hd-d-macro-bar__head">
                <span className="hd-d-macro-bar__label">
                  <span className={`hd-d-macro-bar__dot hd-d-macro-bar__dot--carbs ${macroCarb === 0 ? 'hd-d-macro-bar__dot--empty' : ''}`} />
                  Carbs
                </span>
                <span className="hd-d-macro-bar__num">{macroCarb} / {macroCarbGoal}g</span>
              </div>
              <div className="hd-d-macro-bar__track">
                <div className="hd-d-macro-bar__fill hd-d-macro-bar__fill--carbs" style={{ width: `${macroCarbPct}%` }} />
              </div>
            </div>
            {/* Fat */}
            <div className="hd-d-macro-bar">
              <div className="hd-d-macro-bar__head">
                <span className="hd-d-macro-bar__label">
                  <span className={`hd-d-macro-bar__dot hd-d-macro-bar__dot--fat ${macroFat === 0 ? 'hd-d-macro-bar__dot--empty' : ''}`} />
                  Fat
                </span>
                <span className="hd-d-macro-bar__num">{macroFat} / {macroFatGoal}g</span>
              </div>
              <div className="hd-d-macro-bar__track">
                <div className="hd-d-macro-bar__fill hd-d-macro-bar__fill--fat" style={{ width: `${macroFatPct}%` }} />
              </div>
            </div>
          </div>
        </div>

        {/* Section 4: 50/50 row — This week + Weight trend */}
        <div className="hd-d-row">
          {/* This week */}
          <div className="hd-d-card">
            <div className="hd-d-card__head">
              <div className="hd-d-card__label">This week</div>
              <span className={`hd-d-card__badge ${weekWorkouts === 0 ? 'hd-d-card__badge--muted' : ''}`}>
                {weekWorkouts === 0 ? 'starting fresh' : 'on track'}
              </span>
            </div>
            <div className="hd-d-card__big">
              <span className="hd-d-card__big-num">{weekWorkouts}</span>
              <span className="hd-d-card__sub">of 4 workouts logged</span>
            </div>
            <div className="hd-d-card__week-strip">
              {weekCells.map((on, i) => (
                <div
                  key={i}
                  className={`hd-d-card__week-cell ${on ? 'hd-d-card__week-cell--filled' : ''}`}
                />
              ))}
            </div>
          </div>

          {/* Weight trend */}
          <div className="hd-d-card">
            <div className="hd-d-card__head">
              <div className="hd-d-card__label">Weight trend</div>
              {weightDelta30 != null && (
                <span className="hd-d-card__badge">
                  {weightDelta30 < 0 ? '−' : '+'}{Math.abs(weightDelta30).toFixed(1)} lb / 30d
                </span>
              )}
            </div>
            {currentWeight != null ? (
              <>
                <div className="hd-d-card__big">
                  <span className="hd-d-card__big-num">
                    {currentWeight.toFixed(1)}
                    <span className="hd-d-card__big-unit">lb</span>
                  </span>
                </div>
                {spark && (
                  <svg className="hd-d-card__spark" viewBox="0 0 240 30" preserveAspectRatio="none">
                    <polyline points={spark} fill="none" stroke="var(--accent-light)" strokeWidth="1.5" />
                  </svg>
                )}
              </>
            ) : (
              <>
                <div className="hd-d-card__big">
                  <span className="hd-d-card__big-num">—</span>
                </div>
                <button
                  type="button"
                  className="hd-d-card__cta"
                  onClick={() => navigate('/progress')}
                >
                  Add your first weight →
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ============================================================
          MOBILE: new mobile-rethink layout (visible at <768px)
          ============================================================ */}
      <div className="hd-mobile">

        {/* Streak strip — only when streak > 0. The AppShell's
            mob-topbar already renders the brand + avatar at the
            very top of the viewport, so we add only the streak
            pill here to avoid duplicating UI. */}
        {streak > 0 && (
          <div className="hd-m-streak-row">
            <div className="hd-m-streak-pill" title={`${streak} day streak`}>
              <span aria-hidden="true">🔥</span>
              <span className="hd-m-streak-pill__num">{streak}d</span>
            </div>
          </div>
        )}

        {/* Nutrition card — kicker, big kcal, donut ring, macro bars */}
        <div className="hd-m-nutrition">
          <div className="hd-m-nutrition__kicker">
            <span className="hd-m-nutrition__kicker-dot" />
            <span className="hd-m-nutrition__kicker-text">{formatTime()} · {greetingCtx.greeting}</span>
          </div>
          <div className="hd-m-nutrition__main">
            <div className="hd-m-nutrition__main-left">
              <div className="hd-m-nutrition__label">Calories today</div>
              <div className={`hd-m-nutrition__kcal ${todayNutrition.calories === 0 ? 'hd-m-nutrition__kcal--empty' : ''}`}>
                {todayNutrition.calories === 0 ? '—' : todayNutrition.calories.toLocaleString()}
              </div>
              <div className="hd-m-nutrition__remaining">
                {todayNutrition.calories === 0 ? (
                  calGoal ? (
                    <>
                      <span className="hd-m-nutrition__remaining-value hd-m-nutrition__remaining-value--muted">
                        {calGoal.toLocaleString()} kcal
                      </span>{' '}
                      to spend
                    </>
                  ) : (
                    'Set a calorie goal to get started.'
                  )
                ) : calGoal ? (
                  <>
                    <span className="hd-m-nutrition__remaining-value">
                      {Math.max(0, calGoal - todayNutrition.calories).toLocaleString()} kcal
                    </span>{' '}
                    left · {calGoal.toLocaleString()} target
                  </>
                ) : (
                  `${todayNutrition.calories.toLocaleString()} logged`
                )}
              </div>
            </div>
            <svg className="hd-m-nutrition__ring" viewBox="0 0 100 100" aria-hidden="true">
              <circle className="hd-m-nutrition__ring-track" cx="50" cy="50" r="42" />
              {todayNutrition.calories > 0 && calGoal > 0 && (
                <circle
                  className="hd-m-nutrition__ring-fill"
                  cx="50" cy="50" r="42"
                  style={{
                    strokeDashoffset: 264 - 264 * Math.min(1, todayNutrition.calories / calGoal),
                  }}
                />
              )}
            </svg>
          </div>
          <div className="hd-m-nutrition__bars">
            {/* Protein */}
            <div className="hd-m-macro-row">
              <div className="hd-m-macro-row__head">
                <span className="hd-m-macro-row__label">
                  <span className={`hd-m-macro-row__dot hd-m-macro-row__dot--protein ${todayNutrition.protein === 0 ? 'hd-m-macro-row__dot--empty' : ''}`} />
                  Protein
                </span>
                <span className="hd-m-macro-row__values">
                  {todayNutrition.protein}
                  <span className="hd-m-macro-row__values-target">/{macroProGoal}g</span>
                </span>
              </div>
              <div className="hd-m-macro-row__track">
                <div
                  className="hd-m-macro-row__fill hd-m-macro-row__fill--protein"
                  style={{ width: `${macroProGoal > 0 ? Math.min(100, (todayNutrition.protein / macroProGoal) * 100) : 0}%` }}
                />
              </div>
            </div>
            {/* Carbs */}
            <div className="hd-m-macro-row">
              <div className="hd-m-macro-row__head">
                <span className="hd-m-macro-row__label">
                  <span className={`hd-m-macro-row__dot hd-m-macro-row__dot--carbs ${todayNutrition.carbs === 0 ? 'hd-m-macro-row__dot--empty' : ''}`} />
                  Carbs
                </span>
                <span className="hd-m-macro-row__values">
                  {todayNutrition.carbs}
                  <span className="hd-m-macro-row__values-target">/{macroCarbGoal}g</span>
                </span>
              </div>
              <div className="hd-m-macro-row__track">
                <div
                  className="hd-m-macro-row__fill hd-m-macro-row__fill--carbs"
                  style={{ width: `${macroCarbGoal > 0 ? Math.min(100, (todayNutrition.carbs / macroCarbGoal) * 100) : 0}%` }}
                />
              </div>
            </div>
            {/* Fat */}
            <div className="hd-m-macro-row">
              <div className="hd-m-macro-row__head">
                <span className="hd-m-macro-row__label">
                  <span className={`hd-m-macro-row__dot hd-m-macro-row__dot--fat ${todayNutrition.fat === 0 ? 'hd-m-macro-row__dot--empty' : ''}`} />
                  Fat
                </span>
                <span className="hd-m-macro-row__values">
                  {todayNutrition.fat}
                  <span className="hd-m-macro-row__values-target">/{macroFatGoal}g</span>
                </span>
              </div>
              <div className="hd-m-macro-row__track">
                <div
                  className="hd-m-macro-row__fill hd-m-macro-row__fill--fat"
                  style={{ width: `${macroFatGoal > 0 ? Math.min(100, (todayNutrition.fat / macroFatGoal) * 100) : 0}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Status row — This week + Weight */}
        <div className="hd-m-status-row">
          {/* This week */}
          <div className="hd-m-status-card">
            <div className="hd-m-status-card__label">This week</div>
            <div className="hd-m-status-card__value">
              {weekWorkouts}<span className="hd-m-status-card__value-sub">/4</span>
            </div>
            <div className="hd-m-status-card__caption">
              {weekWorkouts === 0 ? 'starting fresh' : 'workouts logged'}
            </div>
            <div className="hd-m-status-card__strip">
              {weekCells.map((on, i) => (
                <div
                  key={i}
                  className={`hd-m-status-card__strip-cell ${on ? 'hd-m-status-card__strip-cell--filled' : ''}`}
                />
              ))}
            </div>
          </div>

          {/* Weight */}
          <div className="hd-m-status-card">
            <div className="hd-m-status-card__label">Weight</div>
            {currentWeight != null ? (
              <>
                <div className="hd-m-status-card__value">
                  {currentWeight.toFixed(1)}<span className="hd-m-status-card__value-sub"> lb</span>
                </div>
                <div className={`hd-m-status-card__caption ${isRecentWeight && weightDelta30 != null ? 'hd-m-status-card__caption--accent' : ''}`}>
                  {isRecentWeight && weightDelta30 != null
                    ? `${weightDelta30 < 0 ? '−' : '+'}${Math.abs(weightDelta30).toFixed(1)} lb / 30d`
                    : `last ${lastWeightAgo}`}
                </div>
                {sparkMobile && (
                  <svg className="hd-m-status-card__spark" viewBox="0 0 120 16" preserveAspectRatio="none">
                    <polyline
                      points={sparkMobile}
                      fill="none"
                      stroke="var(--accent-light)"
                      strokeWidth="1.3"
                      opacity={isRecentWeight ? 1 : 0.5}
                    />
                  </svg>
                )}
              </>
            ) : (
              <>
                <div className="hd-m-status-card__value">—</div>
                <button
                  type="button"
                  className="hd-m-status-card__cta"
                  onClick={() => navigate('/progress')}
                >
                  Add your first weight →
                </button>
              </>
            )}
          </div>
        </div>

        {/* Quick actions — primary card + 2 secondary squares */}
        <div className="hd-m-actions">
          <div className="hd-m-actions__heading">Quick actions</div>

          <button
            type="button"
            className="hd-m-action-primary"
            onClick={() => navigate('/goalplanner', { state: { spotlight: 'nutrition' } })}
          >
            <div className="hd-m-action-primary__glow" />
            <div className="hd-m-action-primary__body">
              <div className="hd-m-action-primary__icon"><UtensilsCrossed size={20} /></div>
              <div className="hd-m-action-primary__text">
                <div className="hd-m-action-primary__kicker">
                  {todayNutrition.calories === 0 ? 'Start your day' : 'Next up'}
                </div>
                <div className="hd-m-action-primary__title">
                  Log {getNextMealLabel().toLowerCase()}
                </div>
                <div className="hd-m-action-primary__sub">scan, search, or from your plan</div>
              </div>
              <div className="hd-m-action-primary__arrow">→</div>
            </div>
          </button>

          <div className="hd-m-action-secondary-row">
            <button
              type="button"
              className="hd-m-action-secondary"
              onClick={() => navigate('/workouts')}
            >
              <div className="hd-m-action-secondary__icon-wrap"><Dumbbell size={17} /></div>
              <div className="hd-m-action-secondary__title">Workout</div>
              <div className="hd-m-action-secondary__sub">pick a template</div>
            </button>
            <button
              type="button"
              className="hd-m-action-secondary"
              onClick={() => navigate('/progress')}
            >
              <div className="hd-m-action-secondary__icon-wrap"><Scale size={17} /></div>
              <div className="hd-m-action-secondary__title">Weight</div>
              <div className="hd-m-action-secondary__sub">
                {currentWeight != null && lastWeightAgo
                  ? `last ${Math.round(currentWeight)} lb · ${lastWeightAgo}`
                  : 'no entries yet'}
              </div>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

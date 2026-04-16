import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  TrendingUp, CalendarDays, ChevronLeft, ChevronRight,
  UtensilsCrossed, Dumbbell, Check, PieChart as PieChartIcon,
} from 'lucide-react';
import {
  ResponsiveContainer, PieChart, Pie, Cell, Sector,
} from 'recharts';
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
function StatCard({ label, rawValue, formatted, delta, deltaColor, isY2K, y2kLabel }) {
  const animVal = useCountUp(rawValue);
  const display = typeof formatted === 'function' ? formatted(animVal) : `${animVal.toLocaleString()}`;
  return (
    <motion.div className="hd-stat" variants={itemVariants}>
      {isY2K && y2kLabel && (
        <div className="hd-y2k-chip-bar">
          <span>{y2kLabel}</span>
        </div>
      )}
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

function TodayMealPlan({ userId, onLogged, isY2K }) {
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
      {isY2K && (
        <div className="hd-y2k-titlebar">
          <UtensilsCrossed width={10} height={10} stroke="var(--accent-light)" strokeWidth={2} fill="none" />
          <span>TODAY'S MEAL PLAN</span>
        </div>
      )}
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

function MacroDonut({ userId, todayNutrition, goalPlan, isY2K }) {
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

  const handlePieEnter = (_, index) => {
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

  const handlePieLeave = () => {
    setActiveIdx(null);
    setDonutTip(null);
  };

  const handleDonutMouseMove = (e) => {
    setDonutTip((prev) => prev ? { ...prev, x: e.clientX + 12, y: e.clientY - 12 } : null);
  };

  const centerLabel = range === 'today' ? 'kcal today' : 'kcal avg/day';

  return (
    <motion.div className="hd-card" variants={itemVariants}>
      {isY2K && (
        <div className="hd-y2k-titlebar">
          <PieChartIcon width={10} height={10} stroke="var(--accent-light)" strokeWidth={2} fill="none" />
          <span>MACRO SPLIT</span>
        </div>
      )}
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
      <div className="hd-donut-wrap" onMouseMove={handleDonutMouseMove} onMouseLeave={handlePieLeave}>
        <div className="hd-donut-chart">
          <ResponsiveContainer width={130} height={130}>
            <PieChart>
              <Pie
                data={donutData}
                dataKey="value"
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={60}
                strokeWidth={0}
                paddingAngle={1}
                activeIndex={activeIdx}
                activeShape={(props) => (
                  <Sector {...props} outerRadius={props.outerRadius + 5} />
                )}
                onMouseEnter={handlePieEnter}
                onMouseLeave={handlePieLeave}
              >
                {donutData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="hd-donut-center">
            <span className="hd-donut-center__val" style={isOver ? { color: 'var(--warning, #EF9F27)' } : undefined}>
              {cal.toLocaleString()}
            </span>
            <span className="hd-donut-center__label">{centerLabel}</span>
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
function ConsistencyCard({ userId, streak, isY2K }) {
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
      const wMap = {};
      (workouts || []).forEach((w) => { wMap[w.workout_date] = w.workout_name || 'Workout'; });
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
        {isY2K && (
          <div className="hd-y2k-titlebar">
            <CalendarDays width={10} height={10} stroke="var(--accent-light)" strokeWidth={2} fill="none" />
            <span>CONSISTENCY</span>
          </div>
        )}
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
          {tooltip.workout ? (
            <div className="cw__tooltip-row"><Dumbbell size={10} /> {tooltip.workout}</div>
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
  const { isSpectrum, isRetro, isY2K } = useTheme();
  const now = new Date();
  const hour = now.getHours();
  const todayStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const greeting = getGreeting(hour);

  const [session, setSession] = useState(null);
  const [streak, setStreak] = useState(0);

  // Nutrition state
  const [todayNutrition, setTodayNutrition] = useState({ calories: 0, protein: 0, carbs: 0, fat: 0 });
  const [goalPlan, setGoalPlan] = useState(null);

  // Workout count this week
  const [weekWorkouts, setWeekWorkouts] = useState(0);


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

  // Get user first name from session metadata
  const firstName = session?.user?.user_metadata?.first_name
    || session?.user?.user_metadata?.full_name?.split(' ')[0]
    || '';

  return (
    <div className="hd">
      {/* Page header */}
      <div className="hd__header">
        <div>
          <h1 className="hd__greeting">{greeting}{firstName ? `, ${firstName}` : ''}</h1>
          <p className="hd__date">{todayStr}</p>
        </div>
      </div>

      {/* Main content */}
      <motion.div className="hd__main" variants={containerVariants} initial="hidden" animate="show">
          {/* Stat cards row */}
          <div className="hd-stats-row">
            <StatCard
              label="Calories"
              rawValue={todayNutrition.calories}
              formatted={(v) => v.toLocaleString()}
              delta={calDelta?.text}
              deltaColor={calDelta?.color}
              isY2K={isY2K}
              y2kLabel="CALORIES:"
            />
            <StatCard
              label="Protein"
              rawValue={todayNutrition.protein}
              formatted={(v) => `${v}g`}
              delta={proDelta?.text}
              deltaColor={proDelta?.color}
              isY2K={isY2K}
              y2kLabel="PROTEIN:"
            />
            <StatCard
              label="Workouts"
              rawValue={weekWorkouts}
              formatted={(v) => `${v}`}
              delta="this week"
              isY2K={isY2K}
              y2kLabel="WORKOUTS:"
            />
            <StatCard
              label="Streak"
              rawValue={streak}
              formatted={(v) => `${v}d`}
              delta={streak >= 7 ? 'keep it going' : 'day streak'}
              deltaColor={streak >= 7 ? '--accent-light' : '--text-muted'}
              isY2K={isY2K}
              y2kLabel="STREAK:"
            />
          </div>

          {/* Bottom row: left column (macro + meal plan) + right column (consistency) */}
          <div className="hd-bottom-row">
            <div className="hd-bottom-col">
              <MacroDonut userId={userId} todayNutrition={todayNutrition} goalPlan={goalPlan} isY2K={isY2K} />
              <TodayMealPlan userId={userId} isY2K={isY2K} />
            </div>
            <ConsistencyCard userId={userId} streak={streak} isY2K={isY2K} />
          </div>

      </motion.div>
    </div>
  );
}

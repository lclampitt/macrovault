import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Zap } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { getStreak } from '../lib/streak';
import '../styles/activity.css';

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_LABELS_FULL = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const WEEKDAYS_FULL = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function fmtDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function parseDate(s) {
  return new Date(`${s}T00:00:00`);
}

function categoryFor(hasW, hasM) {
  if (hasW && hasM) return 'both';
  if (hasW) return 'workout-only';
  if (hasM) return 'meals-only';
  return 'none';
}

/* Build a Map<YYYY-MM-DD, DayState> from raw rows. */
function buildDayStates(workouts, foodLogs) {
  const map = {};

  workouts.forEach((w) => {
    const date = w.workout_date;
    if (!date) return;
    if (!map[date]) map[date] = { workouts: [], meals: [], totalCalories: 0 };
    map[date].workouts.push({
      name: w.workout_name || 'Workout',
      exerciseCount: Array.isArray(w.exercises) ? w.exercises.length : 0,
    });
  });

  foodLogs.forEach((f) => {
    const date = f.logged_date;
    if (!date) return;
    if (!map[date]) map[date] = { workouts: [], meals: [], totalCalories: 0 };
    map[date].meals.push({
      name: f.meal_name || 'Meal',
      calories: Number(f.calories) || 0,
    });
    map[date].totalCalories += Number(f.calories) || 0;
  });

  Object.keys(map).forEach((k) => {
    map[k].category = categoryFor(map[k].workouts.length > 0, map[k].meals.length > 0);
  });

  return map;
}

/* Build column layout for one month of the year view.
   Returns an array of week-columns; each column is 7 cells (Sun..Sat)
   where cells outside the month are null. */
function getMonthWeeks(year, month) {
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startWeekday = firstDay.getDay();
  const totalCols = Math.ceil((startWeekday + daysInMonth) / 7);

  const cols = [];
  for (let c = 0; c < totalCols; c++) {
    const col = [];
    for (let r = 0; r < 7; r++) {
      const dayNum = c * 7 + r - startWeekday + 1;
      col.push(dayNum < 1 || dayNum > daysInMonth ? null : dayNum);
    }
    cols.push(col);
  }
  return cols;
}

/* ============================================================
   YEAR HEATMAP
   ============================================================ */
function YearHeatmap({ dayStates, year, today, onMonthClick, onCellEvent }) {
  const todayStr = fmtDate(today);
  return (
    <div className="ac-year-grid">
      <div className="ac-year-weekdays" aria-hidden="true">
        <span>&nbsp;</span>
        <span>Mon</span>
        <span>&nbsp;</span>
        <span>Wed</span>
        <span>&nbsp;</span>
        <span>Fri</span>
        <span>&nbsp;</span>
      </div>
      <div className="ac-year-months">
        {MONTH_LABELS.map((monthLabel, m) => {
          const cols = getMonthWeeks(year, m);
          const isCurrentMonth = year === today.getFullYear() && m === today.getMonth();
          return (
            <div key={m} className="ac-year-month">
              <div className={`ac-year-month__label ${isCurrentMonth ? 'is-current' : ''}`}>
                {monthLabel}
              </div>
              <div className="ac-year-month__cols">
                {cols.map((col, ci) => (
                  <div key={ci} className="ac-year-col">
                    {col.map((dayNum, ri) => {
                      if (dayNum === null) {
                        return <div key={ri} className="ac-year-cell ac-year-cell--blank" />;
                      }
                      const dateStr = `${year}-${String(m + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                      const state = dayStates[dateStr];
                      const cat = state?.category || 'none';
                      const isFuture = dateStr > todayStr;
                      return (
                        <button
                          key={ri}
                          type="button"
                          className={`ac-year-cell ac-year-cell--${cat} ${isFuture ? 'ac-year-cell--future' : ''}`}
                          onMouseEnter={(e) => onCellEvent('enter', dateStr, e.currentTarget)}
                          onMouseLeave={() => onCellEvent('leave')}
                          onClick={(e) => {
                            const isTouch = window.matchMedia('(hover: none)').matches;
                            if (isTouch) {
                              onCellEvent('tap', dateStr, e.currentTarget);
                            } else {
                              onMonthClick(year, m);
                            }
                          }}
                          aria-label={`${MONTH_LABELS_FULL[m]} ${dayNum}, ${year}`}
                          disabled={isFuture}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ============================================================
   MONTH CALENDAR
   ============================================================ */
function MonthCalendar({ dayStates, year, month, today, onCellEvent }) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1);
  const startWeekday = firstDay.getDay();
  const prevMonthDays = new Date(year, month, 0).getDate();
  const totalCells = Math.ceil((startWeekday + daysInMonth) / 7) * 7;
  const todayStr = fmtDate(today);

  const cells = [];
  // Leading spillover
  for (let i = 0; i < startWeekday; i++) {
    const dayNum = prevMonthDays - startWeekday + i + 1;
    const m = month === 0 ? 11 : month - 1;
    const y = month === 0 ? year - 1 : year;
    cells.push({ year: y, month: m, day: dayNum, isSpillover: true });
  }
  // Current month
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ year, month, day: d, isSpillover: false });
  }
  // Trailing spillover
  let trail = 1;
  while (cells.length < totalCells) {
    const m = month === 11 ? 0 : month + 1;
    const y = month === 11 ? year + 1 : year;
    cells.push({ year: y, month: m, day: trail++, isSpillover: true });
  }

  return (
    <>
      <div className="ac-month-weekdays">
        {WEEKDAYS_FULL.map((d) => <span key={d}>{d}</span>)}
      </div>
      <div className="ac-month-grid">
        {cells.map((cell, i) => {
          const dateStr = `${cell.year}-${String(cell.month + 1).padStart(2, '0')}-${String(cell.day).padStart(2, '0')}`;
          const state = dayStates[dateStr];
          const cat = state?.category || 'none';
          const isToday = dateStr === todayStr;
          const isFuture = dateStr > todayStr;
          return (
            <button
              key={i}
              type="button"
              className={[
                'ac-month-cell',
                `ac-month-cell--${cat}`,
                cell.isSpillover ? 'ac-month-cell--spillover' : '',
                isToday ? 'ac-month-cell--today' : '',
                isFuture ? 'ac-month-cell--future' : '',
              ].filter(Boolean).join(' ')}
              onMouseEnter={(e) => !isFuture && onCellEvent('enter', dateStr, e.currentTarget)}
              onMouseLeave={() => onCellEvent('leave')}
              onClick={(e) => !isFuture && onCellEvent('tap', dateStr, e.currentTarget)}
              aria-label={`${MONTH_LABELS_FULL[cell.month]} ${cell.day}, ${cell.year}`}
              disabled={isFuture}
            >
              <span className="ac-month-cell__num">{cell.day}</span>
            </button>
          );
        })}
      </div>
    </>
  );
}

/* ============================================================
   TOOLTIP
   ============================================================ */
function ActivityTooltip({ data }) {
  if (!data?.rect) return null;
  const date = parseDate(data.dateStr);
  const dateLabel = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const cat = data.state?.category || 'none';
  const catLabel = {
    'workout-only': 'Workout logged',
    'meals-only':   'Meals logged',
    'both':         'Both logged',
    'none':         'Nothing logged',
  }[cat];

  /* If the cell is near the top of the viewport, flip the tooltip
     to render below the cell instead of above so it doesn't clip
     under the topbar. Threshold is a rough max tooltip height
     (header + workout row + up to 6 meal rows + total). */
  const TOOLTIP_MAX_HEIGHT = 280;
  const placeBelow = data.rect.top < TOOLTIP_MAX_HEIGHT + 20;
  const top = placeBelow ? data.rect.bottom + 8 : data.rect.top - 8;
  const left = data.rect.right + 10;
  const transform = placeBelow ? 'translateY(0)' : 'translateY(-100%)';

  return (
    <div
      className={`ac-tooltip ac-tooltip--${cat}`}
      style={{ top, left, transform }}
      role="tooltip"
    >
      <div className="ac-tooltip__header">
        <span className={`ac-tooltip__dot ac-tooltip__dot--${cat}`} />
        <span className={`ac-tooltip__date ac-tooltip__date--${cat}`}>
          {dateLabel} · {catLabel}
        </span>
      </div>
      {data.state?.workouts?.length > 0 && (
        <div className="ac-tooltip__workout">
          <Zap size={13} />
          <span className="ac-tooltip__workout-name">{data.state.workouts[0].name}</span>
          {data.state.workouts[0].exerciseCount > 0 && (
            <span className="ac-tooltip__workout-count">
              {data.state.workouts[0].exerciseCount}{' '}
              {data.state.workouts[0].exerciseCount === 1 ? 'exercise' : 'exercises'}
            </span>
          )}
        </div>
      )}
      {data.state?.meals?.length > 0 && (
        <div className="ac-tooltip__meals">
          <div className="ac-tooltip__meals-label">Meals</div>
          {data.state.meals.slice(0, 6).map((m, i) => (
            <div key={i} className="ac-tooltip__meal-row">
              <span>{m.name}</span>
              <span className="ac-tooltip__meal-cal">{Math.round(m.calories)} kcal</span>
            </div>
          ))}
          {data.state.meals.length > 6 && (
            <div className="ac-tooltip__meal-row">
              <span style={{ color: 'var(--text-hint, var(--text-muted))', fontStyle: 'italic' }}>
                +{data.state.meals.length - 6} more
              </span>
            </div>
          )}
          <div className="ac-tooltip__total">
            <span>Total</span>
            <span>{Math.round(data.state.totalCalories).toLocaleString()} kcal</span>
          </div>
        </div>
      )}
      {cat === 'none' && (
        <div className="ac-tooltip__empty">Nothing logged this day.</div>
      )}
    </div>
  );
}

/* ============================================================
   ACTIVITY PAGE — main export
   ============================================================ */
export default function Activity() {
  const today = useMemo(() => new Date(), []);
  const [session, setSession] = useState(null);
  const [view, setView] = useState('year');
  const [year, setYear] = useState(today.getFullYear());
  const [displayedMonth, setDisplayedMonth] = useState(today.getMonth());
  const [data, setData] = useState({ workouts: [], foodLogs: [] });
  const [loading, setLoading] = useState(true);
  const [hoveredCell, setHoveredCell] = useState(null);
  const [streak, setStreak] = useState(0);

  // Session + streak
  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: s } = await supabase.auth.getSession();
      if (!mounted) return;
      setSession(s?.session ?? null);
      if (s?.session?.user?.id) {
        getStreak(s.session.user.id).then((v) => {
          if (mounted) setStreak(v);
        }).catch(() => {});
      }
    })();
    return () => { mounted = false; };
  }, []);

  const userId = session?.user?.id;

  // Fetch data for the current year
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    setLoading(true);
    const first = `${year}-01-01`;
    const last = `${year}-12-31`;
    (async () => {
      const [{ data: foods }, { data: workouts }] = await Promise.all([
        supabase.from('food_logs')
          .select('logged_date, meal_name, calories')
          .eq('user_id', userId)
          .gte('logged_date', first)
          .lte('logged_date', last),
        supabase.from('workouts')
          .select('workout_date, workout_name, exercises')
          .eq('user_id', userId)
          .gte('workout_date', first)
          .lte('workout_date', last),
      ]);
      if (cancelled) return;
      setData({ foodLogs: foods || [], workouts: workouts || [] });
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [userId, year]);

  const dayStates = useMemo(
    () => buildDayStates(data.workouts, data.foodLogs),
    [data]
  );

  const stats = useMemo(() => {
    if (view === 'year') {
      let daysLogged = 0;
      let workoutCount = 0;
      Object.values(dayStates).forEach((d) => {
        if (d.category !== 'none') daysLogged++;
        workoutCount += d.workouts.length;
      });
      return { daysLogged, workoutCount };
    }
    let daysLogged = 0;
    let workoutCount = 0;
    const prefix = `${year}-${String(displayedMonth + 1).padStart(2, '0')}-`;
    Object.entries(dayStates).forEach(([k, v]) => {
      if (!k.startsWith(prefix)) return;
      if (v.category !== 'none') daysLogged++;
      workoutCount += v.workouts.length;
    });
    return { daysLogged, workoutCount };
  }, [dayStates, view, year, displayedMonth]);

  /* Unified cell event handler. 'enter' is hover; 'tap' is mobile/click. */
  const handleCellEvent = (type, dateStr, el) => {
    if (type === 'leave') {
      // Don't auto-close on touch devices — wait for explicit tap-outside.
      const isTouch = typeof window !== 'undefined' && window.matchMedia('(hover: none)').matches;
      if (!isTouch) setHoveredCell(null);
      return;
    }
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setHoveredCell({
      dateStr,
      state: dayStates[dateStr] || { workouts: [], meals: [], totalCalories: 0, category: 'none' },
      rect: { top: rect.top, left: rect.left, right: rect.right, bottom: rect.bottom },
    });
  };

  /* Tap-outside-to-dismiss for mobile tooltip. */
  useEffect(() => {
    if (!hoveredCell) return;
    const handler = (e) => {
      if (e.target.closest('.ac-year-cell, .ac-month-cell, .ac-tooltip')) return;
      setHoveredCell(null);
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [hoveredCell]);

  const goPrevYear = () => setYear((y) => y - 1);
  const goNextYear = () => {
    if (year >= today.getFullYear()) return;
    setYear((y) => y + 1);
  };
  const goPrevMonth = () => {
    if (displayedMonth === 0) {
      setYear((y) => y - 1);
      setDisplayedMonth(11);
    } else {
      setDisplayedMonth((m) => m - 1);
    }
  };
  const goNextMonth = () => {
    if (year === today.getFullYear() && displayedMonth === today.getMonth()) return;
    if (displayedMonth === 11) {
      setYear((y) => y + 1);
      setDisplayedMonth(0);
    } else {
      setDisplayedMonth((m) => m + 1);
    }
  };

  const isCurrentYear = year === today.getFullYear();
  const isCurrentMonth = year === today.getFullYear() && displayedMonth === today.getMonth();
  const monthLabel = `${MONTH_LABELS_FULL[displayedMonth]} ${year}`;

  const isEmpty = !loading && data.workouts.length === 0 && data.foodLogs.length === 0;

  return (
    <div className="ac-page">
      <header className="ac-page__header">
        <div className="ac-kicker">
          <span className="ac-kicker__dot" />
          <span>Activity · {view === 'year' ? year : monthLabel}</span>
        </div>
        <div className="ac-page__title-row">
          <div>
            <h1 className="ac-page__title">
              {view === 'year'
                ? (isCurrentYear ? 'Your year so far.' : `${year}`)
                : monthLabel}
            </h1>
            <p className="ac-page__subtitle">
              {view === 'year' ? (
                <>
                  <span className="ac-page__stat">
                    {stats.daysLogged} {stats.daysLogged === 1 ? 'day' : 'days'}
                  </span>{' logged · '}
                  <span className="ac-page__stat">
                    {stats.workoutCount} {stats.workoutCount === 1 ? 'workout' : 'workouts'}
                  </span>
                  {isCurrentYear && (
                    <>
                      {' · current streak '}
                      <span className="ac-page__stat">
                        {streak} {streak === 1 ? 'day' : 'days'}
                      </span>
                    </>
                  )}
                </>
              ) : (
                <>
                  <span className="ac-page__stat">
                    {stats.daysLogged} {stats.daysLogged === 1 ? 'day' : 'days'}
                  </span>{' logged this month · '}
                  <span className="ac-page__stat">
                    {stats.workoutCount} {stats.workoutCount === 1 ? 'workout' : 'workouts'}
                  </span>
                </>
              )}
            </p>
          </div>
          <div className="ac-page__controls">
            {view === 'year' ? (
              <>
                <button className="ac-nav-btn" onClick={goPrevYear} aria-label="Previous year">
                  <ChevronLeft size={16} />
                </button>
                <button
                  className="ac-nav-btn"
                  onClick={goNextYear}
                  disabled={isCurrentYear}
                  aria-label="Next year"
                >
                  <ChevronRight size={16} />
                </button>
              </>
            ) : (
              <>
                <button className="ac-nav-btn" onClick={goPrevMonth} aria-label="Previous month">
                  <ChevronLeft size={16} />
                </button>
                <button
                  className="ac-nav-btn"
                  onClick={goNextMonth}
                  disabled={isCurrentMonth}
                  aria-label="Next month"
                >
                  <ChevronRight size={16} />
                </button>
              </>
            )}
            <div className="ac-toggle">
              <button
                className={`ac-toggle__btn ${view === 'year' ? 'ac-toggle__btn--active' : ''}`}
                onClick={() => setView('year')}
              >Year</button>
              <button
                className={`ac-toggle__btn ${view === 'month' ? 'ac-toggle__btn--active' : ''}`}
                onClick={() => setView('month')}
              >Month</button>
            </div>
          </div>
        </div>
      </header>

      <div className="ac-card">
        {loading ? (
          <div className="ac-skeleton" aria-busy="true" />
        ) : view === 'year' ? (
          <YearHeatmap
            dayStates={dayStates}
            year={year}
            today={today}
            onMonthClick={(y, m) => {
              setYear(y);
              setDisplayedMonth(m);
              setView('month');
            }}
            onCellEvent={handleCellEvent}
          />
        ) : (
          <MonthCalendar
            dayStates={dayStates}
            year={year}
            month={displayedMonth}
            today={today}
            onCellEvent={handleCellEvent}
          />
        )}
        {isEmpty && (
          <div className="ac-empty">
            <p className="ac-empty__title">No activity yet.</p>
            <p className="ac-empty__sub">
              Start logging meals or workouts to see your patterns here.
            </p>
            <Link to="/home" className="ac-empty__cta">Go to dashboard →</Link>
          </div>
        )}
      </div>

      {!isEmpty && (
        <div className="ac-legend">
          <span className="ac-legend__label">Logged:</span>
          <span className="ac-legend__item">
            <span className="ac-legend__swatch ac-legend__swatch--workout-only" /> Workout
          </span>
          <span className="ac-legend__item">
            <span className="ac-legend__swatch ac-legend__swatch--meals-only" /> Meals
          </span>
          <span className="ac-legend__item">
            <span className="ac-legend__swatch ac-legend__swatch--both" /> Both
          </span>
          <span className="ac-legend__item">
            <span className="ac-legend__swatch ac-legend__swatch--none" /> Nothing
          </span>
        </div>
      )}

      {hoveredCell && <ActivityTooltip data={hoveredCell} />}
    </div>
  );
}

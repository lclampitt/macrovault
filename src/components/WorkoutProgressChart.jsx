import React, { useEffect, useMemo, useState, useRef } from 'react';
import {
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ComposedChart,
} from 'recharts';
import { Search, Crown } from 'lucide-react';
import { supabase } from '../supabaseClient';

/* ── Helpers ──────────────────────────────── */

const TIME_RANGES = [
  { key: '1M',  label: '1M',  days: 30 },
  { key: '3M',  label: '3M',  days: 90 },
  { key: '6M',  label: '6M',  days: 180 },
  { key: '1Y',  label: '1Y',  days: 365 },
  { key: 'ALL', label: 'All', days: Infinity },
];

function normalizeExName(n) {
  return (n || '').trim().toLowerCase();
}

function formatDateLabel(dateStr, range) {
  const d = new Date(dateStr + 'T00:00:00');
  if (range < 60) {
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function calcStepSize(min, max, targetTicks) {
  const range = max - min;
  if (range <= 0) return 1;
  const rawStep = range / targetTicks;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const normalised = rawStep / magnitude;
  let nice;
  if (normalised < 1.5) nice = 1;
  else if (normalised < 3) nice = 2;
  else if (normalised < 7) nice = 5;
  else nice = 10;
  return nice * magnitude;
}

const WEIGHT_COLOR = '#1D9E75';
const REPS_COLOR = 'rgba(127,119,221,0.8)';

/* ── Custom dot — draws a crown for PR data points ─── */
function PRDot({ cx, cy, payload, colorWeight }) {
  if (cx == null || cy == null) return null;
  if (!payload?.isPR) {
    return (
      <circle cx={cx} cy={cy} r={3} fill={colorWeight} />
    );
  }
  // PR point — draw a slightly larger dot with a crown icon above
  return (
    <g>
      <circle cx={cx} cy={cy} r={4.5} fill={colorWeight} stroke="#fff" strokeWidth={1.5} />
      <g transform={`translate(${cx - 7}, ${cy - 22})`}>
        <path
          d="M1 10 L2.5 3 L6 7 L8 2 L10 7 L13.5 3 L15 10 Z"
          fill={colorWeight}
          stroke={colorWeight}
          strokeWidth={0.5}
        />
      </g>
    </g>
  );
}

/* ── Main component ─────────────────────────── */

export default function WorkoutProgressChart({ userId }) {
  const [workouts, setWorkouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null); // { name, isCardio }
  const [timeRange, setTimeRange] = useState('3M');
  const [query, setQuery] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('workouts')
        .select('workout_date, muscle_group, exercises')
        .eq('user_id', userId)
        .order('workout_date', { ascending: true });

      if (!cancelled) {
        if (!error && data) setWorkouts(data);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  // Close dropdown on outside click
  useEffect(() => {
    function onDocClick(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  // Build catalog: { [normName]: { name, count, isCardio } }
  const catalog = useMemo(() => {
    const map = new Map();
    for (const w of workouts) {
      const workoutIsCardio = (w.muscle_group || '').toLowerCase() === 'cardio';
      const list = Array.isArray(w.exercises) ? w.exercises : [];
      for (const ex of list) {
        const key = normalizeExName(ex?.name);
        if (!key) continue;
        // Per-exercise cardio detection: flag on the exercise itself,
        // cardio fields on any set, or the whole workout marked cardio.
        const exIsCardio =
          ex?.isCardio === true ||
          (ex?.bodyPart || '').toLowerCase() === 'cardio' ||
          (ex.sets || []).some(
            (s) => s.duration_seconds != null || s.speed_mph != null || s.distance_miles != null,
          ) ||
          workoutIsCardio;
        const hasLoggedSet = (ex.sets || []).some((s) =>
          exIsCardio
            ? (s.duration_seconds != null || s.speed_mph != null || s.distance_miles != null)
            : ((s.weight !== '' && s.weight != null) || (s.reps !== '' && s.reps != null)),
        );
        if (!hasLoggedSet) continue;
        const existing = map.get(key);
        if (existing) {
          existing.count += 1;
          existing.isCardio = existing.isCardio || exIsCardio;
        } else {
          map.set(key, { name: ex.name.trim(), count: 1, isCardio: exIsCardio });
        }
      }
    }
    return [...map.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [workouts]);

  // Auto-select most-logged exercise when catalog loads
  useEffect(() => {
    if (!selected && catalog.length > 0) {
      setSelected({ name: catalog[0].name, isCardio: catalog[0].isCardio });
    }
  }, [catalog, selected]);

  // Build per-session data points for the selected exercise
  const allData = useMemo(() => {
    if (!selected) return [];
    const key = normalizeExName(selected.name);
    const cardio = !!selected.isCardio;
    const points = [];
    for (const w of workouts) {
      const list = Array.isArray(w.exercises) ? w.exercises : [];
      const ex = list.find((e) => normalizeExName(e?.name) === key);
      if (!ex) continue;
      if (cardio) {
        // Cardio: map speed_mph → maxWeight (top line), total minutes →
        // totalReps (bottom line). bestSet stays empty — not meaningful.
        const sets = (ex.sets || []);
        if (sets.length === 0) continue;
        let maxSpeed = 0;
        let totalSeconds = 0;
        for (const s of sets) {
          const mph = Number(s.speed_mph) || 0;
          const secs = Number(s.duration_seconds) || 0;
          totalSeconds += secs;
          if (mph > maxSpeed) maxSpeed = mph;
        }
        if (maxSpeed === 0 && totalSeconds === 0) continue;
        points.push({
          date: w.workout_date,
          maxWeight: +maxSpeed.toFixed(1),
          totalReps: Math.round(totalSeconds / 60),
          bestSet: null,
        });
        continue;
      }
      const sets = (ex.sets || []).map((s) => ({
        weight: Number(s.weight) || 0,
        reps: Number(s.reps) || 0,
      }));
      if (sets.length === 0) continue;
      let maxWeight = 0;
      let totalReps = 0;
      let bestSet = { weight: 0, reps: 0 };
      for (const s of sets) {
        totalReps += s.reps;
        if (s.weight > maxWeight) maxWeight = s.weight;
        // "Best set" = highest weight × reps product, falling back to weight
        const score = s.weight * Math.max(s.reps, 1);
        const bestScore = bestSet.weight * Math.max(bestSet.reps, 1);
        if (score > bestScore) bestSet = s;
      }
      points.push({
        date: w.workout_date,
        maxWeight,
        totalReps,
        bestSet,
      });
    }
    // Dedupe same-date sessions by keeping the one with the highest max weight
    const byDate = new Map();
    for (const p of points) {
      const existing = byDate.get(p.date);
      if (!existing || p.maxWeight > existing.maxWeight) byDate.set(p.date, p);
    }
    return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  }, [workouts, selected]);

  // Filter by time range
  const data = useMemo(() => {
    if (!allData.length) return [];
    const tr = TIME_RANGES.find((t) => t.key === timeRange);
    if (!tr || tr.days === Infinity) return allData;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - tr.days);
    const cutoffStr = cutoff.toISOString().split('T')[0];
    return allData.filter((d) => d.date >= cutoffStr);
  }, [allData, timeRange]);

  // Compute PR flag per data point (all-time max weight within full history,
  // not just filtered range, so tiny-window charts still mark true PRs)
  const pointsWithPR = useMemo(() => {
    if (!allData.length) return [];
    const allTimeMaxWeight = Math.max(...allData.map((p) => p.maxWeight));
    const prSet = new Set(
      allData.filter((p) => p.maxWeight === allTimeMaxWeight && allTimeMaxWeight > 0).map((p) => p.date),
    );
    return data.map((p) => ({ ...p, isPR: prSet.has(p.date) }));
  }, [data, allData]);

  // Filtered catalog for dropdown
  const filteredCatalog = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return catalog;
    return catalog.filter((c) => c.name.toLowerCase().includes(q));
  }, [catalog, query]);

  const isCardio = !!selected?.isCardio;

  // Axis domains & ticks
  const weightVals = pointsWithPR.map((p) => p.maxWeight).filter((v) => v > 0);
  const repsVals   = pointsWithPR.map((p) => p.totalReps).filter((v) => v > 0);

  const weightMin = weightVals.length ? Math.max(0, Math.floor(Math.min(...weightVals) * 0.85)) : 0;
  const weightMax = weightVals.length ? Math.ceil(Math.max(...weightVals) * 1.15) : 100;
  const repsMin = 0;
  const repsMax = repsVals.length ? Math.ceil(Math.max(...repsVals) * 1.15) : 50;

  const weightStep = calcStepSize(weightMin, weightMax, 5);
  const repsStep = calcStepSize(repsMin, repsMax, 5);
  const weightTicks = [];
  for (let v = weightMin; v <= weightMax; v += weightStep) weightTicks.push(Math.round(v * 10) / 10);
  const repsTicks = [];
  for (let v = repsMin; v <= repsMax; v += repsStep) repsTicks.push(Math.round(v * 10) / 10);

  const dateRange = data.length >= 2
    ? Math.round((new Date(data[data.length - 1].date) - new Date(data[0].date)) / (1000 * 60 * 60 * 24))
    : 30;

  // Tooltip content
  const renderTooltip = ({ active, payload, label }) => {
    if (!active || !payload || !payload.length) return null;
    const p = payload[0]?.payload;
    if (!p) return null;
    const d = new Date(label + 'T00:00:00');
    const dateLabel = d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
    return (
      <div className="progress-tooltip">
        <div className="progress-tooltip__date">{dateLabel}</div>
        <div className="progress-tooltip__row">
          <span className="progress-tooltip__dot" style={{ background: WEIGHT_COLOR }} />
          <span className="progress-tooltip__label">{isCardio ? 'Speed' : 'Max weight'}</span>
          <span className="progress-tooltip__val">
            {p.maxWeight}{isCardio ? ' mph' : ' lbs'}
          </span>
        </div>
        <div className="progress-tooltip__row">
          <span className="progress-tooltip__dot" style={{ background: REPS_COLOR }} />
          <span className="progress-tooltip__label">{isCardio ? 'Duration' : 'Total reps'}</span>
          <span className="progress-tooltip__val">
            {p.totalReps}{isCardio ? ' min' : ''}
          </span>
        </div>
        {!isCardio && p.bestSet && p.bestSet.weight > 0 && (
          <div className="progress-tooltip__row">
            <span className="progress-tooltip__dot" style={{ background: 'transparent' }} />
            <span className="progress-tooltip__label">Best set</span>
            <span className="progress-tooltip__val">
              {p.bestSet.weight} lbs × {p.bestSet.reps}
            </span>
          </div>
        )}
        {p.isPR && (
          <div className="wpc-tooltip-pr">
            <Crown size={11} /> Personal Record
          </div>
        )}
      </div>
    );
  };

  /* ── Render ───────────────────────────────── */

  if (loading) {
    return <p className="pg-muted" style={{ fontSize: 13 }}>Loading workouts…</p>;
  }

  if (catalog.length === 0) {
    return (
      <div className="wpc-empty">
        <p className="wpc-empty__title">No workouts logged yet</p>
        <p className="wpc-empty__sub">Log a workout in the Workouts tab to start tracking strength gains.</p>
      </div>
    );
  }

  return (
    <div className="wpc">
      {/* Exercise selector */}
      <div className="wpc-selector" ref={wrapRef}>
        <div className="wpc-selector__input-wrap">
          <Search size={14} className="wpc-selector__icon" />
          <input
            type="text"
            className="wpc-selector__input"
            placeholder="Search exercises..."
            value={dropdownOpen ? query : (selected?.name || '')}
            onFocus={() => { setDropdownOpen(true); setQuery(''); }}
            onChange={(e) => { setQuery(e.target.value); setDropdownOpen(true); }}
          />
        </div>
        {dropdownOpen && filteredCatalog.length > 0 && (
          <div className="wpc-selector__dropdown">
            {filteredCatalog.slice(0, 30).map((item) => (
              <button
                key={item.name}
                type="button"
                className={`wpc-selector__option ${normalizeExName(selected?.name) === normalizeExName(item.name) ? 'wpc-selector__option--active' : ''}`}
                onClick={() => {
                  setSelected({ name: item.name, isCardio: item.isCardio });
                  setDropdownOpen(false);
                  setQuery('');
                }}
              >
                <span className="wpc-selector__name">{item.name}</span>
                <span className="wpc-selector__count">
                  {item.count} session{item.count === 1 ? '' : 's'}
                  {item.isCardio ? ' · cardio' : ''}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Chart or empty-state */}
      {pointsWithPR.length < 2 ? (
        <div className="wpc-empty">
          <p className="wpc-empty__title">Not enough data yet</p>
          <p className="wpc-empty__sub">
            Log this exercise at least twice to see your progress chart.
          </p>
        </div>
      ) : (
        <div style={{ height: 300, width: '100%' }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={pointsWithPR} margin={{ top: 20, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: '#888' }}
                tickFormatter={(v) => formatDateLabel(v, dateRange)}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                yAxisId="left"
                domain={[weightMin, weightMax]}
                ticks={weightTicks}
                tick={{ fontSize: 11, fill: '#888' }}
                tickFormatter={(v) => `${v}`}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                domain={[repsMin, repsMax]}
                ticks={repsTicks}
                tick={{ fontSize: 11, fill: '#888' }}
                tickFormatter={(v) => `${v}`}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={renderTooltip} />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="maxWeight"
                name={isCardio ? 'Speed' : 'Max weight'}
                stroke={WEIGHT_COLOR}
                strokeWidth={2}
                dot={(props) => <PRDot {...props} colorWeight={WEIGHT_COLOR} />}
                activeDot={{ r: 5, fill: WEIGHT_COLOR }}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="totalReps"
                name={isCardio ? 'Duration' : 'Total reps'}
                stroke={REPS_COLOR}
                strokeWidth={2}
                strokeDasharray="5 3"
                dot={{ r: 3, fill: REPS_COLOR }}
                activeDot={{ r: 4, fill: REPS_COLOR }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Legend + range pills */}
      {pointsWithPR.length >= 2 && (
        <>
          <div className="wpc-legend">
            <span className="wpc-legend__item">
              <span className="wpc-legend__dot" style={{ background: WEIGHT_COLOR }} />
              {isCardio ? 'Speed (mph)' : 'Max weight (lbs)'}
            </span>
            <span className="wpc-legend__item">
              <span className="wpc-legend__dot" style={{ background: REPS_COLOR }} />
              {isCardio ? 'Duration (min)' : 'Total reps'}
            </span>
            {pointsWithPR.some((p) => p.isPR) && (
              <span className="wpc-legend__item wpc-legend__pr">
                <Crown size={11} /> PR
              </span>
            )}
          </div>

          <div className="progress-range-pills">
            {TIME_RANGES.map((t) => (
              <button
                key={t.key}
                className={`progress-range-pill ${timeRange === t.key ? 'progress-range-pill--active' : ''}`}
                onClick={() => setTimeRange(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

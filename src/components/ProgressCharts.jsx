import React, { useState, useMemo } from 'react';
import {
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
  ComposedChart,
  ReferenceLine,
} from 'recharts';
import { useTheme } from '../hooks/useTheme';

/* ── Helpers ──────────────────────────────── */

function calculateChartBounds(weightData, bfData) {
  const result = { weight: { min: 0, max: 200 }, bf: { min: 0, max: 40 } };

  if (weightData.length > 0) {
    const wMin = Math.min(...weightData);
    const wMax = Math.max(...weightData);
    const wRange = wMax - wMin;
    const wPad = Math.max(wRange * 0.15, 5);
    result.weight.min = Math.max(0, Math.floor((wMin - wPad) / 5) * 5);
    result.weight.max = Math.ceil((wMax + wPad) / 5) * 5;
  }

  if (bfData.length > 0) {
    const bMin = Math.min(...bfData);
    const bMax = Math.max(...bfData);
    const bRange = bMax - bMin;
    const bPad = Math.max(bRange * 0.2, 2);
    result.bf.min = Math.max(0, Math.floor(bMin - bPad));
    result.bf.max = Math.ceil(bMax + bPad);
  }

  return result;
}

function calculateStepSize(min, max, targetTicks) {
  const range = max - min;
  if (range <= 0) return 1;
  const rawStep = range / targetTicks;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const normalised = rawStep / magnitude;
  let niceStep;
  if (normalised < 1.5) niceStep = 1;
  else if (normalised < 3) niceStep = 2;
  else if (normalised < 7) niceStep = 5;
  else niceStep = 10;
  return niceStep * magnitude;
}

function formatDateLabel(dateStr, range) {
  const d = new Date(dateStr + 'T00:00:00');
  if (range < 14) {
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } else if (range < 60) {
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } else {
    return d.toLocaleDateString('en-US', { month: 'short' });
  }
}

const TIME_RANGES = [
  { key: '2W', label: '2W', days: 14 },
  { key: '1M', label: '1M', days: 30 },
  { key: '3M', label: '3M', days: 90 },
  { key: '6M', label: '6M', days: 180 },
  { key: 'ALL', label: 'All', days: Infinity },
];

/**
 * Props:
 *  rows: Array<{ date: 'YYYY-MM-DD', weight_kg: number|null, body_fat_pct: number|null }>
 *  (weight_kg column is treated as lbs — naming quirk in the DB)
 *  goalWeight: number|null (optional goal weight in lbs)
 */
export default function ProgressCharts({ rows = [], goalWeight = null }) {
  const { isSpectrum, isRetro } = useTheme();
  const [timeRange, setTimeRange] = useState('1M');

  // Normalize + sort ascending
  const allData = useMemo(() => [...rows]
    .map((r) => ({
      date: r.date,
      weight_lbs:
        r.weight_kg === '' || r.weight_kg === null || r.weight_kg === undefined
          ? null : Number(r.weight_kg),
      body_fat_pct:
        r.body_fat_pct === '' || r.body_fat_pct === null || r.body_fat_pct === undefined
          ? null : Number(r.body_fat_pct),
    }))
    .sort((a, b) => a.date.localeCompare(b.date)),
  [rows]);

  // Filter by time range
  const data = useMemo(() => {
    const tr = TIME_RANGES.find((t) => t.key === timeRange);
    if (!tr || tr.days === Infinity) return allData;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - tr.days);
    const cutoffStr = cutoff.toISOString().split('T')[0];
    return allData.filter((d) => d.date >= cutoffStr);
  }, [allData, timeRange]);

  if (!allData.length) {
    return (
      <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>
        No progress yet — add your first entry below.
      </div>
    );
  }

  // If only 1 data point, show a special single-entry display
  if (data.length === 1) {
    const entry = data[0];
    const d = new Date(entry.date + 'T00:00:00');
    const dateLabel = d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
    return (
      <div>
        <div className="progress-single">
          {entry.weight_lbs != null && (
            <div className="progress-single__value" style={{ color: 'var(--accent-light)' }}>
              {entry.weight_lbs} <span className="progress-single__unit">lbs</span>
            </div>
          )}
          {entry.body_fat_pct != null && (
            <div className="progress-single__value" style={{ color: 'var(--text-secondary)' }}>
              {entry.body_fat_pct}<span className="progress-single__unit">%</span> body fat
            </div>
          )}
          <div className="progress-single__note">
            Logged on {dateLabel} — add more entries to see your trend
          </div>
        </div>
        <TimeRangePills active={timeRange} onChange={setTimeRange} />
      </div>
    );
  }

  // Calculate bounds and date range
  const weightValues = data.map((d) => d.weight_lbs).filter((v) => v != null);
  const bfValues = data.map((d) => d.body_fat_pct).filter((v) => v != null);
  const bounds = calculateChartBounds(weightValues, bfValues);

  const dateRange = data.length >= 2
    ? Math.round((new Date(data[data.length - 1].date) - new Date(data[0].date)) / (1000 * 60 * 60 * 24))
    : 7;

  const weightStep = calculateStepSize(bounds.weight.min, bounds.weight.max, 6);
  const bfStep = calculateStepSize(bounds.bf.min, bounds.bf.max, 6);

  // Generate weight ticks
  const weightTicks = [];
  for (let v = bounds.weight.min; v <= bounds.weight.max; v += weightStep) {
    weightTicks.push(Math.round(v * 10) / 10);
  }

  // Generate bf ticks
  const bfTicks = [];
  for (let v = bounds.bf.min; v <= bounds.bf.max; v += bfStep) {
    bfTicks.push(Math.round(v * 10) / 10);
  }

  const accentColor = (isSpectrum || isRetro) ? 'var(--color-progress-chart)' : 'var(--accent)';
  const bfColor = (isSpectrum || isRetro) ? 'var(--color-fat)' : 'var(--accent-light)';

  // Check if goal weight is within visible range
  const showGoalLine = goalWeight != null
    && goalWeight >= bounds.weight.min
    && goalWeight <= bounds.weight.max;

  const renderTooltip = ({ active, payload, label }) => {
    if (!active || !payload || !payload.length) return null;

    const weight = payload.find((p) => p.dataKey === 'weight_lbs');
    const bf = payload.find((p) => p.dataKey === 'body_fat_pct');
    const d = new Date(label + 'T00:00:00');
    const dateLabel = d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

    // Find previous entry for delta
    const idx = data.findIndex((r) => r.date === label);
    const prev = idx > 0 ? data[idx - 1] : null;

    return (
      <div className="progress-tooltip">
        <div className="progress-tooltip__date">{dateLabel}</div>
        {weight && weight.value != null && (
          <div className="progress-tooltip__row">
            <span className="progress-tooltip__dot" style={{ background: accentColor }} />
            <span className="progress-tooltip__label">Weight</span>
            <span className="progress-tooltip__val" style={{ color: 'var(--accent-light)' }}>{weight.value} lbs</span>
          </div>
        )}
        {weight && weight.value != null && prev && prev.weight_lbs != null && (
          <div className="progress-tooltip__delta">
            {(() => {
              const d = weight.value - prev.weight_lbs;
              const sign = d > 0 ? '\u25B2' : d < 0 ? '\u25BC' : '';
              const color = d < 0 ? 'var(--accent)' : d > 0 ? '#EF9F27' : 'var(--text-muted)';
              return <span style={{ color }}>{sign} {Math.abs(d).toFixed(1)} lbs from last entry</span>;
            })()}
          </div>
        )}
        {bf && bf.value != null && (
          <div className="progress-tooltip__row">
            <span className="progress-tooltip__dot" style={{ background: bfColor }} />
            <span className="progress-tooltip__label">Body fat</span>
            <span className="progress-tooltip__val">{bf.value}%</span>
          </div>
        )}
        {bf && bf.value != null && prev && prev.body_fat_pct != null && (
          <div className="progress-tooltip__delta">
            {(() => {
              const d = bf.value - prev.body_fat_pct;
              const sign = d > 0 ? '\u25B2' : d < 0 ? '\u25BC' : '';
              const color = d < 0 ? 'var(--accent)' : d > 0 ? '#EF9F27' : 'var(--text-muted)';
              return <span style={{ color }}>{sign} {Math.abs(d).toFixed(1)}% from last entry</span>;
            })()}
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      <div style={{ height: 300, width: '100%' }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="weightGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={accentColor} stopOpacity={0.18} />
                <stop offset="95%" stopColor={accentColor} stopOpacity={0} />
              </linearGradient>
            </defs>

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
              domain={[bounds.weight.min, bounds.weight.max]}
              ticks={weightTicks}
              tick={{ fontSize: 11, fill: '#888' }}
              tickFormatter={(v) => `${v}`}
              axisLine={false}
              tickLine={false}
            />

            <YAxis
              yAxisId="right"
              orientation="right"
              domain={[bounds.bf.min, bounds.bf.max]}
              ticks={bfTicks}
              tick={{ fontSize: 11, fill: '#888' }}
              tickFormatter={(v) => `${v}%`}
              axisLine={false}
              tickLine={false}
            />

            <Tooltip content={renderTooltip} />

            <Legend
              wrapperStyle={{ paddingTop: 8, fontSize: 12, color: 'var(--text-muted)' }}
              formatter={(v) => v === 'weight_lbs' ? 'Weight (lbs)' : 'BF%'}
            />

            {/* Goal weight reference line */}
            {showGoalLine && (
              <ReferenceLine
                yAxisId="left"
                y={goalWeight}
                stroke="var(--accent)"
                strokeOpacity={0.4}
                strokeDasharray="6 4"
                label={{
                  value: 'Goal',
                  position: 'right',
                  fill: 'var(--accent)',
                  fontSize: 10,
                  opacity: 0.6,
                }}
              />
            )}

            {/* Weight area with gradient fill */}
            <Area
              yAxisId="left"
              type="monotone"
              dataKey="weight_lbs"
              stroke={accentColor}
              strokeWidth={2}
              fill="url(#weightGradient)"
              dot={data.length <= 5 ? { r: 3, fill: accentColor } : false}
              activeDot={{ r: 4, fill: accentColor }}
              connectNulls
            />

            {/* BF% dashed line */}
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="body_fat_pct"
              stroke={bfColor}
              strokeWidth={2}
              strokeDasharray="5 3"
              dot={data.length <= 5 ? { r: 3, fill: bfColor } : false}
              activeDot={{ r: 4, fill: bfColor }}
              connectNulls
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <TimeRangePills active={timeRange} onChange={setTimeRange} />
    </div>
  );
}

/* ── Time range pills ──────────────────── */
function TimeRangePills({ active, onChange }) {
  return (
    <div className="progress-range-pills">
      {TIME_RANGES.map((t) => (
        <button
          key={t.key}
          className={`progress-range-pill ${active === t.key ? 'progress-range-pill--active' : ''}`}
          onClick={() => onChange(t.key)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

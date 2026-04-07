import React from 'react';
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
} from 'recharts';
import { useTheme } from '../hooks/useTheme';

/**
 * Props:
 *  rows: Array<{ date: 'YYYY-MM-DD', weight_kg: number|null, body_fat_pct: number|null }>
 *  (weight_kg column is treated as lbs — naming quirk in the DB)
 */
export default function ProgressCharts({ rows = [] }) {
  const { isSpectrum } = useTheme();

  // Normalize + sort ascending
  const data = [...rows]
    .map((r) => ({
      date: r.date,
      weight_lbs:
        r.weight_kg === '' || r.weight_kg === null || r.weight_kg === undefined
          ? null : Number(r.weight_kg),
      body_fat_pct:
        r.body_fat_pct === '' || r.body_fat_pct === null || r.body_fat_pct === undefined
          ? null : Number(r.body_fat_pct),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  if (!data.length) {
    return (
      <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>
        No progress yet — add your first entry below.
      </div>
    );
  }

  const renderTooltip = ({ active, payload, label }) => {
    if (!active || !payload || !payload.length) return null;
    const weight = payload.find((p) => p.dataKey === 'weight_lbs');
    const bf     = payload.find((p) => p.dataKey === 'body_fat_pct');
    return (
      <div style={{
        background: 'var(--bg-surface-2)', border: '1px solid var(--border)',
        borderRadius: 8, padding: '8px 12px', fontSize: 12, color: 'var(--text-primary)',
      }}>
        <div style={{ marginBottom: 4, color: 'var(--text-muted)' }}>{label}</div>
        {weight && <div>Weight: <strong>{weight.value}</strong> lbs</div>}
        {bf     && <div>BF%: <strong>{bf.value}</strong></div>}
      </div>
    );
  };

  return (
    <div style={{ height: 320, width: '100%' }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data}>
          <defs>
            <linearGradient id="weightGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={isSpectrum ? 'var(--color-progress-chart)' : 'var(--accent)'} stopOpacity={0.18} />
              <stop offset="95%" stopColor={isSpectrum ? 'var(--color-progress-chart)' : 'var(--accent)'} stopOpacity={0} />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
          <YAxis yAxisId="left"  tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
          <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
          <Tooltip content={renderTooltip} />
          <Legend
            wrapperStyle={{ paddingTop: 8, fontSize: 12, color: 'var(--text-muted)' }}
            formatter={(v) => v === 'weight_lbs' ? 'Weight (lbs)' : 'BF%'}
          />

          {/* Weight area with gradient fill */}
          <Area
            yAxisId="left"
            type="monotone"
            dataKey="weight_lbs"
            stroke={isSpectrum ? 'var(--color-progress-chart)' : 'var(--accent)'}
            strokeWidth={2}
            fill="url(#weightGradient)"
            dot={false}
            connectNulls
          />

          {/* BF% dashed line */}
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="body_fat_pct"
            stroke={isSpectrum ? 'var(--color-fat)' : 'var(--accent-light)'}
            strokeWidth={2}
            strokeDasharray="5 3"
            dot={false}
            connectNulls
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

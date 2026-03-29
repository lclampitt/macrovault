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

/**
 * Props:
 *  rows: Array<{ date: 'YYYY-MM-DD', weight_kg: number|null, body_fat_pct: number|null }>
 *  (weight_kg column is treated as lbs — naming quirk in the DB)
 */
export default function ProgressCharts({ rows = [] }) {
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
      <div style={{ color: '#4f5a6e', fontSize: 13 }}>
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
        background: '#080c14', border: '1px solid #1a2538',
        borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#e8eaf0',
      }}>
        <div style={{ marginBottom: 4, color: '#8892a4' }}>{label}</div>
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
              <stop offset="5%"  stopColor="#1D9E75" stopOpacity={0.18} />
              <stop offset="95%" stopColor="#1D9E75" stopOpacity={0} />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="3 3" stroke="#1a2538" />
          <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#8892a4' }} />
          <YAxis yAxisId="left"  tick={{ fontSize: 11, fill: '#8892a4' }} />
          <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: '#8892a4' }} />
          <Tooltip content={renderTooltip} />
          <Legend
            wrapperStyle={{ paddingTop: 8, fontSize: 12, color: '#8892a4' }}
            formatter={(v) => v === 'weight_lbs' ? 'Weight (lbs)' : 'BF%'}
          />

          {/* Weight area with gradient fill */}
          <Area
            yAxisId="left"
            type="monotone"
            dataKey="weight_lbs"
            stroke="#1D9E75"
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
            stroke="#5DCAA5"
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

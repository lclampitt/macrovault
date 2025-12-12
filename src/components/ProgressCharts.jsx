import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from 'recharts';

/**
 * Props:
 *  rows: Array<{ date: 'YYYY-MM-DD', weight_kg: number|string|null, body_fat_pct: number|string|null }>
 *  (we treat weight_kg as pounds, purely as a naming quirk in the DB)
 */
export default function ProgressCharts({ rows = [] }) {
  // Normalize + sort ascending for nicer lines on the chart
  const data = [...rows]
    .map((r) => ({
      date: r.date,
      // Interpret the weight_kg DB column as pounds in the chart
      weight_lbs:
        r.weight_kg === '' ||
        r.weight_kg === null ||
        r.weight_kg === undefined
          ? null
          : Number(r.weight_kg),
      body_fat_pct:
        r.body_fat_pct === '' ||
        r.body_fat_pct === null ||
        r.body_fat_pct === undefined
          ? null
          : Number(r.body_fat_pct),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // If there is no data yet, show a friendly message instead of an empty chart
  if (!data.length) {
    return (
      <div style={{ color: '#9aa0a6' }}>
        No progress yet—add your first entry below.
      </div>
    );
  }

  // Simple custom tooltip so labels say "lbs" and "BF%"
  const renderTooltip = ({ active, payload, label }) => {
    if (!active || !payload || !payload.length) return null;

    const weight = payload.find((p) => p.dataKey === 'weight_lbs');
    const bf = payload.find((p) => p.dataKey === 'body_fat_pct');

    return (
      <div
        style={{
          background: '#0e0f1a',
          border: '1px solid #2e2e2e',
          borderRadius: 8,
          padding: '8px 10px',
          fontSize: 12,
          color: '#e8f1ff',
        }}
      >
        <div style={{ marginBottom: 4 }}>{label}</div>
        {weight && (
          <div>
            Weight: <strong>{weight.value}</strong> lbs
          </div>
        )}
        {bf && (
          <div>
            BF%: <strong>{bf.value}</strong>
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ height: 320, width: '100%' }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#223" />
          <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#cfd8ff' }} />
          <YAxis
            yAxisId="left"
            tick={{ fontSize: 12, fill: '#cfd8ff' }}
          />
          {/* Right axis is used for body fat percentage */}
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fontSize: 12, fill: '#cfd8ff' }}
          />
          <Tooltip content={renderTooltip} />
          <Legend
            wrapperStyle={{ paddingTop: 8 }}
            // value is the dataKey when no `name` prop is provided on Line
            formatter={(value) =>
              value === 'weight_lbs' ? 'Weight (lbs)' : 'BF%'
            }
          />
          {/* Line for weight over time */}
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="weight_lbs"
            dot={false}
            connectNulls
          />
          {/* Line for body fat percentage over time */}
          <Line
            yAxisId="right"
            type="monotone"
            stroke="#ffffff"
            dataKey="body_fat_pct"
            dot={false}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

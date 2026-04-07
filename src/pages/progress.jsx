import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { BarChart2, Trash2 } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useUpgrade } from '../context/UpgradeContext';
import ProgressCharts from '../components/ProgressCharts';
import { useTheme } from '../hooks/useTheme';
import '../styles/progress.css';

function ProgressGate() {
  const { triggerUpgrade } = useUpgrade();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: '80px 24px', textAlign: 'center' }}>
      <BarChart2 size={48} style={{ color: 'var(--accent)', opacity: 0.6 }} />
      <h2 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Progress Charts</h2>
      <p style={{ color: 'var(--text-muted)', fontSize: 14, margin: 0, maxWidth: 320, lineHeight: 1.6 }}>
        Track your weight and body composition over time with detailed charts. A Pro feature.
      </p>
      <button
        onClick={() => triggerUpgrade('progress')}
        style={{
          marginTop: 4, width: '100%', maxWidth: 320,
          background: 'var(--accent)', color: '#fff',
          fontSize: 14, fontWeight: 500, padding: '13px',
          borderRadius: 'var(--radius-md)', border: 'none', cursor: 'pointer',
          fontFamily: 'inherit',
          transition: 'background 0.15s ease',
        }}
        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--accent-dark)'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'var(--accent)'}
      >
        Upgrade to Pro — $4.99/mo
      </button>
      <button
        onClick={() => triggerUpgrade('progress')}
        style={{
          color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer',
          background: 'none', border: 'none', fontFamily: 'inherit',
          textDecoration: 'underline', textUnderlineOffset: 2,
          transition: 'color 0.15s ease', padding: 0,
        }}
        onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
        onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
      >
        See what's included
      </button>
    </div>
  );
}

/* Count-up hook */
function useCountUp(target, duration = 700) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!target || target === 0) { setVal(0); return; }
    let start = 0;
    const step = target / (duration / 16);
    const t = setInterval(() => {
      start += step;
      if (start >= target) { setVal(target); clearInterval(t); }
      else setVal(start);
    }, 16);
    return () => clearInterval(t);
  }, [target, duration]);
  return val;
}

/* Stat chip with count-up */
function StatChip({ label, value, suffix = '', decimals = 1, index = 0, positive, spectrumColor }) {
  const num = useCountUp(Math.abs(value ?? 0));
  const display = value == null ? '—' : `${positive === false ? '-' : positive ? '+' : ''}${num.toFixed(decimals)}${suffix}`;
  return (
    <motion.div
      className="pg-chip"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.06, ease: 'easeOut' }}
    >
      <span className="pg-chip__value" style={spectrumColor ? { color: spectrumColor } : undefined}>{display}</span>
      <span className="pg-chip__label">{label}</span>
    </motion.div>
  );
}

function ProgressPageContent() {
  const { isSpectrum } = useTheme();
  const [session, setSession] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  // Form state
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [date, setDate] = useState(today);
  const [weightLbs, setWeightLbs] = useState('');
  const [bfPct, setBfPct] = useState('');

  // Get the current user session on mount
  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setSession(data?.session ?? null);
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Once we know who is logged in, load their progress rows
  useEffect(() => {
    if (!session?.user?.id) return;
    fetchRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id]);

  async function fetchRows() {
    setError('');
    setMsg('');
    const uid = session.user.id;
    const { data, error } = await supabase
      .from('progress')
      .select('*')
      .eq('user_id', uid)
      .order('date', { ascending: false });

    if (error) setError(error.message);
    setRows(data ?? []);
  }

  // Add or update a progress entry (one row per date)
  async function handleAdd(e) {
    e.preventDefault();
    setError('');
    setMsg('');
    if (!session?.user?.id) return;

    if (!date) return setError('Please choose a date.');
    const w = weightLbs !== '' ? Number(weightLbs) : null;
    const b = bfPct !== '' ? Number(bfPct) : null;
    if (w === null && b === null) return setError('Enter weight and/or BF%.');

    setSaving(true);

    // Optimistic UI row while we wait for Supabase
    const tempId = `tmp-${Math.random().toString(36).slice(2)}`;
    const optimisticRow = {
      id: tempId,
      user_id: session.user.id,
      date,
      // still stored in the weight_kg column, but interpreted as lbs
      weight_kg: w,
      body_fat_pct: b,
      created_at: new Date().toISOString(),
    };

    // Replace existing row for that date if it exists, otherwise add a new one
    const exists = rows.find((r) => r.date === date);
    if (exists) {
      setRows((prev) => [optimisticRow, ...prev.filter((r) => r.date !== date)]);
    } else {
      setRows((prev) => [optimisticRow, ...prev]);
    }

    // Upsert row in Supabase (unique on {user_id, date})
    const { data, error } = await supabase
      .from('progress')
      .upsert(
        {
          user_id: session.user.id,
          date,
          weight_kg: w,       // column name unchanged (used as lbs)
          body_fat_pct: b,
        },
        { onConflict: ['user_id', 'date'] }
      )
      .select('*')
      .single();

    if (error) {
      // On error, show message and reload server state
      setError(error.message);
      await fetchRows();
    } else {
      // Replace optimistic row with real row from server
      setRows((prev) => [
        data,
        ...prev.filter((r) => r.id !== tempId && r.date !== data.date),
      ]);
      setMsg('Progress saved.');
      setWeightLbs('');
      setBfPct('');
    }
    setSaving(false);
  }

  // Delete a progress entry by id
  async function handleDelete(id) {
    setError('');
    setMsg('');
    setDeletingId(id);

    const prev = rows;
    // Optimistically remove from UI
    setRows(rows.filter((r) => r.id !== id));

    const { error } = await supabase.from('progress').delete().eq('id', id);
    if (error) {
      // If delete fails, roll back UI
      setError(error.message);
      setRows(prev);
    } else {
      setMsg('Deleted.');
    }
    setDeletingId(null);
  }

  if (loading) {
    return <div className="pg"><p className="pg-muted">Loading…</p></div>;
  }
  if (!session) {
    return <div className="pg"><p className="pg-muted">Please log in to view and track your progress.</p></div>;
  }

  /* Derive stat chip values from rows */
  const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));
  const latest  = sorted[sorted.length - 1];
  const first   = sorted[0];
  const currentWeight = latest?.weight_kg ?? null;
  const currentBf     = latest?.body_fat_pct ?? null;
  const weightChange  = (first && latest && first.weight_kg != null && latest.weight_kg != null)
    ? Number((latest.weight_kg - first.weight_kg).toFixed(1)) : null;
  const bfChange      = (first && latest && first.body_fat_pct != null && latest.body_fat_pct != null)
    ? Number((latest.body_fat_pct - first.body_fat_pct).toFixed(1)) : null;

  return (
    <div className="pg">

      {/* Alerts */}
      {error && <div className="pg-alert pg-alert--error">{error}</div>}
      {msg   && <div className="pg-alert pg-alert--success">{msg}</div>}

      {/* Stat chips */}
      <div className="pg-chips">
        <StatChip label="Current weight" value={currentWeight} suffix=" lbs" decimals={1} index={0}
          spectrumColor={isSpectrum ? '#EF9F27' : undefined} />
        <StatChip label="Body fat %" value={currentBf} suffix="%" decimals={1} index={1}
          spectrumColor={isSpectrum ? '#DB2777' : undefined} />
        <StatChip label="Weight change" value={weightChange} suffix=" lbs" decimals={1} index={2}
          positive={weightChange != null ? weightChange <= 0 : undefined}
          spectrumColor={isSpectrum ? '#1D9E75' : undefined} />
        <StatChip label="BF% change" value={bfChange} suffix="%" decimals={1} index={3}
          positive={bfChange != null ? bfChange <= 0 : undefined}
          spectrumColor={isSpectrum ? '#DB2777' : undefined} />
      </div>

      {/* Chart */}
      <motion.div
        className="pg-chart-card"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.1, ease: 'easeOut' }}
      >
        <ProgressCharts rows={rows} />
      </motion.div>

      {/* Add entry form */}
      <motion.div
        className="pg-form-card"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.16, ease: 'easeOut' }}
      >
        <p className="pg-section-title">Add entry</p>
        <form className="pg-form-row" onSubmit={handleAdd}>
          <div className="pg-form-field">
            <label className="pg-form-label">Date</label>
            <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="pg-form-field">
            <label className="pg-form-label">Weight (lbs)</label>
            <input type="number" step="0.1" className="input" placeholder="e.g. 180" value={weightLbs} onChange={(e) => setWeightLbs(e.target.value)} />
          </div>
          <div className="pg-form-field">
            <label className="pg-form-label">Body Fat %</label>
            <input type="number" step="0.1" className="input" placeholder="e.g. 16.8" value={bfPct} onChange={(e) => setBfPct(e.target.value)} />
          </div>
          <div className="pg-form-field pg-form-field--btn">
            <motion.button type="submit" className="btn btn-primary" disabled={saving} whileTap={{ scale: 0.97 }}>
              {saving ? 'Saving…' : 'Save'}
            </motion.button>
          </div>
        </form>
        <p className="pg-tip">Entries are unique per date — saves will overwrite that day.</p>
      </motion.div>

      {/* History table */}
      <motion.div
        className="pg-table-card"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.22, ease: 'easeOut' }}
      >
        <p className="pg-section-title">History</p>
        {rows.length === 0 ? (
          <p className="pg-muted">No entries yet.</p>
        ) : (
          <table className="pg-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Weight (lbs)</th>
                <th>Body Fat %</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => (
                <motion.tr
                  key={r.id}
                  className={`pg-row ${idx % 2 === 0 ? 'pg-row--alt' : ''}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: idx * 0.03 }}
                >
                  <td>{r.date}</td>
                  <td>{r.weight_kg ?? '—'}</td>
                  <td>{r.body_fat_pct ?? '—'}</td>
                  <td>
                    <motion.button
                      className="btn btn-destructive pg-del-btn"
                      onClick={() => handleDelete(r.id)}
                      disabled={deletingId === r.id}
                      whileTap={{ scale: 0.97 }}
                      title="Delete entry"
                    >
                      {deletingId === r.id ? '…' : <Trash2 size={14} />}
                    </motion.button>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        )}
      </motion.div>
    </div>
  );
}

export default function ProgressPage({ isPro = false }) {
  if (!isPro) return <ProgressGate />;
  return <ProgressPageContent />;
}

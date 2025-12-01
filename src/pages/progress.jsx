import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient';
import ProgressCharts from '../components/ProgressCharts';
import '../styles/progress.css';

export default function ProgressPage() {
  const [session, setSession] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  // form
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [date, setDate] = useState(today);
  const [weightLbs, setWeightLbs] = useState('');
  const [bfPct, setBfPct] = useState('');

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

    const exists = rows.find((r) => r.date === date);
    if (exists) {
      setRows((prev) => [optimisticRow, ...prev.filter((r) => r.date !== date)]);
    } else {
      setRows((prev) => [optimisticRow, ...prev]);
    }

    const { data, error } = await supabase
      .from('progress')
      .upsert(
        {
          user_id: session.user.id,
          date,
          weight_kg: w,       // column name unchanged
          body_fat_pct: b,
        },
        { onConflict: ['user_id', 'date'] }
      )
      .select('*')
      .single();

    if (error) {
      setError(error.message);
      await fetchRows();
    } else {
      setRows((prev) => [
        data,
        ...prev.filter((r) => r.id !== tempId && r.date !== data.date),
      ]);
      setMsg('✅ Progress saved.');
      setWeightLbs('');
      setBfPct('');
    }
    setSaving(false);
  }

  async function handleDelete(id) {
    setError('');
    setMsg('');
    setDeletingId(id);

    const prev = rows;
    setRows(rows.filter((r) => r.id !== id));

    const { error } = await supabase.from('progress').delete().eq('id', id);
    if (error) {
      setError(error.message);
      setRows(prev);
    } else {
      setMsg('🗑️ Deleted.');
    }
    setDeletingId(null);
  }

  if (loading) {
    return (
      <div className="progress-page">
        <h2 className="progress-title">Progress</h2>
        <p style={{ color: '#9aa0a6' }}>Loading...</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="progress-guest">
        <h2 className="progress-title">Progress</h2>
        <p>Please log in to view and track your progress.</p>
      </div>
    );
  }

  return (
    <div className="progress-page">
      <h2 className="progress-title">Progress</h2>

      {/* Alerts */}
      {error && (
        <div className="progress-alert progress-alert--error">❌ {error}</div>
      )}
      {msg && (
        <div className="progress-alert progress-alert--success">{msg}</div>
      )}

      {/* Chart */}
      <div className="progress-card progress-card--chart">
        <ProgressCharts rows={rows} />
      </div>

      {/* Add Entry */}
      <div className="progress-card">
        <h3 className="progress-section-title">Add Entry</h3>
        <form className="progress-form" onSubmit={handleAdd}>
          <div className="progress-field">
            <label className="progress-label">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="progress-input"
            />
          </div>
          <div className="progress-field">
            <label className="progress-label">Weight (lbs)</label>
            <input
              type="number"
              step="0.1"
              value={weightLbs}
              onChange={(e) => setWeightLbs(e.target.value)}
              placeholder="e.g. 180"
              className="progress-input"
            />
          </div>
          <div className="progress-field">
            <label className="progress-label">Body Fat %</label>
            <input
              type="number"
              step="0.1"
              value={bfPct}
              onChange={(e) => setBfPct(e.target.value)}
              placeholder="e.g. 16.8"
              className="progress-input"
            />
          </div>
          <div className="progress-save-wrapper">
            <button
              type="submit"
              disabled={saving}
              className="progress-save-btn"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
        <p className="progress-tip">
          Tip: you can fill just weight, just BF%, or both. Entries are unique per
          date—new saves will overwrite that day.
        </p>
      </div>

      {/* History table */}
      <div className="progress-card">
        <div className="progress-card--table-header">
          <span className="progress-section-title">History</span>
        </div>

        {rows.length === 0 ? (
          <div style={{ paddingTop: '0.7rem', color: '#9aa0a6' }}>
            No entries yet.
          </div>
        ) : (
          <div className="progress-table-wrapper">
            <table className="progress-table">
              <thead>
                <tr>
                  <th className="progress-th">Date</th>
                  <th className="progress-th">Weight (lbs)</th>
                  <th className="progress-th">Body Fat %</th>
                  <th className="progress-th" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="progress-row">
                    <td className="progress-td">{r.date}</td>
                    <td className="progress-td">
                      {r.weight_kg ?? '—'}
                    </td>
                    <td className="progress-td">
                      {r.body_fat_pct ?? '—'}
                    </td>
                    <td className="progress-td" style={{ textAlign: 'right' }}>
                      <button
                        onClick={() => handleDelete(r.id)}
                        disabled={deletingId === r.id}
                        className="progress-delete-btn"
                      >
                        {deletingId === r.id ? 'Deleting…' : 'Delete'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

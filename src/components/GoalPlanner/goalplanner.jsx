import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../supabaseClient';
import '../../styles/goalplanner.css';

const emptyMacros = { calories: 0, protein: 0, carbs: 0, fat: 0 };

export default function GoalPlanner({ compact = false }) {
  const [userId, setUserId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const [rowId, setRowId] = useState(null);
  const [goal, setGoal] = useState('');
  const [macros, setMacros] = useState(emptyMacros);
  const [timeframe, setTimeframe] = useState(0);

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // --------------------------------------
  // AUTH + INITIAL FETCH
  // --------------------------------------
  useEffect(() => {
    let mounted = true;

    (async () => {
      setLoading(true);
      setError('');
      setMessage('');

      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (!mounted) return;

      if (userError || !userData?.user) {
        setError('⚠️ Please log in to manage your goal.');
        setLoading(false);
        return;
      }

      const uid = userData.user.id;
      setUserId(uid);

      const { data, error } = await supabase
        .from('goals')
        .select('*')
        .eq('user_id', uid)
        .maybeSingle();

      if (!mounted) return;

      if (error && error.code !== 'PGRST116') {
        setError('Could not fetch your goal.');
      } else if (data) {
        // Existing goal found → populate + start in view mode
        setRowId(data.id ?? null);
        setGoal(data.goal ?? '');
        setMacros({
          calories: Number(data.calories) || 0,
          protein: Number(data.protein) || 0,
          carbs: Number(data.carbs) || 0,
          fat: Number(data.fat) || 0,
        });
        setTimeframe(Number(data.timeframe_weeks) || 0);
        setEditing(false);
      } else {
        // No goal yet → start in editing mode so user sees the form
        setEditing(true);
      }

      setLoading(false);
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const hasGoal = useMemo(
    () => !!goal && timeframe > 0 && macros.calories > 0,
    [goal, timeframe, macros]
  );

  // --------------------------------------
  // SAVE / UPSERT
  // --------------------------------------
  async function handleSave() {
    setError('');
    setMessage('');

    if (!goal) return setError('Please select a goal.');
    if (macros.calories <= 0) return setError('Calories must be greater than 0.');
    if (timeframe <= 0) return setError('Timeframe (weeks) must be greater than 0.');

    setSaving(true);

    const payload = {
      user_id: userId,
      goal,
      calories: Number(macros.calories) || 0,
      protein: Number(macros.protein) || 0,
      carbs: Number(macros.carbs) || 0,
      fat: Number(macros.fat) || 0,
      timeframe_weeks: Number(timeframe) || 0,
    };

    const { data, error } = await supabase
      .from('goals')
      .upsert(payload, { onConflict: ['user_id'] })
      .select('*')
      .maybeSingle();

    if (error) {
      setError(`❌ Error saving goal: ${error.message}`);
    } else {
      setRowId(data?.id ?? rowId);
      setMessage('✅ Goal saved successfully!');
      setEditing(false); // switch to view mode after save
    }

    setSaving(false);
  }

  // --------------------------------------
  // DELETE
  // --------------------------------------
  async function handleDelete() {
    if (!userId) return;
    setDeleting(true);
    setError('');
    setMessage('');

    const { error } = await supabase
      .from('goals')
      .delete()
      .eq('user_id', userId);

    if (error) {
      setError(`❌ Error deleting goal: ${error.message}`);
    } else {
      setRowId(null);
      setGoal('');
      setMacros(emptyMacros);
      setTimeframe(0);
      setMessage('🗑️ Goal deleted.');
      setEditing(true); // back to blank form after delete
    }
    setDeleting(false);
    setConfirmDelete(false);
  }

  // --------------------------------------
  // RENDER
  // --------------------------------------
  return (
    <div className={`goalplanner-container ${compact ? 'compact' : ''}`}>
      {!compact && (
        <div className="goalplanner-header">
          <h2>Goal Planner</h2>
          {userId && (
            <button
              onClick={() => setEditing((e) => !e)}
              className="goalplanner-toggle"
            >
              {editing ? 'Close' : hasGoal ? 'Edit' : 'Add Goal'}
            </button>
          )}
        </div>
      )}

      {loading && <p className="goalplanner-loading">Loading…</p>}
      {!loading && error && <p className="goalplanner-error">{error}</p>}
      {!loading && message && (
        <p
          className={`goalplanner-message ${
            message.startsWith('✅') ? 'success' : ''
          }`}
        >
          {message}
        </p>
      )}

      {/* EDIT / CREATE FORM */}
      {!loading && editing && (
        <div className="goalplanner-form">
          <h3>{rowId ? 'Edit Goal' : 'Create Goal'}</h3>

          <div className="goalplanner-goal-options">
            {['Cutting', 'Bulking', 'Maintenance'].map((g) => (
              <button
                key={g}
                onClick={() => setGoal(g)}
                className={`goalplanner-option ${
                  goal === g ? 'selected' : ''
                }`}
              >
                {g}
              </button>
            ))}
          </div>

          <h4>Macronutrients</h4>
          {['calories', 'protein', 'carbs', 'fat'].map((m) => (
            <div key={m} className="goalplanner-input-group">
              <label>{m}:</label>
              <input
                type="number"
                value={macros[m]}
                onChange={(e) =>
                  setMacros({
                    ...macros,
                    [m]: parseInt(e.target.value, 10) || 0,
                  })
                }
              />
              <span>{m === 'calories' ? 'kcal/day' : 'g/day'}</span>
            </div>
          ))}

          <h4>Estimated Timeframe (weeks)</h4>
          <input
            type="number"
            value={timeframe}
            onChange={(e) =>
              setTimeframe(parseInt(e.target.value, 10) || 0)
            }
            className="goalplanner-timeframe"
          />

          <div className="goalplanner-actions">
            <button
              onClick={handleSave}
              disabled={saving}
              className="save"
            >
              {saving ? 'Saving…' : 'Save Goal'}
            </button>
            {rowId && (
              <button
                onClick={() => setConfirmDelete(true)}
                disabled={deleting}
                className="delete"
              >
                {deleting ? 'Deleting…' : 'Delete Goal'}
              </button>
            )}
          </div>

          {confirmDelete && (
            <div className="goalplanner-confirm">
              <span>Delete your current goal permanently?</span>
              <div>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="confirm-yes"
                >
                  Yes, delete
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="confirm-cancel"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* READ-ONLY VIEW */}
      {!loading && hasGoal && !editing && (
        <div className="goalplanner-view">
          {!compact && <h3>Your Current Goal</h3>}
          <p>
            <strong>Goal:</strong> {goal}
          </p>
          <p>
            <strong>Calories:</strong> {macros.calories} kcal/day
          </p>
          <p>
            <strong>Protein:</strong> {macros.protein} g/day
          </p>
          <p>
            <strong>Carbs:</strong> {macros.carbs} g/day
          </p>
          <p>
            <strong>Fat:</strong> {macros.fat} g/day
          </p>
          <p>
            <strong>Timeframe:</strong> {timeframe} weeks
          </p>
        </div>
      )}
    </div>
  );
}

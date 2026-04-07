import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { User, UserRound, TrendingDown, Minus, TrendingUp, X } from 'lucide-react';
import { appToast as toast } from '../utils/toast';
import { supabase } from '../supabaseClient';

// ── Constants ──────────────────────────────────────────────────────────────────

const TOTAL_STEPS = 6;

const ACTIVITY_OPTS = [
  { value: 'sedentary', label: 'Sedentary',        sub: 'Little or no exercise, desk job',        mult: 1.2   },
  { value: 'light',     label: 'Lightly active',    sub: 'Light exercise 1–3 days per week',        mult: 1.375 },
  { value: 'moderate',  label: 'Moderately active', sub: 'Moderate exercise 3–5 days per week',     mult: 1.55  },
  { value: 'active',    label: 'Very active',       sub: 'Hard exercise 6–7 days per week',         mult: 1.725 },
  { value: 'extra',     label: 'Extra active',      sub: 'Very hard exercise or physical job',      mult: 1.9   },
];

const GOAL_OPTS = [
  { value: 'cut',      label: 'Cut',      sub: '500 kcal deficit', Icon: TrendingDown, delta: -500 },
  { value: 'maintain', label: 'Maintain', sub: 'At TDEE',          Icon: Minus,        delta: 0    },
  { value: 'bulk',     label: 'Bulk',     sub: '300 kcal surplus', Icon: TrendingUp,   delta: 300  },
];

const DIET_OPTS = [
  { value: 'standard',    label: 'Standard',     fatPct: 0.25 },
  { value: 'lowcarb',     label: 'Low carb',     fatPct: 0.40 },
  { value: 'keto',        label: 'Keto',         fatPct: 0.65 },
  { value: 'highprotein', label: 'High protein', fatPct: 0.20 },
];

// ── Shared styles ──────────────────────────────────────────────────────────────

const inputStyle = {
  background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: 8,
  padding: '10px 12px', fontSize: 13, color: 'var(--text-primary)', fontFamily: 'inherit',
  outline: 'none', width: '100%', boxSizing: 'border-box',
};

const tealBtn = {
  background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8,
  padding: '10px 24px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
};

const outlineBtn = {
  background: 'transparent', color: 'var(--accent-light)', border: '1px solid var(--border)',
  borderRadius: 8, padding: '10px 20px', fontSize: 13,
  fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
};

// ── Unit pill toggle ───────────────────────────────────────────────────────────

function UnitPills({ value, onChange, opts }) {
  return (
    <div style={{ display: 'inline-flex', gap: 4 }}>
      {opts.map(o => (
        <button key={o.value} onClick={() => onChange(o.value)} style={value === o.value ? {
          background: 'var(--accent-bg)', border: '1px solid var(--accent)', color: 'var(--accent-light)',
          borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit',
        } : {
          background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-muted)',
          borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit',
        }}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ── Animated number ────────────────────────────────────────────────────────────

function AnimatedNumber({ value, duration = 600, delay = 0 }) {
  const [disp, setDisp] = useState(0);
  useEffect(() => {
    let frame;
    const startTime = performance.now() + delay;
    function tick(now) {
      if (now < startTime) { frame = requestAnimationFrame(tick); return; }
      const t = Math.min((now - startTime) / duration, 1);
      setDisp(Math.round(value * (1 - Math.pow(1 - t, 3))));
      if (t < 1) frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration, delay]);
  return disp;
}

// ── Math ───────────────────────────────────────────────────────────────────────

function computeMacros({ sex, age, heightUnit, heightFt, heightIn, heightCm, weightUnit, weight, bodyFat, activity, goal, diet }) {
  const weightKg  = weightUnit === 'imperial' ? Number(weight) * 0.453592 : Number(weight);
  const heightCmN = heightUnit === 'imperial'
    ? (Number(heightFt) * 12 + Number(heightIn || 0)) * 2.54
    : Number(heightCm);
  const ageN   = Number(age);
  const isMale = sex === 'male';

  const bmr  = Math.round(10 * weightKg + 6.25 * heightCmN - 5 * ageN + (isMale ? 5 : -161));
  const mult = ACTIVITY_OPTS.find(a => a.value === activity)?.mult ?? 1.55;
  const tdee = Math.round(bmr * mult);
  const delta      = GOAL_OPTS.find(g => g.value === goal)?.delta ?? 0;
  const targetCals = Math.round((tdee + delta) / 10) * 10;

  const weightLbs   = weightUnit === 'imperial' ? Number(weight) : Number(weight) * 2.20462;
  const bfPct       = bodyFat !== '' ? Number(bodyFat) : (isMale ? 15 : 25);
  const leanMassLbs = weightLbs * (1 - bfPct / 100);
  let ageMult = 1.0;
  if (ageN >= 60) ageMult = 1.20;
  else if (ageN >= 50) ageMult = 1.15;
  else if (ageN >= 40) ageMult = 1.08;
  let proteinG = Math.round(leanMassLbs * 0.88 * ageMult);

  const fatPct = DIET_OPTS.find(d => d.value === diet)?.fatPct ?? 0.25;
  let fatG     = Math.round((targetCals * fatPct) / 9);
  let carbG    = Math.round((targetCals - proteinG * 4 - fatG * 9) / 4);

  if (carbG < 20) {
    carbG    = 20;
    proteinG = Math.max(0, Math.round((targetCals - carbG * 4 - fatG * 9) / 4));
  }

  return { bmr, tdee, targetCals, proteinG, carbG, fatG };
}

// ── Results view ───────────────────────────────────────────────────────────────

function ResultsView({ results, goal, onReset, onSave, onCopy, saving = false }) {
  const { tdee, targetCals, proteinG, carbG, fatG } = results;
  const goalBadge  = { cut: 'Cutting phase', maintain: 'Maintenance', bulk: 'Building phase' }[goal] ?? '';
  const deltaLabel = goal === 'cut' ? 'Deficit: −500 kcal' : goal === 'bulk' ? 'Surplus: +300 kcal' : 'Maintenance';

  const totalCals = proteinG * 4 + carbG * 4 + fatG * 9;
  const pPct = Math.round((proteinG * 4 / totalCals) * 100);
  const cPct = Math.round((carbG * 4 / totalCals) * 100);
  const fPct = 100 - pPct - cPct;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      style={{ maxWidth: 560, margin: '0 auto' }}
    >
      <div style={{
        background: 'var(--bg-surface)', border: '1px solid var(--accent)', borderRadius: 12,
        padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 24,
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-primary)' }}>Your macro targets</span>
          <span style={{
            background: 'var(--accent-bg)', border: '1px solid var(--accent)',
            color: 'var(--accent-light)', borderRadius: 99, fontSize: 11, padding: '2px 10px', fontWeight: 500,
          }}>{goalBadge}</span>
        </div>

        {/* Calories */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 36, fontWeight: 500, color: 'var(--accent)', lineHeight: 1 }}>
            <AnimatedNumber value={targetCals} duration={600} />
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>kcal per day</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
            TDEE: {tdee.toLocaleString()} kcal · {deltaLabel}
          </div>
        </div>

        {/* Macro cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          {[
            { label: 'PROTEIN', grams: proteinG, color: 'var(--accent)', pct: pPct, delay: 0   },
            { label: 'CARBS',   grams: carbG,    color: 'var(--accent-light)', pct: cPct, delay: 100 },
            { label: 'FAT',     grams: fatG,     color: 'var(--accent-dark)', pct: fPct, delay: 200 },
          ].map(m => (
            <motion.div
              key={m.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: m.delay / 1000 }}
              style={{ background: 'var(--bg-base)', borderRadius: 8, padding: '14px 16px' }}
            >
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{m.label}</div>
              <div style={{ fontSize: 22, fontWeight: 500, color: m.color, lineHeight: 1.2, marginTop: 4 }}>
                <AnimatedNumber value={m.grams} duration={600} delay={m.delay} />g
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>{m.pct}% of calories</div>
            </motion.div>
          ))}
        </div>

        {/* Ratio bar */}
        <div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 6 }}>Macro ratio</div>
          <div style={{ height: 8, borderRadius: 4, overflow: 'hidden', display: 'flex' }}>
            {[
              { pct: pPct, color: 'var(--accent)', delay: 0   },
              { pct: cPct, color: 'var(--accent-light)', delay: 0.1 },
              { pct: fPct, color: 'var(--accent-dark)', delay: 0.2 },
            ].map((seg, i) => (
              <motion.div key={i}
                initial={{ width: 0 }} animate={{ width: `${seg.pct}%` }}
                transition={{ duration: 0.6, delay: seg.delay, ease: 'easeOut' }}
                style={{ background: seg.color, height: '100%' }}
              />
            ))}
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 6 }}>
            {[['Protein', 'var(--accent)'], ['Carbs', 'var(--accent-light)'], ['Fat', 'var(--accent-dark)']].map(([l, c]) => (
              <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: c }} />
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{l}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Per-meal */}
        <div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 8 }}>Per meal (based on 3 meals/day)</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            {[
              { label: 'Calories', value: Math.round(targetCals / 3) },
              { label: 'Protein',  value: `${Math.round(proteinG / 3)}g` },
              { label: 'Carbs',    value: `${Math.round(carbG / 3)}g` },
              { label: 'Fat',      value: `${Math.round(fatG / 3)}g` },
            ].map(m => (
              <div key={m.label} style={{ background: 'var(--bg-base)', borderRadius: 6, padding: '8px 10px' }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 3 }}>{m.label}</div>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>{m.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button style={{ ...tealBtn, opacity: saving ? 0.7 : 1 }} onClick={onSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save to Goal Planner'}
          </button>
          <button style={outlineBtn} onClick={onReset}>Recalculate</button>
          <button style={outlineBtn} onClick={onCopy}>Copy results</button>
        </div>

        <p style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5, margin: 0 }}>
          These are estimates based on established nutritional formulas. Individual needs vary.
          Adjust based on real-world results over 2–4 weeks.
        </p>
      </div>
    </motion.div>
  );
}

// ── Main wizard ────────────────────────────────────────────────────────────────

export default function MacroCalculator() {
  const navigate = useNavigate();
  const dirRef   = useRef(1);

  const [step,       setStep]       = useState(1);
  const [results,    setResults]    = useState(null);
  const [error,      setError]      = useState('');
  const [sex,        setSex]        = useState(null);
  const [age,        setAge]        = useState('');
  const [heightUnit, setHeightUnit] = useState('imperial');
  const [heightFt,   setHeightFt]   = useState('');
  const [heightIn,   setHeightIn]   = useState('');
  const [heightCm,   setHeightCm]   = useState('');
  const [weightUnit, setWeightUnit] = useState('imperial');
  const [weight,     setWeight]     = useState('');
  const [bodyFat,    setBodyFat]    = useState('');
  const [activity,   setActivity]   = useState('moderate');
  const [goal,       setGoal]       = useState('cut');
  const [diet,       setDiet]       = useState('standard');
  const [showBfInfo, setShowBfInfo] = useState(false);

  function validate() {
    if (step === 1 && !sex) return 'Please select your biological sex.';
    if (step === 2) {
      if (!age || Number(age) < 16 || Number(age) > 80) return 'Please enter a valid age (16–80).';
      if (!weight || Number(weight) <= 0) return 'Please enter a valid weight.';
      if (heightUnit === 'imperial' && (!heightFt || Number(heightFt) <= 0)) return 'Please enter your height in ft.';
      if (heightUnit === 'metric'   && (!heightCm || Number(heightCm) <= 0)) return 'Please enter your height in cm.';
    }
    return '';
  }

  function next() {
    const err = validate();
    if (err) { setError(err); return; }
    setError('');
    if (step === TOTAL_STEPS) {
      const res = computeMacros({ sex, age, heightUnit, heightFt, heightIn, heightCm, weightUnit, weight, bodyFat, activity, goal, diet });
      setResults(res);
      localStorage.setItem('macrovault_macro_results', JSON.stringify({
        calories: res.targetCals, protein_g: res.proteinG,
        carbs_g: res.carbG, fat_g: res.fatG, goal,
        calculated_at: new Date().toISOString(),
      }));
      return;
    }
    dirRef.current = 1;
    setStep(s => s + 1);
  }

  function back() {
    setError('');
    dirRef.current = -1;
    setStep(s => s - 1);
  }

  function reset() {
    setResults(null); setSex(null); setAge(''); setHeightFt(''); setHeightIn('');
    setHeightCm(''); setWeight(''); setBodyFat(''); setActivity('moderate');
    setGoal('cut'); setDiet('standard'); dirRef.current = 1; setStep(1);
  }

  const [showConfirm, setShowConfirm] = useState(false);
  const [savingGoal, setSavingGoal]   = useState(false);

  async function saveToGoalPlanner() {
    setSavingGoal(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error('Please sign in to save.'); setSavingGoal(false); return; }

      // Check if user already has goal data with actual values
      const { data: existing } = await supabase
        .from('goals')
        .select('calories, protein, carbs, fat')
        .eq('user_id', user.id)
        .maybeSingle();

      const hasExisting = existing && (existing.calories > 0 || existing.protein > 0);

      if (hasExisting) {
        // Ask user to confirm overwrite
        setSavingGoal(false);
        setShowConfirm(true);
      } else {
        // No existing data — save automatically
        await doSaveToGoals(user.id);
      }
    } catch (err) {
      toast.error('Something went wrong.');
      setSavingGoal(false);
    }
  }

  async function doSaveToGoals(uid) {
    setSavingGoal(true);
    try {
      const goalType = goal === 'cut' ? 'Cutting' : goal === 'bulk' ? 'Bulking' : 'Maintenance';

      const { error } = await supabase
        .from('goals')
        .upsert({
          user_id: uid,
          goal: goalType,
          calories: results.targetCals,
          protein: results.proteinG,
          carbs: results.carbG,
          fat: results.fatG,
        }, { onConflict: ['user_id'] });

      if (error) throw error;

      toast.success('Macro targets saved to Goal Planner!');
      navigate('/goalplanner');
    } catch (err) {
      toast.error('Failed to save to Goal Planner.');
    } finally {
      setSavingGoal(false);
      setShowConfirm(false);
    }
  }

  async function handleConfirmUpdate() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) await doSaveToGoals(user.id);
  }

  function copyResults() {
    const text = `Macro targets: ${results.targetCals} kcal | ${results.proteinG}g protein | ${results.carbG}g carbs | ${results.fatG}g fat`;
    navigator.clipboard.writeText(text).then(() => toast.success('Copied to clipboard'));
  }

  const variants = {
    enter:  (dir) => ({ x: dir > 0 ? 40 : -40, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit:   (dir) => ({ x: dir > 0 ? -40 : 40, opacity: 0 }),
  };

  function renderStep() {
    const Q   = ({ children }) => <h2 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 6px' }}>{children}</h2>;
    const Sub = ({ children }) => <p  style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 20px', lineHeight: 1.5 }}>{children}</p>;

    switch (step) {
      case 1:
        return (
          <>
            <Q>What is your biological sex?</Q>
            <Sub>Used for the BMR calculation</Sub>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[{ val: 'male', label: 'Male', Icon: User }, { val: 'female', label: 'Female', Icon: UserRound }].map(({ val, label, Icon }) => (
                <motion.button key={val} onClick={() => setSex(val)}
                  whileTap={{ scale: 0.97 }}
                  animate={{ scale: sex === val ? 1.02 : 1 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                  style={{
                    background: sex === val ? 'var(--accent-bg)' : 'var(--bg-base)',
                    border: `1px solid ${sex === val ? 'var(--accent)' : 'var(--border)'}`,
                    borderRadius: 10, padding: 20, cursor: 'pointer',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, fontFamily: 'inherit',
                  }}
                >
                  <Icon width={28} height={28} stroke={sex === val ? 'var(--accent)' : 'var(--text-muted)'} strokeWidth={1.5} fill="none" />
                  <span style={{ fontSize: 13, fontWeight: 500, color: sex === val ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{label}</span>
                </motion.button>
              ))}
            </div>
          </>
        );

      case 2:
        return (
          <>
            <Q>Tell us about your body</Q>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>Age (years)</label>
                <input type="number" min="16" max="80" value={age} onChange={e => setAge(e.target.value)} style={inputStyle} placeholder="e.g. 28" />
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)' }}>Height</label>
                  <UnitPills value={heightUnit} onChange={setHeightUnit} opts={[{ value: 'imperial', label: 'ft/in' }, { value: 'metric', label: 'cm' }]} />
                </div>
                {heightUnit === 'imperial' ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <input type="number" min="0" value={heightFt} onChange={e => setHeightFt(e.target.value)} style={inputStyle} placeholder="ft" />
                    <input type="number" min="0" max="11" value={heightIn} onChange={e => setHeightIn(e.target.value)} style={inputStyle} placeholder="in" />
                  </div>
                ) : (
                  <input type="number" min="0" value={heightCm} onChange={e => setHeightCm(e.target.value)} style={inputStyle} placeholder="cm" />
                )}
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)' }}>Weight</label>
                  <UnitPills value={weightUnit} onChange={setWeightUnit} opts={[{ value: 'imperial', label: 'lbs' }, { value: 'metric', label: 'kg' }]} />
                </div>
                <input type="number" min="0" value={weight} onChange={e => setWeight(e.target.value)} style={inputStyle} placeholder={weightUnit === 'imperial' ? 'e.g. 175' : 'e.g. 80'} />
              </div>
            </div>
          </>
        );

      case 3:
        return (
          <>
            <Q>Do you know your body fat %?</Q>
            <Sub>Used for a more accurate protein target. Skip if unsure.</Sub>
            <input type="number" min="0" max="50" value={bodyFat} onChange={e => setBodyFat(e.target.value)} style={inputStyle} placeholder="e.g. 18" />
            <div style={{ marginTop: 12 }}>
              <button onClick={() => setShowBfInfo(v => !v)}
                style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 12, cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>
                Don't know your body fat %?
              </button>
              {showBfInfo && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                  style={{ marginTop: 10, background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px' }}>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6, margin: 0 }}>
                    The Navy method estimates body fat from waist, neck, and hip measurements.
                    Or use the AI Body Analyzer for a photo-based estimate. If you skip, we'll use a
                    conservative estimate (15% for males, 25% for females).
                  </p>
                </motion.div>
              )}
            </div>
            <button onClick={() => { setBodyFat(''); dirRef.current = 1; setStep(s => s + 1); }}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer', padding: 0, marginTop: 14, fontFamily: 'inherit', display: 'block' }}>
              Skip this step
            </button>
          </>
        );

      case 4:
        return (
          <>
            <Q>How active are you?</Q>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
              {ACTIVITY_OPTS.map(opt => {
                const sel = activity === opt.value;
                return (
                  <div key={opt.value} onClick={() => setActivity(opt.value)} style={{
                    borderLeft: `3px solid ${sel ? 'var(--accent)' : 'transparent'}`,
                    background: sel ? 'var(--accent-bg)' : 'transparent',
                    borderRadius: '0 8px 8px 0', padding: '12px 14px',
                    cursor: 'pointer', transition: 'all 0.15s ease',
                  }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: sel ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{opt.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{opt.sub}</div>
                  </div>
                );
              })}
            </div>
          </>
        );

      case 5:
        return (
          <>
            <Q>What is your primary goal?</Q>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginTop: 8 }}>
              {GOAL_OPTS.map(({ value: val, label, sub, Icon }) => {
                const sel = goal === val;
                return (
                  <motion.button key={val} onClick={() => setGoal(val)}
                    whileTap={{ scale: 0.97 }}
                    animate={{ scale: sel ? 1.02 : 1 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                    style={{
                      background: sel ? 'var(--accent-bg)' : 'var(--bg-base)',
                      border: `1px solid ${sel ? 'var(--accent)' : 'var(--border)'}`,
                      borderRadius: 10, padding: '16px 12px', cursor: 'pointer',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, fontFamily: 'inherit',
                    }}>
                    <Icon width={20} height={20} stroke={sel ? 'var(--accent)' : 'var(--text-muted)'} strokeWidth={1.5} fill="none" />
                    <span style={{ fontSize: 13, fontWeight: 500, color: sel ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{label}</span>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{sub}</span>
                  </motion.button>
                );
              })}
            </div>
          </>
        );

      case 6:
        return (
          <>
            <Q>Any dietary preference?</Q>
            <Sub>Adjusts your macro split</Sub>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {DIET_OPTS.map(({ value: val, label }) => {
                const sel = diet === val;
                return (
                  <button key={val} onClick={() => setDiet(val)} style={{
                    background: sel ? 'var(--accent-bg)' : 'transparent',
                    border: `1px solid ${sel ? 'var(--accent)' : 'var(--border)'}`,
                    color: sel ? 'var(--accent-light)' : 'var(--text-muted)', borderRadius: 99,
                    padding: '7px 16px', fontSize: 13, cursor: 'pointer',
                    fontFamily: 'inherit', transition: 'all 0.15s ease',
                  }}>
                    {label}
                  </button>
                );
              })}
            </div>
          </>
        );

      default: return null;
    }
  }

  if (results) {
    return (
      <>
        <ResultsView results={results} goal={goal} onReset={reset} onSave={saveToGoalPlanner} onCopy={copyResults} saving={savingGoal} />

        {/* Confirmation modal — shown when user already has goal data */}
        <AnimatePresence>
          {showConfirm && (
            <>
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={() => setShowConfirm(false)}
                style={{
                  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
                  zIndex: 500, backdropFilter: 'blur(2px)',
                }}
              />
              <div style={{
                position: 'fixed', inset: 0, zIndex: 600,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                pointerEvents: 'none',
              }}>
                <motion.div
                  initial={{ opacity: 0, scale: 0.94, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.94, y: 20 }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                  style={{
                    pointerEvents: 'all',
                    background: 'var(--bg-surface, #0e1624)',
                    border: '1px solid var(--border-light, #20304a)',
                    borderRadius: 12, padding: '28px 32px',
                    maxWidth: 420, width: '90%',
                    boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
                    position: 'relative',
                  }}
                >
                  <button
                    onClick={() => setShowConfirm(false)}
                    style={{
                      position: 'absolute', top: 12, right: 12,
                      background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4,
                    }}
                  >
                    <X size={16} />
                  </button>
                  <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 8px' }}>
                    Update Goal Planner?
                  </h3>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, margin: '0 0 20px' }}>
                    You already have macro targets saved in your Goal Planner. Would you like to replace them with these new calculations?
                  </p>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button
                      style={{ ...outlineBtn, flex: 1 }}
                      onClick={() => setShowConfirm(false)}
                    >
                      Keep current
                    </button>
                    <button
                      style={{ ...tealBtn, flex: 1 }}
                      onClick={handleConfirmUpdate}
                      disabled={savingGoal}
                    >
                      {savingGoal ? 'Saving...' : 'Update targets'}
                    </button>
                  </div>
                </motion.div>
              </div>
            </>
          )}
        </AnimatePresence>
      </>
    );
  }

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Progress bar */}
      <div>
        <div style={{ height: 3, background: 'var(--border)', borderRadius: 99, overflow: 'hidden' }}>
          <motion.div
            style={{ height: '100%', background: 'var(--accent)', borderRadius: 99 }}
            animate={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          />
        </div>
        <div style={{ textAlign: 'right', fontSize: 10, color: 'var(--text-muted)', marginTop: 5 }}>
          Step {step} of {TOTAL_STEPS}
        </div>
      </div>

      {/* Step card */}
      <AnimatePresence mode="wait" custom={dirRef.current}>
        <motion.div
          key={step}
          custom={dirRef.current}
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.25, ease: 'easeOut' }}
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '28px 32px' }}
        >
          {renderStep()}
          {error && <div style={{ color: '#f87171', fontSize: 12, marginTop: 10 }}>{error}</div>}
          <div style={{ display: 'flex', justifyContent: step > 1 ? 'space-between' : 'flex-end', marginTop: 24 }}>
            {step > 1 && <button style={outlineBtn} onClick={back}>Back</button>}
            <button style={tealBtn} onClick={next}>
              {step === TOTAL_STEPS ? 'Continue to results' : 'Continue'}
            </button>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
